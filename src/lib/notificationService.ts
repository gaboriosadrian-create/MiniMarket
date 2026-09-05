import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  onSnapshot,
  orderBy,
  limit,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { AppNotification, UserRole } from '../types';

/**
 * Creates a notification in Firestore.
 * If an eventId is supplied, it guarantees idempotency by skipping creation
 * if a notification with that eventId already exists.
 */
export async function createNotification(
  input: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & {
    read?: boolean;
    createdAt?: string;
  }
): Promise<AppNotification | null> {
  if (!input.businessId) return null;

  try {
    const now = input.createdAt || new Date().toISOString();

    // Deduplication check if eventId is provided
    if (input.eventId) {
      const q = query(
        collection(db, 'notifications'),
        where('businessId', '==', input.businessId),
        where('eventId', '==', input.eventId),
        limit(1)
      );
      const existingSnap = await getDocs(q);
      if (!existingSnap.empty) {
        return { id: existingSnap.docs[0].id, ...existingSnap.docs[0].data() } as AppNotification;
      }
    }

    const notifRef = doc(collection(db, 'notifications'));
    const newNotification: AppNotification = {
      id: notifRef.id,
      businessId: input.businessId,
      userId: input.userId,
      targetRole: input.targetRole,
      type: input.type,
      title: input.title,
      message: input.message,
      eventId: input.eventId,
      read: input.read ?? false,
      createdAt: now,
      linkTab: input.linkTab,
      metadata: input.metadata
    };

    // Remove any undefined keys for Firestore cleanliness
    const cleanPayload: Record<string, any> = {};
    Object.entries(newNotification).forEach(([key, val]) => {
      if (val !== undefined) cleanPayload[key] = val;
    });

    await setDoc(notifRef, cleanPayload);
    return newNotification;
  } catch (error) {
    console.warn('[notificationService] Error creating notification:', error);
    return null;
  }
}

/**
 * Subscribes to real-time notifications for a specific user and business.
 */
export function subscribeToUserNotifications(
  businessId: string,
  userId: string,
  userRole: UserRole,
  callback: (notifications: AppNotification[]) => void
): () => void {
  if (!businessId || !userId) {
    callback([]);
    return () => {};
  }

  try {
    const notifsRef = collection(db, 'notifications');
    const q = query(
      notifsRef,
      where('businessId', '==', businessId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: AppNotification[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data() as AppNotification;
          // Filter by user destination
          const isTargetRole = data.targetRole && (
            data.targetRole === userRole || 
            data.targetRole === 'ALL' as any ||
            (data.targetRole === 'ADMIN' && (userRole === 'ADMIN' || userRole === 'SUPER_ADMIN'))
          );

          const isForUser = 
            data.userId === userId || 
            data.userId === 'ALL' || 
            (!data.userId && !data.targetRole) ||
            isTargetRole;

          if (isForUser) {
            list.push({
              id: docSnap.id,
              ...data
            });
          }
        });

        // Sort descending by creation date
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        callback(list);
      },
      (err) => {
        console.warn('[notificationService] Firestore listener error, falling back:', err);
        callback([]);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.warn('[notificationService] Failed to set up snapshot listener:', error);
    callback([]);
    return () => {};
  }
}

/**
 * Marks a single notification as read
 */
export async function markNotificationAsRead(notificationId: string): Promise<void> {
  if (!notificationId) return;
  try {
    const ref = doc(db, 'notifications', notificationId);
    await updateDoc(ref, {
      read: true,
      readAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn('[notificationService] Error marking notification as read:', error);
  }
}

/**
 * Marks all notifications for a user as read
 */
export async function markAllNotificationsAsRead(
  businessId: string,
  userId: string,
  userRole?: UserRole
): Promise<void> {
  if (!businessId || !userId) return;

  try {
    const notifsRef = collection(db, 'notifications');
    const q = query(
      notifsRef,
      where('businessId', '==', businessId),
      where('read', '==', false)
    );

    const snap = await getDocs(q);
    if (snap.empty) return;

    const batch = writeBatch(db);
    const now = new Date().toISOString();

    snap.forEach((docSnap) => {
      const data = docSnap.data() as AppNotification;
      const isForUser = 
        data.userId === userId || 
        data.userId === 'ALL' || 
        (!data.userId && !data.targetRole) ||
        (userRole && data.targetRole && (data.targetRole === userRole || data.targetRole === 'ALL' as any));

      if (isForUser) {
        batch.update(docSnap.ref, {
          read: true,
          readAt: now
        });
      }
    });

    await batch.commit();
  } catch (error) {
    console.warn('[notificationService] Error marking all notifications as read:', error);
  }
}
