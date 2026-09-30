import { createRealMercadoPagoOrder } from '../../server/mercadopago/orderService.js';
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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-user-uid');
}

export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', ['POST', 'OPTIONS']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  // 1. Verify Authentication & Authorization
  const requestedBusinessId = req.body?.businessId;
  const authResult = await verifyAuthAndAuthorization(req, requestedBusinessId);
  if (!authResult.ok) {
    return res.status(authResult.status || 401).json({
      success: false,
      status: authResult.code || 'UNAUTHORIZED',
      message: authResult.message || 'No autorizado',
    });
  }

  // 2. Execute Order Creation with Authorized Business
  try {
    const result = await createRealMercadoPagoOrder(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[MercadoPago Vercel create-order Error]:', err);
    return res.status(500).json({
      success: false,
      status: 'ERROR',
      message: 'No se pudo crear la orden de Mercado Pago.',
      details: err?.message || 'Error interno',
    });
  }
}
