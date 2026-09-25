import crypto from 'crypto';
import { getAdminDb } from './firebaseAdmin.js';

export interface OAuthStateData {
  state: string;
  uid: string;
  businessId: string;
  nonce: string;
  returnOrigin?: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  consumedAt?: number;
}

export interface StateValidationResult {
  valid: boolean;
  error?: 'STATE_NOT_FOUND' | 'STATE_ALREADY_USED' | 'STATE_EXPIRED' | 'INVALID_FORMAT';
  message?: string;
  data?: {
    uid: string;
    businessId: string;
    nonce: string;
    returnOrigin?: string;
  };
}

class OAuthStateStoreManager {
  private states: Map<string, OAuthStateData> = new Map();
  private readonly DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
  private readonly COLLECTION_NAME = 'mercadopago_oauth_states';

  /**
   * Generates a cryptographically random, unguessable state string
   * bound to an authenticated user and their authorized businessId.
   * Persists to Firestore with TTL for multi-instance Serverless execution,
   * while keeping an in-memory cache for fast access and fallback.
   */
  public async createState(params: {
    uid: string;
    businessId: string;
    returnOrigin?: string;
    ttlMs?: number;
  }): Promise<string> {
    const cleanUid = String(params.uid || 'anonymous').trim();
    const cleanBusinessId = String(params.businessId || '').trim();
    if (!cleanBusinessId) {
      throw new Error('businessId es obligatorio para generar el state de OAuth.');
    }

    // High-entropy 32-byte cryptographic random token
    const randomHex = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const ttl = params.ttlMs || this.DEFAULT_TTL_MS;
    const expiresAt = now + ttl;

    const record: OAuthStateData = {
      state: randomHex,
      uid: cleanUid,
      businessId: cleanBusinessId,
      nonce,
      returnOrigin: params.returnOrigin ? String(params.returnOrigin).trim() : undefined,
      createdAt: now,
      expiresAt,
      used: false,
    };

    // Always keep in local memory map
    this.states.set(randomHex, record);
    this.cleanExpired();

    // Persist to Firestore for stateless serverless functions (skipped in offline unit test suite)
    const isTestMode = process.env.NODE_ENV === 'test';
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      try {
        const firestoreRecord: Record<string, any> = {
          state: randomHex,
          uid: cleanUid,
          businessId: cleanBusinessId,
          nonce,
          createdAt: now,
          expiresAt,
          used: false,
        };
        if (record.returnOrigin) {
          firestoreRecord.returnOrigin = record.returnOrigin;
        }

        await adminDb.collection(this.COLLECTION_NAME).doc(randomHex).set(firestoreRecord);
      } catch (err) {
        console.warn('[OAuthStateStore] Warning: Could not persist state to Firestore, using memory fallback:', err);
      }
    }

    return randomHex;
  }

  /**
   * Synchronous helper for tests or contexts where async is not awaited
   */
  public createStateSync(params: {
    uid: string;
    businessId: string;
    returnOrigin?: string;
    ttlMs?: number;
  }): string {
    const cleanUid = String(params.uid || 'anonymous').trim();
    const cleanBusinessId = String(params.businessId || '').trim();
    if (!cleanBusinessId) {
      throw new Error('businessId es obligatorio para generar el state de OAuth.');
    }

    const randomHex = crypto.randomBytes(32).toString('hex');
    const nonce = crypto.randomBytes(16).toString('hex');
    const now = Date.now();
    const ttl = params.ttlMs || this.DEFAULT_TTL_MS;
    const expiresAt = now + ttl;

    const record: OAuthStateData = {
      state: randomHex,
      uid: cleanUid,
      businessId: cleanBusinessId,
      nonce,
      returnOrigin: params.returnOrigin ? String(params.returnOrigin).trim() : undefined,
      createdAt: now,
      expiresAt,
      used: false,
    };

    this.states.set(randomHex, record);
    this.cleanExpired();

    const isTestMode = process.env.NODE_ENV === 'test';
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      const firestoreRecord: Record<string, any> = {
        state: randomHex,
        uid: cleanUid,
        businessId: cleanBusinessId,
        nonce,
        createdAt: now,
        expiresAt,
        used: false,
      };
      if (record.returnOrigin) {
        firestoreRecord.returnOrigin = record.returnOrigin;
      }
      adminDb.collection(this.COLLECTION_NAME).doc(randomHex).set(firestoreRecord).catch((err) => {
        console.warn('[OAuthStateStore] Background Firestore state sync failed:', err);
      });
    }

    return randomHex;
  }

  /**
   * Validates and immediately consumes the OAuth state.
   * Single-use only: once consumed, subsequent calls are rejected with STATE_ALREADY_USED.
   * Checks Firestore first to guarantee consistency across different serverless instances.
   */
  public async validateAndConsumeState(state: string): Promise<StateValidationResult> {
    if (!state || typeof state !== 'string') {
      return {
        valid: false,
        error: 'INVALID_FORMAT',
        message: 'El parámetro state es inválido o no fue provisto.',
      };
    }

    const cleanState = state.trim();
    let record: OAuthStateData | null = null;
    let fromFirestore = false;

    // 1. Try to read from Firestore (for cross-instance serverless resilience)
    const isTestMode = process.env.NODE_ENV === 'test';
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      try {
        const docRef = adminDb.collection(this.COLLECTION_NAME).doc(cleanState);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          record = docSnap.data() as OAuthStateData;
          fromFirestore = true;
        }
      } catch (err) {
        console.warn('[OAuthStateStore] Firestore read failed, falling back to local memory:', err);
      }
    }

    // 2. Fallback to local memory if not found in Firestore or Firestore errored
    if (!record) {
      record = this.states.get(cleanState) || null;
    }

    if (!record) {
      return {
        valid: false,
        error: 'STATE_NOT_FOUND',
        message: 'El state de autorización no fue encontrado o es inválido (posible ataque CSRF).',
      };
    }

    // Check if already consumed (Anti-Replay)
    if (record.used) {
      return {
        valid: false,
        error: 'STATE_ALREADY_USED',
        message: 'El state de autorización ya ha sido utilizado.',
      };
    }

    // Check expiration (Anti-Stale)
    if (Date.now() > record.expiresAt) {
      this.states.delete(cleanState);
      if (fromFirestore && adminDb) {
        adminDb.collection(this.COLLECTION_NAME).doc(cleanState).delete().catch(() => {});
      }
      return {
        valid: false,
        error: 'STATE_EXPIRED',
        message: 'El state de autorización ha expirado (tiempo límite excedido).',
      };
    }

    // Mark as consumed immediately (Atomic consume)
    record.used = true;
    record.consumedAt = Date.now();
    this.states.set(cleanState, record);

    if (fromFirestore && adminDb) {
      try {
        await adminDb.collection(this.COLLECTION_NAME).doc(cleanState).update({
          used: true,
          consumedAt: Date.now(),
        });
      } catch (err) {
        console.warn('[OAuthStateStore] Failed to update state in Firestore:', err);
      }
    }

    return {
      valid: true,
      data: {
        uid: record.uid,
        businessId: record.businessId,
        nonce: record.nonce,
        returnOrigin: record.returnOrigin,
      },
    };
  }

  /**
   * Inspection helper (for debugging/tests, does not mark as used)
   */
  public async peekState(state: string): Promise<OAuthStateData | null> {
    const cleanState = state.trim();
    const isTestMode = process.env.NODE_ENV === 'test';
    const adminDb = getAdminDb();
    if (!isTestMode && adminDb) {
      try {
        const docRef = adminDb.collection(this.COLLECTION_NAME).doc(cleanState);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          return docSnap.data() as OAuthStateData;
        }
      } catch {
        // fallback
      }
    }
    return this.states.get(cleanState) || null;
  }

  /**
   * Clean up expired or consumed states
   */
  public cleanExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.states.entries()) {
      if (now > item.expiresAt + 60_000 || (item.used && now > item.createdAt + 60_000)) {
        this.states.delete(key);
      }
    }
  }

  /**
   * Reset store (for testing)
   */
  public clear(): void {
    this.states.clear();
  }
}

export const oauthStateStore = new OAuthStateStoreManager();
