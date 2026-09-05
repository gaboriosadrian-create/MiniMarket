import * as XLSX from 'xlsx';
import { Product, ExcelImportRow, ExcelImportSummary } from '../types';
import { sanitizeString } from './securityUtils';
import { parseMonetaryValue, normalizeHeaderString } from './smartCatalogAnalyzer';
import { normalizeCategoryName, normalizeProductName } from './categoryUtils';

/**
 * Defensive limits for Excel import to protect against ReDoS, Prototype Pollution,
 * out-of-memory crashes and abnormally large spreadsheet payloads.
 */
export const MAX_EXCEL_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB max
export const MAX_EXCEL_ROWS = 2500; // 2,500 rows max per import batch

/**
 * Keys strictly forbidden during row extraction to prevent Prototype Pollution
 */
const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Downloads a sample Excel template for importing products
 */
export function downloadExcelTemplate() {
  const sampleData = [
    {
      'Código de barras': '7791234567890',
      'Producto': 'Alfajor Chocolate 50g',
      'Costo': 800,
      'Precio de venta': 1200,
      'Stock': 30,
      'Categoría': 'Alfajores'
    },
    {
      'Código de barras': '7799876543210',
      'Producto': 'Gaseosa Cola 500ml',
      'Costo': 1000,
      'Precio de venta': 1500,
      'Stock': 24,
      'Categoría': 'Bebidas'
    },
    {
      'Código de barras': '',
      'Producto': 'Empanada de Carne (Sin Código)',
      'Costo': 900,
      'Precio de venta': 1400,
      'Stock': 15,
      'Categoría': 'Comida'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  
  // Set column widths for nice formatting
  worksheet['!cols'] = [
    { wch: 20 }, // Código de barras
    { wch: 30 }, // Producto
    { wch: 12 }, // Costo
    { wch: 16 }, // Precio de venta
    { wch: 10 }, // Stock
    { wch: 18 }  // Categoría
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Productos');

  XLSX.writeFile(workbook, 'Plantilla_Productos_uwi.xlsx');
}

/**
 * Parses uploaded .xlsx file and validates against existing products
 */
export async function parseAndValidateExcel(
  file: File, 
  existingProducts: Product[]
): Promise<ExcelImportSummary> {
  // 1. File Size Defensive Check
  if (!file) {
    throw new Error('No se seleccionó ningún archivo para importar.');
  }

  if (file.size > MAX_EXCEL_FILE_SIZE_BYTES) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`El archivo seleccionado es demasiado grande (${sizeMb} MB). El tamaño máximo permitido es de 5 MB.`);
  }

  const fileName = (file.name || '').toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
    throw new Error('Formato de archivo no compatible. Debe ser un archivo Excel con extensión .xlsx o .xls.');
  }

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch (err: any) {
    throw new Error('No se pudo leer el archivo seleccionado. Verifique que no esté abierto o bloqueado por otra aplicación.');
  }

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellFormula: false, cellHTML: false, cellText: true });
  } catch (err: any) {
    throw new Error('El archivo Excel está dañado, protegido con contraseña o tiene un formato no válido.');
  }

  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('El archivo Excel no contiene hojas de cálculo válidas.');
  }

  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  if (!firstSheet) {
    throw new Error('La primera hoja del archivo Excel no contiene datos legibles.');
  }

  let rawRows: any[];
  try {
    rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '', raw: false });
  } catch (err: any) {
    throw new Error('Error al procesar las celdas del archivo Excel.');
  }

  if (!rawRows || rawRows.length === 0) {
    throw new Error('El archivo Excel está vacío o no contiene filas de datos para procesar.');
  }

  // 2. Row Count Defensive Check
  if (rawRows.length > MAX_EXCEL_ROWS) {
    throw new Error(`El archivo contiene ${rawRows.length} filas. El límite máximo por importación es de ${MAX_EXCEL_ROWS} productos para garantizar estabilidad.`);
  }

  const existingBarcodeMap = new Map<string, Product>();
  existingProducts.forEach((p) => {
    if (p.barcode && p.barcode.trim()) {
      existingBarcodeMap.set(p.barcode.trim(), p);
    }
  });

  const fileBarcodesSeen = new Set<string>();
  const parsedRows: ExcelImportRow[] = [];

  let newCount = 0;
  let updateCount = 0;
  let errorCount = 0;

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // Accounting for 1-based header row

    // Defensive Helper to find column value flexibly with Prototype Pollution protection
    const getValue = (possibleKeys: string[]): string => {
      if (!row || typeof row !== 'object') return '';
      const normalizedTargets = possibleKeys.map(pk => normalizeHeaderString(pk));
      for (const k of Object.keys(row)) {
        if (FORBIDDEN_OBJECT_KEYS.has(k)) continue;
        const normKey = normalizeHeaderString(k);
        if (normalizedTargets.some(target => normKey === target || normKey.includes(target))) {
          const val = row[k];
          return val !== null && val !== undefined ? String(val).trim() : '';
        }
      }
      return '';
    };

    const rawBarcode = getValue(['código', 'codigo', 'barcode', 'código de barras', 'cod barra']);
    const rawName = getValue(['producto', 'nombre', 'descripcion', 'description', 'title', 'articulo', 'detalle']);
    const rawCost = getValue(['costo', 'cost', 'precio costo', 'costprice', 'precio compra']);
    const rawSalePrice = getValue(['precio de venta', 'precio venta', 'saleprice', 'precio', 'price', 'pvp', 'precio publico', 'lista']);
    const rawStock = getValue(['stock', 'cantidad', 'qty', 'existencia']);
    const rawCategory = getValue(['categoría', 'categoria', 'category', 'rubro', 'familia']) || 'General';

    const barcode = rawBarcode ? sanitizeString(rawBarcode.trim(), 50) : null;
    const name = rawName ? normalizeProductName(sanitizeString(rawName.trim(), 150)) : '';
    const category = normalizeCategoryName(sanitizeString(rawCategory.trim() || 'General', 50)) || 'General';

    const costPrice = parseMonetaryValue(rawCost, 0);
    const salePrice = parseMonetaryValue(rawSalePrice, 0);
    const stock = parseInt(rawStock.replace(/[^0-9-]+/g, ''), 10) || 0;

    let status: 'NEW' | 'UPDATE' | 'ERROR' = 'NEW';
    let errorReason: string | undefined = undefined;
    let existingProductId: string | undefined = undefined;
    let stockIgnoredMessage: string | undefined = undefined;

    // VALIDATION 1: Product Name Mandatory
    if (!name || name.length === 0) {
      status = 'ERROR';
      errorReason = 'Falta el nombre del producto';
    } 
    // VALIDATION 2: Valid Prices
    else if (isNaN(costPrice) || costPrice < 0) {
      status = 'ERROR';
      errorReason = 'Precio de costo inválido (debe ser mayor o igual a 0)';
    } else if (isNaN(salePrice) || salePrice < 0) {
      status = 'ERROR';
      errorReason = 'Precio de venta inválido (debe ser mayor o igual a 0)';
    } else if (isNaN(stock) || stock < 0) {
      status = 'ERROR';
      errorReason = 'Stock inválido (debe ser un número entero mayor o igual a 0)';
    } 
    // VALIDATION 3: Duplicate barcode within uploaded file
    else if (barcode && fileBarcodesSeen.has(barcode)) {
      status = 'ERROR';
      errorReason = `Código de barras "${barcode}" duplicado dentro del archivo Excel`;
    }

    if (barcode && status !== 'ERROR') {
      fileBarcodesSeen.add(barcode);
    }

    // CHECK MATCH WITH EXISTING PRODUCTS
    if (status !== 'ERROR') {
      if (barcode && existingBarcodeMap.has(barcode)) {
        status = 'UPDATE';
        const existingProd = existingBarcodeMap.get(barcode)!;
        existingProductId = existingProd.id;
        stockIgnoredMessage = 'Stock del Excel ignorado para no alterar el inventario actual';
        updateCount++;
      } else {
        status = 'NEW';
        newCount++;
      }
    } else {
      errorCount++;
    }

    parsedRows.push({
      rowNumber,
      barcode,
      name,
      costPrice,
      salePrice,
      stock,
      category,
      status,
      errorReason,
      existingProductId,
      stockIgnoredMessage
    });
  });

  return {
    newCount,
    updateCount,
    errorCount,
    rows: parsedRows
  };
}
