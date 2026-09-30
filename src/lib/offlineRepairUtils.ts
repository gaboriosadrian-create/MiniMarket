import { OutboxOperation, Sale, SaleItem, PaymentMethod, PaymentBreakdown, SaleStatus, OutboxStatus } from '../types';
import { cleanFirestoreData, sanitizeString, sanitizeNumber, sanitizeInteger, sanitizeBarcode } from './securityUtils';
import { getDeviceId } from './deviceId';
import { localDataStore } from './localDataStore';

export interface RepairResult {
  op: OutboxOperation;
  wasRepaired: boolean;
  reasons: string[];
  isUnrepairable: boolean;
  diagnosticError?: string;
}

export interface BatchRepairSummary {
  totalChecked: number;
  repairedCount: number;
  unrepairableCount: number;
  repairedIds: string[];
  diagnostics: Array<{
    operationId: string;
    saleId?: string;
    diagnostic: string;
  }>;
}

/**
 * Normalizes and extracts SaleItem list safely from any legacy format
 * (e.g. cart items { product: {...}, quantity }, raw sale items, or nested items)
 */
export function extractAndNormalizeSaleItems(rawItems: any[]): SaleItem[] {
  if (!Array.isArray(rawItems)) return [];

  const items: SaleItem[] = [];

  for (const raw of rawItems) {
    if (!raw) continue;

    const productId = sanitizeString(
      raw.productId || raw.product?.id || raw.id || '',
      64
    );

    // If there is no valid product ID, ignore invalid fragment
    if (!productId) continue;

    const productName = sanitizeString(
      raw.productName || raw.product?.name || 'Producto sin nombre',
      150
    );

    const category = sanitizeString(
      raw.category || raw.product?.category || 'General',
      80
    );

    const barcode = raw.barcode 
      ? sanitizeBarcode(raw.barcode) 
      : (raw.product?.barcode ? sanitizeBarcode(raw.product.barcode) : null);

    const quantity = sanitizeInteger(raw.quantity, 1, 999999, 1);
    
    const unitPrice = sanitizeNumber(
      raw.unitPrice !== undefined ? raw.unitPrice : raw.product?.salePrice,
      0,
      999999999,
      0
    );

    let comboItems: any[] | undefined = undefined;
    let computedComboCost = 0;
    const rawCombo = raw.comboItems || raw.product?.comboItems;
    if (Array.isArray(rawCombo) && rawCombo.length > 0) {
      comboItems = rawCombo
        .map((c: any) => {
          const cCost = sanitizeNumber(
            c.unitCost !== undefined ? c.unitCost : (c.costPrice !== undefined ? c.costPrice : c.product?.costPrice),
            0,
            999999999,
            0
          );
          const cQty = sanitizeInteger(c.quantity, 1, 999999, 1);
          computedComboCost += (cQty * cCost);
          return {
            productId: sanitizeString(c.productId || c.product?.id || '', 64),
            productName: sanitizeString(c.productName || c.name || '', 150),
            quantity: cQty,
            unitCost: cCost
          };
        })
        .filter((c: any) => Boolean(c.productId));
    }

    const unitCost = sanitizeNumber(
      raw.unitCost !== undefined 
        ? raw.unitCost 
        : (raw.costPrice !== undefined 
            ? raw.costPrice 
            : (raw.product?.costPrice !== undefined 
                ? raw.product.costPrice 
                : (computedComboCost > 0 ? computedComboCost : 0))),
      0,
      999999999,
      0
    );

    const subtotal = sanitizeNumber(
      raw.subtotal !== undefined ? raw.subtotal : (unitPrice * quantity),
      0,
      999999999,
      unitPrice * quantity
    );

    const isCombo = Boolean(raw.isCombo || raw.product?.isCombo);

    const cleanItem: SaleItem = {
      productId,
      productName,
      barcode: barcode || null,
      category,
      quantity,
      unitPrice,
      unitCost,
      subtotal,
      isCombo,
      comboItems: comboItems && comboItems.length > 0 ? comboItems : undefined
    };

    items.push(cleanFirestoreData(cleanItem));
  }

  return items;
}

/**
 * Inspects, audits, and repairs an offline OutboxOperation record,
 * restoring missing fields, eliminating `undefined` properties recursively,
 * and resetting stuck error states caused by previous Firestore `undefined` errors.
 */
export function repairOfflineOperation(op: OutboxOperation): RepairResult {
  const reasons: string[] = [];
  let wasRepaired = false;

  // Clone operation to avoid in-place unexpected side-effects
  const clonedOp: OutboxOperation = JSON.parse(JSON.stringify(op));

  // 1. Determine if operation or its linked snapshot is cancelled
  const isCancelled = 
    clonedOp.status === 'CANCELLED' || 
    clonedOp.saleSnapshot?.status === 'CANCELLED' || 
    clonedOp.saleSnapshot?.syncStatus === 'CANCELLED' ||
    String(clonedOp.lastError || '').toLowerCase().includes('anulada') ||
    String(clonedOp.lastError || '').toLowerCase().includes('cancelada');

  if (isCancelled) {
    clonedOp.status = 'CANCELLED';
  }

  // 2. Normalize Operation Type
  if (!clonedOp.operationType) {
    clonedOp.operationType = 'SALE';
    reasons.push('Se asignó operationType="SALE" por defecto');
    wasRepaired = true;
  }

  // 3. Specialized Repair for SALE Operations
  if (clonedOp.operationType === 'SALE') {
    const saleId = clonedOp.saleId || clonedOp.payload?.saleId || clonedOp.operationId;
    clonedOp.saleId = saleId;

    const businessId = clonedOp.businessId || clonedOp.payload?.businessId || clonedOp.saleSnapshot?.businessId;

    // Check mandatory businessId
    if (!businessId) {
      return {
        op: clonedOp,
        wasRepaired: false,
        reasons,
        isUnrepairable: true,
        diagnosticError: `Operación: ${clonedOp.operationId} | Venta: ${saleId} | Campo problemático: businessId | Motivo: Campo obligatorio ausente y no recuperable`
      };
    }
    clonedOp.businessId = businessId;

    // Extract & sanitize items
    const rawItems = 
      (clonedOp.saleSnapshot?.items && clonedOp.saleSnapshot.items.length > 0)
        ? clonedOp.saleSnapshot.items
        : (clonedOp.payload?.items || []);

    const cleanItems = extractAndNormalizeSaleItems(rawItems);

    if (cleanItems.length === 0) {
      return {
        op: clonedOp,
        wasRepaired: false,
        reasons,
        isUnrepairable: true,
        diagnosticError: `Operación: ${clonedOp.operationId} | Venta: ${saleId} | Campo problemático: items | Motivo: La operación no contiene productos válidos`
      };
    }

    // Recompute total
    const computedTotal = cleanItems.reduce((acc, it) => acc + (it.subtotal || 0), 0);
    const total = sanitizeNumber(
      clonedOp.saleSnapshot?.total !== undefined ? clonedOp.saleSnapshot.total : clonedOp.payload?.total,
      0,
      999999999,
      computedTotal
    );

    // Normalize Payment Method & Breakdown
    const paymentMethod: PaymentMethod = 
      clonedOp.saleSnapshot?.paymentMethod || clonedOp.payload?.paymentMethod || 'EFECTIVO';

    let cleanPaymentBreakdown: PaymentBreakdown | undefined = undefined;
    const rawBreakdown = clonedOp.saleSnapshot?.paymentBreakdown || clonedOp.payload?.paymentBreakdown;
    if (rawBreakdown && typeof rawBreakdown === 'object') {
      cleanPaymentBreakdown = {
        cashAmount: sanitizeNumber(rawBreakdown.cashAmount, 0, 999999999, paymentMethod === 'EFECTIVO' ? total : 0),
        mpAmount: sanitizeNumber(rawBreakdown.mpAmount, 0, 999999999, paymentMethod === 'MERCADO_PAGO' ? total : 0),
        cashReceived: rawBreakdown.cashReceived !== undefined ? sanitizeNumber(rawBreakdown.cashReceived, 0, 999999999, 0) : undefined,
        change: rawBreakdown.change !== undefined ? sanitizeNumber(rawBreakdown.change, 0, 999999999, 0) : undefined
      };
    }

    const saleStatus: SaleStatus = isCancelled ? 'CANCELLED' : 'COMPLETED';

    const userId = sanitizeString(clonedOp.userId || clonedOp.saleSnapshot?.sellerId || clonedOp.payload?.sellerId || 'DESCONOCIDO', 64);
    const userName = sanitizeString(clonedOp.userName || clonedOp.saleSnapshot?.sellerName || clonedOp.payload?.sellerName || 'Vendedor', 100);
    const deviceId = sanitizeString(clonedOp.deviceId || clonedOp.saleSnapshot?.deviceId || getDeviceId(), 64);
    const createdAt = clonedOp.saleSnapshot?.createdAt || clonedOp.createdAt || new Date().toISOString();

    const isMpPayment = paymentMethod === 'MERCADO_PAGO' || (cleanPaymentBreakdown && cleanPaymentBreakdown.mpAmount > 0);
    const paymentVerification = clonedOp.saleSnapshot?.paymentVerification || clonedOp.payload?.paymentVerification || (isMpPayment ? 'MANUAL' : 'MANUAL');
    const paymentDetails = clonedOp.saleSnapshot?.paymentDetails || clonedOp.payload?.paymentDetails || (isMpPayment ? {
      mode: 'OFFLINE',
      verification: 'MANUAL',
      notes: 'Cobro Mercado Pago registrado en modo offline (verificación manual)'
    } : undefined);

    // Reconstruct clean sale snapshot
    const reconstructedSale: Sale = cleanFirestoreData({
      id: saleId,
      businessId,
      sellerId: userId,
      sellerName: userName,
      items: cleanItems,
      total,
      paymentMethod,
      paymentVerification,
      paymentDetails,
      offline: true,
      paymentBreakdown: cleanPaymentBreakdown,
      cashReceived: clonedOp.saleSnapshot?.cashReceived !== undefined ? sanitizeNumber(clonedOp.saleSnapshot.cashReceived, 0, 999999999, 0) : undefined,
      change: clonedOp.saleSnapshot?.change !== undefined ? sanitizeNumber(clonedOp.saleSnapshot.change, 0, 999999999, 0) : undefined,
      status: saleStatus,
      createdAt,
      syncStatus: isCancelled ? 'CANCELLED' : (clonedOp.status === 'SYNCED' ? 'SYNCED' : 'PENDING') as any,
      syncMode: 'OFFLINE',
      syncedAt: clonedOp.syncedAt || null,
      deviceId,
      outboxOperationId: clonedOp.operationId
    });

    clonedOp.saleSnapshot = reconstructedSale;

    // Reconstruct clean payload for sync processing
    clonedOp.payload = cleanFirestoreData({
      businessId,
      sellerId: userId,
      sellerName: userName,
      items: cleanItems.map(it => ({
        product: {
          id: it.productId,
          name: it.productName,
          category: it.category || 'General',
          barcode: it.barcode || null,
          costPrice: 0,
          salePrice: it.unitPrice,
          stock: 0,
          minimumStock: 0,
          active: true,
          isCombo: it.isCombo || false,
          comboItems: it.comboItems || [],
          tracksStock: true,
          businessId,
          createdAt: '',
          updatedAt: ''
        },
        quantity: it.quantity
      })),
      total,
      paymentMethod,
      paymentBreakdown: cleanPaymentBreakdown,
      cashReceived: reconstructedSale.cashReceived,
      change: reconstructedSale.change,
      saleId,
      deviceId
    });

    clonedOp.userId = userId;
    clonedOp.userName = userName;
    clonedOp.deviceId = deviceId;
  }

  // 4. Recursive Sanitization of entire Outbox Operation
  const sanitizedOp = cleanFirestoreData(clonedOp);

  // 5. Recover from previous 'undefined' error in Firestore Transaction.set() ONLY if not cancelled and not synced
  const errorMsg = String(sanitizedOp.lastError || '');
  const hadUndefinedError = 
    errorMsg.includes('Unsupported field value: undefined') ||
    errorMsg.includes('Transaction.set() called with invalid data') ||
    errorMsg.includes('El objeto Sale es nulo o inválido');

  if (hadUndefinedError && !isCancelled && sanitizedOp.status !== 'CANCELLED' && sanitizedOp.status !== 'SYNCED') {
    sanitizedOp.status = 'PENDING';
    sanitizedOp.lastError = null;
    reasons.push("Operación recuperada del error 'undefined': saneada y reestablecida a PENDING");
    wasRepaired = true;
  }

  return {
    op: sanitizedOp,
    wasRepaired: wasRepaired || reasons.length > 0,
    reasons,
    isUnrepairable: false
  };
}

/**
 * Audits and repairs all outbox operations stored in IndexedDB for a business,
 * ensuring strict consistency with offline sales store.
 */
export async function repairAndMigrateAllOfflineOperations(businessId: string): Promise<BatchRepairSummary> {
  const summary: BatchRepairSummary = {
    totalChecked: 0,
    repairedCount: 0,
    unrepairableCount: 0,
    repairedIds: [],
    diagnostics: []
  };

  if (!businessId) return summary;

  try {
    const operations = await localDataStore.getOutboxOperations(businessId);
    const offlineSales = await localDataStore.getOfflineSalesByBusiness(businessId);
    const salesMap = new Map<string, Sale>();
    offlineSales.forEach(s => { if (s.id) salesMap.set(s.id, s); });

    summary.totalChecked = operations.length;

    for (const op of operations) {
      const correspondingSale = 
        (op.saleId && salesMap.get(op.saleId)) ||
        salesMap.get(op.operationId) ||
        Array.from(salesMap.values()).find(s => 
          s.outboxOperationId === op.operationId || 
          (op.saleId && (s.id === op.saleId || s.id?.endsWith(op.saleId)))
        );

      const isSaleCancelledInStore = correspondingSale?.status === 'CANCELLED' || correspondingSale?.syncStatus === 'CANCELLED';

      if (isSaleCancelledInStore && op.status !== 'CANCELLED') {
        op.status = 'CANCELLED';
        if (op.saleSnapshot) {
          op.saleSnapshot.status = 'CANCELLED';
          op.saleSnapshot.syncStatus = 'CANCELLED';
        }
      }

      const repairResult = repairOfflineOperation(op);

      if (repairResult.isUnrepairable) {
        summary.unrepairableCount++;
        summary.diagnostics.push({
          operationId: op.operationId,
          saleId: op.saleId,
          diagnostic: repairResult.diagnosticError || 'Error estructural no reparable'
        });

        // Mark operation with diagnostic in IndexedDB without deleting it
        await localDataStore.updateOutboxOperationStatus(
          businessId,
          op.operationId,
          'ERROR',
          repairResult.diagnosticError || 'Operación inválida no recuperable',
          null
        );
      } else if (repairResult.wasRepaired || isSaleCancelledInStore) {
        summary.repairedCount++;
        summary.repairedIds.push(op.operationId);

        // Save repaired operation in IndexedDB
        await localDataStore.saveOutboxOperation(repairResult.op);

        // Update corresponding local entity
        if (repairResult.op.operationType === 'SALE' && repairResult.op.saleSnapshot) {
          await localDataStore.saveOfflineSale(repairResult.op.saleSnapshot);
        }

        console.log(`[OfflineRepair] Operación #${op.operationId} reparada exitosamente:`, repairResult.reasons);
      }
    }

    return summary;
  } catch (err) {
    console.error('[OfflineRepair] Error durante la migración de operaciones offline:', err);
    return summary;
  }
}
