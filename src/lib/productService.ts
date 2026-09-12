import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { localDataStore } from './localDataStore';
import { normalizeText, normalizeCategoryName, normalizeProductName, getDefaultIconForCategoryOrProduct } from './categoryUtils';
import { 
  Product, 
  ComboItem,
  InventoryMovement, 
  CreateProductInput, 
  UpdateProductInput,
  ExcelImportRow
} from '../types';

/**
 * Get all products for a specific businessId.
 * Online: Fetches from Firestore, automatically updates IndexedDB cache.
 * Offline / Failure: Falls back to IndexedDB local cache.
 */
export async function getProductsByBusiness(businessId: string): Promise<Product[]> {
  if (!businessId) return [];

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const q = query(collection(db, 'products'), where('businessId', '==', businessId));
      const querySnapshot = await getDocs(q);
      const products: Product[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data() as Record<string, any>;
        products.push({ id: docSnap.id, ...data } as Product);
      });
      const sorted = products.sort((a, b) => a.name.localeCompare(b.name));

      // Asynchronously keep local IndexedDB storage fresh and isolated by businessId
      localDataStore.saveProducts(businessId, sorted).catch((err) => {
        console.warn('[productService] Error guardando catálogo en IndexedDB:', err);
      });

      return sorted;
    } catch (error) {
      console.warn('[productService] Falló consulta remota a Firestore. Usando respaldo local IndexedDB:', error);
      // Fallback to local store on network failure
      const localProducts = await localDataStore.getProductsByBusiness(businessId);
      return localProducts;
    }
  } else {
    // Offline mode: retrieve directly from local IndexedDB
    console.info('[productService] Modo offline: obteniendo productos desde IndexedDB.');
    const localProducts = await localDataStore.getProductsByBusiness(businessId);
    return localProducts;
  }
}

/**
 * Explicitly force synchronize products from Firestore to IndexedDB
 */
export async function syncProductsToLocalStore(businessId: string, businessName?: string): Promise<{ success: boolean; count: number; error?: string }> {
  if (!businessId) {
    return { success: false, count: 0, error: 'businessId requerido' };
  }

  try {
    const q = query(collection(db, 'products'), where('businessId', '==', businessId));
    const querySnapshot = await getDocs(q);
    const products: Product[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      products.push({ id: docSnap.id, ...data } as Product);
    });

    await localDataStore.saveProducts(businessId, products, businessName);
    return { success: true, count: products.length };
  } catch (err: any) {
    console.error('[productService] Error forzando sincronización:', err);
    return { success: false, count: 0, error: err.message || 'Error de conexión' };
  }
}

/**
 * Recursively cleans any object or array by completely omitting undefined values.
 * Preserves null, boolean (false/true), 0, empty strings, arrays, nested objects, and dates.
 */
export function sanitizeProductForFirestore<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizeProductForFirestore(item))
      .filter((item) => item !== undefined) as unknown as T;
  }

  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj;
    }

    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        const cleanedValue = sanitizeProductForFirestore(value);
        if (cleanedValue !== undefined) {
          cleanObj[key] = cleanedValue;
        }
      }
    }
    return cleanObj as T;
  }

  return obj;
}

/**
 * Check if barcode is already used within the business by another product
 */
export async function checkBarcodeExists(businessId: string, barcode: string, excludeProductId?: string): Promise<boolean> {
  if (!barcode || !barcode.trim()) return false;
  const cleanBarcode = barcode.trim();
  const q = query(
    collection(db, 'products'), 
    where('businessId', '==', businessId),
    where('barcode', '==', cleanBarcode)
  );
  const snap = await getDocs(q);
  if (snap.empty) return false;
  if (!excludeProductId) return true;
  return snap.docs.some(d => d.id !== excludeProductId);
}

/**
 * Create a new product and log initial inventory movement if initialStock > 0
 */
export async function createProduct(
  businessId: string, 
  userId: string, 
  input: CreateProductInput
): Promise<Product> {
  const barcode = input.barcode ? input.barcode.trim() : null;
  if (barcode) {
    const exists = await checkBarcodeExists(businessId, barcode);
    if (exists) {
      throw new Error(`El código de barras "${barcode}" ya está registrado en este negocio.`);
    }
  }

  const productRef = doc(collection(db, 'products'));
  const productId = productRef.id;
  const now = new Date().toISOString();

  const isCombo = Boolean(input.isCombo);
  const tracksStock = isCombo ? false : (input.tracksStock !== false);
  const category = normalizeCategoryName(input.category) || 'General';
  const name = normalizeProductName(input.name);
  const icon = input.icon || getDefaultIconForCategoryOrProduct(name || category);

  const sanitizedComboItems: ComboItem[] = isCombo && input.comboItems ? input.comboItems.map(ci => ({
    productId: ci.productId,
    productName: ci.productName || '',
    quantity: Math.max(1, Number(ci.quantity) || 1),
    unitCost: Math.max(0, Number(ci.unitCost) || 0),
    tracksStock: ci.tracksStock !== undefined 
      ? Boolean(ci.tracksStock) 
      : (ci.trackStock !== undefined ? Boolean(ci.trackStock) : true),
    trackStock: ci.tracksStock !== undefined 
      ? Boolean(ci.tracksStock) 
      : (ci.trackStock !== undefined ? Boolean(ci.trackStock) : true)
  })) : [];

  const calculatedComboCost = isCombo 
    ? sanitizedComboItems.reduce((acc, ci) => acc + (ci.quantity * (Number(ci.unitCost) || 0)), 0)
    : 0;
  const costPrice = isCombo 
    ? (calculatedComboCost > 0 ? calculatedComboCost : (Number(input.costPrice) || 0))
    : (Number(input.costPrice) || 0);

  const minimumStock = tracksStock ? (Number(input.minimumStock) || 0) : 0;
  const hasValidReorderPoint = input.reorderPoint !== undefined && input.reorderPoint !== null && !isNaN(Number(input.reorderPoint));
  const reorderPoint = tracksStock
    ? (hasValidReorderPoint ? Number(input.reorderPoint) : minimumStock)
    : 0;

  const newProductData: Record<string, any> = {
    id: productId,
    businessId,
    barcode: barcode || null,
    name,
    category,
    icon,
    costPrice,
    salePrice: Number(input.salePrice) || 0,
    stock: tracksStock ? (Number(input.initialStock) || 0) : 0,
    minimumStock,
    reorderPoint,
    tracksStock,
    isCombo,
    comboItems: isCombo ? sanitizedComboItems : [],
    active: true,
    createdAt: now,
    updatedAt: now
  };

  // Only include targetStock if trackStock is true and a valid number is provided
  const hasValidTargetStock = input.targetStock !== undefined && input.targetStock !== null && !isNaN(Number(input.targetStock));
  if (tracksStock && hasValidTargetStock) {
    newProductData.targetStock = Number(input.targetStock);
  }

  const cleanProduct = sanitizeProductForFirestore(newProductData);
  await setDoc(productRef, cleanProduct);

  const newProduct = cleanProduct as Product;

  // If initial stock > 0 and tracksStock, log INITIAL movement
  if (tracksStock && newProduct.stock > 0) {
    const movementRef = doc(collection(db, 'inventory_movements'));
    const movementData: Record<string, any> = {
      id: movementRef.id,
      businessId,
      productId,
      productName: newProduct.name,
      productBarcode: newProduct.barcode || null,
      type: 'INITIAL',
      quantity: newProduct.stock,
      previousStock: 0,
      newStock: newProduct.stock,
      reason: 'Stock inicial al crear producto',
      createdAt: now,
      userId
    };
    await setDoc(movementRef, sanitizeProductForFirestore(movementData));
  }

  return newProduct;
}

/**
 * Update an existing product fields. NOTE: Stock is NOT modified here.
 */
export async function updateProduct(
  productId: string,
  businessId: string,
  input: UpdateProductInput
): Promise<void> {
  const barcode = input.barcode ? input.barcode.trim() : null;
  if (barcode) {
    const exists = await checkBarcodeExists(businessId, barcode, productId);
    if (exists) {
      throw new Error(`El código de barras "${barcode}" ya pertenece a otro producto en este negocio.`);
    }
  }

  const isCombo = Boolean(input.isCombo);
  const tracksStock = isCombo ? false : (input.tracksStock !== false);
  const category = normalizeCategoryName(input.category) || 'General';
  const name = normalizeProductName(input.name);
  const icon = input.icon || getDefaultIconForCategoryOrProduct(name || category);

  const sanitizedComboItems: ComboItem[] = isCombo && input.comboItems ? input.comboItems.map(ci => ({
    productId: ci.productId,
    productName: ci.productName || '',
    quantity: Math.max(1, Number(ci.quantity) || 1),
    unitCost: Math.max(0, Number(ci.unitCost) || 0),
    tracksStock: ci.tracksStock !== undefined 
      ? Boolean(ci.tracksStock) 
      : (ci.trackStock !== undefined ? Boolean(ci.trackStock) : true),
    trackStock: ci.tracksStock !== undefined 
      ? Boolean(ci.tracksStock) 
      : (ci.trackStock !== undefined ? Boolean(ci.trackStock) : true)
  })) : [];

  const calculatedComboCost = isCombo 
    ? sanitizedComboItems.reduce((acc, ci) => acc + (ci.quantity * (Number(ci.unitCost) || 0)), 0)
    : 0;
  const costPrice = isCombo 
    ? (calculatedComboCost > 0 ? calculatedComboCost : (Number(input.costPrice) || 0))
    : (Number(input.costPrice) || 0);

  const minimumStock = tracksStock ? (Number(input.minimumStock) || 0) : 0;
  const hasValidReorderPoint = input.reorderPoint !== undefined && input.reorderPoint !== null && !isNaN(Number(input.reorderPoint));
  const reorderPoint = tracksStock
    ? (hasValidReorderPoint ? Number(input.reorderPoint) : minimumStock)
    : 0;

  const productRef = doc(db, 'products', productId);
  const updateData: Record<string, any> = {
    barcode: barcode || null,
    name,
    category,
    icon,
    costPrice,
    salePrice: Number(input.salePrice) || 0,
    minimumStock,
    reorderPoint,
    tracksStock,
    isCombo,
    comboItems: isCombo ? sanitizedComboItems : [],
    active: Boolean(input.active),
    updatedAt: new Date().toISOString()
  };

  // Only include targetStock if trackStock is true and a valid number is provided
  const hasValidTargetStock = input.targetStock !== undefined && input.targetStock !== null && !isNaN(Number(input.targetStock));
  if (tracksStock && hasValidTargetStock) {
    updateData.targetStock = Number(input.targetStock);
  }

  const cleanUpdate = sanitizeProductForFirestore(updateData);
  await updateDoc(productRef, cleanUpdate);
}

/**
 * Update only the barcode of an existing product (e.g. from POS or Seller dashboard)
 */
export async function updateProductBarcode(
  productId: string,
  businessId: string,
  barcode: string | null
): Promise<void> {
  const cleanBarcode = barcode ? barcode.trim() : null;
  if (cleanBarcode) {
    const exists = await checkBarcodeExists(businessId, cleanBarcode, productId);
    if (exists) {
      throw new Error(`El código de barras "${cleanBarcode}" ya pertenece a otro producto en este negocio.`);
    }
  }

  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, sanitizeProductForFirestore({
    barcode: cleanBarcode || null,
    updatedAt: new Date().toISOString()
  }));
}

/**
 * Toggle active / inactive status of a product
 */
export async function toggleProductActive(productId: string, currentActive: boolean): Promise<void> {
  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, sanitizeProductForFirestore({
    active: !currentActive,
    updatedAt: new Date().toISOString()
  }));
}

/**
 * Adjust product stock manually and record inventory movement
 */
export async function adjustProductStock(
  productId: string,
  businessId: string,
  userId: string,
  quantityChange: number, // positive for IN, negative for OUT
  reason?: string
): Promise<number> {
  const productRef = doc(db, 'products', productId);
  const now = new Date().toISOString();

  let newStock = 0;

  await runTransaction(db, async (transaction) => {
    const productSnap = await transaction.get(productRef);
    if (!productSnap.exists()) {
      throw new Error('Producto no encontrado');
    }
    const currentData = productSnap.data() as Product;
    const previousStock = currentData.stock || 0;
    newStock = previousStock + quantityChange;

    transaction.update(productRef, sanitizeProductForFirestore({
      stock: newStock,
      updatedAt: now
    }));

    const movementRef = doc(collection(db, 'inventory_movements'));
    const movementType = quantityChange >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    
    const movement: InventoryMovement = {
      id: movementRef.id,
      businessId,
      productId,
      productName: currentData.name,
      productBarcode: currentData.barcode || null,
      type: movementType,
      quantity: Math.abs(quantityChange),
      previousStock,
      newStock,
      reason: reason?.trim() || (quantityChange >= 0 ? 'Ajuste manual de entrada' : 'Ajuste manual de salida'),
      createdAt: now,
      userId
    };

    transaction.set(movementRef, sanitizeProductForFirestore(movement));
  });

  return newStock;
}

/**
 * Get inventory movements log for a business or specific product
 */
export async function getInventoryMovements(businessId: string, productId?: string): Promise<InventoryMovement[]> {
  try {
    let q;
    if (productId) {
      q = query(
        collection(db, 'inventory_movements'), 
        where('businessId', '==', businessId),
        where('productId', '==', productId)
      );
    } else {
      q = query(
        collection(db, 'inventory_movements'), 
        where('businessId', '==', businessId)
      );
    }
    const querySnapshot = await getDocs(q);
    const movements: InventoryMovement[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      movements.push({ id: docSnap.id, ...data } as InventoryMovement);
    });
    return movements.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.error('Error fetching inventory movements:', error);
    return [];
  }
}

/**
 * Execute batch Excel Import for valid rows:
 * - NEW: create product + INITIAL movement if stock > 0
 * - UPDATE: update barcode, name, category, costPrice, salePrice (stock is NOT overwritten for existing products)
 */
export async function executeExcelImport(
  businessId: string,
  userId: string,
  rows: ExcelImportRow[]
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    if (row.status === 'NEW') {
      await createProduct(businessId, userId, {
        barcode: row.barcode,
        name: row.name,
        category: row.category,
        costPrice: row.costPrice,
        salePrice: row.salePrice,
        initialStock: row.stock,
        minimumStock: 5
      });
      created++;
    } else if (row.status === 'UPDATE' && row.existingProductId) {
      await updateProduct(row.existingProductId, businessId, {
        barcode: row.barcode,
        name: row.name,
        category: row.category,
        costPrice: row.costPrice,
        salePrice: row.salePrice,
        minimumStock: 5,
        active: true
      });
      updated++;
    }
  }

  return { created, updated };
}
