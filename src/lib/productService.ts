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
import { 
  Product, 
  InventoryMovement, 
  CreateProductInput, 
  UpdateProductInput,
  ExcelImportRow
} from '../types';

/**
 * Get all products for a specific businessId
 */
export async function getProductsByBusiness(businessId: string): Promise<Product[]> {
  try {
    const q = query(collection(db, 'products'), where('businessId', '==', businessId));
    const querySnapshot = await getDocs(q);
    const products: Product[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Record<string, any>;
      products.push({ id: docSnap.id, ...data } as Product);
    });
    return products.sort((a, b) => a.name.localeCompare(b.name));
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
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

  const newProduct: Product = {
    id: productId,
    businessId,
    barcode: barcode || null,
    name: input.name.trim(),
    category: input.category.trim() || 'General',
    costPrice: Number(input.costPrice) || 0,
    salePrice: Number(input.salePrice) || 0,
    stock: Number(input.initialStock) || 0,
    minimumStock: Number(input.minimumStock) || 0,
    active: true,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(productRef, newProduct);

  // If initial stock > 0, log INITIAL movement
  if (newProduct.stock > 0) {
    const movementRef = doc(collection(db, 'inventory_movements'));
    const movement: InventoryMovement = {
      id: movementRef.id,
      businessId,
      productId,
      productName: newProduct.name,
      type: 'INITIAL',
      quantity: newProduct.stock,
      previousStock: 0,
      newStock: newProduct.stock,
      reason: 'Stock inicial al crear producto',
      createdAt: now,
      userId
    };
    await setDoc(movementRef, movement);
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

  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, {
    barcode: barcode || null,
    name: input.name.trim(),
    category: input.category.trim() || 'General',
    costPrice: Number(input.costPrice) || 0,
    salePrice: Number(input.salePrice) || 0,
    minimumStock: Number(input.minimumStock) || 0,
    active: input.active,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Toggle active / inactive status of a product
 */
export async function toggleProductActive(productId: string, currentActive: boolean): Promise<void> {
  const productRef = doc(db, 'products', productId);
  await updateDoc(productRef, {
    active: !currentActive,
    updatedAt: new Date().toISOString()
  });
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

    transaction.update(productRef, {
      stock: newStock,
      updatedAt: now
    });

    const movementRef = doc(collection(db, 'inventory_movements'));
    const movementType = quantityChange >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT';
    
    const movement: InventoryMovement = {
      id: movementRef.id,
      businessId,
      productId,
      productName: currentData.name,
      type: movementType,
      quantity: Math.abs(quantityChange),
      previousStock,
      newStock,
      reason: reason?.trim() || (quantityChange >= 0 ? 'Ajuste manual de entrada' : 'Ajuste manual de salida'),
      createdAt: now,
      userId
    };

    transaction.set(movementRef, movement);
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
