import { 
  collection, 
  doc, 
  runTransaction,
  getDocs,
  query,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { Sale, Product, InventoryMovement } from '../types';

/**
 * Fetches completed sales for a business, optionally filtered by a start and end date range (ISO strings).
 */
export async function getSalesByBusiness(
  businessId: string, 
  startDateIso?: string, 
  endDateIso?: string
): Promise<Sale[]> {
  const salesRef = collection(db, 'sales');
  const q = query(salesRef, where('businessId', '==', businessId));
  const snap = await getDocs(q);

  let sales: Sale[] = [];
  snap.forEach((docSnap) => {
    sales.push({
      id: docSnap.id,
      ...docSnap.data()
    } as Sale);
  });

  // Filter by date if provided
  if (startDateIso || endDateIso) {
    sales = sales.filter((s) => {
      if (!s.createdAt) return false;
      if (startDateIso && s.createdAt < startDateIso) return false;
      if (endDateIso && s.createdAt > endDateIso) return false;
      return true;
    });
  }

  // Sort descending by createdAt
  sales.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return sales;
}

export interface ProcessSaleInput {
  businessId: string;
  sellerId: string;
  sellerName: string;
  items: {
    product: Product;
    quantity: number;
  }[];
  total: number;
  paymentMethod: 'EFECTIVO' | 'MERCADO_PAGO';
}

/**
 * Executes an atomic sale transaction in Firestore:
 * 1. Re-validates stock for all items
 * 2. Creates the Sale document with item snapshots
 * 3. Decrements product stock
 * 4. Logs inventory movements of type SALE
 */
export async function processSale(input: ProcessSaleInput): Promise<Sale> {
  const { businessId, sellerId, sellerName, items, total, paymentMethod } = input;

  if (!items || items.length === 0) {
    throw new Error('El carrito no contiene productos.');
  }

  const now = new Date().toISOString();
  const saleRef = doc(collection(db, 'sales'));
  const saleId = saleRef.id;

  await runTransaction(db, async (transaction) => {
    // 1. READ & VERIFY ALL PRODUCTS FIRST
    const productSnaps = await Promise.all(
      items.map((item) => transaction.get(doc(db, 'products', item.product.id)))
    );

    const productUpdates: Array<{
      ref: any;
      newStock: number;
      previousStock: number;
      productName: string;
      productId: string;
      quantity: number;
      barcode: string | null;
      unitPrice: number;
      subtotal: number;
    }> = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const snap = productSnaps[i];

      if (!snap.exists()) {
        throw new Error(`El producto "${item.product.name}" ya no existe.`);
      }

      const pData = snap.data() as Product;

      if (pData.businessId !== businessId) {
        throw new Error(`Acceso denegado al producto "${pData.name}".`);
      }

      if (!pData.active) {
        throw new Error(`El producto "${pData.name}" está deshabilitado.`);
      }

      const currentStock = pData.stock ?? 0;
      if (currentStock < item.quantity) {
        throw new Error(
          `El stock de "${pData.name}" cambió. Disponible: ${currentStock} u.`
        );
      }

      const newStock = currentStock - item.quantity;
      const unitPrice = pData.salePrice;
      const subtotal = unitPrice * item.quantity;

      productUpdates.push({
        ref: snap.ref,
        productId: snap.id,
        productName: pData.name,
        barcode: pData.barcode || null,
        previousStock: currentStock,
        newStock,
        quantity: item.quantity,
        unitPrice,
        subtotal
      });
    }

    // 2. PREPARE SALE ITEMS SNAPSHOT
    const saleItemsSnapshot = productUpdates.map((pu) => ({
      productId: pu.productId,
      productName: pu.productName,
      barcode: pu.barcode,
      quantity: pu.quantity,
      unitPrice: pu.unitPrice,
      subtotal: pu.subtotal
    }));

    const newSale: Sale = {
      id: saleId,
      businessId,
      sellerId,
      sellerName: sellerName || 'Vendedor',
      items: saleItemsSnapshot,
      total,
      paymentMethod,
      status: 'COMPLETED',
      createdAt: now
    };

    // 3. EXECUTE WRITES IN TRANSACTION
    transaction.set(saleRef, newSale);

    for (const pu of productUpdates) {
      // Update product stock
      transaction.update(pu.ref, {
        stock: pu.newStock,
        updatedAt: now
      });

      // Create inventory movement record of type SALE
      const movementRef = doc(collection(db, 'inventory_movements'));
      const movement: InventoryMovement = {
        id: movementRef.id,
        businessId,
        productId: pu.productId,
        productName: pu.productName,
        type: 'SALE',
        quantity: pu.quantity,
        previousStock: pu.previousStock,
        newStock: pu.newStock,
        reason: `Venta #${saleId.slice(-6).toUpperCase()}`,
        createdAt: now,
        userId: sellerId,
        saleId
      };
      transaction.set(movementRef, movement);
    }
  });

  return {
    id: saleId,
    businessId,
    sellerId,
    sellerName,
    items: items.map((i) => ({
      productId: i.product.id,
      productName: i.product.name,
      barcode: i.product.barcode || null,
      quantity: i.quantity,
      unitPrice: i.product.salePrice,
      subtotal: i.quantity * i.product.salePrice
    })),
    total,
    paymentMethod,
    status: 'COMPLETED',
    createdAt: now
  };
}
