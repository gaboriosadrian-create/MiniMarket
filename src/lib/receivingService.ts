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
import { Receiving, ReceivingItem, ReceivingStatus, InventoryMovement, ReplenishmentList, OutboxOperation } from '../types';
import { logAdminAction } from './auditService';
import { updatePublicOrderStatus, getPublicOrder } from './publicOrderService';
import { withActionLock } from './rateLimit';
import { sanitizeInteger, sanitizeNumber, sanitizeString } from './securityUtils';
import { localDataStore } from './localDataStore';
import { getDeviceId, generateOperationId } from './deviceId';

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
  replenishmentCode?: string
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

  const newReceiving: Receiving = {
    id: receivingRef.id,
    businessId,
    supplierName: supplierName?.trim() || 'Proveedor sin especificar',
    hasDeliveryNote,
    deliveryNoteNumber: hasDeliveryNote ? (deliveryNoteNumber?.trim() || '') : '',
    status: 'DRAFT',
    items: [],
    totalProductsCount: 0,
    totalUnitsCount: 0,
    createdBy: userId,
    creatorName: creatorName || 'Vendedor',
    createdAt: now,
    updatedAt: now
  };

  await setDoc(receivingRef, newReceiving);

  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: creatorName,
    targetUserId: userId,
    action: 'RECEIVING_CREATED',
    details: `Borrador de recepción manual creado`
  });

  return newReceiving;
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
 * Get exported replenishment orders available for receiving
 */
export async function getExportedReplenishmentOrders(businessId: string): Promise<ReplenishmentList[]> {
  try {
    const q = query(
      collection(db, 'replenishment_lists'),
      where('businessId', '==', businessId),
      where('status', '==', 'EXPORTED')
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
  const cleanDeliveryNote = deliveryNoteNumber ? deliveryNoteNumber.trim() : '';
  const hasDelivery = cleanDeliveryNote.length > 0;

  // Check if a DRAFT receiving already exists for this replenishment
  const existingDraft = await getDraftReceivingByReplenishment(businessId, replenishment.id);
  if (existingDraft) {
    if (cleanDeliveryNote && (!existingDraft.deliveryNoteNumber || existingDraft.deliveryNoteNumber !== cleanDeliveryNote)) {
      await updateDoc(doc(db, 'receivings', existingDraft.id), {
        hasDeliveryNote: true,
        deliveryNoteNumber: cleanDeliveryNote,
        updatedAt: new Date().toISOString()
      });
      existingDraft.hasDeliveryNote = true;
      existingDraft.deliveryNoteNumber = cleanDeliveryNote;
    }
    return existingDraft;
  }

  const receivingRef = doc(collection(db, 'receivings'));
  const now = new Date().toISOString();
  const refCode = `PED-${replenishment.id.slice(0, 6).toUpperCase()}`;

  // Check if provider confirmation exists on the replenishment or public order
  const providerItemsMap = new Map<string, number>();
  if (replenishment.providerResponse?.items) {
    replenishment.providerResponse.items.forEach(it => {
      providerItemsMap.set(it.productName, it.confirmedQuantity);
    });
  } else if (replenishment.publicShareToken || replenishment.publicShareCode) {
    try {
      const pOrder = await getPublicOrder(replenishment.publicShareToken || replenishment.publicShareCode || '');
      if (pOrder?.providerResponse?.items) {
        pOrder.providerResponse.items.forEach(it => {
          providerItemsMap.set(it.productName, it.confirmedQuantity);
        });
      }
    } catch (err) {
      console.warn('Could not load public order provider items for draft receiving:', err);
    }
  }

  const items: ReceivingItem[] = (replenishment.items || []).map((item) => {
    const hasConfirmed = providerItemsMap.has(item.productName);
    const confirmedQty = hasConfirmed ? providerItemsMap.get(item.productName) : undefined;
    // Default physical count to confirmed quantity if available, otherwise requested quantity
    const defaultReceivedQty = confirmedQty !== undefined ? confirmedQty : item.requestedQuantity;
    return {
      productId: item.productId,
      productName: item.productName,
      barcode: item.barcode || null,
      category: item.category,
      requestedQuantity: item.requestedQuantity,
      confirmedQuantity: confirmedQty,
      quantity: defaultReceivedQty,
      currentStockAtScan: item.currentStock
    };
  });

  const totalProductsCount = items.length;
  const totalUnitsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const newReceiving: Receiving = {
    id: receivingRef.id,
    businessId,
    supplierName: replenishment.supplierName?.trim() || 'Proveedor sin especificar',
    hasDeliveryNote: hasDelivery,
    deliveryNoteNumber: cleanDeliveryNote,
    status: 'DRAFT',
    items,
    totalProductsCount,
    totalUnitsCount,
    createdBy: userId,
    creatorName: creatorName || 'Vendedor',
    createdAt: now,
    updatedAt: now,
    replenishmentId: replenishment.id,
    replenishmentCode: refCode
  };

  await setDoc(receivingRef, newReceiving);

  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: creatorName,
    targetUserId: userId,
    action: 'RECEIVING_CREATED_FROM_REPLENISHMENT',
    details: `Pre-recepción creada a partir del pedido #${refCode} (${replenishment.supplierName || 'Sin proveedor'})${cleanDeliveryNote ? ` - Remito #${cleanDeliveryNote}` : ''}`
  });

  return newReceiving;
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

  await updateDoc(receivingRef, {
    items: cleanedItems,
    totalProductsCount,
    totalUnitsCount,
    updatedAt: now
  });
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

/**
 * ATOMIC TRANSACTION: Confirm Receiving
 * 1. Checks receiving is currently DRAFT (prevents double confirmation).
 * 2. Reads current stock of all products in transaction.
 * 3. Updates product stock in Firestore strictly by receivedQuantity (+ item.quantity).
 * 4. Creates inventory_movements records (type: RECEIPT).
 * 5. Changes receiving status to CONFIRMED with confirmation details.
 * 6. Updates replenishment list status to RECEIVED if linked.
 * 7. Logs audit logs (CONFIRMED, SHORTAGE, SURPLUS).
 */
export async function confirmReceivingTransaction(
  receivingId: string,
  businessId: string,
  userId: string,
  confirmerName: string,
  isUserAdmin: boolean = false
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

    await runTransaction(db, async (transaction) => {
      // 1. Fetch Receiving Doc
      const receivingSnap = await transaction.get(receivingRef);
      if (!receivingSnap.exists()) {
        throw new Error('La recepción especificada no existe.');
      }

      const receiving = receivingSnap.data() as Receiving;

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

      // 3. Process each item: update stock & queue inventory movement
      const movementsToCreate: InventoryMovement[] = [];

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
        const addedQuantity = Number(item.quantity) || 0; // MUST be receivedQuantity

        if (!Number.isFinite(addedQuantity) || addedQuantity < 0 || isNaN(addedQuantity)) {
          throw new Error(`La cantidad ingresada para "${item.productName}" es inválida.`);
        }

        // Check differences for auditing
        if (item.requestedQuantity !== undefined) {
          if (addedQuantity < item.requestedQuantity) {
            hasShortage = true;
          } else if (addedQuantity > item.requestedQuantity) {
            hasSurplus = true;
          }
        }

        // ONLY increment stock with receivedQuantity (> 0)
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

          movementsToCreate.push({
            id: movementRef.id,
            businessId: cleanBusinessId,
            productId: item.productId,
            productName: sanitizeString(item.productName, 150),
            type: 'RECEIPT',
            quantity: addedQuantity,
            previousStock,
            newStock,
            reason: sanitizeString(`Recepción de productos${deliveryInfo}${supplierInfo}${orderInfo}`, 255),
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

      // 4. Update Receiving status to CONFIRMED
      transaction.update(receivingRef, {
        status: 'CONFIRMED',
        confirmedBy: cleanUserId,
        confirmerName: cleanConfirmerName,
        confirmedAt: now,
        updatedAt: now
      });

      // 5. Update linked replenishment list status to RECEIVED
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
    });

    // Log Audit Events
    await logAdminAction({
      businessId: cleanBusinessId,
      adminId: cleanUserId,
      adminEmail: cleanConfirmerName,
      targetUserId: cleanUserId,
      action: 'RECEIVING_CONFIRMED',
      details: `Recepción #${cleanReceivingId} confirmada`
    });

    if (hasShortage) {
      await logAdminAction({
        businessId: cleanBusinessId,
        adminId: cleanUserId,
        adminEmail: cleanConfirmerName,
        targetUserId: cleanUserId,
        action: 'RECEIVING_WITH_SHORTAGE',
        details: `Recepción #${cleanReceivingId} confirmada con faltantes respecto al pedido`
      });
    }

    if (hasSurplus) {
      await logAdminAction({
        businessId: cleanBusinessId,
        adminId: cleanUserId,
        adminEmail: cleanConfirmerName,
        targetUserId: cleanUserId,
        action: 'RECEIVING_WITH_SURPLUS',
        details: `Recepción #${cleanReceivingId} confirmada con sobrantes respecto al pedido`
      });
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
