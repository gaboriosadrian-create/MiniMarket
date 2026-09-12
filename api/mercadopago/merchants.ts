import { persistenceService } from '../../server/mercadopago/persistenceService.js';
import { maskUserId } from '../../server/mercadopago/paymentProviderService.js';

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

/**
 * Vercel Serverless Function: GET /api/mercadopago/merchants
 * Lists connected merchant tenants and their sanitized connection statuses.
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
    const allPersisted = await persistenceService.getAllConnectionsAsync();
    const merchants = allPersisted.map((conn) => ({
      businessId: conn.businessId,
      status: conn.status,
      provider: 'mercadopago',
      userId: maskUserId(conn.userId),
      siteId: conn.siteId || 'MLA',
      externalStoreId: conn.externalStoreId,
      storeId: conn.storeId,
      externalPosId: conn.externalPosId,
      posId: conn.posId,
      accountNickname: conn.accountNickname,
      accountEmail: conn.accountEmail,
      connectedAt: conn.connectedAt,
      updatedAt: conn.updatedAt,
    }));

    return res.status(200).json({
      success: true,
      merchants,
    });
  } catch (err: any) {
    console.error('[MercadoPago Vercel Merchants Error]:', err);
    return res.status(500).json({ success: false, message: 'Error al listar comercios.' });
  }
}
