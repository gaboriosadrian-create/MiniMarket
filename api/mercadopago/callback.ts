import { getPlatformAppConfig } from '../../server/mercadopago/platformConfig.js';
import { oauthStateStore } from '../../server/mercadopago/oauthStateStore.js';
import { paymentProviderService } from '../../server/mercadopago/paymentProviderService.js';

function applyCors(req: any, res: any) {
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

function safeRedirect(res: any, url: string) {
  if (typeof res.redirect === 'function') {
    return res.redirect(url);
  }
  res.writeHead(302, { Location: url });
  return res.end();
}

/**
 * Vercel Serverless Function: GET /api/mercadopago/callback
 * Handles the OAuth redirect from Mercado Pago, validates anti-CSRF single-use state from Firestore,
 * exchanges authorization code for live credentials, and persists tenant connection securely.
 */
export default async function handler(req: any, res: any) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET', 'OPTIONS']);
    return res.status(405).json({ success: false, message: `Method ${req.method} Not Allowed` });
  }

  try {
    const error = String(req.query?.error || '').trim();
    const errorDescription = String(req.query?.error_description || '').trim();

    if (error) {
      console.warn('[MercadoPago Vercel Callback] User cancelled or error returned from MP:', error, errorDescription);
      return safeRedirect(res, `/?mp_error=${encodeURIComponent(errorDescription || error || 'Autorización cancelada')}#minegocio`);
    }

    const code = String(req.query?.code || '').trim();
    const state = String(req.query?.state || '').trim();

    if (!code) {
      return safeRedirect(res, `/?mp_error=${encodeURIComponent('No se recibió código de autorización de Mercado Pago')}#minegocio`);
    }

    // Validate & atomically consume state (anti-CSRF, anti-replay, one-time use, TTL expiration)
    const stateValidation = await oauthStateStore.validateAndConsumeState(state);
    if (!stateValidation.valid || !stateValidation.data) {
      console.error('[MercadoPago Vercel Callback] State validation failed:', stateValidation.error, stateValidation.message);
      return safeRedirect(res, `/?mp_error=${encodeURIComponent(stateValidation.message || 'Error de validación de seguridad (state inválido o expirado)')}#minegocio`);
    }

    const { businessId, returnOrigin } = stateValidation.data;
    const targetBase = returnOrigin || '';

    const host = req.headers?.host || 'localhost:3000';
    const protocol = req.headers?.['x-forwarded-proto'] === 'https' ? 'https' : 'http';
    const platformConfig = getPlatformAppConfig();
    const redirectUri = platformConfig.redirectUri || `${protocol}://${host}/api/mercadopago/callback`;

    await paymentProviderService.connectBusiness({
      businessId,
      code,
      redirectUri,
    });

    return safeRedirect(res, `${targetBase}/?mp_status=connected#minegocio`);
  } catch (err: any) {
    console.error('[MercadoPago Vercel Callback Error]:', err);
    return safeRedirect(res, `/?mp_error=${encodeURIComponent(err?.message || 'Error de autorización')}#minegocio`);
  }
}
