import { 
  collection, 
  doc, 
  runTransaction,
  getDocs,
  getDoc,
  query,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { Sale, SaleItem, ComboItem, Product, InventoryMovement, OutboxOperation, PaymentMethod, PaymentBreakdown, PaymentVerification, PaymentDetails } from '../types';
import { withActionLock } from './rateLimit';
import { sanitizeInteger, sanitizeNumber, sanitizeString, sanitizeBarcode, cleanFirestoreData } from './securityUtils';
import { localDataStore } from './localDataStore';
import { generateSaleId, generateOperationId, getDeviceId } from './deviceId';
import { extractAndNormalizeSaleItems } from './offlineRepairUtils';

export interface ProcessSaleInput {
  businessId: string;
  sellerId: string;
  sellerName: string;
  items: {
    product: Product;
    quantity: number;
  }[];
  total: number;
  paymentMethod: PaymentMethod;
  paymentVerification?: PaymentVerification;
  paymentDetails?: PaymentDetails;
  requiresOnlinePaymentVerification?: boolean;
  paymentBreakdown?: PaymentBreakdown;
  cashReceived?: number;
  change?: number;
  saleId?: string;
  deviceId?: string;
}

/**
 * Validates a Sale object structure before it is persisted to Firestore or IndexedDB.
 * Throws a descriptive error if mandatory fields are missing or invalid.
 */
export function validateSaleBeforePersist(sale: Sale): void {
  if (!sale || typeof sale !== 'object') {
    throw new Error('[Sale Validation Error] El objeto Sale es nulo o inválido.');
  }

  const saleId = sale.id || 'DESCONOCIDO';

  if (!sale.id || typeof sale.id !== 'string' || sale.id.trim() === '') {
    throw new Error(`[Sale Validation Error] saleId: ${saleId}, campo faltante: id`);
  }
  if (!sale.businessId || typeof sale.businessId !== 'string' || sale.businessId.trim() === '') {
    throw new Error(`[Sale Validation Error] saleId: ${saleId}, campo faltante: businessId`);
  }
  if (!sale.sellerId || typeof sale.sellerId !== 'string' || sale.sellerId.trim() === '') {
    throw new Error(`[Sale Validation Error] saleId: ${saleId}, campo faltante: sellerId`);
  }
  if (!Array.isArray(sale.items) || sale.items.length === 0) {
    throw new Error(`[Sale Validation Error] saleId: ${saleId}, campo faltante o vacío: items`);
  }

  for (let i = 0; i < sale.items.length; i++) {
    const item = sale.items[i];
    if (!item || typeof item !== 'object') {
      throw new Error(`[Sale Validation Error] saleId: ${saleId}, item[${i}] inválido`);
    }
    if (!item.productId || typeof item.productId !== 'string') {
      throw new Error(`[Sale Validation Error] saleId: ${saleId}, campo faltante en item[${i}]: productId`);
    }
    if (!item.productName || typeof item.productName !== 'string') {
      throw new Error(`[Sale Validation Error] saleId: ${saleId}, campo faltante en item[${i}]: productName`);
    }
    if (typeof item.quantity !== 'number' || item.quantity <= 0 || isNaN(item.quantity)) {
      throw new Error(`[Sale Validation Error] saleId: ${saleId}, cantidad inválida en item[${i}]: ${item.quantity}`);
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0 || isNaN(item.unitPrice)) {
      throw new Error(`[Sale Validation Error] saleId: ${saleId}, precio unitario inválido en item[${i}]: ${item.unitPrice}`);
    }
    if (typeof item.subtotal !== 'number' || item.subtotal < 0 || isNaN(item.subtotal)) {
      throw new Error(`[Sale Validation Error] saleId: ${saleId}, subtotal inválido en item[${i}]: ${item.subtotal}`);
    }
  }

  if (typeof sale.total !== 'number' || sale.total < 0 || isNaN(sale.total)) {
    throw new Error(`[Sale Validation Error] saleId: ${saleId}, total inválido: ${sale.total}`);
  }
  if (!sale.paymentMethod || typeof sale.paymentMethod !== 'string') {
    throw new Error(`[Sale Validation Error] saleId: ${saleId}, campo faltante: paymentMethod`);
  }
}

/**
 * Sanitizes a Sale object specifically for Firestore persistence.
 * - Strips all `undefined` values at all nesting levels.
 * - Preserves numbers (including 0), booleans (including false), empty strings, and nulls.
 * - Formats items, payment breakdown, and metadata explicitly.
 */
export function sanitizeSaleForFirestore(sale: Sale): Record<string, any> {
  // 1. Validate structure
  validateSaleBeforePersist(sale);

  // 2. Diagnostic log if any undefined values are present in raw object
  const undefinedKeys: string[] = [];
  for (const [k, v] of Object.entries(sale)) {
    if (v === undefined) undefinedKeys.push(k);
  }
  if (Array.isArray(sale.items)) {
    sale.items.forEach((it, idx) => {
      for (const [k, v] of Object.entries(it)) {
        if (v === undefined) undefinedKeys.push(`items[${idx}].${k}`);
      }
    });
  }

  if (undefinedKeys.length > 0) {
    console.warn(`[SALE DEBUG] Sanitizando venta ${sale.id} con campos undefined detectados:`, undefinedKeys);
  }

  // 3. Clean items array explicitly
  const cleanItems = sale.items.map((it) => {
    const itemObj: Record<string, any> = {
      productId: sanitizeString(it.productId, 64),
      productName: sanitizeString(it.productName, 150),
      category: sanitizeString(it.category || 'General', 80),
      barcode: it.barcode ? sanitizeBarcode(it.barcode) : null,
      quantity: sanitizeInteger(it.quantity, 1, 999999, 1),
      unitPrice: sanitizeNumber(it.unitPrice, 0, 999999999, 0),
      unitCost: sanitizeNumber(it.unitCost !== undefined ? it.unitCost : (it as any).costPrice, 0, 999999999, 0),
      subtotal: sanitizeNumber(it.subtotal, 0, 999999999, 0)
    };

    if (it.isCombo === true) {
      itemObj.isCombo = true;
      if (Array.isArray(it.comboItems) && it.comboItems.length > 0) {
        itemObj.comboItems = it.comboItems.map((c) => ({
          productId: sanitizeString(c.productId, 64),
          productName: sanitizeString(c.productName || '', 150),
          quantity: sanitizeInteger(c.quantity, 1, 999999, 1),
          unitCost: sanitizeNumber(c.unitCost !== undefined ? c.unitCost : (c as any).costPrice, 0, 999999999, 0)
        }));
      }
    }

    return itemObj;
  });

  // 4. Construct sanitized object
  const sanitized: Record<string, any> = {
    id: sanitizeString(sale.id, 64),
    businessId: sanitizeString(sale.businessId, 64),
    sellerId: sanitizeString(sale.sellerId, 64),
    sellerName: sanitizeString(sale.sellerName, 128) || 'Vendedor',
    items: cleanItems,
    total: sanitizeNumber(sale.total, 0, 999999999, 0),
    paymentMethod: sale.paymentMethod || 'EFECTIVO',
    status: sale.status || 'COMPLETED',
    createdAt: sale.createdAt || new Date().toISOString(),
    syncStatus: sale.syncStatus || 'SYNCED',
    syncMode: sale.syncMode || 'ONLINE',
    syncedAt: sale.syncedAt !== undefined ? sale.syncedAt : new Date().toISOString()
  };

  if (sale.deviceId && typeof sale.deviceId === 'string' && sale.deviceId.trim() !== '') {
    sanitized.deviceId = sanitizeString(sale.deviceId, 128);
  }

  if (sale.outboxOperationId && typeof sale.outboxOperationId === 'string' && sale.outboxOperationId.trim() !== '') {
    sanitized.outboxOperationId = sanitizeString(sale.outboxOperationId, 128);
  }

  if (sale.syncError && typeof sale.syncError === 'string' && sale.syncError.trim() !== '') {
    sanitized.syncError = sanitizeString(sale.syncError, 500);
  }

  if (sale.paymentVerification && typeof sale.paymentVerification === 'string') {
    sanitized.paymentVerification = sanitizeString(sale.paymentVerification, 32);
  }

  if (sale.offline !== undefined) {
    sanitized.offline = Boolean(sale.offline);
  }

  if (sale.paymentDetails && typeof sale.paymentDetails === 'object') {
    const pd: Record<string, any> = {};
    if (sale.paymentDetails.mode) pd.mode = sanitizeString(sale.paymentDetails.mode, 32);
    if (sale.paymentDetails.verification) pd.verification = sanitizeString(sale.paymentDetails.verification, 32);
    if (sale.paymentDetails.notes) pd.notes = sanitizeString(sale.paymentDetails.notes, 255);
    if (sale.paymentDetails.orderId) pd.orderId = sanitizeString(sale.paymentDetails.orderId, 128);
    if (sale.paymentDetails.paymentId) pd.paymentId = sanitizeString(sale.paymentDetails.paymentId, 128);
    if (sale.paymentDetails.operationId) pd.operationId = sanitizeString(sale.paymentDetails.operationId, 128);
    if (sale.paymentDetails.externalReference) pd.externalReference = sanitizeString(sale.paymentDetails.externalReference, 128);
    if (sale.paymentDetails.verifiedAt) pd.verifiedAt = sanitizeString(sale.paymentDetails.verifiedAt, 64);
    if (sale.paymentDetails.mercadoPagoSource) pd.mercadoPagoSource = sanitizeString(sale.paymentDetails.mercadoPagoSource, 64);
    if (typeof sale.paymentDetails.amount === 'number' && !isNaN(sale.paymentDetails.amount)) {
      pd.amount = sanitizeNumber(sale.paymentDetails.amount, 0, 999999999, 0);
    }
    if (sale.paymentDetails.currency) pd.currency = sanitizeString(sale.paymentDetails.currency, 16);
    if (sale.paymentDetails.paymentStatus) pd.paymentStatus = sanitizeString(sale.paymentDetails.paymentStatus, 32);
    sanitized.paymentDetails = pd;
  }

  if (typeof sale.cashReceived === 'number' && !isNaN(sale.cashReceived)) {
    sanitized.cashReceived = sanitizeNumber(sale.cashReceived, 0, 999999999, 0);
  }

  if (typeof sale.change === 'number' && !isNaN(sale.change)) {
    sanitized.change = sanitizeNumber(sale.change, 0, 999999999, 0);
  }

  if (sale.paymentBreakdown && typeof sale.paymentBreakdown === 'object') {
    const pb: Record<string, any> = {
      cashAmount: sanitizeNumber(sale.paymentBreakdown.cashAmount, 0, 999999999, 0),
      mpAmount: sanitizeNumber(sale.paymentBreakdown.mpAmount, 0, 999999999, 0)
    };
    if (typeof sale.paymentBreakdown.cashReceived === 'number' && !isNaN(sale.paymentBreakdown.cashReceived)) {
      pb.cashReceived = sanitizeNumber(sale.paymentBreakdown.cashReceived, 0, 999999999, 0);
    }
    if (typeof sale.paymentBreakdown.change === 'number' && !isNaN(sale.paymentBreakdown.change)) {
      pb.change = sanitizeNumber(sale.paymentBreakdown.change, 0, 999999999, 0);
    }
    sanitized.paymentBreakdown = pb;
  }

  // 5. Final recursive clean
  return cleanFirestoreData(sanitized);
}

/**
 * Sanitizes an InventoryMovement object for Firestore persistence.
 * Prevents any undefined fields from crashing Firestore transactions.
 */
export function sanitizeMovementForFirestore(movement: InventoryMovement): Record<string, any> {
  const sanitized: Record<string, any> = {
    id: sanitizeString(movement.id, 64),
    businessId: sanitizeString(movement.businessId, 64),
    productId: sanitizeString(movement.productId, 64),
    productName: sanitizeString(movement.productName || '', 150),
    type: movement.type || 'SALE',
    quantity: sanitizeInteger(movement.quantity, 1, 999999, 1),
    previousStock: sanitizeNumber(movement.previousStock, -999999, 999999, 0),
    newStock: sanitizeNumber(movement.newStock, -999999, 999999, 0),
    reason: sanitizeString(movement.reason || 'Venta', 255),
    createdAt: movement.createdAt || new Date().toISOString(),
    userId: sanitizeString(movement.userId, 64)
  };

  if (movement.saleId && typeof movement.saleId === 'string' && movement.saleId.trim() !== '') {
    sanitized.saleId = sanitizeString(movement.saleId, 64);
  }
  if (movement.receivingId && typeof movement.receivingId === 'string' && movement.receivingId.trim() !== '') {
    sanitized.receivingId = sanitizeString(movement.receivingId, 64);
  }
  if (movement.replenishmentId && typeof movement.replenishmentId === 'string' && movement.replenishmentId.trim() !== '') {
    sanitized.replenishmentId = sanitizeString(movement.replenishmentId, 64);
  }
  if (movement.purchaseId && typeof movement.purchaseId === 'string' && movement.purchaseId.trim() !== '') {
    sanitized.purchaseId = sanitizeString(movement.purchaseId, 64);
  }
  if (movement.adjustmentId && typeof movement.adjustmentId === 'string' && movement.adjustmentId.trim() !== '') {
    sanitized.adjustmentId = sanitizeString(movement.adjustmentId, 64);
  }

  return cleanFirestoreData(sanitized);
}


/**
 * Fetches completed sales for a business:
 * Combines online Firestore sales with local offline sales from IndexedDB (Outbox / Offline cache),
 * deduplicating by sale id and sorting descending by createdAt.
 */
export async function getSalesByBusiness(
  businessId: string, 
  startDateIso?: string, 
  endDateIso?: string
): Promise<Sale[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  let onlineSales: Sale[] = [];

  // 1. Try to fetch from Firestore if network is available
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    try {
      const salesRef = collection(db, 'sales');
      const q = query(salesRef, where('businessId', '==', cleanBusinessId));
      const snap = await getDocs(q);

      snap.forEach((docSnap) => {
        onlineSales.push({
          id: docSnap.id,
          ...docSnap.data()
        } as Sale);
      });
    } catch (err) {
      console.warn('[saleService] Error obteniendo ventas de Firestore, usando fallback local:', err);
    }
  }

  // 2. Fetch local offline sales from IndexedDB
  let localSales: Sale[] = [];
  try {
    localSales = await localDataStore.getOfflineSalesByBusiness(cleanBusinessId);
  } catch (err) {
    console.warn('[saleService] Error obteniendo ventas offline de IndexedDB:', err);
  }

  // 3. Merge and deduplicate by sale ID (prioritizing the most up-to-date state)
  const salesMap = new Map<string, Sale>();

  // Add local sales first
  for (const s of localSales) {
    if (s.id) salesMap.set(s.id, s);
  }

  // Add/overwrite with online sales (which are confirmed in Firestore)
  for (const s of onlineSales) {
    if (s.id) {
      salesMap.set(s.id, {
        ...s,
        syncStatus: 'SYNCED',
        syncMode: s.syncMode || 'ONLINE'
      });
    }
  }

  let mergedSales = Array.from(salesMap.values());

  // 4. Filter by date range if provided
  if (startDateIso || endDateIso) {
    mergedSales = mergedSales.filter((s) => {
      if (!s.createdAt) return false;
      if (startDateIso && s.createdAt < startDateIso) return false;
      if (endDateIso && s.createdAt > endDateIso) return false;
      return true;
    });
  }

  // 5. Sort descending by createdAt
  mergedSales.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return mergedSales;
}

/**
 * Executes a sale either Online (via Firestore Transaction) or Offline (via Local Outbox + Local Stock Deduction).
 * If online execution fails due to network outage, it automatically falls back to offline Outbox so no sale is ever lost.
 */
export async function processSale(input: ProcessSaleInput): Promise<Sale> {
  const cleanBusinessId = sanitizeString(input.businessId, 64);
  const cleanSellerId = sanitizeString(input.sellerId, 64);
  const cleanSellerName = sanitizeString(input.sellerName, 128) || 'Vendedor';
  const saleId = input.saleId || generateSaleId();
  const deviceId = input.deviceId || getDeviceId();
  const operationId = generateOperationId();

  if (!cleanBusinessId) throw new Error('El ID de negocio es requerido.');
  if (!cleanSellerId) throw new Error('El ID de vendedor es requerido.');
  if (!input.items || input.items.length === 0) {
    throw new Error('El carrito no contiene productos.');
  }

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ----------------------------------------------------
  // CASE A: EXPLICITLY OFFLINE OR FALLBACK
  // ----------------------------------------------------
  if (!isOnline) {
    return processOfflineSale(input, saleId, deviceId, operationId);
  }

  // Validation: For Online Mercado Pago / Combinado with MP, payment must be verified when online checkout is active
  const isMpPayment = input.paymentMethod === 'MERCADO_PAGO' || (input.paymentMethod === 'COMBINADO' && (input.paymentBreakdown?.mpAmount || 0) > 0);

  // Differentiate registered payment method from active online checkout execution:
  // Verification of accredited payment MUST run ONLY when an active online Mercado Pago flow is being executed.
  // If Mercado Pago is deactivated (INTEGRATION_DISABLED, requiresOnlinePaymentVerification: false, or manual mode),
  // it is treated as a manual registration without requiring online verification or external API validation.
  const requiresOnlineVerification = isMpPayment && (
    input.requiresOnlinePaymentVerification !== undefined
      ? Boolean(input.requiresOnlinePaymentVerification)
      : (
          input.paymentDetails?.mode !== 'INTEGRATION_DISABLED' &&
          input.paymentDetails?.mode !== 'OFFLINE' &&
          input.paymentVerification !== 'MANUAL'
        )
  );

  if (requiresOnlineVerification) {
    if (input.paymentVerification !== 'AUTOMATIC' && input.paymentVerification !== 'MERCADOPAGO_VERIFIED') {
      throw new Error('La venta con Mercado Pago no puede confirmarse sin verificación previa del pago acreditado.');
    }

    if (input.paymentDetails?.externalReference && typeof window !== 'undefined' && window.fetch) {
      try {
        const expectedAmount = input.paymentMethod === 'COMBINADO' ? Number(input.paymentBreakdown?.mpAmount) : input.total;
        const resp = await fetch('/api/mercadopago/validate-sale', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            externalReference: input.paymentDetails.externalReference,
            orderId: input.paymentDetails.orderId,
            expectedAmount,
            businessId: cleanBusinessId,
          }),
        });
        if (resp.ok) {
          const resData = await resp.json();
          if (resData?.order?.paymentId && !input.paymentDetails.paymentId) {
            input.paymentDetails.paymentId = String(resData.order.paymentId);
          }
          if (resData?.order?.orderId && !input.paymentDetails.orderId) {
            input.paymentDetails.orderId = String(resData.order.orderId);
          }
        } else {
          const errData = await resp.json().catch(() => ({}));
          if (errData?.reason) {
            throw new Error(`Validación de Mercado Pago rechazada: ${errData.reason}`);
          }
        }
      } catch (e: any) {
        if (e.message?.includes('Validación de Mercado Pago rechazada')) {
          throw e;
        }
      }
    }
  }

  // ----------------------------------------------------
  // CASE B: ONLINE FLOW WITH ACTION LOCK
  // ----------------------------------------------------
  const lockKey = `sale_action_${cleanBusinessId}_${cleanSellerId}`;

  return withActionLock(lockKey, async () => {
    try {
      return await executeOnlineFirestoreSale(input, saleId, deviceId, operationId);
    } catch (err: any) {
      // Check if the error was a network connectivity failure
      const isNetworkError = 
        !navigator.onLine ||
        err?.code === 'unavailable' ||
        err?.code === 'deadline-exceeded' ||
        err?.message?.toLowerCase().includes('network') ||
        err?.message?.toLowerCase().includes('offline') ||
        err?.message?.toLowerCase().includes('failed to fetch');

      if (isNetworkError) {
        console.warn('[saleService] Conexión perdida durante venta online. Fallback a outbox offline:', err);
        return await processOfflineSale(input, saleId, deviceId, operationId);
      }

      // Business logic error (e.g. Stock Insufficient, disabled product, validation) -> rethrow!
      throw err;
    }
  });
}

/**
 * Executes the sale transaction directly in Firestore (Online path).
 * Guaranteed to be idempotent using the pre-generated saleId.
 */
async function executeOnlineFirestoreSale(
  input: ProcessSaleInput,
  saleId: string,
  deviceId: string,
  operationId: string
): Promise<Sale> {
  const cleanBusinessId = sanitizeString(input.businessId, 64);
  const cleanSellerId = sanitizeString(input.sellerId, 64);
  const cleanSellerName = sanitizeString(input.sellerName, 128) || 'Vendedor';
  const now = new Date().toISOString();
  const saleRef = doc(db, 'sales', saleId);

  let finalSale: Sale | null = null;
  const updatedProductStocks: Array<{ productId: string; newStock: number }> = [];

  await runTransaction(db, async (transaction) => {
    // 0. IDEMPOTENCY CHECK: If sale with this ID already exists, return it!
    const existingSaleSnap = await transaction.get(saleRef);
    if (existingSaleSnap.exists()) {
      finalSale = {
        id: existingSaleSnap.id,
        ...existingSaleSnap.data()
      } as Sale;
      return;
    }

    // 1. READ ALL DIRECT PRODUCTS
    const productSnaps = await Promise.all(
      input.items.map((item) => {
        if (!item.product?.id) throw new Error('Producto inválido en el carrito.');
        return transaction.get(doc(db, 'products', item.product.id));
      })
    );

    // Check if any product is a combo and collect extra component product IDs
    const componentIdsToFetch = new Set<string>();
    for (const snap of productSnaps) {
      if (snap.exists()) {
        const data = snap.data() as Product;
        if (data.isCombo && data.comboItems && data.comboItems.length > 0) {
          for (const cItem of data.comboItems) {
            if (cItem.productId) {
              componentIdsToFetch.add(cItem.productId);
            }
          }
        }
      }
    }

    // Read component product snaps that are not already in productSnaps
    const componentSnapsMap = new Map<string, any>();
    productSnaps.forEach((snap) => {
      if (snap.exists()) {
        componentSnapsMap.set(snap.id, snap);
      }
    });

    const missingComponentIds = Array.from(componentIdsToFetch).filter(id => !componentSnapsMap.has(id));
    if (missingComponentIds.length > 0) {
      const extraSnaps = await Promise.all(
        missingComponentIds.map(id => transaction.get(doc(db, 'products', id)))
      );
      extraSnaps.forEach((snap) => {
        if (snap.exists()) {
          componentSnapsMap.set(snap.id, snap);
        }
      });
    }

    const productUpdates: Array<{
      ref: any;
      newStock: number;
      previousStock: number;
      productName: string;
      category: string;
      productId: string;
      quantity: number;
      barcode: string | null;
      unitPrice: number;
      unitCost: number;
      subtotal: number;
      tracksStock: boolean;
      isCombo?: boolean;
      comboItems?: any[];
    }> = [];

    const componentDecrements: Array<{
      ref: any;
      productId: string;
      productName: string;
      quantity: number;
      previousStock: number;
      newStock: number;
      comboName: string;
    }> = [];

    const accumulatedStockDeductions = new Map<string, number>();
    let computedTotal = 0;

    for (let i = 0; i < input.items.length; i++) {
      const rawItem = input.items[i];
      const qty = sanitizeInteger(rawItem.quantity, 1, 999999, 1);
      const snap = productSnaps[i];

      if (!snap.exists()) {
        throw new Error(`El producto "${rawItem.product.name}" ya no existe.`);
      }

      const pData = snap.data() as Product;

      if (pData.businessId !== cleanBusinessId) {
        throw new Error(`Acceso denegado al producto "${pData.name}".`);
      }

      if (!pData.active) {
        throw new Error(`El producto "${pData.name}" está deshabilitado.`);
      }

      const unitPrice = sanitizeNumber(pData.salePrice, 0, 999999999, 0);
      const subtotal = unitPrice * qty;
      computedTotal += subtotal;

      const isCombo = Boolean(pData.isCombo && pData.comboItems && pData.comboItems.length > 0);
      const tracksStock = pData.tracksStock !== false;

      if (isCombo) {
        let comboComputedUnitCost = 0;
        const comboItemsSnapshot: any[] = [];

        // Combo component stock deductions (respect per-component tracksStock)
        for (const cItem of pData.comboItems || []) {
          let compUnitCost = typeof cItem.unitCost === 'number' ? cItem.unitCost : 0;
          const compSnap = componentSnapsMap.get(cItem.productId);
          if (compSnap && compSnap.exists()) {
            const compData = compSnap.data() as Product;
            if (compUnitCost === 0 && typeof compData.costPrice === 'number') {
              compUnitCost = compData.costPrice;
            }
          }
          const cQty = sanitizeInteger(cItem.quantity, 1, 999999, 1);
          comboComputedUnitCost += (cQty * compUnitCost);
          comboItemsSnapshot.push({
            productId: sanitizeString(cItem.productId, 64),
            productName: sanitizeString(cItem.productName || '', 150),
            quantity: cQty,
            unitCost: sanitizeNumber(compUnitCost, 0, 999999999, 0)
          });

          const cTracksStock = cItem.tracksStock !== undefined 
            ? Boolean(cItem.tracksStock) 
            : (cItem.trackStock !== undefined ? Boolean(cItem.trackStock) : true);

          if (cTracksStock) {
            if (!compSnap || !compSnap.exists()) {
              throw new Error(`El componente "${cItem.productName || cItem.productId}" ya no existe.`);
            }
            const compData = compSnap.data() as Product;
            if (compData.businessId !== cleanBusinessId) {
              throw new Error(`Acceso denegado al componente "${compData.name}".`);
            }
            if (!compData.active) {
              throw new Error(`El componente "${compData.name}" del combo "${pData.name}" está deshabilitado.`);
            }

            const compTracksStock = compData.tracksStock !== false;
            if (compTracksStock) {
              const compQtyNeeded = cItem.quantity * qty;
              const alreadyDeducted = accumulatedStockDeductions.get(compData.id) || 0;
              const currentStock = Number(compData.stock) || 0;
              const availableStock = currentStock - alreadyDeducted;

              if (availableStock < compQtyNeeded) {
                throw new Error(
                  `Stock insuficiente del componente "${compData.name}" para el combo "${pData.name}". Disponible: ${availableStock} u.`
                );
              }

              accumulatedStockDeductions.set(compData.id, alreadyDeducted + compQtyNeeded);
              const newStock = currentStock - (alreadyDeducted + compQtyNeeded);

              componentDecrements.push({
                ref: compSnap.ref,
                productId: compData.id,
                productName: compData.name,
                quantity: compQtyNeeded,
                previousStock: currentStock - alreadyDeducted,
                newStock,
                comboName: pData.name
              });
            }
          }
        }

        const comboFinalUnitCost = sanitizeNumber(
          pData.costPrice !== undefined && pData.costPrice > 0 ? pData.costPrice : comboComputedUnitCost,
          0,
          999999999,
          0
        );

        productUpdates.push({
          ref: snap.ref,
          productId: snap.id,
          productName: sanitizeString(pData.name, 150),
          category: sanitizeString(pData.category || 'General', 80),
          barcode: pData.barcode || null,
          previousStock: pData.stock || 0,
          newStock: pData.stock || 0,
          quantity: qty,
          unitPrice,
          unitCost: comboFinalUnitCost,
          subtotal,
          tracksStock: false,
          isCombo: true,
          comboItems: comboItemsSnapshot
        });

      } else if (tracksStock) {
        // Standard inventoried product
        const currentStock = Number(pData.stock) || 0;
        const alreadyDeducted = accumulatedStockDeductions.get(pData.id) || 0;
        const availableStock = currentStock - alreadyDeducted;

        if (availableStock < qty) {
          throw new Error(
            `El stock de "${pData.name}" cambió. Disponible: ${availableStock} u.`
          );
        }

        accumulatedStockDeductions.set(pData.id, alreadyDeducted + qty);
        const newStock = currentStock - (alreadyDeducted + qty);
        const unitCost = sanitizeNumber(pData.costPrice, 0, 999999999, 0);

        productUpdates.push({
          ref: snap.ref,
          productId: snap.id,
          productName: sanitizeString(pData.name, 150),
          category: sanitizeString(pData.category || 'General', 80),
          barcode: pData.barcode || null,
          previousStock: currentStock - alreadyDeducted,
          newStock,
          quantity: qty,
          unitPrice,
          unitCost,
          subtotal,
          tracksStock: true
        });
      } else {
        // Non-inventoried service / copy
        const unitCost = sanitizeNumber(pData.costPrice, 0, 999999999, 0);
        productUpdates.push({
          ref: snap.ref,
          productId: snap.id,
          productName: sanitizeString(pData.name, 150),
          category: sanitizeString(pData.category || 'General', 80),
          barcode: pData.barcode || null,
          previousStock: 0,
          newStock: 0,
          quantity: qty,
          unitPrice,
          unitCost,
          subtotal,
          tracksStock: false
        });
      }
    }

    // 2. PREPARE SALE SNAPSHOT
    const saleItemsSnapshot: SaleItem[] = productUpdates.map((pu) => {
      const itemSnapshot: SaleItem = {
        productId: pu.productId,
        productName: pu.productName,
        category: pu.category || 'General',
        barcode: pu.barcode || null,
        quantity: pu.quantity,
        unitPrice: pu.unitPrice,
        unitCost: pu.unitCost,
        subtotal: pu.subtotal
      };
      if (pu.isCombo) {
        itemSnapshot.isCombo = true;
        if (pu.comboItems && pu.comboItems.length > 0) {
          itemSnapshot.comboItems = pu.comboItems.map((c: any) => ({
            productId: sanitizeString(c.productId, 64),
            productName: sanitizeString(c.productName || '', 150),
            quantity: sanitizeInteger(c.quantity, 1, 999999, 1),
            unitCost: sanitizeNumber(c.unitCost, 0, 999999999, 0)
          }));
        }
      }
      return itemSnapshot;
    });

    const isMpPayment = input.paymentMethod === 'MERCADO_PAGO' || (input.paymentMethod === 'COMBINADO' && (input.paymentBreakdown?.mpAmount || 0) > 0);

    const newSale: Sale = {
      id: saleId,
      businessId: cleanBusinessId,
      sellerId: cleanSellerId,
      sellerName: cleanSellerName,
      items: saleItemsSnapshot,
      total: computedTotal,
      paymentMethod: input.paymentMethod || 'EFECTIVO',
      paymentVerification: input.paymentVerification || 'MANUAL',
      paymentDetails: input.paymentDetails || (isMpPayment ? {
        mode: input.requiresOnlinePaymentVerification === false ? 'INTEGRATION_DISABLED' : 'ONLINE',
        verification: input.paymentVerification || 'MANUAL',
        notes: input.requiresOnlinePaymentVerification === false
          ? 'Cobro Mercado Pago registrado manualmente (integración desactivada)'
          : 'Cobro Mercado Pago registrado en modo online'
      } : undefined),
      offline: false,
      status: 'COMPLETED',
      createdAt: now,
      syncStatus: 'SYNCED',
      syncMode: 'ONLINE',
      syncedAt: now,
      deviceId
    };

    if (input.paymentBreakdown) {
      newSale.paymentBreakdown = {
        cashAmount: sanitizeNumber(input.paymentBreakdown.cashAmount, 0, 999999999, 0),
        mpAmount: sanitizeNumber(input.paymentBreakdown.mpAmount, 0, 999999999, 0),
        ...(typeof input.paymentBreakdown.cashReceived === 'number'
          ? { cashReceived: sanitizeNumber(input.paymentBreakdown.cashReceived, 0, 999999999, 0) }
          : {}),
        ...(typeof input.paymentBreakdown.change === 'number'
          ? { change: sanitizeNumber(input.paymentBreakdown.change, 0, 999999999, 0) }
          : {})
      };
    }
    if (typeof input.cashReceived === 'number') {
      newSale.cashReceived = sanitizeNumber(input.cashReceived, 0, 999999999, 0);
    }
    if (typeof input.change === 'number') {
      newSale.change = sanitizeNumber(input.change, 0, 999999999, 0);
    }

    // 3. EXECUTE WRITES IN TRANSACTION (SANITIZED)
    const sanitizedSale = sanitizeSaleForFirestore(newSale);
    transaction.set(saleRef, sanitizedSale);

    // Stock updates & movements
    for (const pu of productUpdates) {
      if (pu.tracksStock) {
        transaction.update(pu.ref, {
          stock: pu.newStock,
          updatedAt: now
        });

        updatedProductStocks.push({ productId: pu.productId, newStock: pu.newStock });

        const movementRef = doc(collection(db, 'inventory_movements'));
        const movement: InventoryMovement = {
          id: movementRef.id,
          businessId: cleanBusinessId,
          productId: pu.productId,
          productName: pu.productName,
          type: 'SALE',
          quantity: pu.quantity,
          previousStock: pu.previousStock,
          newStock: pu.newStock,
          reason: `Venta #${saleId.slice(-6).toUpperCase()}`,
          createdAt: now,
          userId: cleanSellerId,
          saleId
        };
        const sanitizedMov = sanitizeMovementForFirestore(movement);
        transaction.set(movementRef, sanitizedMov);
      }
    }

    for (const comp of componentDecrements) {
      transaction.update(comp.ref, {
        stock: comp.newStock,
        updatedAt: now
      });

      updatedProductStocks.push({ productId: comp.productId, newStock: comp.newStock });

      const movementRef = doc(collection(db, 'inventory_movements'));
      const movement: InventoryMovement = {
        id: movementRef.id,
        businessId: cleanBusinessId,
        productId: comp.productId,
        productName: comp.productName,
        type: 'SALE',
        quantity: comp.quantity,
        previousStock: comp.previousStock,
        newStock: comp.newStock,
        reason: `Venta Combo: ${comp.comboName} (#${saleId.slice(-6).toUpperCase()})`,
        createdAt: now,
        userId: cleanSellerId,
        saleId
      };
      const sanitizedMov = sanitizeMovementForFirestore(movement);
      transaction.set(movementRef, sanitizedMov);
    }

    finalSale = newSale;
  });

  // Post-transaction local cache update
  if (finalSale) {
    try {
      await localDataStore.saveOfflineSale(finalSale);
      for (const ups of updatedProductStocks) {
        await localDataStore.updateLocalProductStock(cleanBusinessId, ups.productId, ups.newStock);
      }
    } catch (cacheErr) {
      console.warn('[saleService] Error actualizando cache local post-venta online:', cacheErr);
    }
  }

  return finalSale!;
}

/**
 * Handles offline sales registration:
 * 1. Computes totals & snapshots using local products
 * 2. Saves to Outbox & Offline Sales
 * 3. Atomically deducts stock from local IndexedDB
 */
async function processOfflineSale(
  input: ProcessSaleInput,
  saleId: string,
  deviceId: string,
  operationId: string
): Promise<Sale> {
  const cleanBusinessId = sanitizeString(input.businessId, 64);
  const cleanSellerId = sanitizeString(input.sellerId, 64);
  const cleanSellerName = sanitizeString(input.sellerName, 128) || 'Vendedor';
  const now = new Date().toISOString();

  let computedTotal = 0;
  const saleItemsSnapshot: SaleItem[] = input.items.map((item) => {
    const unitPrice = sanitizeNumber(item.product.salePrice, 0, 999999999, 0);
    const qty = sanitizeInteger(item.quantity, 1, 999999, 1);
    const subtotal = unitPrice * qty;
    computedTotal += subtotal;

    let comboItemsSnapshot: ComboItem[] | undefined = undefined;
    let computedComboCost = 0;
    if (item.product.isCombo && Array.isArray(item.product.comboItems) && item.product.comboItems.length > 0) {
      comboItemsSnapshot = item.product.comboItems.map((c) => {
        const cCost = sanitizeNumber(
          c.unitCost !== undefined ? c.unitCost : (c as any).costPrice,
          0,
          999999999,
          0
        );
        const cQty = sanitizeInteger(c.quantity, 1, 999999, 1);
        computedComboCost += (cQty * cCost);
        return {
          productId: sanitizeString(c.productId, 64),
          productName: sanitizeString(c.productName || '', 150),
          quantity: cQty,
          unitCost: cCost
        };
      });
    }

    const unitCost = sanitizeNumber(
      item.product.costPrice !== undefined && item.product.costPrice > 0 
        ? item.product.costPrice 
        : (item.product.isCombo && computedComboCost > 0 ? computedComboCost : (item.product.costPrice || 0)),
      0,
      999999999,
      0
    );

    const itemSnapshot: SaleItem = {
      productId: item.product.id,
      productName: sanitizeString(item.product.name, 150),
      category: sanitizeString(item.product.category || 'General', 80),
      barcode: item.product.barcode ? sanitizeBarcode(item.product.barcode) : null,
      quantity: qty,
      unitPrice,
      unitCost,
      subtotal
    };

    if (item.product.isCombo) {
      itemSnapshot.isCombo = true;
      if (comboItemsSnapshot && comboItemsSnapshot.length > 0) {
        itemSnapshot.comboItems = comboItemsSnapshot;
      }
    }

    return itemSnapshot;
  });

  const isMpPayment = input.paymentMethod === 'MERCADO_PAGO' || (input.paymentMethod === 'COMBINADO' && (input.paymentBreakdown?.mpAmount || 0) > 0);

  const offlineSale: Sale = {
    id: saleId,
    businessId: cleanBusinessId,
    sellerId: cleanSellerId,
    sellerName: cleanSellerName,
    items: saleItemsSnapshot,
    total: computedTotal,
    paymentMethod: input.paymentMethod || 'EFECTIVO',
    paymentVerification: isMpPayment ? 'MANUAL' : (input.paymentVerification || 'MANUAL'),
    paymentDetails: isMpPayment
      ? {
          mode: 'OFFLINE',
          verification: 'MANUAL',
          notes: 'Cobro Mercado Pago registrado en modo offline (verificación manual sin orden en MP)'
        }
      : (input.paymentDetails || {
          mode: 'OFFLINE',
          verification: 'MANUAL',
          notes: 'Cobro registrado en modo offline'
        }),
    offline: true,
    status: 'COMPLETED',
    createdAt: now,
    syncStatus: 'PENDING',
    syncMode: 'OFFLINE',
    syncedAt: null,
    deviceId,
    outboxOperationId: operationId
  };

  if (input.paymentBreakdown) {
    offlineSale.paymentBreakdown = {
      cashAmount: sanitizeNumber(input.paymentBreakdown.cashAmount, 0, 999999999, 0),
      mpAmount: sanitizeNumber(input.paymentBreakdown.mpAmount, 0, 999999999, 0),
      ...(typeof input.paymentBreakdown.cashReceived === 'number'
        ? { cashReceived: sanitizeNumber(input.paymentBreakdown.cashReceived, 0, 999999999, 0) }
        : {}),
      ...(typeof input.paymentBreakdown.change === 'number'
        ? { change: sanitizeNumber(input.paymentBreakdown.change, 0, 999999999, 0) }
        : {})
    };
  }
  if (typeof input.cashReceived === 'number') {
    offlineSale.cashReceived = sanitizeNumber(input.cashReceived, 0, 999999999, 0);
  }
  if (typeof input.change === 'number') {
    offlineSale.change = sanitizeNumber(input.change, 0, 999999999, 0);
  }

  // Validate sale structure
  validateSaleBeforePersist(offlineSale);
  const cleanOfflineSale = cleanFirestoreData(offlineSale) as Sale;

  const outboxOperation: OutboxOperation = {
    operationId,
    operationType: 'SALE',
    businessId: cleanBusinessId,
    userId: cleanSellerId,
    userName: cleanSellerName,
    deviceId,
    saleId,
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    payload: {
      ...input,
      saleId,
      deviceId
    },
    saleSnapshot: cleanOfflineSale,
    version: 1,
    syncedAt: null
  };

  // Perform atomic local transaction
  await localDataStore.createOfflineSaleTransaction(cleanBusinessId, cleanOfflineSale, outboxOperation);

  return cleanOfflineSale;
}

/**
 * Idempotently synchronizes an offline outbox operation to Firestore.
 * Handles stock conflict detection without creating negative stock on the server.
 */
export async function syncSaleOperationToFirestore(operation: OutboxOperation): Promise<{
  success: boolean;
  status: 'SYNCED' | 'STOCK_CONFLICT' | 'ERROR';
  error?: string;
}> {
  const saleId = operation.saleId || operation.operationId;
  const cleanBusinessId = operation.businessId;
  const cleanSellerId = operation.userId || 'offline_user';
  const cleanSellerName = operation.userName || 'Vendedor';
  const now = new Date().toISOString();
  const saleRef = doc(db, 'sales', saleId);

  // Extract clean, normalized items from either snapshot or payload
  const cleanItems = extractAndNormalizeSaleItems(
    operation.saleSnapshot?.items || operation.payload?.items || []
  );

  if (cleanItems.length === 0) {
    return {
      success: false,
      status: 'ERROR',
      error: 'La operación no contiene ítems válidos para sincronizar.'
    };
  }

  try {
    const syncResult = await runTransaction(db, async (transaction) => {
      // 0. Check if already exists in Firestore (Idempotency!)
      const existingDoc = await transaction.get(saleRef);
      if (existingDoc.exists()) {
        return { success: true, status: 'SYNCED' as const };
      }

      // 1. Fetch products from Firestore
      const productSnaps = await Promise.all(
        cleanItems.map((item) => {
          return transaction.get(doc(db, 'products', item.productId));
        })
      );

      // Collect combo components
      const componentIdsToFetch = new Set<string>();
      for (const snap of productSnaps) {
        if (snap.exists()) {
          const data = snap.data() as Product;
          if (data.isCombo && data.comboItems) {
            data.comboItems.forEach(c => c.productId && componentIdsToFetch.add(c.productId));
          }
        }
      }

      const componentSnapsMap = new Map<string, any>();
      productSnaps.forEach(s => s.exists() && componentSnapsMap.set(s.id, s));

      const missingComponentIds = Array.from(componentIdsToFetch).filter(id => !componentSnapsMap.has(id));
      if (missingComponentIds.length > 0) {
        const extraSnaps = await Promise.all(
          missingComponentIds.map(id => transaction.get(doc(db, 'products', id)))
        );
        extraSnaps.forEach(s => s.exists() && componentSnapsMap.set(s.id, s));
      }

      // 2. Validate stock & detect conflicts
      const productUpdates: Array<{
        ref: any;
        productId: string;
        productName: string;
        previousStock: number;
        newStock: number;
        quantity: number;
        tracksStock: boolean;
      }> = [];

      const componentDecrements: Array<{
        ref: any;
        productId: string;
        productName: string;
        quantity: number;
        previousStock: number;
        newStock: number;
        comboName: string;
      }> = [];

      const accumulatedDeductions = new Map<string, number>();

      for (let i = 0; i < cleanItems.length; i++) {
        const cartItem = cleanItems[i];
        const snap = productSnaps[i];

        if (!snap || !snap.exists()) {
          return {
            success: false,
            status: 'ERROR' as const,
            error: `El producto "${cartItem.productName || cartItem.productId}" ya no existe en el servidor.`
          };
        }

        const pData = snap.data() as Product;
        if (pData.businessId !== cleanBusinessId) {
          return {
            success: false,
            status: 'ERROR' as const,
            error: `Acceso denegado al producto "${pData.name}".`
          };
        }

        const qty = sanitizeInteger(cartItem.quantity, 1, 999999, 1);
        const isCombo = Boolean(pData.isCombo && pData.comboItems && pData.comboItems.length > 0);
        const tracksStock = pData.tracksStock !== false;

        if (isCombo) {
          for (const cItem of pData.comboItems || []) {
            const cTracksStock = cItem.tracksStock !== undefined 
              ? Boolean(cItem.tracksStock) 
              : (cItem.trackStock !== undefined ? Boolean(cItem.trackStock) : true);

            if (cTracksStock) {
              const compSnap = componentSnapsMap.get(cItem.productId);
              if (!compSnap || !compSnap.exists()) {
                return {
                  success: false,
                  status: 'ERROR' as const,
                  error: `Componente "${cItem.productName || cItem.productId}" no existe en el servidor.`
                };
              }
              const compData = compSnap.data() as Product;
              if (compData.tracksStock !== false) {
                const compQtyNeeded = cItem.quantity * qty;
                const alreadyDeducted = accumulatedDeductions.get(compData.id) || 0;
                const currentStock = Number(compData.stock) || 0;
                const availableStock = currentStock - alreadyDeducted;

                if (availableStock < compQtyNeeded) {
                  return {
                    success: false,
                    status: 'STOCK_CONFLICT' as const,
                    error: `Stock insuficiente en servidor para componente "${compData.name}". Requerido: ${compQtyNeeded} u, Disponible: ${availableStock} u.`
                  };
                }

                accumulatedDeductions.set(compData.id, alreadyDeducted + compQtyNeeded);
                const newStock = currentStock - (alreadyDeducted + compQtyNeeded);

                componentDecrements.push({
                  ref: compSnap.ref,
                  productId: compData.id,
                  productName: compData.name,
                  quantity: compQtyNeeded,
                  previousStock: currentStock - alreadyDeducted,
                  newStock,
                  comboName: pData.name
                });
              }
            }
          }
        } else if (tracksStock) {
          const currentStock = Number(pData.stock) || 0;
          const alreadyDeducted = accumulatedDeductions.get(pData.id) || 0;
          const availableStock = currentStock - alreadyDeducted;

          if (availableStock < qty) {
            return {
              success: false,
              status: 'STOCK_CONFLICT' as const,
              error: `Stock insuficiente en servidor para "${pData.name}". Requerido: ${qty} u, Disponible: ${availableStock} u.`
            };
          }

          accumulatedDeductions.set(pData.id, alreadyDeducted + qty);
          const newStock = currentStock - (alreadyDeducted + qty);

          productUpdates.push({
            ref: snap.ref,
            productId: snap.id,
            productName: pData.name,
            previousStock: currentStock - alreadyDeducted,
            newStock,
            quantity: qty,
            tracksStock: true
          });
        }
      }

      // 3. Write Sale document to Firestore (Fully sanitized)
      const computedTotal = cleanItems.reduce((acc, it) => acc + (it.subtotal || (it.unitPrice * it.quantity)), 0);
      const isMpPayment = (operation.saleSnapshot?.paymentMethod || operation.payload?.paymentMethod) === 'MERCADO_PAGO' ||
        ((operation.saleSnapshot?.paymentMethod || operation.payload?.paymentMethod) === 'COMBINADO' &&
         ((operation.saleSnapshot?.paymentBreakdown?.mpAmount || operation.payload?.paymentBreakdown?.mpAmount || 0) > 0));

      const saleToSave: Sale = {
        id: saleId,
        businessId: cleanBusinessId,
        sellerId: cleanSellerId,
        sellerName: cleanSellerName,
        items: cleanItems,
        total: sanitizeNumber(operation.saleSnapshot?.total ?? operation.payload?.total, 0, 999999999, computedTotal),
        paymentMethod: (operation.saleSnapshot?.paymentMethod || operation.payload?.paymentMethod || 'EFECTIVO') as PaymentMethod,
        paymentVerification: operation.saleSnapshot?.paymentVerification || operation.payload?.paymentVerification || (isMpPayment ? 'MANUAL' : 'MANUAL'),
        paymentDetails: operation.saleSnapshot?.paymentDetails || operation.payload?.paymentDetails || (isMpPayment ? {
          mode: 'OFFLINE',
          verification: 'MANUAL',
          notes: 'Cobro Mercado Pago registrado en modo offline (verificación manual)'
        } : undefined),
        offline: true,
        status: (operation.saleSnapshot?.status || 'COMPLETED') as any,
        createdAt: operation.saleSnapshot?.createdAt || operation.createdAt || now,
        syncStatus: 'SYNCED',
        syncMode: 'OFFLINE',
        syncedAt: now,
        deviceId: operation.deviceId || 'offline_device',
        outboxOperationId: operation.operationId
      };

      if (operation.saleSnapshot?.paymentBreakdown || operation.payload?.paymentBreakdown) {
        const pb = operation.saleSnapshot?.paymentBreakdown || operation.payload?.paymentBreakdown;
        saleToSave.paymentBreakdown = {
          cashAmount: sanitizeNumber(pb.cashAmount, 0, 999999999, 0),
          mpAmount: sanitizeNumber(pb.mpAmount, 0, 999999999, 0),
          ...(typeof pb.cashReceived === 'number' ? { cashReceived: sanitizeNumber(pb.cashReceived, 0, 999999999, 0) } : {}),
          ...(typeof pb.change === 'number' ? { change: sanitizeNumber(pb.change, 0, 999999999, 0) } : {})
        };
      }
      if (typeof (operation.saleSnapshot?.cashReceived ?? operation.payload?.cashReceived) === 'number') {
        saleToSave.cashReceived = sanitizeNumber(operation.saleSnapshot?.cashReceived ?? operation.payload?.cashReceived, 0, 999999999, 0);
      }
      if (typeof (operation.saleSnapshot?.change ?? operation.payload?.change) === 'number') {
        saleToSave.change = sanitizeNumber(operation.saleSnapshot?.change ?? operation.payload?.change, 0, 999999999, 0);
      }

      const sanitizedSale = sanitizeSaleForFirestore(saleToSave);
      transaction.set(saleRef, sanitizedSale);

      // 4. Update Product Stocks and Movements
      for (const pu of productUpdates) {
        if (pu.tracksStock) {
          transaction.update(pu.ref, {
            stock: pu.newStock,
            updatedAt: now
          });

          const movementRef = doc(collection(db, 'inventory_movements'));
          const movement: InventoryMovement = {
            id: movementRef.id,
            businessId: cleanBusinessId,
            productId: pu.productId,
            productName: pu.productName,
            type: 'SALE',
            quantity: pu.quantity,
            previousStock: pu.previousStock,
            newStock: pu.newStock,
            reason: `Venta Offline Sincronizada #${(saleId || '').slice(-6).toUpperCase()}`,
            createdAt: now,
            userId: cleanSellerId,
            saleId
          };
          const sanitizedMov = sanitizeMovementForFirestore(movement);
          transaction.set(movementRef, sanitizedMov);
        }
      }

      for (const comp of componentDecrements) {
        transaction.update(comp.ref, {
          stock: comp.newStock,
          updatedAt: now
        });

        const movementRef = doc(collection(db, 'inventory_movements'));
        const movement: InventoryMovement = {
          id: movementRef.id,
          businessId: cleanBusinessId,
          productId: comp.productId,
          productName: comp.productName,
          type: 'SALE',
          quantity: comp.quantity,
          previousStock: comp.previousStock,
          newStock: comp.newStock,
          reason: `Venta Offline Combo Sincronizada: ${comp.comboName} (#${(saleId || '').slice(-6).toUpperCase()})`,
          createdAt: now,
          userId: cleanSellerId,
          saleId
        };
        const sanitizedMov = sanitizeMovementForFirestore(movement);
        transaction.set(movementRef, sanitizedMov);
      }

      return { success: true, status: 'SYNCED' as const };
    });

    return syncResult;
  } catch (err: any) {
    console.error('[saleService] Error durante sincronización de venta a Firestore:', err);
    return {
      success: false,
      status: 'ERROR' as const,
      error: err?.message || 'Error desconocido al sincronizar venta con Firestore'
    };
  }
}

/**
 * Administratively forces an offline outbox operation to Firestore even if server stock is lower than required.
 * Sets the server stock to remaining or 0, creates an audited adjustment movement, and marks the sale as SYNCED.
 */
export async function forceSyncSaleOperationWithStockAdjustment(operation: OutboxOperation): Promise<{
  success: boolean;
  error?: string;
}> {
  const saleId = operation.saleId || operation.operationId;
  const cleanBusinessId = operation.businessId;
  const cleanSellerId = operation.userId || 'offline_user';
  const cleanSellerName = operation.userName || 'Vendedor';
  const now = new Date().toISOString();
  const saleRef = doc(db, 'sales', saleId);

  const cleanItems = extractAndNormalizeSaleItems(
    operation.saleSnapshot?.items || operation.payload?.items || []
  );

  if (cleanItems.length === 0) {
    return { success: false, error: 'No hay ítems válidos para forzar la sincronización.' };
  }

  try {
    await runTransaction(db, async (transaction) => {
      // 0. Check if already exists in Firestore (Idempotency)
      const existingDoc = await transaction.get(saleRef);
      if (existingDoc.exists()) {
        return;
      }

      // 1. Fetch products from Firestore
      const productSnaps = await Promise.all(
        cleanItems.map((item) => {
          return transaction.get(doc(db, 'products', item.productId));
        })
      );

      // Collect combo components
      const componentIdsToFetch = new Set<string>();
      for (const snap of productSnaps) {
        if (snap.exists()) {
          const data = snap.data() as Product;
          if (data.isCombo && data.comboItems) {
            data.comboItems.forEach(c => c.productId && componentIdsToFetch.add(c.productId));
          }
        }
      }

      const componentSnapsMap = new Map<string, any>();
      productSnaps.forEach(s => s.exists() && componentSnapsMap.set(s.id, s));

      const missingComponentIds = Array.from(componentIdsToFetch).filter(id => !componentSnapsMap.has(id));
      if (missingComponentIds.length > 0) {
        const extraSnaps = await Promise.all(
          missingComponentIds.map(id => transaction.get(doc(db, 'products', id)))
        );
        extraSnaps.forEach(s => s.exists() && componentSnapsMap.set(s.id, s));
      }

      // 2. Prepare updates (forcing stock to Math.max(0, current - qty))
      const productUpdates: Array<{
        ref: any;
        productId: string;
        productName: string;
        previousStock: number;
        newStock: number;
        quantity: number;
        tracksStock: boolean;
      }> = [];

      const componentDecrements: Array<{
        ref: any;
        productId: string;
        productName: string;
        quantity: number;
        previousStock: number;
        newStock: number;
        comboName: string;
      }> = [];

      const accumulatedDeductions = new Map<string, number>();

      for (let i = 0; i < cleanItems.length; i++) {
        const cartItem = cleanItems[i];
        const snap = productSnaps[i];

        if (!snap || !snap.exists()) continue;

        const pData = snap.data() as Product;
        const qty = sanitizeInteger(cartItem.quantity, 1, 999999, 1);
        const isCombo = Boolean(pData.isCombo && pData.comboItems && pData.comboItems.length > 0);
        const tracksStock = pData.tracksStock !== false;

        if (isCombo) {
          for (const cItem of pData.comboItems || []) {
            const cTracksStock = cItem.tracksStock !== undefined 
              ? Boolean(cItem.tracksStock) 
              : (cItem.trackStock !== undefined ? Boolean(cItem.trackStock) : true);

            if (cTracksStock) {
              const compSnap = componentSnapsMap.get(cItem.productId);
              if (!compSnap || !compSnap.exists()) continue;
              const compData = compSnap.data() as Product;

              if (compData.tracksStock !== false) {
                const compQtyNeeded = cItem.quantity * qty;
                const alreadyDeducted = accumulatedDeductions.get(compData.id) || 0;
                const currentStock = Number(compData.stock) || 0;
                const newStock = Math.max(0, currentStock - (alreadyDeducted + compQtyNeeded));

                accumulatedDeductions.set(compData.id, alreadyDeducted + compQtyNeeded);

                componentDecrements.push({
                  ref: compSnap.ref,
                  productId: compData.id,
                  productName: compData.name,
                  quantity: compQtyNeeded,
                  previousStock: currentStock - alreadyDeducted,
                  newStock,
                  comboName: pData.name
                });
              }
            }
          }
        } else if (tracksStock) {
          const currentStock = Number(pData.stock) || 0;
          const alreadyDeducted = accumulatedDeductions.get(pData.id) || 0;
          const newStock = Math.max(0, currentStock - (alreadyDeducted + qty));

          accumulatedDeductions.set(pData.id, alreadyDeducted + qty);

          productUpdates.push({
            ref: snap.ref,
            productId: snap.id,
            productName: pData.name,
            previousStock: currentStock - alreadyDeducted,
            newStock,
            quantity: qty,
            tracksStock: true
          });
        }
      }

      // 3. Write Sale document to Firestore (Sanitized)
      const computedTotal = cleanItems.reduce((acc, it) => acc + (it.subtotal || (it.unitPrice * it.quantity)), 0);
      const isMpPayment = (operation.saleSnapshot?.paymentMethod || operation.payload?.paymentMethod) === 'MERCADO_PAGO' ||
        ((operation.saleSnapshot?.paymentMethod || operation.payload?.paymentMethod) === 'COMBINADO' &&
         ((operation.saleSnapshot?.paymentBreakdown?.mpAmount || operation.payload?.paymentBreakdown?.mpAmount || 0) > 0));

      const saleToSave: Sale = {
        id: saleId,
        businessId: cleanBusinessId,
        sellerId: cleanSellerId,
        sellerName: cleanSellerName,
        items: cleanItems,
        total: sanitizeNumber(operation.saleSnapshot?.total ?? operation.payload?.total, 0, 999999999, computedTotal),
        paymentMethod: (operation.saleSnapshot?.paymentMethod || operation.payload?.paymentMethod || 'EFECTIVO') as PaymentMethod,
        paymentVerification: operation.saleSnapshot?.paymentVerification || operation.payload?.paymentVerification || (isMpPayment ? 'MANUAL' : 'MANUAL'),
        paymentDetails: operation.saleSnapshot?.paymentDetails || operation.payload?.paymentDetails || (isMpPayment ? {
          mode: 'OFFLINE',
          verification: 'MANUAL',
          notes: 'Cobro Mercado Pago registrado en modo offline (verificación manual)'
        } : undefined),
        offline: true,
        status: (operation.saleSnapshot?.status || 'COMPLETED') as any,
        createdAt: operation.saleSnapshot?.createdAt || operation.createdAt || now,
        syncStatus: 'SYNCED',
        syncMode: 'OFFLINE',
        syncedAt: now,
        deviceId: operation.deviceId || 'offline_device',
        outboxOperationId: operation.operationId
      };

      if (operation.saleSnapshot?.paymentBreakdown || operation.payload?.paymentBreakdown) {
        const pb = operation.saleSnapshot?.paymentBreakdown || operation.payload?.paymentBreakdown;
        saleToSave.paymentBreakdown = {
          cashAmount: sanitizeNumber(pb.cashAmount, 0, 999999999, 0),
          mpAmount: sanitizeNumber(pb.mpAmount, 0, 999999999, 0),
          ...(typeof pb.cashReceived === 'number' ? { cashReceived: sanitizeNumber(pb.cashReceived, 0, 999999999, 0) } : {}),
          ...(typeof pb.change === 'number' ? { change: sanitizeNumber(pb.change, 0, 999999999, 0) } : {})
        };
      }
      if (typeof (operation.saleSnapshot?.cashReceived ?? operation.payload?.cashReceived) === 'number') {
        saleToSave.cashReceived = sanitizeNumber(operation.saleSnapshot?.cashReceived ?? operation.payload?.cashReceived, 0, 999999999, 0);
      }
      if (typeof (operation.saleSnapshot?.change ?? operation.payload?.change) === 'number') {
        saleToSave.change = sanitizeNumber(operation.saleSnapshot?.change ?? operation.payload?.change, 0, 999999999, 0);
      }

      const sanitizedSale = sanitizeSaleForFirestore(saleToSave);
      transaction.set(saleRef, sanitizedSale);

      // 4. Update Product Stocks and Movements
      for (const pu of productUpdates) {
        if (pu.tracksStock) {
          transaction.update(pu.ref, {
            stock: pu.newStock,
            updatedAt: now
          });

          const movementRef = doc(collection(db, 'inventory_movements'));
          const movement: InventoryMovement = {
            id: movementRef.id,
            businessId: cleanBusinessId,
            productId: pu.productId,
            productName: pu.productName,
            type: 'SALE',
            quantity: pu.quantity,
            previousStock: pu.previousStock,
            newStock: pu.newStock,
            reason: `Venta Forzada Offline #${(saleId || '').slice(-6).toUpperCase()} (Ajuste Autorizado)`,
            createdAt: now,
            userId: cleanSellerId,
            saleId
          };
          const sanitizedMov = sanitizeMovementForFirestore(movement);
          transaction.set(movementRef, sanitizedMov);
        }
      }

      for (const comp of componentDecrements) {
        transaction.update(comp.ref, {
          stock: comp.newStock,
          updatedAt: now
        });

        const movementRef = doc(collection(db, 'inventory_movements'));
        const movement: InventoryMovement = {
          id: movementRef.id,
          businessId: cleanBusinessId,
          productId: comp.productId,
          productName: comp.productName,
          type: 'SALE',
          quantity: comp.quantity,
          previousStock: comp.previousStock,
          newStock: comp.newStock,
          reason: `Venta Combo Forzada Offline: ${comp.comboName} (#${(saleId || '').slice(-6).toUpperCase()})`,
          createdAt: now,
          userId: cleanSellerId,
          saleId
        };
        const sanitizedMov = sanitizeMovementForFirestore(movement);
        transaction.set(movementRef, sanitizedMov);
      }
    });

    // 5. Update local IndexedDB
    await localDataStore.updateOutboxOperationStatus(
      cleanBusinessId,
      operation.operationId,
      'SYNCED',
      null,
      now
    );

    return { success: true };
  } catch (err: any) {
    console.error('[saleService] Error al forzar sincronización de venta:', err);
    return {
      success: false,
      error: err?.message || 'Error al forzar la sincronización en Firestore'
    };
  }
}

/**
 * Cancels an already synced sale in Firestore, restores stock, and logs an inventory movement
 */
export async function cancelSyncedSaleInFirestore(
  businessId: string,
  saleId: string,
  userId: string,
  reason: string = 'Venta cancelada por administrador'
): Promise<{ success: boolean; error?: string }> {
  if (!businessId || !saleId) {
    return { success: false, error: 'businessId y saleId son requeridos' };
  }

  const saleRef = doc(db, 'sales', saleId);
  const now = new Date().toISOString();

  try {
    await runTransaction(db, async (transaction) => {
      const saleDoc = await transaction.get(saleRef);
      if (!saleDoc.exists()) {
        throw new Error('La venta no existe en el servidor.');
      }

      const saleData = saleDoc.data() as Sale;
      if (saleData.status === 'CANCELLED') {
        return; // Already cancelled (Idempotent)
      }

      const cleanItems = extractAndNormalizeSaleItems(saleData.items || []);

      // Fetch products to restore stock
      const productSnaps = await Promise.all(
        cleanItems.map(it => transaction.get(doc(db, 'products', it.productId)))
      );

      // Collect combo components
      const componentIdsToFetch = new Set<string>();
      for (const snap of productSnaps) {
        if (snap.exists()) {
          const p = snap.data() as Product;
          if (p.isCombo && p.comboItems) {
            p.comboItems.forEach(c => c.productId && componentIdsToFetch.add(c.productId));
          }
        }
      }

      const componentSnapsMap = new Map<string, any>();
      productSnaps.forEach(s => s.exists() && componentSnapsMap.set(s.id, s));

      const missingCompIds = Array.from(componentIdsToFetch).filter(id => !componentSnapsMap.has(id));
      if (missingCompIds.length > 0) {
        const extraSnaps = await Promise.all(
          missingCompIds.map(id => transaction.get(doc(db, 'products', id)))
        );
        extraSnaps.forEach(s => s.exists() && componentSnapsMap.set(s.id, s));
      }

      // Restore stocks
      for (let i = 0; i < cleanItems.length; i++) {
        const item = cleanItems[i];
        const snap = productSnaps[i];
        if (!snap || !snap.exists()) continue;

        const pData = snap.data() as Product;
        const qty = item.quantity;

        if (pData.isCombo && pData.comboItems) {
          for (const cItem of pData.comboItems) {
            const cTracksStock = cItem.tracksStock !== undefined 
              ? Boolean(cItem.tracksStock) 
              : (cItem.trackStock !== undefined ? Boolean(cItem.trackStock) : true);

            if (cTracksStock) {
              const compSnap = componentSnapsMap.get(cItem.productId);
              if (!compSnap || !compSnap.exists()) continue;
              const compData = compSnap.data() as Product;
              if (compData.tracksStock !== false) {
                const compQty = cItem.quantity * qty;
                const prevStock = Number(compData.stock) || 0;
                const newStock = prevStock + compQty;
                transaction.update(compSnap.ref, { stock: newStock, updatedAt: now });

                const movRef = doc(collection(db, 'inventory_movements'));
                const mov: InventoryMovement = {
                  id: movRef.id,
                  businessId,
                  productId: compData.id,
                  productName: compData.name,
                  type: 'ADJUSTMENT_IN',
                  quantity: compQty,
                  previousStock: prevStock,
                  newStock,
                  reason: `Anulación Venta #${(saleId || '').slice(-6).toUpperCase()}: ${pData.name}`,
                  createdAt: now,
                  userId,
                  saleId
                };
                transaction.set(movRef, sanitizeMovementForFirestore(mov));
              }
            }
          }
        } else if (pData.tracksStock !== false) {
          const prevStock = Number(pData.stock) || 0;
          const newStock = prevStock + qty;
          transaction.update(snap.ref, { stock: newStock, updatedAt: now });

          const movRef = doc(collection(db, 'inventory_movements'));
          const mov: InventoryMovement = {
            id: movRef.id,
            businessId,
            productId: pData.id,
            productName: pData.name,
            type: 'ADJUSTMENT_IN',
            quantity: qty,
            previousStock: prevStock,
            newStock,
            reason: `Anulación Venta #${(saleId || '').slice(-6).toUpperCase()}`,
            createdAt: now,
            userId,
            saleId
          };
          transaction.set(movRef, sanitizeMovementForFirestore(mov));
        }
      }

      // Mark sale document as CANCELLED
      transaction.update(saleRef, {
        status: 'CANCELLED',
        syncError: `Venta anulada: ${reason}`,
        updatedAt: now
      });
    });

    return { success: true };
  } catch (err: any) {
    console.error('[saleService] Error al anular venta sincronizada en Firestore:', err);
    return { success: false, error: err?.message || 'Error al anular venta en servidor' };
  }
}

