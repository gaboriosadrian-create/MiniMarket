import { paymentProviderService } from '../../server/mercadopago/paymentProviderService.js';
import { verifyAuthAndAuthorization } from '../../server/auth/authMiddleware.js';
import { checkRateLimit } from '../../src/lib/rateLimit.js';

function applyCors(req: any, res: any) {
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

/**
 * Vercel Serverless Function: POST /api/mercadopago/disconnect
 * Disconnects a merchant tenant from Mercado Pago securely.
 */
export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  // Rate Limiting
  const clientIp = (req.headers?.['x-forwarded-for'] as string) || 'unknown';
  const limit = checkRateLimit(`disconnect:${clientIp}`, 20, 60000);
  if (!limit.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes. Por favor, reintente en unos instantes.',
    });
  }

  try {
    const businessId = String(req.body?.businessId || req.query?.businessId || '').trim();
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'businessId es requerido para desconectar Mercado Pago.',
      });
    }

    // Verify Admin/SuperAdmin
    const authResult = await verifyAuthAndAuthorization(req, businessId, { requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
    if (!authResult.ok) {
      return res.status(authResult.status || 401).json({
        success: false,
        status: authResult.code || 'UNAUTHORIZED',
        message: authResult.message || 'No autorizado',
      });
    }

    const result = await paymentProviderService.disconnectBusinessAsync(businessId);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[MercadoPago Vercel Disconnect Error]:', err);
    return res.status(500).json({
      success: false,
      message: err?.message || 'Error al desconectar Mercado Pago.',
    });
  }
}
