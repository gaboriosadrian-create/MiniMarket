import { getSanitizedMercadoPagoConfig } from '../../server/mercadopago/config.js';

/**
 * Mercado Pago Status Handler for Vercel Serverless and Express.
 * 
 * Safely resolves and returns sanitized Mercado Pago configuration for the POS
 * using the unified configuration resolver.
 * Never exposes the access token or sensitive credentials.
 */
export default function handler(req: any, res: any) {
  if (req?.method === 'OPTIONS') {
    if (res?.setHeader) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  try {
    const businessId = req?.query?.businessId ? String(req.query.businessId).trim() : undefined;
    const config = getSanitizedMercadoPagoConfig(businessId);

    return res.status(200).json({
      status: 'ok',
      config,
      recentAuditsCount: 0,
    });
  } catch (err: any) {
    console.error('[Vercel Serverless /api/mercadopago/status Error]:', err);
    const fallbackConfig = getSanitizedMercadoPagoConfig();
    return res.status(200).json({
      status: 'ok',
      config: fallbackConfig,
      recentAuditsCount: 0,
    });
  }
}
