import crypto from 'crypto';

export interface OAuthStateData {
  state: string;
  uid: string;
  businessId: string;
  nonce: string;
  returnOrigin?: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
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

  /**
   * Generates a cryptographically random, unguessable state string
   * bound to an authenticated user and their authorized businessId.
   */
  public createState(params: {
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

    this.states.set(randomHex, record);
    this.cleanExpired();

    return randomHex;
  }

  /**
   * Validates and immediately consumes the OAuth state.
   * Single-use only: once consumed, subsequent calls are rejected with STATE_ALREADY_USED.
   */
  public validateAndConsumeState(state: string): StateValidationResult {
    if (!state || typeof state !== 'string') {
      return {
        valid: false,
        error: 'INVALID_FORMAT',
        message: 'El parámetro state es inválido o no fue provisto.',
      };
    }

    const record = this.states.get(state.trim());
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
      this.states.delete(state.trim());
      return {
        valid: false,
        error: 'STATE_EXPIRED',
        message: 'El state de autorización ha expirado (tiempo límite excedido).',
      };
    }

    // Mark as consumed immediately
    record.used = true;
    this.states.set(state.trim(), record);

    return {
      valid: true,
      data: {
        uid: record.uid,
        businessId: record.businessId,
        nonce: record.nonce,
      },
    };
  }

  /**
   * Inspection helper (for debugging/tests, does not mark as used)
   */
  public peekState(state: string): OAuthStateData | null {
    return this.states.get(state.trim()) || null;
  }

  /**
   * Clean up expired or consumed states
   */
  public cleanExpired(): void {
    const now = Date.now();
    for (const [key, item] of this.states.entries()) {
      if (now > item.expiresAt || (item.used && now > item.createdAt + 60_000)) {
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
