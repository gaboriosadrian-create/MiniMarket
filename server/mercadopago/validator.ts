import { MercadoPagoOrder, MercadoPagoConfig } from './types.js';

export interface ValidationResult {
  valid: boolean;
  reason?: string;
  code?: string;
}

/**
 * Validates a Mercado Pago Order against security and business rules.
 */
export function validateMercadoPagoOrder(
  order: MercadoPagoOrder,
  config: MercadoPagoConfig,
  expectedAmount?: number
): ValidationResult {
  if (!order || typeof order !== 'object') {
    return {
      valid: false,
      reason: 'El objeto Order de Mercado Pago es nulo o inválido.',
      code: 'INVALID_ORDER_OBJECT',
    };
  }

  // 1. Order ID check
  if (!order.id || String(order.id).trim() === '') {
    return {
      valid: false,
      reason: 'Order ID ausente o vacío.',
      code: 'MISSING_ORDER_ID',
    };
  }

  // 2. Currency check (Must be ARS for Mercado Pago Argentina)
  const currency = (order.currency_id || '').toUpperCase().trim();
  if (currency && currency !== 'ARS' && currency !== 'MLA') {
    return {
      valid: false,
      reason: `Moneda inválida: "${currency}". Se requiere "ARS".`,
      code: 'INVALID_CURRENCY',
    };
  }

  // 3. User ID check (if both configured and returned in order)
  const orderUserId = order.user_id || (order as any).collector_id;
  if (config.userId && orderUserId) {
    const cleanOrderUserId = String(orderUserId).trim();
    const cleanConfigUserId = String(config.userId).trim();
    if (cleanOrderUserId !== cleanConfigUserId) {
      return {
        valid: false,
        reason: `El user_id de la orden (${cleanOrderUserId}) no coincide con la cuenta configurada (${cleanConfigUserId}).`,
        code: 'USER_ID_MISMATCH',
      };
    }
  }

  // 4. POS verification (if both configured and returned in QR config)
  const orderPosId = order.config?.qr?.external_pos_id || order.config?.qr?.pos_id;
  if (config.externalPosId && orderPosId) {
    const cleanOrderPos = String(orderPosId).trim();
    const cleanConfigPos = String(config.externalPosId).trim();
    const cleanConfigPosId = config.posId ? String(config.posId).trim() : null;

    if (cleanOrderPos !== cleanConfigPos && cleanOrderPos !== cleanConfigPosId) {
      return {
        valid: false,
        reason: `El POS de la orden (${cleanOrderPos}) no coincide con el configurado (${cleanConfigPos}).`,
        code: 'POS_MISMATCH',
      };
    }
  }

  // 5. External Reference check
  if (!order.external_reference || String(order.external_reference).trim() === '') {
    return {
      valid: false,
      reason: 'La orden no contiene un external_reference vinculante con MiniMarket.',
      code: 'MISSING_EXTERNAL_REFERENCE',
    };
  }

  // 6. Total Amount check
  const orderTotal = Number(order.total_amount !== undefined ? order.total_amount : (order as any).paid_amount);
  if (isNaN(orderTotal) || orderTotal < 0) {
    return {
      valid: false,
      reason: `Importe total de orden inválido: ${order.total_amount}`,
      code: 'INVALID_AMOUNT',
    };
  }

  // 7. Optional expected amount comparison
  if (typeof expectedAmount === 'number' && expectedAmount > 0) {
    // Allow slight float tolerance (0.05)
    if (Math.abs(orderTotal - expectedAmount) > 0.05) {
      return {
        valid: false,
        reason: `El total de la orden (${orderTotal}) no coincide con el importe esperado (${expectedAmount}).`,
        code: 'AMOUNT_MISMATCH',
      };
    }
  }

  return { valid: true };
}
