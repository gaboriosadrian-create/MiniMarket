import { createRealMercadoPagoOrder } from '../../server/mercadopago/orderService.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

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
