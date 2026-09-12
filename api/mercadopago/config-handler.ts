import { tenantConfigStore } from '../../server/mercadopago/tenantConfigStore.js';
import { verifyMercadoPagoConnection } from '../../server/mercadopago/connectionVerifier.js';

export default async function handler(req: any, res: any) {
  const subroute = req.query?.subroute || (req.url?.includes('/test') ? 'test' : 'config');

  if (subroute === 'test') {
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

  // Subroute: 'config' (/api/mercadopago/config)
  if (req.method === 'GET') {
    try {
      const businessId = String(req.query?.businessId || 'default').trim();
      const sanitized = await tenantConfigStore.getSanitizedConfigAsync(businessId);
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

      await tenantConfigStore.saveConfigAsync(String(businessId).trim(), {
        enabled,
        mode,
        autoConfirm,
        testConfig,
        productionConfig,
        updatedBy,
      });

      const sanitized = await tenantConfigStore.getSanitizedConfigAsync(String(businessId).trim());
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

  res.setHeader?.('Allow', ['GET', 'POST']);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} Not Allowed`,
  });
}
