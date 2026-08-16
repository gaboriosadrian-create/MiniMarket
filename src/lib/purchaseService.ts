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
import { Purchase } from '../types';

export async function getPurchasesByBusiness(
  businessId: string,
  startDateIso?: string,
  endDateIso?: string
): Promise<Purchase[]> {
  const ref = collection(db, 'purchases');
  const q = query(ref, where('businessId', '==', businessId));
  const snap = await getDocs(q);

  let purchases: Purchase[] = [];
  snap.forEach((docSnap) => {
    purchases.push({
      id: docSnap.id,
      ...docSnap.data()
    } as Purchase);
  });

  if (startDateIso || endDateIso) {
    purchases = purchases.filter((p) => {
      if (!p.createdAt) return false;
      if (startDateIso && p.createdAt < startDateIso) return false;
      if (endDateIso && p.createdAt > endDateIso) return false;
      return true;
    });
  }

  purchases.sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  return purchases;
}

export async function createPurchase(purchaseData: Omit<Purchase, 'id'>): Promise<Purchase> {
  const ref = collection(db, 'purchases');
  const now = new Date().toISOString();
  
  const payload = {
    ...purchaseData,
    createdAt: purchaseData.createdAt || now,
    updatedAt: now
  };

  const docRef = await addDoc(ref, payload);
  return {
    id: docRef.id,
    ...payload
  };
}

export async function updatePurchase(id: string, updates: Partial<Purchase>): Promise<void> {
  const docRef = doc(db, 'purchases', id);
  const now = new Date().toISOString();
  await updateDoc(docRef, {
    ...updates,
    updatedAt: now
  });
}

export async function deletePurchase(id: string): Promise<void> {
  const docRef = doc(db, 'purchases', id);
  await deleteDoc(docRef);
}
