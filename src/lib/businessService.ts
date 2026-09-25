import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  arrayUnion,
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
import { 
  Business, 
  UserProfile, 
  CreateBusinessInput, 
  CreateSellerInput, 
  UserPermissions, 
  UserStatus, 
  BusinessCommercialData,
  InviteAdminInput 
} from '../types';
import { DEFAULT_SELLER_PERMISSIONS } from './permissions';
import { logAdminAction } from './auditService';

/**
 * Creates a user in Firebase Auth using a secondary Firebase app instance
 * to avoid logging out the currently logged-in Admin.
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
      try {
        const cred = await signInWithEmailAndPassword(secondaryAuth, email, pass);
        const existingUid = cred.user.uid;
        await secondaryAuth.signOut();
        return existingUid;
      } catch (signInErr) {
        return `user_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
    }
    throw error;
  } finally {
    await deleteApp(secondaryApp);
  }
}

/**
 * Super Admin creates a new Business and pre-authorizes an Admin user for Google Auth access.
 */
export async function createBusinessWithAdmin(
  input: CreateBusinessInput,
  superAdminUser?: { uid: string; email: string }
): Promise<{ businessId: string; adminUid: string }> {
  const businessRef = doc(collection(db, 'businesses'));
  const businessId = businessRef.id;
  
  const cleanEmail = input.adminEmail.toLowerCase().trim();
  const fullName = input.adminLastName 
    ? `${input.adminName.trim()} ${input.adminLastName.trim()}`.trim() 
    : input.adminName.trim();
  const now = new Date().toISOString();

  // 1. Check if user already exists with this email in the database
  const userQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
  const querySnap = await getDocs(userQuery);

  let adminUid: string;

  if (!querySnap.empty) {
    const existingDoc = querySnap.docs[0];
    const existingUser = existingDoc.data() as UserProfile;
    adminUid = existingUser.uid || existingDoc.id;

    await updateDoc(existingDoc.ref, {
      displayName: fullName || existingUser.displayName,
      businessId: businessId,
      role: 'ADMIN',
      active: true,
      status: 'ACTIVE',
      invitationStatus: 'ACTIVE',
      invitedBy: superAdminUser?.email || 'superadmin@uwi.lat',
      updatedAt: now
    });
  } else {
    // Generate deterministic pre-authorization UID
    adminUid = `auth_${businessId}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const adminProfile: UserProfile = {
      uid: adminUid,
      email: cleanEmail,
      displayName: fullName,
      role: 'ADMIN',
      businessId: businessId,
      active: true,
      status: 'ACTIVE',
      invitationStatus: 'ACTIVE',
      invitedBy: superAdminUser?.email || 'superadmin@uwi.lat',
      createdAt: now,
      updatedAt: now
    };
    await setDoc(doc(db, 'users', adminUid), adminProfile);
  }

  // 2. Create Business document
  const businessData: Business = {
    id: businessId,
    name: input.businessName.trim(),
    status: 'active',
    createdAt: now,
    updatedAt: now,
    adminUserId: adminUid,
    adminUserIds: [adminUid],
    adminEmail: cleanEmail,
    adminName: fullName,
    visualTheme: {
      themeId: 'uwi-soft',
      updatedAt: now,
      updatedBy: cleanEmail
    },
    themeId: 'uwi-soft'
  };
  await setDoc(businessRef, businessData);

  if (superAdminUser) {
    await logAdminAction({
      businessId,
      adminId: superAdminUser.uid,
      adminEmail: superAdminUser.email,
      targetUserId: adminUid,
      targetUserEmail: cleanEmail,
      action: 'ADMIN_AUTHORIZED',
      details: `Negocio creado "${input.businessName.trim()}" y Administrador pre-autorizado para Google Auth: ${fullName} (${cleanEmail})`
    });
  }

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
 * Update commercial profile details for a business (Admin allowed)
 */
export async function updateBusinessCommercialData(
  businessId: string,
  data: BusinessCommercialData
): Promise<void> {
  const businessRef = doc(db, 'businesses', businessId);
  const updates: Record<string, any> = {
    name: data.name.trim(),
    updatedAt: new Date().toISOString(),
  };

  if (data.legalName !== undefined) updates.legalName = data.legalName.trim();
  if (data.taxId !== undefined) updates.taxId = data.taxId.trim();
  if (data.businessType !== undefined) updates.businessType = data.businessType.trim();
  if (data.address !== undefined) updates.address = data.address.trim();
  if (data.phone !== undefined) updates.phone = data.phone.trim();
  if (data.email !== undefined) updates.email = data.email.trim().toLowerCase();
  if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl;

  await updateDoc(businessRef, updates);
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

/**
 * Update business settings (such as replenishmentApprovalRequired)
 */
export async function updateBusinessSettings(
  businessId: string,
  settings: Partial<Business['settings']>,
  adminUser?: { uid: string; email: string }
): Promise<void> {
  const businessRef = doc(db, 'businesses', businessId);
  const now = new Date().toISOString();

  const businessSnap = await getDoc(businessRef);
  const currentSettings = businessSnap.exists() ? (businessSnap.data().settings || {}) : {};

  const mergedSettings = {
    ...currentSettings,
    ...settings
  };

  await updateDoc(businessRef, {
    settings: mergedSettings,
    updatedAt: now
  });

  if (adminUser) {
    await logAdminAction({
      businessId,
      adminId: adminUser.uid,
      adminEmail: adminUser.email,
      targetUserId: adminUser.uid,
      action: 'BUSINESS_UPDATED',
      details: `Configuración de negocio actualizada: ${JSON.stringify(settings)}`
    });
  }
}

/**
 * Super Admin updates general business information
 */
export async function updateBusinessInfo(
  businessId: string,
  data: Partial<Business>,
  superAdminUser?: { uid: string; email: string }
): Promise<void> {
  const businessRef = doc(db, 'businesses', businessId);
  const now = new Date().toISOString();

  const updates: Record<string, any> = {
    updatedAt: now,
  };

  if (data.name !== undefined) updates.name = data.name.trim();
  if (data.legalName !== undefined) updates.legalName = data.legalName.trim();
  if (data.taxId !== undefined) updates.taxId = data.taxId.trim();
  if (data.businessType !== undefined) updates.businessType = data.businessType.trim();
  if (data.address !== undefined) updates.address = data.address.trim();
  if (data.phone !== undefined) updates.phone = data.phone.trim();
  if (data.email !== undefined) updates.email = data.email.trim().toLowerCase();
  if (data.logoUrl !== undefined) updates.logoUrl = data.logoUrl;
  if (data.status !== undefined) updates.status = data.status;

  await updateDoc(businessRef, updates);

  if (superAdminUser) {
    await logAdminAction({
      businessId,
      adminId: superAdminUser.uid,
      adminEmail: superAdminUser.email,
      targetUserId: businessId,
      action: 'BUSINESS_UPDATED',
      details: `Información de negocio actualizada: ${data.name || ''} (${businessId})`
    });
  }
}

/**
 * Fetch all administrators belonging to a specific business
 */
export async function getAdminsByBusiness(businessId: string): Promise<UserProfile[]> {
  try {
    const q = query(
      collection(db, 'users'), 
      where('businessId', '==', businessId),
      where('role', '==', 'ADMIN')
    );
    const querySnapshot = await getDocs(q);
    const admins: UserProfile[] = [];
    querySnapshot.forEach((docSnap) => {
      admins.push(docSnap.data() as UserProfile);
    });

    // Also check business doc in case adminUserId exists and is not yet caught
    const businessDoc = await getDoc(doc(db, 'businesses', businessId));
    if (businessDoc.exists()) {
      const bData = businessDoc.data() as Business;
      const allAdminIds = new Set<string>();
      if (bData.adminUserId) allAdminIds.add(bData.adminUserId);
      if (Array.isArray(bData.adminUserIds)) {
        bData.adminUserIds.forEach(id => id && allAdminIds.add(id));
      }

      for (const adminId of allAdminIds) {
        if (!admins.some(a => a.uid === adminId)) {
          const userSnap = await getDoc(doc(db, 'users', adminId));
          if (userSnap.exists()) {
            admins.push(userSnap.data() as UserProfile);
          }
        }
      }
    }

    return admins.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    console.error('Error fetching business admins:', error);
    return [];
  }
}

/**
 * Super Admin pre-authorizes or registers an Administrator for a business
 */
export async function registerAdminForBusiness(
  input: InviteAdminInput,
  superAdminUser: { uid: string; email: string }
): Promise<{ uid: string; isReactivation?: boolean; isResend?: boolean }> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const cleanEmail = input.email.toLowerCase().trim();
  const fullName = input.lastName 
    ? `${input.name.trim()} ${input.lastName.trim()}`.trim() 
    : input.name.trim();

  if (!cleanEmail || !emailRegex.test(cleanEmail)) {
    throw new Error('Por favor ingrese un correo electrónico válido.');
  }
  if (!fullName) {
    throw new Error('Por favor ingrese el nombre del administrador.');
  }

  // 1. Search if a user with this email already exists
  const userQuery = query(collection(db, 'users'), where('email', '==', cleanEmail));
  const querySnap = await getDocs(userQuery);

  const now = new Date().toISOString();

  if (!querySnap.empty) {
    const existingUser = querySnap.docs[0].data() as UserProfile;
    const existingDocRef = querySnap.docs[0].ref;

    // Check if user belongs to this same business
    if (existingUser.businessId === input.businessId && existingUser.role === 'ADMIN') {
      if (existingUser.active && existingUser.status === 'ACTIVE') {
        throw new Error(`El correo ${cleanEmail} ya está registrado y activo como Administrador en este negocio.`);
      }

      // If inactive or previously disabled, reactivate authorization
      await updateDoc(existingDocRef, {
        displayName: fullName,
        phone: input.phone?.trim() || existingUser.phone || '',
        active: true,
        status: 'ACTIVE',
        invitationStatus: 'ACTIVE',
        invitedBy: superAdminUser.email,
        updatedAt: now
      });

      // Ensure UID in business adminUserIds
      const bizRef = doc(db, 'businesses', input.businessId);
      await updateDoc(bizRef, {
        adminUserIds: arrayUnion(existingUser.uid),
        updatedAt: now
      });

      await logAdminAction({
        businessId: input.businessId,
        adminId: superAdminUser.uid,
        adminEmail: superAdminUser.email,
        targetUserId: existingUser.uid,
        targetUserEmail: cleanEmail,
        action: 'ADMIN_REACTIVATED',
        details: `Autorización de Administrador reactivada: ${fullName} (${cleanEmail})`
      });

      return { uid: existingUser.uid, isReactivation: true, isResend: true };
    } else if (existingUser.businessId && existingUser.businessId !== input.businessId) {
      throw new Error(`El correo ${cleanEmail} ya está vinculado a otro comercio en la plataforma.`);
    }
  }

  // 2. Create new Admin authorization record in users (Google Auth integration)
  const newAdminUid = `auth_${input.businessId}_${cleanEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const newAdminProfile: UserProfile = {
    uid: newAdminUid,
    email: cleanEmail,
    displayName: fullName,
    phone: input.phone?.trim() || '',
    role: 'ADMIN',
    businessId: input.businessId,
    active: true,
    status: 'ACTIVE',
    invitationStatus: 'ACTIVE',
    invitedBy: superAdminUser.email,
    createdAt: now,
    updatedAt: now
  };

  await setDoc(doc(db, 'users', newAdminUid), newAdminProfile);

  // 3. Add to business adminUserIds
  const bizRef = doc(db, 'businesses', input.businessId);
  const bizSnap = await getDoc(bizRef);
  const currentAdminUserId = bizSnap.exists() ? bizSnap.data()?.adminUserId : undefined;

  await updateDoc(bizRef, {
    adminUserIds: arrayUnion(newAdminUid),
    adminUserId: currentAdminUserId || newAdminUid,
    updatedAt: now
  });

  // 4. Log audit action
  await logAdminAction({
    businessId: input.businessId,
    adminId: superAdminUser.uid,
    adminEmail: superAdminUser.email,
    targetUserId: newAdminUid,
    targetUserEmail: cleanEmail,
    action: 'ADMIN_AUTHORIZED',
    details: `Administrador pre-autorizado para acceso con Google: ${fullName} (${cleanEmail})`
  });

  return { uid: newAdminUid, isReactivation: false, isResend: false };
}

// Backward-compatible alias
export const inviteAdminToBusiness = registerAdminForBusiness;

/**
 * Super Admin reactivates or re-enables an administrator
 */
export async function reactivateAdminAuthorization(
  uid: string,
  businessId: string,
  superAdminUser: { uid: string; email: string },
  targetUserEmail?: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();

  await updateDoc(userRef, {
    active: true,
    status: 'ACTIVE',
    updatedAt: now
  });

  await logAdminAction({
    businessId,
    adminId: superAdminUser.uid,
    adminEmail: superAdminUser.email,
    targetUserId: uid,
    targetUserEmail: targetUserEmail,
    action: 'ADMIN_REACTIVATED',
    details: `Acceso de administrador reactivado para UID ${uid}`
  });
}

// Backward-compatible alias
export const resendAdminInvitation = reactivateAdminAuthorization;

/**
 * Super Admin revokes or disables an administrator authorization
 */
export async function revokeAdminAuthorization(
  uid: string,
  businessId: string,
  superAdminUser: { uid: string; email: string },
  targetUserEmail?: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();

  await updateDoc(userRef, {
    active: false,
    status: 'DISABLED',
    updatedAt: now
  });

  await logAdminAction({
    businessId,
    adminId: superAdminUser.uid,
    adminEmail: superAdminUser.email,
    targetUserId: uid,
    targetUserEmail: targetUserEmail,
    action: 'ADMIN_DISABLED',
    details: `Acceso de administrador deshabilitado para UID ${uid}`
  });
}

// Backward-compatible alias
export const cancelAdminInvitation = revokeAdminAuthorization;

/**
 * Super Admin updates profile of an existing administrator
 */
export async function updateAdminProfile(
  uid: string,
  updates: { displayName: string; phone?: string },
  businessId: string,
  superAdminUser: { uid: string; email: string },
  targetUserEmail?: string
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  const now = new Date().toISOString();

  const dataToUpdate: Record<string, any> = {
    displayName: updates.displayName.trim(),
    updatedAt: now
  };
  if (updates.phone !== undefined) {
    dataToUpdate.phone = updates.phone.trim();
  }

  await updateDoc(userRef, dataToUpdate);

  await logAdminAction({
    businessId,
    adminId: superAdminUser.uid,
    adminEmail: superAdminUser.email,
    targetUserId: uid,
    targetUserEmail: targetUserEmail,
    action: 'ADMIN_UPDATED',
    details: `Datos del administrador actualizados: ${updates.displayName.trim()}`
  });
}

/**
 * Super Admin updates the status of an administrator (ACTIVE, DISABLED, BLOCKED)
 */
export async function updateAdminStatus(
  uid: string,
  newStatus: UserStatus,
  businessId: string,
  superAdminUser: { uid: string; email: string },
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

  let actionType: any = 'ADMIN_UPDATED';
  if (newStatus === 'BLOCKED') actionType = 'ADMIN_BLOCKED';
  else if (newStatus === 'DISABLED') actionType = 'ADMIN_DISABLED';
  else if (newStatus === 'ACTIVE') actionType = 'ADMIN_ENABLED';

  await logAdminAction({
    businessId,
    adminId: superAdminUser.uid,
    adminEmail: superAdminUser.email,
    targetUserId: uid,
    targetUserEmail: targetUserEmail,
    action: actionType,
    details: `Estado del administrador cambiado a: ${newStatus}`
  });
}

/**
 * Business Administrator updates the visual theme of their business.
 * Persists visualTheme and themeId in businesses/{businessId} and updates local cache.
 */
export async function updateBusinessVisualTheme(
  businessId: string,
  themeId: string,
  user: { uid: string; email: string; role?: string }
): Promise<void> {
  if (!businessId) {
    throw new Error('Identificador de negocio requerido.');
  }

  // Security check: Vendedor cannot change visual theme
  if (user.role === 'SELLER') {
    throw new Error('Los vendedores no tienen permisos para modificar la apariencia del negocio.');
  }

  const now = new Date().toISOString();
  const bizRef = doc(db, 'businesses', businessId);
  
  await updateDoc(bizRef, {
    'visualTheme.themeId': themeId,
    'visualTheme.updatedAt': now,
    'visualTheme.updatedBy': user.email,
    themeId: themeId,
    updatedAt: now
  });

  // Local cache for instant retrieval
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`uwi_business_theme_${businessId}`, themeId);
    } catch {
      // Ignore localStorage errors
    }
  }

  // Log action
  try {
    await logAdminAction({
      businessId,
      adminId: user.uid,
      adminEmail: user.email,
      targetUserId: businessId,
      action: 'BUSINESS_THEME_UPDATED',
      details: `Tema visual del negocio actualizado a "${themeId}"`
    });
  } catch (err) {
    console.warn('Audit log error on theme update:', err);
  }
}


