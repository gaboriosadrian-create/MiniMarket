/**
 * In-memory & pluggable Idempotency Store for Mercado Pago Events & Orders.
 * 
 * Prevents double confirmation, double stock deduction, and double financial movements
 * when Mercado Pago retries Webhooks.
 */

export interface ProcessedEventRecord {
  key: string;
  orderId?: string;
  paymentId?: string;
  external_reference?: string;
  processedAt: string;
  resultStatus: string;
  confirmed: boolean;
  attempts: number;
}

class IdempotencyManager {
  private processedMap = new Map<string, ProcessedEventRecord>();
  private readonly maxRecords = 2000;

  /**
   * Generates a unique key for idempotency tracking.
   */
  public generateKey(orderId?: string | number, paymentId?: string | number, eventId?: string | number): string {
    if (orderId) return `order_${orderId}`;
    if (paymentId) return `payment_${paymentId}`;
    if (eventId) return `event_${eventId}`;
    return `unknown_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Checks if an order or event has already been successfully processed.
   */
  public isProcessed(key: string): boolean {
    return this.processedMap.has(key);
  }

  /**
   * Retrieves an existing processed record if any.
   */
  public getRecord(key: string): ProcessedEventRecord | undefined {
    return this.processedMap.get(key);
  }

  /**
   * Marks a key as processed with its execution details.
   */
  public markProcessed(record: ProcessedEventRecord): void {
    // Evict oldest if reaching capacity limit
    if (this.processedMap.size >= this.maxRecords) {
      const firstKey = this.processedMap.keys().next().value;
      if (firstKey) this.processedMap.delete(firstKey);
    }

    this.processedMap.set(record.key, record);
  }

  /**
   * Clears the store (used in tests).
   */
  public clear(): void {
    this.processedMap.clear();
  }

  public size(): number {
    return this.processedMap.size;
  }
}

export const idempotencyStore = new IdempotencyManager();
