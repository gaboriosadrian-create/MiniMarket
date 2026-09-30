import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  writeBatch,
  getDocs, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { Product, InventoryMovement } from '../types';
import { 
  ParsedCatalogProduct, 
  ImportExecutionOptions, 
  ImportExecutionResult,
  AssistedImportRequest 
} from './smartCatalogTypes';
import { getDefaultIconForCategoryOrProduct, normalizeCategoryName, normalizeProductName, normalizeDisplayText } from './categoryUtils';
import { logAdminAction } from './auditService';
import { sanitizeString } from './securityUtils';

/**
 * Strips undefined fields and serializes objects safely for Firestore
 */
function cleanFirestoreData(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = cleanFirestoreData(value);
      } else {
        result[key] = value;
      }
    }
  }
  return result;
}

/**
 * Executes the Smart Catalog Import in batches with UI progress notifications
 */
export async function executeSmartCatalogImport(
  businessId: string,
  userId: string,
  userEmail: string,
  userName: string,
  rows: ParsedCatalogProduct[],
  options: ImportExecutionOptions,
  onProgress?: (current: number, total: number, currentItemName: string) => void
): Promise<ImportExecutionResult> {
  const startTime = Date.now();
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const failedRows: { rowNumber: number; name: string; reason: string }[] = [];
  const createdCategories = new Set<string>();
  const createdSuppliers = new Set<string>();

  // 1. Filter rows to process
  const rowsToImport = rows.filter(r => {
    if (r.duplicateResolution === 'skip') {
      skippedCount++;
      return false;
    }
    if (r.status === 'ERROR') {
      if (options.skipRowsWithErrors) {
        skippedCount++;
        return false;
      }
    }
    return true;
  });

  const totalToProcess = rowsToImport.length;
  if (totalToProcess === 0) {
    return {
      totalProcessed: 0,
      createdCount: 0,
      updatedCount: 0,
      skippedCount,
      errorCount: 0,
      createdCategoryCount: 0,
      createdSupplierCount: 0,
      failedRows: [],
      durationMs: Date.now() - startTime
    };
  }

  // Process in chunks to prevent blocking the UI thread and allow progressive rendering
  const CHUNK_SIZE = 25;
  for (let i = 0; i < totalToProcess; i += CHUNK_SIZE) {
    const chunk = rowsToImport.slice(i, i + CHUNK_SIZE);

    for (let j = 0; j < chunk.length; j++) {
      const row = chunk[j];
      const currentIndex = i + j + 1;
      
      if (onProgress) {
        onProgress(currentIndex, totalToProcess, row.name || `Fila ${row.rowNumber}`);
      }

      try {
        const now = new Date().toISOString();
        const cleanName = normalizeProductName(sanitizeString(row.name || 'Producto sin nombre', 150));
        const cleanCategory = normalizeCategoryName(sanitizeString(row.category || 'General', 60)) || 'General';
        const cleanBarcode = row.barcode ? sanitizeString(row.barcode.trim(), 50) : null;
        const icon = getDefaultIconForCategoryOrProduct(cleanName || cleanCategory);

        if (cleanCategory) createdCategories.add(cleanCategory);
        if (row.supplier) createdSuppliers.add(normalizeDisplayText(sanitizeString(row.supplier.trim(), 100)));

        // Branch 1: UPDATE existing product
        if (
          row.isDuplicate && 
          row.duplicateResolution === 'update_fields' && 
          row.existingProductId
        ) {
          const productRef = doc(db, 'products', row.existingProductId);
          const updateData: Record<string, any> = {
            name: cleanName,
            category: cleanCategory,
            costPrice: Number(row.costPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            minimumStock: Number(row.minimumStock) || 5,
            reorderPoint: Number(row.reorderPoint) || 5,
            tracksStock: Boolean(row.tracksStock),
            active: true,
            updatedAt: now
          };

          if (cleanBarcode) {
            updateData.barcode = cleanBarcode;
          }
          if (row.brand) {
            updateData.brand = normalizeDisplayText(sanitizeString(row.brand, 60));
          }
          if (row.unit) {
            updateData.unit = sanitizeString(row.unit, 30);
          }
          if (row.supplier) {
            updateData.supplier = normalizeDisplayText(sanitizeString(row.supplier, 100));
          }
          if (row.targetStock !== undefined) {
            updateData.targetStock = Number(row.targetStock);
          }

          // If explicit overwrite of stock requested
          if (options.overwriteStockForExisting && row.tracksStock) {
            const previousStock = row.existingProduct?.stock || 0;
            const newStock = Number(row.stock) || 0;
            updateData.stock = newStock;

            // Log adjustment movement
            const movRef = doc(collection(db, 'inventory_movements'));
            const movData: Record<string, any> = {
              id: movRef.id,
              businessId,
              productId: row.existingProductId,
              productName: cleanName,
              productBarcode: cleanBarcode,
              type: 'ADJUSTMENT_IN',
              quantity: newStock - previousStock,
              previousStock,
              newStock,
              reason: 'Ajuste de stock por importación de catálogo',
              createdAt: now,
              userId,
              userName
            };
            await setDoc(movRef, cleanFirestoreData(movData));
          }

          await updateDoc(productRef, cleanFirestoreData(updateData));
          updatedCount++;
        } 
        // Branch 2: CREATE new product
        else {
          const productRef = doc(collection(db, 'products'));
          const productId = productRef.id;
          const initialStock = row.tracksStock ? (Number(row.stock) || 0) : 0;

          const newProductData: Record<string, any> = {
            id: productId,
            businessId,
            barcode: cleanBarcode,
            name: cleanName,
            category: cleanCategory,
            icon,
            costPrice: Number(row.costPrice) || 0,
            salePrice: Number(row.salePrice) || 0,
            stock: initialStock,
            minimumStock: row.tracksStock ? (Number(row.minimumStock) || 5) : 0,
            reorderPoint: row.tracksStock ? (Number(row.reorderPoint) || 5) : 0,
            tracksStock: Boolean(row.tracksStock),
            isCombo: false,
            comboItems: [],
            active: true,
            createdAt: now,
            updatedAt: now
          };

          if (row.brand) {
            newProductData.brand = normalizeDisplayText(sanitizeString(row.brand, 60));
          }
          if (row.unit) {
            newProductData.unit = sanitizeString(row.unit, 30);
          }
          if (row.supplier) {
            newProductData.supplier = normalizeDisplayText(sanitizeString(row.supplier, 100));
          }
          if (row.targetStock !== undefined && row.tracksStock) {
            newProductData.targetStock = Number(row.targetStock);
          }

          await setDoc(productRef, cleanFirestoreData(newProductData));
          createdCount++;

          // Create INITIAL inventory movement if tracksStock and initialStock > 0
          if (row.tracksStock && initialStock > 0) {
            const movRef = doc(collection(db, 'inventory_movements'));
            const movData: Record<string, any> = {
              id: movRef.id,
              businessId,
              productId,
              productName: cleanName,
              productBarcode: cleanBarcode,
              type: 'INITIAL',
              quantity: initialStock,
              previousStock: 0,
              newStock: initialStock,
              reason: 'Stock inicial por importación de catálogo',
              createdAt: now,
              userId,
              userName
            };
            await setDoc(movRef, cleanFirestoreData(movData));
          }
        }
      } catch (err: any) {
        errorCount++;
        failedRows.push({
          rowNumber: row.rowNumber,
          name: row.name || 'Sin nombre',
          reason: err.message || 'Error al guardar en base de datos'
        });
      }
    }

    // Yield control briefly to keep browser UI smooth and responsive
    await new Promise(resolve => setTimeout(resolve, 15));
  }

  // 3. Log admin audit entry
  try {
    await logAdminAction({
      businessId,
      adminId: userId,
      adminEmail: userEmail,
      targetUserId: userId,
      targetUserEmail: userEmail,
      action: 'BUSINESS_UPDATED',
      details: `Importación Inteligente de catálogo: ${createdCount} creados, ${updatedCount} actualizados, ${skippedCount} omitidos, ${errorCount} errores.`
    });
  } catch (auditErr) {
    console.warn('Could not record import audit log:', auditErr);
  }

  return {
    totalProcessed: totalToProcess,
    createdCount,
    updatedCount,
    skippedCount,
    errorCount,
    createdCategoryCount: createdCategories.size,
    createdSupplierCount: createdSuppliers.size,
    failedRows,
    durationMs: Date.now() - startTime
  };
}

/**
 * Stores an assisted import request for business onboarding
 */
export async function submitAssistedImportRequest(
  request: Omit<AssistedImportRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>
): Promise<string> {
  const reqRef = doc(collection(db, 'import_assistance_requests'));
  const now = new Date().toISOString();

  const data: AssistedImportRequest = {
    ...request,
    id: reqRef.id,
    status: 'Pendiente',
    createdAt: now,
    updatedAt: now
  };

  await setDoc(reqRef, cleanFirestoreData(data));
  return reqRef.id;
}
