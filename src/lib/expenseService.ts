import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  getDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  runTransaction 
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  Expense, 
  OutboxOperation, 
  PayExpenseInput, 
  CancelExpenseInput,
  PaymentObligation,
  PaymentSettlement,
  CashMovement 
} from '../types';
import { localDataStore } from './localDataStore';
import { getDeviceId, generateOperationId } from './deviceId';
import { sanitizeString, sanitizeNumber } from './securityUtils';

/**
 * Fetches expenses for a business:
 * Combines online Firestore expenses with local offline expenses from IndexedDB,
 * deduplicating by expense id and sorting descending by createdAt.
 */
export async function getExpensesByBusiness(
  businessId: string,
  startDateIso?: string,
  endDateIso?: string
): Promise<Expense[]> {
  const cleanBusinessId = sanitizeString(businessId, 64);
  if (!cleanBusinessId) return [];

  let onlineExpenses: Expense[] = [];

  // 1. Try to fetch from Firestore if online
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
  if (isOnline) {
    try {
      const ref = collection(db, 'expenses');
      const q = query(ref, where('businessId', '==', cleanBusinessId));
      const snap = await getDocs(q);

      snap.forEach((docSnap) => {
        onlineExpenses.push({
          id: docSnap.id,
          ...docSnap.data(),
          syncStatus: 'SYNCED',
          syncMode: 'ONLINE'
        } as Expense);
      });
    } catch (err) {
      console.warn('[expenseService] Error obteniendo gastos de Firestore, usando fallback local:', err);
    }
  }

  // 2. Fetch local offline expenses from IndexedDB
  let localExpenses: Expense[] = [];
  try {
    localExpenses = await localDataStore.getOfflineExpensesByBusiness(cleanBusinessId);
  } catch (err) {
    console.warn('[expenseService] Error obteniendo gastos offline de IndexedDB:', err);
  }

  // 3. Merge and deduplicate by expense ID
  const expensesMap = new Map<string, Expense>();

  // Add local expenses first
  for (const e of localExpenses) {
    if (e.id) expensesMap.set(e.id, e);
  }

  // Add/overwrite with online expenses
  for (const e of onlineExpenses) {
    if (e.id) {
      expensesMap.set(e.id, {
        ...e,
        syncStatus: 'SYNCED',
        syncMode: e.syncMode || 'ONLINE'
      });
    }
  }

  let mergedExpenses = Array.from(expensesMap.values());

  // 4. Filter by date range if provided
  if (startDateIso || endDateIso) {
    mergedExpenses = mergedExpenses.filter((e) => {
      if (!e.createdAt) return false;
      if (startDateIso && e.createdAt < startDateIso) return false;
      if (endDateIso && e.createdAt > endDateIso) return false;
      return true;
    });
  }

  // 5. Sort descending by createdAt
  mergedExpenses.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return mergedExpenses;
}

/**
 * Creates an expense either Online (Firestore) or Offline (IndexedDB Outbox).
 * If network fails, automatically falls back to offline Outbox.
 */
export async function createExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
  const cleanBusinessId = sanitizeString(expenseData.businessId, 64);
  if (!cleanBusinessId) throw new Error('businessId es requerido');

  const cleanAmount = sanitizeNumber(expenseData.amount, 0, 99999999, 0);
  if (cleanAmount <= 0) throw new Error('El importe del gasto debe ser mayor a 0');

  const cleanDescription = sanitizeString(expenseData.description, 255);
  if (!cleanDescription) throw new Error('La descripción del gasto es requerida');

  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const operationId = generateOperationId();
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const status = expenseData.status || 'PAGADO';
  const fundSource = expenseData.fundSource || 'CASH';
  const paymentMethod = expenseData.paymentMethod || 'EFECTIVO';

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ----------------------------------------------------
  // CASE A: OFFLINE FLOW
  // ----------------------------------------------------
  if (!isOnline) {
    return processOfflineExpense(
      {
        ...expenseData,
        description: cleanDescription,
        amount: cleanAmount,
        status,
        fundSource,
        paymentMethod
      },
      expenseId,
      deviceId,
      operationId,
      now
    );
  }

  // ----------------------------------------------------
  // CASE B: ONLINE FLOW (WITH FALLBACK)
  // ----------------------------------------------------
  try {
    const expenseRef = doc(collection(db, 'expenses'));
    const onlineId = expenseRef.id;

    const isPaid = status === 'PAGADO';
    const isPaidWithCash = isPaid && fundSource === 'CASH';

    let cashMovementId: string | undefined = undefined;
    let obligationId: string | undefined = undefined;

    await runTransaction(db, async (transaction) => {
      // 1. If paid immediately with business CASH, create atomic CashMovement
      if (isPaidWithCash) {
        const cashMovRef = doc(db, 'cash_movements', `cm_exp_${onlineId}`);
        cashMovementId = cashMovRef.id;
        transaction.set(cashMovRef, {
          id: cashMovementId,
          businessId: cleanBusinessId,
          type: 'EXPENSE_PAYMENT',
          amount: -cleanAmount,
          referenceId: onlineId,
          expenseId: onlineId,
          supplierName: expenseData.supplierName || 'Gasto Operativo',
          description: `Gasto operativo: ${cleanDescription} (${expenseData.category})`,
          paymentMethod,
          createdBy: expenseData.userId,
          creatorName: 'Usuario',
          createdAt: expenseData.createdAt || now
        });
      }

      // 2. If PENDIENTE, create atomic PaymentObligation
      if (status === 'PENDIENTE') {
        const oblRef = doc(db, 'payment_obligations', `obl_exp_${onlineId}`);
        obligationId = oblRef.id;
        transaction.set(oblRef, {
          id: obligationId,
          businessId: cleanBusinessId,
          sourceType: 'OPERATING_EXPENSE',
          sourceId: onlineId,
          supplierName: expenseData.supplierName || 'Gasto Operativo',
          beneficiary: expenseData.beneficiary || expenseData.supplierName || 'Gasto Operativo',
          category: expenseData.category,
          description: cleanDescription,
          amount: cleanAmount,
          pendingAmount: cleanAmount,
          status: 'PENDING',
          dueDate: expenseData.dueDate || now,
          paymentMethod,
          fundSource,
          createdBy: expenseData.userId,
          creatorName: 'Usuario',
          createdAt: expenseData.createdAt || now
        });
      }

      // 3. Create Expense doc
      const payload: Expense = {
        ...expenseData,
        id: onlineId,
        description: cleanDescription,
        amount: cleanAmount,
        status,
        fundSource,
        paymentMethod,
        paidAmount: isPaid ? cleanAmount : 0,
        pendingAmount: isPaid ? 0 : cleanAmount,
        paidAt: isPaid ? (expenseData.createdAt || now) : undefined,
        paidBy: isPaid ? expenseData.userId : undefined,
        cashMovementId,
        obligationId,
        createdAt: expenseData.createdAt || now,
        updatedAt: now,
        syncStatus: 'SYNCED',
        syncMode: 'ONLINE',
        syncedAt: now,
        deviceId
      };

      const cleanPayload: Record<string, any> = {};
      Object.entries(payload).forEach(([k, v]) => {
        if (v !== undefined) cleanPayload[k] = v;
      });

      transaction.set(expenseRef, cleanPayload);
    });

    const finalExpense: Expense = {
      ...expenseData,
      id: onlineId,
      description: cleanDescription,
      amount: cleanAmount,
      status,
      fundSource,
      paymentMethod,
      paidAmount: isPaid ? cleanAmount : 0,
      pendingAmount: isPaid ? 0 : cleanAmount,
      paidAt: isPaid ? (expenseData.createdAt || now) : undefined,
      paidBy: isPaid ? expenseData.userId : undefined,
      cashMovementId,
      obligationId,
      createdAt: expenseData.createdAt || now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      syncMode: 'ONLINE',
      syncedAt: now,
      deviceId
    };

    // Cache locally as well
    try {
      await localDataStore.saveOfflineExpense(finalExpense);
    } catch (e) {
      console.warn('[expenseService] Error guardando copia local de gasto online:', e);
    }

    return finalExpense;
  } catch (err: any) {
    console.warn('[expenseService] Falló creación online de gasto. Guardando en Outbox offline:', err);
    return processOfflineExpense(
      {
        ...expenseData,
        description: cleanDescription,
        amount: cleanAmount,
        status,
        fundSource,
        paymentMethod
      },
      expenseId,
      deviceId,
      operationId,
      now
    );
  }
}

/**
 * Registers a payment (full or partial) against a pending expense.
 */
export async function payExpense(input: PayExpenseInput): Promise<Expense> {
  const cleanExpenseId = sanitizeString(input.expenseId, 64);
  if (!cleanExpenseId) throw new Error('expenseId es requerido');

  const payAmount = sanitizeNumber(input.amount, 0, 99999999, 0);
  if (payAmount <= 0) throw new Error('El importe a pagar debe ser mayor a 0');

  const now = new Date().toISOString();
  const expenseRef = doc(db, 'expenses', cleanExpenseId);

  let updatedExpense: Expense | null = null;

  await runTransaction(db, async (transaction) => {
    const expenseSnap = await transaction.get(expenseRef);
    if (!expenseSnap.exists()) {
      throw new Error('El gasto especificado no existe.');
    }

    const exp = expenseSnap.data() as Expense;
    if (exp.status === 'ANULADO') {
      throw new Error('No se puede pagar un gasto anulado.');
    }

    const currentPaid = Number(exp.paidAmount || 0);
    const currentPending = Number(exp.pendingAmount !== undefined ? exp.pendingAmount : (exp.status === 'PENDIENTE' ? exp.amount : 0));

    if (currentPending <= 0 || exp.status === 'PAGADO') {
      throw new Error('El gasto ya se encuentra totalmente pagado.');
    }

    if (payAmount > currentPending) {
      throw new Error(`El importe a pagar ($${payAmount.toLocaleString('es-AR')}) excede el saldo pendiente ($${currentPending.toLocaleString('es-AR')}).`);
    }

    const newPaid = currentPaid + payAmount;
    const newPending = Math.max(0, currentPending - payAmount);
    const newStatus = newPending === 0 ? 'PAGADO' : 'PENDIENTE';

    let cashMovementId: string | undefined = undefined;

    // 1. If paid with CASH, create CashMovement
    if (input.fundSource === 'CASH') {
      const cashMovRef = doc(collection(db, 'cash_movements'));
      cashMovementId = cashMovRef.id;
      transaction.set(cashMovRef, {
        id: cashMovementId,
        businessId: exp.businessId,
        type: 'EXPENSE_PAYMENT',
        amount: -payAmount,
        referenceId: cleanExpenseId,
        expenseId: cleanExpenseId,
        supplierName: exp.supplierName || 'Gasto Operativo',
        description: `Pago de gasto: ${exp.description} (${newPending === 0 ? 'Liquidación total' : 'Pago parcial'})`,
        paymentMethod: input.paymentMethod,
        createdBy: input.userId,
        creatorName: input.userName || 'Usuario',
        createdAt: now
      });
    }

    // 2. If expense had an obligation, update obligation and record settlement
    if (exp.obligationId) {
      const oblRef = doc(db, 'payment_obligations', exp.obligationId);
      const oblSnap = await transaction.get(oblRef);
      if (oblSnap.exists()) {
        const oblData = oblSnap.data() as PaymentObligation;
        const oblPending = Math.max(0, Number(oblData.pendingAmount || 0) - payAmount);
        transaction.update(oblRef, {
          pendingAmount: oblPending,
          status: oblPending === 0 ? 'PAID' : 'PENDING',
          settledAt: oblPending === 0 ? now : undefined,
          updatedAt: now
        });

        // Record settlement
        const settlementRef = doc(collection(db, 'payment_settlements'));
        transaction.set(settlementRef, {
          id: settlementRef.id,
          obligationId: exp.obligationId,
          businessId: exp.businessId,
          amount: payAmount,
          paymentDate: now,
          paymentMethod: input.paymentMethod,
          fundSource: input.fundSource,
          registeredBy: input.userId,
          registrarName: input.userName || 'Usuario',
          notes: input.notes || undefined,
          cashMovementId,
          createdAt: now
        });
      }
    }

    // 3. Update expense document
    const expenseUpdates: Partial<Expense> = {
      paidAmount: newPaid,
      pendingAmount: newPending,
      status: newStatus,
      paidAt: now,
      paidBy: input.userId,
      fundSource: input.fundSource,
      paymentMethod: input.paymentMethod,
      updatedAt: now
    };

    transaction.update(expenseRef, expenseUpdates);

    updatedExpense = {
      ...exp,
      ...expenseUpdates,
      id: cleanExpenseId
    };
  });

  if (!updatedExpense) {
    throw new Error('Error al procesar el pago del gasto.');
  }

  // Update local store
  try {
    await localDataStore.saveOfflineExpense(updatedExpense);
  } catch (e) {
    console.warn('[expenseService] Error guardando gasto actualizado localmente:', e);
  }

  return updatedExpense;
}

/**
 * Cancels an expense, reverting financial movements if paid with business funds.
 */
export async function cancelExpense(input: CancelExpenseInput): Promise<Expense> {
  const cleanExpenseId = sanitizeString(input.expenseId, 64);
  if (!cleanExpenseId) throw new Error('expenseId es requerido');

  const cleanReason = sanitizeString(input.reason, 255);
  if (!cleanReason) throw new Error('El motivo de anulación es requerido');

  const now = new Date().toISOString();
  const expenseRef = doc(db, 'expenses', cleanExpenseId);

  let updatedExpense: Expense | null = null;

  await runTransaction(db, async (transaction) => {
    const expenseSnap = await transaction.get(expenseRef);
    if (!expenseSnap.exists()) {
      throw new Error('El gasto no existe.');
    }

    const exp = expenseSnap.data() as Expense;
    if (exp.status === 'ANULADO') {
      throw new Error('El gasto ya se encuentra anulado.');
    }

    const paidAmount = Number(exp.paidAmount || (exp.status === 'PAGADO' ? exp.amount : 0));
    const wasPaidWithCash = (exp.fundSource === 'CASH' || exp.paymentMethod === 'EFECTIVO') && exp.fundSource !== 'PERSONAL' && paidAmount > 0;

    // 1. Revert cash movement if paid with business cash (Deterministic compensatory CashMovement)
    if (wasPaidWithCash) {
      const cashMovRef = doc(db, 'cash_movements', `cm_cancel_exp_${cleanExpenseId}`);
      transaction.set(cashMovRef, {
        id: cashMovRef.id,
        businessId: exp.businessId,
        type: 'ADJUSTMENT',
        amount: paidAmount, // Positive reimbursement to restore balance
        referenceId: cleanExpenseId,
        expenseId: cleanExpenseId,
        supplierName: exp.supplierName || 'Gasto Operativo',
        description: `Anulación de gasto - Reintegro a caja: ${exp.description} (Motivo: ${cleanReason})`,
        paymentMethod: 'EFECTIVO',
        createdBy: input.userId,
        creatorName: input.userName || 'Usuario',
        createdAt: now
      });
    }

    // 2. Cancel associated obligation if present
    if (exp.obligationId) {
      const oblRef = doc(db, 'payment_obligations', exp.obligationId);
      const oblSnap = await transaction.get(oblRef);
      if (oblSnap.exists()) {
        transaction.update(oblRef, {
          status: 'CANCELLED',
          notes: `Obligación anulada por cancelación de gasto. Motivo: ${cleanReason}`,
          updatedAt: now
        });
      }
    }

    // 3. Mark Expense doc as ANULADO
    const updates: Partial<Expense> = {
      status: 'ANULADO',
      cancelledAt: now,
      cancelledBy: input.userId,
      cancellationReason: cleanReason,
      updatedAt: now
    };

    transaction.update(expenseRef, updates);

    updatedExpense = {
      ...exp,
      ...updates,
      id: cleanExpenseId
    };
  });

  if (!updatedExpense) {
    throw new Error('Error al anular el gasto.');
  }

  // Update local store
  try {
    await localDataStore.saveOfflineExpense(updatedExpense);
  } catch (e) {
    console.warn('[expenseService] Error guardando anulación de gasto localmente:', e);
  }

  return updatedExpense;
}

/**
 * Helper to register an offline expense in IndexedDB + Outbox
 */
async function processOfflineExpense(
  expenseData: Omit<Expense, 'id'>,
  expenseId: string,
  deviceId: string,
  operationId: string,
  now: string
): Promise<Expense> {
  const cleanBusinessId = sanitizeString(expenseData.businessId, 64);
  const status = expenseData.status || 'PAGADO';
  const isPaid = status === 'PAGADO';

  const localExpense: Expense = {
    ...expenseData,
    id: expenseId,
    amount: sanitizeNumber(expenseData.amount, 0, 99999999, 0),
    status,
    paidAmount: isPaid ? expenseData.amount : 0,
    pendingAmount: isPaid ? 0 : expenseData.amount,
    paidAt: isPaid ? (expenseData.createdAt || now) : undefined,
    paidBy: isPaid ? expenseData.userId : undefined,
    createdAt: expenseData.createdAt || now,
    updatedAt: now,
    syncStatus: 'PENDING',
    syncMode: 'OFFLINE',
    syncedAt: null,
    deviceId,
    outboxOperationId: operationId
  };

  const outboxOp: OutboxOperation = {
    operationId,
    operationType: 'EXPENSE',
    businessId: cleanBusinessId,
    userId: expenseData.userId,
    userName: 'Usuario',
    deviceId,
    expenseId,
    createdAt: now,
    status: 'PENDING',
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    payload: {
      businessId: cleanBusinessId,
      expenseId,
      description: expenseData.description,
      category: expenseData.category,
      amount: localExpense.amount,
      paymentMethod: expenseData.paymentMethod,
      fundSource: expenseData.fundSource,
      status: localExpense.status,
      paidAmount: localExpense.paidAmount,
      pendingAmount: localExpense.pendingAmount,
      notes: expenseData.notes,
      createdAt: localExpense.createdAt,
      userId: expenseData.userId,
      deviceId
    },
    expenseSnapshot: localExpense,
    version: 1,
    syncedAt: null
  };

  await localDataStore.createOfflineExpenseTransaction(cleanBusinessId, localExpense, outboxOp);
  return localExpense;
}

/**
 * Syncs an offline expense operation to Firestore (Idempotent)
 */
export async function syncExpenseOperationToFirestore(op: OutboxOperation): Promise<{
  success: boolean;
  status: 'SYNCED' | 'ERROR';
  error?: string;
}> {
  if (op.operationType !== 'EXPENSE' || !op.expenseSnapshot) {
    return { success: false, status: 'ERROR', error: 'Operación de gasto inválida.' };
  }

  const expense = op.expenseSnapshot;
  const expenseId = op.expenseId || expense.id || op.operationId;
  const now = new Date().toISOString();

  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    const isPaid = (expense.status || 'PAGADO') === 'PAGADO';
    const isPaidWithCash = isPaid && expense.fundSource === 'CASH';

    let cashMovementId: string | undefined = undefined;
    let obligationId: string | undefined = undefined;

    // 1. If paid immediately with business cash, create CashMovement
    if (isPaidWithCash) {
      const cashMovRef = doc(db, 'cash_movements', `cm_exp_${expenseId}`);
      cashMovementId = cashMovRef.id;
      await setDoc(cashMovRef, {
        id: cashMovementId,
        businessId: op.businessId,
        type: 'EXPENSE_PAYMENT',
        amount: -Number(expense.amount),
        referenceId: expenseId,
        expenseId,
        supplierName: expense.supplierName || 'Gasto Operativo',
        description: `Gasto operativo: ${expense.description} (${expense.category})`,
        paymentMethod: expense.paymentMethod,
        createdBy: expense.userId || op.userId,
        creatorName: 'Usuario',
        createdAt: expense.createdAt || now
      }, { merge: true });
    }

    // 2. If PENDIENTE, create PaymentObligation
    if (expense.status === 'PENDIENTE') {
      const oblRef = doc(db, 'payment_obligations', `obl_exp_${expenseId}`);
      obligationId = oblRef.id;
      await setDoc(oblRef, {
        id: obligationId,
        businessId: op.businessId,
        sourceType: 'OPERATING_EXPENSE',
        sourceId: expenseId,
        supplierName: expense.supplierName || 'Gasto Operativo',
        beneficiary: expense.beneficiary || expense.supplierName || 'Gasto Operativo',
        category: expense.category,
        description: expense.description,
        amount: Number(expense.amount),
        pendingAmount: Number(expense.pendingAmount ?? expense.amount),
        status: 'PENDING',
        dueDate: expense.dueDate || now,
        paymentMethod: expense.paymentMethod,
        fundSource: expense.fundSource,
        createdBy: expense.userId || op.userId,
        creatorName: 'Usuario',
        createdAt: expense.createdAt || now
      }, { merge: true });
    }

    const payload = {
      businessId: op.businessId,
      description: expense.description,
      category: expense.category,
      amount: Number(expense.amount) || 0,
      paymentMethod: expense.paymentMethod,
      fundSource: expense.fundSource || 'CASH',
      status: expense.status || 'PAGADO',
      paidAmount: isPaid ? Number(expense.amount) : 0,
      pendingAmount: isPaid ? 0 : Number(expense.amount),
      paidAt: isPaid ? (expense.createdAt || now) : undefined,
      paidBy: isPaid ? (expense.userId || op.userId) : undefined,
      cashMovementId,
      obligationId,
      notes: expense.notes || '',
      userId: expense.userId || op.userId,
      createdAt: expense.createdAt || now,
      updatedAt: now,
      deviceId: op.deviceId,
      syncedAt: now
    };

    const cleanPayload: Record<string, any> = {};
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== undefined) cleanPayload[k] = v;
    });

    await setDoc(expenseRef, cleanPayload, { merge: true });

    // Update local expense record to SYNCED
    await localDataStore.saveOfflineExpense({
      ...expense,
      id: expenseId,
      cashMovementId,
      obligationId,
      syncStatus: 'SYNCED',
      syncedAt: now,
      syncError: undefined
    });

    return { success: true, status: 'SYNCED' };
  } catch (err: any) {
    console.error('[expenseService] Error sincronizando gasto a Firestore:', err);
    return {
      success: false,
      status: 'ERROR',
      error: err?.message || 'Error de sincronización con el servidor.'
    };
  }
}

export async function updateExpense(id: string, updates: Partial<Expense>): Promise<void> {
  const docRef = doc(db, 'expenses', id);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    ...updates,
    updatedAt: now
  });
}

export async function deleteExpense(id: string): Promise<void> {
  const docRef = doc(db, 'expenses', id);
  await deleteDoc(docRef);
}
