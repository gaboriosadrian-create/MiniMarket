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
import { Receiving, ReceivingItem, ReceivingStatus, InventoryMovement, ReplenishmentList, OutboxOperation, Purchase, PaymentObligation } from '../types';
import { logAdminAction } from './auditService';
import { createNotification } from './notificationService';
import { updatePublicOrderStatus, getPublicOrder } from './publicOrderService';
import { withActionLock } from './rateLimit';
import { sanitizeInteger, sanitizeNumber, sanitizeString, sanitizeBarcode, cleanFirestoreData } from './securityUtils';
import { formatRequestCode } from './replenishmentPdf';
import { localDataStore } from './localDataStore';
import { getDeviceId, generateOperationId } from './deviceId';

/**
 * Get pending purchases created by Admin or with pending deliveries available for receiving
 */
export async function getPendingAdminPurchasesForReceiving(businessId: string): Promise<any[]> {
  try {
    const q = query(
      collection(db, 'purchases'),
      where('businessId', '==', businessId),
      where('status', '==', 'CONFIRMED')
    );
    const snap = await getDocs(q);
    const list: any[] = [];
    snap.forEach(docSnap => {
      const p = { id: docSnap.id, ...docSnap.data() } as any;
      if (p.receivingStatus === 'PENDIENTE' || p.receivingStatus === 'PARCIAL') {
        list.push(p);
      }
    });
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (err) {
    console.warn('[receivingService] Error fetching pending admin purchases:', err);
    return [];
  }
}

/**
 * Get active draft receiving linked to a purchase ID
 */
export async function getDraftReceivingByPurchase(
  businessId: string,
  purchaseId: string
): Promise<Receiving | null> {
  try {
    const q = query(
      collection(db, 'receivings'),
      where('businessId', '==', businessId),
      where('purchaseId', '==', purchaseId),
      where('status', '==', 'DRAFT')
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Receiving));
    return docs[0];
  } catch (error) {
    console.error('Error fetching draft receiving by purchase ID:', error);
    return null;
  }
}

/**
 * Creates a draft receiving pre-loaded from an Admin Purchase
 */
export async function createDraftReceivingFromPurchase(
  businessId: string,
  userId: string,
  creatorName: string,
  purchase: any,
  deliveryNoteNumber?: string
): Promise<Receiving> {
  const cleanDeliveryNote = deliveryNoteNumber ? sanitizeString(deliveryNoteNumber.trim(), 64) : '';
  const cleanSupplierName = sanitizeString(purchase.supplierName?.trim() || 'Proveedor sin especificar', 100);
  const cleanCreatorName = sanitizeString(creatorName?.trim() || 'Vendedor', 100);
  const now = new Date().toISOString();

  // Check if a DRAFT receiving already exists for this purchase
  const existingDraft = await getDraftReceivingByPurchase(businessId, purchase.id);
  if (existingDraft) {
    if (cleanDeliveryNote && (!existingDraft.deliveryNoteNumber || existingDraft.deliveryNoteNumber !== cleanDeliveryNote)) {
      await updateDoc(doc(db, 'receivings', existingDraft.id), cleanFirestoreData({
        hasDeliveryNote: true,
        deliveryNoteNumber: cleanDeliveryNote,
        updatedAt: now
      }));
      existingDraft.hasDeliveryNote = true;
      existingDraft.deliveryNoteNumber = cleanDeliveryNote;
    }
    return existingDraft;
  }

  const receivingRef = doc(collection(db, 'receivings'));

  // Calculate items considering partial previous deliveries if any
  const items: ReceivingItem[] = (purchase.items || []).map((item: any) => {
    const purchased = sanitizeInteger(item.quantity, 1, 999999, 1);
    const prevReceived = sanitizeInteger(item.receivedQuantity || 0, 0, 999999, 0);
    const remaining = Math.max(0, purchased - prevReceived);
    const initialQty = remaining > 0 ? remaining : purchased;

    return {
      productId: item.productId,
      productName: sanitizeString(item.productName || 'Producto sin nombre', 150),
      barcode: sanitizeBarcode(item.barcode),
      category: item.category ? sanitizeString(item.category, 64) : undefined,
      requestedQuantity: initialQty,
      purchasedQuantity: purchased,
      receivedQuantity: initialQty,
      quantity: initialQty,
      currentStockAtScan: 0,
      unitCost: item.unitCost
    };
  });

  const rawReceiving: Record<string, any> = {
    id: receivingRef.id,
    businessId,
    supplierName: cleanSupplierName,
    hasDeliveryNote: Boolean(cleanDeliveryNote),
    deliveryNoteNumber: cleanDeliveryNote,
    status: 'DRAFT',
    originType: 'PURCHASE',
    purchaseId: purchase.id,
    purchaseCode: `COM-${purchase.id.slice(0, 5).toUpperCase()}`,
    paymentStatus: purchase.paymentStatus || 'PAGADO',
    paymentMethod: purchase.paymentMethod || 'EFECTIVO',
    fundSource: purchase.fundSource || 'PERSONAL',
    obligationId: purchase.obligationId || undefined,
    totalAmount: purchase.total || 0,
    originalCommittedAmount: purchase.total || 0,
    items,
    totalProductsCount: items.length,
    totalUnitsCount: items.reduce((sum, item) => sum + item.quantity, 0),
    createdBy: userId,
    creatorName: cleanCreatorName,
    createdAt: now,
    updatedAt: now
  };

  const cleanDoc = cleanFirestoreData(rawReceiving);
  await setDoc(receivingRef, cleanDoc);
  return cleanDoc as Receiving;
}

/**
 * Creates a confirmed receiving directly (Online or Offline with Outbox fallback)
 */
export async function createConfirmedReceivingDirectly(
  businessId: string,
  userId: string,
  creatorName: string,
  items: ReceivingItem[],
  supplierName?: string,
  hasDeliveryNote: boolean = false,
  deliveryNoteNumber?: string,
  replenishmentId?: string,
  replenishmentCode?: string,
  extraOptions?: {
    originType?: 'PURCHASE' | 'ADMIN_DELIVERY' | 'MANUAL';
    purchaseId?: string;
    purchaseCode?: string;
    paymentStatus?: 'PAGADO' | 'A_CANCELAR';
    paymentMethod?: any;
    fundSource?: any;
    totalAmount?: number;
    hasDifference?: boolean;
    differenceNotes?: string;
    manualReason?: string;
  }
): Promise<Receiving> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    return createOfflineReceiving(
      businessId,
      userId,
      creatorName,
      items,
      supplierName,
      hasDeliveryNote,
      deliveryNoteNumber,
      replenishmentId,
      replenishmentCode
    );
  }

  try {
    const draft = await createDraftReceiving(businessId, userId, creatorName, supplierName, hasDeliveryNote, deliveryNoteNumber);
    await updateReceivingDraft(draft.id, items, userId, businessId, true);
    await confirmReceivingTransaction(draft.id, businessId, userId, creatorName, true);

    const confirmedRcv: Receiving = {
      ...draft,
      items,
      status: 'CONFIRMED',
      confirmedBy: userId,
      confirmerName: creatorName,
      confirmedAt: new Date().toISOString(),
      syncStatus: 'SYNCED',
      syncMode: 'ONLINE'
    };

    try {
      await localDataStore.saveOfflineReceiving(confirmedRcv);
    } catch (e) {
      console.warn('[receivingService] Error guardando copia local de recepción online:', e);
    }
    return confirmedRcv;
  } catch (err: any) {
    console.warn('[receivingService] Falló confirmación online de recepción. Pasando a Outbox offline:', err);
    return createOfflineReceiving(
      businessId,
      userId,
      creatorName,
      items,
      supplierName,
      hasDeliveryNote,
      deliveryNoteNumber,
      replenishmentId,
      replenishmentCode
    );
  }
}

/**
 * Creates an offline confirmed receiving and registers the operation in the Outbox
 */
export async function createOfflineReceiving(
  businessId: string,
  userId: string,
  creatorName: string,
  items: ReceivingItem[],
  supplierName?: string,
  hasDeliveryNote: boolean = false,
  deliveryNoteNumber?: string,
  replenishmentId?: string,
  replenishmentCode?: string
): Promise<Receiving> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const operationId = generateOperationId();
  const receivingId = `rcv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Consolidate duplicate items
  const consolidatedMap = new Map<string, ReceivingItem>();
  for (const rawItem of items) {
    if (!rawItem.productId || typeof rawItem.productId !== 'string') continue;
    const qty = sanitizeInteger(rawItem.quantity, 0, 999999, 0);

    const reqQty = rawItem.requestedQuantity !== undefined && Number.isFinite(Number(rawItem.requestedQuantity))
      ? sanitizeInteger(rawItem.requestedQuantity, 0, 999999, 0)
      : undefined;

    const existing = consolidatedMap.get(rawItem.productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      consolidatedMap.set(rawItem.productId, {
        ...rawItem,
        requestedQuantity: reqQty,
        quantity: qty
      });
    }
  }

  const cleanedItems = Array.from(consolidatedMap.values());
  if (cleanedItems.length === 0) {
    throw new Error('La recepción debe contener al menos un producto para ingresar.');
  }

  const totalProductsCount = cleanedItems.length;
  const totalUnitsCount = cleanedItems.reduce((sum, item) => sum + item.quantity, 0);

  const localReceiving: Receiving = {
    id: receivingId,
    businessId: cleanBusinessId,
    supplierName: supplierName?.trim() || 'Proveedor sin especificar',
    hasDeliveryNote,
    deliveryNoteNumber: hasDeliveryNote ? (deliveryNoteNumber?.trim() || '') : '',
    status: 'CONFIRMED',
    items: cleanedItems,
    totalProductsCount,
    totalUnitsCount,
    createdBy: userId,
    creatorName: creatorName || 'Vendedor',
    confirmedBy: userId,
    confirmerName: creatorName || 'Vendedor',
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
    replenishmentId,
    replenishmentCode,
    syncStatus: 'PENDING',
    syncMode: 'OFFLINE',
    syncedAt: null,
    deviceId,
    outboxOperationId: operationId
  };

  const outboxOp: OutboxOperation = {
    operationId,
    operationType: 'RECEIVING',
    businessId: cleanBusinessId,
    userId,
    userName: creatorName || 'Vendedor',
    deviceId,
    receivingId,
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    payload: {
      businessId: cleanBusinessId,
      receivingId,
      supplierName: localReceiving.supplierName,
      hasDeliveryNote,
      deliveryNoteNumber: localReceiving.deliveryNoteNumber,
      items: cleanedItems,
      totalProductsCount,
      totalUnitsCount,
      createdBy: userId,
      creatorName,
      confirmedBy: userId,
      confirmerName: creatorName,
      confirmedAt: now,
      createdAt: now,
      replenishmentId,
      replenishmentCode,
      deviceId
    },
    receivingSnapshot: localReceiving,
    version: 1,
    syncedAt: null
  };

  await localDataStore.createOfflineReceivingTransaction(cleanBusinessId, localReceiving, outboxOp);
  return localReceiving;
}

/**
 * Idempotent synchronization of an offline receiving to Firestore
 */
export async function syncReceivingOperationToFirestore(
  op: OutboxOperation
): Promise<{ success: boolean; status: 'SYNCED' | 'ERROR'; error?: string }> {
  if (op.operationType !== 'RECEIVING' || !op.receivingSnapshot) {
    return { success: false, status: 'ERROR', error: 'Operación de recepción no válida.' };
  }

  const rcv = op.receivingSnapshot;
  const receivingId = op.receivingId || rcv.id || op.operationId;
  const cleanBusinessId = sanitizeString(op.businessId, 64);
  const now = new Date().toISOString();

  return withActionLock(`sync_rcv_${receivingId}`, async () => {
    try {
      const receivingRef = doc(db, 'receivings', receivingId);

      // 1. Idempotency check: if already CONFIRMED in Firestore, consider it already synced
      const existingSnap = await getDoc(receivingRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as Receiving;
        if (existingData.status === 'CONFIRMED') {
          await localDataStore.saveOfflineReceiving({
            ...rcv,
            id: receivingId,
            syncStatus: 'SYNCED',
            syncedAt: now,
            syncError: undefined
          });
          return { success: true, status: 'SYNCED' };
        }
      }

      // 2. Perform atomic transaction on Firestore
      await runTransaction(db, async (transaction) => {
        const itemsToProcess = rcv.items || [];
        if (itemsToProcess.length === 0) {
          throw new Error('La recepción no contiene productos.');
        }

        const productSnaps = await Promise.all(
          itemsToProcess.map((item) => transaction.get(doc(db, 'products', item.productId)))
        );

        const movementsToCreate: InventoryMovement[] = [];
        const processedItems: ReceivingItem[] = [];

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          const productSnap = productSnaps[i];

          if (!productSnap.exists()) {
            throw new Error(`El producto "${item.productName}" no existe en Firestore.`);
          }

          const productData = productSnap.data();
          const previousStock = Number(productData.stock) || 0;
          const addedQty = Number(item.quantity) || 0;

          if (addedQty > 0) {
            const newStock = previousStock + addedQty;

            // Increment product stock
            const productRef = doc(db, 'products', item.productId);
            transaction.update(productRef, {
              stock: newStock,
              updatedAt: now
            });

            // Prepare inventory movement
            const movementRef = doc(collection(db, 'inventory_movements'));
            const deliveryInfo = rcv.hasDeliveryNote && rcv.deliveryNoteNumber 
              ? ` (Remito #${rcv.deliveryNoteNumber})` 
              : '';
            const supplierInfo = rcv.supplierName ? ` - Proveedor: ${rcv.supplierName}` : '';
            const orderInfo = rcv.replenishmentCode ? ` - Pedido: #${rcv.replenishmentCode}` : '';

            movementsToCreate.push({
              id: movementRef.id,
              businessId: cleanBusinessId,
              productId: item.productId,
              productName: sanitizeString(item.productName, 150),
              type: 'RECEIPT',
              quantity: addedQty,
              previousStock,
              newStock,
              reason: sanitizeString(`Recepción de productos offline sincronizada${deliveryInfo}${supplierInfo}${orderInfo}`, 255),
              createdAt: now,
              userId: op.userId,
              receivingId,
              replenishmentId: rcv.replenishmentId
            });
          }

          processedItems.push({
            ...item,
            currentStockAtScan: previousStock
          });
        }

        // Write inventory movements
        for (const mov of movementsToCreate) {
          transaction.set(doc(db, 'inventory_movements', mov.id), mov);
        }

        // Set receiving document
        transaction.set(receivingRef, {
          id: receivingId,
          businessId: cleanBusinessId,
          supplierName: rcv.supplierName || 'Proveedor sin especificar',
          hasDeliveryNote: Boolean(rcv.hasDeliveryNote),
          deliveryNoteNumber: rcv.deliveryNoteNumber || '',
          status: 'CONFIRMED',
          items: processedItems,
          totalProductsCount: processedItems.length,
          totalUnitsCount: processedItems.reduce((sum, it) => sum + it.quantity, 0),
          createdBy: rcv.createdBy || op.userId,
          creatorName: rcv.creatorName || op.userName,
          confirmedBy: rcv.confirmedBy || op.userId,
          confirmerName: rcv.confirmerName || op.userName,
          confirmedAt: rcv.confirmedAt || now,
          createdAt: rcv.createdAt || now,
          updatedAt: now,
          replenishmentId: rcv.replenishmentId || null,
          replenishmentCode: rcv.replenishmentCode || null,
          deviceId: op.deviceId,
          syncedAt: now
        }, { merge: true });

        // Update replenishment if linked
        if (rcv.replenishmentId) {
          const repRef = doc(db, 'replenishment_lists', rcv.replenishmentId);
          transaction.update(repRef, {
            status: 'RECEIVED',
            receivedAt: now,
            receivingId,
            receivedBy: op.userId,
            receiverName: op.userName,
            updatedAt: now
          });
        }
      });

      // Update local record to SYNCED
      await localDataStore.saveOfflineReceiving({
        ...rcv,
        id: receivingId,
        syncStatus: 'SYNCED',
        syncedAt: now,
        syncError: undefined
      });

      return { success: true, status: 'SYNCED' };
    } catch (err: any) {
      console.error('[receivingService] Error sincronizando recepción a Firestore:', err);
      return {
        success: false,
        status: 'ERROR',
        error: err?.message || 'Error de sincronización con el servidor.'
      };
    }
  });
}

/**
 * Creates a new Receiving in DRAFT status
 */
export async function createDraftReceiving(
  businessId: string,
  userId: string,
  creatorName: string,
  supplierName?: string,
  hasDeliveryNote: boolean = false,
  deliveryNoteNumber?: string
): Promise<Receiving> {
  const receivingRef = doc(collection(db, 'receivings'));
  const now = new Date().toISOString();
  const cleanSupplier = sanitizeString(supplierName?.trim() || 'Proveedor sin especificar', 100);
  const cleanDeliveryNote = hasDeliveryNote ? sanitizeString(deliveryNoteNumber?.trim() || '', 64) : '';
  const cleanCreatorName = sanitizeString(creatorName?.trim() || 'Vendedor', 100);

  const rawReceiving: Record<string, any> = {
    id: receivingRef.id,
    businessId,
    supplierName: cleanSupplier,
    hasDeliveryNote,
    deliveryNoteNumber: cleanDeliveryNote,
    status: 'DRAFT',
    items: [],
    totalProductsCount: 0,
    totalUnitsCount: 0,
    createdBy: userId,
    creatorName: cleanCreatorName,
    createdAt: now,
    updatedAt: now
  };

  const cleanDoc = cleanFirestoreData(rawReceiving);

  await setDoc(receivingRef, cleanDoc);

  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: cleanCreatorName,
    targetUserId: userId,
    action: 'RECEPCION_CONTROL_INICIADO',
    details: `Borrador de recepción manual #${receivingRef.id.slice(0, 6).toUpperCase()} iniciado (${cleanSupplier})${cleanDeliveryNote ? ` - Remito #${cleanDeliveryNote}` : ''}`
  });

  return cleanDoc as Receiving;
}

/**
 * Get active draft receiving linked to a replenishment list ID
 */
export async function getDraftReceivingByReplenishment(
  businessId: string,
  replenishmentId: string
): Promise<Receiving | null> {
  try {
    const q = query(
      collection(db, 'receivings'),
      where('businessId', '==', businessId),
      where('replenishmentId', '==', replenishmentId),
      where('status', '==', 'DRAFT')
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const docs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as Receiving));
    return docs[0];
  } catch (error) {
    console.error('Error fetching draft receiving by replenishment ID:', error);
    return null;
  }
}

/**
 * Get exported and approved replenishment orders available for receiving
 */
export async function getExportedReplenishmentOrders(businessId: string): Promise<ReplenishmentList[]> {
  try {
    const q = query(
      collection(db, 'replenishment_lists'),
      where('businessId', '==', businessId),
      where('status', 'in', ['EXPORTED', 'APPROVED'])
    );
    const snap = await getDocs(q);
    const list: ReplenishmentList[] = snap.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    } as ReplenishmentList));

    // Enrich with public order provider response if available
    await Promise.all(
      list.map(async (order) => {
        if (!order.providerResponse && (order.publicShareToken || order.publicShareCode)) {
          try {
            const tokenOrCode = order.publicShareToken || order.publicShareCode || '';
            const pOrder = await getPublicOrder(tokenOrCode);
            if (pOrder?.providerResponse) {
              order.providerResponse = pOrder.providerResponse;
              order.providerStatus = 'CONFIRMED';
              order.providerConfirmedAt = pOrder.providerConfirmedAt;
              order.providerNote = pOrder.providerNote;
              order.publicOrderStatus = pOrder.status;
            }
          } catch {
            // Silently continue
          }
        }
      })
    );

    return list.sort((a, b) => (b.exportedAt || b.createdAt || '').localeCompare(a.exportedAt || a.createdAt || ''));
  } catch (error) {
    console.error('Error fetching exported replenishment orders:', error);
    return [];
  }
}

/**
 * Create a draft receiving pre-loaded from an exported Replenishment List
 */
export async function createDraftReceivingFromReplenishment(
  businessId: string,
  userId: string,
  creatorName: string,
  replenishment: ReplenishmentList,
  deliveryNoteNumber?: string
): Promise<Receiving> {
  const cleanDeliveryNote = deliveryNoteNumber ? sanitizeString(deliveryNoteNumber.trim(), 64) : '';
  const hasDelivery = cleanDeliveryNote.length > 0;

  // Check if a DRAFT receiving already exists for this replenishment
  const existingDraft = await getDraftReceivingByReplenishment(businessId, replenishment.id);
  if (existingDraft) {
    if (cleanDeliveryNote && (!existingDraft.deliveryNoteNumber || existingDraft.deliveryNoteNumber !== cleanDeliveryNote)) {
      await updateDoc(doc(db, 'receivings', existingDraft.id), cleanFirestoreData({
        hasDeliveryNote: true,
        deliveryNoteNumber: cleanDeliveryNote,
        updatedAt: new Date().toISOString()
      }));
      existingDraft.hasDeliveryNote = true;
      existingDraft.deliveryNoteNumber = cleanDeliveryNote;
    }
    return existingDraft;
  }

  const receivingRef = doc(collection(db, 'receivings'));
  const now = new Date().toISOString();
  const refCode = formatRequestCode(replenishment.id);

  // Check if provider confirmation exists on the replenishment or public order
  const providerItemsMap = new Map<string, number>();
  if (replenishment.providerResponse?.items) {
    replenishment.providerResponse.items.forEach(it => {
      if (it.productName) {
        providerItemsMap.set(it.productName, it.confirmedQuantity);
      }
    });
  } else if (replenishment.publicShareToken || replenishment.publicShareCode) {
    try {
      const pOrder = await getPublicOrder(replenishment.publicShareToken || replenishment.publicShareCode || '');
      if (pOrder?.providerResponse?.items) {
        pOrder.providerResponse.items.forEach(it => {
          if (it.productName) {
            providerItemsMap.set(it.productName, it.confirmedQuantity);
          }
        });
      }
    } catch (err) {
      console.warn('Could not load public order provider items for draft receiving:', err);
    }
  }

  const items: ReceivingItem[] = (replenishment.items || []).map((item) => {
    const hasConfirmed = providerItemsMap.has(item.productName);
    const confirmedQty = hasConfirmed ? providerItemsMap.get(item.productName) : undefined;
    const targetQty = item.approvedQuantity !== undefined ? item.approvedQuantity : item.requestedQuantity;
    // Default physical count to confirmed quantity if available, otherwise approved/requested quantity
    const defaultReceivedQty = confirmedQty !== undefined ? confirmedQty : targetQty;
    
    const rItem: ReceivingItem = {
      productId: item.productId,
      productName: sanitizeString(item.productName || 'Producto sin nombre', 150),
      barcode: sanitizeBarcode(item.barcode),
      quantity: sanitizeInteger(defaultReceivedQty, 0, 999999, 0),
      currentStockAtScan: sanitizeNumber(item.currentStock, 0, 999999, 0)
    };

    if (item.category) {
      rItem.category = sanitizeString(item.category, 64);
    }
    if (typeof targetQty === 'number' && Number.isFinite(targetQty)) {
      rItem.requestedQuantity = sanitizeInteger(targetQty, 0, 999999, 0);
    }
    if (typeof confirmedQty === 'number' && Number.isFinite(confirmedQty)) {
      rItem.confirmedQuantity = sanitizeInteger(confirmedQty, 0, 999999, 0);
    }

    return rItem;
  });

  const totalProductsCount = items.length;
  const totalUnitsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const cleanSupplierName = sanitizeString(replenishment.supplierName?.trim() || 'Proveedor sin especificar', 100);
  const cleanCreatorName = sanitizeString(creatorName?.trim() || 'Vendedor', 100);

  const rawReceiving: Record<string, any> = {
    id: receivingRef.id,
    businessId,
    supplierName: cleanSupplierName,
    hasDeliveryNote: hasDelivery,
    deliveryNoteNumber: cleanDeliveryNote,
    status: 'DRAFT',
    items,
    totalProductsCount,
    totalUnitsCount,
    createdBy: userId,
    creatorName: cleanCreatorName,
    createdAt: now,
    updatedAt: now,
    replenishmentId: replenishment.id,
    replenishmentCode: refCode
  };

  const cleanDoc = cleanFirestoreData(rawReceiving);

  await setDoc(receivingRef, cleanDoc);

  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: cleanCreatorName,
    targetUserId: userId,
    action: 'RECEPCION_CONTROL_INICIADO',
    details: `Pre-recepción creada a partir de la solicitud #${refCode} (${cleanSupplierName})${cleanDeliveryNote ? ` - Remito #${cleanDeliveryNote}` : ''}`
  });

  try {
    await createNotification({
      businessId,
      targetRole: 'ADMIN',
      type: 'RECEPCION_CONTROL_INICIADO',
      title: 'Control de recepción iniciado',
      message: `${cleanCreatorName} inició el cotejo físico de mercadería para la solicitud #${refCode} (${cleanSupplierName})${cleanDeliveryNote ? ` - Remito #${cleanDeliveryNote}` : ''}.`,
      linkTab: 'receiving',
      eventId: `rec_init_${receivingRef.id}_${now.slice(0, 16)}`,
      metadata: {
        receivingId: receivingRef.id,
        replenishmentId: replenishment.id,
        requestId: refCode,
        supplierName: cleanSupplierName
      }
    });
  } catch (notifErr) {
    console.warn('Could not send notification for receiving control start:', notifErr);
  }

  return cleanDoc as Receiving;
}

/**
 * Updates items in a DRAFT receiving document
 */
export async function updateReceivingDraft(
  receivingId: string,
  items: ReceivingItem[],
  currentUserId?: string,
  userBusinessId?: string,
  isUserAdmin: boolean = false
): Promise<void> {
  const receivingRef = doc(db, 'receivings', receivingId);
  const docSnap = await getDoc(receivingRef);

  if (!docSnap.exists()) {
    throw new Error('La recepción especificada no existe.');
  }

  const receiving = docSnap.data() as Receiving;

  if (receiving.status !== 'DRAFT') {
    throw new Error('No se puede modificar una recepción que no se encuentra en borrador.');
  }

  if (userBusinessId && receiving.businessId !== userBusinessId) {
    throw new Error('Acceso denegado: Negocio no coincide.');
  }

  if (currentUserId && !isUserAdmin && receiving.createdBy !== currentUserId) {
    throw new Error('Solo el usuario que creó este borrador puede modificarlo.');
  }

  // Clean, validate and consolidate items (quantity >= 0 is valid for received items)
  const consolidatedMap = new Map<string, ReceivingItem>();

  for (const rawItem of items) {
    if (!rawItem.productId || typeof rawItem.productId !== 'string') continue;
    const qty = Number(rawItem.quantity);
    if (!Number.isFinite(qty) || qty < 0 || isNaN(qty)) continue;

    const reqQty = rawItem.requestedQuantity !== undefined && Number.isFinite(Number(rawItem.requestedQuantity))
      ? Math.max(0, Number(rawItem.requestedQuantity))
      : undefined;

    const existing = consolidatedMap.get(rawItem.productId);
    if (existing) {
      existing.quantity += qty;
    } else {
      consolidatedMap.set(rawItem.productId, {
        productId: rawItem.productId,
        productName: String(rawItem.productName || 'Producto sin nombre').trim(),
        barcode: rawItem.barcode ? String(rawItem.barcode).trim() : null,
        category: rawItem.category ? String(rawItem.category).trim() : undefined,
        requestedQuantity: reqQty,
        quantity: qty,
        currentStockAtScan: Number.isFinite(Number(rawItem.currentStockAtScan)) ? Number(rawItem.currentStockAtScan) : undefined
      });
    }
  }

  const cleanedItems = Array.from(consolidatedMap.values());
  const now = new Date().toISOString();
  const totalProductsCount = cleanedItems.length;
  const totalUnitsCount = cleanedItems.reduce((sum, item) => sum + item.quantity, 0);

  await updateDoc(receivingRef, cleanFirestoreData({
    items: cleanedItems,
    totalProductsCount,
    totalUnitsCount,
    updatedAt: now
  }));
}

/**
 * Get all pending receivings (DRAFT status only) for a specific business
 */
export async function getPendingReceivings(businessId: string): Promise<Receiving[]> {
  try {
    const q = query(
      collection(db, 'receivings'),
      where('businessId', '==', businessId),
      where('status', '==', 'DRAFT')
    );
    const snap = await getDocs(q);
    const list: Receiving[] = [];
    snap.forEach((docSnap) => {
      const data = { id: docSnap.id, ...docSnap.data() } as Receiving;
      if (data.status === 'DRAFT') {
        list.push(data);
      }
    });
    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    console.error('Error fetching pending receivings:', error);
    try {
      const qFallback = query(collection(db, 'receivings'), where('businessId', '==', businessId));
      const snapFallback = await getDocs(qFallback);
      const listFallback: Receiving[] = [];
      snapFallback.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() } as Receiving;
        if (data.status === 'DRAFT') {
          listFallback.push(data);
        }
      });
      return listFallback.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    } catch (fallbackErr) {
      console.error('Fallback query error:', fallbackErr);
      return [];
    }
  }
}

/**
 * Get all confirmed receivings (CONFIRMED status only) for a specific business,
 * merging online Firestore records with local offline records from IndexedDB.
 */
export async function getConfirmedReceivings(businessId: string): Promise<Receiving[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  let onlineList: Receiving[] = [];
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (isOnline) {
    try {
      const q = query(
        collection(db, 'receivings'),
        where('businessId', '==', cleanBusinessId),
        where('status', '==', 'CONFIRMED')
      );
      const snap = await getDocs(q);
      snap.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data(), syncStatus: 'SYNCED', syncMode: 'ONLINE' } as Receiving;
        if (data.status === 'CONFIRMED') {
          onlineList.push(data);
        }
      });
    } catch (error) {
      console.error('Error fetching confirmed receivings from Firestore:', error);
    }
  }

  // 2. Fetch local offline receivings from IndexedDB
  let localList: Receiving[] = [];
  try {
    localList = await localDataStore.getOfflineReceivingsByBusiness(cleanBusinessId);
  } catch (err) {
    console.warn('[receivingService] Error fetching local receivings from IndexedDB:', err);
  }

  // 3. Deduplicate by ID
  const map = new Map<string, Receiving>();
  for (const r of localList) {
    if (r.id) map.set(r.id, r);
  }
  for (const r of onlineList) {
    if (r.id) {
      map.set(r.id, {
        ...r,
        syncStatus: 'SYNCED',
        syncMode: r.syncMode || 'ONLINE'
      });
    }
  }

  const merged = Array.from(map.values());
  return merged.sort((a, b) => (b.confirmedAt || b.createdAt || '').localeCompare(a.confirmedAt || a.createdAt || ''));
}

/**
 * Cancel a draft receiving
 */
export async function cancelDraftReceiving(
  receivingId: string,
  businessId: string,
  userId: string,
  userName: string,
  reason?: string
): Promise<void> {
  const receivingRef = doc(db, 'receivings', receivingId);
  const snap = await getDoc(receivingRef);
  if (!snap.exists()) {
    throw new Error('La recepción no existe.');
  }
  const receiving = snap.data() as Receiving;
  if (receiving.status !== 'DRAFT') {
    throw new Error('Solo se pueden cancelar recepciones en estado borrador.');
  }
  if (receiving.businessId !== businessId) {
    throw new Error('Acceso denegado: La recepción pertenece a otro negocio.');
  }
  const now = new Date().toISOString();
  await updateDoc(receivingRef, {
    status: 'CANCELLED',
    updatedAt: now
  });
  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: userName,
    targetUserId: userId,
    action: 'RECEIVING_CANCELLED',
    details: `Borrador de recepción #${receivingId} cancelado. Motivo: ${reason || 'Sin motivo'}`
  });
}

/**
 * Get all receivings for a specific business (Returns confirmed history by default)
 */
export async function getReceivingsByBusiness(businessId: string): Promise<Receiving[]> {
  return getConfirmedReceivings(businessId);
}

/**
 * Get single receiving by ID
 */
export async function getReceivingById(receivingId: string): Promise<Receiving | null> {
  try {
    const docSnap = await getDoc(doc(db, 'receivings', receivingId));
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as Receiving;
  } catch (error) {
    console.error('Error fetching receiving:', error);
    return null;
  }
}

export interface ConfirmReceivingDiscrepancyOptions {
  shortageClosed?: boolean;
  shortageReason?: string;
  surplusTreatment?: 'CHARGE' | 'FREE' | 'REJECT';
  differenceNotes?: string;
  itemsDiscrepancies?: Record<string, {
    shortageClosed?: boolean;
    shortageReason?: string;
    surplusTreatment?: 'CHARGE' | 'FREE' | 'REJECT';
  }>;
}

/**
 * ATOMIC TRANSACTION: Confirm Receiving
 * 1. Checks receiving is currently DRAFT (prevents double confirmation).
 * 2. Reads current stock of all products in transaction.
 * 3. Handles shortages and surpluses formally with explicit user resolutions.
 * 4. Updates product stock in Firestore strictly by accepted received quantities.
 * 5. Handles financial obligations atomically without duplicate creations.
 * 6. Keeps historical unitCost and Product.costPrice strictly immutable.
 * 7. Creates inventory_movements records (type: RECEIPT).
 * 8. Changes receiving status to CONFIRMED and updates purchase/replenishment status.
 * 9. Logs complete audit logs (SHORTAGE, SURPLUS, SHORTAGE_CLOSED, SURPLUS_RESOLVED, etc.).
 */
export async function confirmReceivingTransaction(
  receivingId: string,
  businessId: string,
  userId: string,
  confirmerName: string,
  isUserAdmin: boolean = false,
  discrepancyOptions?: ConfirmReceivingDiscrepancyOptions
): Promise<void> {
  const cleanReceivingId = sanitizeString(receivingId, 64);
  const cleanBusinessId = sanitizeString(businessId, 64);
  const cleanUserId = sanitizeString(userId, 64);
  const cleanConfirmerName = sanitizeString(confirmerName, 128) || 'Vendedor';

  if (!cleanReceivingId) throw new Error('ID de recepción inválido.');
  if (!cleanBusinessId) throw new Error('ID de negocio inválido.');
  if (!cleanUserId) throw new Error('ID de usuario inválido.');

  return withActionLock(`confirm_rcv_${cleanReceivingId}`, async () => {
    const receivingRef = doc(db, 'receivings', cleanReceivingId);
    const now = new Date().toISOString();

    let hasShortage = false;
    let hasSurplus = false;
    let totalShortageUnits = 0;
    let totalSurplusUnits = 0;
    let allShortagesClosed = true;
    let confirmedReceivingData: Receiving | null = null;
    let globalShortageReason: string | undefined = discrepancyOptions?.shortageReason;
    let globalSurplusTreatment: 'CHARGE' | 'FREE' | 'REJECT' = discrepancyOptions?.surplusTreatment || 'CHARGE';

    await runTransaction(db, async (transaction) => {
      // 1. Fetch Receiving Doc
      const receivingSnap = await transaction.get(receivingRef);
      if (!receivingSnap.exists()) {
        throw new Error('La recepción especificada no existe.');
      }

      const receiving = receivingSnap.data() as Receiving;
      confirmedReceivingData = receiving;

      if (!globalShortageReason) {
        globalShortageReason = receiving.shortageReason || 'PROVEEDOR_SIN_STOCK';
      }
      if (!discrepancyOptions?.surplusTreatment && receiving.surplusTreatment) {
        globalSurplusTreatment = receiving.surplusTreatment;
      }

      // Protection against double confirmation or editing confirmed
      if (receiving.status !== 'DRAFT') {
        throw new Error(`No se puede confirmar una recepción con estado "${receiving.status}". Solo se pueden confirmar borradores.`);
      }

      if (receiving.businessId !== cleanBusinessId) {
        throw new Error('Acceso denegado: La recepción no pertenece a tu negocio.');
      }

      if (receiving.createdBy !== cleanUserId && !isUserAdmin) {
        throw new Error('Acceso denegado: Solo el creador de la recepción puede confirmarla.');
      }

      if (!receiving.items || receiving.items.length === 0) {
        throw new Error('La recepción no contiene ningún producto para ingresar.');
      }

      // Consolidate duplicate items if any exist in document
      const consolidatedMap = new Map<string, ReceivingItem>();
      for (const rawItem of receiving.items) {
        if (!rawItem.productId) continue;
        const qty = sanitizeInteger(rawItem.quantity, 0, 999999, 0);

        const reqQty = rawItem.requestedQuantity !== undefined && Number.isFinite(Number(rawItem.requestedQuantity))
          ? sanitizeInteger(rawItem.requestedQuantity, 0, 999999, 0)
          : undefined;

        const existing = consolidatedMap.get(rawItem.productId);
        if (existing) {
          existing.quantity += qty;
        } else {
          consolidatedMap.set(rawItem.productId, {
            ...rawItem,
            requestedQuantity: reqQty,
            quantity: qty
          });
        }
      }

      const itemsToProcess = Array.from(consolidatedMap.values());
      if (itemsToProcess.length === 0) {
        throw new Error('Los productos en la recepción tienen cantidades inválidas.');
      }

      // 2. Fetch all product documents in transaction
      const productSnaps = await Promise.all(
        itemsToProcess.map((item) => transaction.get(doc(db, 'products', item.productId)))
      );

      // Check if linked to an existing purchase
      let linkedPurchaseData: Purchase | null = null;
      let pRef: ReturnType<typeof doc> | null = null;
      if (receiving.purchaseId) {
        pRef = doc(db, 'purchases', receiving.purchaseId);
        const pSnap = await transaction.get(pRef);
        if (pSnap.exists()) {
          linkedPurchaseData = pSnap.data() as Purchase;
        }
      }

      // 3. Process item discrepancies and stock additions
      const movementsToCreate: InventoryMovement[] = [];
      let totalFinancialReduction = 0;
      let totalFinancialIncrease = 0;

      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        const productSnap = productSnaps[i];

        if (!productSnap.exists()) {
          throw new Error(`El producto "${item.productName}" (ID: ${item.productId}) ya no existe en el catálogo.`);
        }

        const productData = productSnap.data();

        // Multi-tenant validation on product
        if (productData.businessId !== cleanBusinessId) {
          throw new Error(`El producto "${item.productName}" pertenece a otro negocio.`);
        }

        const previousStock = Number(productData.stock) || 0;
        const physicalReceivedQty = Number(item.quantity) || 0;

        if (!Number.isFinite(physicalReceivedQty) || physicalReceivedQty < 0 || isNaN(physicalReceivedQty)) {
          throw new Error(`La cantidad ingresada para "${item.productName}" es inválida.`);
        }

        // Calculate shortages & surpluses
        let itemShortage = 0;
        let itemSurplus = 0;
        const reqQty = item.requestedQuantity;

        if (reqQty !== undefined && reqQty > 0) {
          if (physicalReceivedQty < reqQty) {
            itemShortage = reqQty - physicalReceivedQty;
            hasShortage = true;
          } else if (physicalReceivedQty > reqQty) {
            itemSurplus = physicalReceivedQty - reqQty;
            hasSurplus = true;
          }
        } else if (physicalReceivedQty > 0) {
          itemSurplus = physicalReceivedQty;
          hasSurplus = true;
        }

        totalShortageUnits += itemShortage;
        totalSurplusUnits += itemSurplus;

        // Determine user resolution for this item
        const itemSpecificDiscrepancy = discrepancyOptions?.itemsDiscrepancies?.[item.productId];
        const itemShortageClosed = itemSpecificDiscrepancy?.shortageClosed !== undefined
          ? Boolean(itemSpecificDiscrepancy.shortageClosed)
          : (discrepancyOptions?.shortageClosed !== undefined ? Boolean(discrepancyOptions.shortageClosed) : (receiving.shortageClosed ?? false));

        const itemShortageReason = itemSpecificDiscrepancy?.shortageReason || discrepancyOptions?.shortageReason || receiving.shortageReason || 'PROVEEDOR_SIN_STOCK';
        const itemSurplusTreatment = itemSpecificDiscrepancy?.surplusTreatment || discrepancyOptions?.surplusTreatment || receiving.surplusTreatment || 'CHARGE';

        if (itemShortage > 0 && !itemShortageClosed) {
          allShortagesClosed = false;
        }

        // Calculate physical stock to add
        let addedQuantity = physicalReceivedQty;
        if (itemSurplus > 0 && itemSurplusTreatment === 'REJECT') {
          // Surplus was rejected and returned to provider. Only requested units enter stock!
          addedQuantity = Math.max(0, reqQty ?? (physicalReceivedQty - itemSurplus));
        }

        // Item historical cost (Strictly immutable)
        const pItem = linkedPurchaseData?.items?.find((pi) => pi.productId === item.productId);
        const unitCost = Number(pItem?.unitCost ?? item.unitCost ?? 0);
        item.unitCost = unitCost;

        // Calculate financial impact if linked to purchase
        if (itemShortage > 0 && itemShortageClosed) {
          totalFinancialReduction += itemShortage * unitCost;
        }
        if (itemSurplus > 0 && itemSurplusTreatment === 'CHARGE') {
          totalFinancialIncrease += itemSurplus * unitCost;
        }

        // Store discrepancy decisions on the receiving item snapshot
        item.receivedQuantity = physicalReceivedQty;
        item.shortageQuantity = itemShortage;
        item.surplusQuantity = itemSurplus;
        item.shortageClosed = itemShortage > 0 ? itemShortageClosed : undefined;
        item.shortageReason = itemShortage > 0 && itemShortageClosed ? itemShortageReason : undefined;
        item.surplusTreatment = itemSurplus > 0 ? itemSurplusTreatment : undefined;
        item.currentStockAtScan = previousStock;

        // ONLY increment stock with accepted received units (> 0)
        // Note: Product.costPrice is strictly preserved and NOT modified!
        if (addedQuantity > 0) {
          const newStock = previousStock + addedQuantity;

          // Update product stock in transaction
          const productRef = doc(db, 'products', item.productId);
          transaction.update(productRef, {
            stock: newStock,
            updatedAt: now
          });

          // Prepare Inventory Movement
          const movementRef = doc(collection(db, 'inventory_movements'));
          const deliveryInfo = receiving.hasDeliveryNote && receiving.deliveryNoteNumber 
            ? ` (Remito #${receiving.deliveryNoteNumber})` 
            : '';
          const supplierInfo = receiving.supplierName ? ` - Proveedor: ${receiving.supplierName}` : '';
          const orderInfo = receiving.replenishmentCode ? ` - Pedido: #${receiving.replenishmentCode}` : '';
          const surplusNote = itemSurplus > 0 && itemSurplusTreatment === 'REJECT' ? ' [Sobrante rechazado en descarga]' : '';

          movementsToCreate.push({
            id: movementRef.id,
            businessId: cleanBusinessId,
            productId: item.productId,
            productName: sanitizeString(item.productName, 150),
            type: 'RECEIPT',
            quantity: addedQuantity,
            previousStock,
            newStock,
            reason: sanitizeString(`Recepción de productos${deliveryInfo}${supplierInfo}${orderInfo}${surplusNote}`, 255),
            createdAt: now,
            userId: cleanUserId,
            receivingId: receiving.id,
            replenishmentId: receiving.replenishmentId
          });
        }
      }

      // Write all inventory movements
      for (const mov of movementsToCreate) {
        const movRef = doc(db, 'inventory_movements', mov.id);
        transaction.set(movRef, mov);
      }

      // 4. Handle Financial Impacts and Discrepancy Adjustments
      let cashMovementId: string | undefined = undefined;
      let obligationId: string | undefined = undefined;
      const netFinancialAdjustment = totalFinancialIncrease - totalFinancialReduction;
      const originalPurchaseTotal = Number(linkedPurchaseData?.total || receiving.totalAmount || 0);
      const adjustedDueAmount = Math.max(0, originalPurchaseTotal + netFinancialAdjustment);

      const isFromPurchase = Boolean(linkedPurchaseData || receiving.originType === 'PURCHASE' || receiving.originType === 'ADMIN_DELIVERY');

      if (isFromPurchase && linkedPurchaseData) {
        // A. If the Purchase already has a linked obligation (e.g. A_CANCELAR):
        if (linkedPurchaseData.obligationId) {
          obligationId = linkedPurchaseData.obligationId;
          const oblRef = doc(db, 'payment_obligations', linkedPurchaseData.obligationId);
          const oblSnap = await transaction.get(oblRef);

          if (oblSnap.exists()) {
            const obl = oblSnap.data() as PaymentObligation;
            if (obl.status === 'PENDING') {
              const currentOblAmount = Number(obl.amount || 0);
              const currentPending = Number(obl.pendingAmount ?? obl.amount ?? 0);

              // Adjust obligation amount and pendingAmount based on discrepancies
              const newOblAmount = Math.max(0, currentOblAmount + netFinancialAdjustment);
              let newPending = Math.max(0, currentPending + netFinancialAdjustment);

              // If paid with Cash at receiving time:
              if (receiving.paymentStatus === 'PAGADO' && (receiving.fundSource === 'CASH' || !receiving.fundSource) && receiving.paymentMethod === 'EFECTIVO' && newPending > 0) {
                const settleAmount = Math.min(newPending, Number(receiving.totalAmount || newPending));
                newPending = Math.max(0, newPending - settleAmount);

                const cashMovRef = doc(collection(db, 'cash_movements'));
                cashMovementId = cashMovRef.id;
                transaction.set(cashMovRef, {
                  id: cashMovementId,
                  businessId: cleanBusinessId,
                  type: 'PURCHASE_PAYMENT',
                  amount: -settleAmount,
                  referenceId: obligationId,
                  supplierName: obl.supplierName || receiving.supplierName || '',
                  description: `Pago en recepción de compra #${(receiving.purchaseId || '').slice(0, 6).toUpperCase()}: ${obl.supplierName || 'Proveedor'}`,
                  paymentMethod: receiving.paymentMethod || 'EFECTIVO',
                  createdBy: cleanUserId,
                  creatorName: cleanConfirmerName,
                  createdAt: now
                });

                const settlementRef = doc(collection(db, 'payment_settlements'));
                transaction.set(settlementRef, {
                  id: settlementRef.id,
                  obligationId,
                  businessId: cleanBusinessId,
                  amount: settleAmount,
                  paymentDate: now,
                  paymentMethod: receiving.paymentMethod || 'EFECTIVO',
                  fundSource: 'CASH',
                  registeredBy: cleanUserId,
                  registrarName: cleanConfirmerName,
                  notes: `Cancelado al recibir mercadería (Remito #${receiving.deliveryNoteNumber || 'S/N'})`,
                  cashMovementId,
                  createdAt: now
                });
              }

              const adjustmentNotes = netFinancialAdjustment !== 0
                ? ` | Ajuste diferencias recepción: ${netFinancialAdjustment > 0 ? '+' : ''}${netFinancialAdjustment}`
                : '';

              transaction.update(oblRef, {
                amount: newOblAmount,
                pendingAmount: newPending,
                status: newPending <= 0 ? 'PAID' : 'PENDING',
                notes: sanitizeString(`${obl.notes || 'Obligación de compra'}${adjustmentNotes}`, 255),
                settledAt: newPending <= 0 ? now : obl.settledAt,
                settledBy: newPending <= 0 ? cleanUserId : obl.settledBy,
                settlerName: newPending <= 0 ? cleanConfirmerName : obl.settlerName,
                updatedAt: now
              });
            }
          }
        } else if (linkedPurchaseData.paymentStatus === 'PAGADO' && totalFinancialIncrease > 0) {
          // If purchase was already paid at creation and user accepted extra surplus WITH CHARGE:
          // A new obligation is created strictly for the extra surplus owed to supplier
          const surplusOblRef = doc(collection(db, 'payment_obligations'));
          obligationId = surplusOblRef.id;
          transaction.set(surplusOblRef, {
            id: surplusOblRef.id,
            businessId: cleanBusinessId,
            sourceType: 'PURCHASE',
            sourceId: receiving.purchaseId,
            sourceCode: `COM-${(receiving.purchaseId || '').slice(0, 5).toUpperCase()}`,
            supplierName: linkedPurchaseData.supplierName || receiving.supplierName || 'Proveedor',
            beneficiary: linkedPurchaseData.supplierName || receiving.supplierName || 'Proveedor',
            category: 'Proveedores',
            description: `Sobrante aceptado con cargo en compra #${(receiving.purchaseId || '').slice(0, 5).toUpperCase()} (${totalSurplusUnits} u.)`,
            amount: totalFinancialIncrease,
            pendingAmount: totalFinancialIncrease,
            status: 'PENDING',
            paymentMethod: receiving.paymentMethod || 'EFECTIVO',
            fundSource: 'CASH',
            receiptNumber: receiving.deliveryNoteNumber || undefined,
            createdBy: cleanUserId,
            creatorName: cleanConfirmerName,
            createdAt: now,
            updatedAt: now
          });
        }
      } else {
        // Standalone receiving (Direct supplier drop-off without prior purchase order)
        const standaloneTotal = Number(receiving.totalAmount || 0);
        if (standaloneTotal > 0) {
          if (receiving.paymentStatus === 'PAGADO' && (receiving.fundSource === 'CASH' || !receiving.fundSource) && receiving.paymentMethod === 'EFECTIVO') {
            const cashMovRef = doc(collection(db, 'cash_movements'));
            cashMovementId = cashMovRef.id;
            transaction.set(cashMovRef, {
              id: cashMovementId,
              businessId: cleanBusinessId,
              type: 'PURCHASE_PAYMENT',
              amount: -standaloneTotal,
              referenceId: receiving.id,
              supplierName: receiving.supplierName || '',
              description: `Recepción de mercadería: ${receiving.supplierName || 'Proveedor'}${receiving.deliveryNoteNumber ? ` (Remito #${receiving.deliveryNoteNumber})` : ''}`,
              paymentMethod: receiving.paymentMethod || 'EFECTIVO',
              createdBy: cleanUserId,
              creatorName: cleanConfirmerName,
              createdAt: now
            });
          } else if (receiving.paymentStatus === 'A_CANCELAR') {
            const oblRef = doc(collection(db, 'payment_obligations'));
            obligationId = oblRef.id;
            transaction.set(oblRef, {
              id: obligationId,
              businessId: cleanBusinessId,
              sourceType: 'RECEIVING',
              sourceId: receiving.id,
              sourceCode: `REC-${receiving.id.slice(0, 5).toUpperCase()}`,
              supplierName: receiving.supplierName || 'Proveedor',
              beneficiary: receiving.supplierName || 'Proveedor',
              category: 'Proveedores',
              description: `Recepción de mercadería a cancelar${receiving.deliveryNoteNumber ? ` (Remito #${receiving.deliveryNoteNumber})` : ''}`,
              amount: standaloneTotal,
              pendingAmount: standaloneTotal,
              status: 'PENDING',
              paymentMethod: receiving.paymentMethod || 'EFECTIVO',
              fundSource: 'CASH',
              receiptNumber: receiving.deliveryNoteNumber || undefined,
              createdBy: cleanUserId,
              creatorName: cleanConfirmerName,
              createdAt: now,
              updatedAt: now
            });
          }
        }
      }

      // 5. Update Receiving status to CONFIRMED with discrepancy details
      const hasDifferences = totalShortageUnits > 0 || totalSurplusUnits > 0;
      const receivingUpdate: Record<string, any> = {
        status: 'CONFIRMED',
        confirmedBy: cleanUserId,
        confirmerName: cleanConfirmerName,
        confirmedAt: now,
        hasDifference: hasDifferences,
        hasDiscrepancies: hasDifferences,
        totalShortageUnits,
        totalSurplusUnits,
        shortageClosed: allShortagesClosed,
        shortageReason: allShortagesClosed && totalShortageUnits > 0 ? globalShortageReason : undefined,
        surplusTreatment: totalSurplusUnits > 0 ? globalSurplusTreatment : undefined,
        differenceResolutionNotes: discrepancyOptions?.differenceNotes || receiving.differenceResolutionNotes || undefined,
        originalCommittedAmount: originalPurchaseTotal,
        adjustedDueAmount: adjustedDueAmount,
        items: itemsToProcess,
        totalProductsCount: itemsToProcess.length,
        totalUnitsCount: itemsToProcess.reduce((sum, it) => sum + it.quantity, 0),
        updatedAt: now
      };

      if (cashMovementId) receivingUpdate.cashMovementId = cashMovementId;
      if (obligationId) receivingUpdate.obligationId = obligationId;

      transaction.update(receivingRef, cleanFirestoreData(receivingUpdate));

      // 6. Update linked replenishment list status to RECEIVED
      if (receiving.replenishmentId) {
        const repRef = doc(db, 'replenishment_lists', receiving.replenishmentId);
        transaction.update(repRef, {
          status: 'RECEIVED',
          receivedAt: now,
          receivingId: receiving.id,
          receivedBy: cleanUserId,
          receiverName: cleanConfirmerName,
          updatedAt: now
        });
      }

      // 7. Update linked purchase status if originType is PURCHASE or ADMIN_DELIVERY
      if (pRef && linkedPurchaseData) {
        const totalUnitsInPurchase = (linkedPurchaseData.items || []).reduce((s: number, i: any) => s + (Number(i.quantity) || 0), 0);
        const newlyReceivedAccepted = itemsToProcess.reduce((s: number, i: any) => {
          if (i.surplusTreatment === 'REJECT' && (i.surplusQuantity || 0) > 0) {
            return s + Math.max(0, i.quantity - (i.surplusQuantity || 0));
          }
          return s + (Number(i.quantity) || 0);
        }, 0);

        const prevReceivedUnits = Number(linkedPurchaseData.receivedQuantity || 0);
        const totalNowReceived = prevReceivedUnits + newlyReceivedAccepted;
        const isAllRequestedReceived = totalNowReceived >= totalUnitsInPurchase;
        const isCircuitFinished = isAllRequestedReceived || allShortagesClosed;

        // Update purchase items with received, shortage, surplus
        const updatedPurchaseItems = (linkedPurchaseData.items || []).map((pItem: any) => {
          const rItem = itemsToProcess.find((it) => it.productId === pItem.productId);
          if (rItem) {
            return {
              ...pItem,
              receivedQuantity: (pItem.receivedQuantity || 0) + (rItem.quantity || 0),
              shortageQuantity: rItem.shortageQuantity,
              surplusQuantity: rItem.surplusQuantity
            };
          }
          return pItem;
        });

        transaction.update(pRef, cleanFirestoreData({
          items: updatedPurchaseItems,
          receivedQuantity: totalNowReceived,
          receivingStatus: isCircuitFinished ? 'RECIBIDO' : 'PARCIAL',
          adjustedTotal: adjustedDueAmount,
          total: allShortagesClosed ? adjustedDueAmount : linkedPurchaseData.total,
          shortageUnits: totalShortageUnits,
          surplusUnits: totalSurplusUnits,
          shortageClosed: allShortagesClosed,
          shortageReason: allShortagesClosed && totalShortageUnits > 0 ? globalShortageReason : undefined,
          surplusTreatment: totalSurplusUnits > 0 ? globalSurplusTreatment : undefined,
          updatedAt: now
        }));
      }
    });

    // Log Audit Events
    const notifType = hasShortage ? 'RECEPCION_PARCIAL' : 'RECEPCION_COMPLETADA';
    const notifTitle = hasShortage ? 'Recepción confirmada con faltantes' : 'Recepción de mercadería completada';
    const supplierLabel = confirmedReceivingData?.supplierName ? ` (${confirmedReceivingData.supplierName})` : '';
    const notifMsg = `${cleanConfirmerName} confirmó la recepción #${cleanReceivingId.slice(0, 6).toUpperCase()}${supplierLabel}${hasShortage ? ' con faltantes respecto a lo pedido' : ' e ingresó los productos al stock'}.`;

    await logAdminAction({
      businessId: cleanBusinessId,
      adminId: cleanUserId,
      adminEmail: cleanConfirmerName,
      targetUserId: cleanUserId,
      action: notifType,
      details: `Recepción #${cleanReceivingId.slice(0, 6).toUpperCase()} confirmada${hasShortage ? ' con faltantes' : ''}`
    });

    if (hasShortage) {
      await logAdminAction({
        businessId: cleanBusinessId,
        adminId: cleanUserId,
        adminEmail: cleanConfirmerName,
        targetUserId: cleanUserId,
        action: 'RECEIVING_WITH_SHORTAGE',
        details: `Recepción #${cleanReceivingId.slice(0, 6).toUpperCase()} confirmada con faltantes (${totalShortageUnits} u.) respecto al pedido`
      });

      if (allShortagesClosed) {
        await logAdminAction({
          businessId: cleanBusinessId,
          adminId: cleanUserId,
          adminEmail: cleanConfirmerName,
          targetUserId: cleanUserId,
          action: 'SHORTAGE_CLOSED',
          details: `Faltante de ${totalShortageUnits} u. cerrado formalmente. Motivo: ${globalShortageReason}. Circuito cerrado.`
        });
      }
    }

    if (hasSurplus) {
      await logAdminAction({
        businessId: cleanBusinessId,
        adminId: cleanUserId,
        adminEmail: cleanConfirmerName,
        targetUserId: cleanUserId,
        action: 'RECEIVING_WITH_SURPLUS',
        details: `Recepción #${cleanReceivingId.slice(0, 6).toUpperCase()} confirmada con sobrantes (${totalSurplusUnits} u.) respecto al pedido`
      });

      const surplusAction = globalSurplusTreatment === 'CHARGE'
        ? 'SURPLUS_ACCEPTED_CHARGE'
        : globalSurplusTreatment === 'FREE'
        ? 'SURPLUS_ACCEPTED_FREE'
        : 'SURPLUS_REJECTED';

      await logAdminAction({
        businessId: cleanBusinessId,
        adminId: cleanUserId,
        adminEmail: cleanConfirmerName,
        targetUserId: cleanUserId,
        action: surplusAction,
        details: `Sobrante de ${totalSurplusUnits} u. en recepción #${cleanReceivingId.slice(0, 6).toUpperCase()} resuelto como: ${globalSurplusTreatment}`
      });
    }

    if (confirmedReceivingData?.replenishmentId || (allShortagesClosed && hasShortage)) {
      await logAdminAction({
        businessId: cleanBusinessId,
        adminId: cleanUserId,
        adminEmail: cleanConfirmerName,
        targetUserId: cleanUserId,
        action: 'RECEPCION_CERRADA',
        details: `Circuito cerrado para recepción #${cleanReceivingId.slice(0, 6).toUpperCase()}`
      });
    }

    // Send Notification to Admins
    try {
      await createNotification({
        businessId: cleanBusinessId,
        targetRole: 'ADMIN',
        type: notifType,
        title: notifTitle,
        message: notifMsg,
        linkTab: 'receiving',
        eventId: `rec_conf_adm_${cleanReceivingId}_${now.slice(0, 16)}`,
        metadata: {
          receivingId: cleanReceivingId,
          supplierName: confirmedReceivingData?.supplierName,
          confirmerName: cleanConfirmerName,
          hasShortage,
          hasSurplus
        }
      });
    } catch (notifErr) {
      console.warn('Could not send notification for receiving confirmation:', notifErr);
    }

    // If receiving is linked to a replenishment list, sync public order status to RECEIVED
    const receivingSnap = await getDoc(receivingRef);
    if (receivingSnap.exists()) {
      const rData = receivingSnap.data() as Receiving;
      if (rData.replenishmentId) {
        try {
          await updatePublicOrderStatus(rData.replenishmentId, 'RECEIVED');
        } catch (syncErr) {
          console.warn('Could not sync received status to public order:', syncErr);
        }
      }
    }
  });
}
