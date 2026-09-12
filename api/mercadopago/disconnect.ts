import { paymentProviderService } from '../../server/mercadopago/paymentProviderService.js';

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

  try {
    const businessId = String(req.body?.businessId || req.query?.businessId || '').trim();
    if (!businessId) {
      return res.status(400).json({
        success: false,
        message: 'businessId es requerido para desconectar Mercado Pago.',
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
