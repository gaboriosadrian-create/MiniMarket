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
import { 
  Purchase, 
  PurchaseItem, 
  PurchasePaymentMethod, 
  UserProfile, 
  UserPermissions,
  OutboxOperation,
  ProcessPurchasePayload,
  InventoryMovement
} from '../types';
import { hasPermission } from './permissions';
import { localDataStore } from './localDataStore';
import { withActionLock } from './rateLimit';
import { getDeviceId } from './deviceId';
import { sanitizeString, sanitizeNumber } from './securityUtils';
import { logAdminAction } from './auditService';

/**
 * Calculates current cash balance in hand (Saldo de Caja en Efectivo) for a business.
 * Cash balance = (Completed Cash Sales) - (Confirmed Cash Purchases from Business Funds) - (Cash Expenses from Business Funds) - (Cash Settlements from Business Funds)
 */
export async function getCashBalance(businessId: string): Promise<number> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return 0;

  try {
    // 1. Cash Sales (EFECTIVO + cash portion of COMBINADO)
    const salesQ = query(
      collection(db, 'sales'),
      where('businessId', '==', cleanBusinessId)
    );
    const salesSnap = await getDocs(salesQ);
    let totalCashSales = 0;
    salesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.status === 'COMPLETED' || (!data.status && data.status !== 'CANCELLED')) {
        if (data.paymentMethod === 'EFECTIVO') {
          totalCashSales += Number(data.total || 0);
        } else if (data.paymentMethod === 'COMBINADO' && data.paymentBreakdown?.cashAmount) {
          totalCashSales += Number(data.paymentBreakdown.cashAmount || 0);
        }
      }
    });

    // 2. Cash Purchases Paid with Business Cash (Excludes A_CANCELAR and PERSONAL fund sources)
    const purchasesQ = query(
      collection(db, 'purchases'),
      where('businessId', '==', cleanBusinessId)
    );
    const purchasesSnap = await getDocs(purchasesQ);
    let totalCashPurchases = 0;
    purchasesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const isConfirmed = data.status === 'CONFIRMED' || (!data.status && (data.amount !== undefined || data.total !== undefined));
      const isCashPayment = data.paymentMethod === 'EFECTIVO';
      const isPaid = data.paymentStatus !== 'A_CANCELAR';
      const isBusinessFund = data.fundSource !== 'PERSONAL';

      if (isConfirmed && isCashPayment && isPaid && isBusinessFund) {
        totalCashPurchases += Number(data.total || data.amount || 0);
      }
    });

    // 3. Cash Expenses from Business Funds (Excludes PERSONAL, PENDIENTE, ANULADO, and obligations settled separately)
    const expensesQ = query(
      collection(db, 'expenses'),
      where('businessId', '==', cleanBusinessId)
    );
    const expensesSnap = await getDocs(expensesQ);
    let totalCashExpenses = 0;
    expensesSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const isCashPayment = data.paymentMethod === 'EFECTIVO' || data.fundSource === 'CASH';
      const isBusinessFund = data.fundSource !== 'PERSONAL';
      const isPaid = data.status === 'PAGADO' || (!data.status && data.status !== 'PENDIENTE' && data.status !== 'ANULADO');
      const notTrackedViaSettlement = !data.obligationId;

      if (isCashPayment && isBusinessFund && isPaid && notTrackedViaSettlement) {
        totalCashExpenses += Number(data.paidAmount ?? data.amount ?? 0);
      }
    });

    // 4. Cash Settlements (Obligations paid from business CASH)
    const settlementsQ = query(
      collection(db, 'payment_settlements'),
      where('businessId', '==', cleanBusinessId)
    );
    const settlementsSnap = await getDocs(settlementsQ);
    let totalCashSettlements = 0;
    settlementsSnap.forEach((docSnap) => {
      const data = docSnap.data();
      const isCash = data.fundSource === 'CASH' || data.paymentMethod === 'EFECTIVO';
      const isBusinessFund = data.fundSource !== 'PERSONAL';

      if (isCash && isBusinessFund) {
        totalCashSettlements += Number(data.amount || 0);
      }
    });

    return totalCashSales - totalCashPurchases - totalCashExpenses - totalCashSettlements;
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
  paymentStatus?: 'PAGADO' | 'A_CANCELAR';
  fundSource?: 'CASH' | 'BANK' | 'MERCADO_PAGO' | 'PERSONAL' | 'OTHER';
  isImmediateDelivery?: boolean;
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
    paymentStatus: input.paymentStatus || 'PAGADO',
    fundSource: input.fundSource || 'CASH',
    isImmediateDelivery: input.isImmediateDelivery !== false,
    receivingStatus: input.isImmediateDelivery !== false ? 'RECIBIDO' : 'PENDIENTE',
    receivedQuantity: input.isImmediateDelivery !== false ? consolidatedItems.reduce((s, i) => s + i.quantity, 0) : 0,
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
  updateCostPriceMap?: Record<string, boolean>;
}

/**
 * Confirms a draft purchase in an ATOMIC FIRESTORE TRANSACTION.
 * 1. Checks permissions (`purchases.create`, `cash.purchase_payment`, `inventory.stock_entry`).
 * 2. Checks cash balance: `saldoCaja >= purchase.total`.
 * 3. Reads purchase doc and verifies status === 'DRAFT' and businessId.
 * 4. Reads product docs and validates items.
 * 5. ATOMIC WRITES:
 *    - Updates products stock (+quantity) and costPrice if requested
 *    - Creates inventory movements (type: 'PURCHASE')
 *    - Creates cash movement (type: 'PURCHASE_PAYMENT', amount: -total)
 *    - Updates purchase doc (status: 'CONFIRMED')
 */
export async function confirmPurchaseTransaction({
  purchaseId,
  user,
  updateCostPriceMap
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

  const purchaseRef = doc(db, 'purchases', purchaseId);
  const now = new Date().toISOString();

  // Execute Firestore Transaction
  await runTransaction(db, async (transaction) => {
    // 1. Read Purchase Doc
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

    const isPaidWithCash = (purchase.paymentStatus !== 'A_CANCELAR') && (purchase.fundSource === 'CASH' || !purchase.fundSource) && purchase.paymentMethod === 'EFECTIVO';
    const isPaidWithPersonal = purchase.fundSource === 'PERSONAL';
    const isToCancel = purchase.paymentStatus === 'A_CANCELAR';
    const isImmediate = purchase.isImmediateDelivery !== false;

    // Cash Availability Check (only if paying from cashier cash)
    if (isPaidWithCash) {
      if (!canPayWithCash) {
        throw new Error('No tienes permiso para autorizar pagos en efectivo desde la caja (cash.purchase_payment).');
      }
      const cashBalance = await getCashBalance(user.businessId);
      if (cashBalance < purchaseTotal) {
        const missing = purchaseTotal - cashBalance;
        throw new Error(
          `FONDOS_INSUFICIENTES: No hay suficiente efectivo en caja para realizar esta compra. Caja disponible: $${cashBalance.toLocaleString('es-AR')}, Total compra: $${purchaseTotal.toLocaleString('es-AR')}, Faltan: $${missing.toLocaleString('es-AR')}.`
        );
      }
    }

    // 2. Read Product Docs (for stock and/or costPrice updates)
    const productRefsAndData: Array<{
      ref: ReturnType<typeof doc>;
      item: PurchaseItem;
      data: any;
      shouldUpdateCost: boolean;
    }> = [];

    // Check inventory permissions if stock entry is needed
    if (isImmediate && !canEntryStock) {
      throw new Error('No tienes permiso para ingresar productos al stock (inventory.stock_entry).');
    }

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

      // Check whether cost price should be updated
      // Preference: map passed explicitly > item.updateCostPrice in purchase item > false
      let shouldUpdateCost = false;
      if (updateCostPriceMap && updateCostPriceMap[item.productId] !== undefined) {
        shouldUpdateCost = Boolean(updateCostPriceMap[item.productId]);
      } else if (item.updateCostPrice !== undefined) {
        shouldUpdateCost = Boolean(item.updateCostPrice);
      }

      productRefsAndData.push({
        ref: pRef,
        item,
        data: pData,
        shouldUpdateCost
      });
    }

    // 3. ATOMIC WRITES
    // A. Update Product Stocks and Cost Prices
    for (const { ref: pRef, item, data: pData, shouldUpdateCost } of productRefsAndData) {
      const productUpdates: Record<string, any> = {
        updatedAt: now
      };

      if (isImmediate) {
        const currentStock = Number(pData.stock) || 0;
        const newStock = currentStock + item.quantity;
        productUpdates.stock = newStock;

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

      if (shouldUpdateCost && Number(item.unitCost) > 0) {
        productUpdates.costPrice = Number(item.unitCost);
      }

      transaction.update(pRef, productUpdates);
    }

    // B. Create Cash Movement if paid with Cashier Cash
    let cashMovementId: string | undefined = undefined;
    if (isPaidWithCash) {
      const cashMovRef = doc(collection(db, 'cash_movements'));
      cashMovementId = cashMovRef.id;
      transaction.set(cashMovRef, {
        id: cashMovementId,
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
    }

    // C. Create Payment Obligation if A_CANCELAR
    let obligationId: string | undefined = undefined;
    if (isToCancel) {
      const oblRef = doc(collection(db, 'payment_obligations'));
      obligationId = oblRef.id;
      const supplier = (purchase.supplierName || 'Proveedor sin especificar').trim();

      transaction.set(oblRef, {
        id: obligationId,
        businessId: user.businessId,
        sourceType: 'PURCHASE',
        sourceId: purchaseId,
        sourceCode: `COM-${purchaseId.slice(0, 5).toUpperCase()}`,
        supplierName: supplier,
        beneficiary: supplier,
        category: 'Proveedores',
        description: `Compra directa de mercadería a cancelar (${purchase.items.length} productos)`,
        amount: purchaseTotal,
        pendingAmount: purchaseTotal,
        status: 'PENDING',
        paymentMethod: purchase.paymentMethod || 'EFECTIVO',
        fundSource: 'CASH',
        receiptNumber: purchase.receiptNumber || undefined,
        createdBy: user.uid,
        creatorName: user.displayName || user.email || 'Vendedor',
        createdAt: now,
        updatedAt: now
      });
    }

    // D. Update Purchase Document
    const totalUnits = purchase.items.reduce((s, i) => s + (Number(i.quantity) || 0), 0);
    const updatePayload: Record<string, any> = {
      status: 'CONFIRMED',
      confirmedBy: user.uid,
      confirmerName: user.displayName || user.email,
      confirmedAt: now,
      receivingStatus: isImmediate ? 'RECIBIDO' : 'PENDIENTE',
      receivedQuantity: isImmediate ? totalUnits : 0,
      updatedAt: now
    };

    if (cashMovementId) updatePayload.cashMovementId = cashMovementId;
    if (obligationId) updatePayload.obligationId = obligationId;

    transaction.update(purchaseRef, updatePayload);
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

export interface CancelPurchaseInput {
  purchaseId: string;
  businessId: string;
  reason: string;
  user: UserProfile;
}

/**
 * Formally cancels a confirmed purchase (Fase 2).
 * Atomic transaction:
 * 1. Validates status === 'CONFIRMED'.
 * 2. Reverts stock for products if stock was received (isImmediateDelivery or receiving confirmed),
 *    after verifying that current stock >= purchased/received quantity for all affected items.
 *    Throws clear error if stock is insufficient, preventing negative stock.
 *    Generates CANCELLATION inventory movement records with deterministic IDs.
 *    Does NOT modify products.costPrice or historical snapshots (CMV, SaleItem.unitCost, PurchaseItem.unitCost).
 * 3. Reverts financial impacts:
 *    - If CASH paid from business funds: creates compensatory PURCHASE_CANCELLATION cash movement.
 *    - If A_CANCELAR: cancels the associated payment obligation ONLY IF no payments have been registered.
 *      If partial or full payments exist, blocks cancellation with descriptive error.
 *    - If PERSONAL: no cash movement was generated, so no cash movement created.
 * 4. Updates purchase document status to CANCELLED with audit metadata (cancelledBy, cancellerName, cancelledAt, cancellationReason, cancelledReceivedQuantity).
 * 5. Cancels any linked draft receivings.
 * 6. Logs audit action.
 */
export async function cancelPurchaseTransaction(input: CancelPurchaseInput): Promise<void> {
  const { user } = input;
  if (!user || !user.uid || !user.businessId) {
    throw new Error('Usuario no autenticado.');
  }

  const cleanBusinessId = sanitizeString(input.businessId || user.businessId, 64);
  const cleanPurchaseId = sanitizeString(input.purchaseId, 64);
  const cleanReason = sanitizeString(input.reason, 300).trim();

  if (!cleanBusinessId || !cleanPurchaseId) {
    throw new Error('Identificador de compra o comercio inválido.');
  }

  if (!cleanReason || cleanReason.length < 3) {
    throw new Error('El motivo de anulación es obligatorio (mínimo 3 caracteres).');
  }

  // Permission check: only admin, super_admin or user with purchases.create permission
  const isAuthorized = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN' || hasPermission(user, 'purchases.create');
  if (!isAuthorized) {
    throw new Error('No tiene permisos para anular compras.');
  }

  const now = new Date().toISOString();

  // Query receivings linked to this purchase before running the transaction
  const receivingsQuery = query(
    collection(db, 'receivings'),
    where('businessId', '==', cleanBusinessId),
    where('purchaseId', '==', cleanPurchaseId)
  );
  const receivingsSnap = await getDocs(receivingsQuery);

  let totalStockActuallyReverted = 0;

  await runTransaction(db, async (transaction) => {
    const purchaseRef = doc(db, 'purchases', cleanPurchaseId);
    const purchaseSnap = await transaction.get(purchaseRef);

    if (!purchaseSnap.exists()) {
      throw new Error('La compra no existe.');
    }

    const purchase = purchaseSnap.data() as Purchase;

    if (purchase.businessId !== cleanBusinessId) {
      throw new Error('No tiene autorización sobre esta compra.');
    }

    if (purchase.status === 'CANCELLED') {
      throw new Error('Esta compra ya ha sido anulada previamente.');
    }

    if (purchase.status === 'DRAFT') {
      throw new Error('Las compras en borrador se deben eliminar, no anular.');
    }

    if (purchase.status !== 'CONFIRMED' && purchase.status !== undefined) {
      throw new Error(`No se puede anular una compra con estado "${purchase.status}".`);
    }

    const isImmediate = Boolean(purchase.isImmediateDelivery);
    const receivedQty = Number(purchase.receivedQuantity || 0);

    // Calculate quantity to revert per product
    const productQtyToRevertMap: Record<string, number> = {};

    if (isImmediate) {
      // Immediate delivery: full purchase quantity was entered into stock
      for (const item of purchase.items || []) {
        if (item.productId) {
          productQtyToRevertMap[item.productId] = (productQtyToRevertMap[item.productId] || 0) + (Number(item.quantity) || 0);
        }
      }
    } else {
      // Deferred delivery: check if any receivings were confirmed
      if (!receivingsSnap.empty) {
        for (const recDoc of receivingsSnap.docs) {
          const rData = recDoc.data();
          if (rData.status === 'CONFIRMED' && Array.isArray(rData.items)) {
            for (const it of rData.items) {
              if (it.productId) {
                const totalReceivedQty = Number(it.quantity) || 0;
                const treatment = it.surplusTreatment || rData.surplusTreatment;
                const surplusQty = Number(it.surplusQuantity) || 0;

                // When surplus was rejected (treatment === 'REJECT'), surplus units were returned to provider
                // upon receipt and never entered physical stock. Revert only what was physically incorporated.
                let actualQtyEntered = totalReceivedQty;
                if (treatment === 'REJECT' && surplusQty > 0) {
                  actualQtyEntered = Math.max(0, totalReceivedQty - surplusQty);
                } else if (treatment === 'REJECT' && it.requestedQuantity !== undefined && totalReceivedQty > it.requestedQuantity) {
                  actualQtyEntered = Math.max(0, Number(it.requestedQuantity));
                }

                productQtyToRevertMap[it.productId] = (productQtyToRevertMap[it.productId] || 0) + actualQtyEntered;
              }
            }
          }
        }
      } else if (receivedQty > 0 && Array.isArray(purchase.items) && purchase.items.length > 0) {
        // Fallback if receiving docs are missing but purchase doc recorded receivedQuantity
        const purchaseSurplusTreatment = (purchase as any).surplusTreatment;
        const purchaseSurplusUnits = Number((purchase as any).surplusUnits || 0);

        let effectiveReceivedQty = receivedQty;
        if (purchaseSurplusTreatment === 'REJECT' && purchaseSurplusUnits > 0) {
          effectiveReceivedQty = Math.max(0, effectiveReceivedQty - purchaseSurplusUnits);
        }

        if (purchase.items.length === 1) {
          productQtyToRevertMap[purchase.items[0].productId] = effectiveReceivedQty;
        } else {
          let remaining = effectiveReceivedQty;
          for (const it of purchase.items) {
            const pSurplus = (it as any).surplusTreatment === 'REJECT' ? (Number((it as any).surplusQuantity) || 0) : 0;
            const maxQty = Math.max(0, (Number(it.quantity) || 0) - pSurplus);
            const qty = Math.min(maxQty, remaining);
            productQtyToRevertMap[it.productId] = qty;
            remaining -= qty;
          }
        }
      }
      // If receivedQty === 0 and no confirmed receivings: productQtyToRevertMap stays empty (0 stock to revert)
    }

    // 1. Stock verification and reversion
    const productIdsToRevert = Object.keys(productQtyToRevertMap).filter(pid => (productQtyToRevertMap[pid] || 0) > 0);

    if (productIdsToRevert.length > 0) {
      // Step 1a: READ and VERIFY all products first (mandatory before any writes)
      const productSnaps: Array<{ pRef: any; pData: any; item: PurchaseItem; qtyToRevert: number }> = [];

      for (const productId of productIdsToRevert) {
        const qtyToRevert = productQtyToRevertMap[productId];
        const item = (purchase.items || []).find(i => i.productId === productId) || {
          productId,
          productName: 'Producto',
          quantity: qtyToRevert,
          unitCost: 0,
          subtotal: 0
        };

        const pRef = doc(db, 'products', productId);
        const pSnap = await transaction.get(pRef);

        if (!pSnap.exists()) {
          throw new Error(`El producto "${item.productName || productId}" ya no existe en el catálogo.`);
        }

        const pData = pSnap.data();
        const currentStock = Number(pData.stock) || 0;

        if (pData.tracksStock !== false && currentStock < qtyToRevert) {
          throw new Error(
            `No es posible anular la compra. Stock insuficiente para el producto "${pData.name || item.productName}". Disponible: ${currentStock}, a descontar: ${qtyToRevert}.`
          );
        }

        productSnaps.push({ pRef, pData, item, qtyToRevert });
      }

      // Step 1b: All stocks verified! Now apply deductions and create inventory movements with deterministic IDs
      for (const { pRef, pData, item, qtyToRevert } of productSnaps) {
        const currentStock = Number(pData.stock) || 0;
        const newStock = Math.max(0, currentStock - qtyToRevert);
        totalStockActuallyReverted += qtyToRevert;

        // Update product stock (Product.costPrice is NOT modified!)
        transaction.update(pRef, {
          stock: newStock,
          updatedAt: now
        });

        // Deterministic ID for idempotent inventory movement
        const invMovRef = doc(db, 'inventory_movements', `inv_cancel_${cleanPurchaseId}_${item.productId}`);
        transaction.set(invMovRef, {
          id: invMovRef.id,
          businessId: cleanBusinessId,
          productId: item.productId,
          productName: item.productName || pData.name,
          type: 'CANCELLATION',
          quantity: -qtyToRevert,
          previousStock: currentStock,
          newStock: newStock,
          reason: `Anulación de compra: ${cleanReason}`,
          createdAt: now,
          userId: user.uid,
          userName: user.displayName || user.email || 'Usuario',
          supplierName: purchase.supplierName || 'Proveedor',
          purchaseId: cleanPurchaseId
        });
      }
    }

    // Cancel any linked draft receivings so they cannot be confirmed after purchase cancellation
    for (const recDoc of receivingsSnap.docs) {
      const rData = recDoc.data();
      if (rData.status === 'DRAFT') {
        transaction.update(recDoc.ref, {
          status: 'CANCELLED',
          updatedAt: now
        });
      }
    }

    // 2. Financial Reversion
    const purchaseTotal = Number(purchase.total || purchase.amount || 0);
    const isPaidWithCash = purchase.paymentStatus === 'PAGADO' && purchase.fundSource === 'CASH' && purchase.paymentMethod === 'EFECTIVO';
    const isToCancel = purchase.paymentStatus === 'A_CANCELAR';

    // A. Revert Cash if paid with Cashier Cash (Deterministic ID)
    if (isPaidWithCash && purchaseTotal > 0) {
      const cashMovRef = doc(db, 'cash_movements', `cm_cancel_${cleanPurchaseId}`);
      transaction.set(cashMovRef, {
        id: cashMovRef.id,
        businessId: cleanBusinessId,
        type: 'PURCHASE_CANCELLATION',
        amount: purchaseTotal, // Positive compensatory amount to reimburse cash balance
        referenceId: cleanPurchaseId,
        purchaseId: cleanPurchaseId,
        originalCashMovementId: purchase.cashMovementId || undefined,
        supplierName: purchase.supplierName || '',
        description: `Anulación de compra - Reintegro a caja: ${purchase.supplierName || 'Proveedor'} (Motivo: ${cleanReason})`,
        paymentMethod: 'EFECTIVO',
        createdBy: user.uid,
        creatorName: user.displayName || user.email || 'Usuario',
        createdAt: now
      });
    }

    // B. Revert Payment Obligation if A_CANCELAR
    if (isToCancel) {
      const targetObligationId = purchase.obligationId;
      
      if (targetObligationId) {
        const oblRef = doc(db, 'payment_obligations', targetObligationId);
        const oblSnap = await transaction.get(oblRef);
        if (oblSnap.exists()) {
          const oblData = oblSnap.data();
          const pending = Number(oblData.pendingAmount ?? oblData.amount ?? 0);
          const original = Number(oblData.amount ?? 0);

          if (oblData.status === 'PAID' || pending < original) {
            throw new Error('Esta compra tiene pagos registrados. La anulación requiere resolver primero los pagos asociados.');
          }

          if (oblData.status === 'PENDING') {
            transaction.update(oblRef, {
              status: 'CANCELLED',
              cancellationReason: `Anulación de compra: ${cleanReason}`,
              updatedAt: now
            });
          }
        }
      }
    }

    // 3. Update Purchase Document
    transaction.update(purchaseRef, {
      status: 'CANCELLED',
      receivingStatus: 'CANCELLED',
      cancelledBy: user.uid,
      cancellerName: user.displayName || user.email || 'Usuario',
      cancelledAt: now,
      cancellationReason: cleanReason,
      cancelledReceivedQuantity: totalStockActuallyReverted,
      updatedAt: now
    });
  });

  // 4. Log Admin Audit Action
  try {
    await logAdminAction({
      businessId: cleanBusinessId,
      adminId: user.uid,
      adminEmail: user.email || user.displayName || 'Usuario',
      targetUserId: user.uid,
      action: 'PURCHASE_CANCELLED',
      details: `Compra #${cleanPurchaseId.slice(0, 6).toUpperCase()} anulada. Motivo: ${cleanReason} (Stock revertido: ${totalStockActuallyReverted} u.)`
    });
  } catch (auditErr) {
    console.warn('[purchaseService] Error logging audit action for purchase cancellation:', auditErr);
  }

  // 5. Update local offline snapshot if cached
  try {
    const local = await localDataStore.getOfflinePurchaseById(cleanPurchaseId);
    if (local) {
      await localDataStore.saveOfflinePurchase({
        ...local,
        status: 'CANCELLED',
        receivingStatus: 'CANCELLED',
        cancelledBy: user.uid,
        cancellerName: user.displayName || user.email || 'Usuario',
        cancelledAt: now,
        cancellationReason: cleanReason,
        cancelledReceivedQuantity: totalStockActuallyReverted,
        updatedAt: now
      });
    }
  } catch (locErr) {
    console.warn('[purchaseService] Error updating local offline purchase snapshot:', locErr);
  }
}

/**
 * High-level cancellation function supporting both Online and Offline modes.
 */
export async function cancelPurchase(input: CancelPurchaseInput): Promise<{
  success: boolean;
  offline?: boolean;
}> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    await cancelPurchaseTransaction(input);
    return { success: true, offline: false };
  }

  // Offline cancellation
  const cleanBusinessId = sanitizeString(input.businessId || input.user.businessId, 64);
  const cleanPurchaseId = sanitizeString(input.purchaseId, 64);
  const cleanReason = sanitizeString(input.reason, 300).trim();

  if (!cleanBusinessId || !cleanPurchaseId) {
    throw new Error('Identificador de compra o comercio inválido.');
  }
  if (!cleanReason || cleanReason.length < 3) {
    throw new Error('El motivo de anulación es obligatorio (mínimo 3 caracteres).');
  }

  // Check local stock if available to avoid impossible cancellations
  const localPurchase = await localDataStore.getOfflinePurchaseById(cleanPurchaseId);
  if (localPurchase) {
    if (localPurchase.status === 'CANCELLED') {
      throw new Error('Esta compra ya ha sido anulada previamente.');
    }
    // If immediate delivery or received, check local products stock
    if (localPurchase.isImmediateDelivery && Array.isArray(localPurchase.items)) {
      const localProducts = await localDataStore.getProductsByBusiness(cleanBusinessId);
      const prodMap = new Map(localProducts.map(p => [p.id, p]));
      for (const item of localPurchase.items) {
        const p = prodMap.get(item.productId);
        if (p && p.tracksStock !== false) {
          const curStock = Number(p.stock) || 0;
          const qty = Number(item.quantity) || 0;
          if (curStock < qty) {
            throw new Error(`No es posible anular la compra. Stock insuficiente para el producto "${p.name || item.productName}". Disponible: ${curStock}, a descontar: ${qty}.`);
          }
        }
      }
    }
  }

  const operationId = `op_cancel_${cleanPurchaseId}`;
  const now = new Date().toISOString();

  // Save Outbox operation with deterministic ID
  const outboxOp: OutboxOperation = {
    operationId,
    operationType: 'CANCEL_PURCHASE',
    businessId: cleanBusinessId,
    purchaseId: cleanPurchaseId,
    userId: input.user.uid,
    userName: input.user.displayName || input.user.email || 'Usuario',
    deviceId: getDeviceId(),
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    syncedAt: null,
    version: 1,
    payload: {
      purchaseId: cleanPurchaseId,
      businessId: cleanBusinessId,
      reason: cleanReason,
      user: {
        uid: input.user.uid,
        email: input.user.email,
        displayName: input.user.displayName,
        businessId: cleanBusinessId,
        role: input.user.role,
        permissions: input.user.permissions
      }
    }
  };

  await localDataStore.saveOutboxOperation(outboxOp);

  // Update local purchase record
  if (localPurchase) {
    await localDataStore.saveOfflinePurchase({
      ...localPurchase,
      status: 'CANCELLED',
      receivingStatus: 'CANCELLED',
      cancelledBy: input.user.uid,
      cancellerName: input.user.displayName || input.user.email || 'Usuario',
      cancelledAt: now,
      cancellationReason: cleanReason,
      syncStatus: 'PENDING',
      updatedAt: now
    });
  }

  return { success: true, offline: true };
}

/**
 * Synchronizes an offline CANCEL_PURCHASE outbox operation with Firestore.
 * Idempotent: If purchase is already CANCELLED in Firestore, returns SYNCED directly.
 */
export async function syncCancelPurchaseOperationToFirestore(op: OutboxOperation): Promise<{
  success: boolean;
  status: 'SYNCED' | 'STOCK_CONFLICT' | 'ERROR';
  error?: string;
}> {
  const payload = op.payload || {};
  const purchaseId = op.purchaseId || payload.purchaseId;
  const businessId = op.businessId || payload.businessId;
  const reason = payload.reason || 'Anulación sincronizada desde Outbox';
  const user = payload.user || {
    uid: op.userId || 'offline_user',
    displayName: op.userName || 'Usuario',
    email: op.userName || 'offline@uwi.local',
    businessId,
    role: 'ADMIN'
  };

  if (!purchaseId || !businessId) {
    return { success: false, status: 'ERROR', error: 'Datos insuficientes para anular la compra.' };
  }

  return withActionLock(`sync_cancel_purchase_${purchaseId}`, async () => {
    try {
      // Check idempotency first: if already cancelled in Firestore, mark SYNCED
      const purchaseRef = doc(db, 'purchases', purchaseId);
      const purchaseSnap = await getDoc(purchaseRef);
      if (purchaseSnap.exists()) {
        const data = purchaseSnap.data() as Purchase;
        if (data.status === 'CANCELLED') {
          return { success: true, status: 'SYNCED' };
        }
      }

      await cancelPurchaseTransaction({
        purchaseId,
        businessId,
        reason,
        user
      });

      return { success: true, status: 'SYNCED' };
    } catch (err: any) {
      console.error(`[purchaseService] Error sincronizando anulación de compra ${purchaseId}:`, err);
      const errMsg = err?.message || 'Error al anular compra';
      if (errMsg.toLowerCase().includes('stock') || errMsg.toLowerCase().includes('disponible')) {
        return { success: false, status: 'STOCK_CONFLICT', error: errMsg };
      }
      return { success: false, status: 'ERROR', error: errMsg };
    }
  });
}

/**
 * Creates an offline purchase and persists it locally along with an Outbox operation.
 */
export async function createOfflinePurchase(
  businessId: string,
  user: UserProfile,
  purchaseData: Omit<Purchase, 'id' | 'businessId' | 'status' | 'createdAt' | 'createdBy' | 'creatorName'>
): Promise<Purchase> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) throw new Error('businessId es requerido');

  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const purchaseId = `pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const operationId = `op_pur_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const total = sanitizeNumber(purchaseData.total, 0, 999999999, 0);
  const isImmediate = Boolean(purchaseData.isImmediateDelivery);
  const totalUnits = (purchaseData.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);

  const localPurchase: Purchase = {
    id: purchaseId,
    businessId: cleanBusinessId,
    supplierName: purchaseData.supplierName?.trim() || undefined,
    hasReceipt: Boolean(purchaseData.hasReceipt),
    receiptNumber: purchaseData.receiptNumber?.trim() || undefined,
    items: purchaseData.items || [],
    total,
    paymentMethod: purchaseData.paymentMethod || 'EFECTIVO',
    status: 'CONFIRMED',
    paymentStatus: purchaseData.paymentStatus || 'PAGADO',
    fundSource: purchaseData.fundSource || 'CASH',
    receivingStatus: isImmediate ? 'RECIBIDO' : 'PENDIENTE',
    receivedQuantity: isImmediate ? totalUnits : 0,
    isImmediateDelivery: isImmediate,
    createdBy: user.uid,
    creatorName: user.displayName || user.email || 'Usuario',
    createdAt: now,
    confirmedBy: user.uid,
    confirmerName: user.displayName || user.email || 'Usuario',
    confirmedAt: now,
    syncStatus: 'PENDING',
    syncMode: 'OFFLINE',
    syncedAt: null,
    deviceId,
    outboxOperationId: operationId
  };

  const payload: ProcessPurchasePayload = {
    businessId: cleanBusinessId,
    purchaseId,
    userId: user.uid,
    creatorName: user.displayName || user.email || 'Usuario',
    supplierName: purchaseData.supplierName?.trim() || undefined,
    hasReceipt: Boolean(purchaseData.hasReceipt),
    receiptNumber: purchaseData.receiptNumber?.trim() || undefined,
    items: purchaseData.items || [],
    total,
    paymentMethod: purchaseData.paymentMethod || 'EFECTIVO',
    paymentStatus: purchaseData.paymentStatus || 'PAGADO',
    fundSource: purchaseData.fundSource || 'CASH',
    isImmediateDelivery: isImmediate,
    createdAt: now,
    deviceId
  };

  const outboxOp: OutboxOperation = {
    operationId,
    operationType: 'PURCHASE',
    businessId: cleanBusinessId,
    userId: user.uid,
    userName: user.displayName || user.email || 'Usuario',
    deviceId,
    purchaseId,
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    payload,
    purchaseSnapshot: localPurchase,
    version: 1,
    syncedAt: null
  };

  await localDataStore.createOfflinePurchaseTransaction(cleanBusinessId, localPurchase, outboxOp);
  return localPurchase;
}

/**
 * Synchronizes an offline purchase OutboxOperation to Firestore atomically and idempotently.
 */
export async function syncPurchaseOperationToFirestore(op: OutboxOperation): Promise<{
  success: boolean;
  status: 'SYNCED' | 'STOCK_CONFLICT' | 'ERROR';
  error?: string;
}> {
  const purchase = op.purchaseSnapshot || (op.payload as any as Purchase);
  if (!purchase || !purchase.id || !purchase.businessId) {
    return {
      success: false,
      status: 'ERROR',
      error: 'Operación de compra inválida o sin snapshot.'
    };
  }

  const purchaseId = purchase.id;
  const cleanBusinessId = sanitizeString(purchase.businessId, 64);
  const now = new Date().toISOString();

  return withActionLock(`sync_purchase_${purchaseId}`, async () => {
    try {
      const purchaseRef = doc(db, 'purchases', purchaseId);

      // Check idempotency: If purchase is already CONFIRMED in Firestore, just mark local SYNCED
      const existingSnap = await getDoc(purchaseRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as Purchase;
        if (existingData.status === 'CONFIRMED') {
          await localDataStore.saveOfflinePurchase({
            ...purchase,
            id: purchaseId,
            syncStatus: 'SYNCED',
            syncedAt: now,
            syncError: undefined
          });
          return { success: true, status: 'SYNCED' };
        }
      }

      await runTransaction(db, async (transaction) => {
        const isPaidWithCash = purchase.paymentStatus === 'PAGADO' && purchase.fundSource === 'CASH' && purchase.paymentMethod === 'EFECTIVO';
        const isToCancel = purchase.paymentStatus === 'A_CANCELAR';
        const isImmediate = Boolean(purchase.isImmediateDelivery);
        const purchaseTotal = Number(purchase.total || 0);

        let cashMovementId: string | undefined = undefined;
        let obligationId: string | undefined = undefined;

        // 1. Stock and CostPrice updates, and movements if immediate delivery
        if (Array.isArray(purchase.items) && purchase.items.length > 0) {
          for (const item of purchase.items) {
            if (!item.productId) continue;
            const pRef = doc(db, 'products', item.productId);
            const pSnap = await transaction.get(pRef);
            if (pSnap.exists()) {
              const pData = pSnap.data();
              const productUpdates: Record<string, any> = { updatedAt: now };

              if (isImmediate) {
                const currentStock = Number(pData.stock) || 0;
                const newStock = currentStock + (Number(item.quantity) || 0);
                productUpdates.stock = newStock;

                const invMovRef = doc(collection(db, 'inventory_movements'));
                transaction.set(invMovRef, {
                  id: invMovRef.id,
                  businessId: cleanBusinessId,
                  productId: item.productId,
                  productName: item.productName || pData.name,
                  type: 'PURCHASE',
                  quantity: item.quantity,
                  previousStock: currentStock,
                  newStock: newStock,
                  reason: `Compra directa offline sincronizada: ${purchase.supplierName || 'Proveedor'}`,
                  createdAt: now,
                  userId: op.userId,
                  purchaseId: purchaseId
                });
              }

              if (item.updateCostPrice && Number(item.unitCost) > 0) {
                productUpdates.costPrice = Number(item.unitCost);
              }

              transaction.update(pRef, productUpdates);
            }
          }
        }

        // 2. Cash movement if paid with cash
        if (isPaidWithCash && purchaseTotal > 0) {
          const cashMovRef = doc(collection(db, 'cash_movements'));
          cashMovementId = cashMovRef.id;
          transaction.set(cashMovRef, {
            id: cashMovementId,
            businessId: cleanBusinessId,
            type: 'PURCHASE_PAYMENT',
            amount: -purchaseTotal,
            referenceId: purchaseId,
            purchaseId: purchaseId,
            supplierName: purchase.supplierName || '',
            description: `Compra directa offline sincronizada - ${purchase.supplierName || 'Proveedor'}`,
            paymentMethod: purchase.paymentMethod || 'EFECTIVO',
            createdBy: op.userId,
            creatorName: op.userName,
            createdAt: now
          });
        }

        // 3. Payment Obligation if A_CANCELAR (Unique financial obligation created for purchase)
        if (isToCancel && purchaseTotal > 0) {
          const oblRef = doc(collection(db, 'payment_obligations'));
          obligationId = oblRef.id;
          const supplier = (purchase.supplierName || 'Proveedor sin especificar').trim();

          transaction.set(oblRef, {
            id: obligationId,
            businessId: cleanBusinessId,
            sourceType: 'PURCHASE',
            sourceId: purchaseId,
            sourceCode: `COM-${purchaseId.slice(0, 5).toUpperCase()}`,
            supplierName: supplier,
            beneficiary: supplier,
            category: 'Proveedores',
            description: `Compra directa de mercadería a cancelar (${purchase.items.length} productos)`,
            amount: purchaseTotal,
            pendingAmount: purchaseTotal,
            status: 'PENDING',
            paymentMethod: purchase.paymentMethod || 'EFECTIVO',
            fundSource: 'CASH',
            receiptNumber: purchase.receiptNumber || undefined,
            createdBy: op.userId,
            creatorName: op.userName || 'Usuario',
            createdAt: now,
            updatedAt: now
          });
        }

        // 4. Set Purchase doc
        const totalUnits = (purchase.items || []).reduce((s, i) => s + (Number(i.quantity) || 0), 0);
        const purchaseDocPayload: Record<string, any> = {
          id: purchaseId,
          businessId: cleanBusinessId,
          supplierName: purchase.supplierName || undefined,
          hasReceipt: Boolean(purchase.hasReceipt),
          receiptNumber: purchase.receiptNumber || undefined,
          items: purchase.items || [],
          total: purchaseTotal,
          paymentMethod: purchase.paymentMethod || 'EFECTIVO',
          status: 'CONFIRMED',
          paymentStatus: purchase.paymentStatus || 'PAGADO',
          fundSource: purchase.fundSource || 'CASH',
          receivingStatus: isImmediate ? 'RECIBIDO' : 'PENDIENTE',
          receivedQuantity: isImmediate ? totalUnits : 0,
          isImmediateDelivery: isImmediate,
          createdBy: purchase.createdBy || op.userId,
          creatorName: purchase.creatorName || op.userName,
          createdAt: purchase.createdAt || now,
          confirmedBy: op.userId,
          confirmerName: op.userName,
          confirmedAt: now,
          updatedAt: now,
          deviceId: op.deviceId,
          syncedAt: now
        };

        if (cashMovementId) purchaseDocPayload.cashMovementId = cashMovementId;
        if (obligationId) purchaseDocPayload.obligationId = obligationId;

        transaction.set(purchaseRef, purchaseDocPayload, { merge: true });
      });

      // Update local record to SYNCED
      await localDataStore.saveOfflinePurchase({
        ...purchase,
        id: purchaseId,
        syncStatus: 'SYNCED',
        syncedAt: now,
        syncError: undefined
      });

      return { success: true, status: 'SYNCED' };
    } catch (err: any) {
      console.error(`[purchaseService] Error sincronizando compra ${purchaseId}:`, err);
      const errMsg = err?.message || 'Error desconocido al sincronizar compra';
      await localDataStore.saveOfflinePurchase({
        ...purchase,
        id: purchaseId,
        syncStatus: 'ERROR',
        syncError: errMsg
      });
      return { success: false, status: 'ERROR', error: errMsg };
    }
  });
}
