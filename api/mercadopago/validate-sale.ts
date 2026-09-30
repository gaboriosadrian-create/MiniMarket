import { validateMercadoPagoSalePayment } from '../../server/mercadopago/saleValidator.js';
import { verifyAuthAndAuthorization } from '../../server/auth/authMiddleware.js';
import { checkRateLimit } from '../../src/lib/rateLimit.js';

function applyCors(req: any, res: any) {
  if (!res?.setHeader) return;
  const origin = req?.headers?.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-user-uid');
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  // Rate Limiting
  const clientIp = (req.headers?.['x-forwarded-for'] as string) || 'unknown';
  const limit = checkRateLimit(`validate_sale:${clientIp}`, 100, 60000);
  if (!limit.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes de validación. Por favor aguarde unos momentos.',
    });
  }

  const {
    externalReference,
    orderId,
    expectedAmount,
    businessId,
    posId,
    mercadoPagoSource,
  } = req.body || {};

  // Auth verification
  const cleanBiz = String(businessId || '').trim();
  const authResult = await verifyAuthAndAuthorization(req, cleanBiz);
  if (!authResult.ok) {
    return res.status(authResult.status || 401).json({
      success: false,
      status: authResult.code || 'UNAUTHORIZED',
      message: authResult.message || 'No autorizado',
    });
  }

  try {
    const validation = await validateMercadoPagoSalePayment({
      externalReference,
      orderId,
      expectedAmount: expectedAmount !== undefined ? Number(expectedAmount) : undefined,
      businessId: cleanBiz,
      posId,
      mercadoPagoSource,
    });

    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        valid: false,
        reason: validation.reason,
        code: validation.code,
      });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      order: validation.order,
    });
  } catch (err: any) {
    console.error('[MercadoPago Vercel validate-sale Error]:', err);
    return res.status(500).json({
      success: false,
      valid: false,
      reason: 'Error al validar el cobro en el servidor.',
      details: err?.message,
    });
  }
}

