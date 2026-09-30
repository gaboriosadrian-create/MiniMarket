import {
  getSanitizedPlatformConfig,
  setPlatformAppConfig,
} from '../../server/mercadopago/platformConfig.js';
import { auditStore } from '../../server/mercadopago/auditStore.js';
import { verifyAuthAndAuthorization } from '../../server/auth/authMiddleware.js';
import { checkRateLimit } from '../../src/lib/rateLimit.js';

function applyCors(req: any, res: any) {
  if (!res?.setHeader) return;
  const origin = req?.headers?.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, x-user-uid');
}

/**
 * Vercel Serverless Function (Consolidated Admin Hub):
 * Handles:
 * - /api/mercadopago/platform-config (GET, POST)
 * - /api/mercadopago/audits (GET)
 */
export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  // Rate Limiting
  const clientIp = (req.headers?.['x-forwarded-for'] as string) || 'unknown';
  const limit = checkRateLimit(`admin_hub:${clientIp}`, 60, 60000);
  if (!limit.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes. Por favor, reintente en unos instantes.',
    });
  }

  const subroute = req.query?.subroute || (req.url?.includes('/audits') ? 'audits' : 'platform-config');

  // Subroute: 'audits' (/api/mercadopago/audits)
  if (subroute === 'audits') {
    if (req.method && req.method !== 'GET') {
      res.setHeader?.('Allow', ['GET', 'OPTIONS']);
      return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
    }

    const authResult = await verifyAuthAndAuthorization(req, undefined, { requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
    if (!authResult.ok) {
      return res.status(authResult.status || 401).json({
        success: false,
        status: authResult.code || 'UNAUTHORIZED',
        message: authResult.message || 'No autorizado',
      });
    }

    const limitNum = Number(req.query?.limit) || 50;
    const logs = auditStore.getRecentLogs(limitNum);
    return res.status(200).json({
      success: true,
      logs,
    });
  }

  // Subroute: 'platform-config' (/api/mercadopago/platform-config)
  if (req.method === 'GET') {
    const config = getSanitizedPlatformConfig();
    return res.status(200).json({
      success: true,
      config,
    });
  }

  if (req.method === 'POST') {
    try {
      const authResult = await verifyAuthAndAuthorization(req, undefined, { requiredRoles: ['SUPER_ADMIN'] });
      if (!authResult.ok) {
        return res.status(authResult.status || 403).json({
          success: false,
          status: authResult.code || 'FORBIDDEN',
          message: authResult.message || 'Solo Super Admin puede modificar credenciales globales de plataforma.',
        });
      }

      const { clientId, clientSecret, redirectUri } = req.body || {};
      setPlatformAppConfig({
        clientId,
        clientSecret,
        redirectUri,
      });
      return res.status(200).json({
        success: true,
        message: 'Configuración técnica de Mercado Pago guardada exitosamente.',
        config: getSanitizedPlatformConfig(),
      });
    } catch (err: any) {
      console.error('[MercadoPago Vercel Platform Config Error]:', err);
      return res.status(500).json({
        success: false,
        message: 'Error al guardar la configuración técnica de Mercado Pago.',
      });
    }
  }

  res.setHeader?.('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
}
