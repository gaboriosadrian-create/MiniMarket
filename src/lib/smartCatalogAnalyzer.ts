import * as XLSX from 'xlsx';
import { Product } from '../types';
import { 
  TargetFieldKey, 
  ColumnMapping, 
  MappingConfidence, 
  SheetInfo, 
  CategoryProposal, 
  ParsedCatalogProduct, 
  SmartCatalogAnalysisResult,
  RowValidationStatus 
} from './smartCatalogTypes';
import { 
  normalizeText, 
  normalizeDisplayText, 
  normalizeCategoryName, 
  normalizeProductName,
  normalizeHeaderString,
  findMatchingCategory, 
  findMatchingSupplier 
} from './categoryUtils';
import { sanitizeString } from './securityUtils';

export const MAX_IMPORT_FILE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB
export const MAX_IMPORT_ROWS = 10000; // 10,000 rows max

// Prototype pollution guard keys
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

// Re-export normalizeHeaderString from categoryUtils for backwards compatibility
export { normalizeHeaderString };

/**
 * Checks if a normalized header represents Cost Price (Precio de Costo / Compra)
 */
export function isCostHeader(norm: string): boolean {
  if (!norm) return false;

  const costExactAliases = new Set([
    'costo', 'coste', 'costos', 'costes',
    'precio costo', 'precio de costo', 'preciocosto', 'p costo', 'p c', 'pc', 'p.costo', 'p. costo',
    'costo unitario', 'coste unitario', 'costo unit', 'coste unit',
    'precio compra', 'precio de compra', 'compra', 'compras', 'p compra',
    'costo proveedor', 'costo prov', 'costo distribuidor',
    'valor compra', 'importe costo', 'costo neto', 'costo total',
    'cost', 'unit cost', 'purchase price', 'buying price'
  ]);

  if (costExactAliases.has(norm)) return true;

  const costSubstrings = [
    'costo', 'coste', 'precio costo', 'de costo', 'costo unitario',
    'precio compra', 'de compra', 'costo proveedor', 'valor compra',
    'importe costo', 'costo neto'
  ];

  return costSubstrings.some(kw => norm.includes(kw));
}

/**
 * Calculates priority score for Sale Price (Precio de Venta).
 * Higher score = higher priority. Returns 0 if not a sale price candidate.
 */
export function getSalePricePriority(norm: string): number {
  if (!norm) return 0;
  
  // NEVER classify cost columns as sale price
  if (isCostHeader(norm)) return 0;

  // Tier 1: Explicit Sale Price / PVP / P. Venta / PV (Score: 100)
  const tier1 = [
    'precio venta', 'precio de venta', 'precioventa', 'p venta', 'p. venta', 'p.venta', 
    'p v', 'p.v.', 'p.v', 'pv', 'pvp', 'p v p', 'precio venta final', 'valor venta', 
    'importe venta', 'precio vta', 'p vta', 'precio venta publico'
  ];
  if (tier1.some(alias => norm === alias || norm.startsWith(alias + ' ') || norm.endsWith(' ' + alias))) {
    return 100;
  }

  // Tier 2: Public / Retail / Shelf / Counter (Score: 85)
  const tier2 = [
    'precio publico', 'precio al publico', 'precio minorista', 'precio mostrador', 
    'p publico', 'p. publico', 'p.publico', 'precio cliente', 'precio salon', 'publico'
  ];
  if (tier2.some(alias => norm === alias || norm.includes(alias))) {
    return 85;
  }

  // Tier 3: Final Price (Score: 70)
  const tier3 = ['precio final', 'valor final', 'importe final', 'precio contado'];
  if (tier3.some(alias => norm === alias || norm.includes(alias))) {
    return 70;
  }

  // Tier 4: Price List (Score: 55)
  const tier4 = ['precio lista', 'lista de precios', 'lista 1', 'lista', 'lista precio', 'precio lista 1'];
  if (tier4.some(alias => norm === alias || norm.includes(alias))) {
    return 55;
  }

  // Tier 5: Unit Price (Score: 40)
  const tier5 = ['precio unitario', 'precio unit', 'precio unit.', 'p unitario', 'p unit', 'unitario', 'unit price'];
  if (tier5.some(alias => norm === alias || norm.includes(alias))) {
    return 40;
  }

  // Tier 6: Generic Price / Venta / Price / Importe / Valor (Score: 25)
  const tier6 = ['precio', 'venta', 'price', 'importe', 'valor'];
  if (tier6.some(alias => norm === alias || norm.includes(alias))) {
    return 25;
  }

  return 0;
}

/**
 * Parses monetary text to a clean JavaScript number.
 * Robustly handles Argentine / European formats ("$ 1.800,50", "1.800", "1800,50")
 * as well as standard US formats ("$ 1,800.50", "1800.50").
 */
export function parseMonetaryValue(val: any, defaultValue: number = 0): number {
  if (val === null || val === undefined) return defaultValue;
  if (typeof val === 'number') {
    return isNaN(val) ? defaultValue : Math.max(0, val);
  }

  let str = String(val).trim();
  if (!str) return defaultValue;

  // Remove currency symbols, letters, and extraneous spaces except digits, '.', ',', '-'
  str = str.replace(/[$€£ARSUSD\s\u00A0]/gi, '').trim();
  if (!str) return defaultValue;

  const isNegative = str.startsWith('-');
  str = str.replace(/^-/, '').trim();

  // Case 1: Contains BOTH dot and comma (e.g. "1.800,50" or "1,800.50" or "1.500.000,50")
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastDot < lastComma) {
      // Argentine format: "1.800,50" or "1.500.000,50" (dots are thousands, comma is decimal)
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // US format: "1,800.50" (commas are thousands, dot is decimal)
      str = str.replace(/,/g, '');
    }
  } 
  // Case 2: Only comma(s), no dot (e.g. "1800,50", "0,50", "1,800,000")
  else if (str.includes(',')) {
    const commaCount = (str.match(/,/g) || []).length;
    if (commaCount > 1) {
      // Multiple commas -> thousands separators: "1,800,000"
      str = str.replace(/,/g, '');
    } else {
      // Single comma -> standard decimal separator in Argentine format: "1800,50" -> "1800.50"
      str = str.replace(',', '.');
    }
  } 
  // Case 3: Only dot(s), no comma (e.g. "1.800", "12.500", "150.000", "1.500.000", "1800.50", "0.50")
  else if (str.includes('.')) {
    const dotCount = (str.match(/\./g) || []).length;
    if (dotCount > 1) {
      // Multiple dots -> thousands separators: "1.500.000" -> "1500000"
      str = str.replace(/\./g, '');
    } else {
      // Single dot: disambiguate thousands dot vs decimal dot
      const parts = str.split('.');
      const integerPart = parts[0];
      const afterDot = parts[1] || '';

      // If afterDot is exactly 3 digits and integerPart is 1 to 3 digits (e.g. "1.800", "12.500", "150.000")
      // In Argentine price context, these are thousands of pesos without decimal cents
      if (afterDot.length === 3 && /^\d{1,3}$/.test(integerPart)) {
        str = str.replace(/\./g, '');
      } else {
        // e.g. "1800.50", "1800.5", "0.50", "12.00" -> decimal dot
        // Leave as is
      }
    }
  }

  const num = parseFloat(str);
  if (isNaN(num)) return defaultValue;
  const finalVal = isNegative ? -num : num;
  return Math.max(0, finalVal);
}

/**
 * Backwards-compatible alias for parseMonetaryValue
 */
export function parsePriceOrNumber(val: any, defaultValue: number = 0): number {
  return parseMonetaryValue(val, defaultValue);
}

/**
 * Formats a monetary number into standard Argentine currency preview string (e.g. "$ 1.800,00")
 */
export function formatCurrencyPreview(val: number): string {
  if (isNaN(val) || val === null || val === undefined) return '$ 0,00';
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(val);
}

/**
 * Parses boolean flag for "withoutStockControl" / "tracksStock"
 */
export function parseBooleanFlag(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'number') return val === 1;
  const str = String(val).toLowerCase().trim();
  return ['si', 'sí', 'yes', 'true', '1', 's', 'sin control', 'servicio'].includes(str);
}

/**
 * Dictionary of keyword aliases for smart column mapping in Spanish and English
 */
const COLUMN_ALIAS_DICTIONARY: Record<TargetFieldKey, string[]> = {
  name: [
    'producto', 'productos', 'descripcion', 'descripción', 'articulo', 'artículo', 'articulos', 'artículos',
    'nombre', 'detalle', 'item', 'description', 'title', 'product', 'product name', 'nom art', 
    'des art', 'denominacion', 'denominación', 'nombre producto', 'nombre articulo'
  ],
  barcode: [
    'codigo de barras', 'código de barras', 'codigo barra', 'código barra', 
    'barcode', 'ean', 'ean13', 'ean 13', 'upc', 'gtin', 'cod barra', 'codbarra', 
    'barra', 'barras', 'c barras', 'c barra', 'codigo ean'
  ],
  sku: [
    'codigo', 'código', 'sku', 'cod', 'codigo interno', 'código interno', 
    'id', 'referencia', 'ref', 'cod art', 'codart', 'clave', 'art', 'nro'
  ],
  category: [
    'categoria', 'categorias', 'categoría', 'categorías', 'rubro', 'rubros', 'familia', 'familias', 
    'grupo', 'grupos', 'seccion', 'sección', 'departamento', 'linea', 'línea', 'category', 
    'subrubro', 'subcategoria', 'tipo', 'clasificacion', 'clasificación'
  ],
  brand: [
    'marca', 'marcas', 'fabricante', 'fabricantes', 'brand', 'laboratorio', 'proveedor marca', 'linea marca'
  ],
  salePrice: [
    'precio venta', 'precio de venta', 'precio publico', 'precio público', 'precio al publico', 'precio al público',
    'pvp', 'precio final', 'precio', 'venta', 'price', 'precio unitario', 'precio unit', 'precio unit.',
    'p venta', 'p. venta', 'p.venta', 'p.v.', 'p.v', 'pv', 'precioventa', 'p venta final', 'precio contado', 
    'importe', 'precio lista', 'lista de precios', 'lista', 'precio minorista', 'precio mostrador', 'valor venta', 'importe venta'
  ],
  costPrice: [
    'precio de costo', 'precio costo', 'costo', 'costos', 'precio compra', 'precio de compra', 
    'cost', 'pc', 'p costo', 'p. costo', 'p.costo', 'costo unitario', 'valor compra', 'preciocosto', 
    'costo neto', 'costo proveedor', 'p c'
  ],
  stock: [
    'cantidad', 'cantidades', 'stock', 'existencia', 'existencias', 'cant', 'disponible', 'disponibles', 
    'qty', 'inventario', 'saldo', 'unidades', 'stock actual', 'unidades disponibles', 'stock total'
  ],
  unit: [
    'unidad', 'unidades', 'medida', 'u m', 'um', 'presentacion', 'presentación', 'tipo unidad', 
    'envase', 'formato', 'unidad de medida', 'unit'
  ],
  supplier: [
    'proveedor', 'proveedores', 'supplier', 'suppliers', 'distribuidor', 'distribuidores', 'vendor', 'vendors', 
    'procedencia', 'proveedor habitual'
  ],
  withoutStockControl: [
    'sin stock', 'servicio', 'no controla stock', 'sin control de stock', 
    'controla stock', 'control de stock', 'control stock'
  ],
  minimumStock: [
    'stock minimo', 'stock mínimo', 'minimo', 'mínimo', 'min stock', 'stock min'
  ],
  reorderPoint: [
    'punto reposicion', 'punto de reposición', 'punto pedido', 'reorder point'
  ],
  targetStock: [
    'stock objetivo', 'stock ideal', 'stock maximo', 'stock máximo', 'target stock'
  ],
  ignore: ['ignorar', 'vacio', 'empty']
};

/**
 * Analyzes sample values of a column to evaluate data heuristics
 */
function analyzeColumnDataPatterns(samples: string[]): {
  likelyBarcode: boolean;
  likelyPrice: boolean;
  likelyStock: boolean;
  likelyBoolean: boolean;
} {
  let barcodeCount = 0;
  let priceCount = 0;
  let stockCount = 0;
  let booleanCount = 0;
  
  const validSamples = samples.filter(s => s && s.trim().length > 0);
  if (validSamples.length === 0) {
    return { likelyBarcode: false, likelyPrice: false, likelyStock: false, likelyBoolean: false };
  }

  for (const s of validSamples) {
    const clean = s.trim();
    // Barcode: 8 to 14 consecutive digits
    if (/^\d{8,14}$/.test(clean)) {
      barcodeCount++;
    }
    // Price with currency symbols or decimals
    if (/^(\$|€)?\s*\d+([.,]\d{1,2})?$/.test(clean) || clean.includes('$')) {
      priceCount++;
    }
    // Integer count
    if (/^-?\d+$/.test(clean)) {
      stockCount++;
    }
    // Boolean keywords
    if (['si', 'no', 'true', 'false', '0', '1'].includes(clean.toLowerCase())) {
      booleanCount++;
    }
  }

  const ratio = (cnt: number) => cnt / validSamples.length;

  return {
    likelyBarcode: ratio(barcodeCount) >= 0.6,
    likelyPrice: ratio(priceCount) >= 0.6,
    likelyStock: ratio(stockCount) >= 0.7,
    likelyBoolean: ratio(booleanCount) >= 0.7
  };
}

/**
 * Comprehensive column mapping resolver that evaluates all columns collectively
 * to ensure accurate disambiguation between Sale Price, Cost Price, and other catalog fields.
 */
export function determineAllColumnMappings(
  sourceColumns: string[],
  rawRows: any[]
): ColumnMapping[] {
  const columnAnalysisList = sourceColumns.map(col => {
    const samples = rawRows
      .slice(0, 15)
      .map(r => (r && r[col] !== undefined && r[col] !== null ? String(r[col]).trim() : ''))
      .filter(Boolean);

    const norm = normalizeHeaderString(col);
    const dataPatterns = analyzeColumnDataPatterns(samples);
    const isCost = isCostHeader(norm);
    const salePriority = getSalePricePriority(norm);

    return {
      col,
      norm,
      samples,
      dataPatterns,
      isCost,
      salePriority,
      assignedTarget: null as TargetFieldKey | null,
      confidence: 'low' as MappingConfidence,
      reason: ''
    };
  });

  const assignedFields = new Set<TargetFieldKey>();

  // 1. Identify Cost Price (Precio de Costo / Compra) - Highest priority to isolate from sale price
  for (const item of columnAnalysisList) {
    if (item.isCost && !assignedFields.has('costPrice')) {
      item.assignedTarget = 'costPrice';
      item.confidence = 'high';
      item.reason = `Identificado como Precio de costo (${item.col})`;
      assignedFields.add('costPrice');
      break;
    }
  }

  // 2. Identify Sale Price (Precio de Venta) using priority tiers (Tier 1 -> Tier 6)
  const saleCandidates = columnAnalysisList
    .filter(item => !item.assignedTarget && item.salePriority > 0)
    .sort((a, b) => {
      // Sort primarily by sale priority score descending
      if (b.salePriority !== a.salePriority) {
        return b.salePriority - a.salePriority;
      }
      // If same priority, boost if samples look like numeric prices
      const aPriceScore = a.dataPatterns.likelyPrice ? 1 : 0;
      const bPriceScore = b.dataPatterns.likelyPrice ? 1 : 0;
      return bPriceScore - aPriceScore;
    });

  if (saleCandidates.length > 0) {
    const bestSale = saleCandidates[0];
    bestSale.assignedTarget = 'salePrice';
    bestSale.confidence = 'high';
    
    if (bestSale.salePriority >= 100) {
      bestSale.reason = `Identificado como Precio de venta oficial (${bestSale.col})`;
    } else if (bestSale.salePriority >= 85) {
      bestSale.reason = `Identificado como Precio al público / venta (${bestSale.col})`;
    } else if (bestSale.salePriority >= 70) {
      bestSale.reason = `Identificado como Precio final (${bestSale.col})`;
    } else if (bestSale.salePriority >= 55) {
      bestSale.reason = `Identificado como Precio de lista para venta (${bestSale.col})`;
    } else if (bestSale.salePriority >= 40) {
      bestSale.reason = `Identificado como Precio unitario de venta (${bestSale.col})`;
    } else {
      bestSale.reason = assignedFields.has('costPrice') 
        ? `Identificado como Precio de venta (distinguido del costo)` 
        : `Identificado como Precio de venta principal (${bestSale.col})`;
    }
    assignedFields.add('salePrice');
  }

  // 3. If no sale price was matched by keywords, check if any unassigned column has purely price data patterns
  if (!assignedFields.has('salePrice')) {
    const dataPatternSaleCandidate = columnAnalysisList.find(
      item => !item.assignedTarget && item.dataPatterns.likelyPrice && !item.isCost
    );
    if (dataPatternSaleCandidate) {
      dataPatternSaleCandidate.assignedTarget = 'salePrice';
      dataPatternSaleCandidate.confidence = 'medium';
      dataPatternSaleCandidate.reason = 'Valores monetarios detectados en las filas de datos';
      assignedFields.add('salePrice');
    }
  }

  // 4. Map other essential catalog fields in priority order
  const nonPriceFields: TargetFieldKey[] = [
    'name', 
    'barcode', 
    'stock', 
    'category', 
    'sku', 
    'brand', 
    'supplier', 
    'withoutStockControl', 
    'unit', 
    'minimumStock', 
    'reorderPoint', 
    'targetStock'
  ];

  for (const targetKey of nonPriceFields) {
    if (assignedFields.has(targetKey)) continue;

    const aliases = COLUMN_ALIAS_DICTIONARY[targetKey] || [];
    let bestMatch: typeof columnAnalysisList[0] | null = null;
    let matchConfidence: MappingConfidence = 'low';
    let matchReason = '';

    // Step A: Exact alias match
    for (const item of columnAnalysisList) {
      if (item.assignedTarget) continue;

      for (const alias of aliases) {
        const normAlias = normalizeHeaderString(alias);
        if (item.norm === normAlias) {
          bestMatch = item;
          matchConfidence = 'high';
          matchReason = `Coincidencia exacta con "${alias}"`;
          break;
        }
      }
      if (bestMatch) break;
    }

    // Step B: Partial alias match if no exact match
    if (!bestMatch) {
      for (const item of columnAnalysisList) {
        if (item.assignedTarget) continue;

        for (const alias of aliases) {
          const normAlias = normalizeHeaderString(alias);
          if (normAlias.length >= 3 && (item.norm.includes(normAlias) || normAlias.includes(item.norm))) {
            bestMatch = item;
            matchConfidence = 'medium';
            matchReason = `Nombre similar a "${alias}"`;
            break;
          }
        }
        if (bestMatch) break;
      }
    }

    // Step C: Fallback to heuristic data pattern for Barcode if not matched yet
    if (!bestMatch && targetKey === 'barcode') {
      const barcodeByPattern = columnAnalysisList.find(
        item => !item.assignedTarget && item.dataPatterns.likelyBarcode
      );
      if (barcodeByPattern) {
        bestMatch = barcodeByPattern;
        matchConfidence = 'high';
        matchReason = 'Contiene códigos de barras numéricos (8 a 14 dígitos)';
      }
    }

    if (bestMatch) {
      bestMatch.assignedTarget = targetKey;
      bestMatch.confidence = matchConfidence;
      bestMatch.reason = matchReason;
      assignedFields.add(targetKey);
    }
  }

  // 5. Construct final ColumnMapping array
  return columnAnalysisList.map(item => ({
    sourceColumn: item.col,
    targetField: item.assignedTarget || 'ignore',
    confidence: item.assignedTarget ? item.confidence : 'low',
    sampleValues: item.samples.slice(0, 3),
    reason: item.reason || 'No se identificó automáticamente. Puedes asignarla manualmente.'
  }));
}

/**
 * Determines the best target field for a single column (used as fallback)
 */
function determineTargetFieldForColumn(
  header: string, 
  sampleValues: string[],
  alreadyAssigned: Set<TargetFieldKey>
): { target: TargetFieldKey; confidence: MappingConfidence; reason: string } {
  const norm = normalizeHeaderString(header);
  const dataPatterns = analyzeColumnDataPatterns(sampleValues);

  // Check Cost Price
  if (isCostHeader(norm) && !alreadyAssigned.has('costPrice')) {
    return {
      target: 'costPrice',
      confidence: 'high',
      reason: `Identificado como Precio de costo (${header})`
    };
  }

  // Check Sale Price
  const salePriority = getSalePricePriority(norm);
  if (salePriority > 0 && !alreadyAssigned.has('salePrice')) {
    return {
      target: 'salePrice',
      confidence: 'high',
      reason: `Identificado como Precio de venta (${header})`
    };
  }

  // Exact or High keyword match for remaining
  for (const [targetKey, aliases] of Object.entries(COLUMN_ALIAS_DICTIONARY) as [TargetFieldKey, string[]][]) {
    if (targetKey === 'ignore' || targetKey === 'salePrice' || targetKey === 'costPrice') continue;
    if (alreadyAssigned.has(targetKey)) continue;
    
    for (const alias of aliases) {
      const normAlias = normalizeHeaderString(alias);
      if (norm === normAlias) {
        return {
          target: targetKey,
          confidence: 'high',
          reason: `Coincidencia exacta con "${alias}"`
        };
      }
    }
  }

  // Partial keyword matches
  for (const [targetKey, aliases] of Object.entries(COLUMN_ALIAS_DICTIONARY) as [TargetFieldKey, string[]][]) {
    if (targetKey === 'ignore' || targetKey === 'salePrice' || targetKey === 'costPrice') continue;
    if (alreadyAssigned.has(targetKey)) continue;
    
    for (const alias of aliases) {
      const normAlias = normalizeHeaderString(alias);
      if (normAlias.length >= 3 && (norm.includes(normAlias) || normAlias.includes(norm))) {
        if (targetKey === 'barcode' && dataPatterns.likelyBarcode) {
          return { target: targetKey, confidence: 'high', reason: `Nombre "${header}" y contiene códigos numéricos` };
        }
        return {
          target: targetKey,
          confidence: 'medium',
          reason: `Nombre similar a "${alias}"`
        };
      }
    }
  }

  // Fallback to Data Patterns
  if (!alreadyAssigned.has('barcode') && dataPatterns.likelyBarcode) {
    return { target: 'barcode', confidence: 'medium', reason: 'El 80%+ de las celdas contienen códigos de barras (8-14 dígitos)' };
  }
  if (!alreadyAssigned.has('salePrice') && dataPatterns.likelyPrice && !isCostHeader(norm)) {
    return { target: 'salePrice', confidence: 'medium', reason: 'Valores monetarios detectados en las filas' };
  }

  return {
    target: 'ignore',
    confidence: 'low',
    reason: 'No se identificó automáticamente con suficiente certeza. Puedes asignarla manualmente.'
  };
}

/**
 * Cluster and normalize categories to find casing variations and plurals
 */
function buildCategoryProposals(
  rawCategories: string[], 
  existingBusinessCategories: string[]
): { proposals: CategoryProposal[]; uncategorizedCount: number } {
  const groupMap = new Map<string, { variants: Set<string>; count: number }>();
  let uncategorizedCount = 0;

  for (const raw of rawCategories) {
    const clean = normalizeCategoryName(raw);
    if (!clean) {
      uncategorizedCount++;
      continue;
    }

    // Key is normalized lowercase stripped of plural 's' at the end for simple matching
    const baseKey = normalizeHeaderString(clean).replace(/s$/, '');
    if (!groupMap.has(baseKey)) {
      groupMap.set(baseKey, { variants: new Set(), count: 0 });
    }
    const grp = groupMap.get(baseKey)!;
    grp.variants.add(clean);
    grp.count++;
  }

  const proposals: CategoryProposal[] = [];

  groupMap.forEach((grp, baseKey) => {
    const variants = Array.from(grp.variants);
    
    // Choose the best canonical name:
    // 1. If matches an existing store category, use that canonical casing
    // 2. Otherwise normalize variant with first letter uppercase, rest lowercase
    let bestCanonical = '';
    for (const v of variants) {
      const match = findMatchingCategory(v, existingBusinessCategories);
      if (match) {
        bestCanonical = match;
        break;
      }
    }

    if (!bestCanonical) {
      bestCanonical = normalizeCategoryName(variants[0]);
    }

    const isExisting = Boolean(findMatchingCategory(bestCanonical, existingBusinessCategories));

    proposals.push({
      id: `cat-prop-${baseKey}`,
      originalVariants: variants,
      proposedName: bestCanonical,
      selectedName: bestCanonical,
      count: grp.count,
      isExistingInBusiness: isExisting,
      action: 'accept'
    });
  });

  // Sort proposals by count descending
  proposals.sort((a, b) => b.count - a.count);

  return { proposals, uncategorizedCount };
}

/**
 * Checks for potential combos based on product description keywords
 */
function detectPotentialCombo(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('combo') || 
    lower.includes('promo ') || 
    lower.includes('pack x') || 
    lower.includes('pack 2') ||
    lower.includes('pack 3') ||
    lower.includes('pack 6') ||
    lower.includes(' 2x1') ||
    lower.includes(' 3x2')
  );
}

/**
 * Reads workbook, sheets, and headers from File buffer (.xlsx, .xls, .csv)
 */
export async function parseWorkbookFile(file: File): Promise<{
  workbook: XLSX.WorkBook;
  availableSheets: SheetInfo[];
  recommendedSheet: string;
}> {
  if (!file) {
    throw new Error('No se seleccionó ningún archivo para importar.');
  }

  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`El archivo es demasiado grande (${sizeMb} MB). El tamaño máximo permitido es de 15 MB.`);
  }

  const fileName = (file.name || '').toLowerCase();
  const isCsv = fileName.endsWith('.csv');
  const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');

  if (!isCsv && !isExcel) {
    throw new Error('Formato de archivo no soportado. Por favor subí un archivo Excel (.xlsx, .xls) o CSV (.csv).');
  }

  const buffer = await file.arrayBuffer();
  let workbook: XLSX.WorkBook;

  try {
    if (isCsv) {
      // Decode CSV with text decoder to handle UTF-8 / Latin1
      const textDecoder = new TextDecoder('utf-8');
      let csvText = textDecoder.decode(buffer);
      
      // Auto-detect delimiter if semicolon
      const firstLine = csvText.split('\n')[0] || '';
      const semicolonCount = (firstLine.match(/;/g) || []).length;
      const commaCount = (firstLine.match(/,/g) || []).length;
      const tabCount = (firstLine.match(/\t/g) || []).length;

      let FS = ',';
      if (semicolonCount > commaCount && semicolonCount > tabCount) {
        FS = ';';
      } else if (tabCount > commaCount && tabCount > semicolonCount) {
        FS = '\t';
      }

      workbook = XLSX.read(csvText, { type: 'string', FS });
    } else {
      workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false, cellText: true });
    }
  } catch (err: any) {
    throw new Error('El archivo está dañado, protegido con contraseña o tiene un formato no legible.');
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo no contiene hojas de cálculo con datos.');
  }

  const availableSheets: SheetInfo[] = [];
  let recommendedSheet = workbook.SheetNames[0];
  let maxScore = -1;

  for (const sName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sName];
    if (!worksheet) continue;

    const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    if (!rawJson || rawJson.length === 0) continue;

    const headerRow = (rawJson[0] || []).map((h: any) => String(h || '').trim()).filter(Boolean);
    const rowCount = Math.max(0, rawJson.length - 1);

    // Calculate score to recommend product sheet
    let score = 0;
    const lowerSheet = sName.toLowerCase();
    if (lowerSheet.includes('producto') || lowerSheet.includes('art') || lowerSheet.includes('catalogo') || lowerSheet.includes('lista')) {
      score += 50;
    }
    for (const h of headerRow) {
      const normH = normalizeHeaderString(h);
      if (normH.includes('producto') || normH.includes('descripcion') || normH.includes('articulo') || normH.includes('nombre')) score += 30;
      if (normH.includes('precio') || normH.includes('venta') || normH.includes('pvp')) score += 25;
      if (normH.includes('stock') || normH.includes('cantidad')) score += 20;
      if (normH.includes('codigo') || normH.includes('barra') || normH.includes('barcode')) score += 20;
    }
    score += Math.min(50, rowCount);

    const sheetInfo: SheetInfo = {
      sheetName: sName,
      rowCount,
      columnCount: headerRow.length,
      isRecommended: false,
      headers: headerRow
    };
    availableSheets.push(sheetInfo);

    if (score > maxScore) {
      maxScore = score;
      recommendedSheet = sName;
    }
  }

  if (availableSheets.length === 0) {
    throw new Error('El archivo seleccionado no contiene ninguna fila de datos válida.');
  }

  // Mark recommended
  availableSheets.forEach(s => {
    s.isRecommended = s.sheetName === recommendedSheet;
  });

  return {
    workbook,
    availableSheets,
    recommendedSheet
  };
}

/**
 * Main Smart Analysis function:
 * Analyzes workbook, sheet, maps columns, extracts categories, checks duplicates against existing products.
 */
export async function analyzeSmartCatalog(
  file: File,
  existingProducts: Product[],
  targetSheetName?: string
): Promise<SmartCatalogAnalysisResult> {
  const { workbook, availableSheets, recommendedSheet } = await parseWorkbookFile(file);
  const sheetToUse = targetSheetName && workbook.Sheets[targetSheetName] ? targetSheetName : recommendedSheet;
  const worksheet = workbook.Sheets[sheetToUse];

  if (!worksheet) {
    throw new Error(`No se pudo leer la hoja "${sheetToUse}".`);
  }

  const rawJsonRows: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  if (!rawJsonRows || rawJsonRows.length === 0) {
    throw new Error(`La hoja "${sheetToUse}" está vacía o no contiene filas de datos.`);
  }

  if (rawJsonRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`El archivo contiene ${rawJsonRows.length} productos. Para garantizar estabilidad, el límite máximo es de ${MAX_IMPORT_ROWS} filas por importación.`);
  }

  // Sanitize row keys: trim leading/trailing spaces and multiple spaces while preserving casing
  const rawRows = rawJsonRows.map(row => {
    if (!row || typeof row !== 'object') return {};
    const cleanRow: Record<string, any> = {};
    for (const [k, v] of Object.entries(row)) {
      if (!FORBIDDEN_OBJECT_KEYS.has(k)) {
        const cleanKey = k.trim().replace(/\s+/g, ' ');
        if (cleanKey) {
          cleanRow[cleanKey] = v;
        }
      }
    }
    return cleanRow;
  });

  // 1. Extract source columns from first few rows
  const sourceColumnSet = new Set<string>();
  rawRows.slice(0, 15).forEach(row => {
    if (row && typeof row === 'object') {
      Object.keys(row).forEach(k => {
        if (!FORBIDDEN_OBJECT_KEYS.has(k) && k.trim()) {
          sourceColumnSet.add(k.trim().replace(/\s+/g, ' '));
        }
      });
    }
  });
  const sourceColumns = Array.from(sourceColumnSet);

  // 2. Perform intelligent multi-column mapping with priority ranking and cost disambiguation
  const mappings = determineAllColumnMappings(sourceColumns, rawRows);

  // 3. Process rows with extracted mappings & validate
  const existingCategories = Array.from(new Set(existingProducts.map(p => p.category).filter(Boolean)));
  
  return processRowsAndValidate(
    rawRows,
    mappings,
    existingProducts,
    existingCategories,
    file.name,
    file.size,
    workbook.SheetNames,
    sheetToUse,
    availableSheets
  );
}

/**
 * Re-processes rows and validates when column mappings or category unification rules change.
 */
export function revalidateCatalogAnalysis(
  currentResult: SmartCatalogAnalysisResult,
  customMappings: ColumnMapping[],
  categoryProposals: CategoryProposal[],
  existingProducts: Product[]
): SmartCatalogAnalysisResult {
  const existingCategories = Array.from(new Set(existingProducts.map(p => p.category).filter(Boolean)));
  
  // Build category translation map from proposals
  const categoryReplacementMap = new Map<string, string>();
  for (const prop of categoryProposals) {
    for (const variant of prop.originalVariants) {
      categoryReplacementMap.set(normalizeHeaderString(variant), prop.selectedName);
    }
  }

  // Extract raw rows
  const rawRows = currentResult.rows.map(r => r.rawRow);

  return processRowsAndValidate(
    rawRows,
    customMappings,
    existingProducts,
    existingCategories,
    currentResult.fileName,
    currentResult.fileSizeBytes,
    currentResult.sheetNames,
    currentResult.selectedSheet,
    currentResult.availableSheets,
    categoryReplacementMap,
    categoryProposals
  );
}

/**
 * Internal processor to construct ParsedCatalogProduct items and compute stats
 */
function processRowsAndValidate(
  rawRows: any[],
  mappings: ColumnMapping[],
  existingProducts: Product[],
  existingCategories: string[],
  fileName: string,
  fileSizeBytes: number,
  sheetNames: string[],
  selectedSheet: string,
  availableSheets: SheetInfo[],
  categoryReplacements?: Map<string, string>,
  existingProposals?: CategoryProposal[]
): SmartCatalogAnalysisResult {
  // Mapping index for fast lookup
  const targetToSourceMap = new Map<TargetFieldKey, string>();
  mappings.forEach(m => {
    if (m.targetField !== 'ignore') {
      targetToSourceMap.set(m.targetField, m.sourceColumn);
    }
  });

  // Build existing products fast lookup index
  const existingBarcodeMap = new Map<string, Product>();
  const existingSkuMap = new Map<string, Product>();
  const existingNameCatMap = new Map<string, Product>();
  const existingNameOnlyMap = new Map<string, Product>();
  const existingSuppliers = Array.from(new Set(existingProducts.map(p => p.supplier).filter(Boolean))) as string[];

  existingProducts.forEach(p => {
    if (p.barcode && p.barcode.trim()) {
      existingBarcodeMap.set(p.barcode.trim().toLowerCase(), p);
    }
    const skuVal = (p as any).sku;
    if (skuVal && String(skuVal).trim()) {
      existingSkuMap.set(String(skuVal).trim().toLowerCase(), p);
    }
    if (p.name && p.name.trim()) {
      const nameKey = normalizeHeaderString(p.name);
      const catKey = normalizeHeaderString(p.category || '');
      existingNameCatMap.set(`${nameKey}||${catKey}`, p);
      if (!existingNameOnlyMap.has(nameKey)) {
        existingNameOnlyMap.set(nameKey, p);
      }
    }
  });

  // Track in-file barcodes to detect intra-file duplicate codes
  const fileBarcodeCounts = new Map<string, number>();
  const rawExtractedCategories: string[] = [];

  // Pass 1: Extract and clean raw fields
  const parsedItems: ParsedCatalogProduct[] = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based + header
    const getVal = (target: TargetFieldKey): string => {
      const colName = targetToSourceMap.get(target);
      if (!colName) return '';
      
      // 1. Direct access
      if (row[colName] !== null && row[colName] !== undefined && String(row[colName]).trim() !== '') {
        return String(row[colName]).trim();
      }

      // 2. Trimmed / space-collapsed access
      const cleanColName = colName.trim().replace(/\s+/g, ' ');
      if (row[cleanColName] !== null && row[cleanColName] !== undefined && String(row[cleanColName]).trim() !== '') {
        return String(row[cleanColName]).trim();
      }

      // 3. Resilient normalized header match across all row keys
      const targetNorm = normalizeHeaderString(colName);
      for (const [k, v] of Object.entries(row)) {
        if (normalizeHeaderString(k) === targetNorm && v !== null && v !== undefined && String(v).trim() !== '') {
          return String(v).trim();
        }
      }

      return '';
    };

    // Apply strict text normalization (First letter uppercase, rest lowercase)
    const rawNameInput = sanitizeString(getVal('name'), 150);
    const cleanName = normalizeProductName(rawNameInput);
    const rawBarcode = sanitizeString(getVal('barcode'), 50);
    const rawSku = sanitizeString(getVal('sku'), 50);
    const rawCategoryInput = sanitizeString(getVal('category'), 60);
    const cleanBrand = normalizeDisplayText(sanitizeString(getVal('brand'), 60));
    const rawUnit = sanitizeString(getVal('unit'), 30);
    const rawSupplierInput = sanitizeString(getVal('supplier'), 100);
    const cleanSupplier = normalizeDisplayText(rawSupplierInput);
    const rawWithoutStock = getVal('withoutStockControl');

    // Numeric fields: parse numeric values directly without string casing transformations
    const costPrice = parsePriceOrNumber(getVal('costPrice'), 0);
    const salePrice = parsePriceOrNumber(getVal('salePrice'), 0);
    const stock = parsePriceOrNumber(getVal('stock'), 0);
    const minimumStock = parsePriceOrNumber(getVal('minimumStock'), 5);
    const reorderPoint = parsePriceOrNumber(getVal('reorderPoint'), minimumStock);
    const targetStockVal = getVal('targetStock');
    const targetStock = targetStockVal ? parsePriceOrNumber(targetStockVal, 20) : undefined;

    // Track barcode counts
    if (rawBarcode) {
      const bKey = rawBarcode.toLowerCase();
      fileBarcodeCounts.set(bKey, (fileBarcodeCounts.get(bKey) || 0) + 1);
    }

    // Apply category normalization BEFORE searching or comparing
    const normalizedInputCategory = rawCategoryInput ? normalizeCategoryName(rawCategoryInput) : '';
    if (normalizedInputCategory) {
      rawExtractedCategories.push(normalizedInputCategory);
    }

    // Determine final category (apply replacement if mapped or match existing)
    let finalCategory = normalizedInputCategory;
    if (categoryReplacements && rawCategoryInput) {
      const normCat = normalizeHeaderString(rawCategoryInput);
      if (categoryReplacements.has(normCat)) {
        finalCategory = categoryReplacements.get(normCat)!;
      }
    }

    // Match with existing canonical categories in business
    const existingCatMatch = findMatchingCategory(finalCategory, existingCategories);
    if (existingCatMatch) {
      finalCategory = existingCatMatch;
    } else if (!finalCategory) {
      finalCategory = 'General';
    } else {
      finalCategory = normalizeCategoryName(finalCategory);
    }

    // Match with existing supplier
    const matchedSup = findMatchingSupplier(cleanSupplier, existingSuppliers);
    const finalSupplier = matchedSup || cleanSupplier;

    const isWithoutStock = parseBooleanFlag(rawWithoutStock);
    const tracksStock = !isWithoutStock;

    // Check duplicate against existing products in business
    let isDuplicate = false;
    let duplicateType: ParsedCatalogProduct['duplicateType'] = null;
    let existingProd: Product | undefined = undefined;

    if (rawBarcode && existingBarcodeMap.has(rawBarcode.toLowerCase())) {
      isDuplicate = true;
      duplicateType = 'confirmed_barcode';
      existingProd = existingBarcodeMap.get(rawBarcode.toLowerCase());
    } else if (rawSku && existingSkuMap.has(rawSku.toLowerCase())) {
      isDuplicate = true;
      duplicateType = 'confirmed_barcode';
      existingProd = existingSkuMap.get(rawSku.toLowerCase());
    } else if (cleanName) {
      const nameCatKey = `${normalizeHeaderString(cleanName)}||${normalizeHeaderString(finalCategory)}`;
      if (existingNameCatMap.has(nameCatKey)) {
        isDuplicate = true;
        duplicateType = 'possible_name';
        existingProd = existingNameCatMap.get(nameCatKey);
      } else if (existingNameOnlyMap.has(normalizeHeaderString(cleanName))) {
        isDuplicate = true;
        duplicateType = 'possible_name';
        existingProd = existingNameOnlyMap.get(normalizeHeaderString(cleanName));
      }
    }

    // Check combo
    const isPotentialCombo = detectPotentialCombo(cleanName);

    // Validation
    const errors: string[] = [];
    const warnings: string[] = [];

    // Critical errors
    if (!cleanName || cleanName.trim().length === 0) {
      errors.push('Falta el nombre del producto.');
    }
    if (salePrice < 0) {
      errors.push('El precio de venta no puede ser negativo.');
    }

    // Warnings
    if (salePrice === 0) {
      warnings.push('El precio de venta es $0 (podés corregirlo antes de importar).');
    }
    if (!rawCategoryInput || rawCategoryInput.trim().length === 0) {
      warnings.push('No tiene categoría asignada (se asignó "General").');
    }
    if (!rawBarcode && tracksStock) {
      warnings.push('No tiene código de barras (se identificará por nombre en caja).');
    }
    if (costPrice === 0) {
      warnings.push('No tiene precio de costo registrado.');
    }
    if (isPotentialCombo) {
      warnings.push('Parece ser un combo/promoción. Se creará como producto estándar.');
    }

    let status: RowValidationStatus = 'READY';
    if (errors.length > 0) {
      status = 'ERROR';
    } else if (warnings.length > 0) {
      status = 'REVIEW';
    }

    parsedItems.push({
      id: `row-${rowNumber}-${Math.random().toString(36).substring(2, 7)}`,
      rowNumber,
      name: cleanName,
      barcode: rawBarcode,
      sku: rawSku,
      category: finalCategory,
      brand: cleanBrand,
      costPrice,
      salePrice,
      stock,
      unit: rawUnit || 'Unidad',
      supplier: finalSupplier,
      tracksStock,
      minimumStock,
      reorderPoint,
      targetStock,
      rawRow: row,
      status,
      errors,
      warnings,
      isDuplicate,
      duplicateType,
      existingProductId: existingProd?.id,
      existingProduct: existingProd,
      duplicateResolution: isDuplicate ? 'update_fields' : 'create_as_new',
      isPotentialCombo
    });
  });

  // Second pass: mark intra-file barcode duplicates
  parsedItems.forEach(item => {
    if (item.barcode && (fileBarcodeCounts.get(item.barcode.toLowerCase()) || 0) > 1) {
      if (!item.isDuplicate) {
        item.isDuplicate = true;
        item.duplicateType = 'in_file_duplicate';
        item.warnings.push(`Código de barras repetido ${fileBarcodeCounts.get(item.barcode.toLowerCase())} veces dentro del archivo.`);
        if (item.status === 'READY') {
          item.status = 'REVIEW';
        }
      }
    }
  });

  // Build or update category proposals
  let proposals: CategoryProposal[];
  let uncategorizedCount = 0;

  if (existingProposals && existingProposals.length > 0) {
    proposals = existingProposals;
    uncategorizedCount = parsedItems.filter(p => !p.rawRow[targetToSourceMap.get('category') || '']).length;
  } else {
    const catAnalysis = buildCategoryProposals(rawExtractedCategories, existingCategories);
    proposals = catAnalysis.proposals;
    uncategorizedCount = catAnalysis.uncategorizedCount;
  }

  // Calculate high-level summary counters
  const totalCount = parsedItems.length;
  const readyCount = parsedItems.filter(p => p.status === 'READY').length;
  const reviewCount = parsedItems.filter(p => p.status === 'REVIEW').length;
  const errorCount = parsedItems.filter(p => p.status === 'ERROR').length;
  const existingCount = parsedItems.filter(p => p.isDuplicate).length;
  const newCount = totalCount - existingCount;
  const potentialCombosCount = parsedItems.filter(p => p.isPotentialCombo).length;
  const productsWithStockCount = parsedItems.filter(p => p.stock > 0).length;
  const productsWithPriceCount = parsedItems.filter(p => p.salePrice > 0).length;

  return {
    fileName,
    fileSizeBytes,
    sheetNames,
    selectedSheet,
    availableSheets,
    mappings,
    rows: parsedItems,
    categoryProposals: proposals,
    uncategorizedCount,
    totalCount,
    readyCount,
    reviewCount,
    errorCount,
    newCount,
    existingCount,
    potentialCombosCount,
    identifiedCategoriesCount: proposals.length,
    productsWithStockCount,
    productsWithPriceCount
  };
}
