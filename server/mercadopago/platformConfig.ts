import fs from 'fs';
import path from 'path';

export interface PlatformAppConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  isConfigured: boolean;
}

export interface SanitizedPlatformAppConfig {
  clientIdMasked: string;
  redirectUri: string;
  isConfigured: boolean;
  hasSecret: boolean;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const PLATFORM_CONFIG_FILE = path.join(DATA_DIR, 'platform_mp_config.json');

// In-memory cache of dynamically updated platform config
let cachedDynamicConfig: { clientId?: string; clientSecret?: string; redirectUri?: string } | null = null;

function loadDynamicConfig(): { clientId?: string; clientSecret?: string; redirectUri?: string } {
  if (cachedDynamicConfig) return cachedDynamicConfig;
  try {
    if (fs.existsSync(PLATFORM_CONFIG_FILE)) {
      const raw = fs.readFileSync(PLATFORM_CONFIG_FILE, 'utf-8');
      cachedDynamicConfig = JSON.parse(raw);
      return cachedDynamicConfig || {};
    }
  } catch (err) {
    console.warn('[PlatformConfig] Error reading dynamic config file:', err);
  }
  cachedDynamicConfig = {};
  return cachedDynamicConfig;
}

/**
 * Returns the current platform credentials for the Uwi Mercado Pago application.
 * Precedence:
 * 1. Environment variables (MERCADOPAGO_CLIENT_ID / APP_ID, MERCADOPAGO_CLIENT_SECRET)
 * 2. Dynamic platform config (saved via Super Admin panel)
 */
export function getPlatformAppConfig(): PlatformAppConfig {
  const dynamic = loadDynamicConfig();

  const clientId = (
    process.env.MERCADOPAGO_CLIENT_ID?.trim() ||
    process.env.MERCADOPAGO_APP_ID?.trim() ||
    dynamic.clientId?.trim() ||
    ''
  );

  const clientSecret = (
    process.env.MERCADOPAGO_CLIENT_SECRET?.trim() ||
    dynamic.clientSecret?.trim() ||
    ''
  );

  const redirectUri = (
    process.env.MERCADOPAGO_REDIRECT_URI?.trim() ||
    dynamic.redirectUri?.trim() ||
    ''
  );

  const isConfigured = Boolean(clientId && clientSecret);

  return {
    clientId,
    clientSecret,
    redirectUri,
    isConfigured,
  };
}

/**
 * Sets platform credentials dynamically (available to Super Admin).
 * Strictly server-side; NEVER sent to client.
 */
export function setPlatformAppConfig(params: {
  clientId?: string;
  clientSecret?: string;
  redirectUri?: string;
}): PlatformAppConfig {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const current = loadDynamicConfig();
    const updated = {
      clientId: params.clientId !== undefined ? params.clientId.trim() : current.clientId,
      clientSecret: params.clientSecret !== undefined ? params.clientSecret.trim() : current.clientSecret,
      redirectUri: params.redirectUri !== undefined ? params.redirectUri.trim() : current.redirectUri,
    };
    fs.writeFileSync(PLATFORM_CONFIG_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    cachedDynamicConfig = updated;
  } catch (err) {
    console.error('[PlatformConfig] Failed to persist platform config:', err);
    throw err;
  }
  return getPlatformAppConfig();
}

/**
 * Returns a sanitized version of the platform configuration, safe to display to Super Admin.
 * NEVER exposes clientSecret.
 */
export function getSanitizedPlatformConfig(): SanitizedPlatformAppConfig {
  const config = getPlatformAppConfig();
  let clientIdMasked = '';
  if (config.clientId) {
    if (config.clientId.length <= 6) {
      clientIdMasked = '******';
    } else {
      clientIdMasked = config.clientId.slice(0, 3) + '******' + config.clientId.slice(-3);
    }
  }

  return {
    clientIdMasked,
    redirectUri: config.redirectUri,
    isConfigured: config.isConfigured,
    hasSecret: Boolean(config.clientSecret && config.clientSecret.length > 5),
  };
}
