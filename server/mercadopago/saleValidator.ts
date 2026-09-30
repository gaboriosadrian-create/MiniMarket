import { resolveMercadoPagoOperation } from './statusChecker.js';
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
 * 1. Checks local in-memory registry or executes active query via resolveMercadoPagoOperation.
 * 2. Uses the exact same single-source-of-truth resolver as /api/mercadopago/order-status.
 * 3. Verifies payment accreditation, amounts, currency, and POS consistency against MP API.
 * 4. Ensures no false rejections occur on new references across instances or cold starts.
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

  // 1. Initial Diagnostic Input Log (No secrets)
  console.log('[validate-sale] external_reference recibido:', externalReference || 'no_provisto');
  console.log('[validate-sale] businessId recibido:', businessId || 'no_provisto');
  console.log('[validate-sale] orderId recibido:', orderId || 'no_provisto');
  console.log('[validate-sale] amount esperado:', expectedAmount !== undefined ? expectedAmount : 'no_provisto');

  // 2. Resolve operation using shared resolution engine
  const resolved = await resolveMercadoPagoOperation(ref, businessId, customConfig, expectedAmount);

  // Diagnostic Resolution Log (No secrets)
  console.log('[validate-sale] token runtime disponible:', resolved.tokenAvailable);
  console.log('[validate-sale] resultado de búsqueda por orderId:', resolved.searchByOrderIdResult || 'no_aplica');
  console.log('[validate-sale] resultado de búsqueda por external_reference:', resolved.searchByRefResult || 'no_aplica');
  console.log('[validate-sale] merchant_order_id encontrado:', resolved.merchantOrderId || 'no_encontrado');
  console.log('[validate-sale] payment_id encontrado:', resolved.paymentId || 'no_encontrado');
  console.log('[validate-sale] payment.status:', resolved.paymentStatus || 'no_encontrado');
  console.log('[validate-sale] payment.status_detail:', resolved.paymentStatusDetail || 'no_encontrado');
  console.log('[validate-sale] payment.amount:', resolved.amount !== undefined ? resolved.amount : 0);
  console.log('[validate-sale] identificador final utilizado para validar:', resolved.externalReference || ref);

  // 3. Verify existence in Mercado Pago or local store
  if (!resolved.found) {
    return {
      valid: false,
      reason: `No se encontró una orden de Mercado Pago registrada para "${ref}".`,
      code: 'ORDER_NOT_FOUND',
    };
  }

  // 4. Verify payment status is accredited
  if (!resolved.isPaid) {
    if (resolved.mappedStatus === 'FAILED' || resolved.paymentStatus === 'rejected' || resolved.paymentStatus === 'cancelled') {
      return {
        valid: false,
        reason: 'El pago de Mercado Pago fue rechazado o cancelado.',
        code: 'PAYMENT_REJECTED',
      };
    }
    if (resolved.mappedStatus === 'EXPIRED' || resolved.paymentStatus === 'expired') {
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

  // 5. Verify Amount
  const resolvedAmount = Number(resolved.amount || 0);
  if (typeof expectedAmount === 'number' && expectedAmount > 0) {
    if (isNaN(resolvedAmount) || Math.abs(resolvedAmount - expectedAmount) > 0.05) {
      return {
        valid: false,
        reason: `El importe verificado ($${resolvedAmount}) no coincide con el importe de la venta ($${expectedAmount}).`,
        code: 'AMOUNT_MISMATCH',
      };
    }
  }

  // 6. Verify Business ID if provided
  if (businessId && resolved.orderRecord?.businessId) {
    if (String(businessId).trim() !== String(resolved.orderRecord.businessId).trim()) {
      return {
        valid: false,
        reason: 'El comercio de la orden no coincide con el comercio actual.',
        code: 'BUSINESS_MISMATCH',
      };
    }
  }

  // 7. Verify POS ID if provided
  if (posId && (resolved.posId || resolved.externalPosId)) {
    const cleanPos = String(posId).trim();
    const oPos = String(resolved.posId || '').trim();
    const oExtPos = String(resolved.externalPosId || '').trim();
    if (cleanPos && (oPos || oExtPos) && cleanPos !== oPos && cleanPos !== oExtPos) {
      return {
        valid: false,
        reason: 'La caja/POS de la orden no coincide con el punto de venta.',
        code: 'POS_MISMATCH',
      };
    }
  }

  // 8. Construct validated order payload
  const validatedOrder = resolved.orderRecord || {
    external_reference: resolved.externalReference || ref,
    orderId: resolved.orderId || resolved.merchantOrderId,
    paymentId: resolved.paymentId,
    total_amount: resolvedAmount,
    status: 'PAYMENT_VERIFIED',
    autoConfirmed: false,
    verifiedAt: new Date().toISOString(),
    businessId,
    mercadoPagoSource: params.mercadoPagoSource || 'STATIC_POS_QR',
  };

  return {
    valid: true,
    order: validatedOrder,
  };
}

