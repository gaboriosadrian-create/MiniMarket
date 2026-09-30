import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where,
  orderBy,
  limit,
  startAfter,
  QueryDocumentSnapshot,
  DocumentData,
  QueryConstraint
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  ReplenishmentList, 
  ReplenishmentItem, 
  Product 
} from '../types';
import { logAdminAction } from './auditService';
import { createNotification } from './notificationService';
import { updatePublicOrderStatus, getPublicOrder } from './publicOrderService';
import { formatRequestCode } from './replenishmentPdf';

/**
 * Get active DRAFT replenishment list for a business
 */
export async function getActiveDraftReplenishment(businessId: string): Promise<ReplenishmentList | null> {
  try {
    const q = query(
      collection(db, 'replenishment_lists'),
      where('businessId', '==', businessId),
      where('status', '==', 'DRAFT')
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;

    // Return the latest active draft
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReplenishmentList));
    docs.sort((a, b) => (b.updatedAt || b.createdAt).localeCompare(a.updatedAt || a.createdAt));
    return docs[0];
  } catch (error) {
    console.error('Error fetching active draft replenishment:', error);
    return null;
  }
}

export interface SaveDraftInput {
  businessId: string;
  userId: string;
  creatorName: string;
  items: ReplenishmentItem[];
  supplierName?: string;
  notes?: string;
  existingId?: string;
}

/**
 * Sanitizes a single ReplenishmentItem to remove any `undefined` properties
 * before saving to Firestore.
 */
export function sanitizeReplenishmentItem(item: ReplenishmentItem): Record<string, any> {
  const cleanItem: Record<string, any> = {
    productId: item.productId,
    productName: item.productName || '',
    currentStock: typeof item.currentStock === 'number' ? item.currentStock : 0,
    requestedQuantity: typeof item.requestedQuantity === 'number' ? item.requestedQuantity : 1,
  };

  if (item.barcode !== undefined && item.barcode !== null) {
    cleanItem.barcode = item.barcode;
  }
  if (item.category !== undefined && item.category !== null) {
    cleanItem.category = item.category;
  }
  if (item.reorderPoint !== undefined && item.reorderPoint !== null) {
    cleanItem.reorderPoint = item.reorderPoint;
  }
  if (item.targetStock !== undefined && item.targetStock !== null) {
    cleanItem.targetStock = item.targetStock;
  }

  return cleanItem;
}

/**
 * Sanitizes a complete ReplenishmentList payload for Firestore.
 * Strips out any undefined keys while preserving null, 0, false, and empty strings.
 */
export function sanitizeReplenishmentForFirestore(data: Record<string, any>): Record<string, any> {
  const cleanDoc: Record<string, any> = {};

  Object.entries(data).forEach(([key, value]) => {
    if (value === undefined) {
      return;
    }
    if (key === 'items' && Array.isArray(value)) {
      cleanDoc.items = value.map((it: ReplenishmentItem) => sanitizeReplenishmentItem(it));
    } else {
      cleanDoc[key] = value;
    }
  });

  return cleanDoc;
}

/**
 * Save or update a replenishment draft
 */
export async function saveReplenishmentDraft(input: SaveDraftInput): Promise<ReplenishmentList> {
  // Mandatory field validation
  if (!input.businessId) {
    throw new Error('No se puede guardar el pedido porque falta el negocio asociado.');
  }
  if (!input.userId) {
    throw new Error('No se puede guardar el pedido porque no se pudo identificar al usuario.');
  }
  if (!input.items || input.items.length === 0) {
    throw new Error('Agregá al menos un producto al pedido.');
  }

  const cleanCreatorName = (input.creatorName && input.creatorName.trim())
    ? input.creatorName.trim()
    : 'Usuario';

  const now = new Date().toISOString();
  const totalProductsCount = input.items.length;
  const totalUnitsRequested = input.items.reduce((sum, item) => sum + (Number(item.requestedQuantity) || 0), 0);

  let docId = input.existingId;
  let isNew = false;

  if (!docId) {
    // Check if an active draft already exists for business
    const existingDraft = await getActiveDraftReplenishment(input.businessId);
    if (existingDraft) {
      docId = existingDraft.id;
    } else {
      const ref = doc(collection(db, 'replenishment_lists'));
      docId = ref.id;
      isNew = true;
    }
  }

  const docRef = doc(db, 'replenishment_lists', docId);

  if (isNew) {
    const rawList: Record<string, any> = {
      id: docId,
      businessId: input.businessId,
      supplierName: input.supplierName ?? '',
      notes: input.notes ?? '',
      status: 'DRAFT',
      items: input.items,
      totalProductsCount,
      totalUnitsRequested,
      createdBy: input.userId,
      creatorName: cleanCreatorName,
      createdAt: now,
      updatedAt: now
    };

    const sanitizedList = sanitizeReplenishmentForFirestore(rawList);

    await setDoc(docRef, sanitizedList);

    await logAdminAction({
      businessId: input.businessId,
      adminId: input.userId,
      adminEmail: cleanCreatorName,
      targetUserId: input.userId,
      action: 'REPLENISHMENT_CREATED',
      details: `Borrador de lista de reposición creado (${totalProductsCount} productos, ${totalUnitsRequested} unidades)`
    });

    return sanitizedList as ReplenishmentList;
  } else {
    const rawUpdate: Record<string, any> = {
      items: input.items,
      supplierName: input.supplierName ?? '',
      notes: input.notes ?? '',
      totalProductsCount,
      totalUnitsRequested,
      updatedAt: now
    };

    const sanitizedUpdate = sanitizeReplenishmentForFirestore(rawUpdate);

    await updateDoc(docRef, sanitizedUpdate);

    await logAdminAction({
      businessId: input.businessId,
      adminId: input.userId,
      adminEmail: cleanCreatorName,
      targetUserId: input.userId,
      action: 'REPLENISHMENT_UPDATED',
      details: `Borrador de reposición actualizado (${totalProductsCount} productos, ${totalUnitsRequested} unidades)`
    });

    const snap = await getDoc(docRef);
    return { id: snap.id, ...snap.data() } as ReplenishmentList;
  }
}

/**
 * Add a product directly to active draft replenishment list (e.g., from POS)
 */
export async function addItemToActiveDraft(
  businessId: string,
  userId: string,
  creatorName: string,
  product: Product,
  requestedQuantity?: number
): Promise<{ draft: ReplenishmentList; addedItem: ReplenishmentItem }> {
  let draft = await getActiveDraftReplenishment(businessId);
  const currentItems = draft ? [...draft.items] : [];

  // Suggest quantity if not specified
  let defaultQty = 1;
  if (requestedQuantity && requestedQuantity > 0) {
    defaultQty = requestedQuantity;
  } else if (product.targetStock !== undefined && product.targetStock > product.stock) {
    defaultQty = product.targetStock - product.stock;
  } else {
    defaultQty = 1;
  }

  const existingIndex = currentItems.findIndex(i => i.productId === product.id);

  let updatedItem: ReplenishmentItem;

  if (existingIndex >= 0) {
    const existing = currentItems[existingIndex];
    updatedItem = {
      ...existing,
      currentStock: product.stock,
      requestedQuantity: existing.requestedQuantity + defaultQty
    };
    currentItems[existingIndex] = updatedItem;
  } else {
    const reorderPt = product.reorderPoint !== undefined ? product.reorderPoint : product.minimumStock;
    updatedItem = {
      productId: product.id,
      productName: product.name,
      ...(product.barcode !== undefined && product.barcode !== null && { barcode: product.barcode }),
      ...(product.category !== undefined && product.category !== null && { category: product.category }),
      currentStock: product.stock,
      ...(reorderPt !== undefined && reorderPt !== null && { reorderPoint: reorderPt }),
      ...(product.targetStock !== undefined && product.targetStock !== null && { targetStock: product.targetStock }),
      requestedQuantity: defaultQty
    };
    currentItems.push(updatedItem);
  }

  const savedDraft = await saveReplenishmentDraft({
    businessId,
    userId,
    creatorName,
    items: currentItems,
    supplierName: draft?.supplierName || '',
    notes: draft?.notes || '',
    existingId: draft?.id
  });

  return { draft: savedDraft, addedItem: updatedItem };
}

/**
 * Finalize draft and mark as EXPORTED
 */
export async function finalizeAndExportReplenishment(
  replenishmentId: string,
  businessId: string,
  userId: string,
  exporterName: string,
  items: ReplenishmentItem[],
  supplierName?: string,
  notes?: string
): Promise<ReplenishmentList> {
  if (!businessId) {
    throw new Error('No se puede exportar el pedido porque falta el negocio asociado.');
  }
  if (!userId) {
    throw new Error('No se puede exportar el pedido porque no se pudo identificar al usuario.');
  }
  if (!items || items.length === 0) {
    throw new Error('Agregá al menos un producto al pedido.');
  }

  const cleanExporterName = (exporterName && exporterName.trim()) ? exporterName.trim() : 'Usuario';
  const docRef = doc(db, 'replenishment_lists', replenishmentId);
  const now = new Date().toISOString();

  const totalProductsCount = items.length;
  const totalUnitsRequested = items.reduce((sum, item) => sum + (Number(item.requestedQuantity) || 0), 0);

  const rawUpdateData: Record<string, any> = {
    items,
    supplierName: supplierName ?? '',
    notes: notes ?? '',
    totalProductsCount,
    totalUnitsRequested,
    status: 'EXPORTED',
    exportedAt: now,
    exportedBy: userId,
    exporterName: cleanExporterName,
    updatedAt: now
  };

  const sanitizedUpdate = sanitizeReplenishmentForFirestore(rawUpdateData);

  await updateDoc(docRef, sanitizedUpdate);

  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: cleanExporterName,
    targetUserId: userId,
    action: 'REPLENISHMENT_EXPORTED',
    details: `Lista de reposición finalizada y exportada a PDF (${totalProductsCount} productos, ${totalUnitsRequested} unidades)`
  });

  const snap = await getDoc(docRef);
  return { id: snap.id, ...snap.data() } as ReplenishmentList;
}

/**
 * Cancel a replenishment order (DRAFT or EXPORTED)
 * Validates that there are no CONFIRMED receivings before cancelling.
 */
export async function cancelReplenishmentOrder(
  replenishmentId: string,
  businessId: string,
  userId: string,
  userName: string,
  reason?: string
): Promise<void> {
  // 1. Verify if there is any CONFIRMED receiving for this replenishment
  const receivingsQuery = query(
    collection(db, 'receivings'),
    where('businessId', '==', businessId),
    where('replenishmentId', '==', replenishmentId),
    where('status', '==', 'CONFIRMED')
  );
  const confirmedSnap = await getDocs(receivingsQuery);
  if (!confirmedSnap.empty) {
    throw new Error('No se puede cancelar una solicitud que ya cuenta con una recepción confirmada en el stock.');
  }

  // 2. If there are any DRAFT receivings for this replenishment, mark them as CANCELLED as well
  const draftReceivingsQuery = query(
    collection(db, 'receivings'),
    where('businessId', '==', businessId),
    where('replenishmentId', '==', replenishmentId),
    where('status', '==', 'DRAFT')
  );
  const draftSnap = await getDocs(draftReceivingsQuery);
  const now = new Date().toISOString();
  for (const draftDoc of draftSnap.docs) {
    await updateDoc(doc(db, 'receivings', draftDoc.id), {
      status: 'CANCELLED',
      updatedAt: now
    });
  }

  // 3. Update replenishment list status to CANCELLED
  const docRef = doc(db, 'replenishment_lists', replenishmentId);
  const repSnap = await getDoc(docRef);
  const repData = repSnap.exists() ? repSnap.data() : null;
  const supplier = repData?.supplierName || 'Sin proveedor';

  await updateDoc(docRef, {
    status: 'CANCELLED',
    cancelledAt: now,
    cancelledBy: userId,
    cancellerName: userName,
    cancelReason: reason || 'Cancelado por el usuario',
    updatedAt: now
  });

  // Sync to public order if shared
  try {
    await updatePublicOrderStatus(replenishmentId, 'CANCELLED');
  } catch (syncErr) {
    console.warn('Could not sync cancelled status to public order:', syncErr);
  }

  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: userName,
    targetUserId: userId,
    action: 'REPLENISHMENT_CANCELLED',
    details: `Solicitud #${replenishmentId.slice(0, 6).toUpperCase()} (${supplier}) cancelada`
  });
}

/**
 * Cancel replenishment draft
 */
export async function cancelReplenishmentDraft(
  replenishmentId: string,
  businessId: string,
  userId: string,
  userName: string
): Promise<void> {
  return cancelReplenishmentOrder(replenishmentId, businessId, userId, userName, 'Borrador descartado');
}

/**
 * Submits a draft replenishment for Admin approval
 */
export async function submitReplenishmentForApproval(
  replenishmentId: string,
  businessId: string,
  userId: string,
  userName: string,
  items: ReplenishmentItem[],
  supplierName?: string,
  notes?: string
): Promise<ReplenishmentList> {
  if (!businessId || !userId) {
    throw new Error('No se puede enviar a aprobación: falta negocio o usuario.');
  }
  if (!items || items.length === 0) {
    throw new Error('Agregá al menos un producto a la solicitud.');
  }

  const docRef = doc(db, 'replenishment_lists', replenishmentId);
  const now = new Date().toISOString();
  const totalProductsCount = items.length;
  const totalUnitsRequested = items.reduce((sum, i) => sum + (Number(i.requestedQuantity) || 0), 0);

  const cleanUserName = (userName && userName.trim()) ? userName.trim() : 'Vendedor';

  const rawPayload: Record<string, any> = {
    items,
    supplierName: supplierName ?? '',
    notes: notes ?? '',
    totalProductsCount,
    totalUnitsRequested,
    status: 'PENDING_APPROVAL',
    submittedForApprovalAt: now,
    submittedBy: userId,
    submitterName: cleanUserName,
    originalItemsSnapshot: items,
    updatedAt: now
  };

  const sanitizedPayload = sanitizeReplenishmentForFirestore(rawPayload);
  await updateDoc(docRef, sanitizedPayload);

  await logAdminAction({
    businessId,
    adminId: userId,
    adminEmail: cleanUserName,
    targetUserId: userId,
    action: 'SOLICITUD_PENDIENTE_APROBACION',
    details: `Solicitud #${replenishmentId.slice(0, 6).toUpperCase()} enviada para aprobación (${totalProductsCount} productos, ${totalUnitsRequested} unidades)`
  });

  // Notify Admins
  try {
    await createNotification({
      businessId,
      targetRole: 'ADMIN',
      type: 'SOLICITUD_PENDIENTE_APROBACION',
      title: 'Nueva solicitud pendiente de aprobación',
      message: `${cleanUserName} envió una solicitud de reposición (${totalProductsCount} productos, ${totalUnitsRequested} un.) para su revisión y aprobación.`,
      linkTab: 'replenishment',
      eventId: `rep_pend_${replenishmentId}_${now.slice(0, 16)}`,
      metadata: { replenishmentId, submitterName: cleanUserName, supplierName }
    });
  } catch (err) {
    console.warn('Could not send notification for replenishment submission:', err);
  }

  const snap = await getDoc(docRef);
  return { id: snap.id, ...snap.data() } as ReplenishmentList;
}

/**
 * Approves a replenishment request (Admin only)
 */
export async function approveReplenishmentOrder(
  replenishmentId: string,
  businessId: string,
  adminId: string,
  adminName: string,
  approvedItems: ReplenishmentItem[],
  approvalNotes?: string
): Promise<ReplenishmentList> {
  if (!businessId || !adminId) {
    throw new Error('No se puede aprobar la solicitud: falta negocio o usuario administrador.');
  }
  if (!approvedItems || approvedItems.length === 0) {
    throw new Error('La solicitud debe contener al menos un producto aprobado.');
  }

  const docRef = doc(db, 'replenishment_lists', replenishmentId);
  const now = new Date().toISOString();
  const totalProductsCount = approvedItems.length;
  const totalUnitsRequested = approvedItems.reduce((sum, i) => sum + (Number(i.approvedQuantity ?? i.requestedQuantity) || 0), 0);

  const cleanAdminName = (adminName && adminName.trim()) ? adminName.trim() : 'Administrador';

  const repSnap = await getDoc(docRef);
  if (!repSnap.exists()) {
    throw new Error('Solicitud no encontrada.');
  }
  const currentData = repSnap.data() as ReplenishmentList;

  // Check if any items were modified
  const isModified = approvedItems.some(item => {
    const orig = currentData.items?.find(o => o.productId === item.productId);
    return !orig || orig.requestedQuantity !== (item.approvedQuantity ?? item.requestedQuantity);
  });

  const rawPayload: Record<string, any> = {
    items: approvedItems.map(i => ({
      ...i,
      requestedQuantity: i.approvedQuantity !== undefined ? i.approvedQuantity : i.requestedQuantity,
      approvedQuantity: i.approvedQuantity !== undefined ? i.approvedQuantity : i.requestedQuantity,
      approvalStatus: (i.approvalStatus || (i.approvedQuantity !== undefined && i.approvedQuantity !== i.requestedQuantity ? 'MODIFIED' : 'APPROVED')) as any
    })),
    totalProductsCount,
    totalUnitsRequested,
    status: 'APPROVED',
    approvedAt: now,
    approvedBy: adminId,
    approverName: cleanAdminName,
    approvalNotes: approvalNotes ?? '',
    updatedAt: now
  };

  const sanitizedPayload = sanitizeReplenishmentForFirestore(rawPayload);
  await updateDoc(docRef, sanitizedPayload);

  const reqCode = formatRequestCode(replenishmentId);

  await logAdminAction({
    businessId,
    adminId,
    adminEmail: cleanAdminName,
    targetUserId: currentData.submittedBy || currentData.createdBy,
    action: isModified ? 'SOLICITUD_MODIFICADA' : 'SOLICITUD_APROBADA',
    details: `Solicitud #${reqCode} aprobada por ${cleanAdminName}${isModified ? ' (con modificaciones de cantidades)' : ''}`
  });

  // Notify Submitter/Creator
  const targetUserId = currentData.submittedBy || currentData.createdBy;
  try {
    await createNotification({
      businessId,
      userId: targetUserId,
      type: isModified ? 'SOLICITUD_MODIFICADA' : 'SOLICITUD_APROBADA',
      title: isModified ? 'Solicitud aprobada con modificaciones' : 'Solicitud de reposición aprobada',
      message: `Tu solicitud #${reqCode} fue aprobada por ${cleanAdminName}${isModified ? ' con cantidades ajustadas' : ''}. Ya puedes verificarla y compartirla con el proveedor o recibir los productos.`,
      linkTab: 'receiving',
      eventId: `rep_appr_${replenishmentId}_${now.slice(0, 16)}`,
      metadata: { 
        replenishmentId, 
        requestId: reqCode,
        statusFilter: 'APPROVED',
        approverName: cleanAdminName, 
        isModified 
      }
    });
  } catch (err) {
    console.warn('Could not send notification for replenishment approval:', err);
  }

  const updatedSnap = await getDoc(docRef);
  return { id: updatedSnap.id, ...updatedSnap.data() } as ReplenishmentList;
}

/**
 * Rejects a replenishment request (Admin only)
 */
export async function rejectReplenishmentOrder(
  replenishmentId: string,
  businessId: string,
  adminId: string,
  adminName: string,
  rejectReason: string
): Promise<ReplenishmentList> {
  if (!businessId || !adminId) {
    throw new Error('No se puede rechazar la solicitud: falta negocio o usuario administrador.');
  }
  if (!rejectReason || !rejectReason.trim()) {
    throw new Error('Debes indicar un motivo de rechazo.');
  }

  const docRef = doc(db, 'replenishment_lists', replenishmentId);
  const now = new Date().toISOString();
  const cleanAdminName = (adminName && adminName.trim()) ? adminName.trim() : 'Administrador';

  const repSnap = await getDoc(docRef);
  if (!repSnap.exists()) {
    throw new Error('Solicitud no encontrada.');
  }
  const currentData = repSnap.data() as ReplenishmentList;

  const rawPayload: Record<string, any> = {
    status: 'REJECTED',
    rejectedAt: now,
    rejectedBy: adminId,
    rejecterName: cleanAdminName,
    rejectReason: rejectReason.trim(),
    updatedAt: now
  };

  const sanitizedPayload = sanitizeReplenishmentForFirestore(rawPayload);
  await updateDoc(docRef, sanitizedPayload);

  await logAdminAction({
    businessId,
    adminId,
    adminEmail: cleanAdminName,
    targetUserId: currentData.submittedBy || currentData.createdBy,
    action: 'SOLICITUD_RECHAZADA',
    details: `Solicitud #${replenishmentId.slice(0, 6).toUpperCase()} rechazada. Motivo: ${rejectReason.trim()}`
  });

  // Notify Submitter/Creator
  const targetUserId = currentData.submittedBy || currentData.createdBy;
  try {
    await createNotification({
      businessId,
      userId: targetUserId,
      type: 'SOLICITUD_RECHAZADA',
      title: 'Solicitud de reposición rechazada',
      message: `Tu solicitud #${replenishmentId.slice(0, 6).toUpperCase()} fue rechazada por ${cleanAdminName}. Motivo: ${rejectReason.trim()}`,
      linkTab: 'replenishment',
      eventId: `rep_rej_${replenishmentId}_${now.slice(0, 16)}`,
      metadata: { replenishmentId, rejecterName: cleanAdminName, rejectReason: rejectReason.trim() }
    });
  } catch (err) {
    console.warn('Could not send notification for replenishment rejection:', err);
  }

  const updatedSnap = await getDoc(docRef);
  return { id: updatedSnap.id, ...updatedSnap.data() } as ReplenishmentList;
}

/**
 * Transitions an approved replenishment list to EXPORTED (Enviada al proveedor)
 * when shared via WhatsApp, plain text, public online link, copy link, resend, or PDF download.
 * Generates audit event SOLICITUD_ENVIADA_PROVEEDOR and notifies the Admin.
 */
export async function markReplenishmentSentToProvider(
  replenishmentId: string,
  businessId: string,
  userId: string,
  userName: string,
  method: 'WHATSAPP' | 'PLAIN_TEXT' | 'ONLINE_LINK' | 'COPY_LINK' | 'RESEND' | 'PDF' | string = 'ONLINE_LINK'
): Promise<ReplenishmentList | null> {
  if (!businessId || !replenishmentId) return null;

  try {
    const docRef = doc(db, 'replenishment_lists', replenishmentId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const currentData = snap.data() as ReplenishmentList;
    const now = new Date().toISOString();
    const cleanUserName = (userName && userName.trim()) ? userName.trim() : 'Vendedor';
    const reqCode = formatRequestCode(replenishmentId);
    const supplierName = currentData.supplierName || 'Proveedor';

    // Only transition status if currently APPROVED or DRAFT
    const shouldUpdateStatus = currentData.status === 'APPROVED' || currentData.status === 'DRAFT';
    const previousStatus = currentData.status;

    if (shouldUpdateStatus) {
      const updatePayload: Record<string, any> = {
        status: 'EXPORTED',
        exportedAt: now,
        exportedBy: userId,
        exporterName: cleanUserName,
        updatedAt: now
      };

      await updateDoc(docRef, sanitizeReplenishmentForFirestore(updatePayload));
    }

    // Method description mapping
    const methodDescriptions: Record<string, string> = {
      WHATSAPP: 'WhatsApp',
      PLAIN_TEXT: 'Copia de texto',
      ONLINE_LINK: 'Enlace interactivo online',
      COPY_LINK: 'Copia de enlace',
      RESEND: 'Reenvío de solicitud',
      PDF: 'Documento PDF'
    };
    const methodLabel = methodDescriptions[method] || method;

    // 1. Log Audit
    await logAdminAction({
      businessId,
      adminId: userId,
      adminEmail: cleanUserName,
      targetUserId: userId,
      action: 'SOLICITUD_ENVIADA_PROVEEDOR',
      details: `${cleanUserName} envió la solicitud #${reqCode} (${supplierName}) al proveedor mediante ${methodLabel}`
    });

    // 2. Notify Admin
    try {
      await createNotification({
        businessId,
        targetRole: 'ADMIN',
        type: 'SOLICITUD_ENVIADA_PROVEEDOR',
        title: 'Solicitud enviada al proveedor',
        message: `${cleanUserName} envió la solicitud de ${supplierName} (#${reqCode}) al proveedor mediante ${methodLabel}.`,
        linkTab: 'receiving',
        eventId: `rep_sent_${replenishmentId}_${now.slice(0, 16)}`,
        metadata: {
          replenishmentId,
          requestId: reqCode,
          supplierName,
          senderName: cleanUserName,
          method: methodLabel,
          previousStatus,
          newStatus: 'EXPORTED'
        }
      });
    } catch (notifErr) {
      console.warn('Could not send notification for replenishment sent to provider:', notifErr);
    }

    const updatedSnap = await getDoc(docRef);
    return { id: updatedSnap.id, ...updatedSnap.data() } as ReplenishmentList;
  } catch (error) {
    console.warn('Error marking replenishment as sent to provider:', error);
    return null;
  }
}

export interface ReplenishmentHistoryFilters {
  supplierName?: string;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

export interface PaginatedReplenishmentHistoryResult {
  items: ReplenishmentList[];
  hasNextPage: boolean;
  firstVisibleDoc: QueryDocumentSnapshot<DocumentData> | null;
  lastVisibleDoc: QueryDocumentSnapshot<DocumentData> | null;
}

export interface GetReplenishmentHistoryPaginatedOptions {
  businessId: string;
  filters?: ReplenishmentHistoryFilters;
  pageSize?: number;
  cursorDoc?: QueryDocumentSnapshot<DocumentData> | null;
}

/**
 * Get distinct supplier names for replenishment lists in a business
 */
export async function getDistinctReplenishmentSuppliers(businessId: string): Promise<string[]> {
  if (!businessId) return [];
  try {
    const set = new Set<string>();

    // 1. From replenishment_lists
    try {
      const q1 = query(
        collection(db, 'replenishment_lists'),
        where('businessId', '==', businessId),
        limit(150)
      );
      const snap1 = await getDocs(q1);
      snap1.docs.forEach(d => {
        const data = d.data();
        if (data.supplierName && typeof data.supplierName === 'string' && data.supplierName.trim()) {
          set.add(data.supplierName.trim());
        }
      });
    } catch {
      // ignore
    }

    // 2. From receivings
    try {
      const q2 = query(
        collection(db, 'receivings'),
        where('businessId', '==', businessId),
        limit(150)
      );
      const snap2 = await getDocs(q2);
      snap2.docs.forEach(d => {
        const data = d.data();
        if (data.supplierName && typeof data.supplierName === 'string' && data.supplierName.trim()) {
          set.add(data.supplierName.trim());
        }
      });
    } catch {
      // ignore
    }

    // 3. From purchases
    try {
      const q3 = query(
        collection(db, 'purchases'),
        where('businessId', '==', businessId),
        limit(150)
      );
      const snap3 = await getDocs(q3);
      snap3.docs.forEach(d => {
        const data = d.data();
        const sup = data.supplierName || data.supplier;
        if (sup && typeof sup === 'string' && sup.trim()) {
          set.add(sup.trim());
        }
      });
    } catch {
      // ignore
    }

    return Array.from(set).sort((a, b) => a.localeCompare(b));
  } catch (error) {
    console.error('Error fetching distinct suppliers:', error);
    return [];
  }
}

/**
 * Query replenishment history with real Firestore pagination, descending order (createdAt desc),
 * and combined filters (supplier, date range covering 00:00:00 to 23:59:59.999).
 */
export async function getReplenishmentHistoryPaginated({
  businessId,
  filters = {},
  pageSize = 20,
  cursorDoc = null
}: GetReplenishmentHistoryPaginatedOptions): Promise<PaginatedReplenishmentHistoryResult> {
  if (!businessId) {
    return {
      items: [],
      hasNextPage: false,
      firstVisibleDoc: null,
      lastVisibleDoc: null
    };
  }

  try {
    const constraints: QueryConstraint[] = [
      where('businessId', '==', businessId)
    ];

    // 1. Supplier filter
    if (filters.supplierName && filters.supplierName.trim() !== '') {
      constraints.push(where('supplierName', '==', filters.supplierName.trim()));
    }

    // 2. Date range filter (Desde / Hasta)
    // Ensures start of day (00:00:00.000) and end of day (23:59:59.999)
    if (filters.startDate && filters.startDate.trim() !== '') {
      const [sy, sm, sd] = filters.startDate.split('-').map(Number);
      if (!isNaN(sy) && !isNaN(sm) && !isNaN(sd)) {
        const startDt = new Date(sy, sm - 1, sd, 0, 0, 0, 0);
        constraints.push(where('createdAt', '>=', startDt.toISOString()));
      }
    }

    if (filters.endDate && filters.endDate.trim() !== '') {
      const [ey, em, ed] = filters.endDate.split('-').map(Number);
      if (!isNaN(ey) && !isNaN(em) && !isNaN(ed)) {
        const endDt = new Date(ey, em - 1, ed, 23, 59, 59, 999);
        constraints.push(where('createdAt', '<=', endDt.toISOString()));
      }
    }

    // 3. Descending order by creation date
    constraints.push(orderBy('createdAt', 'desc'));

    // 4. Cursor pagination
    if (cursorDoc) {
      constraints.push(startAfter(cursorDoc));
    }

    // 5. Limit (+1 to check if there are subsequent pages)
    constraints.push(limit(pageSize + 1));

    const q = query(collection(db, 'replenishment_lists'), ...constraints);
    const snap = await getDocs(q);

    const hasNextPage = snap.docs.length > pageSize;
    const pageDocs = hasNextPage ? snap.docs.slice(0, pageSize) : snap.docs;

    const firstVisibleDoc = pageDocs.length > 0 ? pageDocs[0] : null;
    const lastVisibleDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;

    const items: ReplenishmentList[] = pageDocs.map(d => ({
      id: d.id,
      ...d.data()
    } as ReplenishmentList));

    // Enrich items with public order / provider confirmation
    await Promise.all(
      items.map(async (order) => {
        if (!order.providerResponse && (order.publicShareToken || order.publicShareCode)) {
          try {
            const tokenOrCode = order.publicShareToken || order.publicShareCode || '';
            const pOrder = await getPublicOrder(tokenOrCode);
            if (pOrder?.providerResponse) {
              order.providerResponse = pOrder.providerResponse;
              order.providerStatus = 'CONFIRMED';
              order.providerConfirmedAt = pOrder.providerConfirmedAt;
              order.providerNote = pOrder.providerNote;
              order.publicOrderStatus = pOrder.status;
            }
          } catch {
            // Silently continue
          }
        }
      })
    );

    return {
      items,
      hasNextPage,
      firstVisibleDoc,
      lastVisibleDoc
    };
  } catch (error: any) {
    console.error('Error in getReplenishmentHistoryPaginated:', error);
    if (error?.message?.includes('requires an index')) {
      console.warn('Firestore index required for replenishment queries:', error.message);
    }
    throw error;
  }
}

/**
 * Get all replenishment history for business (Backwards-compatible fallback)
 */
export async function getReplenishmentHistory(businessId: string): Promise<ReplenishmentList[]> {
  try {
    const q = query(
      collection(db, 'replenishment_lists'),
      where('businessId', '==', businessId),
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    const snap = await getDocs(q);
    const list: ReplenishmentList[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ReplenishmentList));

    // Enrich with provider confirmation if public order exists
    await Promise.all(
      list.map(async (order) => {
        if (!order.providerResponse && (order.publicShareToken || order.publicShareCode)) {
          try {
            const tokenOrCode = order.publicShareToken || order.publicShareCode || '';
            const pOrder = await getPublicOrder(tokenOrCode);
            if (pOrder?.providerResponse) {
              order.providerResponse = pOrder.providerResponse;
              order.providerStatus = 'CONFIRMED';
              order.providerConfirmedAt = pOrder.providerConfirmedAt;
              order.providerNote = pOrder.providerNote;
              order.publicOrderStatus = pOrder.status;
            }
          } catch {
            // Silently continue
          }
        }
      })
    );

    return list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch (error) {
    console.error('Error fetching replenishment history:', error);
    return [];
  }
}
