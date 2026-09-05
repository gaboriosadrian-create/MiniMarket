import { orderRegistry, ActiveOrderRecord } from './orderRegistry.js';
import { getMercadoPagoConfig } from './config.js';
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
  status: 'processed' | 'opened' | 'waiting_payment' | 'failed' | 'expired' | 'PAYMENT_VERIFIED' | 'CONFIRMED' | 'WAITING_PAYMENT' | 'FAILED' | 'EXPIRED';
  paymentStatus: 'approved' | 'pending' | 'rejected' | 'expired' | 'unknown';
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

/**
 * Checks and actively synchronizes the status of an active Mercado Pago order.
 * 
 * Flow:
 * 1. Resolves order in local registry.
 * 2. If status is WAITING_PAYMENT and an orderId / API is available, actively queries Mercado Pago API.
 * 3. If orderId is not known, queries Mercado Pago by external_reference.
 * 4. Validates order, amounts, currency, and payment status server-side.
 * 5. Updates registry & audit store accordingly.
 * 6. Returns a clean, secure DTO containing no tokens or sensitive backend credentials.
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

  const config = customConfig || getMercadoPagoConfig(businessId);
  let orderRecord = orderRegistry.getOrder(cleanId);

  // Determine if active API query is needed
  const isAlreadyPaid = orderRecord?.status === 'PAYMENT_VERIFIED' || orderRecord?.status === 'CONFIRMED';

  if (config.enabled && config.accessToken && !isAlreadyPaid) {
    const mpOrderId = orderRecord?.orderId || (!cleanId.startsWith('MINIMARKET-') && /^\d+$/.test(cleanId) ? cleanId : undefined);
    const targetRef = orderRecord?.external_reference || (cleanId.startsWith('MINIMARKET-') ? cleanId : undefined);

    try {
      let fetchResult = mpOrderId
        ? await fetchMercadoPagoOrder(mpOrderId, config.accessToken, config.apiBaseUrl, 4000)
        : null;

      // If no orderId or 404, try querying by external_reference
      if ((!fetchResult || !fetchResult.ok) && targetRef) {
        fetchResult = await fetchMercadoPagoOrderByReference(targetRef, config.accessToken, config.apiBaseUrl, 4000);
      }

      if (fetchResult && fetchResult.ok && fetchResult.data) {
        const order = fetchResult.data;
        const expectedAmount = orderRecord?.total_amount || order.total_amount;
        const validation = validateMercadoPagoOrder(order, config, expectedAmount);

        if (validation.valid) {
          const mappedStatus = mapMercadoPagoOrderStatus(order);
          const approvedPayment = findApprovedPayment(order);
          const paymentId = approvedPayment?.id ? String(approvedPayment.id) : undefined;
          const ref = order.external_reference || targetRef || cleanId;

          if (mappedStatus === 'CONFIRMED') {
            const isAuto = Boolean(config.autoConfirm);
            const newStatus = isAuto ? 'CONFIRMED' : 'PAYMENT_VERIFIED';
            const verifiedAt = new Date().toISOString();

            orderRecord = orderRegistry.updateOrderStatus(ref, {
              orderId: String(order.id),
              paymentId,
              total_amount: order.total_amount || expectedAmount,
              status: newStatus,
              autoConfirmed: isAuto,
              verifiedAt,
              externalPosId: order.config?.qr?.external_pos_id,
              posId: order.config?.qr?.pos_id?.toString(),
            });

            // Idempotency log
            const idempotencyKey = idempotencyStore.generateKey(String(order.id), paymentId);
            if (!idempotencyStore.isProcessed(idempotencyKey)) {
              idempotencyStore.markProcessed({
                key: idempotencyKey,
                orderId: String(order.id),
                paymentId,
                external_reference: ref,
                processedAt: verifiedAt,
                resultStatus: newStatus,
                confirmed: isAuto,
                attempts: 1,
              });

              auditStore.log({
                orderId: String(order.id),
                paymentId,
                external_reference: ref,
                action: 'polling.sync_status',
                mpOrderStatus: order.status,
                mappedStatus,
                pos: order.config?.qr?.external_pos_id || order.config?.qr?.pos_id?.toString(),
                amount: order.total_amount || expectedAmount,
                currency: order.currency_id || 'ARS',
                result: isAuto ? 'CONFIRMED' : 'NO_AUTO_CONFIRM',
                isDuplicate: false,
                autoConfirmed: isAuto,
                attempts: 1,
                errorDetails: 'Pago verificado mediante polling server-side con API de Mercado Pago.',
              });
            }
          } else if (mappedStatus === 'FAILED') {
            orderRecord = orderRegistry.updateOrderStatus(ref, {
              orderId: String(order.id),
              status: 'FAILED',
              errorReason: 'Pago rechazado o cancelado en Mercado Pago',
            });
          } else if (mappedStatus === 'EXPIRED') {
            orderRecord = orderRegistry.updateOrderStatus(ref, {
              orderId: String(order.id),
              status: 'EXPIRED',
              errorReason: 'Orden expirada en Mercado Pago',
            });
          }
        }
      }
    } catch {
      // Non-blocking fallback to local record
    }
  }

  // If still not found in registry
  if (!orderRecord) {
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

  const isPaid = orderRecord.status === 'PAYMENT_VERIFIED' || orderRecord.status === 'CONFIRMED';
  const isFailed = orderRecord.status === 'FAILED';
  const isExpired = orderRecord.status === 'EXPIRED';

  let paymentStatus: 'approved' | 'pending' | 'rejected' | 'expired' | 'unknown' = 'pending';
  if (isPaid) paymentStatus = 'approved';
  else if (isFailed) paymentStatus = 'rejected';
  else if (isExpired) paymentStatus = 'expired';

  return {
    ok: true,
    success: true,
    found: true,
    orderId: orderRecord.orderId,
    external_reference: orderRecord.external_reference,
    status: orderRecord.status,
    paymentStatus,
    paid: isPaid,
    amount: orderRecord.total_amount,
    currency: 'ARS',
    paymentId: orderRecord.paymentId,
    autoConfirmed: orderRecord.autoConfirmed,
    verifiedAt: orderRecord.verifiedAt,
    mercadoPagoSource: orderRecord.mercadoPagoSource,
    order: orderRecord,
    message: isPaid ? 'Pago verificado' : isFailed ? 'Pago no acreditado' : isExpired ? 'QR vencido' : 'Esperando pago...',
  };
}
