import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | null = null;
let adminDb: Firestore | null = null;
let initError: Error | null = null;

const PROJECT_ID = process.env.VITE_FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || 'minimarket-web';

/**
 * Initializes and returns the Firebase Admin Firestore instance.
 * Reuses existing initialized apps to avoid duplicate instances.
 */
export function getAdminDb(): Firestore | null {
  if (adminDb) {
    return adminDb;
  }

  try {
    const existingApps = getApps();
    if (existingApps.length > 0) {
      adminApp = existingApps[0];
      adminDb = getFirestore(adminApp);
      return adminDb;
    }

    // 1. Check for Service Account Key in environment variables
    const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY || process.env.FIREBASE_ADMIN_CREDENTIALS;
    if (rawKey && typeof rawKey === 'string' && rawKey.trim()) {
      let parsedKey: any;
      try {
        parsedKey = JSON.parse(rawKey.trim());
      } catch {
        // Attempt base64 decode
        try {
          const decoded = Buffer.from(rawKey.trim(), 'base64').toString('utf-8');
          parsedKey = JSON.parse(decoded);
        } catch (e: any) {
          console.error('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY JSON:', e.message);
        }
      }

      if (parsedKey && parsedKey.project_id) {
        adminApp = initializeApp({
          credential: cert(parsedKey),
          projectId: parsedKey.project_id || PROJECT_ID,
        });
        adminDb = getFirestore(adminApp);
        console.log(`[FirebaseAdmin] Initialized successfully with Service Account for project "${parsedKey.project_id}".`);
        return adminDb;
      }
    }

    // 2. Standard Google Cloud ADC (Cloud Run / App Engine / Compute Engine) or Project ID
    adminApp = initializeApp({
      projectId: PROJECT_ID,
    });
    adminDb = getFirestore(adminApp);
    console.log(`[FirebaseAdmin] Initialized with project ID "${PROJECT_ID}".`);
    return adminDb;
  } catch (err: any) {
    initError = err;
    console.error('[FirebaseAdmin] Initialization error:', err?.message || err);
    return null;
  }
}

export { adminDb, adminApp };
