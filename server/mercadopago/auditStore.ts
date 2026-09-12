import { MercadoPagoAuditLog } from './types.js';

/**
 * Audit Store for Mercado Pago webhook events and order queries.
 * Records comprehensive audit trails without exposing tokens, secrets, or full PANs.
 */
class AuditLogManager {
  private logs: MercadoPagoAuditLog[] = [];
  private readonly maxLogs = 1000;

  /**
   * Appends an audit log entry.
   */
  public log(entry: Omit<MercadoPagoAuditLog, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): MercadoPagoAuditLog {
    const fullLog: MercadoPagoAuditLog = {
      id: entry.id || `audit_mp_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      timestamp: entry.timestamp || new Date().toISOString(),
      ...entry,
    };

    if (this.logs.length >= this.maxLogs) {
      this.logs.shift(); // Remove oldest
    }

    this.logs.push(fullLog);

    // Safe sanitized console log for backend debugging
    console.info(
      `[MercadoPago Audit] [${fullLog.result}] Order: ${fullLog.orderId || 'N/A'} | Ref: ${fullLog.external_reference || 'N/A'} | Action: ${fullLog.action || 'N/A'} | AutoConfirmed: ${fullLog.autoConfirmed} | Dupl: ${fullLog.isDuplicate}`
    );

    return fullLog;
  }

  /**
   * Retrieves recent audit logs.
   */
  public getRecentLogs(limit = 50): MercadoPagoAuditLog[] {
    return this.logs.slice(-limit).reverse();
  }

  /**
   * Retrieves logs matching a specific orderId or external_reference.
   */
  public findLogsByOrderOrRef(idOrRef: string): MercadoPagoAuditLog[] {
    const search = idOrRef.toLowerCase().trim();
    return this.logs.filter(
      (l) =>
        (l.orderId && String(l.orderId).toLowerCase().includes(search)) ||
        (l.external_reference && l.external_reference.toLowerCase().includes(search))
    );
  }

  /**
   * Clears audit logs (for testing).
   */
  public clear(): void {
    this.logs = [];
  }
}

export const auditStore = new AuditLogManager();
