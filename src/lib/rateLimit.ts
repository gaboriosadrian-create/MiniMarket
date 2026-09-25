/**
 * MiniMarket Concurrency & Rate Limiting System
 * - Prevents double-clicks and race conditions via execution mutexes
 * - Implements sliding window rate limiters for sensitive endpoints
 * - Anti-loop protection for UI event handlers
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();
const activeLocks = new Set<string>();

/**
 * Sliding Window Rate Limiter
 * @param key Unique rate limit bucket identifier (e.g., 'login:user@test.com')
 * @param maxRequests Maximum allowed requests in the time window
 * @param windowMs Window duration in milliseconds
 * @returns { allowed: boolean; retryAfterMs: number }
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(key, record);
  }

  // Filter out timestamps outside current sliding window
  record.timestamps = record.timestamps.filter(t => now - t < windowMs);

  if (record.timestamps.length >= maxRequests) {
    const oldestInWindow = record.timestamps[0];
    const retryAfterMs = Math.max(0, windowMs - (now - oldestInWindow));
    return { allowed: false, retryAfterMs };
  }

  // Record this attempt
  record.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

/**
 * Resets rate limit for a specific key (e.g., upon successful authentication)
 */
export function resetRateLimit(key: string): void {
  rateLimitStore.delete(key);
}

/**
 * Concurrency Mutex Lock
 * Ensures that asynchronous actions (like confirming transactions, creating sales, or importing)
 * cannot be executed concurrently with the same lock key.
 */
export async function withActionLock<T>(
  lockKey: string,
  action: () => Promise<T>
): Promise<T> {
  if (activeLocks.has(lockKey)) {
    throw new Error('Operación en curso. Por favor, aguarde a que finalice antes de reintentar.');
  }

  activeLocks.add(lockKey);
  try {
    return await action();
  } finally {
    activeLocks.delete(lockKey);
  }
}

/**
 * Checks if an action lock is currently active
 */
export function isActionLocked(lockKey: string): boolean {
  return activeLocks.has(lockKey);
}
