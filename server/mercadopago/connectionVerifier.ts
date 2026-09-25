import {
  MercadoPagoMode,
  ConnectionVerificationResult,
} from './types.js';
import { tenantConfigStore } from './tenantConfigStore.js';
import { auditStore } from './auditStore.js';

export interface VerifyConnectionOptions {
  businessId?: string;
  mode?: MercadoPagoMode;
  apiBaseUrl?: string;
  timeoutMs?: number;
  testedBy?: string;
}

/**
 * Tests connection to Mercado Pago without creating any order, payment, or sales record.
 * 
 * STRICT COMPLIANCE:
 * - Never creates orders
 * - Never modifies stock or cash
 * - Never exposes access tokens or secrets in responses or logs
 */
export async function verifyMercadoPagoConnection(
  options: VerifyConnectionOptions = {}
): Promise<ConnectionVerificationResult> {
  const businessId = options.businessId || 'default';
  const tenant = tenantConfigStore.getConfig(businessId);
  const targetMode: MercadoPagoMode = options.mode || tenant.mode;

  const isTest = targetMode === 'TEST';
  const creds = isTest ? tenant.testConfig : tenant.productionConfig;

  const accessToken = isTest
    ? (creds.accessToken || process.env.MERCADOPAGO_ACCESS_TOKEN || '').trim()
    : (creds.accessToken || '').trim();

  const testedAt = new Date().toISOString();

  // 1. Validate presence of token
  if (!accessToken || accessToken.length < 10) {
    const errorMsg = isTest
      ? 'Access Token de prueba no disponible en el servidor.'
      : 'Debe ingresar un Access Token válido de producción antes de verificar la conexión.';

    tenantConfigStore.updateConnectionStatus(businessId, 'ERROR', errorMsg);

    auditStore.log({
      action: 'MERCADO_PAGO_CONNECTION_TEST',
      result: 'API_ERROR',
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      minimarketNewState: `Mode: ${targetMode} | Result: ERROR`,
      userId: options.testedBy || 'Administrador',
      errorDetails: `Fallo de verificación: ${errorMsg}`,
    });

    return {
      success: false,
      status: 'ERROR',
      message: errorMsg,
      mode: targetMode,
      testedAt,
    };
  }

  // 2. Validate essential identifiers
  if (!isTest) {
    if (!creds.userId || !creds.posId || !creds.externalPosId) {
      const errorMsg = 'Debe completar User ID, POS ID y External POS ID de producción.';
      tenantConfigStore.updateConnectionStatus(businessId, 'ERROR', errorMsg);
      return {
        success: false,
        status: 'ERROR',
        message: errorMsg,
        mode: targetMode,
        testedAt,
      };
    }
  }

  // 3. Ping Mercado Pago API safely (GET /users/me or /pos or /v1/payment_methods)
  const baseUrl = options.apiBaseUrl || process.env.MERCADOPAGO_API_BASE_URL || 'https://api.mercadopago.com';
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/users/me`;
  const timeoutMs = options.timeoutMs || 5000;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MiniMarket-POS-Verifier/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!response.ok) {
      let failureReason = `Error HTTP ${response.status} de Mercado Pago`;
      if (response.status === 401 || response.status === 403) {
        failureReason = 'Las credenciales de Mercado Pago no pudieron validarse (Token inválido o sin permisos suficientes).';
      }

      tenantConfigStore.updateConnectionStatus(businessId, 'ERROR', failureReason);

      auditStore.log({
        action: 'MERCADO_PAGO_CONNECTION_TEST',
        result: 'API_ERROR',
        isDuplicate: false,
        autoConfirmed: false,
        attempts: 1,
        minimarketNewState: `Mode: ${targetMode} | Result: ERROR (HTTP ${response.status})`,
        userId: options.testedBy || 'Administrador',
        errorDetails: failureReason,
      });

      return {
        success: false,
        status: 'ERROR',
        message: failureReason,
        mode: targetMode,
        testedAt,
      };
    }

    const userData = await response.json().catch(() => ({}));
    const validatedUserId = String(userData.id || creds.userId || '');

    const successMessage = isTest
      ? '✓ Mercado Pago conectado correctamente en Modo Prueba (Sandbox).'
      : '✓ Mercado Pago conectado correctamente en Modo Producción.';

    tenantConfigStore.updateConnectionStatus(businessId, 'CONNECTED', successMessage);

    auditStore.log({
      action: 'MERCADO_PAGO_CONNECTION_TEST',
      result: 'CONFIRMED',
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      minimarketNewState: `Mode: ${targetMode} | Result: SUCCESS`,
      userId: options.testedBy || 'Administrador',
      pos: creds.posId,
      store: creds.storeId,
      errorDetails: `Conexión verificada exitosamente para usuario ${validatedUserId}`,
    });

    return {
      success: true,
      status: 'CONNECTED',
      message: successMessage,
      mode: targetMode,
      userId: validatedUserId || creds.userId,
      posId: creds.posId,
      storeId: creds.storeId,
      externalPosId: creds.externalPosId,
      pointTerminalId: creds.pointTerminalId,
      pointModel: creds.pointModel,
      testedAt,
    };
  } catch (err: any) {
    clearTimeout(timer);

    let errorMsg = 'No se pudo verificar la integración con Mercado Pago.';
    if (err?.name === 'AbortError') {
      errorMsg = 'Tiempo de espera agotado al conectar con los servidores de Mercado Pago.';
    } else if (err?.message) {
      errorMsg = `No se pudo conectar con Mercado Pago: ${err.message}`;
    }

    tenantConfigStore.updateConnectionStatus(businessId, 'ERROR', errorMsg);

    auditStore.log({
      action: 'MERCADO_PAGO_CONNECTION_TEST',
      result: 'API_ERROR',
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      minimarketNewState: `Mode: ${targetMode} | Result: ERROR (Timeout/Network)`,
      userId: options.testedBy || 'Administrador',
      errorDetails: errorMsg,
    });

    return {
      success: false,
      status: 'ERROR',
      message: errorMsg,
      mode: targetMode,
      testedAt,
    };
  }
}
