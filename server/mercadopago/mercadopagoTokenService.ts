import { persistenceService, StoredMerchantConnection } from './persistenceService.js';
import { getPlatformAppConfig } from './platformConfig.js';
import { tenantConfigStore } from './tenantConfigStore.js';

class MercadoPagoTokenServiceManager {
  private refreshingPromises: Map<string, Promise<string | null>> = new Map();

  /**
   * Retrieves a verified, valid Access Token for a specific business.
   * If the token is expired or nearing expiration (< 24 hours) and a refresh token is present,
   * it automatically executes the token exchange against Mercado Pago OAuth API.
   */
  public async getValidAccessToken(businessId: string): Promise<string | null> {
    const cleanId = String(businessId || '').trim();
    if (!cleanId) return null;

    // Check persistent store
    const connection = persistenceService.getConnection(cleanId);
    if (!connection || connection.status !== 'CONNECTED' || !connection.accessToken) {
      return null;
    }

    // Check expiration if tokenExpiresAt is defined
    const now = Date.now();
    const expiresAt = connection.tokenExpiresAt ? new Date(connection.tokenExpiresAt).getTime() : null;
    const isExpiringSoon = expiresAt !== null && (expiresAt - now < 24 * 60 * 60 * 1000);

    if (isExpiringSoon && connection.refreshToken) {
      // Avoid race conditions if multiple requests trigger refresh concurrently
      if (this.refreshingPromises.has(cleanId)) {
        return this.refreshingPromises.get(cleanId)!;
      }

      const refreshPromise = this.refreshAccessToken(cleanId, connection)
        .finally(() => {
          this.refreshingPromises.delete(cleanId);
        });

      this.refreshingPromises.set(cleanId, refreshPromise);
      return refreshPromise;
    }

    return connection.accessToken;
  }

  /**
   * Executes the refresh_token exchange with Mercado Pago.
   */
  public async refreshAccessToken(
    businessId: string,
    connection?: StoredMerchantConnection
  ): Promise<string | null> {
    const cleanId = String(businessId || '').trim();
    const conn = connection || persistenceService.getConnection(cleanId);
    if (!conn || !conn.refreshToken) {
      return conn?.accessToken || null;
    }

    const platformConfig = getPlatformAppConfig();
    if (!platformConfig.isConfigured) {
      console.warn('[MercadoPagoTokenService] Cannot refresh token: platform credentials not configured.');
      return conn.accessToken || null;
    }

    try {
      const response = await fetch('https://api.mercadopago.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: platformConfig.clientId,
          client_secret: platformConfig.clientSecret,
          grant_type: 'refresh_token',
          refresh_token: conn.refreshToken,
        }),
      });

      if (!response.ok) {
        const errJson: any = await response.json().catch(() => ({}));
        console.error('[MercadoPagoTokenService] Failed to refresh token:', errJson);
        return conn.accessToken || null;
      }

      const data: any = await response.json();
      const newAccessToken = data.access_token;
      const newRefreshToken = data.refresh_token || conn.refreshToken;
      const expiresInSec = typeof data.expires_in === 'number' ? data.expires_in : 180 * 24 * 3600;
      const newExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

      // Persist updated credentials
      persistenceService.saveConnection({
        ...conn,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        tokenExpiresAt: newExpiresAt,
        updatedAt: new Date().toISOString(),
      });

      // Update tenantConfigStore
      const currentConfig = tenantConfigStore.getConfig(cleanId);
      tenantConfigStore.saveConfig(cleanId, {
        productionConfig: {
          ...currentConfig.productionConfig,
          accessToken: newAccessToken,
        },
        updatedBy: 'Token Refresh Service',
      });

      return newAccessToken;
    } catch (err) {
      console.error('[MercadoPagoTokenService] Error during token refresh request:', err);
      return conn.accessToken || null;
    }
  }

  /**
   * Saves newly authorized OAuth tokens for a business.
   */
  public async saveOAuthTokens(params: {
    businessId: string;
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    userId?: string;
    accountEmail?: string;
    accountNickname?: string;
    mode?: 'TEST' | 'PRODUCTION';
  }): Promise<void> {
    const { businessId, accessToken, refreshToken, expiresIn, userId, accountEmail, accountNickname, mode } = params;
    const cleanId = String(businessId || '').trim();
    if (!cleanId) return;

    const expiresInSec = typeof expiresIn === 'number' ? expiresIn : 180 * 24 * 3600; // default 180 days
    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    const existing = persistenceService.getConnection(cleanId) || {
      businessId: cleanId,
      provider: 'mercadopago' as const,
      status: 'CONNECTED' as const,
    };

    persistenceService.saveConnection({
      ...existing,
      businessId: cleanId,
      provider: 'mercadopago',
      status: 'CONNECTED',
      accessToken,
      refreshToken: refreshToken || existing.refreshToken,
      tokenExpiresAt,
      userId: userId || existing.userId,
      accountEmail: accountEmail || existing.accountEmail,
      accountNickname: accountNickname || existing.accountNickname || 'Cuenta Comercial Verificada',
      mode: mode || 'PRODUCTION',
      connectedAt: existing.connectedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Revokes or clears tokens upon disconnect.
   */
  public clearTokens(businessId: string): void {
    const cleanId = String(businessId || '').trim();
    const existing = persistenceService.getConnection(cleanId);
    if (existing) {
      persistenceService.saveConnection({
        ...existing,
        status: 'DISCONNECTED',
        accessToken: '',
        refreshToken: '',
        tokenExpiresAt: undefined,
        updatedAt: new Date().toISOString(),
      });
    }
  }
}

export const mercadopagoTokenService = new MercadoPagoTokenServiceManager();
