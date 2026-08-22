import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { Expense, OutboxOperation } from '../types';
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
  const now = new Date().toISOString();
  const deviceId = getDeviceId();
  const operationId = generateOperationId();
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

  // ----------------------------------------------------
  // CASE A: OFFLINE FLOW
  // ----------------------------------------------------
  if (!isOnline) {
    return processOfflineExpense(expenseData, expenseId, deviceId, operationId, now);
  }

  // ----------------------------------------------------
  // CASE B: ONLINE FLOW (WITH FALLBACK)
  // ----------------------------------------------------
  try {
    const expenseRef = doc(collection(db, 'expenses'));
    const onlineId = expenseRef.id;

    const payload: Expense = {
      ...expenseData,
      id: onlineId,
      amount: sanitizeNumber(expenseData.amount, 0, 99999999, 0),
      createdAt: expenseData.createdAt || now,
      updatedAt: now,
      syncStatus: 'SYNCED',
      syncMode: 'ONLINE',
      syncedAt: now,
      deviceId
    };

    await setDoc(expenseRef, payload);

    // Cache locally as well
    try {
      await localDataStore.saveOfflineExpense(payload);
    } catch (e) {
      console.warn('[expenseService] Error guardando copia local de gasto online:', e);
    }

    return payload;
  } catch (err: any) {
    console.warn('[expenseService] Falló creación online de gasto. Guardando en Outbox offline:', err);
    return processOfflineExpense(expenseData, expenseId, deviceId, operationId, now);
  }
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

  const localExpense: Expense = {
    ...expenseData,
    id: expenseId,
    amount: sanitizeNumber(expenseData.amount, 0, 99999999, 0),
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

    const payload = {
      businessId: op.businessId,
      description: expense.description,
      category: expense.category,
      amount: Number(expense.amount) || 0,
      paymentMethod: expense.paymentMethod,
      notes: expense.notes || '',
      userId: expense.userId || op.userId,
      createdAt: expense.createdAt || now,
      updatedAt: now,
      deviceId: op.deviceId,
      syncedAt: now
    };

    await setDoc(expenseRef, payload, { merge: true });

    // Update local expense record to SYNCED
    await localDataStore.saveOfflineExpense({
      ...expense,
      id: expenseId,
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
