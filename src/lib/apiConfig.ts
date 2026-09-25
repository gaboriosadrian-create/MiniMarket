/**
 * API Routing and Backend URL Configuration
 *
 * Configures API endpoints for same-origin Serverless Functions on Vercel
 * and local development.
 */

/**
 * Sanitizes and normalizes an API base URL:
 * - Trims whitespace
 * - Strips trailing slashes
 * - Strips accidentally included trailing '/api' or '/api/' so endpoints like '/api/...'
 *   do not become duplicate '/api/api/...'
 *
 * Example:
 *   'https://api.example.com/'     -> 'https://api.example.com'
 *   'https://api.example.com/api'  -> 'https://api.example.com'
 *   'https://api.example.com/api/' -> 'https://api.example.com'
 */
export function normalizeApiBaseUrl(rawUrl: string): string {
  let url = (rawUrl || '').trim();
  if (!url) return '';

  // Remove trailing slashes
  url = url.replace(/\/+$/, '');

  // If the user or environment accidentally provided a trailing /api, strip it
  // because frontend endpoints already provide the leading /api path.
  url = url.replace(/\/api$/i, '');

  // Remove trailing slash again in case it was /api/
  url = url.replace(/\/+$/, '');

  return url;
}

/**
 * Resolves the backend base URL.
 * Behavior:
 * 1. If VITE_API_BASE_URL is explicitly defined (custom proxy or alternate backend):
 *    Returns its normalized value.
 * 2. If VITE_API_BASE_URL is empty or undefined:
 *    Returns an empty string '' so that all API requests use same-origin relative paths
 *    (e.g., /api/mercadopago/connect) directly resolving to Vercel Serverless Functions.
 */
export function getApiBaseUrl(): string {
  let envUrl = '';
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) {
    envUrl = String(import.meta.env.VITE_API_BASE_URL).trim();
  } else if (typeof process !== 'undefined' && process.env?.VITE_API_BASE_URL) {
    envUrl = String(process.env.VITE_API_BASE_URL).trim();
  }

  if (envUrl) {
    return normalizeApiBaseUrl(envUrl);
  }

  return '';
}

/**
 * Builds a clean, fully-qualified or relative API endpoint URL.
 * 
 * Rules:
 * - Preserves existing query params and path structure.
 * - Ensures single leading slash.
 * - Prevents accidental duplicate /api/api/... paths.
 * - With explicit VITE_API_BASE_URL:
 *   '/api/mercadopago/connect?businessId=123' -> 'https://custom-domain.com/api/mercadopago/connect?businessId=123'
 * - Without VITE_API_BASE_URL (standard Vercel Serverless & local dev):
 *   '/api/mercadopago/connect?businessId=123' -> '/api/mercadopago/connect?businessId=123'
 */
export function getApiUrl(endpoint: string): string {
  let cleanEndpoint = (endpoint || '').trim();
  if (!cleanEndpoint.startsWith('/')) {
    cleanEndpoint = `/${cleanEndpoint}`;
  }

  // Guard against accidental double /api/api/ prefix in passed endpoint
  cleanEndpoint = cleanEndpoint.replace(/^\/api\/api\//i, '/api/');

  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${cleanEndpoint}` : cleanEndpoint;
}

