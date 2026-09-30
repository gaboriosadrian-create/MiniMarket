import { orderRegistry, ActiveOrderRecord } from './orderRegistry.js';
import { tenantConfigStore } from './tenantConfigStore.js';
import { fetchMercadoPagoOrder, fetchMercadoPagoOrderByReference } from './client.js';
import { validateMercadoPagoOrder } from './validator.js';
import { mapMercadoPagoOrderStatus, findApprovedPayment, isPaymentApproved } from './statusMapper.js';
import { auditStore } from './auditStore.js';
import { idempotencyStore } from './idempotency.js';
import { MercadoPagoConfig, MercadoPagoSource } from './types.js';

export interface CleanOrderStatusResponse {
  ok: boolean;
  success: boolean;
  found: boolean;
  orderId?: string;
  external_reference?: string;
  status: 'processed' | 'opened' | 'waiting_payment' | 'failed' | 'expired' | 'PAYMENT_VERIFIED' | 'CONFIRMED' | 'PAID' | 'WAITING_PAYMENT' | 'FAILED' | 'EXPIRED' | string;
  paymentStatus: 'approved' | 'processed' | 'accredited' | 'pending' | 'rejected' | 'expired' | 'unknown' | string;
  paid: boolean;
  amount: number;
  currency: string;
  paymentId?: string;
  autoConfirmed: boolean;
  verifiedAt?: string;
  mercadoPagoSource?: MercadoPagoSource;
  order?: ActiveOrderRecord;
  message?: string;
}

export interface ResolvedMercadoPagoOperation {
  found: boolean;
  orderId?: string;
  merchantOrderId?: string;
  paymentId?: string;
  paymentStatus?: string;
  paymentStatusDetail?: string;
  amount?: number;
  currency?: string;
  isPaid: boolean;
  mappedStatus?: string;
  externalReference?: string;
  posId?: string;
  externalPosId?: string;
  orderRecord?: ActiveOrderRecord;
  rawOrder?: any;
  errorReason?: string;
  errorCode?: string;
  tokenAvailable: boolean;
  searchByOrderIdResult?: string;
  searchByRefResult?: string;
}

/**
 * Core unified function to resolve any Mercado Pago operation by external_reference or order_id.
 * Used by both order-status and validate-sale to guarantee 100% consistent resolution.
 */
export async function resolveMercadoPagoOperation(
  identifier: string,
  businessId?: string,
  customConfig?: MercadoPagoConfig,
  expectedAmount?: number
): Promise<ResolvedMercadoPagoOperation> {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) {
    return {
      found: false,
      isPaid: false,
      tokenAvailable: false,
      errorReason: 'Identificador no provisto',
      errorCode: 'MISSING_IDENTIFIER',
    };
  }

  // 1. Resolve runtime config
  const config = customConfig || (await tenantConfigStore.getActiveRuntimeConfigAsync(businessId));
  const testEnvToken = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim() || '';
  if ((!config.accessToken || config.accessToken.includes('test-token')) && testEnvToken) {
    config.accessToken = testEnvToken;
  }

  const tokenAvailable = Boolean(config.accessToken);

  let orderRecord = orderRegistry.getOrder(cleanId) || orderRegistry.getOrderByOrderId(cleanId);
  const isAlreadyPaid = orderRecord?.status === 'PAYMENT_VERIFIED' || orderRecord?.status === 'CONFIRMED';

  let orderIdFound: string | undefined = orderRecord?.orderId;
  let merchantOrderIdFound: string | undefined = undefined;
  let paymentIdFound: string | undefined = orderRecord?.paymentId;
  let paymentStatusFound: string | undefined = undefined;
  let paymentStatusDetailFound: string | undefined = undefined;
  let paymentAmountFound: number | undefined = orderRecord?.total_amount;
  let isPaid = isAlreadyPaid;
  let mappedStatusFound: string | undefined = orderRecord?.status;
  let searchByOrderIdResult = 'no_ejecutado';
  let searchByRefResult = 'no_ejecutado';
  let rawOrderFound: any = undefined;
  let resolvedExtRef: string | undefined = orderRecord?.external_reference || (cleanId.startsWith('MINIMARKET-') ? cleanId : undefined);
  let posIdFound: string | undefined = orderRecord?.posId;
  let externalPosIdFound: string | undefined = orderRecord?.externalPosId;

  if (config.accessToken) {
    const isExplicitOrderId = !cleanId.startsWith('MINIMARKET-') && (/^ORD/i.test(cleanId) || /^\d+$/.test(cleanId));
    const mpOrderId = orderRecord?.orderId || (isExplicitOrderId ? cleanId : undefined);
    const targetRef = cleanId.startsWith('MINIMARKET-') ? cleanId : orderRecord?.external_reference;

    try {
      let fetchResult: any = null;
      if (mpOrderId) {
        fetchResult = await fetchMercadoPagoOrder(mpOrderId, config.accessToken, config.apiBaseUrl, 4000);
        searchByOrderIdResult = fetchResult?.ok ? 'encontrado' : `fallo_http_${fetchResult?.status || 'error'}`;
      } else {
        searchByOrderIdResult = 'no_aplica';
      }

      // If no orderId or 404/failure, query by external_reference
      if ((!fetchResult || !fetchResult.ok) && (targetRef || cleanId)) {
        const queryRef = targetRef || cleanId;
        fetchResult = await fetchMercadoPagoOrderByReference(queryRef, config.accessToken, config.apiBaseUrl, 4000);
        searchByRefResult = fetchResult?.ok ? 'encontrado' : `fallo_http_${fetchResult?.status || 'error'}`;
      }

      if (fetchResult && fetchResult.ok && fetchResult.data) {
        const order = fetchResult.data;
        rawOrderFound = order;
        const rawId = String(order.id || '');
        if (/^ORD/i.test(rawId)) {
          orderIdFound = rawId;
        } else {
          merchantOrderIdFound = rawId;
        }

        resolvedExtRef = order.external_reference || resolvedExtRef || cleanId;
        posIdFound = order.config?.qr?.pos_id?.toString() || posIdFound;
        externalPosIdFound = order.config?.qr?.external_pos_id || externalPosIdFound;

        const valExpectedAmount = expectedAmount || orderRecord?.total_amount;
        const validation = validateMercadoPagoOrder(order, config, valExpectedAmount);

        if (validation.valid) {
          const mappedStatus = mapMercadoPagoOrderStatus(order);
          mappedStatusFound = mappedStatus;
          const approvedPayment = findApprovedPayment(order);

          if (approvedPayment) {
            paymentIdFound = approvedPayment.reference_id
              ? String(approvedPayment.reference_id)
              : (approvedPayment.id ? String(approvedPayment.id) : undefined);
            paymentStatusFound = approvedPayment.status ? String(approvedPayment.status).toLowerCase() : undefined;
            paymentStatusDetailFound = approvedPayment.status_detail ? String(approvedPayment.status_detail).toLowerCase() : undefined;
            const rawAmt = approvedPayment.paid_amount !== undefined
              ? approvedPayment.paid_amount
              : (approvedPayment.transaction_amount !== undefined ? approvedPayment.transaction_amount : approvedPayment.amount);
            if (rawAmt !== undefined && rawAmt !== null) {
              paymentAmountFound = Number(rawAmt);
            }
          }

          if (paymentAmountFound === undefined) {
            const rawOrderAmt = order.total_paid_amount !== undefined
              ? order.total_paid_amount
              : (order.total_amount !== undefined ? order.total_amount : order.paid_amount);
            if (rawOrderAmt !== undefined && rawOrderAmt !== null) {
              paymentAmountFound = Number(rawOrderAmt);
            }
          }

          const isPaymentAppr = isPaymentApproved(approvedPayment);
          const isOrderPaidStatus = order.status === 'processed' || order.status === 'closed' || order.status === 'paid' || order.order_status === 'paid' || order.status_detail === 'accredited';

          if (mappedStatus === 'CONFIRMED' || isPaymentAppr || isOrderPaidStatus) {
            isPaid = true;
            const isAuto = Boolean(config.autoConfirm);
            const newStatus = isAuto ? 'CONFIRMED' : 'PAYMENT_VERIFIED';
            const verifiedAt = new Date().toISOString();
            const ref = resolvedExtRef || cleanId;

            orderRecord = orderRegistry.updateOrderStatus(ref, {
              orderId: rawId || orderIdFound || merchantOrderIdFound,
              paymentId: paymentIdFound,
              total_amount: paymentAmountFound || orderRecord?.total_amount || 0,
              status: newStatus,
              autoConfirmed: isAuto,
              verifiedAt,
              externalPosId: externalPosIdFound,
              posId: posIdFound,
              businessId,
            });

            // Idempotency audit log
            const idempotencyKey = idempotencyStore.generateKey(rawId, paymentIdFound);
            if (!idempotencyStore.isProcessed(idempotencyKey)) {
              idempotencyStore.markProcessed({
                key: idempotencyKey,
                orderId: rawId,
                paymentId: paymentIdFound,
                external_reference: ref,
                processedAt: verifiedAt,
                resultStatus: newStatus,
                confirmed: isAuto,
                attempts: 1,
              });

              auditStore.log({
                orderId: rawId,
                paymentId: paymentIdFound,
                external_reference: ref,
                action: 'polling.sync_status',
                mpOrderStatus: order.status,
                mappedStatus,
                pos: externalPosIdFound || posIdFound,
                amount: paymentAmountFound || 0,
                currency: order.currency || order.currency_id || 'ARS',
                result: isAuto ? 'CONFIRMED' : 'NO_AUTO_CONFIRM',
                isDuplicate: false,
                autoConfirmed: isAuto,
                attempts: 1,
                errorDetails: 'Pago verificado mediante sincronización server-side con API de Mercado Pago.',
              });
            }
          } else if (mappedStatus === 'FAILED') {
            const ref = resolvedExtRef || cleanId;
            orderRecord = orderRegistry.updateOrderStatus(ref, {
              orderId: rawId,
              status: 'FAILED',
              errorReason: 'Pago rechazado o cancelado en Mercado Pago',
            });
          } else if (mappedStatus === 'EXPIRED') {
            const ref = resolvedExtRef || cleanId;
            orderRecord = orderRegistry.updateOrderStatus(ref, {
              orderId: rawId,
              status: 'EXPIRED',
              errorReason: 'Orden expirada en Mercado Pago',
            });
          }
        }
      }
    } catch (err: any) {
      // Non-blocking fallback
    }
  }

  const found = Boolean(orderRecord || rawOrderFound);

  return {
    found,
    orderId: orderIdFound,
    merchantOrderId: merchantOrderIdFound,
    paymentId: paymentIdFound || orderRecord?.paymentId,
    paymentStatus: paymentStatusFound || (isPaid ? 'approved' : (orderRecord?.status === 'WAITING_PAYMENT' ? 'pending' : undefined)),
    paymentStatusDetail: paymentStatusDetailFound || (isPaid ? 'accredited' : undefined),
    amount: paymentAmountFound !== undefined ? paymentAmountFound : (orderRecord?.total_amount || 0),
    currency: rawOrderFound?.currency || rawOrderFound?.currency_id || 'ARS',
    isPaid,
    mappedStatus: mappedStatusFound || orderRecord?.status,
    externalReference: resolvedExtRef || cleanId,
    posId: posIdFound,
    externalPosId: externalPosIdFound,
    orderRecord,
    rawOrder: rawOrderFound,
    tokenAvailable,
    searchByOrderIdResult,
    searchByRefResult,
  };
}

/**
 * Checks and actively synchronizes the status of an active Mercado Pago order.
 * 
 * Flow:
 * 1. Resolves active runtime config (async from Firestore / tokens).
 * 2. In TEST mode, ensures valid fallback token is active.
 * 3. Actively queries Mercado Pago by order_id (if known) or by external_reference (merchant_orders search).
 * 4. Recognizes both 'approved' and 'processed' with status_detail 'accredited'/'approved'.
 * 5. Updates local registry and idempotency audit store.
 * 6. Emits non-sensitive debug logs for troubleshooting.
 */
export async function checkAndSyncOrderStatus(
  identifier: string,
  businessId?: string,
  customConfig?: MercadoPagoConfig
): Promise<CleanOrderStatusResponse> {
  const cleanId = String(identifier || '').trim();
  if (!cleanId) {
    return {
      ok: false,
      success: false,
      found: false,
      status: 'WAITING_PAYMENT',
      paymentStatus: 'unknown',
      paid: false,
      amount: 0,
      currency: 'ARS',
      autoConfirmed: false,
      message: 'Identificador de orden no provisto',
    };
  }

  const resolved = await resolveMercadoPagoOperation(cleanId, businessId, customConfig);

  // Requested temporary execution log (no secrets)
  console.log('[order-status] external_reference:', cleanId);
  console.log('[order-status] order_id encontrado:', resolved.orderId || 'no_encontrado');
  console.log('[order-status] merchant_order_id encontrado:', resolved.merchantOrderId || 'no_encontrado');
  console.log('[order-status] payment_id encontrado:', resolved.paymentId || 'no_encontrado');
  console.log('[order-status] payment.status:', resolved.paymentStatus || (resolved.isPaid ? 'processed' : 'pending'));
  console.log('[order-status] payment.status_detail:', resolved.paymentStatusDetail || (resolved.isPaid ? 'accredited' : 'waiting_payment'));
  console.log('[order-status] payment.amount:', resolved.amount !== undefined ? resolved.amount : 0);
  console.log('[order-status] resultado final paid:', resolved.isPaid);

  if (!resolved.found && !resolved.isPaid) {
    return {
      ok: true,
      success: true,
      found: false,
      external_reference: cleanId,
      status: 'WAITING_PAYMENT',
      paymentStatus: 'pending',
      paid: false,
      amount: 0,
      currency: 'ARS',
      autoConfirmed: false,
      message: 'Esperando pago...',
    };
  }

  const effectiveStatus = resolved.isPaid ? 'PAID' : (resolved.orderRecord?.status || 'WAITING_PAYMENT');
  const effectivePaymentStatus = resolved.paymentStatus || (resolved.isPaid ? 'processed' : 'pending');

  return {
    ok: true,
    success: true,
    found: true,
    external_reference: resolved.externalReference || cleanId,
    status: effectiveStatus,
    paymentStatus: effectivePaymentStatus,
    paid: resolved.isPaid,
    amount: resolved.amount || 0,
    currency: resolved.currency || 'ARS',
    paymentId: resolved.paymentId,
    orderId: resolved.orderId || resolved.merchantOrderId || resolved.orderRecord?.orderId,
    autoConfirmed: resolved.isPaid && Boolean(resolved.orderRecord?.autoConfirmed),
    verifiedAt: resolved.orderRecord?.verifiedAt || new Date().toISOString(),
    mercadoPagoSource: resolved.orderRecord?.mercadoPagoSource,
    order: resolved.orderRecord,
    message: resolved.isPaid ? 'Pago verificado' : 'Esperando pago...',
  };
}
