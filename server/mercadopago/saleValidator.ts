import { orderRegistry } from './orderRegistry.js';
import { getMercadoPagoConfig } from './config.js';
import { fetchMercadoPagoOrder, fetchMercadoPagoOrderByReference } from './client.js';
import { validateMercadoPagoOrder } from './validator.js';
import { mapMercadoPagoOrderStatus, findApprovedPayment } from './statusMapper.js';
import { auditStore } from './auditStore.js';
import { idempotencyStore } from './idempotency.js';
import { MercadoPagoConfig, MercadoPagoSource } from './types.js';

export interface ValidateSalePaymentParams {
  externalReference?: string;
  orderId?: string;
  expectedAmount?: number;
  businessId?: string;
  posId?: string;
  mercadoPagoSource?: MercadoPagoSource;
}

export interface SalePaymentValidationResult {
  valid: boolean;
  reason?: string;
  code?: string;
  order?: any;
}

/**
 * Validates that an online Mercado Pago payment is legitimately verified and paid
 * before a sale can be confirmed or written into the database.
 * 
 * Serverless Architecture Resiliency:
 * 1. Checks local in-memory registry. If already verified, validates amounts & IDs.
 * 2. If not found in memory (or still in WAITING_PAYMENT), executes a direct fallback
 *    query to Mercado Pago API using external_reference or orderId.
 * 3. Verifies payment accreditation, amounts, currency, and POS consistency against MP API.
 * 4. Ensures no false rejections occur when validate-sale runs on a different Lambda instance.
 */
export async function validateMercadoPagoSalePayment(
  params: ValidateSalePaymentParams,
  customConfig?: MercadoPagoConfig
): Promise<SalePaymentValidationResult> {
  const { externalReference, orderId, expectedAmount, businessId, posId } = params;

  const ref = (externalReference || orderId || '').trim();
  if (!ref) {
    return {
      valid: false,
      reason: 'No se proporcionó una referencia de orden de Mercado Pago.',
      code: 'MISSING_REFERENCE',
    };
  }

  // 1. Check order in local registry
  let orderRecord = orderRegistry.getOrder(ref) || (orderId ? orderRegistry.getOrderByOrderId(orderId) : undefined);

  // 2. If already verified/confirmed in memory, validate directly
  if (orderRecord && (orderRecord.status === 'PAYMENT_VERIFIED' || orderRecord.status === 'CONFIRMED')) {
    // Validate Amount
    if (typeof expectedAmount === 'number' && expectedAmount > 0) {
      const orderTotal = Number(orderRecord.total_amount);
      if (isNaN(orderTotal) || Math.abs(orderTotal - expectedAmount) > 0.05) {
        return {
          valid: false,
          reason: `El importe verificado ($${orderTotal}) no coincide con el importe de la venta ($${expectedAmount}).`,
          code: 'AMOUNT_MISMATCH',
        };
      }
    }

    // Validate Business ID if provided
    if (businessId && orderRecord.businessId) {
      if (String(businessId).trim() !== String(orderRecord.businessId).trim()) {
        return {
          valid: false,
          reason: 'El comercio de la orden no coincide con el comercio actual.',
          code: 'BUSINESS_MISMATCH',
        };
      }
    }

    // Validate POS ID if provided
    if (posId && (orderRecord.posId || orderRecord.externalPosId)) {
      const cleanPos = String(posId).trim();
      const recPos = String(orderRecord.posId || '').trim();
      const recExtPos = String(orderRecord.externalPosId || '').trim();
      if (cleanPos !== recPos && cleanPos !== recExtPos) {
        return {
          valid: false,
          reason: 'La caja/POS de la orden no coincide con el punto de venta.',
          code: 'POS_MISMATCH',
        };
      }
    }

    return {
      valid: true,
      order: orderRecord,
    };
  }

  // If order is explicitly expired or failed in memory and no API fallback needed
  if (orderRecord && orderRecord.status === 'EXPIRED') {
    return {
      valid: false,
      reason: 'La orden de Mercado Pago ha expirado.',
      code: 'ORDER_EXPIRED',
    };
  }
  if (orderRecord && orderRecord.status === 'FAILED') {
    return {
      valid: false,
      reason: 'El pago de Mercado Pago fue rechazado o cancelado.',
      code: 'PAYMENT_REJECTED',
    };
  }

  // 3. Fallback to Mercado Pago API (handles Serverless instances without shared RAM)
  const config = customConfig || getMercadoPagoConfig(businessId);
  if (config.enabled && config.accessToken) {
    const mpOrderId = orderRecord?.orderId || (orderId && /^\d+$/.test(orderId) ? orderId : (!ref.startsWith('MINIMARKET-') && /^\d+$/.test(ref) ? ref : undefined));
    const targetRef = orderRecord?.external_reference || externalReference || (ref.startsWith('MINIMARKET-') ? ref : undefined);

    try {
      let fetchResult = mpOrderId
        ? await fetchMercadoPagoOrder(mpOrderId, config.accessToken, config.apiBaseUrl, 4000)
        : null;

      if ((!fetchResult || !fetchResult.ok) && targetRef) {
        fetchResult = await fetchMercadoPagoOrderByReference(targetRef, config.accessToken, config.apiBaseUrl, 4000);
      }

      if (fetchResult && fetchResult.ok && fetchResult.data) {
        const order = fetchResult.data;
        const valExpectedAmount = expectedAmount || orderRecord?.total_amount;
        const validation = validateMercadoPagoOrder(order, config, valExpectedAmount);

        if (!validation.valid) {
          return {
            valid: false,
            reason: validation.reason,
            code: validation.code,
          };
        }

        const mappedStatus = mapMercadoPagoOrderStatus(order);
        const approvedPayment = findApprovedPayment(order);
        const paymentId = approvedPayment?.id ? String(approvedPayment.id) : undefined;
        const resolvedRef = order.external_reference || targetRef || ref;

        if (mappedStatus !== 'CONFIRMED' || !approvedPayment) {
          if (mappedStatus === 'FAILED') {
            return {
              valid: false,
              reason: 'El pago de Mercado Pago fue rechazado o cancelado.',
              code: 'PAYMENT_REJECTED',
            };
          }
          if (mappedStatus === 'EXPIRED') {
            return {
              valid: false,
              reason: 'La orden de Mercado Pago ha expirado.',
              code: 'ORDER_EXPIRED',
            };
          }
          return {
            valid: false,
            reason: 'El pago de Mercado Pago todavía está pendiente de pago por el comprador.',
            code: 'PAYMENT_PENDING',
          };
        }

        // Amount Check
        const orderTotal = Number(order.total_amount !== undefined ? order.total_amount : (order as any).paid_amount);
        if (typeof expectedAmount === 'number' && expectedAmount > 0) {
          if (isNaN(orderTotal) || Math.abs(orderTotal - expectedAmount) > 0.05) {
            return {
              valid: false,
              reason: `El importe verificado ($${orderTotal}) no coincide con el importe de la venta ($${expectedAmount}).`,
              code: 'AMOUNT_MISMATCH',
            };
          }
        }

        // POS Check if provided
        const orderPos = order.config?.qr?.external_pos_id || order.config?.qr?.pos_id?.toString();
        if (posId && orderPos) {
          const cleanPos = String(posId).trim();
          const oPos = String(orderPos).trim();
          const oPosId = String(order.config?.qr?.pos_id || '').trim();
          const oExtPos = String(order.config?.qr?.external_pos_id || '').trim();
          if (cleanPos !== oPos && cleanPos !== oPosId && cleanPos !== oExtPos) {
            return {
              valid: false,
              reason: 'La caja/POS de la orden no coincide con el punto de venta.',
              code: 'POS_MISMATCH',
            };
          }
        }

        // Synchronize in registry for this instance
        const isAuto = Boolean(config.autoConfirm);
        const newStatus = isAuto ? 'CONFIRMED' : 'PAYMENT_VERIFIED';
        const verifiedAt = new Date().toISOString();

        const updatedRecord = orderRegistry.updateOrderStatus(resolvedRef, {
          orderId: String(order.id),
          paymentId,
          total_amount: orderTotal,
          status: newStatus,
          autoConfirmed: isAuto,
          verifiedAt,
          externalPosId: order.config?.qr?.external_pos_id,
          posId: order.config?.qr?.pos_id?.toString(),
          businessId,
          mercadoPagoSource: params.mercadoPagoSource || 'STATIC_POS_QR',
        });

        // Log to idempotency & audit stores
        const idempotencyKey = idempotencyStore.generateKey(String(order.id), paymentId);
        if (!idempotencyStore.isProcessed(idempotencyKey)) {
          idempotencyStore.markProcessed({
            key: idempotencyKey,
            orderId: String(order.id),
            paymentId,
            external_reference: resolvedRef,
            processedAt: verifiedAt,
            resultStatus: newStatus,
            confirmed: isAuto,
            attempts: 1,
          });

          auditStore.log({
            orderId: String(order.id),
            paymentId,
            external_reference: resolvedRef,
            action: 'validate_sale.fallback_sync',
            mpOrderStatus: order.status,
            mappedStatus,
            pos: order.config?.qr?.external_pos_id || order.config?.qr?.pos_id?.toString(),
            amount: orderTotal,
            currency: order.currency_id || 'ARS',
            result: isAuto ? 'CONFIRMED' : 'NO_AUTO_CONFIRM',
            isDuplicate: false,
            autoConfirmed: isAuto,
            attempts: 1,
            errorDetails: 'Pago validado mediante fallback directo a API de Mercado Pago en validate-sale.',
          });
        }

        return {
          valid: true,
          order: updatedRecord || {
            external_reference: resolvedRef,
            orderId: String(order.id),
            paymentId,
            total_amount: orderTotal,
            status: newStatus,
            autoConfirmed: isAuto,
            verifiedAt,
            businessId,
            mercadoPagoSource: params.mercadoPagoSource || 'STATIC_POS_QR',
          },
        };
      }
    } catch (err) {
      console.error('[validateMercadoPagoSalePayment API fallback error]:', err);
    }
  }

  // 4. If order was in local registry with WAITING_PAYMENT but API didn't confirm payment
  if (orderRecord && orderRecord.status === 'WAITING_PAYMENT') {
    return {
      valid: false,
      reason: 'El pago de Mercado Pago todavía está pendiente de pago por el comprador.',
      code: 'PAYMENT_PENDING',
    };
  }

  // 5. If not found anywhere
  return {
    valid: false,
    reason: `No se encontró una orden de Mercado Pago registrada para "${ref}".`,
    code: 'ORDER_NOT_FOUND',
  };
}
