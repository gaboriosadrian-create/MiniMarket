import { auditStore } from '../../server/mercadopago/auditStore.js';

export default function handler(req: any, res: any) {
  const limit = Number(req.query?.limit) || 50;
  const logs = auditStore.getRecentLogs(limit);
  return res.status(200).json({
    success: true,
    logs,
  });
}
