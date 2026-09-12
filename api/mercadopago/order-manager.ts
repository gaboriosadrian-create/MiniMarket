import { cancelMercadoPagoOrder } from '../../server/mercadopago/orderService.js';
import { checkAndSyncOrderStatus } from '../../server/mercadopago/statusChecker.js';
import { verifyAuthAndAuthorization } from '../../server/auth/authMiddleware.js';

function applyCors(req: any, res: any) {
  if (!res?.setHeader) return;
  const origin = req?.headers?.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-user-uid');
}

/**
 * Vercel Serverless Function (Consolidated Order Manager):
 * Handles:
 * - /api/mercadopago/order-status (GET)
 * - /api/mercadopago/cancel-order (POST)
 */
export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  const subroute = req.query?.subroute || (
    req.url?.includes('/cancel-order') ? 'cancel-order' :
    req.url?.includes('/order-status') ? 'order-status' :
    (req.method === 'POST' ? 'cancel-order' : 'order-status')
  );

  // Subroute: 'cancel-order' (/api/mercadopago/cancel-order)
  if (subroute === 'cancel-order') {
    if (req.method !== 'POST') {
      res.setHeader?.('Allow', ['POST', 'OPTIONS']);
      return res.status(405).json({
        success: false,
        message: `Method ${req.method} Not Allowed`,
      });
    }

    const { externalReference, orderId, businessId } = req.body || {};

    // 1. Verify Authentication & Authorization
    const authResult = await verifyAuthAndAuthorization(req, businessId);
    if (!authResult.ok) {
      return res.status(authResult.status || 401).json({
        success: false,
        status: authResult.code || 'UNAUTHORIZED',
        message: authResult.message || 'No autorizado',
      });
    }

    try {
      const ref = String(externalReference || orderId || '').trim();
      const result = await cancelMercadoPagoOrder(ref, businessId);
      return res.status(200).json(result);
    } catch (err: any) {
      console.error('[MercadoPago Vercel cancel-order Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Error al cancelar la orden en Mercado Pago.',
      });
    }
  }

  // Subroute: 'order-status' (/api/mercadopago/order-status)
  if (req.method && req.method !== 'GET') {
    res.setHeader?.('Allow', ['GET']);
    return res.status(405).json({
      ok: false,
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  const reference = String(req.query?.external_reference || req.query?.ref || req.query?.order_id || '').trim();
  const businessId = String(req.query?.businessId || '').trim();

  if (!reference) {
    return res.status(400).json({
      ok: false,
      success: false,
      message: 'Se requiere external_reference u order_id',
    });
  }

  try {
    const statusResult = await checkAndSyncOrderStatus(reference, businessId || undefined);
    return res.status(200).json(statusResult);
  } catch (err: any) {
    console.error('[MercadoPago Vercel order-status Error]:', err);
    return res.status(500).json({
      ok: false,
      success: false,
      message: 'Error al consultar estado de orden',
      details: err?.message,
    });
  }
}
