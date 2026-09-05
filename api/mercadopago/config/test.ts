import { verifyMercadoPagoConnection } from '../../../server/mercadopago/connectionVerifier.js';

export default async function handler(req: any, res: any) {
  if (req?.method === 'OPTIONS') {
    if (res?.setHeader) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  if (req.method !== 'POST') {
    res.setHeader?.('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  try {
    const { businessId = 'default', mode, testedBy } = req.body || {};
    const result = await verifyMercadoPagoConnection({
      businessId: String(businessId).trim(),
      mode,
      testedBy,
    });
    return res.status(200).json(result);
  } catch (err: any) {
    console.error('[MercadoPago Vercel Verify Connection Error]:', err);
    return res.status(500).json({
      success: false,
      status: 'ERROR',
      message: 'No se pudo verificar la integración con Mercado Pago.',
      testedAt: new Date().toISOString(),
    });
  }
}
