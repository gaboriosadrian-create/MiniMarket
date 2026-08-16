import { doc, setDoc, getDoc, getFirestore } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { firebaseConfig } from './firebase';
import { UserProfile, Business } from '../types';

export const DEMO_CREDENTIALS = [
  {
    role: 'SUPER_ADMIN',
    email: 'superadmin@minimarket.com',
    password: '123',
    displayName: 'Super Admin General',
    businessName: 'Global / Multi-tenant',
    businessId: null,
    description: 'Acceso total para crear y administrar negocios'
  },
  {
    role: 'ADMIN',
    email: 'admin.central@kiosco.com',
    password: '123',
    displayName: 'Carlos Pérez (Admin Central)',
    businessName: 'Kiosco Central School',
    businessId: 'biz_central_school',
    description: 'Administrador exclusivo de Kiosco Central School'
  },
  {
    role: 'SELLER',
    email: 'vendedor.central@kiosco.com',
    password: '123',
    displayName: 'Lucía Gómez (Cajera Central)',
    businessName: 'Kiosco Central School',
    businessId: 'biz_central_school',
    description: 'Vendedora/Cajera de Kiosco Central School'
  },
  {
    role: 'ADMIN',
    email: 'admin.norte@minimarket.com',
    password: '123',
    displayName: 'Mariana López (Admin Norte)',
    businessName: 'Minimarket Norte',
    businessId: 'biz_minimarket_norte',
    description: 'Administrador exclusivo de Minimarket Norte (Para probar aislamiento)'
  },
  {
    role: 'SELLER',
    email: 'vendedor.norte@minimarket.com',
    password: '123',
    displayName: 'Roberto Díaz (Cajero Norte)',
    businessName: 'Minimarket Norte',
    businessId: 'biz_minimarket_norte',
    description: 'Vendedor/Cajero de Minimarket Norte (Para probar aislamiento)'
  }
];

export async function ensureDemoDataSeeded(): Promise<void> {
  // Prevent seeding in production unless explicitly enabled via VITE_ENABLE_DEMO_SEED
  if (import.meta.env.PROD && import.meta.env.VITE_ENABLE_DEMO_SEED !== 'true') {
    return;
  }

  const secondaryAppName = `seederApp_${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  const secondaryDb = getFirestore(secondaryApp);

  try {
    const userUids: Record<string, string> = {};

    // 1. Create or resolve Auth accounts for demo credentials
    for (const cred of DEMO_CREDENTIALS) {
      try {
        const userCred = await createUserWithEmailAndPassword(secondaryAuth, cred.email, cred.password);
        userUids[cred.email] = userCred.user.uid;
        await secondaryAuth.signOut();
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          try {
            const existingCred = await signInWithEmailAndPassword(secondaryAuth, cred.email, cred.password);
            userUids[cred.email] = existingCred.user.uid;
            await secondaryAuth.signOut();
          } catch {
            userUids[cred.email] = `uid_${cred.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
          }
        } else {
          userUids[cred.email] = `uid_${cred.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        }
      }
    }

    // 2. Sign in as superadmin on secondaryAuth so secondaryDb has request.auth set
    try {
      await signInWithEmailAndPassword(secondaryAuth, 'superadmin@minimarket.com', '123');
    } catch {
      try {
        await createUserWithEmailAndPassword(secondaryAuth, 'superadmin@minimarket.com', '123');
      } catch (e) {
        // Fallback sign in if already created
      }
    }

    // 3. Create or ensure Business documents using secondaryDb
    const biz1Ref = doc(secondaryDb, 'businesses', 'biz_central_school');
    const biz1Snap = await getDoc(biz1Ref);
    if (!biz1Snap.exists()) {
      const biz1Data: Business = {
        id: 'biz_central_school',
        name: 'Kiosco Central School',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        adminUserId: userUids['admin.central@kiosco.com'] || 'uid_admin_central',
        adminEmail: 'admin.central@kiosco.com',
        adminName: 'Carlos Pérez'
      };
      await setDoc(biz1Ref, biz1Data);
    }

    const biz2Ref = doc(secondaryDb, 'businesses', 'biz_minimarket_norte');
    const biz2Snap = await getDoc(biz2Ref);
    if (!biz2Snap.exists()) {
      const biz2Data: Business = {
        id: 'biz_minimarket_norte',
        name: 'Minimarket Norte',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        adminUserId: userUids['admin.norte@minimarket.com'] || 'uid_admin_norte',
        adminEmail: 'admin.norte@minimarket.com',
        adminName: 'Mariana López'
      };
      await setDoc(biz2Ref, biz2Data);
    }

    // 4. Create user profiles in Firestore using secondaryDb
    for (const cred of DEMO_CREDENTIALS) {
      const uid = userUids[cred.email] || `uid_${cred.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

      const userProfile: UserProfile = {
        uid,
        email: cred.email,
        displayName: cred.displayName,
        role: cred.role as any,
        businessId: cred.businessId,
        active: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(secondaryDb, 'users', uid), userProfile, { merge: true });
    }
  } catch (error) {
    console.error('Error seeding demo data:', error);
  } finally {
    try {
      await secondaryAuth.signOut();
    } catch (_) {}
    await deleteApp(secondaryApp);
  }
}

