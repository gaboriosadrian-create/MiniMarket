import fs from 'fs';
import path from 'path';

export interface StoredMerchantConnection {
  businessId: string;
  provider: 'mercadopago';
  status: 'CONNECTED' | 'DISCONNECTED';
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

const DATA_DIR = path.join(process.cwd(), 'data');
const CONNECTIONS_FILE = path.join(DATA_DIR, 'mercadopago_connections.json');

class PersistenceServiceManager {
  private cache: Map<string, StoredMerchantConnection> = new Map();
  private loaded: boolean = false;

  constructor() {
    this.ensureLoaded();
  }

  private ensureLoaded(): void {
    if (this.loaded) return;
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
      console.warn('[PersistenceService] Warning reading persisted connections:', err);
    }
    this.loaded = true;
  }

  private saveToDisk(): void {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      const dataObj: Record<string, StoredMerchantConnection> = {};
      for (const [key, val] of this.cache.entries()) {
        dataObj[key] = val;
      }
      const tmpFile = `${CONNECTIONS_FILE}.${Date.now()}.tmp`;
      fs.writeFileSync(tmpFile, JSON.stringify(dataObj, null, 2), 'utf-8');
      fs.renameSync(tmpFile, CONNECTIONS_FILE);
    } catch (err) {
      console.error('[PersistenceService] Error saving connections to disk:', err);
    }
  }

  public getConnection(businessId: string): StoredMerchantConnection | null {
    this.ensureLoaded();
    const cleanId = String(businessId || '').trim();
    return this.cache.get(cleanId) || null;
  }

  public getAllConnections(): StoredMerchantConnection[] {
    this.ensureLoaded();
    return Array.from(this.cache.values());
  }

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
    this.saveToDisk();
  }

  public removeConnection(businessId: string): void {
    this.ensureLoaded();
    const cleanId = String(businessId || '').trim();
    if (this.cache.has(cleanId)) {
      this.cache.delete(cleanId);
      this.saveToDisk();
    }
  }

  public clear(): void {
    this.cache.clear();
    this.saveToDisk();
  }
}

export const persistenceService = new PersistenceServiceManager();
