import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  CashRegister, 
  CashSession, 
  CashMovement, 
  CashSessionSummary, 
  CashMovementType, 
  CashFlowType, 
  PurchasePaymentMethod 
} from '../types';
import { sanitizeString, sanitizeNumber } from './securityUtils';

/**
 * Creates a new Cash Register in `cash_registers` collection.
 * Physical status is ACTIVE by default.
 */
export async function createCashRegister(
  businessId: string,
  name: string,
  branchId?: string,
  userId?: string
): Promise<CashRegister> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  const cleanName = sanitizeString(name, 100) || 'Caja Principal';
  if (!cleanBusinessId) throw new Error('businessId es requerido');

  const regRef = doc(collection(db, 'cash_registers'));
  const now = new Date().toISOString();

  const newRegister: CashRegister = {
    id: regRef.id,
    businessId: cleanBusinessId,
    branchId: branchId ? sanitizeString(branchId, 64) : undefined,
    name: cleanName,
    status: 'ACTIVE',
    currentSessionId: null,
    createdBy: userId ? sanitizeString(userId, 64) : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(regRef, newRegister);
  return newRegister;
}

/**
 * Lists all Cash Registers for a given business tenant.
 */
export async function getCashRegisters(businessId: string): Promise<CashRegister[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  try {
    const q = query(
      collection(db, 'cash_registers'),
      where('businessId', '==', cleanBusinessId)
    );
    const snap = await getDocs(q);
    const registers: CashRegister[] = [];
    snap.forEach((docSnap) => {
      registers.push({ id: docSnap.id, ...(docSnap.data() as any) } as CashRegister);
    });
    return registers;
  } catch (err) {
    console.error('[cashCoreService] Error fetching cash registers:', err);
    return [];
  }
}

/**
 * Retrieves the default cash register or creates one (ACTIVE) if none exists.
 */
export async function getOrCreateDefaultCashRegister(
  businessId: string,
  branchId?: string,
  userId?: string,
  userName?: string
): Promise<CashRegister> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) throw new Error('businessId es requerido');

  const registers = await getCashRegisters(cleanBusinessId);
  if (registers.length > 0) {
    return registers[0];
  }

  return await createCashRegister(cleanBusinessId, 'Caja Principal', branchId, userId);
}

/**
 * Opens a new Cash Session (Turno de caja) atomically via Firestore transaction.
 * Guarantees race-condition prevention (only 1 OPEN session per cash register).
 */
export async function openCashSession(params: {
  businessId: string;
  cashRegisterId: string;
  cashRegisterName?: string;
  initialAmount: number;
  userId: string;
  userName?: string;
  branchId?: string;
  notes?: string;
}): Promise<CashSession> {
  const cleanBusinessId = sanitizeString(params.businessId, 64);
  const cleanRegisterId = sanitizeString(params.cashRegisterId, 64);
  const initialAmount = Math.max(0, sanitizeNumber(params.initialAmount, 0));
  const cleanUserId = sanitizeString(params.userId, 64);
  const cleanUserName = sanitizeString(params.userName || 'Usuario', 100);
  const cleanNotes = params.notes ? sanitizeString(params.notes, 500) : '';

  if (!cleanBusinessId || !cleanRegisterId || !cleanUserId) {
    throw new Error('Parámetros incompletos para abrir sesión de caja');
  }

  const registerRef = doc(db, 'cash_registers', cleanRegisterId);
  const sessionRef = doc(collection(db, 'cash_sessions'));
  const movementRef = doc(collection(db, 'cash_movements'));
  const now = new Date().toISOString();

  let createdSession: CashSession | null = null;

  await runTransaction(db, async (transaction) => {
    const regSnap = await transaction.get(registerRef);
    if (!regSnap.exists()) {
      throw new Error('La caja física especificada no existe');
    }

    const regData = regSnap.data() as CashRegister;
    if (regData.businessId !== cleanBusinessId) {
      throw new Error('Violación de seguridad multi-inquilino: caja no pertenece a este negocio');
    }

    if (regData.status === 'INACTIVE') {
      throw new Error(`La caja "${regData.name}" se encuentra inactiva.`);
    }

    if (regData.currentSessionId) {
      throw new Error(`La caja "${regData.name}" ya se encuentra abierta con una sesión activa.`);
    }

    const newSession: CashSession = {
      id: sessionRef.id,
      businessId: cleanBusinessId,
      branchId: params.branchId ? sanitizeString(params.branchId, 64) : (regData.branchId || undefined),
      cashRegisterId: cleanRegisterId,
      cashRegisterName: regData.name || params.cashRegisterName || 'Caja Principal',
      openedBy: cleanUserId,
      openerName: cleanUserName,
      openedAt: now,
      initialAmount: initialAmount,
      status: 'OPEN',
      notes: cleanNotes || undefined,
      summary: {
        totalCashSales: 0,
        totalCashExpenses: 0,
        totalCashPurchases: 0,
        totalCashSettlements: 0,
        totalCashWithdrawals: 0,
        totalCashAdjustments: 0,
        totalInflows: 0,
        totalOutflows: 0,
        netCashChange: 0,
        movementCount: 0,
      },
      createdAt: now,
      updatedAt: now,
    };

    // Save session
    transaction.set(sessionRef, newSession);

    // Update register
    transaction.update(registerRef, {
      currentSessionId: sessionRef.id,
      updatedAt: now,
    });

    // Record initial OPENING cash movement for traceability (Flow is NEUTRAL to avoid double-counting with initialAmount)
    if (initialAmount > 0) {
      const openingMovement: CashMovement = {
        id: movementRef.id,
        businessId: cleanBusinessId,
        branchId: newSession.branchId,
        cashRegisterId: cleanRegisterId,
        sessionId: sessionRef.id,
        type: 'OPENING',
        flow: 'NEUTRAL',
        amount: initialAmount,
        description: 'Apertura de caja con fondo inicial',
        paymentMethod: 'EFECTIVO',
        referenceType: 'OPENING',
        sourceType: 'CASH_SESSION',
        sourceId: sessionRef.id,
        createdBy: cleanUserId,
        creatorName: cleanUserName,
        createdAt: now,
        notes: cleanNotes || undefined,
      };
      transaction.set(movementRef, openingMovement);
    }

    createdSession = newSession;
  });

  if (!createdSession) {
    throw new Error('Error al inicializar sesión de caja');
  }

  return createdSession;
}

/**
 * Gets currently active OPEN session for a given register or business.
 */
export async function getCurrentSession(
  businessId: string,
  cashRegisterId?: string
): Promise<CashSession | null> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return null;

  try {
    const sessionCol = collection(db, 'cash_sessions');
    let q;
    if (cashRegisterId) {
      q = query(
        sessionCol,
        where('businessId', '==', cleanBusinessId),
        where('cashRegisterId', '==', sanitizeString(cashRegisterId, 64)),
        where('status', '==', 'OPEN')
      );
    } else {
      q = query(
        sessionCol,
        where('businessId', '==', cleanBusinessId),
        where('status', '==', 'OPEN')
      );
    }

    const snap = await getDocs(q);
    if (snap.empty) return null;

    const firstDoc = snap.docs[0];
    return { id: firstDoc.id, ...(firstDoc.data() as any) } as CashSession;
  } catch (err) {
    console.error('[cashCoreService] Error fetching current session:', err);
    return null;
  }
}

/**
 * Gets all active sessions for a business.
 */
export async function getActiveSessions(businessId: string): Promise<CashSession[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  try {
    const q = query(
      collection(db, 'cash_sessions'),
      where('businessId', '==', cleanBusinessId),
      where('status', '==', 'OPEN')
    );
    const snap = await getDocs(q);
    const sessions: CashSession[] = [];
    snap.forEach((docSnap) => {
      sessions.push({ id: docSnap.id, ...(docSnap.data() as any) } as CashSession);
    });
    return sessions;
  } catch (err) {
    console.error('[cashCoreService] Error fetching active sessions:', err);
    return [];
  }
}

/**
 * Retrieves all movements tied to a cash session.
 * Strictly checks multi-tenancy (businessId + sessionId).
 */
export async function getSessionMovements(
  businessId: string,
  sessionId: string
): Promise<CashMovement[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  const cleanSessionId = sanitizeString(sessionId, 64);
  if (!cleanBusinessId || !cleanSessionId) return [];

  try {
    const q = query(
      collection(db, 'cash_movements'),
      where('businessId', '==', cleanBusinessId),
      where('sessionId', '==', cleanSessionId)
    );
    const snap = await getDocs(q);
    const movements: CashMovement[] = [];
    snap.forEach((docSnap) => {
      movements.push({ id: docSnap.id, ...(docSnap.data() as any) } as CashMovement);
    });

    // Sort ascending by createdAt
    return movements.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } catch (err) {
    console.error('[cashCoreService] Error fetching session movements:', err);
    return [];
  }
}

/**
 * Pure Mathematical Engine for Cash Session Balance:
 * SALDO TEÓRICO = initialAmount + totalInflows - totalOutflows
 * 
 * Note: 'OPENING' movement is strictly excluded from totalInflows to prevent double counting with initialAmount.
 */
export function calculateSessionSummary(
  session: CashSession,
  movements: CashMovement[]
): CashSessionSummary & { expectedAmount: number } {
  let totalCashSales = 0;
  let totalCashExpenses = 0;
  let totalCashPurchases = 0;
  let totalCashSettlements = 0;
  let totalCashWithdrawals = 0;
  let totalCashAdjustments = 0;
  let totalInflows = 0;
  let totalOutflows = 0;

  for (const m of movements) {
    // Exclude OPENING movement from inflow additions because session.initialAmount is already the baseline
    if (m.type === 'OPENING' || m.flow === 'NEUTRAL') {
      continue;
    }

    const amt = m.amount || 0;

    if (m.flow === 'INCOME') {
      totalInflows += amt;
      switch (m.type) {
        case 'SALE_INCOME':
        case 'SALE_CASH':
          totalCashSales += amt;
          break;
        case 'ADJUSTMENT':
          totalCashAdjustments += amt;
          break;
      }
    } else if (m.flow === 'EXPENSE') {
      totalOutflows += amt;
      switch (m.type) {
        case 'EXPENSE_PAYMENT':
        case 'EXPENSE_CASH':
          totalCashExpenses += amt;
          break;
        case 'PURCHASE_PAYMENT':
        case 'PURCHASE_CASH':
          totalCashPurchases += amt;
          break;
        case 'SETTLEMENT_CASH':
          totalCashSettlements += amt;
          break;
        case 'WITHDRAWAL':
          totalCashWithdrawals += amt;
          break;
        case 'ADJUSTMENT':
          totalCashAdjustments -= amt;
          break;
      }
    }
  }

  const netCashChange = totalInflows - totalOutflows;
  const initial = session.initialAmount || 0;
  const expectedAmount = initial + netCashChange;

  return {
    totalCashSales,
    totalCashExpenses,
    totalCashPurchases,
    totalCashSettlements,
    totalCashWithdrawals,
    totalCashAdjustments,
    totalInflows,
    totalOutflows,
    netCashChange,
    movementCount: movements.length,
    expectedAmount,
  };
}

/**
 * Helper to compute deterministic document IDs for cash_movements.
 * Guarantees that concurrent writes for the same financial event target the exact same Firestore document.
 */
export function getDeterministicCashMovementId(
  businessId: string,
  sourceType: string,
  sourceId: string
): string {
  const cleanBiz = sanitizeString(businessId, 64).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanType = sanitizeString(sourceType, 32).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanId = sanitizeString(sourceId, 128).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `cm_${cleanBiz}_${cleanType}_${cleanId}`;
}

/**
 * Registers a new cash movement with:
 * - Atomic Concurrency & Idempotency protection via Firestore transaction & deterministic doc ID
 * - Mandatory session validation (must be OPEN and belong to businessId)
 * - Withdrawal sufficiency validation (cannot exceed current theoretical balance or make cash negative)
 */
export async function registerCashMovement(params: {
  businessId: string;
  cashRegisterId?: string;
  sessionId?: string;
  branchId?: string;
  type: CashMovementType;
  flow: CashFlowType;
  amount: number;
  description: string;
  sourceType?: string;
  sourceId?: string;
  referenceId?: string;
  referenceType?: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'SETTLEMENT' | 'WITHDRAWAL' | 'MANUAL' | 'OPENING';
  paymentMethod?: PurchasePaymentMethod;
  userId: string;
  userName?: string;
  notes?: string;
}): Promise<CashMovement> {
  const cleanBusinessId = sanitizeString(params.businessId, 64);
  const amount = sanitizeNumber(params.amount, 0);
  const cleanDescription = sanitizeString(params.description, 255) || 'Movimiento de caja';
  const cleanUserId = sanitizeString(params.userId, 64);
  const cleanUserName = sanitizeString(params.userName || 'Usuario', 100);
  const cleanSessionId = params.sessionId ? sanitizeString(params.sessionId, 64) : undefined;
  const cleanSourceType = params.sourceType ? sanitizeString(params.sourceType, 64) : undefined;
  const cleanSourceId = params.sourceId ? sanitizeString(params.sourceId, 128) : undefined;

  if (!cleanBusinessId || !cleanUserId || amount <= 0) {
    throw new Error('Datos de movimiento inválidos o monto <= 0');
  }

  // 1. Mandatory Session Validation: NEVER create orphan cash movements
  if (!cleanSessionId) {
    throw new Error('NO HAY UNA SESIÓN DE CAJA ABIERTA PARA REGISTRAR EL MOVIMIENTO.');
  }

  const sessionRef = doc(db, 'cash_sessions', cleanSessionId);
  const movementId = (cleanSourceType && cleanSourceId)
    ? getDeterministicCashMovementId(cleanBusinessId, cleanSourceType, cleanSourceId)
    : doc(collection(db, 'cash_movements')).id;
  const movementRef = doc(db, 'cash_movements', movementId);

  // Pre-validate theoretical funds if it is a withdrawal or outflow
  if (params.type === 'WITHDRAWAL' || params.flow === 'EXPENSE') {
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) {
      throw new Error('NO HAY UNA SESIÓN DE CAJA ABIERTA PARA REGISTRAR EL MOVIMIENTO.');
    }
    const currentMovements = await getSessionMovements(cleanBusinessId, cleanSessionId);
    const summary = calculateSessionSummary(sessionSnap.data() as CashSession, currentMovements);
    if (amount > summary.expectedAmount) {
      throw new Error(
        `Fondos insuficientes: el importe solicitado ($${amount.toLocaleString('es-AR')}) supera el efectivo disponible en caja ($${summary.expectedAmount.toLocaleString('es-AR')})`
      );
    }
  }

  let finalMovement: CashMovement | null = null;
  const now = new Date().toISOString();

  await runTransaction(db, async (transaction) => {
    // 1. Atomic Idempotency check: if document already exists, return existing
    const existingDocSnap = await transaction.get(movementRef);
    if (existingDocSnap.exists()) {
      finalMovement = { id: existingDocSnap.id, ...(existingDocSnap.data() as any) } as CashMovement;
      return;
    }

    // 2. Atomic Session validation: MUST be OPEN and match businessId
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) {
      throw new Error('NO HAY UNA SESIÓN DE CAJA ABIERTA PARA REGISTRAR EL MOVIMIENTO.');
    }

    const targetSession = sessionSnap.data() as CashSession;
    if (targetSession.businessId !== cleanBusinessId) {
      throw new Error('Violación de seguridad: la sesión no pertenece al negocio especificado');
    }

    if (targetSession.status !== 'OPEN') {
      throw new Error('NO HAY UNA SESIÓN DE CAJA ABIERTA PARA REGISTRAR EL MOVIMIENTO.');
    }

    const movement: CashMovement = {
      id: movementId,
      businessId: cleanBusinessId,
      branchId: params.branchId ? sanitizeString(params.branchId, 64) : (targetSession.branchId || undefined),
      cashRegisterId: params.cashRegisterId ? sanitizeString(params.cashRegisterId, 64) : targetSession.cashRegisterId,
      sessionId: cleanSessionId,
      type: params.type,
      flow: params.flow,
      amount: amount,
      description: cleanDescription,
      sourceType: cleanSourceType,
      sourceId: cleanSourceId,
      referenceId: params.referenceId ? sanitizeString(params.referenceId, 64) : undefined,
      referenceType: params.referenceType || (params.type === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'MANUAL'),
      paymentMethod: params.paymentMethod || 'EFECTIVO',
      createdBy: cleanUserId,
      creatorName: cleanUserName,
      createdAt: now,
      notes: params.notes ? sanitizeString(params.notes, 500) : undefined,
    };

    transaction.set(movementRef, movement);
    finalMovement = movement;
  });

  if (!finalMovement) {
    throw new Error('Error al registrar movimiento de caja');
  }

  return finalMovement;
}

/**
 * Closes an active Cash Session and performs the Arqueo de Caja atomically via transaction.
 * Difference = actualAmount - expectedAmount.
 * Does NOT alter movement history or fake numbers.
 */
export async function closeCashSession(params: {
  businessId: string;
  sessionId: string;
  cashRegisterId: string;
  actualAmount: number;
  userId: string;
  userName?: string;
  closingNotes?: string;
}): Promise<CashSession> {
  const cleanBusinessId = sanitizeString(params.businessId, 64);
  const cleanSessionId = sanitizeString(params.sessionId, 64);
  const cleanRegisterId = sanitizeString(params.cashRegisterId, 64);
  const actualAmount = Math.max(0, sanitizeNumber(params.actualAmount, 0));
  const cleanUserId = sanitizeString(params.userId, 64);
  const cleanUserName = sanitizeString(params.userName || 'Usuario', 100);
  const cleanClosingNotes = params.closingNotes ? sanitizeString(params.closingNotes, 500) : '';

  if (!cleanBusinessId || !cleanSessionId || !cleanRegisterId || !cleanUserId) {
    throw new Error('Parámetros incompletos para cerrar sesión de caja');
  }

  // Fetch movements to compute summary
  const movements = await getSessionMovements(cleanBusinessId, cleanSessionId);

  const sessionRef = doc(db, 'cash_sessions', cleanSessionId);
  const registerRef = doc(db, 'cash_registers', cleanRegisterId);
  const now = new Date().toISOString();

  let closedSessionResult: CashSession | null = null;

  await runTransaction(db, async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists()) {
      throw new Error('La sesión de caja especificada no existe');
    }

    const sessionData = sessionSnap.data() as CashSession;
    if (sessionData.businessId !== cleanBusinessId) {
      throw new Error('Violación de seguridad: la sesión no pertenece al negocio especificado');
    }

    if (sessionData.status !== 'OPEN') {
      throw new Error('La sesión de caja ya se encuentra cerrada');
    }

    const summaryWithExpected = calculateSessionSummary(sessionData, movements);
    const expectedAmount = summaryWithExpected.expectedAmount;
    const difference = actualAmount - expectedAmount;

    const updatedSessionFields: Partial<CashSession> = {
      status: 'CLOSED',
      closedBy: cleanUserId,
      closerName: cleanUserName,
      closedAt: now,
      expectedAmount: expectedAmount,
      actualAmount: actualAmount,
      difference: difference,
      closingNotes: cleanClosingNotes || undefined,
      summary: {
        totalCashSales: summaryWithExpected.totalCashSales,
        totalCashExpenses: summaryWithExpected.totalCashExpenses,
        totalCashPurchases: summaryWithExpected.totalCashPurchases,
        totalCashSettlements: summaryWithExpected.totalCashSettlements,
        totalCashWithdrawals: summaryWithExpected.totalCashWithdrawals,
        totalCashAdjustments: summaryWithExpected.totalCashAdjustments,
        totalInflows: summaryWithExpected.totalInflows,
        totalOutflows: summaryWithExpected.totalOutflows,
        netCashChange: summaryWithExpected.netCashChange,
        movementCount: summaryWithExpected.movementCount,
      },
      updatedAt: now,
    };

    transaction.update(sessionRef, updatedSessionFields);

    // Update register
    transaction.update(registerRef, {
      currentSessionId: null,
      updatedAt: now,
    });

    closedSessionResult = {
      ...sessionData,
      ...updatedSessionFields,
    };
  });

  if (!closedSessionResult) {
    throw new Error('Error al cerrar la sesión de caja');
  }

  return closedSessionResult;
}

/**
 * Fetches session history for a business tenant with multi-tenancy filtering.
 */
export async function getSessionHistory(
  businessId: string,
  options?: {
    cashRegisterId?: string;
    startDate?: string;
    endDate?: string;
    limitCount?: number;
  }
): Promise<CashSession[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  try {
    const q = query(
      collection(db, 'cash_sessions'),
      where('businessId', '==', cleanBusinessId)
    );
    const snap = await getDocs(q);
    let sessions: CashSession[] = [];
    snap.forEach((docSnap) => {
      sessions.push({ id: docSnap.id, ...(docSnap.data() as any) } as CashSession);
    });

    if (options?.cashRegisterId) {
      sessions = sessions.filter((s) => s.cashRegisterId === options.cashRegisterId);
    }

    if (options?.startDate) {
      const sTime = new Date(options.startDate).getTime();
      sessions = sessions.filter((s) => new Date(s.openedAt).getTime() >= sTime);
    }

    if (options?.endDate) {
      const eTime = new Date(options.endDate).getTime();
      sessions = sessions.filter((s) => new Date(s.openedAt).getTime() <= eTime);
    }

    // Sort descending by openedAt
    sessions.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());

    if (options?.limitCount && options.limitCount > 0) {
      sessions = sessions.slice(0, options.limitCount);
    }

    return sessions;
  } catch (err) {
    console.error('[cashCoreService] Error fetching session history:', err);
    return [];
  }
}

/**
 * Automatically records a cash movement linked to a financial operation (Sale, Purchase, Expense, Settlement).
 * - Resolves active session for the business/register automatically (must be OPEN)
 * - Strictly rejects operations if no OPEN session exists
 * - Enforces idempotency via deterministic doc ID (sourceType + sourceId)
 * - Ignores operations without positive cash amount
 */
export async function recordCashMovementFromOperation(params: {
  businessId: string;
  type: CashMovementType;
  flow: CashFlowType;
  amount: number;
  description: string;
  sourceType: 'SALE' | 'PURCHASE' | 'EXPENSE' | 'SETTLEMENT' | 'WITHDRAWAL' | 'MANUAL';
  sourceId: string;
  paymentMethod?: PurchasePaymentMethod;
  userId: string;
  userName?: string;
  notes?: string;
}): Promise<CashMovement | null> {
  const cleanBusinessId = sanitizeString(params.businessId, 64);
  const amt = sanitizeNumber(params.amount, 0);
  if (!cleanBusinessId || amt <= 0) return null;

  // Resolve active session for the business
  const activeSession = await getCurrentSession(cleanBusinessId);
  if (!activeSession || activeSession.status !== 'OPEN') {
    throw new Error('NO HAY UNA SESIÓN DE CAJA ABIERTA PARA REGISTRAR EL MOVIMIENTO.');
  }

  return await registerCashMovement({
    businessId: cleanBusinessId,
    sessionId: activeSession.id,
    cashRegisterId: activeSession.cashRegisterId,
    branchId: activeSession.branchId,
    type: params.type,
    flow: params.flow,
    amount: amt,
    description: params.description,
    sourceType: params.sourceType,
    sourceId: params.sourceId,
    referenceType: params.sourceType,
    referenceId: params.sourceId,
    paymentMethod: params.paymentMethod || 'EFECTIVO',
    userId: params.userId,
    userName: params.userName,
    notes: params.notes,
  });
}

/**
 * Diagnostic Comparison Engine:
 * Compares legacy getCashBalance() calculation against the new Cash Movement ledger.
 * Completely diagnostic and read-only.
 */
export async function compareCashBalances(
  businessId: string,
  legacyBalanceOverride?: number
): Promise<{
  legacyBalance: number;
  ledgerBalance: number;
  difference: number;
  totalCashSales: number;
  totalCashPurchases: number;
  totalCashExpenses: number;
  totalCashSettlements: number;
  totalCashWithdrawals: number;
  totalInflows: number;
  totalOutflows: number;
  movementCount: number;
}> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) {
    return {
      legacyBalance: 0,
      ledgerBalance: 0,
      difference: 0,
      totalCashSales: 0,
      totalCashPurchases: 0,
      totalCashExpenses: 0,
      totalCashSettlements: 0,
      totalCashWithdrawals: 0,
      totalInflows: 0,
      totalOutflows: 0,
      movementCount: 0,
    };
  }

  // 1. Calculate legacy balance (or accept provided)
  let legacyBalance = 0;
  if (typeof legacyBalanceOverride === 'number') {
    legacyBalance = legacyBalanceOverride;
  } else {
    try {
      const { getCashBalance } = await import('./purchaseService');
      legacyBalance = await getCashBalance(cleanBusinessId);
    } catch (e) {
      console.warn('[compareCashBalances] Error loading legacy balance:', e);
    }
  }

  // 2. Fetch all cash_movements for business
  let totalCashSales = 0;
  let totalCashPurchases = 0;
  let totalCashExpenses = 0;
  let totalCashSettlements = 0;
  let totalCashWithdrawals = 0;
  let totalInflows = 0;
  let totalOutflows = 0;
  let count = 0;

  try {
    const q = query(
      collection(db, 'cash_movements'),
      where('businessId', '==', cleanBusinessId)
    );
    const snap = await getDocs(q);
    count = snap.size;

    snap.forEach((docSnap) => {
      const data = docSnap.data() as CashMovement;
      if (data.type === 'OPENING' || data.flow === 'NEUTRAL') {
        return;
      }

      const rawAmt = Number(data.amount || 0);
      const amt = Math.abs(rawAmt);

      const flow = data.flow || (rawAmt < 0 ? 'EXPENSE' : 'INCOME');

      if (flow === 'INCOME') {
        totalInflows += amt;
        if (data.type === 'SALE_CASH' || data.type === 'SALE_INCOME') {
          totalCashSales += amt;
        }
      } else if (flow === 'EXPENSE') {
        totalOutflows += amt;
        switch (data.type) {
          case 'PURCHASE_CASH':
          case 'PURCHASE_PAYMENT':
            totalCashPurchases += amt;
            break;
          case 'EXPENSE_CASH':
          case 'EXPENSE_PAYMENT':
            totalCashExpenses += amt;
            break;
          case 'SETTLEMENT_CASH':
            totalCashSettlements += amt;
            break;
          case 'WITHDRAWAL':
            totalCashWithdrawals += amt;
            break;
        }
      }
    });
  } catch (err) {
    console.error('[compareCashBalances] Error querying cash movements:', err);
  }

  const ledgerBalance = totalInflows - totalOutflows;

  return {
    legacyBalance,
    ledgerBalance,
    difference: ledgerBalance - legacyBalance,
    totalCashSales,
    totalCashPurchases,
    totalCashExpenses,
    totalCashSettlements,
    totalCashWithdrawals,
    totalInflows,
    totalOutflows,
    movementCount: count,
  };
}

/**
 * Gets the current calculated balance and summary for an active or closed cash session.
 * Purely derived from session.initialAmount and session cash_movements.
 */
export async function getCashRegisterSessionBalance(
  businessId: string,
  sessionId: string
): Promise<{
  session: CashSession;
  movements: CashMovement[];
  summary: CashSessionSummary & { expectedAmount: number };
} | null> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  const cleanSessionId = sanitizeString(sessionId, 64);
  if (!cleanBusinessId || !cleanSessionId) return null;

  try {
    const sessionRef = doc(db, 'cash_sessions', cleanSessionId);
    const sessionSnap = await getDoc(sessionRef);
    if (!sessionSnap.exists()) return null;

    const sessionData = sessionSnap.data() as CashSession;
    if (sessionData.businessId !== cleanBusinessId) return null;

    const movements = await getSessionMovements(cleanBusinessId, cleanSessionId);
    const summary = calculateSessionSummary(sessionData, movements);

    return {
      session: sessionData,
      movements,
      summary,
    };
  } catch (err) {
    console.error('[cashCoreService] Error fetching session balance:', err);
    return null;
  }
}

/**
 * Registers an official cash withdrawal (Retiro de Efectivo / Extracción física de caja).
 * Strictly validates that withdrawal amount does not exceed the current available expectedAmount in the session.
 */
export async function withdrawCashFromSession(params: {
  businessId: string;
  sessionId: string;
  amount: number;
  description?: string;
  userId: string;
  userName?: string;
  notes?: string;
}): Promise<CashMovement> {
  const cleanBusinessId = sanitizeString(params.businessId, 64);
  const cleanSessionId = sanitizeString(params.sessionId, 64);
  const amt = sanitizeNumber(params.amount, 0);
  const cleanUserId = sanitizeString(params.userId, 64);

  if (!cleanBusinessId || !cleanSessionId || !cleanUserId) {
    throw new Error('Parámetros incompletos para retiro de efectivo');
  }

  if (amt <= 0) {
    throw new Error('El importe a retirar debe ser mayor a 0');
  }

  const sessionRef = doc(db, 'cash_sessions', cleanSessionId);
  const sessionSnap = await getDoc(sessionRef);
  if (!sessionSnap.exists()) {
    throw new Error('NO HAY UNA SESIÓN DE CAJA ABIERTA PARA REGISTRAR EL MOVIMIENTO.');
  }

  const session = sessionSnap.data() as CashSession;
  if (session.businessId !== cleanBusinessId || session.status !== 'OPEN') {
    throw new Error('NO HAY UNA SESIÓN DE CAJA ABIERTA PARA REGISTRAR EL MOVIMIENTO.');
  }

  // Pre-validate sufficiency
  const movements = await getSessionMovements(cleanBusinessId, cleanSessionId);
  const summary = calculateSessionSummary(session, movements);
  if (amt > summary.expectedAmount) {
    throw new Error(
      `No es posible retirar más efectivo que el disponible en caja. Saldo disponible: $${summary.expectedAmount.toLocaleString('es-AR')}, Monto solicitado: $${amt.toLocaleString('es-AR')}`
    );
  }

  return await registerCashMovement({
    businessId: cleanBusinessId,
    sessionId: cleanSessionId,
    cashRegisterId: session.cashRegisterId,
    branchId: session.branchId,
    type: 'WITHDRAWAL',
    flow: 'EXPENSE',
    amount: amt,
    description: params.description?.trim() || 'Retiro de efectivo',
    referenceType: 'WITHDRAWAL',
    paymentMethod: 'EFECTIVO',
    userId: cleanUserId,
    userName: params.userName,
    notes: params.notes?.trim() || undefined,
  });
}

