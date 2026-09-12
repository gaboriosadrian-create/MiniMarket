import fs from 'fs';
import path from 'path';
import { getAdminDb } from './firebaseAdmin.js';

export interface StoredMerchantConnection {
  businessId: string;
  provider: 'mercadopago';
  status: 'CONNECTED' | 'DISCONNECTED';
  enabled?: boolean;
  explicitEnabled?: boolean;
  userId?: string;
  siteId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  externalStoreId?: string;
  storeId?: string;
  externalPosId?: string;
  posId?: string;
  accountNickname?: string;
  accountEmail?: string;
  connectedAt?: string;
  updatedAt?: string;
  mode?: 'TEST' | 'PRODUCTION';
}

export interface MigrationResult {
  migrated: number;
  skipped: number;
  errors: number;
  details: Array<{ businessId: string; status: string; result: 'MIGRATED' | 'SKIPPED' | 'ERROR'; reason?: string }>;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'mercadopago_connections.json');
const COLLECTION_NAME = 'business_payment_providers';

/**
 * Strips undefined values so Firestore does not reject the document write.
 */
function sanitizeFirestorePayload(data: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(data)) {
    if (val !== undefined) {
      result[key] = val;
    }
  }
  return result;
}

function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test' || process.argv.some((arg) => arg.includes('test'));
}

function isServerlessEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT
  );
}

class PersistenceServiceManager {
  private cache: Map<string, StoredMerchantConnection> = new Map();
  private loaded: boolean = false;
  private migrationAttempted: boolean = false;

  constructor() {
    this.ensureLoaded();
    // Non-blocking initialization of Firestore data in long-running container runtimes (Cloud Run / dev)
    if (!isTestEnvironment() && !isServerlessEnvironment()) {
      this.initFirestoreSync().catch((err) => {
        console.warn('[PersistenceService] Non-blocking Firestore initialization notice:', err?.message || err);
      });
    }
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
    this.loaded = true;
    if (isServerlessEnvironment()) {
      // In serverless runtimes (Vercel), filesystem is read-only and transient.
      // Firestore document lookups are the primary source of truth.
      return;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(CONNECTIONS_FILE)) {
        const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf-8');
        const parsed: Record<string, StoredMerchantConnection> = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          for (const [key, val] of Object.entries(parsed)) {
            if (val && val.businessId) {
              this.cache.set(val.businessId, val);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[PersistenceService] Warning reading persisted connections from disk:', err);
    }
  }

  private saveToDisk(): void {
    if (isServerlessEnvironment()) {
      // No disk persistence in serverless environments
      return;
    }
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const dataObj: Record<string, StoredMerchantConnection> = {};
      for (const [key, val] of this.cache.entries()) {
        dataObj[key] = val;
      }
      const tmpFile = `${CONNECTIONS_FILE}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataObj, null, 2), 'utf-8');
      fs.renameSync(tmpFile, CONNECTIONS_FILE);
    } catch (err) {
      console.error('[PersistenceService] Error saving connections backup to disk:', err);
    }
  }

  /**
   * Initializes Firestore sync and runs idempotent migration from disk if needed.
   */
  private async initFirestoreSync(): Promise<void> {
    if (this.migrationAttempted) return;
    this.migrationAttempted = true;
    try {
      await this.migrateFromDiskToFirestore();
    } catch (err) {
      console.warn('[PersistenceService] Could not complete initial Firestore sync, continuing with memory/disk cache:', err);
    }
  }

  /**
   * Reads a merchant connection by businessId asynchronously, querying Firestore first
   * and falling back to memory/disk cache.
   */
  public async getConnectionAsync(businessId: string): Promise<StoredMerchantConnection | null> {
    this.ensureLoaded();
    const cleanId = String(businessId || '').trim();
    if (!cleanId) return null;

    const isTestMode = isTestEnvironment();
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      try {
        const docSnap = await adminDb.collection(COLLECTION_NAME).doc(cleanId).get();
        if (docSnap.exists) {
          const data = docSnap.data() as StoredMerchantConnection;
          if (data && data.businessId) {
            this.cache.set(cleanId, data);
            return data;
          }
        }
      } catch (err: any) {
        console.warn(`[PersistenceService] Firestore read notice for businessId "${cleanId}":`, err?.message || err);
      }
    }

    return this.cache.get(cleanId) || null;
  }

  /**
   * Reads a merchant connection by businessId synchronously from cache.
   */
  public getConnection(businessId: string): StoredMerchantConnection | null {
    this.ensureLoaded();
    const cleanId = String(businessId || '').trim();
    return this.cache.get(cleanId) || null;
  }

  /**
   * Reads all merchant connections asynchronously from Firestore (via Admin SDK)
   * or in-memory cache.
   */
  public async getAllConnectionsAsync(): Promise<StoredMerchantConnection[]> {
    this.ensureLoaded();
    const isTestMode = isTestEnvironment();
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      try {
        const snapshot = await adminDb.collection(COLLECTION_NAME).get();
        for (const doc of snapshot.docs) {
          const data = doc.data() as StoredMerchantConnection;
          if (data && data.businessId) {
            this.cache.set(data.businessId, data);
          }
        }
      } catch (err: any) {
        console.warn('[PersistenceService] Firestore getAllConnections notice:', err?.message || err);
      }
    }
    return Array.from(this.cache.values());
  }

  /**
   * Reads all merchant connections synchronously from cache.
   */
  public getAllConnections(): StoredMerchantConnection[] {
    this.ensureLoaded();
    return Array.from(this.cache.values());
  }

  /**
   * Saves or updates a merchant connection asynchronously to Firestore, memory cache, and disk backup.
   */
  public async saveConnectionAsync(connection: StoredMerchantConnection): Promise<void> {
    this.ensureLoaded();
    const cleanId = String(connection.businessId || '').trim();
    if (!cleanId) return;

    const existing = this.cache.get(cleanId) || {};
    const updated: StoredMerchantConnection = {
      ...existing,
      ...connection,
      businessId: cleanId,
      updatedAt: new Date().toISOString(),
    };

    // 1. Update memory cache immediately
    this.cache.set(cleanId, updated);

    // 2. Persist to Firestore as primary source of truth
    const isTestMode = isTestEnvironment();
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      try {
        const payload = sanitizeFirestorePayload(updated);
        await adminDb.collection(COLLECTION_NAME).doc(cleanId).set(payload, { merge: true });
      } catch (err: any) {
        console.error(`[PersistenceService] Error persisting connection for "${cleanId}" to Firestore:`, err?.message || err);
      }
    }

    // 3. Persist dual-write backup to disk ONLY in container runtimes (Cloud Run / dev)
    if (!isServerlessEnvironment()) {
      this.saveToDisk();
    }
  }

  /**
   * Saves or updates a merchant connection synchronously into memory and disk,
   * triggering non-blocking background synchronization to Firestore.
   */
  public saveConnection(connection: StoredMerchantConnection): void {
    this.ensureLoaded();
    const cleanId = String(connection.businessId || '').trim();
    if (!cleanId) return;

    const existing = this.cache.get(cleanId) || {};
    const updated: StoredMerchantConnection = {
      ...existing,
      ...connection,
      businessId: cleanId,
      updatedAt: new Date().toISOString(),
    };

    this.cache.set(cleanId, updated);
    if (!isServerlessEnvironment()) {
      this.saveToDisk();
    }

    const isTestMode = isTestEnvironment();
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      const payload = sanitizeFirestorePayload(updated);
      adminDb.collection(COLLECTION_NAME).doc(cleanId).set(payload, { merge: true }).catch((err: any) => {
        console.error(`[PersistenceService] Background Firestore sync failed for "${cleanId}":`, err?.message || err);
      });
    }
  }

  /**
   * Removes a merchant connection asynchronously from Firestore, memory, and disk.
   */
  public async removeConnectionAsync(businessId: string): Promise<void> {
    this.ensureLoaded();
    const cleanId = String(businessId || '').trim();
    if (!cleanId) return;

    this.cache.delete(cleanId);
    if (!isServerlessEnvironment()) {
      this.saveToDisk();
    }

    const isTestMode = isTestEnvironment();
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      try {
        await adminDb.collection(COLLECTION_NAME).doc(cleanId).delete();
      } catch (err: any) {
        console.error(`[PersistenceService] Error deleting connection for "${cleanId}" from Firestore:`, err?.message || err);
      }
    }
  }

  /**
   * Removes a merchant connection synchronously from memory and disk,
   * triggering non-blocking background removal in Firestore.
   */
  public removeConnection(businessId: string): void {
    this.ensureLoaded();
    const cleanId = String(businessId || '').trim();
    if (!cleanId) return;

    if (this.cache.has(cleanId)) {
      this.cache.delete(cleanId);
      if (!isServerlessEnvironment()) {
        this.saveToDisk();
      }

      const isTestMode = isTestEnvironment();
      const adminDb = getAdminDb();
      if (!isTestMode && adminDb) {
        adminDb.collection(COLLECTION_NAME).doc(cleanId).delete().catch((err: any) => {
          console.error(`[PersistenceService] Background Firestore deletion failed for "${cleanId}":`, err?.message || err);
        });
      }
    }
  }

  /**
   * Resets local cache and disk backup (for unit tests).
   */
  public clear(): void {
    this.cache.clear();
    if (!isServerlessEnvironment()) {
      this.saveToDisk();
    }
  }

  /**
   * Safe migration routine:
   * Migrates any merchant connections from data/mercadopago_connections.json into Firestore.
   * - Respects businessId.
   * - Does not overwrite newer connections in Firestore with stale disk data.
   * - Keeps data/mercadopago_connections.json intact for safety and backup.
   * - Logs progress without leaking sensitive tokens (accessToken/refreshToken).
   */
  public async migrateFromDiskToFirestore(): Promise<MigrationResult> {
    this.ensureLoaded();
    const result: MigrationResult = {
      migrated: 0,
      skipped: 0,
      errors: 0,
      details: [],
    };

    if (isServerlessEnvironment() || !fs.existsSync(CONNECTIONS_FILE)) {
      return result;
    }

    let diskData: Record<string, StoredMerchantConnection> = {};
    try {
      const raw = fs.readFileSync(CONNECTIONS_FILE, 'utf-8');
      diskData = JSON.parse(raw) || {};
    } catch (err) {
      console.error('[PersistenceService Migration] Failed to read disk file for migration:', err);
      return result;
    }

    const entries = Object.entries(diskData);
    if (entries.length === 0) {
      return result;
    }

    console.info(`[PersistenceService Migration] Beginning safe migration of ${entries.length} connection(s) to Firestore...`);

    const isTestMode = isTestEnvironment();
    const adminDb = getAdminDb();

    for (const [businessIdKey, item] of entries) {
      const cleanId = String(item.businessId || businessIdKey).trim();
      if (!cleanId) {
        result.skipped++;
        result.details.push({ businessId: businessIdKey, status: 'INVALID', result: 'SKIPPED', reason: 'Missing businessId' });
        continue;
      }

      if (isTestMode || !adminDb) {
        // In offline/test mode, ensure loaded into memory cache
        this.cache.set(cleanId, { ...item, businessId: cleanId });
        result.migrated++;
        result.details.push({ businessId: cleanId, status: item.status, result: 'MIGRATED', reason: 'Loaded to memory cache (test/offline mode)' });
        continue;
      }

      try {
        const docRef = adminDb.collection(COLLECTION_NAME).doc(cleanId);
        const existingDoc = await docRef.get();

        if (existingDoc.exists) {
          const remoteData = existingDoc.data() as StoredMerchantConnection;
          const remoteUpdated = remoteData.updatedAt ? new Date(remoteData.updatedAt).getTime() : 0;
          const localUpdated = item.updatedAt ? new Date(item.updatedAt).getTime() : 0;

          if (remoteUpdated >= localUpdated) {
            console.info(`[PersistenceService Migration] Skipped "${cleanId}": Firestore already has a newer or identical record.`);
            result.skipped++;
            result.details.push({ businessId: cleanId, status: remoteData.status, result: 'SKIPPED', reason: 'Firestore has newer or identical record' });
            // Keep the newer remote version in memory cache
            this.cache.set(cleanId, remoteData);
            continue;
          }
        }

        // Write to Firestore with sanitized payload (no undefined values)
        const payload = sanitizeFirestorePayload({
          ...item,
          businessId: cleanId,
          migratedAt: new Date().toISOString(),
          migrationSource: 'mercadopago_connections.json',
        });

        await docRef.set(payload, { merge: true });

        // Update memory cache
        this.cache.set(cleanId, { ...item, businessId: cleanId });

        result.migrated++;
        result.details.push({ businessId: cleanId, status: item.status, result: 'MIGRATED' });
        console.info(`[PersistenceService Migration] Successfully migrated business "${cleanId}" (status: ${item.status}, provider: ${item.provider}) to Firestore.`);
      } catch (err: any) {
        result.errors++;
        result.details.push({ businessId: cleanId, status: item.status || 'UNKNOWN', result: 'ERROR', reason: err?.message || String(err) });
        console.error(`[PersistenceService Migration] Error migrating business "${cleanId}" to Firestore:`, err?.message || err);
      }
    }

    console.info(`[PersistenceService Migration] Migration completed: ${result.migrated} migrated, ${result.skipped} skipped, ${result.errors} errors.`);
    return result;
  }
}

export const persistenceService = new PersistenceServiceManager();

