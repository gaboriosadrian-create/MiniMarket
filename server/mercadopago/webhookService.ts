import { getMercadoPagoConfig } from './config.js';
import { fetchMercadoPagoOrder } from './client.js';
import { validateMercadoPagoOrder } from './validator.js';
import { mapMercadoPagoOrderStatus, findApprovedPayment, isPaymentApproved } from './statusMapper.js';
import { idempotencyStore } from './idempotency.js';
import { auditStore } from './auditStore.js';
import { orderRegistry } from './orderRegistry.js';
import { paymentProviderService } from './paymentProviderService.js';
import {
  MercadoPagoWebhookPayload,
  WebhookProcessResult,
  WebhookProcessStatus,
  MercadoPagoConfig,
} from './types.js';

/**
 * Extracts orderId from different webhook payloads and query formats supported by Mercado Pago.
 */
export function extractOrderId(payload: MercadoPagoWebhookPayload = {}, query: Record<string, any> = {}): string | null {
  // 1. payload.data.id
  if (payload?.data?.id !== undefined && payload.data.id !== null) {
    const idStr = String(payload.data.id).trim();
    if (idStr) return idStr;
  }

  // 2. query['data.id'] or query.id
  if (query['data.id']) {
    const idStr = String(query['data.id']).trim();
    if (idStr) return idStr;
  }
  if (query.id) {
    const idStr = String(query.id).trim();
    if (idStr) return idStr;
  }

  // 3. payload.id (when type === 'order' or action === 'order.processed')
  if (payload?.id !== undefined && payload.id !== null) {
    const idStr = String(payload.id).trim();
    if (idStr && (payload.type === 'order' || payload.action?.startsWith('order') || payload.type === 'merchant_order')) {
      return idStr;
    }
  }

  // 4. payload.resource (e.g. "/v1/orders/123456" or "/merchant_orders/123456")
  if (typeof payload?.resource === 'string') {
    const match = payload.resource.match(/(?:orders|merchant_orders)\/([0-9a-zA-Z_-]+)/);
    if (match && match[1]) {
      return match[1];
    }
  }

  // 5. query.topic === 'merchant_order' or 'order' or 'payment' with query.id
  if (query.topic === 'merchant_order' || query.topic === 'order' || query.topic === 'payment') {
    if (query.id) return String(query.id).trim();
  }

  return null;
}

/**
 * Main webhook processing service for Mercado Pago QR Orders.
 * 
 * Supports custom configuration injection for deterministic testing.
 */
export async function processMercadoPagoWebhook(
  payload: MercadoPagoWebhookPayload = {},
  query: Record<string, any> = {},
  headers: Record<string, any> = {},
  customConfig?: MercadoPagoConfig
): Promise<WebhookProcessResult> {
  // Anti-spoofing: Always prioritize verifiable payload user_id over untrusted query parameters
  const verifiedBusinessId = payload?.user_id ? paymentProviderService.findBusinessByPosOrUser({ userId: String(payload.user_id) }) : null;
  const resolvedBusinessId = verifiedBusinessId || query.businessId;
  const config = customConfig || getMercadoPagoConfig(resolvedBusinessId || undefined);
  const eventId = payload?.id || headers['x-request-id'] || headers['x-mp-signature'];

  // =========================================================================
  // 1. ESTADO 1: INTEGRACIÓN DESACTIVADA
  // =========================================================================
  if (!config.enabled) {
    auditStore.log({
      action: payload?.action || query?.action || 'webhook.received',
      topicOrType: payload?.type || query?.topic || 'order',
      result: 'DISABLED',
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      errorDetails: 'Integración Mercado Pago desactivada en servidor (MERCADOPAGO_ENABLED=false). Solicitud aceptada sin efectos.',
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        status: 'DISABLED',
        message: 'Mercado Pago integration is disabled. Event received without side effects.',
      },
    };
  }

  // =========================================================================
  // 2. EXTRAER ORDER ID
  // =========================================================================
  const orderId = extractOrderId(payload, query);

  if (!orderId) {
    const auditEntry = auditStore.log({
      action: payload?.action || 'unknown',
      topicOrType: payload?.type || 'unknown',
      result: 'INVALID_PAYLOAD',
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      errorDetails: 'No se pudo extraer un order_id válido del payload o query parameters del webhook.',
    });

    return {
      statusCode: 200,
      body: {
        success: false,
        status: 'INVALID_PAYLOAD',
        message: 'No valid order_id found in webhook payload',
        auditId: auditEntry.id,
      },
    };
  }

  // =========================================================================
  // 3. IDEMPOTENCIA PREVENTIVA
  // =========================================================================
  const idempotencyKey = idempotencyStore.generateKey(orderId, undefined, eventId ? String(eventId) : undefined);
  if (idempotencyStore.isProcessed(idempotencyKey)) {
    const prevRecord = idempotencyStore.getRecord(idempotencyKey);
    auditStore.log({
      orderId,
      external_reference: prevRecord?.external_reference,
      action: payload?.action || 'duplicate.event',
      result: 'DUPLICATE',
      isDuplicate: true,
      autoConfirmed: false,
      attempts: (prevRecord?.attempts || 1) + 1,
      errorDetails: `Evento duplicado para orden ${orderId}. Ya procesado previamente a las ${prevRecord?.processedAt}.`,
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        status: 'DUPLICATE',
        message: `Order ${orderId} has already been processed idempotently.`,
        orderId,
        external_reference: prevRecord?.external_reference,
        isDuplicate: true,
        confirmed: prevRecord?.confirmed || false,
      },
    };
  }

  // =========================================================================
  // 4. CONSULTA SERVER-SIDE DE LA ORDER (Fuente de verdad)
  // =========================================================================
  const fetchResult = await fetchMercadoPagoOrder(
    orderId,
    config.accessToken,
    config.apiBaseUrl
  );

  if (!fetchResult.ok || !fetchResult.data) {
    let resultStatus: WebhookProcessStatus = 'API_ERROR';
    if (fetchResult.status === 404) resultStatus = 'ORDER_NOT_FOUND';

    const auditEntry = auditStore.log({
      orderId,
      action: payload?.action,
      result: resultStatus,
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      errorDetails: `Error consultando orden en API de Mercado Pago (${fetchResult.status}): ${fetchResult.error}`,
    });

    return {
      statusCode: 200,
      body: {
        success: false,
        status: resultStatus,
        message: `Failed to fetch order ${orderId} from Mercado Pago: ${fetchResult.error}`,
        orderId,
        auditId: auditEntry.id,
      },
    };
  }

  const order = fetchResult.data;
  const approvedPayment = findApprovedPayment(order);
  const paymentId = approvedPayment?.id ? String(approvedPayment.id) : undefined;

  // =========================================================================
  // 5. VALIDACIONES DE SEGURIDAD
  // =========================================================================
  const registeredOrder = order.external_reference ? orderRegistry.getOrderByReference(order.external_reference) : undefined;
  const expectedAmount = registeredOrder?.total_amount;
  const validation = validateMercadoPagoOrder(order, config, expectedAmount);
  if (!validation.valid) {
    const auditEntry = auditStore.log({
      orderId,
      paymentId,
      external_reference: order.external_reference,
      action: payload?.action,
      mpOrderStatus: order.status,
      pos: order.config?.qr?.external_pos_id || order.config?.qr?.pos_id?.toString(),
      amount: order.total_amount,
      currency: order.currency_id,
      result: 'VALIDATION_FAILED',
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      errorDetails: `Fallo de validación de seguridad: ${validation.reason} [Código: ${validation.code}]`,
      rawOrderSummary: {
        id: order.id,
        status: order.status,
        paymentsCount: order.payments?.length || 0,
        approvedPaymentsCount: order.payments?.filter((p) => isPaymentApproved(p)).length || 0,
      },
    });

    return {
      statusCode: 200,
      body: {
        success: false,
        status: 'VALIDATION_FAILED',
        message: validation.reason || 'Order validation failed',
        orderId,
        external_reference: order.external_reference,
        auditId: auditEntry.id,
      },
    };
  }

  // =========================================================================
  // 6. MAPEO DE ESTADOS DE MERCADO PAGO
  // =========================================================================
  const mappedStatus = mapMercadoPagoOrderStatus(order);

  // =========================================================================
  // 7. ESTADO 2: AUTO-CONFIRMACIÓN DESACTIVADA (MERCADOPAGO_AUTO_CONFIRM=false)
  // =========================================================================
  if (!config.autoConfirm) {
    if (order.external_reference) {
      orderRegistry.updateOrderStatus(order.external_reference, {
        orderId: String(order.id),
        paymentId,
        total_amount: order.total_amount,
        status: mappedStatus === 'CONFIRMED' ? 'PAYMENT_VERIFIED' : mappedStatus === 'FAILED' ? 'FAILED' : mappedStatus === 'EXPIRED' ? 'EXPIRED' : 'WAITING_PAYMENT',
        autoConfirmed: false,
        verifiedAt: new Date().toISOString(),
        externalPosId: order.config?.qr?.external_pos_id,
        posId: order.config?.qr?.pos_id?.toString(),
      });
    }

    const auditEntry = auditStore.log({
      orderId,
      paymentId,
      external_reference: order.external_reference,
      action: payload?.action,
      mpOrderStatus: order.status,
      mappedStatus,
      pos: order.config?.qr?.external_pos_id || order.config?.qr?.pos_id?.toString(),
      amount: order.total_amount,
      currency: order.currency_id,
      result: 'NO_AUTO_CONFIRM',
      isDuplicate: false,
      autoConfirmed: false,
      attempts: 1,
      errorDetails: 'Orden validada correctamente, pero la auto-confirmación está desactivada (MERCADOPAGO_AUTO_CONFIRM=false). El vendedor continúa con el flujo manual.',
      rawOrderSummary: {
        id: order.id,
        status: order.status,
        paymentsCount: order.payments?.length || 0,
        approvedPaymentsCount: order.payments?.filter((p) => isPaymentApproved(p)).length || 0,
      },
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        status: 'NO_AUTO_CONFIRM',
        message: 'Order verified successfully. Auto-confirmation is disabled; manual POS operation remains active.',
        orderId,
        paymentId,
        external_reference: order.external_reference,
        confirmed: false,
        auditId: auditEntry.id,
      },
    };
  }

  // =========================================================================
  // 8. ESTADO 3: AUTO-CONFIRMACIÓN ACTIVADA (MERCADOPAGO_AUTO_CONFIRM=true)
  // =========================================================================
  if (mappedStatus === 'CONFIRMED') {
    if (order.external_reference) {
      orderRegistry.updateOrderStatus(order.external_reference, {
        orderId: String(order.id),
        paymentId,
        total_amount: order.total_amount,
        status: 'CONFIRMED',
        autoConfirmed: true,
        verifiedAt: new Date().toISOString(),
        externalPosId: order.config?.qr?.external_pos_id,
        posId: order.config?.qr?.pos_id?.toString(),
      });
    }
    // Mark idempotency key to protect against future duplicate webhook calls
    idempotencyStore.markProcessed({
      key: idempotencyKey,
      orderId,
      paymentId,
      external_reference: order.external_reference,
      processedAt: new Date().toISOString(),
      resultStatus: 'CONFIRMED',
      confirmed: true,
      attempts: 1,
    });

    if (paymentId) {
      const paymentKey = idempotencyStore.generateKey(undefined, paymentId);
      idempotencyStore.markProcessed({
        key: paymentKey,
        orderId,
        paymentId,
        external_reference: order.external_reference,
        processedAt: new Date().toISOString(),
        resultStatus: 'CONFIRMED',
        confirmed: true,
        attempts: 1,
      });
    }

    const auditEntry = auditStore.log({
      orderId,
      paymentId,
      external_reference: order.external_reference,
      action: payload?.action,
      mpOrderStatus: order.status,
      mappedStatus: 'CONFIRMED',
      minimarketPreviousState: 'PENDING',
      minimarketNewState: 'COMPLETED',
      pos: order.config?.qr?.external_pos_id || order.config?.qr?.pos_id?.toString(),
      amount: order.total_amount,
      currency: order.currency_id,
      result: 'CONFIRMED',
      isDuplicate: false,
      autoConfirmed: true,
      attempts: 1,
      rawOrderSummary: {
        id: order.id,
        status: order.status,
        paymentsCount: order.payments?.length || 0,
        approvedPaymentsCount: order.payments?.filter((p) => isPaymentApproved(p)).length || 0,
      },
    });

    return {
      statusCode: 200,
      body: {
        success: true,
        status: 'CONFIRMED',
        message: 'Order verified and auto-confirmed successfully.',
        orderId,
        paymentId,
        external_reference: order.external_reference,
        confirmed: true,
        auditId: auditEntry.id,
      },
    };
  }

  // Handle other states (PENDING, FAILED, EXPIRED, UNKNOWN)
  let nonConfirmedResult: WebhookProcessStatus = 'ORDER_PENDING';
  if (mappedStatus === 'FAILED') nonConfirmedResult = 'ORDER_FAILED';
  if (mappedStatus === 'EXPIRED') nonConfirmedResult = 'ORDER_EXPIRED';

  const auditEntry = auditStore.log({
    orderId,
    paymentId,
    external_reference: order.external_reference,
    action: payload?.action,
    mpOrderStatus: order.status,
    mappedStatus,
    pos: order.config?.qr?.external_pos_id || order.config?.qr?.pos_id?.toString(),
    amount: order.total_amount,
    currency: order.currency_id,
    result: nonConfirmedResult,
    isDuplicate: false,
    autoConfirmed: false,
    attempts: 1,
    rawOrderSummary: {
      id: order.id,
      status: order.status,
      paymentsCount: order.payments?.length || 0,
      approvedPaymentsCount: order.payments?.filter((p) => p.status === 'approved').length || 0,
    },
  });

  return {
    statusCode: 200,
    body: {
      success: true,
      status: nonConfirmedResult,
      message: `Order status is ${mappedStatus}. Operation not confirmed.`,
      orderId,
      paymentId,
      external_reference: order.external_reference,
      confirmed: false,
      auditId: auditEntry.id,
    },
  };
}
