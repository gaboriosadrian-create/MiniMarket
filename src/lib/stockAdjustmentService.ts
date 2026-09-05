import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  runTransaction 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  StockAdjustment, 
  StockAdjustmentItem, 
  StockAdjustmentStatus, 
  InventoryMovement,
  OutboxOperation 
} from '../types';
import { withActionLock } from './rateLimit';
import { sanitizeInteger, sanitizeString } from './securityUtils';
import { localDataStore } from './localDataStore';
import { getDeviceId, generateOperationId } from './deviceId';

export const REASONS_IN = [
  'Productos entregados por dueño',
  'Productos encontrados',
  'Corrección de carga',
  'Otro ingreso'
] as const;

export const REASONS_OUT = [
  'Diferencia de inventario',
  'Producto dañado',
  'Producto vencido',
  'Merma',
  'Corrección de carga',
  'Otro ajuste'
] as const;

/**
 * Creates a confirmed stock adjustment (Online or Offline with Outbox fallback).
 * This allows direct fast adjustment or confirmation without an intermediate draft.
 */
export async function createConfirmedStockAdjustmentDirectly(
  businessId: string,
  userId: string,
  creatorName: string,
  items: StockAdjustmentItem[] = [],
  generalNotes: string = ''
): Promise<StockAdjustment> {
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  if (!isOnline) {
    return createOfflineStockAdjustment(businessId, userId, creatorName, items, generalNotes);
  }

  try {
    const draft = await createDraftStockAdjustment(businessId, userId, creatorName, items, generalNotes);
    await confirmStockAdjustmentTransaction(draft.id, businessId, userId, creatorName, true);
    
    // Save to local cache as synced
    const confirmedAdj: StockAdjustment = {
      ...draft,
      status: 'CONFIRMED',
      confirmedBy: userId,
      confirmerName: creatorName,
      confirmedAt: new Date().toISOString(),
      syncStatus: 'SYNCED',
      syncMode: 'ONLINE'
    };
    try {
      await localDataStore.saveOfflineStockAdjustment(confirmedAdj);
    } catch (e) {
      console.warn('[stockAdjustmentService] Error guardando copia local de ajuste online:', e);
    }
    return confirmedAdj;
  } catch (err: any) {
    console.warn('[stockAdjustmentService] Falló confirmación online de ajuste. Pasando a Outbox offline:', err);
    return createOfflineStockAdjustment(businessId, userId, creatorName, items, generalNotes);
  }
}

/**
 * Creates an offline confirmed stock adjustment and stores the operation in Outbox
 */
export async function createOfflineStockAdjustment(
  businessId: string,
  userId: string,
  creatorName: string,
  items: StockAdjustmentItem[] = [],
  generalNotes: string = ''
): Promise<StockAdjustment> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const operationId = generateOperationId();
  const adjustmentId = `adj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  // Consolidate duplicate items
  const consolidatedMap = new Map<string, StockAdjustmentItem>();
  for (const rawItem of items) {
    if (!rawItem.productId) continue;
    const qty = sanitizeInteger(rawItem.quantity, 1, 999999, 0);
    if (qty <= 0) continue;

    const key = `${rawItem.productId}_${rawItem.adjustmentType}`;
    const existing = consolidatedMap.get(key);
    if (existing) {
      existing.quantity += qty;
    } else {
      consolidatedMap.set(key, {
        productId: rawItem.productId,
        productName: String(rawItem.productName || 'Producto sin nombre').trim(),
        barcode: rawItem.barcode ? String(rawItem.barcode).trim() : null,
        category: rawItem.category ? String(rawItem.category).trim() : undefined,
        adjustmentType: rawItem.adjustmentType,
        quantity: qty,
        reason: rawItem.reason || (rawItem.adjustmentType === 'IN' ? 'Productos entregados por dueño' : 'Diferencia de inventario'),
        customReason: rawItem.customReason ? String(rawItem.customReason).trim() : undefined
      });
    }
  }

  const cleanedItems = Array.from(consolidatedMap.values());
  if (cleanedItems.length === 0) {
    throw new Error('El ajuste debe contener al menos un producto válido.');
  }

  const totalItemsCount = cleanedItems.length;
  const totalUnitsCount = cleanedItems.reduce((sum, item) => sum + item.quantity, 0);

  const localAdjustment: StockAdjustment = {
    id: adjustmentId,
    businessId: cleanBusinessId,
    items: cleanedItems,
    totalItemsCount,
    totalUnitsCount,
    status: 'CONFIRMED',
    createdBy: userId,
    creatorName: creatorName || 'Usuario',
    confirmedBy: userId,
    confirmerName: creatorName || 'Usuario',
    confirmedAt: now,
    createdAt: now,
    updatedAt: now,
    generalNotes: generalNotes.trim(),
    syncStatus: 'PENDING',
    syncMode: 'OFFLINE',
    syncedAt: null,
    deviceId,
    outboxOperationId: operationId
  };

  const outboxOp: OutboxOperation = {
    operationId,
    operationType: 'STOCK_ADJUSTMENT',
    businessId: cleanBusinessId,
    userId,
    userName: creatorName || 'Usuario',
    deviceId,
    adjustmentId,
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    payload: {
      businessId: cleanBusinessId,
      adjustmentId,
      items: cleanedItems,
      totalItemsCount,
      totalUnitsCount,
      createdBy: userId,
      creatorName,
      confirmedBy: userId,
      confirmerName: creatorName,
      confirmedAt: now,
      createdAt: now,
      generalNotes: generalNotes.trim(),
      deviceId
    },
    adjustmentSnapshot: localAdjustment,
    version: 1,
    syncedAt: null
  };

  await localDataStore.createOfflineStockAdjustmentTransaction(cleanBusinessId, localAdjustment, outboxOp);
  return localAdjustment;
}

/**
 * Creates a new StockAdjustment draft
 */
export async function createDraftStockAdjustment(
  businessId: string,
  userId: string,
  creatorName: string,
  items: StockAdjustmentItem[] = [],
  generalNotes: string = ''
): Promise<StockAdjustment> {
  const adjustmentRef = doc(collection(db, 'stock_adjustments'));
  const now = new Date().toISOString();

  let totalItemsCount = items.length;
  let totalUnitsCount = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);

  const newAdjustment: StockAdjustment = {
    id: adjustmentRef.id,
    businessId,
    items,
    totalItemsCount,
    totalUnitsCount,
    status: 'DRAFT',
    createdBy: userId,
    creatorName: creatorName || 'Usuario',
    createdAt: now,
    updatedAt: now,
    generalNotes: generalNotes.trim()
  };

  await setDoc(adjustmentRef, newAdjustment);
  return newAdjustment;
}

/**
 * Updates items in a DRAFT stock adjustment document
 */
export async function updateStockAdjustmentDraft(
  adjustmentId: string,
  items: StockAdjustmentItem[],
  currentUserId?: string,
  userBusinessId?: string,
  isUserAdmin: boolean = false,
  generalNotes?: string
): Promise<void> {
  const adjustmentRef = doc(db, 'stock_adjustments', adjustmentId);
  const docSnap = await getDoc(adjustmentRef);

  if (!docSnap.exists()) {
    throw new Error('El ajuste de stock especificado no existe.');
  }

  const adjustment = docSnap.data() as StockAdjustment;

  if (adjustment.status !== 'DRAFT') {
    throw new Error('No se puede modificar un ajuste de stock que no se encuentra en borrador.');
  }

  if (userBusinessId && adjustment.businessId !== userBusinessId) {
    throw new Error('Acceso denegado: Negocio no coincide.');
  }

  if (currentUserId && !isUserAdmin && adjustment.createdBy !== currentUserId) {
    throw new Error('Solo el usuario que creó este borrador puede modificarlo.');
  }

  // Consolidate duplicate items (same productId & same adjustmentType)
  const consolidatedMap = new Map<string, StockAdjustmentItem>();

  for (const rawItem of items) {
    if (!rawItem.productId) continue;
    const qty = Math.floor(Number(rawItem.quantity));
    if (!Number.isFinite(qty) || qty <= 0 || isNaN(qty)) continue;

    const key = `${rawItem.productId}_${rawItem.adjustmentType}`;
    const existing = consolidatedMap.get(key);

    if (existing) {
      existing.quantity += qty;
      // keep latest reason if provided
      if (rawItem.reason) {
        existing.reason = rawItem.reason;
        existing.customReason = rawItem.customReason;
      }
    } else {
      consolidatedMap.set(key, {
        productId: rawItem.productId,
        productName: String(rawItem.productName || 'Producto sin nombre').trim(),
        barcode: rawItem.barcode ? String(rawItem.barcode).trim() : null,
        category: rawItem.category ? String(rawItem.category).trim() : undefined,
        adjustmentType: rawItem.adjustmentType,
        quantity: qty,
        reason: rawItem.reason || (rawItem.adjustmentType === 'IN' ? 'Productos entregados por dueño' : 'Diferencia de inventario'),
        customReason: rawItem.customReason ? String(rawItem.customReason).trim() : undefined
      });
    }
  }

  const cleanedItems = Array.from(consolidatedMap.values());
  const totalUnitsCount = cleanedItems.reduce((sum, i) => sum + i.quantity, 0);

  const now = new Date().toISOString();
  await updateDoc(adjustmentRef, {
    items: cleanedItems,
    totalItemsCount: cleanedItems.length,
    totalUnitsCount,
    generalNotes: generalNotes !== undefined ? generalNotes.trim() : (adjustment.generalNotes || ''),
    updatedAt: now
  });
}

/**
 * ATOMIC TRANSACTION: Confirms stock adjustment
 * 1. Checks adjustment is DRAFT (prevents double confirmation).
 * 2. Reads current stock of all products in transaction.
 * 3. Validates that for OUT adjustments, current stock >= quantity.
 * 4. Updates product stock in Firestore (+ or - quantity).
 * 5. Creates inventory_movements records (type: ADJUSTMENT_IN or ADJUSTMENT_OUT).
 * 6. Creates audit_log record.
 * 7. Changes adjustment status to CONFIRMED.
 */
export async function confirmStockAdjustmentTransaction(
  adjustmentId: string,
  businessId: string,
  userId: string,
  confirmerName: string,
  isUserAdmin: boolean = false
): Promise<void> {
  const cleanAdjustmentId = sanitizeString(adjustmentId, 64);
  const cleanBusinessId = sanitizeString(businessId, 64);
  const cleanUserId = sanitizeString(userId, 64);
  const cleanConfirmerName = sanitizeString(confirmerName, 128) || 'Usuario';

  if (!cleanAdjustmentId) throw new Error('ID de ajuste no válido.');
  if (!cleanBusinessId) throw new Error('ID de negocio no válido.');
  if (!cleanUserId) throw new Error('ID de usuario no válido.');

  return withActionLock(`confirm_adj_${cleanAdjustmentId}`, async () => {
    const adjustmentRef = doc(db, 'stock_adjustments', cleanAdjustmentId);
    const now = new Date().toISOString();

    await runTransaction(db, async (transaction) => {
      // 1. Fetch Adjustment Doc
      const adjustmentSnap = await transaction.get(adjustmentRef);
      if (!adjustmentSnap.exists()) {
        throw new Error('El ajuste de stock especificado no existe.');
      }

      const adjustment = adjustmentSnap.data() as StockAdjustment;

      if (adjustment.status !== 'DRAFT') {
        throw new Error(`No se puede confirmar un ajuste con estado "${adjustment.status}". Solo se pueden confirmar borradores.`);
      }

      if (adjustment.businessId !== cleanBusinessId) {
        throw new Error('Acceso denegado: El ajuste no pertenece a tu negocio.');
      }

      if (adjustment.createdBy !== cleanUserId && !isUserAdmin) {
        throw new Error('Acceso denegado: Solo el creador del ajuste puede confirmarlo.');
      }

      if (!adjustment.items || adjustment.items.length === 0) {
        throw new Error('El ajuste no contiene ningún producto.');
      }

      // Consolidate items if necessary
      const consolidatedMap = new Map<string, StockAdjustmentItem>();
      for (const rawItem of adjustment.items) {
        if (!rawItem.productId) continue;
        const qty = sanitizeInteger(rawItem.quantity, 1, 999999, 0);
        if (qty <= 0) continue;

        const key = `${rawItem.productId}_${rawItem.adjustmentType}`;
        const existing = consolidatedMap.get(key);
        if (existing) {
          existing.quantity += qty;
        } else {
          consolidatedMap.set(key, { ...rawItem, quantity: qty });
        }
      }

      const itemsToProcess = Array.from(consolidatedMap.values());
      if (itemsToProcess.length === 0) {
        throw new Error('Los productos en el ajuste tienen cantidades inválidas.');
      }

      // 2. Fetch all product documents in transaction
      const productSnaps = await Promise.all(
        itemsToProcess.map((item) => transaction.get(doc(db, 'products', item.productId)))
      );

      // 3. Process each item: update stock & queue inventory movement
      const processedItems: StockAdjustmentItem[] = [];

      for (let i = 0; i < itemsToProcess.length; i++) {
        const item = itemsToProcess[i];
        const productSnap = productSnaps[i];

        if (!productSnap.exists()) {
          throw new Error(`El producto "${item.productName}" (ID: ${item.productId}) ya no existe en el catálogo.`);
        }

        const productData = productSnap.data();

        if (productData.businessId !== cleanBusinessId) {
          throw new Error(`El producto "${item.productName}" pertenece a otro negocio.`);
        }

        const previousStock = Number(productData.stock) || 0;
        const qty = item.quantity;

        if (!Number.isFinite(qty) || qty <= 0 || isNaN(qty)) {
          throw new Error(`La cantidad especificada para "${item.productName}" es inválida.`);
        }

        let newStock = previousStock;

        if (item.adjustmentType === 'IN') {
          newStock = previousStock + qty;
        } else if (item.adjustmentType === 'OUT') {
          if (previousStock < qty) {
            throw new Error(`Stock insuficiente para "${item.productName}". Disponible: ${previousStock}, intentado retirar: ${qty}.`);
          }
          newStock = previousStock - qty;
        }

        // Update product stock in transaction
        const productRef = doc(db, 'products', item.productId);
        transaction.update(productRef, {
          stock: newStock,
          updatedAt: now
        });

        // Reason string
        const resolvedReason = (item.reason === 'Otro ingreso' || item.reason === 'Otro ajuste')
          ? (item.customReason?.trim() || item.reason)
          : item.reason;

        // Create inventory movement
        const movementRef = doc(collection(db, 'inventory_movements'));
        const movement: InventoryMovement = {
          id: movementRef.id,
          businessId: cleanBusinessId,
          productId: item.productId,
          productName: sanitizeString(item.productName, 150),
          type: item.adjustmentType === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
          quantity: item.adjustmentType === 'IN' ? qty : -qty,
          previousStock,
          newStock,
          reason: sanitizeString(resolvedReason, 255),
          createdAt: now,
          userId: cleanUserId,
          adjustmentId: cleanAdjustmentId
        };

        transaction.set(movementRef, movement);

        processedItems.push({
          ...item,
          previousStock,
          newStock,
          reason: resolvedReason
        });
      }

      // 4. Log Audit Entry
      const auditRef = doc(collection(db, 'audit_logs'));
      transaction.set(auditRef, {
        businessId: cleanBusinessId,
        adminId: cleanUserId,
        adminEmail: cleanConfirmerName,
        targetUserId: cleanUserId,
        targetUserEmail: cleanConfirmerName,
        action: 'STOCK_ADJUSTMENT_CONFIRMED',
        details: `Ajuste de stock confirmado (${cleanAdjustmentId}): ${processedItems.length} producto(s) ajustado(s).`,
        createdAt: now
      });

      // 5. Update StockAdjustment status to CONFIRMED
      transaction.update(adjustmentRef, {
        status: 'CONFIRMED',
        items: processedItems,
        confirmedBy: cleanUserId,
        confirmerName: cleanConfirmerName,
        confirmedAt: now,
        updatedAt: now
      });
    });
  });
}

/**
 * Idempotent synchronization of an offline stock adjustment to Firestore
 */
export async function syncStockAdjustmentOperationToFirestore(
  op: OutboxOperation
): Promise<{ success: boolean; status: 'SYNCED' | 'STOCK_CONFLICT' | 'ERROR'; error?: string }> {
  if (op.operationType !== 'STOCK_ADJUSTMENT' || !op.adjustmentSnapshot) {
    return { success: false, status: 'ERROR', error: 'Operación de ajuste de stock no válida.' };
  }

  const adj = op.adjustmentSnapshot;
  const adjustmentId = op.adjustmentId || adj.id || op.operationId;
  const cleanBusinessId = sanitizeString(op.businessId, 64);
  const now = new Date().toISOString();

  return withActionLock(`sync_adj_${adjustmentId}`, async () => {
    try {
      const adjustmentRef = doc(db, 'stock_adjustments', adjustmentId);

      // 1. Idempotency check: if document already exists as CONFIRMED in Firestore, consider it already synced
      const existingSnap = await getDoc(adjustmentRef);
      if (existingSnap.exists()) {
        const existingData = existingSnap.data() as StockAdjustment;
        if (existingData.status === 'CONFIRMED') {
          // Already confirmed and synced in Firestore
          await localDataStore.saveOfflineStockAdjustment({
            ...adj,
            id: adjustmentId,
            syncStatus: 'SYNCED',
            syncedAt: now,
            syncError: undefined
          });
          return { success: true, status: 'SYNCED' };
        }
      }

      // 2. Perform atomic transaction on Firestore
      let conflictError: string | null = null;

      await runTransaction(db, async (transaction) => {
        const itemsToProcess = adj.items || [];
        if (itemsToProcess.length === 0) {
          throw new Error('El ajuste no contiene productos.');
        }

        // Fetch all product docs
        const productSnaps = await Promise.all(
          itemsToProcess.map((item) => transaction.get(doc(db, 'products', item.productId)))
        );

        const processedItems: StockAdjustmentItem[] = [];
        const movementsToCreate: InventoryMovement[] = [];

        for (let i = 0; i < itemsToProcess.length; i++) {
          const item = itemsToProcess[i];
          const productSnap = productSnaps[i];

          if (!productSnap.exists()) {
            throw new Error(`El producto "${item.productName}" no existe en Firestore.`);
          }

          const productData = productSnap.data();
          const previousStock = Number(productData.stock) || 0;
          const qty = Number(item.quantity) || 0;

          if (qty <= 0) continue;

          let newStock = previousStock;

          if (item.adjustmentType === 'IN') {
            newStock = previousStock + qty;
          } else if (item.adjustmentType === 'OUT') {
            // Check for stock insufficiency in Firestore
            if (previousStock < qty) {
              conflictError = `Stock insuficiente en servidor para "${item.productName}". Disponible en servidor: ${previousStock}, requerido: ${qty}.`;
              throw new Error(conflictError);
            }
            newStock = previousStock - qty;
          }

          // Update product stock
          const productRef = doc(db, 'products', item.productId);
          transaction.update(productRef, {
            stock: newStock,
            updatedAt: now
          });

          // Create inventory movement
          const movementRef = doc(collection(db, 'inventory_movements'));
          const movement: InventoryMovement = {
            id: movementRef.id,
            businessId: cleanBusinessId,
            productId: item.productId,
            productName: sanitizeString(item.productName, 150),
            type: item.adjustmentType === 'IN' ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT',
            quantity: item.adjustmentType === 'IN' ? qty : -qty,
            previousStock,
            newStock,
            reason: sanitizeString(item.reason || 'Ajuste de inventario offline sincronizado', 255),
            createdAt: now,
            userId: op.userId,
            adjustmentId
          };

          movementsToCreate.push(movement);

          processedItems.push({
            ...item,
            previousStock,
            newStock
          });
        }

        // Set all movements
        for (const mov of movementsToCreate) {
          transaction.set(doc(db, 'inventory_movements', mov.id), mov);
        }

        // Set adjustment document
        transaction.set(adjustmentRef, {
          id: adjustmentId,
          businessId: cleanBusinessId,
          items: processedItems,
          totalItemsCount: processedItems.length,
          totalUnitsCount: processedItems.reduce((sum, it) => sum + it.quantity, 0),
          status: 'CONFIRMED',
          createdBy: adj.createdBy || op.userId,
          creatorName: adj.creatorName || op.userName,
          confirmedBy: adj.confirmedBy || op.userId,
          confirmerName: adj.confirmerName || op.userName,
          confirmedAt: adj.confirmedAt || now,
          createdAt: adj.createdAt || now,
          updatedAt: now,
          generalNotes: adj.generalNotes || '',
          deviceId: op.deviceId,
          syncedAt: now
        }, { merge: true });

        // Log audit entry
        const auditRef = doc(collection(db, 'audit_logs'));
        transaction.set(auditRef, {
          businessId: cleanBusinessId,
          adminId: op.userId,
          adminEmail: op.userName,
          targetUserId: op.userId,
          action: 'STOCK_ADJUSTMENT_SYNCED',
          details: `Ajuste de stock offline #${adjustmentId} sincronizado con éxito.`,
          createdAt: now
        });
      });

      // Update local record to SYNCED
      await localDataStore.saveOfflineStockAdjustment({
        ...adj,
        id: adjustmentId,
        syncStatus: 'SYNCED',
        syncedAt: now,
        syncError: undefined
      });

      return { success: true, status: 'SYNCED' };
    } catch (err: any) {
      console.error('[stockAdjustmentService] Error sincronizando ajuste a Firestore:', err);
      const isConflict = err?.message && err.message.includes('Stock insuficiente');
      return {
        success: false,
        status: isConflict ? 'STOCK_CONFLICT' : 'ERROR',
        error: err?.message || 'Error de sincronización con el servidor.'
      };
    }
  });
}

/**
 * Retrieves stock adjustments for a business:
 * Combines online Firestore records with local offline records from IndexedDB
 */
export async function getStockAdjustmentsByBusiness(
  businessId: string
): Promise<StockAdjustment[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  let onlineAdjustments: StockAdjustment[] = [];

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    try {
      const q = query(
        collection(db, 'stock_adjustments'),
        where('businessId', '==', cleanBusinessId)
      );
      const snapshot = await getDocs(q);

      onlineAdjustments = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
        syncStatus: 'SYNCED',
        syncMode: 'ONLINE'
      })) as StockAdjustment[];
    } catch (err) {
      console.warn('[stockAdjustmentService] Error obteniendo ajustes de Firestore:', err);
    }
  }

  // 2. Fetch local adjustments from IndexedDB
  let localAdjustments: StockAdjustment[] = [];
  try {
    localAdjustments = await localDataStore.getOfflineStockAdjustmentsByBusiness(cleanBusinessId);
  } catch (err) {
    console.warn('[stockAdjustmentService] Error obteniendo ajustes locales de IndexedDB:', err);
  }

  // 3. Merge and deduplicate by ID
  const map = new Map<string, StockAdjustment>();

  for (const a of localAdjustments) {
    if (a.id) map.set(a.id, a);
  }

  for (const a of onlineAdjustments) {
    if (a.id) {
      map.set(a.id, {
        ...a,
        syncStatus: 'SYNCED',
        syncMode: a.syncMode || 'ONLINE'
      });
    }
  }

  const merged = Array.from(map.values());
  return merged.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

/**
 * Deletes a DRAFT stock adjustment
 */
export async function deleteStockAdjustmentDraft(
  adjustmentId: string,
  userId: string,
  businessId: string,
  isUserAdmin: boolean = false
): Promise<void> {
  const adjustmentRef = doc(db, 'stock_adjustments', adjustmentId);
  const snap = await getDoc(adjustmentRef);

  if (!snap.exists()) return;

  const data = snap.data() as StockAdjustment;

  if (data.status !== 'DRAFT') {
    throw new Error('No se pueden eliminar ajustes que ya fueron confirmados.');
  }

  if (data.businessId !== businessId) {
    throw new Error('Acceso denegado: Negocio no coincide.');
  }

  if (data.createdBy !== userId && !isUserAdmin) {
    throw new Error('Acceso denegado: Solo el creador del borrador puede eliminarlo.');
  }

  await updateDoc(adjustmentRef, {
    status: 'CANCELLED',
    updatedAt: new Date().toISOString()
  });
}

