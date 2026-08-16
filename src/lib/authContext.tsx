import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signInWithRedirect,
  getRedirectResult,
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

  // Cargar perfil desde Firestore y validar permisos
  const fetchProfileAndBusiness = async (authUser: User): Promise<{ profile: UserProfile | null; errorMsg?: string }> => {
    try {
      const userDocRef = doc(db, 'users', authUser.uid);
      const userSnap = await getDoc(userDocRef);

      let profileData: UserProfile | null = null;

      if (userSnap.exists()) {
        profileData = userSnap.data() as UserProfile;
      } else {
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
            await setDoc(doc(db, 'users', authUser.uid), profileData, { merge: true });
          }
        }

        if (!profileData && authUser.email === 'superadmin@minimarket.com') {
          profileData = {
            uid: authUser.uid,
            email: authUser.email || 'superadmin@minimarket.com',
            displayName: authUser.displayName || 'Super Admin',
            role: 'SUPER_ADMIN',
            businessId: null,
            active: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', authUser.uid), profileData, { merge: true });
        }
      }

      if (!profileData) {
        await signOut(auth);
        setUserProfile(null);
        setBusiness(null);
        return {
          profile: null,
          errorMsg: 'Tu cuenta de Google no está habilitada para MiniMarket. Contactá al administrador.'
        };
      }

      if (profileData.active === false) {
        await signOut(auth);
        setUserProfile(null);
        setBusiness(null);
        return {
          profile: null,
          errorMsg: 'Tu cuenta está desactivada. Contactá al administrador.'
        };
      }

      if (!profileData.displayName && authUser.displayName) {
        profileData.displayName = authUser.displayName;
      }

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
    // Se deshabilita la llamada automática a ensureDemoDataSeeded para evitar errores 400 en la consola al montar

    // Capturar retorno tras autenticación por redirección con Google
    getRedirectResult(auth)
      .then(async (result) => {
        if (result && result.user) {
          const res = await fetchProfileAndBusiness(result.user);
          if (!res.profile && res.errorMsg) {
            setAuthError(res.errorMsg);
          }
        }
      })
      .catch((err) => {
        console.error('Error procesando el retorno de Google:', err);
        setAuthError('Error al completar el inicio de sesión con Google.');
      });

    // Escuchar cambios en la sesión activa
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
      
      // Uso directo de redirección para evitar bloqueos COOP y popups
      await signInWithRedirect(auth, provider);
    } catch (err: any) {
      console.error('Google Sign-In Error:', err);
      setAuthError('Error al redirigir a Google. Vuelve a intentarlo.');
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
    } catch (err: any) {
      console.error('Seed Error:', err);
      setAuthError(err.message || 'Error al sembrar datos de prueba.');
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
