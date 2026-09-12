import { MercadoPagoSource } from './types.js';

export interface ActiveOrderRecord {
  external_reference: string;
  orderId?: string;
  paymentId?: string;
  total_amount: number;
  itemsCount?: number;
  status: 'WAITING_PAYMENT' | 'PAYMENT_VERIFIED' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
  autoConfirmed?: boolean;
  createdAt?: string;
  verifiedAt?: string;
  businessId?: string;
  posId?: string;
  externalPosId?: string;
  pointTerminalId?: string;
  sellerName?: string;
  errorReason?: string;
  mercadoPagoSource?: MercadoPagoSource;
}

class OrderRegistry {
  private orders = new Map<string, ActiveOrderRecord>();
  private orderIdToRef = new Map<string, string>();

  public registerOrder(record: ActiveOrderRecord): ActiveOrderRecord {
    const copy: ActiveOrderRecord = {
      itemsCount: 1,
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
      ...record,
    };
    this.orders.set(copy.external_reference, copy);
    if (copy.orderId) {
      this.orderIdToRef.set(copy.orderId, copy.external_reference);
    }
    return copy;
  }

  public updateOrderStatus(
    externalReferenceOrOrderId: string,
    updates: Partial<ActiveOrderRecord>
  ): ActiveOrderRecord | undefined {
    let ref = externalReferenceOrOrderId;
    if (!this.orders.has(ref) && this.orderIdToRef.has(ref)) {
      ref = this.orderIdToRef.get(ref)!;
    }

    const existing = this.orders.get(ref);
    if (!existing) {
      // If not yet registered by create-order, register from webhook
      const newRecord: ActiveOrderRecord = {
        external_reference: updates.external_reference || ref,
        orderId: updates.orderId,
        paymentId: updates.paymentId,
        total_amount: updates.total_amount || 0,
        itemsCount: updates.itemsCount || 1,
        status: updates.status || 'PAYMENT_VERIFIED',
        autoConfirmed: updates.autoConfirmed || false,
        createdAt: updates.createdAt || new Date().toISOString(),
        verifiedAt: updates.verifiedAt || new Date().toISOString(),
        posId: updates.posId,
        externalPosId: updates.externalPosId,
        pointTerminalId: updates.pointTerminalId,
        sellerName: updates.sellerName,
        errorReason: updates.errorReason,
        mercadoPagoSource: updates.mercadoPagoSource || 'STATIC_POS_QR',
      };
      this.orders.set(newRecord.external_reference, newRecord);
      if (newRecord.orderId) {
        this.orderIdToRef.set(newRecord.orderId, newRecord.external_reference);
      }
      return newRecord;
    }

    const updated: ActiveOrderRecord = {
      ...existing,
      ...updates,
      external_reference: existing.external_reference,
    };

    if (updates.orderId && updates.orderId !== existing.orderId) {
      this.orderIdToRef.set(updates.orderId, existing.external_reference);
    }

    this.orders.set(ref, updated);
    return updated;
  }

  public cancelOrder(identifier: string): ActiveOrderRecord | undefined {
    return this.updateOrderStatus(identifier, {
      status: 'EXPIRED',
      errorReason: 'Orden cancelada / invalidada por el sistema',
    });
  }

  public isTerminalBusy(terminalId?: string, currentRef?: string): boolean {
    if (!terminalId) return false;
    const cleanTerm = terminalId.trim();
    for (const order of this.orders.values()) {
      if (order.status === 'WAITING_PAYMENT') {
        const orderTerm = order.pointTerminalId || (order.mercadoPagoSource === 'POINT_SMART' ? order.posId : undefined);
        if (orderTerm && orderTerm.trim() === cleanTerm) {
          if (!currentRef || order.external_reference !== currentRef) {
            return true;
          }
        }
      }
    }
    return false;
  }

  public getOrderByReference(reference: string): ActiveOrderRecord | undefined {
    return this.orders.get(reference);
  }

  public getOrderByOrderId(orderId: string): ActiveOrderRecord | undefined {
    const ref = this.orderIdToRef.get(orderId);
    if (ref) return this.orders.get(ref);
    return undefined;
  }

  public getOrder(identifier: string): ActiveOrderRecord | undefined {
    return this.getOrderByReference(identifier) || this.getOrderByOrderId(identifier);
  }

  public clear(): void {
    this.orders.clear();
    this.orderIdToRef.clear();
  }
}

export const orderRegistry = new OrderRegistry();
