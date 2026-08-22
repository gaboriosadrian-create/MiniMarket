import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Auth instance
export const auth = getAuth(app);

// Get Firestore instance
export const db = getFirestore(app);

// Initialize Firebase App Check
export let appCheck: AppCheck | null = null;

if (typeof window !== 'undefined') {
  const isDev = import.meta.env.DEV;
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  const isEnterprise = import.meta.env.VITE_RECAPTCHA_IS_ENTERPRISE !== 'false';

  if (isDev) {
    // In local development, enable the official Firebase App Check debug provider.
    // Setting this to true instructs the Firebase SDK to auto-generate a debug token in the browser console.
    (self as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: boolean | string }).FIREBASE_APPCHECK_DEBUG_TOKEN = true;
  }

  if (siteKey || isDev) {
    try {
      const provider = isEnterprise
        ? new ReCaptchaEnterpriseProvider(siteKey || 'development-placeholder-key')
        : new ReCaptchaV3Provider(siteKey || 'development-placeholder-key');

      appCheck = initializeAppCheck(app, {
        provider,
        isTokenAutoRefreshEnabled: true,
      });
    } catch (err) {
      if (isDev) {
        console.info('[AppCheck] Running in development mode or awaiting site key configuration:', err);
      }
    }
  }
}

export default app;

