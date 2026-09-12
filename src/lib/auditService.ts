import { collection, addDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface AuditLogInput {
  businessId: string;
  adminId: string;
  adminEmail: string;
  targetUserId: string;
  targetUserEmail?: string;
  action:
    | 'SELLER_CREATED'
    | 'SELLER_UPDATED'
    | 'SELLER_BLOCKED'
    | 'SELLER_UNBLOCKED'
    | 'SELLER_DISABLED'
    | 'SELLER_ENABLED'
    | 'PERMISSIONS_UPDATED'
    | 'BUSINESS_UPDATED'
    | 'REPLENISHMENT_CREATED'
    | 'REPLENISHMENT_UPDATED'
    | 'REPLENISHMENT_SUBMITTED_FOR_APPROVAL'
    | 'REPLENISHMENT_APPROVED'
    | 'REPLENISHMENT_REJECTED'
    | 'REPLENISHMENT_MODIFIED'
    | 'REPLENISHMENT_EXPORTED'
    | 'REPLENISHMENT_CANCELLED'
    | 'RECEIVING_CREATED'
    | 'RECEIVING_CREATED_FROM_REPLENISHMENT'
    | 'RECEIVING_CONFIRMED'
    | 'RECEIVING_CANCELLED'
    | 'RECEIVING_WITH_SHORTAGE'
    | 'RECEIVING_WITH_SURPLUS'
    | 'PEDIDO_ONLINE_CREATED'
    | 'PEDIDO_ONLINE_SHARED'
    | 'PROVIDER_ORDER_CONFIRMED'
    | 'PROVIDER_CONFIRMED_PARTIAL'
    | 'PROVIDER_CONFIRMED_NO_STOCK'
    | 'SOLICITUD_REENVIADA'
    | 'SOLICITUD_CREADA'
    | 'SOLICITUD_PENDIENTE_APROBACION'
    | 'SOLICITUD_APROBADA'
    | 'SOLICITUD_RECHAZADA'
    | 'SOLICITUD_MODIFICADA'
    | 'SOLICITUD_ENVIADA_PROVEEDOR'
    | 'PROVEEDOR_CONFIRMO_SOLICITUD'
    | 'RECEPCION_CONTROL_INICIADO'
    | 'RECEPCION_PARCIAL'
    | 'RECEPCION_COMPLETADA'
    | 'RECEPCION_CERRADA'
    | 'SHORTAGE_CLOSED'
    | 'SURPLUS_ACCEPTED_CHARGE'
    | 'SURPLUS_ACCEPTED_FREE'
    | 'SURPLUS_REJECTED'
    | 'PURCHASE_CONFIRMED'
    | 'PURCHASE_CANCELLED';
  details: string;
}

export async function logAdminAction(input: AuditLogInput): Promise<void> {
  try {
    await addDoc(collection(db, 'audit_logs'), {
      ...input,
      createdAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Error logging admin action:', err);
  }
}
