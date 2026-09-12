import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import type { AppCheck } from 'firebase/app-check';

// Confirmed production project configuration for Minimarket Web (uwi)
const FALLBACK_CONFIG = {
  apiKey: 'AIzaSyCemsiAziyNd-1SdxMyhZm_ASCWqnVmcFA',
  authDomain: 'minimarket-web.firebaseapp.com',
  projectId: 'minimarket-web',
  storageBucket: 'minimarket-web.firebasestorage.app',
  messagingSenderId: '494801719573',
  appId: '1:494801719573:web:e9dc1d1dc243e25e4ed91c',
};

// Safe environment resolver compatible with Vite (client-side), Node.js (server-side/tests), and fallback
const resolveEnv = (viteVal: string | undefined, nodeKey: string, fallback: string = ''): string => {
  if (viteVal && typeof viteVal === 'string' && viteVal.trim() !== '') {
    return viteVal.trim();
  }
  if (
    typeof process !== 'undefined' &&
    process?.env &&
    process.env[nodeKey] &&
    typeof process.env[nodeKey] === 'string' &&
    process.env[nodeKey]!.trim() !== ''
  ) {
    return process.env[nodeKey]!.trim();
  }
  return fallback;
};

export const firebaseConfig = {
  apiKey: resolveEnv(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_API_KEY : undefined,
    'VITE_FIREBASE_API_KEY',
    FALLBACK_CONFIG.apiKey
  ),
  authDomain: resolveEnv(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_AUTH_DOMAIN : undefined,
    'VITE_FIREBASE_AUTH_DOMAIN',
    FALLBACK_CONFIG.authDomain
  ),
  projectId: resolveEnv(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_PROJECT_ID : undefined,
    'VITE_FIREBASE_PROJECT_ID',
    FALLBACK_CONFIG.projectId
  ),
  storageBucket: resolveEnv(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_STORAGE_BUCKET : undefined,
    'VITE_FIREBASE_STORAGE_BUCKET',
    FALLBACK_CONFIG.storageBucket
  ),
  messagingSenderId: resolveEnv(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_MESSAGING_SENDER_ID : undefined,
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    FALLBACK_CONFIG.messagingSenderId
  ),
  appId: resolveEnv(
    typeof import.meta !== 'undefined' ? import.meta.env?.VITE_FIREBASE_APP_ID : undefined,
    'VITE_FIREBASE_APP_ID',
    FALLBACK_CONFIG.appId
  ),
};

// Initialize Firebase App
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Get Auth instance
export const auth = getAuth(app);

// Get Firestore instance
export const db = getFirestore(app);

// Export appCheck reference (configured properly in lib/appCheck.ts and invoked in main.tsx)
export let appCheck: AppCheck | null = null;

export default app;

