import { validateMercadoPagoSalePayment } from '../../server/mercadopago/saleValidator.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({
      success: false,
      message: `Method ${req.method} Not Allowed`,
    });
  }

  try {
    const {
      externalReference,
      orderId,
      expectedAmount,
      businessId,
      posId,
      mercadoPagoSource,
    } = req.body || {};

    const validation = await validateMercadoPagoSalePayment({
      externalReference,
      orderId,
      expectedAmount: expectedAmount !== undefined ? Number(expectedAmount) : undefined,
      businessId,
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

