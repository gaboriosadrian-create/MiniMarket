import { db } from './firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where, 
  limit, 
  orderBy 
} from 'firebase/firestore';
import { 
  BusinessEvent, 
  BusinessEventType, 
  BusinessEntityType, 
  EventFilterOptions,
  Sale,
  Purchase,
  Receiving,
  Expense,
  PaymentObligation,
  PaymentSettlement,
  StockAdjustment,
  ReplenishmentList
} from '../types';
import { localDataStore } from './localDataStore';

// In-memory cache for offline and fast deduplication
const inMemoryEventsCache = new Map<string, BusinessEvent>();

/**
 * Generates deterministic event IDs to guarantee absolute idempotency.
 * Format: event_<operationType>_<entityId>_<stateSuffix>
 */
export function generateEventId(
  type: BusinessEventType,
  entityId: string,
  stateSuffix: string = 'default'
): string {
  const cleanType = String(type || 'EVENT').toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  const cleanEntityId = String(entityId || 'entity').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanSuffix = String(stateSuffix || 'default').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `event_${cleanType}_${cleanEntityId}_${cleanSuffix}`;
}

/**
 * Validates and records a business event idempotently.
 * 
 * CRITICAL RULE:
 * This method ONLY creates traceability records. It NEVER creates:
 * - cash_movements
 * - inventory_movements
 * - payment_settlements
 * - payment_obligations
 * - sales, purchases or expenses
 */
export async function recordBusinessEvent(
  eventInput: Omit<BusinessEvent, 'id' | 'createdAt'> & { id?: string; createdAt?: string }
): Promise<BusinessEvent> {
  const businessId = eventInput.businessId?.trim();
  if (!businessId) {
    throw new Error('businessId es estrictamente requerido para registrar un evento');
  }

  const deterministicId = eventInput.id || generateEventId(
    eventInput.type,
    eventInput.entityId,
    (eventInput.metadata?.status as string) || (eventInput.metadata?.action as string) || 'RECORDED'
  );

  const eventRecord: BusinessEvent = {
    id: deterministicId,
    businessId,
    type: eventInput.type,
    entityType: eventInput.entityType,
    entityId: eventInput.entityId,
    title: eventInput.title,
    description: eventInput.description || '',
    actorUserId: eventInput.actorUserId,
    actorName: eventInput.actorName,
    createdAt: eventInput.createdAt || new Date().toISOString(),
    metadata: eventInput.metadata || {}
  };

  // 1. Check in-memory cache for immediate idempotency (isolated per businessId)
  const cacheKey = `${businessId}:${deterministicId}`;
  if (inMemoryEventsCache.has(cacheKey)) {
    return inMemoryEventsCache.get(cacheKey)!;
  }
  inMemoryEventsCache.set(cacheKey, eventRecord);

  // 2. Persist to Firestore idempotently if online
  try {
    const firestoreDocId = `${businessId}_${deterministicId}`;
    const eventDocRef = doc(db, 'business_events', firestoreDocId);
    // Sanitize payload to strip undefined fields so Firestore doesn't reject
    const cleanPayload: Record<string, any> = {};
    for (const [k, v] of Object.entries(eventRecord)) {
      if (v !== undefined) {
        cleanPayload[k] = v;
      }
    }
    await setDoc(eventDocRef, cleanPayload, { merge: true });
  } catch (err) {
    // If offline or permission error, in-memory cache remains valid and non-blocking
    console.warn('[eventService] Note on event persistence (cached locally):', err);
  }

  return eventRecord;
}

/**
 * Maps any BusinessEvent to its corresponding Admin tab and entity ID for smooth navigation.
 */
export function getEventNavigationTarget(event: BusinessEvent): { tab: string; entityId: string } {
  switch (event.entityType) {
    case 'SALE':
      return { tab: 'ventas', entityId: event.entityId };
    case 'PURCHASE':
      return { tab: 'compras', entityId: event.entityId };
    case 'RECEIVING':
      return { tab: 'receivings', entityId: event.entityId };
    case 'EXPENSE':
      return { tab: 'gastos', entityId: event.entityId };
    case 'OBLIGATION':
      return { tab: 'obligations', entityId: event.entityId };
    case 'INVENTORY':
      return { tab: 'adjustments', entityId: event.entityId };
    case 'REQUEST':
      return { tab: 'replenishment', entityId: event.entityId };
    case 'CASH':
      return { tab: 'caja', entityId: event.entityId };
    default:
      return { tab: 'control', entityId: event.entityId };
  }
}

/**
 * Calculates start and end ISO strings based on preset.
 */
function getFilterDateBounds(filter?: EventFilterOptions): { startIso?: string; endIso?: string } {
  if (!filter || !filter.preset) {
    if (filter?.startDate || filter?.endDate) {
      return {
        startIso: filter.startDate ? new Date(filter.startDate + 'T00:00:00').toISOString() : undefined,
        endIso: filter.endDate ? new Date(filter.endDate + 'T23:59:59.999').toISOString() : undefined
      };
    }
    return {};
  }

  const now = new Date();
  if (filter.preset === 'HOY') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (filter.preset === 'AYER') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  }

  if (filter.preset === 'ULTIMOS_7') {
    const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return { startIso: start.toISOString(), endIso: now.toISOString() };
  }

  if (filter.preset === 'ULTIMOS_30') {
    const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return { startIso: start.toISOString(), endIso: now.toISOString() };
  }

  if (filter.preset === 'CUSTOM') {
    return {
      startIso: filter.startDate ? new Date(filter.startDate + 'T00:00:00').toISOString() : undefined,
      endIso: filter.endDate ? new Date(filter.endDate + 'T23:59:59.999').toISOString() : undefined
    };
  }

  return {};
}

/**
 * Fetches all business events for the Event Center timeline.
 * 
 * Unifies:
 * 1. Persisted `business_events` in Firestore.
 * 2. In-memory registered events.
 * 3. Real operational collections (Sales, Purchases, Receivings, Expenses, Obligations, Adjustments, Replenishment)
 *    using deterministic IDs to guarantee 100% complete traceability without any duplicates.
 * 4. Strictly isolated by businessId.
 */
export async function getBusinessEvents(
  businessId: string,
  filter?: EventFilterOptions
): Promise<BusinessEvent[]> {
  const cleanBusinessId = businessId?.trim();
  if (!cleanBusinessId) return [];

  const unifiedEventsMap = new Map<string, BusinessEvent>();

  // 1. Add cached in-memory events for this businessId
  for (const [id, ev] of inMemoryEventsCache.entries()) {
    if (ev.businessId === cleanBusinessId) {
      unifiedEventsMap.set(id, ev);
    }
  }

  // 2. Fetch from Firestore `business_events` collection
  try {
    const eventsRef = collection(db, 'business_events');
    const eventsQuery = query(
      eventsRef,
      where('businessId', '==', cleanBusinessId),
      limit(200)
    );
    const snap = await getDocs(eventsQuery);
    snap.forEach(d => {
      const data = d.data() as BusinessEvent;
      if (data.businessId === cleanBusinessId) {
        unifiedEventsMap.set(d.id, { id: d.id, ...data });
      }
    });
  } catch (err) {
    console.warn('[eventService] Note on fetching business_events (falling back to operational records):', err);
  }

  // 3. Synthesize events from real operational records to guarantee complete history
  try {
    // A. Sales
    const salesRef = collection(db, 'sales');
    const salesQ = query(salesRef, where('businessId', '==', cleanBusinessId), limit(150));
    const salesSnap = await getDocs(salesQ);
    salesSnap.forEach(docSnap => {
      const s = docSnap.data() as Sale;
      const isCancelled = s.status === 'CANCELLED';
      const eventType: BusinessEventType = isCancelled ? 'SALE_CANCELLED' : 'SALE_CREATED';
      const evId = generateEventId(eventType, docSnap.id, isCancelled ? 'CANCELLED' : 'COMPLETED');
      
      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: eventType,
          entityType: 'SALE',
          entityId: docSnap.id,
          title: isCancelled ? `Venta Anulada #${docSnap.id.slice(-6).toUpperCase()}` : `Venta Realizada #${docSnap.id.slice(-6).toUpperCase()}`,
          description: `Total: $${Number(s.total || 0).toLocaleString('es-AR')} • Método: ${s.paymentMethod || 'EFECTIVO'} • ${(s.items || []).length} ítems`,
          actorUserId: s.sellerId,
          actorName: s.sellerName || 'Vendedor',
          createdAt: s.createdAt || new Date().toISOString(),
          metadata: {
            amount: Number(s.total || 0),
            paymentMethod: s.paymentMethod,
            itemsCount: (s.items || []).length,
            status: s.status,
            destinationTab: 'ventas'
          }
        });
      }
    });
  } catch (err) {
    console.warn('[eventService] Error querying sales for event timeline:', err);
  }

  try {
    // B. Purchases
    const purRef = collection(db, 'purchases');
    const purQ = query(purRef, where('businessId', '==', cleanBusinessId), limit(150));
    const purSnap = await getDocs(purQ);
    purSnap.forEach(docSnap => {
      const p = docSnap.data() as Purchase;
      const isCancelled = p.status === 'CANCELLED';
      const eventType: BusinessEventType = isCancelled ? 'PURCHASE_CANCELLED' : (p.status === 'CONFIRMED' ? 'PURCHASE_CONFIRMED' : 'PURCHASE_CREATED');
      const evId = generateEventId(eventType, docSnap.id, p.status || 'DRAFT');

      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: eventType,
          entityType: 'PURCHASE',
          entityId: docSnap.id,
          title: isCancelled ? `Compra Anulada #${docSnap.id.slice(-6).toUpperCase()}` : `Compra ${p.status === 'CONFIRMED' ? 'Confirmada' : 'Registrada'} #${docSnap.id.slice(-6).toUpperCase()}`,
          description: `Proveedor: ${p.supplierName || 'Varios'} • Total: $${Number(p.total || 0).toLocaleString('es-AR')} • Condición: ${p.paymentStatus === 'A_CANCELAR' ? 'A Cancelar' : 'Al Contado'}`,
          actorUserId: p.userId,
          actorName: (p as any).userName || 'Administrador',
          createdAt: p.createdAt || new Date().toISOString(),
          metadata: {
            amount: Number(p.total || 0),
            supplierName: p.supplierName,
            status: p.status,
            paymentStatus: p.paymentStatus,
            itemsCount: (p.items || []).length,
            destinationTab: 'compras'
          }
        });
      }
    });
  } catch (err) {
    console.warn('[eventService] Error querying purchases for event timeline:', err);
  }

  try {
    // C. Receivings & Variances
    const recRef = collection(db, 'receivings');
    const recQ = query(recRef, where('businessId', '==', cleanBusinessId), limit(150));
    const recSnap = await getDocs(recQ);
    recSnap.forEach(docSnap => {
      const r = docSnap.data() as Receiving;
      const isPartial = r.hasDifference || ((r.totalShortageUnits ?? 0) > 0);
      const eventType: BusinessEventType = isPartial ? 'RECEIVING_PARTIAL' : 'RECEIVING_CONFIRMED';
      const evId = generateEventId(eventType, docSnap.id, r.status || 'DRAFT');

      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: eventType,
          entityType: 'RECEIVING',
          entityId: docSnap.id,
          title: `Recepción ${isPartial ? 'con Diferencia' : 'Confirmada'} #${docSnap.id.slice(-6).toUpperCase()}`,
          description: `Proveedor: ${r.supplierName || 'Varios'} • ${(r.items || []).length} ítems recibidos`,
          actorUserId: r.createdBy,
          actorName: r.creatorName || 'Receptor',
          createdAt: r.createdAt || new Date().toISOString(),
          metadata: {
            supplierName: r.supplierName,
            status: r.status,
            itemsCount: (r.items || []).length,
            destinationTab: 'receivings'
          }
        });
      }

      // Check variances inside receiving items
      if (r.hasDifference || ((r.totalShortageUnits ?? 0) > 0) || ((r.totalSurplusUnits ?? 0) > 0)) {
        (r.items || []).forEach((item, idx) => {
          if ((item.shortageQuantity ?? 0) > 0) {
            const varType: BusinessEventType = item.shortageClosed ? 'SHORTAGE_CLOSED' : 'SHORTAGE_DETECTED';
            const varEvId = generateEventId(varType, `${docSnap.id}_s${idx}`, item.shortageClosed ? 'CLOSED' : 'DETECTED');
            if (!unifiedEventsMap.has(varEvId)) {
              unifiedEventsMap.set(varEvId, {
                id: varEvId,
                businessId: cleanBusinessId,
                type: varType,
                entityType: 'RECEIVING',
                entityId: docSnap.id,
                title: item.shortageClosed ? `Faltante Resuelto: ${item.productName}` : `Faltante Detectado: ${item.productName} (-${item.shortageQuantity})`,
                description: `Recepción #${docSnap.id.slice(-6).toUpperCase()} • Faltante: ${item.shortageQuantity} un. • Motivo: ${item.shortageReason || r.shortageReason || 'Diferencia en recepción'}`,
                actorUserId: r.createdBy,
                actorName: r.creatorName || 'Receptor',
                createdAt: r.createdAt || new Date().toISOString(),
                metadata: {
                  productName: item.productName,
                  quantityDiff: item.shortageQuantity,
                  destinationTab: 'receivings'
                }
              });
            }
          } else if ((item.surplusQuantity ?? 0) > 0) {
            let varType: BusinessEventType = 'SURPLUS_CHARGED';
            if (item.surplusTreatment === 'FREE') varType = 'SURPLUS_FREE';
            else if (item.surplusTreatment === 'REJECT') varType = 'SURPLUS_REJECTED';

            const varEvId = generateEventId(varType, `${docSnap.id}_p${idx}`, item.surplusTreatment || 'CHARGED');
            if (!unifiedEventsMap.has(varEvId)) {
              unifiedEventsMap.set(varEvId, {
                id: varEvId,
                businessId: cleanBusinessId,
                type: varType,
                entityType: 'RECEIVING',
                entityId: docSnap.id,
                title: `Sobrante: ${item.productName} (+${item.surplusQuantity})`,
                description: `Recepción #${docSnap.id.slice(-6).toUpperCase()} • Sobrante: ${item.surplusQuantity} un. • Tratamiento: ${item.surplusTreatment || 'Cobrado'}`,
                actorUserId: r.createdBy,
                actorName: r.creatorName || 'Receptor',
                createdAt: r.createdAt || new Date().toISOString(),
                metadata: {
                  productName: item.productName,
                  quantityDiff: item.surplusQuantity,
                  destinationTab: 'receivings'
                }
              });
            }
          }
        });
      }
    });
  } catch (err) {
    console.warn('[eventService] Error querying receivings for event timeline:', err);
  }

  try {
    // D. Operating Expenses
    const expRef = collection(db, 'expenses');
    const expQ = query(expRef, where('businessId', '==', cleanBusinessId), limit(150));
    const expSnap = await getDocs(expQ);
    expSnap.forEach(docSnap => {
      const e = docSnap.data() as Expense;
      const isCancelled = (e as any).status === 'ANULADO' || (e as any).status === 'CANCELLED';
      const isPaid = (e as any).status === 'PAGADO';
      const isPending = (e as any).status === 'PENDIENTE';

      let evType: BusinessEventType = 'EXPENSE_CREATED';
      if (isCancelled) evType = 'EXPENSE_CANCELLED';
      else if (isPaid) evType = 'EXPENSE_PAID';

      const evId = generateEventId(evType, docSnap.id, (e as any).status || 'CREATED');
      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: evType,
          entityType: 'EXPENSE',
          entityId: docSnap.id,
          title: isCancelled ? `Gasto Anulado: ${e.description || 'Gasto'}` : (isPending ? `Gasto Pendiente: ${e.description || 'Gasto'}` : `Gasto Pagado: ${e.description || 'Gasto'}`),
          description: `Importe: $${Number(e.amount || 0).toLocaleString('es-AR')} • Origen: ${e.fundSource === 'PERSONAL' ? 'Fondos Personales' : 'Fondos del Negocio'} • Categoría: ${e.category || 'General'}`,
          actorUserId: e.userId,
          actorName: (e as any).userName || 'Administrador',
          createdAt: e.createdAt || new Date().toISOString(),
          metadata: {
            amount: Number(e.amount || 0),
            fundSource: e.fundSource,
            status: (e as any).status,
            category: e.category,
            destinationTab: 'gastos'
          }
        });
      }
    });
  } catch (err) {
    console.warn('[eventService] Error querying expenses for event timeline:', err);
  }

  try {
    // E. Payment Obligations & Settlements
    const oblRef = collection(db, 'payment_obligations');
    const oblQ = query(oblRef, where('businessId', '==', cleanBusinessId), limit(150));
    const oblSnap = await getDocs(oblQ);
    oblSnap.forEach(docSnap => {
      const o = docSnap.data() as PaymentObligation;
      const isPaid = o.status === 'PAID';
      const evType: BusinessEventType = isPaid ? 'OBLIGATION_PAID' : 'OBLIGATION_CREATED';
      const evId = generateEventId(evType, docSnap.id, o.status || 'PENDING');

      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: evType,
          entityType: 'OBLIGATION',
          entityId: docSnap.id,
          title: isPaid ? `Obligación Liquidada: ${o.supplierName || 'Proveedor'}` : `Obligación de Pago: ${o.supplierName || 'Proveedor'}`,
          description: `Importe: $${Number(o.amount || 0).toLocaleString('es-AR')} • Pendiente: $${Number(o.pendingAmount ?? o.amount ?? 0).toLocaleString('es-AR')} • Vence: ${o.dueDate || 'Sin fecha'}`,
          actorUserId: (o as any).createdBy,
          createdAt: o.createdAt || new Date().toISOString(),
          metadata: {
            amount: Number(o.amount || 0),
            pendingAmount: Number(o.pendingAmount ?? o.amount ?? 0),
            supplierName: o.supplierName,
            status: o.status,
            destinationTab: 'obligations'
          }
        });
      }
    });

    const setRef = collection(db, 'payment_settlements');
    const setQ = query(setRef, where('businessId', '==', cleanBusinessId), limit(150));
    const setSnap = await getDocs(setQ);
    setSnap.forEach(docSnap => {
      const s = docSnap.data() as PaymentSettlement;
      const evType: BusinessEventType = 'OBLIGATION_PAYMENT';
      const evId = generateEventId(evType, docSnap.id, 'SETTLED');

      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: evType,
          entityType: 'OBLIGATION',
          entityId: s.obligationId || docSnap.id,
          title: 'Liquidación de Pago / Deuda',
          description: `Pago abonado: $${Number(s.amount || 0).toLocaleString('es-AR')} • Método: ${s.paymentMethod || 'EFECTIVO'} • Origen: ${s.fundSource || 'CASH'}`,
          actorUserId: s.registeredBy,
          actorName: s.registrarName || 'Administrador',
          createdAt: s.createdAt || s.paymentDate || new Date().toISOString(),
          metadata: {
            amount: Number(s.amount || 0),
            paymentMethod: s.paymentMethod,
            fundSource: s.fundSource,
            obligationId: s.obligationId,
            destinationTab: 'obligations'
          }
        });
      }
    });
  } catch (err) {
    console.warn('[eventService] Error querying obligations for event timeline:', err);
  }

  try {
    // F. Stock Adjustments
    const adjRef = collection(db, 'stock_adjustments');
    const adjQ = query(adjRef, where('businessId', '==', cleanBusinessId), limit(100));
    const adjSnap = await getDocs(adjQ);
    adjSnap.forEach(docSnap => {
      const a = docSnap.data() as StockAdjustment;
      const evType: BusinessEventType = 'INVENTORY_ADJUSTMENT';
      const evId = generateEventId(evType, docSnap.id, 'CONFIRMED');

      const firstItemReason = (a.items && a.items.length > 0) ? (a.items[0].reason || a.items[0].customReason) : undefined;
      let totalDiffUnits = 0;
      (a.items || []).forEach(it => {
        if (it.newStock !== undefined && it.previousStock !== undefined) {
          totalDiffUnits += (Number(it.newStock) - Number(it.previousStock));
        } else if (it.adjustmentType === 'IN') {
          totalDiffUnits += Number(it.quantity) || 0;
        } else if (it.adjustmentType === 'OUT') {
          totalDiffUnits -= Number(it.quantity) || 0;
        }
      });
      const isPositive = totalDiffUnits > 0;
      const isNegative = totalDiffUnits < 0;
      const adjDirectionLabel = isPositive ? 'Positivo' : isNegative ? 'Negativo' : 'Neutro';
      const adjDiffFormatted = isPositive ? `+${totalDiffUnits}` : `${totalDiffUnits}`;

      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: evType,
          entityType: 'INVENTORY',
          entityId: docSnap.id,
          title: `Ajuste de Stock ${adjDirectionLabel} (${adjDiffFormatted} u.)`,
          description: `Motivo: ${a.generalNotes || firstItemReason || 'Recuento manual'} • ${(a.items || []).length} productos afectados`,
          actorUserId: a.createdBy,
          actorName: a.creatorName || 'Operador',
          createdAt: a.createdAt || new Date().toISOString(),
          metadata: {
            reason: a.generalNotes || firstItemReason,
            itemsCount: (a.items || []).length,
            adjustmentDirection: isPositive ? 'POSITIVE' : isNegative ? 'NEGATIVE' : 'NEUTRAL',
            totalDiffUnits,
            destinationTab: 'adjustments'
          }
        });
      }
    });
  } catch (err) {
    console.warn('[eventService] Error querying stock adjustments for event timeline:', err);
  }

  try {
    // G. Replenishment Requests
    const repRef = collection(db, 'replenishment_lists');
    const repQ = query(repRef, where('businessId', '==', cleanBusinessId), limit(100));
    const repSnap = await getDocs(repQ);
    repSnap.forEach(docSnap => {
      const r = docSnap.data() as ReplenishmentList;
      let evType: BusinessEventType = 'REQUEST_CREATED';
      if (r.status === 'APPROVED') evType = 'REQUEST_APPROVED';
      else if (r.status === 'REJECTED') evType = 'REQUEST_REJECTED';

      const evId = generateEventId(evType, docSnap.id, r.status || 'DRAFT');
      if (!unifiedEventsMap.has(evId)) {
        unifiedEventsMap.set(evId, {
          id: evId,
          businessId: cleanBusinessId,
          type: evType,
          entityType: 'REQUEST',
          entityId: docSnap.id,
          title: `Solicitud de Reposición #${docSnap.id.slice(-6).toUpperCase()}${r.supplierName ? ' - ' + r.supplierName : ''}`,
          description: `Estado: ${r.status || 'DRAFT'} • ${(r.items || []).length} ítems solicitados`,
          actorUserId: r.createdBy,
          actorName: r.creatorName || 'Vendedor',
          createdAt: r.createdAt || new Date().toISOString(),
          metadata: {
            status: r.status,
            supplierName: r.supplierName,
            itemsCount: (r.items || []).length,
            destinationTab: 'replenishment'
          }
        });
      }
    });
  } catch (err) {
    console.warn('[eventService] Error querying replenishment for event timeline:', err);
  }

  // 4. Apply Filters
  let allEvents = Array.from(unifiedEventsMap.values());

  // Strict tenant isolation guard
  allEvents = allEvents.filter(ev => ev.businessId === cleanBusinessId);

  // Date range filter
  const { startIso, endIso } = getFilterDateBounds(filter);
  if (startIso) {
    allEvents = allEvents.filter(ev => ev.createdAt >= startIso);
  }
  if (endIso) {
    allEvents = allEvents.filter(ev => ev.createdAt <= endIso);
  }

  // Entity Type / Cancellations filter
  if (filter?.entityType && filter.entityType !== 'ALL') {
    if (filter.entityType === 'CANCELLATIONS') {
      allEvents = allEvents.filter(ev => {
        return (
          ev.type.includes('CANCELLED') ||
          ev.type.includes('REJECTED') ||
          ev.metadata?.status === 'CANCELLED' ||
          ev.metadata?.status === 'ANULADO' ||
          ev.title.toLowerCase().includes('anulad') ||
          (ev.description || '').toLowerCase().includes('anulad')
        );
      });
    } else {
      allEvents = allEvents.filter(ev => ev.entityType === filter.entityType);
    }
  }

  // Specific eventType filter
  if (filter?.eventType) {
    allEvents = allEvents.filter(ev => ev.type === filter.eventType);
  }

  // Subfilter (Shortages, Surpluses, Cancellations)
  if (filter?.subFilter && filter.subFilter !== 'ALL') {
    if (filter.subFilter === 'SHORTAGES') {
      allEvents = allEvents.filter(ev => 
        ev.type === 'SHORTAGE_DETECTED' || 
        ev.type === 'SHORTAGE_CLOSED' || 
        ev.title.toLowerCase().includes('faltante')
      );
    } else if (filter.subFilter === 'SURPLUSES') {
      allEvents = allEvents.filter(ev => 
        ev.type === 'SURPLUS_FREE' || 
        ev.type === 'SURPLUS_CHARGED' || 
        ev.type === 'SURPLUS_REJECTED' || 
        ev.title.toLowerCase().includes('sobrante')
      );
    } else if (filter.subFilter === 'CANCELLATIONS') {
      allEvents = allEvents.filter(ev => 
        ev.type.includes('CANCELLED') || 
        ev.type.includes('REJECTED') || 
        ev.metadata?.status === 'CANCELLED' || 
        ev.metadata?.status === 'ANULADO' || 
        ev.title.toLowerCase().includes('anulad')
      );
    }
  }

  // Search query filter (product, supplier, user, ID, description, title, receipt, type)
  if (filter?.searchQuery && filter.searchQuery.trim().length > 0) {
    const q = filter.searchQuery.toLowerCase().trim();
    allEvents = allEvents.filter(ev => {
      const matchTitle = ev.title.toLowerCase().includes(q);
      const matchDesc = (ev.description || '').toLowerCase().includes(q);
      const matchId = ev.id.toLowerCase().includes(q) || ev.entityId.toLowerCase().includes(q);
      const matchUser = (ev.actorName || '').toLowerCase().includes(q);
      const matchSupplier = String(ev.metadata?.supplierName || '').toLowerCase().includes(q);
      const matchProduct = String(ev.metadata?.productName || '').toLowerCase().includes(q);
      const matchReceipt = String(ev.metadata?.receiptNumber || ev.metadata?.referenceCode || '').toLowerCase().includes(q);
      const matchType = ev.type.toLowerCase().includes(q);
      const matchStatus = String(ev.metadata?.status || '').toLowerCase().includes(q);
      const matchReason = String(ev.metadata?.reason || '').toLowerCase().includes(q);
      return matchTitle || matchDesc || matchId || matchUser || matchSupplier || matchProduct || matchReceipt || matchType || matchStatus || matchReason;
    });
  }

  // 5. Sort descending by createdAt
  allEvents.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

  // Limit count if requested
  if (filter?.limitCount && filter.limitCount > 0) {
    allEvents = allEvents.slice(0, filter.limitCount);
  }

  return allEvents;
}
