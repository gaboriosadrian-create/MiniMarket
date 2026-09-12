import { Product } from '../types';

/**
 * Standard uwi target field types that an external Excel column can map to.
 */
export type TargetFieldKey =
  | 'name'                  // Nombre del producto (Obligatorio)
  | 'barcode'               // Código de barras (EAN/UPC)
  | 'sku'                   // Código interno / SKU
  | 'category'              // Rubro / Categoría / Familia
  | 'brand'                 // Marca / Fabricante
  | 'salePrice'             // Precio de venta / Precio público
  | 'costPrice'             // Precio de costo
  | 'stock'                 // Stock / Existencia / Cantidad
  | 'unit'                  // Unidad de medida (u, kg, pack, etc.)
  | 'supplier'              // Proveedor / Distribuidor
  | 'withoutStockControl'   // Sin control de stock (booleano / texto)
  | 'minimumStock'          // Stock mínimo
  | 'reorderPoint'          // Punto de reposición
  | 'targetStock'           // Stock objetivo / ideal
  | 'ignore';               // Ignorar columna

export interface TargetFieldDefinition {
  key: TargetFieldKey;
  label: string;
  description: string;
  required?: boolean;
  priority: number;
}

export const TARGET_FIELDS: TargetFieldDefinition[] = [
  { key: 'name', label: 'Nombre del producto', description: 'Descripción o título comercial del artículo', required: true, priority: 1 },
  { key: 'salePrice', label: 'Precio de venta', description: 'Precio al público con el que se cobrará en caja', required: true, priority: 2 },
  { key: 'stock', label: 'Stock actual', description: 'Cantidad física disponible en depósito o góndola', priority: 3 },
  { key: 'costPrice', label: 'Precio de costo', description: 'Costo unitario de compra al proveedor', priority: 4 },
  { key: 'category', label: 'Categoría / Rubro', description: 'Rubro o familia para agrupar en el catálogo y POS', priority: 5 },
  { key: 'barcode', label: 'Código de barras', description: 'Código EAN-13, UPC o numérico para lector láser', priority: 6 },
  { key: 'sku', label: 'Código / SKU', description: 'Código interno o de referencia del comercio', priority: 7 },
  { key: 'brand', label: 'Marca', description: 'Marca o fabricante del producto', priority: 8 },
  { key: 'supplier', label: 'Proveedor', description: 'Distribuidor habitual o empresa proveedora', priority: 9 },
  { key: 'withoutStockControl', label: 'Sin control de stock', description: 'Indica si no se debe descontar stock en ventas', priority: 10 },
  { key: 'unit', label: 'Unidad de medida', description: 'Ej: Unidad, Kg, Litro, Pack', priority: 11 },
  { key: 'minimumStock', label: 'Stock mínimo', description: 'Alerta cuando el stock caiga por debajo', priority: 12 },
  { key: 'reorderPoint', label: 'Punto de reposición', description: 'Cantidad sugerida para reordenar', priority: 13 },
  { key: 'targetStock', label: 'Stock objetivo', description: 'Nivel óptimo de stock a mantener', priority: 14 },
  { key: 'ignore', label: 'Ignorar columna', description: 'Esta columna no se importará a uwi', priority: 99 },
];

export type MappingConfidence = 'high' | 'medium' | 'low' | 'manual';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: TargetFieldKey;
  confidence: MappingConfidence;
  sampleValues: string[];
  reason: string;
}

export interface SheetInfo {
  sheetName: string;
  rowCount: number;
  columnCount: number;
  isRecommended: boolean;
  headers: string[];
}

export interface CategoryProposal {
  id: string;
  originalVariants: string[];
  proposedName: string;
  selectedName: string;
  count: number;
  isExistingInBusiness: boolean;
  action: 'accept' | 'rename' | 'merge' | 'keep_original';
  mergeTargetCategory?: string;
}

export type RowValidationStatus = 'READY' | 'REVIEW' | 'ERROR';

export interface ParsedCatalogProduct {
  id: string; // generated temporary UI id
  rowNumber: number;
  name: string;
  barcode: string;
  sku: string;
  category: string;
  brand: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  unit: string;
  supplier: string;
  tracksStock: boolean;
  minimumStock: number;
  reorderPoint: number;
  targetStock?: number;
  rawRow: Record<string, any>;
  
  // Validation state
  status: RowValidationStatus;
  errors: string[];
  warnings: string[];
  
  // Duplicate info
  isDuplicate: boolean;
  duplicateType: 'confirmed_barcode' | 'confirmed_sku' | 'possible_name' | 'in_file_duplicate' | null;
  existingProductId?: string;
  existingProduct?: Product;
  duplicateResolution: 'keep_existing' | 'update_fields' | 'create_as_new' | 'skip';
  
  // Potential Combo Flag
  isPotentialCombo?: boolean;
}

export interface SmartCatalogAnalysisResult {
  fileName: string;
  fileSizeBytes: number;
  sheetNames: string[];
  selectedSheet: string;
  availableSheets: SheetInfo[];
  
  // Column Mappings
  mappings: ColumnMapping[];
  
  // Parsed and validated rows
  rows: ParsedCatalogProduct[];
  
  // Category Proposals
  categoryProposals: CategoryProposal[];
  uncategorizedCount: number;
  
  // Statistics
  totalCount: number;
  readyCount: number;
  reviewCount: number;
  errorCount: number;
  newCount: number;
  existingCount: number;
  potentialCombosCount: number;
  identifiedCategoriesCount: number;
  productsWithStockCount: number;
  productsWithPriceCount: number;
}

export interface AssistedImportRequest {
  id?: string;
  businessId: string;
  userId: string;
  userEmail: string;
  userName: string;
  fileName: string;
  fileSizeBytes: number;
  estimatedProducts: number;
  status: 'Pendiente' | 'En revisión' | 'En preparación' | 'Completada' | 'Cancelada';
  contactPhone?: string;
  observations: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportExecutionOptions {
  updateExistingProducts: boolean;
  overwriteStockForExisting: boolean;
  createMissingCategories: boolean;
  createMissingSuppliers: boolean;
  skipRowsWithErrors: boolean;
}

export interface ImportExecutionResult {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
  errorCount: number;
  createdCategoryCount: number;
  createdSupplierCount: number;
  failedRows: { rowNumber: number; name: string; reason: string }[];
  durationMs: number;
}
