import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  serverTimestamp 
} from 'firebase/firestore';
import { 
  initializeApp, 
  getApps, 
  getApp, 
  deleteApp 
} from 'firebase/app';
import { 
  getAuth, 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword 
} from 'firebase/auth';
import { db, auth, firebaseConfig } from './firebase';
import { Business, UserProfile, CreateBusinessInput, CreateSellerInput, UserPermissions, UserStatus } from '../types';
import { DEFAULT_SELLER_PERMISSIONS } from './permissions';
import { logAdminAction } from './auditService';

/**
 * Creates a user in Firebase Auth using a secondary Firebase app instance
 * to avoid logging out the currently logged-in Super Admin.
 */
async function createAuthUserWithoutLoggingOutAdmin(email: string, pass: string): Promise<string> {
  const secondaryAppName = `secondaryApp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, pass);
    const uid = userCredential.user.uid;
    await secondaryAuth.signOut();
    return uid;
  } catch (error: any) {
    if (error.code === 'auth/email-already-in-use') {
      // If user already exists in Auth, try to sign in to get UID
      try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, email, pass);
        const existingUid = cred.user.uid;
        await secondaryAuth.signOut();
        return existingUid;
      } catch (signInErr) {
        // If password differs, create a deterministic UID based on email hash
        return `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
    }
    throw error;
  } finally {
    await deleteApp(secondaryApp);
  }
}

/**
 * Super Admin creates a new Business and assigns an Admin user.
 */
export async function createBusinessWithAdmin(input: CreateBusinessInput): Promise<{ businessId: string; adminUid: string }> {
  const businessRef = doc(collection(db, 'businesses'));
  const businessId = businessRef.id;
  
  const defaultPassword = input.adminPassword || '123456';
  
  // 1. Create or resolve Auth user for Admin
  let adminUid: string;
  try {
    adminUid = await createAuthUserWithoutLoggingOutAdmin(input.adminEmail, defaultPassword);
  } catch (err) {
    console.warn('Could not create auth account directly, assigning generated UID:', err);
    adminUid = `admin_${Date.now()}`;
  }

  const now = new Date().toISOString();

  // 2. Create User document for Admin
  const adminProfile: UserProfile = {
    uid: adminUid,
    email: input.adminEmail.toLowerCase().trim(),
    displayName: input.adminName.trim(),
    role: 'ADMIN',
    businessId: businessId,
    active: true,
    createdAt: now,
    updatedAt: now
  };
  await setDoc(doc(db, 'users', adminUid), adminProfile);

  // 3. Create Business document
  const businessData: Business = {
    id: businessId,
    name: input.businessName.trim(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    adminUserId: adminUid,
    adminEmail: input.adminEmail.toLowerCase().trim(),
    adminName: input.adminName.trim()
  };
  await setDoc(businessRef, businessData);

  return { businessId, adminUid };
}

/**
 * Fetch all businesses for Super Admin
 */
export async function getAllBusinesses(): Promise<Business[]> {
  try {
    const querySnapshot = await getDocs(collection(db, 'businesses'));
    const businesses: Business[] = [];
    querySnapshot.forEach((docSnap) => {
      businesses.push({ id: docSnap.id, ...docSnap.data() } as Business);
    });
    return businesses.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch (error) {
    console.error('Error fetching businesses:', error);
    return [];
  }
}

/**
 * Toggle active/inactive status of a Business
 */
export async function toggleBusinessStatus(businessId: string, currentStatus: 'active' | 'inactive'): Promise<void> {
  const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
  const businessRef = doc(db, 'businesses', businessId);
  await updateDoc(businessRef, {
    status: newStatus,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Fetch business detail by ID
 */
export async function getBusinessById(businessId: string): Promise<Business | null> {
  try {
    const docSnap = await getDoc(doc(db, 'businesses', businessId));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as Business;
    }
    return null;
  } catch (error) {
    console.error('Error fetching business:', error);
    return null;
  }
}

/**
 * Admin creates a Seller user for their business
 */
export async function createSellerForBusiness(
  input: CreateSellerInput,
  initialPermissions?: UserPermissions,
  adminUser?: { uid: string; email: string }
): Promise<string> {
  const defaultPassword = input.sellerPassword || '123456';
  
  let sellerUid: string;
  try {
    sellerUid = await createAuthUserWithoutLoggingOutAdmin(input.sellerEmail, defaultPassword);
  } catch (err) {
    sellerUid = `seller_${Date.now()}`;
  }

  const now = new Date().toISOString();
  const sellerProfile: UserProfile = {
    uid: sellerUid,
    email: input.sellerEmail.toLowerCase().trim(),
    displayName: input.sellerName.trim(),
    role: 'SELLER',
    businessId: input.businessId,
    active: true,
    status: 'ACTIVE',
    permissions: initialPermissions || DEFAULT_SELLER_PERMISSIONS,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(db, 'users', sellerUid), sellerProfile);

  if (adminUser) {
    await logAdminAction({
      businessId: input.businessId,
      adminId: adminUser.uid,
      adminEmail: adminUser.email,
      targetUserId: sellerUid,
      targetUserEmail: input.sellerEmail,
      action: 'SELLER_CREATED',
      details: `Vendedor creado: ${input.sellerName} (${input.sellerEmail})`
    });
  }

  return sellerUid;
}

/**
 * Update seller profile info (e.g. displayName)
 */
export async function updateSellerProfile(
  uid: string,
  updates: { displayName: string },
  adminUser: { uid: string; email: string; businessId: string },
  targetUserEmail?: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();
  await updateDoc(userRef, {
    displayName: updates.displayName.trim(),
    updatedAt: now
  });

  await logAdminAction({
    businessId: adminUser.businessId,
    adminId: adminUser.uid,
    adminEmail: adminUser.email,
    targetUserId: uid,
    targetUserEmail: targetUserEmail,
    action: 'SELLER_UPDATED',
    details: `Nombre de vendedor actualizado a: ${updates.displayName.trim()}`
  });
}

/**
 * Change status of a seller: ACTIVE, BLOCKED, or DISABLED
 */
export async function updateSellerStatus(
  uid: string,
  newStatus: UserStatus,
  adminUser: { uid: string; email: string; businessId: string },
  targetUserEmail?: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();
  const activeFlag = newStatus === 'ACTIVE';

  await updateDoc(userRef, {
    status: newStatus,
    active: activeFlag,
    updatedAt: now
  });

  let actionType: any = 'SELLER_UPDATED';
  if (newStatus === 'BLOCKED') actionType = 'SELLER_BLOCKED';
  else if (newStatus === 'DISABLED') actionType = 'SELLER_DISABLED';
  else if (newStatus === 'ACTIVE') actionType = 'SELLER_UNBLOCKED';

  await logAdminAction({
    businessId: adminUser.businessId,
    adminId: adminUser.uid,
    adminEmail: adminUser.email,
    targetUserId: uid,
    targetUserEmail: targetUserEmail,
    action: actionType,
    details: `Estado de vendedor cambiado a: ${newStatus}`
  });
}

/**
 * Update individual permissions for a seller
 */
export async function updateSellerPermissions(
  uid: string,
  permissions: UserPermissions,
  adminUser: { uid: string; email: string; businessId: string },
  targetUserEmail?: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();

  await updateDoc(userRef, {
    permissions: permissions,
    updatedAt: now
  });

  await logAdminAction({
    businessId: adminUser.businessId,
    adminId: adminUser.uid,
    adminEmail: adminUser.email,
    targetUserId: uid,
    targetUserEmail: targetUserEmail,
    action: 'PERMISSIONS_UPDATED',
    details: `Permisos actualizados para el vendedor`
  });
}

/**
 * Fetch all users belonging to a specific business
 */
export async function getUsersByBusiness(businessId: string): Promise<UserProfile[]> {
  try {
    const q = query(collection(db, 'users'), where('businessId', '==', businessId));
    const querySnapshot = await getDocs(q);
    const users: UserProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      users.push(docSnap.data() as UserProfile);
    });
    return users;
  } catch (error) {
    console.error('Error fetching business users:', error);
    return [];
  }
}
