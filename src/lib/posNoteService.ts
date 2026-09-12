import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { PosNote, CreatePosNoteInput } from '../types';

const LOCAL_STORAGE_KEY_PREFIX = 'minimarket_pos_notes_';

function getLocalNotes(businessId: string): PosNote[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalNotes(businessId: string, notes: PosNote[]): void {
  try {
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${businessId}`, JSON.stringify(notes));
  } catch (e) {
    console.warn('Could not save notes to local storage', e);
  }
}

/**
 * Fetches all operational notes for a given business.
 */
export async function getPosNotesByBusiness(businessId: string): Promise<PosNote[]> {
  if (!businessId) return [];

  try {
    const notesRef = collection(db, 'pos_notes');
    const q = query(notesRef, where('businessId', '==', businessId));
    const snap = await getDocs(q);

    const notes: PosNote[] = [];
    snap.forEach((docSnap) => {
      notes.push({
        id: docSnap.id,
        ...docSnap.data()
      } as PosNote);
    });

    // Sort by createdAt ascending (or descending as preferred, usually oldest pending or chronological)
    notes.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    saveLocalNotes(businessId, notes);
    return notes;
  } catch (err) {
    console.warn('Firestore fetch failed, returning cached local notes:', err);
    return getLocalNotes(businessId);
  }
}

/**
 * Creates a new operational note in Firestore and updates local cache.
 */
export async function createPosNote(input: CreatePosNoteInput): Promise<PosNote> {
  const now = new Date().toISOString();
  const noteData = {
    businessId: input.businessId,
    userId: input.userId || '',
    userName: input.userName || '',
    personName: input.personName.trim(),
    taskDescription: input.taskDescription.trim(),
    quantity: Number(input.quantity) > 0 ? Number(input.quantity) : 1,
    isPaid: Boolean(input.isPaid),
    isCompleted: false,
    createdAt: now,
    updatedAt: now
  };

  try {
    const notesRef = collection(db, 'pos_notes');
    const docRef = await addDoc(notesRef, noteData);
    const newNote: PosNote = {
      id: docRef.id,
      ...noteData
    };

    // Update local cache
    const current = getLocalNotes(input.businessId);
    saveLocalNotes(input.businessId, [newNote, ...current]);

    return newNote;
  } catch (err) {
    console.warn('Firestore addDoc failed, storing locally:', err);
    const fallbackNote: PosNote = {
      id: `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ...noteData
    };
    const current = getLocalNotes(input.businessId);
    saveLocalNotes(input.businessId, [fallbackNote, ...current]);
    return fallbackNote;
  }
}

/**
 * Updates properties of an existing note (e.g. isCompleted, isPaid, quantity, etc.)
 */
export async function updatePosNote(
  businessId: string,
  noteId: string, 
  updates: Partial<Pick<PosNote, 'personName' | 'taskDescription' | 'quantity' | 'isPaid' | 'isCompleted'>>
): Promise<void> {
  const now = new Date().toISOString();
  const cleanUpdates = {
    ...updates,
    updatedAt: now
  };

  // Update local cache first
  const current = getLocalNotes(businessId);
  const updated = current.map((n) => (n.id === noteId ? { ...n, ...cleanUpdates } : n));
  saveLocalNotes(businessId, updated);

  if (!noteId.startsWith('local_')) {
    try {
      const noteDocRef = doc(db, 'pos_notes', noteId);
      await updateDoc(noteDocRef, cleanUpdates);
    } catch (err) {
      console.warn('Firestore update failed for note', noteId, err);
    }
  }
}

/**
 * Deletes a single note from Firestore and local cache.
 */
export async function deletePosNote(businessId: string, noteId: string): Promise<void> {
  // Update local cache
  const current = getLocalNotes(businessId);
  saveLocalNotes(businessId, current.filter((n) => n.id !== noteId));

  if (!noteId.startsWith('local_')) {
    try {
      const noteDocRef = doc(db, 'pos_notes', noteId);
      await deleteDoc(noteDocRef);
    } catch (err) {
      console.warn('Firestore delete failed for note', noteId, err);
    }
  }
}

/**
 * Clears all notes for a specific business.
 */
export async function clearAllPosNotes(businessId: string, notes: PosNote[]): Promise<void> {
  // Clear local cache
  saveLocalNotes(businessId, []);

  try {
    const batch = writeBatch(db);
    let count = 0;

    for (const note of notes) {
      if (!note.id.startsWith('local_')) {
        const noteRef = doc(db, 'pos_notes', note.id);
        batch.delete(noteRef);
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn('Firestore batch clear failed:', err);
  }
}
