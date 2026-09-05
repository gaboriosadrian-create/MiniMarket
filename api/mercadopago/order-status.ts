import { checkAndSyncOrderStatus } from '../../server/mercadopago/statusChecker.js';

export default async function handler(req: any, res: any) {
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
