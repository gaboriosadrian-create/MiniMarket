import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where 
} from 'firebase/firestore';
import { db } from './firebase';
import { Expense } from '../types';

export async function getExpensesByBusiness(
  businessId: string,
  startDateIso?: string,
  endDateIso?: string
): Promise<Expense[]> {
  const ref = collection(db, 'expenses');
  const q = query(ref, where('businessId', '==', businessId));
  const snap = await getDocs(q);

  let expenses: Expense[] = [];
  snap.forEach((docSnap) => {
    expenses.push({
      id: docSnap.id,
      ...docSnap.data()
    } as Expense);
  });

  if (startDateIso || endDateIso) {
    expenses = expenses.filter((e) => {
      if (!e.createdAt) return false;
      if (startDateIso && e.createdAt < startDateIso) return false;
      if (endDateIso && e.createdAt > endDateIso) return false;
      return true;
    });
  }

  expenses.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return expenses;
}

export async function createExpense(expenseData: Omit<Expense, 'id'>): Promise<Expense> {
  const ref = collection(db, 'expenses');
  const now = new Date().toISOString();

  const payload = {
    ...expenseData,
    createdAt: expenseData.createdAt || now,
    updatedAt: now
  };

  const docRef = await addDoc(ref, payload);
  return {
    id: docRef.id,
    ...payload
  };
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
