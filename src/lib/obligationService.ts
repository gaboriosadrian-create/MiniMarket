import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  PaymentObligation, 
  PaymentSettlement, 
  PaymentObligationStatus, 
  PaymentObligationSourceType,
  FundSource,
  PurchasePaymentMethod,
  UserProfile,
  CashMovement
} from '../types';
import { sanitizeString, sanitizeNumber } from './securityUtils';
import { createNotification } from './notificationService';

export interface CreateObligationInput {
  businessId: string;
  sourceType: PaymentObligationSourceType;
  sourceId?: string;
  sourceCode?: string;
  supplierName: string;
  beneficiary?: string;
  category?: string;
  description: string;
  amount: number;
  dueDate?: string;
  paymentMethod?: PurchasePaymentMethod;
  fundSource?: FundSource;
  receiptNumber?: string;
  notes?: string;
  createdBy: string;
  creatorName: string;
  notifyAdmin?: boolean;
}

/**
 * Creates a payment obligation (deuda pendiente) ensuring no duplicates for the same sourceId.
 */
export async function createPaymentObligation(input: CreateObligationInput): Promise<PaymentObligation> {
  const cleanBusinessId = sanitizeString(input.businessId, 64);
  if (!cleanBusinessId) throw new Error('businessId es requerido');

  const amount = sanitizeNumber(input.amount, 0, 99999999, 0);
  if (amount <= 0) throw new Error('El importe de la obligación debe ser mayor a 0');

  // Idempotency / Deduplication check: If sourceId is provided, check if obligation already exists
  if (input.sourceId) {
    try {
      const q = query(
        collection(db, 'payment_obligations'),
        where('businessId', '==', cleanBusinessId),
        where('sourceId', '==', input.sourceId)
      );
      const existingSnap = await getDocs(q);
      if (!existingSnap.empty) {
        const existing = existingSnap.docs[0].data() as PaymentObligation;
        return {
          ...existing,
          id: existingSnap.docs[0].id
        };
      }
    } catch (e) {
      console.warn('[obligationService] Error verificando obligación existente:', e);
    }
  }

  const now = new Date().toISOString();
  const obligationRef = doc(collection(db, 'payment_obligations'));
  const id = obligationRef.id;

  const supplier = (input.supplierName || input.beneficiary || 'Proveedor sin especificar').trim();

  const obligation: PaymentObligation = {
    id,
    businessId: cleanBusinessId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    sourceCode: input.sourceCode,
    supplierName: supplier,
    beneficiary: input.beneficiary?.trim() || supplier,
    category: input.category || 'Proveedores',
    description: input.description.trim(),
    amount,
    pendingAmount: amount,
    status: 'PENDING',
    dueDate: input.dueDate || undefined,
    paymentMethod: input.paymentMethod || 'EFECTIVO',
    fundSource: input.fundSource || 'CASH',
    receiptNumber: input.receiptNumber?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdBy: input.createdBy,
    creatorName: input.creatorName || 'Usuario',
    createdAt: now,
    updatedAt: now
  };

  // Remove undefined fields for Firestore
  const payload: Record<string, any> = {};
  Object.entries(obligation).forEach(([k, v]) => {
    if (v !== undefined) payload[k] = v;
  });

  await setDoc(obligationRef, payload);

  // Dispatch Notification if requested (default true)
  if (input.notifyAdmin !== false) {
    try {
      const notifType = input.sourceType === 'PURCHASE' ? 'COMPRA_PENDIENTE' : 'RECEPCION_PENDIENTE_PAGO';
      await createNotification({
        businessId: cleanBusinessId,
        targetRole: 'ADMIN',
        type: notifType,
        title: `🔴 Obligación a cancelar: $${amount.toLocaleString('es-AR')}`,
        message: `${supplier} — ${input.description} (Registrado por ${obligation.creatorName})`,
        eventId: `notif_obl_${id}`,
        linkTab: 'gastos',
        metadata: {
          obligationId: id,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          supplierName: supplier,
          amount
        }
      });
    } catch (e) {
      console.warn('[obligationService] Error enviando notificación de obligación:', e);
    }
  }

  return obligation;
}

/**
 * Fetches all payment obligations for a business with optional filters.
 */
export async function getPaymentObligationsByBusiness(
  businessId: string,
  filters?: {
    status?: PaymentObligationStatus | 'ALL';
    sourceType?: PaymentObligationSourceType | 'ALL';
    supplierName?: string;
    startDateIso?: string;
    endDateIso?: string;
  }
): Promise<PaymentObligation[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  const ref = collection(db, 'payment_obligations');
  const q = query(ref, where('businessId', '==', cleanBusinessId));
  const snap = await getDocs(q);

  let list: PaymentObligation[] = [];
  snap.forEach((docSnap) => {
    list.push({
      id: docSnap.id,
      ...docSnap.data()
    } as PaymentObligation);
  });

  if (filters) {
    if (filters.status && filters.status !== 'ALL') {
      list = list.filter(o => o.status === filters.status);
    }
    if (filters.sourceType && filters.sourceType !== 'ALL') {
      list = list.filter(o => o.sourceType === filters.sourceType);
    }
    if (filters.supplierName && filters.supplierName.trim()) {
      const qSup = filters.supplierName.toLowerCase().trim();
      list = list.filter(o => (o.supplierName || '').toLowerCase().includes(qSup));
    }
    if (filters.startDateIso || filters.endDateIso) {
      list = list.filter(o => {
        if (!o.createdAt) return false;
        if (filters.startDateIso && o.createdAt < filters.startDateIso) return false;
        if (filters.endDateIso && o.createdAt > filters.endDateIso) return false;
        return true;
      });
    }
  }

  // Sort descending by creation date
  list.sort((a, b) => {
    const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tB - tA;
  });

  return list;
}

export interface SupplierObligationGroup {
  supplierName: string;
  totalPendingAmount: number;
  totalOriginalAmount: number;
  count: number;
  obligations: PaymentObligation[];
}

/**
 * Groups pending payment obligations by supplier.
 */
export function groupObligationsBySupplier(obligations: PaymentObligation[]): SupplierObligationGroup[] {
  const map = new Map<string, SupplierObligationGroup>();

  for (const obl of obligations) {
    const sup = (obl.supplierName || obl.beneficiary || 'Varios').trim();
    const existing = map.get(sup);
    const pending = Number(obl.pendingAmount ?? obl.amount ?? 0);
    const orig = Number(obl.amount ?? 0);

    if (existing) {
      existing.totalPendingAmount += pending;
      existing.totalOriginalAmount += orig;
      existing.count += 1;
      existing.obligations.push(obl);
    } else {
      map.set(sup, {
        supplierName: sup,
        totalPendingAmount: pending,
        totalOriginalAmount: orig,
        count: 1,
        obligations: [obl]
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.totalPendingAmount - a.totalPendingAmount);
}

export interface SettleObligationInput {
  obligationId: string;
  amount: number;
  paymentDate?: string;
  paymentMethod: PurchasePaymentMethod;
  fundSource: FundSource;
  notes?: string;
  user: UserProfile;
}

/**
 * Settles a payment obligation (Registrar cancelación de deuda).
 * Executes atomic Firestore transaction:
 * - Deducts pendingAmount (marks PAID if <= 0)
 * - Creates PaymentSettlement
 * - Creates CashMovement only if fundSource === 'CASH'
 * - Preserves original purchase / expense record intact
 */
export async function settlePaymentObligation(input: SettleObligationInput): Promise<PaymentSettlement> {
  const { user, obligationId } = input;
  if (!user || !user.uid || !user.businessId) {
    throw new Error('Usuario no autorizado');
  }

  // Security Check: Role enforcement
  if (user.role === 'SELLER') {
    throw new Error('Los vendedores no tienen autorización para cancelar deudas administrativas.');
  }

  if (input.fundSource === 'PERSONAL' && user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    throw new Error('Solo los administradores pueden utilizar fondos personales para cancelar obligaciones.');
  }

  const cleanBusinessId = user.businessId;
  const oblRef = doc(db, 'payment_obligations', obligationId);
  const now = new Date().toISOString();
  const paymentDate = input.paymentDate 
    ? new Date(input.paymentDate).toISOString() 
    : now;

  let settlementResult: PaymentSettlement | null = null;

  await runTransaction(db, async (transaction) => {
    const oblSnap = await transaction.get(oblRef);
    if (!oblSnap.exists()) {
      throw new Error('La obligación no existe');
    }

    const obl = oblSnap.data() as PaymentObligation;
    if (obl.businessId !== cleanBusinessId) {
      throw new Error('No autorizado sobre este comercio');
    }

    if (obl.status === 'PAID') {
      throw new Error('Esta obligación ya se encuentra pagada');
    }
    if (obl.status === 'CANCELLED') {
      throw new Error('Esta obligación ha sido anulada');
    }

    const currentPending = Number(obl.pendingAmount ?? obl.amount ?? 0);
    const settleAmount = sanitizeNumber(input.amount, 0, currentPending, currentPending);
    if (settleAmount <= 0) {
      throw new Error('El importe a cancelar debe ser mayor a 0');
    }

    const remaining = Math.max(0, currentPending - settleAmount);
    const isFullyPaid = remaining <= 0;

    const settlementRef = doc(collection(db, 'payment_settlements'));
    const settlementId = settlementRef.id;

    let cashMovementId: string | undefined = undefined;

    // If paid with CASH (Dinero de Caja del negocio), create CashMovement
    if (input.fundSource === 'CASH') {
      const cashMovRef = doc(collection(db, 'cash_movements'));
      cashMovementId = cashMovRef.id;

      transaction.set(cashMovRef, {
        id: cashMovementId,
        businessId: cleanBusinessId,
        type: 'EXPENSE_PAYMENT',
        amount: -settleAmount,
        referenceId: obligationId,
        supplierName: obl.supplierName || obl.beneficiary || '',
        description: `Cancelación de deuda: ${obl.supplierName || 'Proveedor'} - ${obl.description}`,
        paymentMethod: input.paymentMethod,
        createdBy: user.uid,
        creatorName: user.displayName || user.email,
        createdAt: paymentDate
      });
    }

    // Record settlement document
    const settlementDoc: PaymentSettlement = {
      id: settlementId,
      obligationId,
      businessId: cleanBusinessId,
      amount: settleAmount,
      paymentDate,
      paymentMethod: input.paymentMethod,
      fundSource: input.fundSource,
      registeredBy: user.uid,
      registrarName: user.displayName || user.email,
      notes: input.notes?.trim() || undefined,
      cashMovementId,
      createdAt: now
    };

    const cleanSettlementPayload: Record<string, any> = {};
    Object.entries(settlementDoc).forEach(([k, v]) => {
      if (v !== undefined) cleanSettlementPayload[k] = v;
    });

    transaction.set(settlementRef, cleanSettlementPayload);

    // Update Obligation doc
    const updatePayload: Partial<PaymentObligation> = {
      pendingAmount: remaining,
      status: isFullyPaid ? 'PAID' : 'PENDING',
      updatedAt: now
    };

    if (isFullyPaid) {
      updatePayload.settledAt = paymentDate;
      updatePayload.settledBy = user.uid;
      updatePayload.settlerName = user.displayName || user.email;
    }

    transaction.update(oblRef, updatePayload);

    settlementResult = settlementDoc;
  });

  if (!settlementResult) {
    throw new Error('Error al registrar la cancelación');
  }

  // Send information notification
  try {
    await createNotification({
      businessId: cleanBusinessId,
      targetRole: 'ADMIN',
      type: 'PAGO_REALIZADO',
      title: `🟢 Pago registrado: $${input.amount.toLocaleString('es-AR')}`,
      message: `Cancelación a proveedor ${input.user.displayName || ''} — Origen: ${input.fundSource}`,
      eventId: `notif_set_${settlementResult.id}`,
      linkTab: 'gastos'
    });
  } catch (e) {
    console.warn('[obligationService] Error enviando notificación de pago:', e);
  }

  return settlementResult;
}

/**
 * Fetches settlement history for a specific obligation or for the entire business, with optional date filtering.
 */
export async function getPaymentSettlementsByBusiness(
  businessId: string,
  obligationId?: string,
  startDateIso?: string,
  endDateIso?: string
): Promise<PaymentSettlement[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  const ref = collection(db, 'payment_settlements');
  let q = query(ref, where('businessId', '==', cleanBusinessId));
  if (obligationId) {
    q = query(ref, where('businessId', '==', cleanBusinessId), where('obligationId', '==', obligationId));
  }

  const snap = await getDocs(q);
  let list: PaymentSettlement[] = [];
  snap.forEach((docSnap) => {
    list.push({
      id: docSnap.id,
      ...docSnap.data()
    } as PaymentSettlement);
  });

  if (startDateIso || endDateIso) {
    list = list.filter((s) => {
      const pDate = s.paymentDate || s.createdAt;
      if (!pDate) return false;
      if (startDateIso && pDate < startDateIso) return false;
      if (endDateIso && pDate > endDateIso) return false;
      return true;
    });
  }

  list.sort((a, b) => {
    const tA = a.paymentDate ? new Date(a.paymentDate).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.paymentDate ? new Date(b.paymentDate).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });

  return list;
}

/**
 * Updates non-financial metadata of a payment obligation (dueDate, notes, receiptNumber, category, description).
 * Financial amounts (amount, pendingAmount, businessId, sourceId) remain strictly protected.
 */
export async function updatePaymentObligation(
  obligationId: string,
  data: {
    notes?: string;
    dueDate?: string;
    receiptNumber?: string;
    category?: string;
    description?: string;
  },
  user: UserProfile
): Promise<void> {
  if (!user || (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN')) {
    throw new Error('Solo administradores pueden modificar obligaciones de pago.');
  }

  const oblRef = doc(db, 'payment_obligations', obligationId);
  const payload: Record<string, any> = {
    updatedAt: new Date().toISOString()
  };

  if (data.notes !== undefined) payload.notes = data.notes.trim() || undefined;
  if (data.dueDate !== undefined) payload.dueDate = data.dueDate || undefined;
  if (data.receiptNumber !== undefined) payload.receiptNumber = data.receiptNumber.trim() || undefined;
  if (data.category !== undefined) payload.category = data.category;
  if (data.description !== undefined) payload.description = data.description.trim();

  // Clean undefined
  const cleanPayload: Record<string, any> = {};
  Object.entries(payload).forEach(([k, v]) => {
    if (v !== undefined) cleanPayload[k] = v;
  });

  await updateDoc(oblRef, cleanPayload);
}
