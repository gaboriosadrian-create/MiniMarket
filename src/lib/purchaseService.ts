import { 
  collection, 
  doc, 
  getDoc,
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { Purchase, PurchaseItem, PurchasePaymentMethod, UserProfile, UserPermissions } from '../types';
import { hasPermission } from './permissions';

/**
 * Calculates current cash balance in hand (Saldo de Caja en Efectivo) for a business.
 * Cash balance = (Completed Cash Sales) - (Confirmed Cash Purchases) - (Cash Expenses)
 */
export async function getCashBalance(businessId: string): Promise<number> {
  if (!businessId) return 0;

  try {
    // 1. Cash Sales
    const salesQ = query(
      collection(db, 'sales'),
      where('businessId', '==', businessId)
    );
    const salesSnap = await getDocs(salesQ);
    let totalCashSales = 0;
    salesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'COMPLETED' || !data.status) {
        if (data.paymentMethod === 'EFECTIVO') {
          totalCashSales += Number(data.total || 0);
        } else if (data.paymentMethod === 'COMBINADO' && data.paymentBreakdown?.cashAmount) {
          totalCashSales += Number(data.paymentBreakdown.cashAmount || 0);
        }
      }
    });

    // 2. Cash Purchases
    const purchasesQ = query(
      collection(db, 'purchases'),
      where('businessId', '==', businessId)
    );
    const purchasesSnap = await getDocs(purchasesQ);
    let totalCashPurchases = 0;
    purchasesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (
        data.paymentMethod === 'EFECTIVO' && 
        (data.status === 'CONFIRMED' || (!data.status && data.amount))
      ) {
        totalCashPurchases += Number(data.total || data.amount || 0);
      }
    });

    // 3. Cash Expenses
    const expensesQ = query(
      collection(db, 'expenses'),
      where('businessId', '==', businessId)
    );
    const expensesSnap = await getDocs(expensesQ);
    let totalCashExpenses = 0;
    expensesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.paymentMethod === 'EFECTIVO') {
        totalCashExpenses += Number(data.amount || 0);
      }
    });

    return totalCashSales - totalCashPurchases - totalCashExpenses;
  } catch (err) {
    console.error('Error calculating cash balance:', err);
    return 0;
  }
}

/**
 * Fetch purchases for a business, with optional date filtering
 */
export async function getPurchasesByBusiness(
  businessId: string,
  startDateIso?: string,
  endDateIso?: string
): Promise<Purchase[]> {
  const ref = collection(db, 'purchases');
  const q = query(ref, where('businessId', '==', businessId));
  const snap = await getDocs(q);

  let purchases: Purchase[] = [];
  snap.forEach((docSnap) => {
    purchases.push({
      id: docSnap.id,
      ...docSnap.data()
    } as Purchase);
  });

  if (startDateIso || endDateIso) {
    purchases = purchases.filter((p) => {
      if (!p.createdAt) return false;
      if (startDateIso && p.createdAt < startDateIso) return false;
      if (endDateIso && p.createdAt > endDateIso) return false;
      return true;
    });
  }

  purchases.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return purchases;
}

export interface CreatePurchaseDraftInput {
  businessId: string;
  supplierName?: string;
  hasReceipt: boolean;
  receiptNumber?: string;
  items: PurchaseItem[];
  total: number;
  paymentMethod: PurchasePaymentMethod;
  createdBy: string;
  creatorName: string;
}

/**
 * Consolidate duplicate products in purchase items array.
 * Sums quantities and recalculates subtotals.
 */
export function consolidatePurchaseItems(items: PurchaseItem[]): PurchaseItem[] {
  const map = new Map<string, PurchaseItem>();

  for (const item of items) {
    if (!map.has(item.productId)) {
      map.set(item.productId, {
        ...item,
        quantity: Number(item.quantity) || 0,
        unitCost: Number(item.unitCost) || 0,
        subtotal: (Number(item.quantity) || 0) * (Number(item.unitCost) || 0)
      });
    } else {
      const existing = map.get(item.productId)!;
      const newQty = existing.quantity + (Number(item.quantity) || 0);
      const unitCost = Number(item.unitCost) || existing.unitCost;
      map.set(item.productId, {
        ...existing,
        quantity: newQty,
        unitCost: unitCost,
        subtotal: newQty * unitCost
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Creates a purchase draft (status = 'DRAFT')
 */
export async function createPurchaseDraft(input: CreatePurchaseDraftInput): Promise<Purchase> {
  const ref = collection(db, 'purchases');
  const now = new Date().toISOString();

  const consolidatedItems = consolidatePurchaseItems(input.items);
  const total = consolidatedItems.reduce((sum, item) => sum + item.subtotal, 0);

  const payload: Omit<Purchase, 'id'> = {
    businessId: input.businessId,
    supplierName: input.supplierName?.trim() || '',
    hasReceipt: Boolean(input.hasReceipt),
    receiptNumber: input.receiptNumber?.trim() || '',
    items: consolidatedItems,
    total: total,
    paymentMethod: input.paymentMethod || 'EFECTIVO',
    status: 'DRAFT',
    createdBy: input.createdBy,
    creatorName: input.creatorName || 'Vendedor',
    createdAt: now,
    updatedAt: now
  };

  const docRef = await addDoc(ref, payload);
  return {
    id: docRef.id,
    ...payload
  };
}

/**
 * Updates a draft purchase
 */
export async function updatePurchaseDraft(
  purchaseId: string,
  updates: {
    items?: PurchaseItem[];
    supplierName?: string;
    hasReceipt?: boolean;
    receiptNumber?: string;
  },
  userContext: {
    userId: string;
    businessId: string;
    role: string;
  }
): Promise<void> {
  const purchaseRef = doc(db, 'purchases', purchaseId);
  const purchaseSnap = await getDoc(purchaseRef);

  if (!purchaseSnap.exists()) {
    throw new Error('La compra especificada no existe.');
  }

  const data = purchaseSnap.data() as Purchase;

  if (data.businessId !== userContext.businessId) {
    throw new Error('No tiene autorización sobre esta compra (diferente comercio).');
  }

  if (data.status !== 'DRAFT') {
    throw new Error('No se puede modificar una compra que no esté en estado BORRADOR.');
  }

  if (userContext.role !== 'ADMIN' && userContext.role !== 'SUPER_ADMIN' && data.createdBy !== userContext.userId) {
    throw new Error('Solo el creador del borrador o un administrador puede modificarlo.');
  }

  const now = new Date().toISOString();
  const updateData: Partial<Purchase> = { updatedAt: now };

  if (updates.supplierName !== undefined) {
    updateData.supplierName = updates.supplierName.trim();
  }
  if (updates.hasReceipt !== undefined) {
    updateData.hasReceipt = updates.hasReceipt;
  }
  if (updates.receiptNumber !== undefined) {
    updateData.receiptNumber = updates.receiptNumber.trim();
  }
  if (updates.items !== undefined) {
    const consolidated = consolidatePurchaseItems(updates.items);
    updateData.items = consolidated;
    updateData.total = consolidated.reduce((sum, i) => sum + i.subtotal, 0);
  }

  await updateDoc(purchaseRef, updateData);
}

export interface ConfirmPurchaseParams {
  purchaseId: string;
  user: UserProfile;
}

/**
 * Confirms a draft purchase in an ATOMIC FIRESTORE TRANSACTION.
 * 1. Checks permissions (`purchases.create`, `cash.purchase_payment`, `inventory.stock_entry`).
 * 2. Checks cash balance: `saldoCaja >= purchase.total`.
 * 3. Reads purchase doc and verifies status === 'DRAFT' and businessId.
 * 4. Reads product docs and validates items.
 * 5. ATOMIC WRITES:
 *    - Updates products stock (+quantity)
 *    - Creates inventory movements (type: 'PURCHASE')
 *    - Creates cash movement (type: 'PURCHASE_PAYMENT', amount: -total)
 *    - Updates purchase doc (status: 'CONFIRMED')
 */
export async function confirmPurchaseTransaction({
  purchaseId,
  user
}: ConfirmPurchaseParams): Promise<void> {
  if (!user || !user.uid || !user.businessId) {
    throw new Error('Usuario o comercio no especificado.');
  }

  // Permission Check
  const canRegisterPurchase = hasPermission(user, 'purchases.create');
  const canPayWithCash = hasPermission(user, 'cash.purchase_payment');
  const canEntryStock = hasPermission(user, 'inventory.stock_entry');

  if (!canRegisterPurchase) {
    throw new Error('No tienes permiso para registrar compras (purchases.create).');
  }
  if (!canPayWithCash) {
    throw new Error('No tienes permiso para autorizar pagos en efectivo desde la caja (cash.purchase_payment).');
  }
  if (!canEntryStock) {
    throw new Error('No tienes permiso para ingresar productos al stock (inventory.stock_entry).');
  }

  // 1. Pre-calculate Cash Balance
  const cashBalance = await getCashBalance(user.businessId);

  const purchaseRef = doc(db, 'purchases', purchaseId);

  // Execute Firestore Transaction
  await runTransaction(db, async (transaction) => {
    // 2. Read Purchase Doc
    const purchaseSnap = await transaction.get(purchaseRef);
    if (!purchaseSnap.exists()) {
      throw new Error('La compra no existe.');
    }

    const purchase = purchaseSnap.data() as Purchase;

    // Security Check: Business Isolation
    if (purchase.businessId !== user.businessId) {
      throw new Error('No tienes permisos sobre la compra de otro comercio.');
    }

    // Security Check: Immutability / Single Confirmation
    if (purchase.status !== 'DRAFT') {
      throw new Error(`La compra ya se encuentra en estado ${purchase.status}. No puede ser confirmada nuevamente.`);
    }

    // Security Check: Draft Ownership
    if (user.role === 'SELLER' && purchase.createdBy !== user.uid) {
      throw new Error('Un vendedor solo puede confirmar sus propios borradores de compra.');
    }

    // Security Check: Items Validation
    if (!purchase.items || purchase.items.length === 0) {
      throw new Error('La compra no contiene productos para ingresar.');
    }

    const purchaseTotal = purchase.total || 0;
    if (purchaseTotal <= 0) {
      throw new Error('El total de la compra debe ser mayor a 0.');
    }

    // 3. Cash Availability Check
    if (purchase.paymentMethod === 'EFECTIVO' && cashBalance < purchaseTotal) {
      const missing = purchaseTotal - cashBalance;
      throw new Error(
        `FONDOS_INSUFICIENTES: No hay suficiente efectivo en caja para realizar esta compra. Caja disponible: $${cashBalance.toLocaleString('es-AR')}, Total compra: $${purchaseTotal.toLocaleString('es-AR')}, Faltan: $${missing.toLocaleString('es-AR')}.`
      );
    }

    // 4. Read Product Docs
    const productRefsAndData: Array<{
      ref: ReturnType<typeof doc>;
      item: PurchaseItem;
      data: any;
    }> = [];

    for (const item of purchase.items) {
      if (!item.productId) {
        throw new Error('Ítem inválido sin ID de producto.');
      }
      if (item.quantity <= 0) {
        throw new Error(`Cantidad inválida (${item.quantity}) para el producto ${item.productName}.`);
      }
      if (item.unitCost < 0) {
        throw new Error(`Costo unitario inválido ($${item.unitCost}) para el producto ${item.productName}.`);
      }

      const pRef = doc(db, 'products', item.productId);
      const pSnap = await transaction.get(pRef);

      if (!pSnap.exists()) {
        throw new Error(`El producto "${item.productName}" (ID: ${item.productId}) no existe en la base de datos.`);
      }

      const pData = pSnap.data();
      if (pData.businessId !== user.businessId) {
        throw new Error(`El producto "${item.productName}" pertenece a otro comercio.`);
      }

      productRefsAndData.push({
        ref: pRef,
        item,
        data: pData
      });
    }

    // 5. ATOMIC WRITES
    const now = new Date().toISOString();

    // A. Update Product Stocks (costPrice & salePrice remain unchanged)
    for (const { ref: pRef, item, data: pData } of productRefsAndData) {
      const currentStock = Number(pData.stock) || 0;
      const newStock = currentStock + item.quantity;

      transaction.update(pRef, {
        stock: newStock,
        updatedAt: now
      });

      // B. Create Inventory Movement
      const invMovRef = doc(collection(db, 'inventory_movements'));
      transaction.set(invMovRef, {
        id: invMovRef.id,
        businessId: user.businessId,
        productId: item.productId,
        productName: item.productName || pData.name,
        type: 'PURCHASE',
        quantity: item.quantity,
        previousStock: currentStock,
        newStock: newStock,
        reason: `Compra directa: ${purchase.supplierName || 'Proveedor'}`,
        createdAt: now,
        userId: user.uid,
        purchaseId: purchaseId
      });
    }

    // C. Create Cash Movement
    const cashMovRef = doc(collection(db, 'cash_movements'));
    transaction.set(cashMovRef, {
      id: cashMovRef.id,
      businessId: user.businessId,
      type: 'PURCHASE_PAYMENT',
      amount: -purchaseTotal,
      referenceId: purchaseId,
      purchaseId: purchaseId,
      supplierName: purchase.supplierName || '',
      description: `Compra directa de productos - ${purchase.supplierName || 'Proveedor'}`,
      paymentMethod: purchase.paymentMethod,
      createdBy: user.uid,
      creatorName: user.displayName || user.email,
      createdAt: now
    });

    // D. Update Purchase Document Status
    transaction.update(purchaseRef, {
      status: 'CONFIRMED',
      confirmedBy: user.uid,
      confirmerName: user.displayName || user.email,
      confirmedAt: now,
      cashMovementId: cashMovRef.id,
      updatedAt: now
    });
  });
}

/**
 * Delete a draft purchase (admin or owner)
 */
export async function deletePurchaseDraft(purchaseId: string, user: UserProfile): Promise<void> {
  const purchaseRef = doc(db, 'purchases', purchaseId);
  const purchaseSnap = await getDoc(purchaseRef);

  if (!purchaseSnap.exists()) return;

  const data = purchaseSnap.data() as Purchase;

  if (data.businessId !== user.businessId) {
    throw new Error('No tiene autorización sobre este borrador.');
  }

  if (data.status !== 'DRAFT') {
    throw new Error('Solo se pueden eliminar compras en borrador.');
  }

  await deleteDoc(purchaseRef);
}
