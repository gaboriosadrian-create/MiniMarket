import { MercadoPagoConfig, MercadoPagoMode } from './types.js';
import { tenantConfigStore } from './tenantConfigStore.js';

export interface SanitizedMercadoPagoSummary {
  enabled: boolean;
  mode: MercadoPagoMode;
  autoConfirm: boolean;
  hasAccessToken: boolean;
  siteId: string;
  userId: string;
  externalStoreId: string;
  externalPosId: string;
  storeId: string;
  posId: string;
}

/**
 * Resolves the global Mercado Pago configuration directly from environment variables.
 */
export function getGlobalServerConfig(): MercadoPagoConfig {
  const enabledStr = process.env.MERCADOPAGO_ENABLED?.toLowerCase().trim();
  const autoConfirmStr = process.env.MERCADOPAGO_AUTO_CONFIRM?.toLowerCase().trim();

  const enabled = enabledStr === 'true' || enabledStr === '1' || enabledStr === 'yes';
  const autoConfirm = autoConfirmStr === 'true';

  return {
    enabled,
    autoConfirm,
    accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || '',
    userId: process.env.MERCADOPAGO_USER_ID?.trim() || '',
    siteId: process.env.MERCADOPAGO_SITE_ID?.trim() || 'MLA',
    externalStoreId: process.env.MERCADOPAGO_EXTERNAL_STORE_ID?.trim() || '',
    externalPosId: process.env.MERCADOPAGO_EXTERNAL_POS_ID?.trim() || '',
    storeId: process.env.MERCADOPAGO_STORE_ID?.trim() || '',
    posId: process.env.MERCADOPAGO_POS_ID?.trim() || '',
    apiBaseUrl: process.env.MERCADOPAGO_API_BASE_URL?.trim() || 'https://api.mercadopago.com',
  };
}

/**
 * Unified single source of truth for resolving Mercado Pago configuration.
 * 
 * Rules:
 * 1. Global config is parsed from environment variables (process.env.MERCADOPAGO_ENABLED, etc.).
 * 2. If businessId is provided, resolves tenant config from tenant store.
 * 3. If tenant has no explicit enabled override, it inherits globalConfig.enabled.
 * 4. If tenant has explicit enabled: false, resolves enabled = false.
 * 5. If tenant has explicit enabled: true, resolves enabled = true.
 * 6. If global is false and tenant has no explicit override, resolves enabled = false.
 * 7. Serverless instances without previous in-memory state always resolve fresh defaults correctly.
 */
export function resolveMercadoPagoConfig(businessId?: string): MercadoPagoConfig {
  return tenantConfigStore.getActiveRuntimeConfig(businessId);
}

/**
 * Alias for resolveMercadoPagoConfig for backward compatibility across modules.
 */
export function getMercadoPagoConfig(businessId?: string): MercadoPagoConfig {
  return resolveMercadoPagoConfig(businessId);
}

/**
 * Returns a sanitized configuration summary safe for status endpoints and logging.
 * NEVER includes `accessToken` or secrets.
 */
export function getSanitizedMercadoPagoConfig(businessId?: string): SanitizedMercadoPagoSummary {
  const config = resolveMercadoPagoConfig(businessId);
  return {
    enabled: config.enabled,
    mode: config.mode || 'TEST',
    autoConfirm: config.autoConfirm,
    hasAccessToken: Boolean(config.accessToken && config.accessToken.trim().length > 5),
    siteId: config.siteId || 'MLA',
    userId: config.userId || '',
    externalStoreId: config.externalStoreId || '',
    externalPosId: config.externalPosId || '',
    storeId: config.storeId || '',
    posId: config.posId || '',
  };
}

/**
 * Asynchronously resolves sanitized Mercado Pago configuration for a tenant,
 * hydrating from Firestore if not present in memory. Safe for serverless cold starts.
 */
export async function getSanitizedMercadoPagoConfigAsync(businessId?: string): Promise<SanitizedMercadoPagoSummary> {
  const config = await tenantConfigStore.getActiveRuntimeConfigAsync(businessId);
  return {
    enabled: config.enabled,
    mode: config.mode || 'TEST',
    autoConfirm: config.autoConfirm,
    hasAccessToken: Boolean(config.accessToken && config.accessToken.trim().length > 5),
    siteId: config.siteId || 'MLA',
    userId: config.userId || '',
    externalStoreId: config.externalStoreId || '',
    externalPosId: config.externalPosId || '',
    storeId: config.storeId || '',
    posId: config.posId || '',
  };
}
