import { tenantConfigStore } from '../../server/mercadopago/tenantConfigStore.js';
import { verifyMercadoPagoConnection } from '../../server/mercadopago/connectionVerifier.js';
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

export default async function handler(req: any, res: any) {
  applyCors(req, res);
  const subroute = req.query?.subroute || (req.url?.includes('/test') ? 'test' : 'config');

  if (req?.method === 'OPTIONS') {
    return res.status(204).end ? res.status(204).end() : res.status(204).json({});
  }

  // Rate Limiting
  const clientIp = (req.headers?.['x-forwarded-for'] as string) || 'unknown';
  const limit = checkRateLimit(`config_api:${subroute}:${clientIp}`, 60, 60000);
  if (!limit.allowed) {
    return res.status(429).json({
      success: false,
      error: 'TOO_MANY_REQUESTS',
      message: 'Demasiadas solicitudes. Por favor, intente de nuevo en unos instantes.',
    });
  }

  if (subroute === 'test') {
    if (req.method !== 'POST') {
      res.setHeader?.('Allow', ['POST', 'OPTIONS']);
      return res.status(405).json({
        success: false,
        message: `Method ${req.method} Not Allowed`,
      });
    }

    try {
      const { businessId = 'default', mode, testedBy } = req.body || {};
      const cleanBizId = String(businessId).trim();

      const authResult = await verifyAuthAndAuthorization(req, cleanBizId, { requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
      if (!authResult.ok) {
        return res.status(authResult.status || 403).json({
          success: false,
          status: authResult.code || 'FORBIDDEN',
          message: authResult.message || 'No autorizado para probar conexión.',
        });
      }

      const result = await verifyMercadoPagoConnection({
        businessId: cleanBizId,
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

      const cleanBizId = String(businessId).trim();
      const authResult = await verifyAuthAndAuthorization(req, cleanBizId, { requiredRoles: ['ADMIN', 'SUPER_ADMIN'] });
      if (!authResult.ok) {
        return res.status(authResult.status || 403).json({
          success: false,
          status: authResult.code || 'FORBIDDEN',
          message: authResult.message || 'No autorizado para configurar este comercio.',
        });
      }

      await tenantConfigStore.saveConfigAsync(cleanBizId, {
        enabled,
        mode,
        autoConfirm,
        testConfig,
        productionConfig,
        updatedBy,
      });

      const sanitized = await tenantConfigStore.getSanitizedConfigAsync(cleanBizId);
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

  res.setHeader?.('Allow', ['GET', 'POST', 'OPTIONS']);
  return res.status(405).json({
    success: false,
    message: `Method ${req.method} Not Allowed`,
  });
}
