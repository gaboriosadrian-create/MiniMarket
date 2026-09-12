/**
 * Device and Unique Identifier Management for MiniMarket PWA
 * Provides stable device identifiers and cryptographically safe unique IDs for offline operations.
 */

const DEVICE_ID_KEY = 'minimarket_device_id';

/**
 * Generate a cryptographically strong UUID (v4)
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  
  // Fallback if crypto.randomUUID is not available in certain sandboxed environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Retrieve or create a persistent device identifier stored in localStorage
 */
export function getDeviceId(): string {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return `dev_srv_${generateUUID().slice(0, 12)}`;
  }

  try {
    let devId = localStorage.getItem(DEVICE_ID_KEY);
    if (!devId) {
      devId = `dev_${generateUUID().replace(/-/g, '').slice(0, 16)}`;
      localStorage.setItem(DEVICE_ID_KEY, devId);
    }
    return devId;
  } catch (err) {
    console.warn('[deviceId] No se pudo acceder a localStorage para deviceId:', err);
    return `dev_tmp_${generateUUID().slice(0, 12)}`;
  }
}

/**
 * Generates a unique, collisions-resistant Sale ID
 * Format: sale_<timestamp_hex>_<random_suffix>
 */
export function generateSaleId(): string {
  const timestampPart = Date.now().toString(36);
  const randomPart = generateUUID().replace(/-/g, '').slice(0, 12);
  return `sale_${timestampPart}_${randomPart}`;
}

/**
 * Generates a unique Outbox Operation ID
 * Format: op_<timestamp_hex>_<random_suffix>
 */
export function generateOperationId(): string {
  const timestampPart = Date.now().toString(36);
  const randomPart = generateUUID().replace(/-/g, '').slice(0, 12);
  return `op_${timestampPart}_${randomPart}`;
}
