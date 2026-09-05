import {
  TenantMercadoPagoConfig,
  SanitizedTenantMercadoPagoConfig,
  MercadoPagoConfig,
  MercadoPagoMode,
  MercadoPagoConnectionStatus,
} from './types.js';
import { auditStore } from './auditStore.js';
import { persistenceService } from './persistenceService.js';

export const TEST_SANDBOX_DEFAULTS = {
  userId: '3634603825',
  siteId: 'MLA',
  externalStoreId: 'MINIMARKET-POC-SUC-01',
  externalPosId: 'MINIMARKETPOCCAJA01',
  storeId: '86501276',
  posId: '137101354',
  pointTerminalId: 'SMARTPOS-POC-01',
  pointModel: 'POINT_SMART_1',
  pointOperatingMode: 'PDV',
};

class TenantConfigStoreManager {
  private configs: Map<string, TenantMercadoPagoConfig> = new Map();

  /**
   * Initializes or gets tenant configuration with env variable fallbacks.
   */
  public getConfig(businessId: string = 'default'): TenantMercadoPagoConfig {
    const key = String(businessId || 'default').trim();
    const isDefault = key === 'default';
    const enabledStr = process.env.MERCADOPAGO_ENABLED?.toLowerCase().trim();
    const autoConfirmStr = process.env.MERCADOPAGO_AUTO_CONFIRM?.toLowerCase().trim();
    const isGlobalEnabled = enabledStr === 'true' || enabledStr === '1' || enabledStr === 'yes';
    const isGlobalAutoConfirm = autoConfirmStr === 'true';

    let tenant = this.configs.get(key);
    if (!tenant) {
      // Check persistent store for saved connection
      const persisted = persistenceService.getConnection(key);

      if (persisted) {
        const isConnected = persisted.status === 'CONNECTED';
        tenant = {
          businessId: key,
          enabled: isConnected,
          mode: persisted.mode || 'PRODUCTION',
          autoConfirm: isGlobalAutoConfirm,
          connectionStatus: isConnected ? 'CONNECTED' : 'DISCONNECTED',
          lastVerification: persisted.updatedAt || persisted.connectedAt,
          lastVerificationMessage: isConnected ? 'Conexión activa guardada' : 'Desconectado',
          testConfig: {
            userId: TEST_SANDBOX_DEFAULTS.userId,
            siteId: 'MLA',
            externalStoreId: persisted.externalStoreId || TEST_SANDBOX_DEFAULTS.externalStoreId,
            externalPosId: persisted.externalPosId || TEST_SANDBOX_DEFAULTS.externalPosId,
            storeId: persisted.storeId || TEST_SANDBOX_DEFAULTS.storeId,
            posId: persisted.posId || TEST_SANDBOX_DEFAULTS.posId,
            pointTerminalId: TEST_SANDBOX_DEFAULTS.pointTerminalId,
            pointModel: TEST_SANDBOX_DEFAULTS.pointModel,
            pointOperatingMode: 'PDV',
            accessToken: isDefault ? (process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || '') : '',
          },
          productionConfig: {
            userId: persisted.userId || '',
            siteId: persisted.siteId || 'MLA',
            externalStoreId: persisted.externalStoreId || '',
            externalPosId: persisted.externalPosId || '',
            storeId: persisted.storeId || '',
            posId: persisted.posId || '',
            pointTerminalId: '',
            pointModel: 'POINT_SMART_1',
            pointOperatingMode: 'PDV',
            accessToken: persisted.accessToken || '',
          },
        };
      } else {
        // Unconfigured tenant
        const defaultEnabled = isGlobalEnabled;
        tenant = {
          businessId: key,
          enabled: defaultEnabled,
          mode: (isDefault || process.env.NODE_ENV === 'test') ? 'TEST' : 'PRODUCTION',
          autoConfirm: isGlobalAutoConfirm,
          connectionStatus: defaultEnabled ? 'CONNECTED' : 'NOT_VERIFIED',
          lastVerification: defaultEnabled ? new Date().toISOString() : undefined,
          lastVerificationMessage: defaultEnabled ? 'Configuración inicial de servidor' : undefined,
          testConfig: {
            userId: process.env.MERCADOPAGO_USER_ID?.trim() || TEST_SANDBOX_DEFAULTS.userId,
            siteId: process.env.MERCADOPAGO_SITE_ID?.trim() || TEST_SANDBOX_DEFAULTS.siteId,
            externalStoreId: process.env.MERCADOPAGO_EXTERNAL_STORE_ID?.trim() || TEST_SANDBOX_DEFAULTS.externalStoreId,
            externalPosId: process.env.MERCADOPAGO_EXTERNAL_POS_ID?.trim() || TEST_SANDBOX_DEFAULTS.externalPosId,
            storeId: process.env.MERCADOPAGO_STORE_ID?.trim() || TEST_SANDBOX_DEFAULTS.storeId,
            posId: process.env.MERCADOPAGO_POS_ID?.trim() || TEST_SANDBOX_DEFAULTS.posId,
            pointTerminalId: isDefault ? (process.env.MERCADOPAGO_POINT_TERMINAL_ID?.trim() || TEST_SANDBOX_DEFAULTS.pointTerminalId) : '',
            pointModel: process.env.MERCADOPAGO_POINT_MODEL?.trim() || TEST_SANDBOX_DEFAULTS.pointModel,
            pointOperatingMode: 'PDV',
            accessToken: isDefault ? (process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || '') : '',
          },
          productionConfig: {
            userId: '',
            siteId: 'MLA',
            externalStoreId: '',
            externalPosId: '',
            storeId: '',
            posId: '',
            pointTerminalId: '',
            pointModel: 'POINT_SMART_1',
            pointOperatingMode: 'PDV',
            accessToken: '',
          },
        };
      }
      this.configs.set(key, tenant);
    } else {
      // Dynamic inheritance when no explicit override was configured
      if (tenant.explicitEnabled === undefined) {
        tenant.enabled = isGlobalEnabled;
      }
      if (tenant.explicitAutoConfirm === undefined) {
        tenant.autoConfirm = isGlobalAutoConfirm;
      }
    }
    return tenant;
  }

  /**
   * Returns a sanitized DTO safe for the frontend.
   * STRICT SECURITY: Never includes access tokens.
   */
  public getSanitizedConfig(businessId: string = 'default'): SanitizedTenantMercadoPagoConfig {
    const config = this.getConfig(businessId);
    const testHasToken = Boolean(
      (config.testConfig.accessToken && config.testConfig.accessToken.length > 5) ||
      (process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_ACCESS_TOKEN.length > 5)
    );
    const prodHasToken = Boolean(
      config.productionConfig.accessToken && config.productionConfig.accessToken.length > 5
    );

    const activeCreds = config.mode === 'TEST' ? config.testConfig : config.productionConfig;
    const activeHasToken = config.mode === 'TEST' ? testHasToken : prodHasToken;

    return {
      businessId: config.businessId,
      enabled: config.enabled,
      mode: config.mode,
      autoConfirm: config.autoConfirm,
      connectionStatus: config.connectionStatus,
      lastVerification: config.lastVerification,
      lastVerificationMessage: config.lastVerificationMessage,
      updatedAt: config.updatedAt,
      updatedBy: config.updatedBy,
      testConfig: {
        userId: config.testConfig.userId || TEST_SANDBOX_DEFAULTS.userId,
        siteId: config.testConfig.siteId || TEST_SANDBOX_DEFAULTS.siteId,
        externalStoreId: config.testConfig.externalStoreId || TEST_SANDBOX_DEFAULTS.externalStoreId,
        externalPosId: config.testConfig.externalPosId || TEST_SANDBOX_DEFAULTS.externalPosId,
        storeId: config.testConfig.storeId || TEST_SANDBOX_DEFAULTS.storeId,
        posId: config.testConfig.posId || TEST_SANDBOX_DEFAULTS.posId,
        pointTerminalId: config.testConfig.pointTerminalId || TEST_SANDBOX_DEFAULTS.pointTerminalId,
        pointModel: config.testConfig.pointModel || TEST_SANDBOX_DEFAULTS.pointModel,
        pointOperatingMode: config.testConfig.pointOperatingMode || 'PDV',
        hasAccessToken: testHasToken,
      },
      productionConfig: {
        userId: config.productionConfig.userId || '',
        siteId: config.productionConfig.siteId || 'MLA',
        externalStoreId: config.productionConfig.externalStoreId || '',
        externalPosId: config.productionConfig.externalPosId || '',
        storeId: config.productionConfig.storeId || '',
        posId: config.productionConfig.posId || '',
        pointTerminalId: config.productionConfig.pointTerminalId || '',
        pointModel: config.productionConfig.pointModel || 'POINT_SMART_1',
        pointOperatingMode: config.productionConfig.pointOperatingMode || 'PDV',
        hasAccessToken: prodHasToken,
      },
      activeConfigSummary: {
        mode: config.mode,
        userId: activeCreds.userId || (config.mode === 'TEST' ? TEST_SANDBOX_DEFAULTS.userId : ''),
        siteId: activeCreds.siteId || 'MLA',
        externalStoreId: activeCreds.externalStoreId || (config.mode === 'TEST' ? TEST_SANDBOX_DEFAULTS.externalStoreId : ''),
        externalPosId: activeCreds.externalPosId || (config.mode === 'TEST' ? TEST_SANDBOX_DEFAULTS.externalPosId : ''),
        storeId: activeCreds.storeId || (config.mode === 'TEST' ? TEST_SANDBOX_DEFAULTS.storeId : ''),
        posId: activeCreds.posId || (config.mode === 'TEST' ? TEST_SANDBOX_DEFAULTS.posId : ''),
        pointTerminalId: activeCreds.pointTerminalId || (config.mode === 'TEST' ? TEST_SANDBOX_DEFAULTS.pointTerminalId : ''),
        pointModel: activeCreds.pointModel || (config.mode === 'TEST' ? TEST_SANDBOX_DEFAULTS.pointModel : 'POINT_SMART_1'),
        pointStatus: config.mode === 'TEST' ? 'Terminal Sandbox Asignada' : (activeCreds.pointTerminalId ? 'Terminal Configurada' : 'Sin terminal asignada'),
        hasAccessToken: activeHasToken,
        qrStatus: config.mode === 'TEST' ? 'QR Oficial Sandbox Activo' : (prodHasToken ? 'QR Producción Activo' : 'Pendiente de Configuración'),
        connectionStatus: config.connectionStatus,
      },
    };
  }

  /**
   * Saves updated tenant configuration with strict validation.
   * Access token updates are applied only if a non-empty string is provided.
   */
  public saveConfig(
    businessId: string = 'default',
    updates: {
      enabled?: boolean;
      mode?: MercadoPagoMode;
      autoConfirm?: boolean;
      testConfig?: Partial<TenantMercadoPagoConfig['testConfig']>;
      productionConfig?: Partial<TenantMercadoPagoConfig['productionConfig']>;
      updatedBy?: string;
    }
  ): TenantMercadoPagoConfig {
    const current = this.getConfig(businessId);

    const previousMode = current.mode;
    const previousEnabled = current.enabled;

    if (updates.enabled !== undefined) {
      current.explicitEnabled = Boolean(updates.enabled);
      current.enabled = Boolean(updates.enabled);
    }
    if (updates.mode !== undefined) {
      current.mode = updates.mode === 'PRODUCTION' ? 'PRODUCTION' : 'TEST';
    }
    if (updates.autoConfirm !== undefined) {
      current.explicitAutoConfirm = Boolean(updates.autoConfirm);
      current.autoConfirm = Boolean(updates.autoConfirm);
    }

    // Update Test Config (if provided)
    if (updates.testConfig) {
      current.testConfig = {
        ...current.testConfig,
        userId: updates.testConfig.userId?.trim() || current.testConfig.userId || TEST_SANDBOX_DEFAULTS.userId,
        siteId: updates.testConfig.siteId?.trim() || current.testConfig.siteId || TEST_SANDBOX_DEFAULTS.siteId,
        externalStoreId: updates.testConfig.externalStoreId?.trim() || current.testConfig.externalStoreId || TEST_SANDBOX_DEFAULTS.externalStoreId,
        externalPosId: updates.testConfig.externalPosId?.trim() || current.testConfig.externalPosId || TEST_SANDBOX_DEFAULTS.externalPosId,
        storeId: updates.testConfig.storeId?.trim() || current.testConfig.storeId || TEST_SANDBOX_DEFAULTS.storeId,
        posId: updates.testConfig.posId?.trim() || current.testConfig.posId || TEST_SANDBOX_DEFAULTS.posId,
        pointTerminalId: updates.testConfig.pointTerminalId?.trim() || current.testConfig.pointTerminalId || TEST_SANDBOX_DEFAULTS.pointTerminalId,
        pointModel: updates.testConfig.pointModel?.trim() || current.testConfig.pointModel || TEST_SANDBOX_DEFAULTS.pointModel,
        pointOperatingMode: updates.testConfig.pointOperatingMode?.trim() || current.testConfig.pointOperatingMode || 'PDV',
      };
      if (updates.testConfig.accessToken && updates.testConfig.accessToken.trim().length > 0) {
        current.testConfig.accessToken = updates.testConfig.accessToken.trim();
      }
    }

    // Update Production Config (if provided)
    if (updates.productionConfig) {
      current.productionConfig = {
        ...current.productionConfig,
        userId: updates.productionConfig.userId !== undefined ? updates.productionConfig.userId.trim() : current.productionConfig.userId,
        siteId: updates.productionConfig.siteId !== undefined ? updates.productionConfig.siteId.trim() : current.productionConfig.siteId,
        externalStoreId: updates.productionConfig.externalStoreId !== undefined ? updates.productionConfig.externalStoreId.trim() : current.productionConfig.externalStoreId,
        externalPosId: updates.productionConfig.externalPosId !== undefined ? updates.productionConfig.externalPosId.trim() : current.productionConfig.externalPosId,
        storeId: updates.productionConfig.storeId !== undefined ? updates.productionConfig.storeId.trim() : current.productionConfig.storeId,
        posId: updates.productionConfig.posId !== undefined ? updates.productionConfig.posId.trim() : current.productionConfig.posId,
        pointTerminalId: updates.productionConfig.pointTerminalId !== undefined ? updates.productionConfig.pointTerminalId.trim() : current.productionConfig.pointTerminalId,
        pointModel: updates.productionConfig.pointModel !== undefined ? updates.productionConfig.pointModel.trim() : current.productionConfig.pointModel,
        pointOperatingMode: updates.productionConfig.pointOperatingMode !== undefined ? updates.productionConfig.pointOperatingMode.trim() : current.productionConfig.pointOperatingMode,
      };
      if (updates.productionConfig.accessToken && updates.productionConfig.accessToken.trim().length > 0) {
        current.productionConfig.accessToken = updates.productionConfig.accessToken.trim();
      }
    }

    current.updatedAt = new Date().toISOString();
    current.updatedBy = updates.updatedBy || 'Administrador';

    this.configs.set(businessId, current);

    // Audit log
    auditStore.log({
      action: 'MERCADO_PAGO_CONFIG_UPDATED',
      result: current.enabled ? 'CONFIRMED' : 'DISABLED',
      isDuplicate: false,
      autoConfirmed: current.autoConfirm,
      attempts: 1,
      minimarketPreviousState: `Enabled: ${previousEnabled} | Mode: ${previousMode}`,
      minimarketNewState: `Enabled: ${current.enabled} | Mode: ${current.mode}`,
      userId: updates.updatedBy || 'Administrador',
      pos: current.mode === 'TEST' ? current.testConfig.posId : current.productionConfig.posId,
      store: current.mode === 'TEST' ? current.testConfig.storeId : current.productionConfig.storeId,
      errorDetails: `Configuración actualizada por ${updates.updatedBy || 'Administrador'} (Modo: ${current.mode})`,
    });

    return current;
  }

  /**
   * Sets verification status and audit trail for connection tests.
   */
  public updateConnectionStatus(
    businessId: string = 'default',
    status: MercadoPagoConnectionStatus,
    message: string
  ): void {
    const config = this.getConfig(businessId);
    config.connectionStatus = status;
    config.lastVerification = new Date().toISOString();
    config.lastVerificationMessage = message;
    this.configs.set(businessId, config);
  }

  /**
   * Resolves active MercadoPagoConfig for runtime operations (orders, webhooks, validations).
   * Fully isolates TEST from PRODUCTION.
   */
  public getActiveRuntimeConfig(businessId?: string): MercadoPagoConfig {
    const cleanId = String(businessId || 'default').trim();
    const isDefaultTenant = (!businessId || cleanId === 'default');
    const tenant = this.getConfig(cleanId);
    const isTest = tenant.mode === 'TEST';
    const activeCreds = isTest ? tenant.testConfig : tenant.productionConfig;

    // Token resolution: strictly per tenant.
    // In TEST mode, fallback to test env vars if no tenant token is specified.
    // In PRODUCTION mode, non-default tenants MUST have their own explicit credentials.
    const token = isTest
      ? (activeCreds.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim()
      : (activeCreds.accessToken || '').trim();

    const isEnabled = tenant.enabled;

    return {
      enabled: isEnabled,
      autoConfirm: tenant.autoConfirm,
      accessToken: token,
      userId: activeCreds.userId || (isTest ? (process.env.MERCADOPAGO_USER_ID?.trim() || TEST_SANDBOX_DEFAULTS.userId) : undefined),
      siteId: activeCreds.siteId || (isTest ? TEST_SANDBOX_DEFAULTS.siteId : 'MLA'),
      externalStoreId: activeCreds.externalStoreId || (isTest ? (process.env.MERCADOPAGO_EXTERNAL_STORE_ID?.trim() || TEST_SANDBOX_DEFAULTS.externalStoreId) : undefined),
      externalPosId: activeCreds.externalPosId || (isTest ? (process.env.MERCADOPAGO_EXTERNAL_POS_ID?.trim() || TEST_SANDBOX_DEFAULTS.externalPosId) : undefined),
      storeId: activeCreds.storeId || (isTest ? (process.env.MERCADOPAGO_STORE_ID?.trim() || TEST_SANDBOX_DEFAULTS.storeId) : undefined),
      posId: activeCreds.posId || (isTest ? (process.env.MERCADOPAGO_POS_ID?.trim() || TEST_SANDBOX_DEFAULTS.posId) : undefined),
      pointTerminalId: activeCreds.pointTerminalId || (isTest ? (process.env.MERCADOPAGO_POINT_TERMINAL_ID?.trim() || TEST_SANDBOX_DEFAULTS.pointTerminalId) : undefined),
      pointModel: activeCreds.pointModel || (isTest ? TEST_SANDBOX_DEFAULTS.pointModel : 'POINT_SMART_1'),
      apiBaseUrl: process.env.MERCADOPAGO_API_BASE_URL?.trim() || 'https://api.mercadopago.com',
    };
  }

  /**
   * Reset store (for testing).
   */
  public clear(): void {
    this.configs.clear();
  }
}

export const tenantConfigStore = new TenantConfigStoreManager();
