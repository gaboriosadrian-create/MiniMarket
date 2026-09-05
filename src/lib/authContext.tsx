import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile, Business } from '../types';
import { ensureDemoDataSeeded } from './seedService';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  business: Business | null;
  loading: boolean;
  authError: string | null;
  login: (email: string, pass: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  seedDemoData: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Load Firestore profile for authenticated user & validate permissions
  const fetchProfileAndBusiness = async (authUser: User): Promise<{ profile: UserProfile | null; errorMsg?: string }> => {
    try {
      const userDocRef = doc(db, 'users', authUser.uid);
      const userSnap = await getDoc(userDocRef);

      let profileData: UserProfile | null = null;

      if (userSnap.exists()) {
        profileData = userSnap.data() as UserProfile;
      } else {
        // Fallback: search by email to link existing pre-provisioned user profile
        if (authUser.email) {
          const q = query(collection(db, 'users'), where('email', '==', authUser.email.toLowerCase().trim()));
          const querySnap = await getDocs(q);
          if (!querySnap.empty) {
            const existingDocData = querySnap.docs[0].data() as UserProfile;
            profileData = {
              ...existingDocData,
              uid: authUser.uid,
              displayName: existingDocData.displayName || authUser.displayName || existingDocData.email,
              updatedAt: new Date().toISOString()
            };
            // Save doc under authUser.uid so security rules match request.auth.uid
            await setDoc(doc(db, 'users', authUser.uid), profileData, { merge: true });
          }
        }

        // Special superadmin for Firebase Project Owner (Google Authentication)
        const superAdminOwnerEmail = (import.meta.env.VITE_SUPERADMIN_EMAIL || 'gaboriosadrian@gmail.com').toLowerCase().trim();
        const isOwnerGoogleAccount = authUser.email && authUser.email.toLowerCase().trim() === superAdminOwnerEmail;

        if (isOwnerGoogleAccount) {
          if (!profileData) {
            profileData = {
              uid: authUser.uid,
              email: authUser.email!,
              displayName: authUser.displayName || 'Super Admin',
              role: 'SUPER_ADMIN',
              businessId: null,
              active: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await setDoc(doc(db, 'users', authUser.uid), profileData, { merge: true });
          } else if (profileData.role !== 'SUPER_ADMIN') {
            profileData.role = 'SUPER_ADMIN';
            profileData.active = true;
            profileData.businessId = null;
            await setDoc(doc(db, 'users', authUser.uid), {
              role: 'SUPER_ADMIN',
              active: true,
              businessId: null,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
      }

      // Reject if no profile document exists
      if (!profileData) {
        await signOut(auth);
        setUserProfile(null);
        setBusiness(null);
        return {
          profile: null,
          errorMsg: 'Tu cuenta de Google no está habilitada para uwi. Contactá al administrador.'
        };
      }

      // Reject if user is blocked or inactive/disabled
      if (profileData.active === false || profileData.status === 'BLOCKED' || profileData.status === 'DISABLED') {
        await signOut(auth);
        setUserProfile(null);
        setBusiness(null);
        const isBlocked = profileData.status === 'BLOCKED';
        return {
          profile: null,
          errorMsg: isBlocked
            ? 'Tu usuario está bloqueado. Contactá al administrador.'
            : 'Tu usuario está desactivado. Contactá al administrador.'
        };
      }

      // Preserve existing displayName or fallback to Google displayName
      if (!profileData.displayName && authUser.displayName) {
        profileData.displayName = authUser.displayName;
      }

      // Fetch associated business if user has a businessId
      if (profileData.businessId) {
        const bizSnap = await getDoc(doc(db, 'businesses', profileData.businessId));
        if (bizSnap.exists()) {
          setBusiness({ id: bizSnap.id, ...bizSnap.data() } as Business);
        } else {
          setBusiness(null);
        }
      } else {
        setBusiness(null);
      }

      setUserProfile(profileData);
      return { profile: profileData };
    } catch (error: any) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
      setBusiness(null);
      return { profile: null, errorMsg: 'Error al verificar el perfil de usuario. Vuelve a intentarlo.' };
    }
  };

  useEffect(() => {
    // Seed default demo accounts in the background on initial app launch
    ensureDemoDataSeeded().catch((err) => console.log('Demo seed initialized:', err));

    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      setUser(authUser);
      if (authUser) {
        const res = await fetchProfileAndBusiness(authUser);
        if (!res.profile) {
          setUser(null);
          if (res.errorMsg) {
            setAuthError(res.errorMsg);
          }
        } else {
          setAuthError(null);
        }
      } else {
        setUserProfile(null);
        setBusiness(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, pass: string) => {
    setLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      let userCred;
      try {
        userCred = await signInWithPopup(auth, provider);
      } catch (popupErr: any) {
        if (popupErr.code === 'auth/popup-blocked') {
          await signInWithRedirect(auth, provider);
          return;
        }
        if (popupErr.code === 'auth/popup-closed-by-user' || popupErr.code === 'auth/cancelled-popup-request') {
          setLoading(false);
          return;
        }
        throw popupErr;
      }

      if (userCred && userCred.user) {
        const res = await fetchProfileAndBusiness(userCred.user);
        if (!res.profile && res.errorMsg) {
          setAuthError(res.errorMsg);
        }
      }
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        // User closed popup
      } else if (err.code === 'auth/network-request-failed') {
        setAuthError('Error de red al conectar con Google. Revisa tu conexión.');
      } else {
        setAuthError('Error al iniciar sesión con Google. Vuelve a intentarlo.');
      }
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await signOut(auth);
    } finally {
      setUser(null);
      setUserProfile(null);
      setBusiness(null);
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileAndBusiness(user);
    }
  };

  const seedDemoData = async () => {
    setLoading(true);
    setAuthError(null);
    try {
      await ensureDemoDataSeeded();
      if (user) {
        await fetchProfileAndBusiness(user);
      }
    } finally {
      setLoading(false);
    }
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      userProfile,
      business,
      loading,
      authError,
      login,
      loginWithGoogle,
      logout,
      refreshProfile,
      seedDemoData,
      clearAuthError
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
