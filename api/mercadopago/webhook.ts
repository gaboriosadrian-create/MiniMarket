import { processMercadoPagoWebhook } from '../../server/mercadopago/webhookService.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  try {
    const result = await processMercadoPagoWebhook(req.body, req.query, req.headers);
    return res.status(result.statusCode).json(result.body);
  } catch (err: any) {
    console.error('[MercadoPago Vercel Function Error]:', err);
    return res.status(200).json({
      success: false,
      status: 'ERROR',
      message: 'Internal server error processing webhook',
      details: err?.message || 'Unknown error',
    });
  }
}
