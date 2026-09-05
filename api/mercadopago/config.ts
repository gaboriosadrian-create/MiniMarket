import { tenantConfigStore } from '../../server/mercadopago/tenantConfigStore.js';

export default function handler(req: any, res: any) {
  if (req.method === 'GET') {
    try {
      const businessId = String(req.query?.businessId || 'default').trim();
      const sanitized = tenantConfigStore.getSanitizedConfig(businessId);
      return res.status(200).json({
        success: true,
        config: sanitized,
      });
    } catch (err: any) {
      console.error('[MercadoPago Vercel Get Config Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'No se pudo obtener la configuración de Mercado Pago',
      });
    }
  }

  if (req.method === 'POST') {
    try {
      const {
        businessId = 'default',
        enabled,
        mode,
        autoConfirm,
        testConfig,
        productionConfig,
        updatedBy,
      } = req.body || {};

      tenantConfigStore.saveConfig(String(businessId).trim(), {
        enabled,
        mode,
        autoConfirm,
        testConfig,
        productionConfig,
        updatedBy,
      });

      const sanitized = tenantConfigStore.getSanitizedConfig(String(businessId).trim());
      return res.status(200).json({
        success: true,
        message: 'Configuración de Mercado Pago guardada correctamente.',
        config: sanitized,
      });
    } catch (err: any) {
      console.error('[MercadoPago Vercel Save Config Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Error al guardar la configuración de Mercado Pago',
      });
    }
  }

  res.setHeader('Allow', ['GET', 'POST']);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} Not Allowed`,
  });
}
