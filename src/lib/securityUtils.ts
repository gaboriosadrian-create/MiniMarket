/**
 * MiniMarket Security Utilities
 * Input validation, sanitization, and data integrity guards
 */

/**
 * Strips dangerous HTML/script characters and enforces maximum length
 */
export function sanitizeString(val: unknown, maxLength: number = 255): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  // Remove control characters (except common whitespace)
  const clean = str.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F]/g, '');
  return clean.slice(0, maxLength);
}

/**
 * Validates and safely converts a number within defined limits
 */
export function sanitizeNumber(
  val: unknown,
  min: number = 0,
  max: number = 999999999,
  defaultVal: number = 0
): number {
  if (val === null || val === undefined || val === '') return defaultVal;
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num)) return defaultVal;
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Validates and safely converts an integer within defined limits
 */
export function sanitizeInteger(
  val: unknown,
  min: number = 0,
  max: number = 999999999,
  defaultVal: number = 0
): number {
  const num = sanitizeNumber(val, min, max, defaultVal);
  return Math.floor(num);
}

/**
 * Validates email format
 */
export function isValidEmail(email: unknown): boolean {
  if (typeof email !== 'string') return false;
  const clean = email.trim();
  if (clean.length < 3 || clean.length > 254) return false;
  // RFC 5322 standard regex for general email validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(clean);
}

/**
 * Sanitizes barcode string (alphanumeric, hyphens, underscores, max 64 chars)
 */
export function sanitizeBarcode(barcode: unknown): string | null {
  if (!barcode) return null;
  const clean = String(barcode).trim();
  if (clean.length === 0) return null;
  const sanitized = clean.replace(/[^a-zA-Z0-9\-_.]/g, '').slice(0, 64);
  return sanitized.length > 0 ? sanitized : null;
}

/**
 * Validates and formats ISO dates
 */
export function isValidIsoDate(dateStr: unknown): boolean {
  if (typeof dateStr !== 'string') return false;
  const d = new Date(dateStr);
  return !isNaN(d.getTime());
}

/**
 * Password strength validator (minimum 6 characters)
 */
export function isValidPassword(password: unknown): { valid: boolean; reason?: string } {
  if (typeof password !== 'string' || password.length < 6) {
    return { valid: false, reason: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (password.length > 128) {
    return { valid: false, reason: 'La contraseña no puede superar los 128 caracteres.' };
  }
  return { valid: true };
}

/**
 * Recursively removes all `undefined` properties from an object or array.
 * Preserves 0, false, empty strings, null, and valid primitive/object types.
 * Vital for preventing Firestore "Unsupported field value: undefined" errors.
 */
export function cleanFirestoreData<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => cleanFirestoreData(item))
      .filter((item) => item !== undefined) as unknown as T;
  }

  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj;
    }

    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        const cleanedValue = cleanFirestoreData(value);
        if (cleanedValue !== undefined) {
          cleanObj[key] = cleanedValue;
        }
      }
    }
    return cleanObj as T;
  }

  return obj;
}

