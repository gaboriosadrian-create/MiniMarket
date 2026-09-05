import { MercadoPagoOrder, MercadoPagoPayment, MappedOrderStatus } from './types.js';

/**
 * Checks if a specific payment item is approved / accredited in Mercado Pago.
 * Recognizes 'approved', 'processed', 'accredited', and detail 'accredited'/'approved'.
 */
export function isPaymentApproved(payment?: MercadoPagoPayment | null): boolean {
  if (!payment) return false;
  const status = (payment.status || '').toLowerCase().trim();
  const detail = (payment.status_detail || '').toLowerCase().trim();

  return (
    status === 'approved' ||
    status === 'processed' ||
    status === 'accredited' ||
    detail === 'accredited' ||
    detail === 'approved'
  );
}

/**
 * Checks if a payment is currently in an unconfirmed / in-process state.
 */
export function isPaymentPending(payment?: MercadoPagoPayment | null): boolean {
  if (!payment) return false;
  const status = (payment.status || '').toLowerCase().trim();
  const detail = (payment.status_detail || '').toLowerCase().trim();

  return (
    status === 'pending' ||
    status === 'in_process' ||
    status === 'opened' ||
    status === 'created' ||
    status === 'ready_to_process' ||
    detail === 'pending_waiting_payment' ||
    detail === 'waiting_payment'
  );
}

/**
 * Checks if a payment was definitively rejected, refunded or cancelled.
 */
export function isPaymentFailed(payment?: MercadoPagoPayment | null): boolean {
  if (!payment) return false;
  const status = (payment.status || '').toLowerCase().trim();

  return (
    status === 'rejected' ||
    status === 'cancelled' ||
    status === 'refunded' ||
    status === 'charged_back' ||
    status === 'failed'
  );
}

/**
 * Finds the accredited / approved payment object from an order, or fallback to the first payment.
 */
export function findApprovedPayment(order: MercadoPagoOrder): MercadoPagoPayment | undefined {
  if (!order || !Array.isArray(order.payments) || order.payments.length === 0) return undefined;
  return order.payments.find((p) => isPaymentApproved(p)) || order.payments[0];
}

/**
 * Maps a Mercado Pago Order and its payments to a unified MiniMarket status.
 * 
 * Rules:
 * - 'CONFIRMED': The order is 'processed'/'closed' OR order.status_detail is 'accredited'
 *                OR at least one associated payment is 'approved'/'processed'/'accredited'.
 * - 'PENDING': The order is 'opened'/'created'/'ready_to_process' or has a 'pending'/'in_process' payment.
 * - 'FAILED': The order is 'failed'/'cancelled' or all payments were rejected.
 * - 'EXPIRED': The order is explicitly 'expired'.
 * - 'UNKNOWN': Fallback for unrecognized states.
 */
export function mapMercadoPagoOrderStatus(order: MercadoPagoOrder): MappedOrderStatus {
  if (!order) return 'UNKNOWN';

  const orderStatus = (order.status || '').toLowerCase().trim();
  const orderDetail = (order.status_detail || '').toLowerCase().trim();

  // 1. Check associated payments first if present
  if (Array.isArray(order.payments) && order.payments.length > 0) {
    const hasApprovedPayment = order.payments.some((p) => isPaymentApproved(p));
    if (hasApprovedPayment) {
      return 'CONFIRMED';
    }

    const allRejectedOrCancelled = order.payments.every((p) => isPaymentFailed(p));
    if (allRejectedOrCancelled && (orderStatus === 'closed' || orderStatus === 'failed' || orderStatus === 'cancelled')) {
      return 'FAILED';
    }

    const hasPendingPayment = order.payments.some((p) => isPaymentPending(p));
    if (hasPendingPayment) {
      return 'PENDING';
    }
  }

  // 2. Evaluate top-level order status & details
  if (orderStatus === 'processed' || orderStatus === 'closed' || orderDetail === 'accredited' || orderDetail === 'approved') {
    return 'CONFIRMED';
  }

  if (orderStatus === 'opened' || orderStatus === 'created' || orderStatus === 'ready_to_process') {
    return 'PENDING';
  }

  if (orderStatus === 'failed' || orderStatus === 'cancelled') {
    return 'FAILED';
  }

  if (orderStatus === 'expired') {
    return 'EXPIRED';
  }

  return 'UNKNOWN';
}
