import { getSanitizedMercadoPagoConfig, getSanitizedMercadoPagoConfigAsync } from '../../server/mercadopago/config.js';
import { paymentProviderService } from '../../server/mercadopago/paymentProviderService.js';
import { auditStore } from '../../server/mercadopago/auditStore.js';

/**
 * Mercado Pago Status Handler for Vercel Serverless and Express.
 * 
 * Safely resolves and returns sanitized Mercado Pago configuration and tenant connection
 * status for the POS using the unified configuration resolver and provider service.
 * Never exposes the access token or sensitive credentials.
 */
export default async function handler(req: any, res: any) {
  if (req?.method === 'OPTIONS') {
    if (res?.setHeader) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-user-uid');
    }
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  if (res?.setHeader) {
    const origin = req?.headers?.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-user-uid');
  }

  try {
    const businessId = String(req?.query?.businessId || '').trim();
    const providerStatus = await paymentProviderService.getSanitizedStatusAsync(businessId || 'default');
    const config = await getSanitizedMercadoPagoConfigAsync(businessId || undefined);

    return res.status(200).json({
      status: 'ok',
      enabled: providerStatus.enabled,
      connected: providerStatus.connected,
      connectionStatus: providerStatus.status,
      provider: 'mercadopago',
      accountInfo: providerStatus.accountInfo,
      config,
      recentAuditsCount: auditStore.getRecentLogs(10).length,
    });
  } catch (err: any) {
    console.error('[Vercel Serverless /api/mercadopago/status Error]:', err);
    const fallbackConfig = getSanitizedMercadoPagoConfig();
    return res.status(200).json({
      status: 'ok',
      enabled: false,
      connected: false,
      connectionStatus: 'DISCONNECTED',
      provider: 'mercadopago',
      accountInfo: null,
      config: fallbackConfig,
      recentAuditsCount: 0,
    });
  }
}

