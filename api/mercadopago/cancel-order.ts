import { cancelMercadoPagoOrder } from '../../server/mercadopago/orderService.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  try {
    const { externalReference, orderId, businessId } = req.body || {};
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
