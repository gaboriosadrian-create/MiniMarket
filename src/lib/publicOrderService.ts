import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  PublicOrder, 
  PublicOrderItem, 
  PublicOrderStatus, 
  ReplenishmentList, 
  ProviderOrderResponse, 
  ProviderResponseItem 
} from '../types';
import { formatRequestCode } from './replenishmentPdf';
import { logAdminAction } from './auditService';
import { checkRateLimit, withActionLock } from './rateLimit';
import { sanitizeInteger, sanitizeNumber, sanitizeString } from './securityUtils';

/**
 * Recursively cleans any object or array by completely omitting undefined values.
 * Preserves null, boolean (false/true), 0, empty strings, arrays, nested objects, and dates.
 */
export function sanitizeForFirestore<T = any>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj
      .map((item) => sanitizeForFirestore(item))
      .filter((item) => item !== undefined) as unknown as T;
  }

  if (typeof obj === 'object') {
    if (obj instanceof Date) {
      return obj;
    }

    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj as Record<string, any>)) {
      if (value !== undefined) {
        const cleanedValue = sanitizeForFirestore(value);
        if (cleanedValue !== undefined) {
          cleanObj[key] = cleanedValue;
        }
      }
    }
    return cleanObj as T;
  }

  return obj;
}

/**
 * Specifically validates and sanitizes a ProviderOrderResponse object for Firestore persistence.
 * Guarantees that optional fields like providerNote, productId, unitText, category are completely omitted
 * if undefined rather than persisting undefined values.
 * 
 * Validates mandatory fields before saving to Firestore.
 */
export function sanitizeProviderResponseForFirestore(response: ProviderOrderResponse): Record<string, any> {
  // Validate mandatory fields
  if (!response) {
    throw new Error('La respuesta del proveedor no es válida o está vacía.');
  }

  if (!response.status || response.status !== 'CONFIRMED') {
    throw new Error('El estado de la confirmación es obligatorio y debe ser CONFIRMED.');
  }

  if (!Array.isArray(response.items) || response.items.length === 0) {
    throw new Error('La lista de productos confirmados es obligatoria y no puede estar vacía.');
  }

  if (!response.confirmedAt || typeof response.confirmedAt !== 'string') {
    throw new Error('La fecha y hora de confirmación es obligatoria.');
  }

  // Validate and sanitize items
  const cleanItems = response.items.map((it, idx) => {
    if (!it.productName || typeof it.productName !== 'string' || it.productName.trim().length === 0) {
      throw new Error(`El producto en la posición ${idx + 1} no tiene un nombre válido.`);
    }

    const requestedQuantity = Math.max(0, Number(it.requestedQuantity) || 0);
    let confirmedQuantity = Number(it.confirmedQuantity);
    if (!Number.isFinite(confirmedQuantity) || isNaN(confirmedQuantity) || confirmedQuantity < 0) {
      confirmedQuantity = 0;
    }

    const cleanItem: Record<string, any> = {
      productName: it.productName.trim(),
      requestedQuantity,
      confirmedQuantity,
      status: it.status || (confirmedQuantity === 0 ? 'NO_STOCK' : confirmedQuantity < requestedQuantity ? 'PARTIAL' : confirmedQuantity > requestedQuantity ? 'SURPLUS' : 'COMPLETE')
    };

    if (it.productId && typeof it.productId === 'string' && it.productId.trim().length > 0) {
      cleanItem.productId = it.productId.trim();
    }

    if (it.unitText && typeof it.unitText === 'string' && it.unitText.trim().length > 0) {
      cleanItem.unitText = it.unitText.trim();
    }

    if (it.category && typeof it.category === 'string' && it.category.trim().length > 0) {
      cleanItem.category = it.category.trim();
    }

    return cleanItem;
  });

  const totalProductsCount = response.totalProductsCount ?? cleanItems.length;
  const totalUnitsRequested = response.totalUnitsRequested ?? cleanItems.reduce((s, i) => s + i.requestedQuantity, 0);
  const totalUnitsConfirmed = response.totalUnitsConfirmed ?? cleanItems.reduce((s, i) => s + i.confirmedQuantity, 0);
  const completeCount = response.completeCount ?? cleanItems.filter(i => i.status === 'COMPLETE' || i.status === 'SURPLUS').length;
  const partialCount = response.partialCount ?? cleanItems.filter(i => i.status === 'PARTIAL').length;
  const noStockCount = response.noStockCount ?? cleanItems.filter(i => i.status === 'NO_STOCK').length;

  const cleanResponse: Record<string, any> = {
    id: response.id,
    replenishmentId: response.replenishmentId,
    publicOrderCode: response.publicOrderCode,
    status: response.status,
    items: cleanItems,
    confirmedAt: response.confirmedAt,
    totalProductsCount,
    totalUnitsRequested,
    totalUnitsConfirmed,
    completeCount,
    partialCount,
    noStockCount
  };

  // Only include providerNote if it was explicitly provided as a non-empty string
  if (response.providerNote && typeof response.providerNote === 'string' && response.providerNote.trim().length > 0) {
    cleanResponse.providerNote = response.providerNote.trim();
  }

  return sanitizeForFirestore(cleanResponse);
}

/**
 * Generates a cryptographically strong, non-predictable random token.
 * 32 characters alphanumeric url-safe string.
 */
export function generateSecureToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(array);
  } else {
    for (let i = 0; i < 32; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  let token = '';
  for (let i = 0; i < 32; i++) {
    token += chars[array[i] % chars.length];
  }
  return token;
}

/**
 * Returns the public order URL for a given public code or token.
 * Reusable for links, WhatsApp shares, and future QR code generators.
 */
export function getPublicOrderUrl(publicCodeOrToken: string): string {
  const clean = (publicCodeOrToken || '').trim();
  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    return `${origin}/pedido/${clean}`;
  }
  return `/pedido/${clean}`;
}

/**
 * Formats a clean PublicOrderItem array from a replenishment list.
 */
export function buildPublicOrderItems(list: ReplenishmentList): PublicOrderItem[] {
  return (list.items || []).map((it) => {
    const qty = Number(it.requestedQuantity) || 1;
    const cat = (it.category && it.category.trim()) ? it.category.trim().toUpperCase() : 'VARIOS';
    return {
      productId: it.productId,
      productName: it.productName || 'Producto',
      requestedQuantity: qty,
      unitText: qty === 1 ? 'unidad' : 'unidades',
      category: cat
    };
  });
}

/**
 * Creates or retrieves an existing public order for a ReplenishmentList.
 * 
 * Architecture:
 * - Public Visible Identifier (URL): publicCode, e.g. "SOL-000125"
 * - Internal Security Authorization: accessToken (token), 32-char cryptographically secure string
 * - Public Code Index: Maps publicCode -> token (enables fast, secure single-document lookups)
 */
export async function createOrGetPublicOrder(
  list: ReplenishmentList,
  businessName: string,
  userId?: string,
  userName?: string
): Promise<{ token: string; publicCode: string; url: string; order: PublicOrder }> {
  const now = new Date().toISOString();
  const cleanBusiness = (businessName || 'MINIMARKET').trim();
  const reqCode = formatRequestCode(list.id);
  const publicCode = reqCode;
  const requestedBy = list.exporterName || list.creatorName || userName || 'Vendedor';

  let token = list.publicShareToken;
  let existingOrder: PublicOrder | null = null;

  if (token) {
    existingOrder = await getPublicOrder(token);
  }

  if (!token || !existingOrder) {
    token = generateSecureToken();
  }

  const items = buildPublicOrderItems(list);
  const totalProductsCount = items.length;
  const totalUnitsCount = items.reduce((sum, it) => sum + it.requestedQuantity, 0);

  const status: PublicOrderStatus = list.status === 'CANCELLED' ? 'CANCELLED' : (list.providerResponse ? 'CONFIRMED_BY_PROVIDER' : 'PENDING');
  const statusLabel = status === 'CANCELLED'
    ? 'Este pedido fue cancelado'
    : status === 'CONFIRMED_BY_PROVIDER'
    ? 'Pedido confirmado por proveedor'
    : 'Pedido pendiente';

  const publicOrderData: Record<string, any> = {
    id: token,
    token: token,
    publicCode: publicCode,
    businessName: cleanBusiness,
    requestCode: reqCode,
    createdAt: list.exportedAt || list.createdAt || now,
    requestedBy: requestedBy,
    status: status,
    statusLabel: statusLabel,
    items: items,
    totalProductsCount,
    totalUnitsCount,
    updatedAt: now,
    businessRefId: list.businessId,
    orderRefId: list.id
  };

  if (list.supplierName && list.supplierName.trim().length > 0) {
    publicOrderData.supplierName = list.supplierName.trim();
  }
  if (list.notes && list.notes.trim().length > 0) {
    publicOrderData.notes = list.notes.trim();
  }
  if (list.cancelledAt) {
    publicOrderData.cancelledAt = list.cancelledAt;
  }
  if (list.providerResponse) {
    publicOrderData.providerResponse = sanitizeProviderResponseForFirestore(list.providerResponse);
    publicOrderData.providerConfirmedAt = list.providerConfirmedAt || list.providerResponse.confirmedAt;
    publicOrderData.totalUnitsConfirmed = list.providerResponse.totalUnitsConfirmed;
    const note = list.providerNote || list.providerResponse.providerNote;
    if (note && note.trim().length > 0) {
      publicOrderData.providerNote = note.trim();
    }
  }

  // 1. Save to public_orders collection (keyed by secure token)
  const publicOrderRef = doc(db, 'public_orders', token);
  await setDoc(publicOrderRef, sanitizeForFirestore(publicOrderData));

  // 2. Save to public_code_index collection (maps publicCode -> secure token)
  try {
    const codeIndexRef = doc(db, 'public_code_index', publicCode);
    await setDoc(codeIndexRef, sanitizeForFirestore({
      publicCode: publicCode,
      token: token,
      requestCode: reqCode,
      businessRefId: list.businessId,
      orderRefId: list.id,
      createdAt: now,
      updatedAt: now
    }));
  } catch (err) {
    console.warn('Could not write public_code_index mapping:', err);
  }

  // 3. Update replenishment list with the publicShareToken, publicShareCode & short URL
  const publicUrl = getPublicOrderUrl(publicCode);
  if (list.id && list.businessId) {
    try {
      const repRef = doc(db, 'replenishment_lists', list.id);
      await updateDoc(repRef, sanitizeForFirestore({
        publicShareToken: token,
        publicShareCode: publicCode,
        publicShareUrl: publicUrl,
        publicShareCreatedAt: list.publicShareCreatedAt || now,
        updatedAt: now
      }));
    } catch (err) {
      console.warn('Could not update replenishment_list with publicShareToken:', err);
    }
  }

  // 4. Log Audit
  if (userId && list.businessId) {
    try {
      await logAdminAction({
        businessId: list.businessId,
        adminId: userId,
        adminEmail: userName || 'Usuario',
        targetUserId: userId,
        action: 'PEDIDO_ONLINE_CREATED',
        details: `Pedido online generado para Solicitud ${reqCode} (${list.supplierName || 'Sin proveedor'})`
      });
    } catch (auditErr) {
      console.warn('Audit log error for public order creation:', auditErr);
    }
  }

  return {
    token,
    publicCode,
    url: publicUrl,
    order: publicOrderData as PublicOrder
  };
}

/**
 * Fetches a PublicOrder by either:
 * 1. Short publicCode: e.g. "SOL-000125" (via public_code_index resolution)
 * 2. Legacy secure token: e.g. "a8F7kP2xQ9mL7sD4kP9xT2..." (direct lookup in public_orders)
 * 
 * Returns null if not found or invalid.
 */
export async function getPublicOrder(identifier: string): Promise<PublicOrder | null> {
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    return null;
  }
  const cleanId = identifier.trim();

  try {
    // 1. Try public_code_index first (for short URLs: /pedido/SOL-000125)
    try {
      const codeSnap = await getDoc(doc(db, 'public_code_index', cleanId));
      if (codeSnap.exists()) {
        const indexData = codeSnap.data();
        if (indexData?.token) {
          const orderSnap = await getDoc(doc(db, 'public_orders', indexData.token));
          if (orderSnap.exists()) {
            return { id: orderSnap.id, ...orderSnap.data() } as PublicOrder;
          }
        }
      }
    } catch {
      // Fall through if index not found
    }

    // 2. Direct lookup in public_orders (for legacy long tokens: /pedido/a8F7kP2xQ9...)
    try {
      const directSnap = await getDoc(doc(db, 'public_orders', cleanId));
      if (directSnap.exists()) {
        return { id: directSnap.id, ...directSnap.data() } as PublicOrder;
      }
    } catch {
      // Fall through
    }

    // 3. Try upper-case variation in public_code_index (e.g. sol-000125 -> SOL-000125)
    const upperId = cleanId.toUpperCase();
    if (upperId !== cleanId) {
      try {
        const upperSnap = await getDoc(doc(db, 'public_code_index', upperId));
        if (upperSnap.exists()) {
          const indexData = upperSnap.data();
          if (indexData?.token) {
            const orderSnap = await getDoc(doc(db, 'public_orders', indexData.token));
            if (orderSnap.exists()) {
              return { id: orderSnap.id, ...orderSnap.data() } as PublicOrder;
            }
          }
        }
      } catch {
        // Fall through
      }
    }

    return null;
  } catch (error) {
    console.error('Error fetching public order with identifier:', error);
    return null;
  }
}

export interface ConfirmProviderInputItem {
  productId?: string;
  productName: string;
  requestedQuantity: number;
  confirmedQuantity: number;
  unitText?: string;
  category?: string;
}

/**
 * Confirms the quantities a supplier can deliver for a public order.
 * 
 * Invariants:
 * 1. Does NOT modify products stock or inventory movements.
 * 2. Does NOT overwrite original requestedQuantity on the replenishment order.
 * 3. Enforces valid non-negative numbers (>= 0).
 * 4. Single-use: once confirmed, locks response.
 * 5. Rejects if order is cancelled.
 */
export async function confirmPublicOrderByProvider(
  identifier: string,
  itemsInput: ConfirmProviderInputItem[],
  providerNote?: string
): Promise<ProviderOrderResponse> {
  const cleanIdentifier = sanitizeString(identifier, 100);
  if (!cleanIdentifier) {
    throw new Error('Identificador de pedido inválido.');
  }

  // Rate limiting: max 6 confirmation requests per minute per identifier
  const rateLimit = checkRateLimit(`prov_conf_${cleanIdentifier}`, 6, 60000);
  if (!rateLimit.allowed) {
    throw new Error('Demasiadas solicitudes de confirmación. Por favor aguarde un momento antes de reintentar.');
  }

  return withActionLock(`prov_conf_lock_${cleanIdentifier}`, async () => {
    const existingOrder = await getPublicOrder(cleanIdentifier);
    if (!existingOrder) {
      throw new Error('No se encontró el pedido o el enlace no es válido.');
    }

    if (existingOrder.status === 'CANCELLED') {
      throw new Error('Este pedido fue cancelado por el comercio y no puede ser confirmado.');
    }

    if (existingOrder.status === 'CONFIRMED_BY_PROVIDER' && existingOrder.providerResponse) {
      throw new Error('Este pedido ya fue confirmado previamente.');
    }

    if (existingOrder.status === 'RECEIVED') {
      throw new Error('Este pedido ya fue recibido en el local comercial.');
    }

    const now = new Date().toISOString();
    const cleanNote = sanitizeString(providerNote || '', 1000);

    // Validate & build items
    let completeCount = 0;
    let partialCount = 0;
    let noStockCount = 0;
    let totalUnitsConfirmed = 0;
    let totalUnitsRequested = 0;

    const responseItems: ProviderResponseItem[] = itemsInput.map((it) => {
      const reqQty = sanitizeNumber(it.requestedQuantity, 0, 999999, 0);
      let confQty = sanitizeNumber(it.confirmedQuantity, 0, 999999, 0);

      totalUnitsRequested += reqQty;
      totalUnitsConfirmed += confQty;

      let itemStatus: ProviderResponseItem['status'] = 'COMPLETE';
      if (confQty === 0) {
        itemStatus = 'NO_STOCK';
        noStockCount++;
      } else if (confQty < reqQty) {
        itemStatus = 'PARTIAL';
        partialCount++;
      } else if (confQty > reqQty) {
        itemStatus = 'SURPLUS';
        completeCount++;
      } else {
        itemStatus = 'COMPLETE';
        completeCount++;
      }

      return {
        productId: it.productId ? sanitizeString(it.productId, 64) : undefined,
        productName: sanitizeString(it.productName, 150),
        requestedQuantity: reqQty,
        confirmedQuantity: confQty,
        unitText: it.unitText ? sanitizeString(it.unitText, 32) : undefined,
        category: it.category ? sanitizeString(it.category, 80) : undefined,
        status: itemStatus
      };
    });

    const responseObj: ProviderOrderResponse = {
      id: existingOrder.token,
      replenishmentId: existingOrder.orderRefId,
      publicOrderCode: existingOrder.publicCode || existingOrder.requestCode,
      status: 'CONFIRMED',
      items: responseItems,
      ...(cleanNote.length > 0 ? { providerNote: cleanNote } : {}),
      confirmedAt: now,
      totalProductsCount: responseItems.length,
      totalUnitsRequested,
      totalUnitsConfirmed,
      completeCount,
      partialCount,
      noStockCount
    };

    // Validate and sanitize the provider response object for Firestore
    const sanitizedResponse = sanitizeProviderResponseForFirestore(responseObj);

    // 1. Update public_orders document
    const orderDocRef = doc(db, 'public_orders', existingOrder.token);
    const publicOrderUpdate: Record<string, any> = {
      status: 'CONFIRMED_BY_PROVIDER',
      statusLabel: 'Pedido confirmado por proveedor',
      providerResponse: sanitizedResponse,
      providerConfirmedAt: now,
      totalUnitsConfirmed: totalUnitsConfirmed,
      updatedAt: now
    };
    if (cleanNote.length > 0) {
      publicOrderUpdate.providerNote = cleanNote;
    }

    await updateDoc(orderDocRef, sanitizeForFirestore(publicOrderUpdate));

    // 2. Write dedicated response document to provider_responses
    try {
      const respDocRef = doc(db, 'provider_responses', existingOrder.token);
      const dedicatedRespData = sanitizeForFirestore({
        ...sanitizedResponse,
        businessRefId: existingOrder.businessRefId,
        orderRefId: existingOrder.orderRefId,
        requestCode: existingOrder.requestCode,
        createdAt: now,
        updatedAt: now
      });
      await setDoc(respDocRef, dedicatedRespData);
    } catch (err) {
      console.warn('Could not write to provider_responses collection:', err);
    }

    // 3. Update replenishment list if possible
    if (existingOrder.orderRefId) {
      try {
        const repRef = doc(db, 'replenishment_lists', existingOrder.orderRefId);
        const repUpdate: Record<string, any> = {
          providerResponse: sanitizedResponse,
          providerStatus: 'CONFIRMED',
          providerConfirmedAt: now,
          updatedAt: now
        };
        if (cleanNote.length > 0) {
          repUpdate.providerNote = cleanNote;
        }
        await updateDoc(repRef, sanitizeForFirestore(repUpdate));
      } catch (repErr) {
        console.warn('Could not sync provider response to replenishment_lists document directly (may require authenticated session):', repErr);
      }
    }

    // 4. Log Audit Event if businessRefId is present
    if (existingOrder.businessRefId) {
      try {
        await logAdminAction({
          businessId: existingOrder.businessRefId,
          adminId: 'PROVIDER_PUBLIC_SYSTEM',
          adminEmail: existingOrder.supplierName || 'Proveedor',
          targetUserId: 'PUBLIC_ORDER',
          action: 'PROVIDER_ORDER_CONFIRMED',
          details: `Proveedor confirmó pedido #${existingOrder.requestCode} (${totalUnitsConfirmed}/${totalUnitsRequested} un. - ${completeCount} completos, ${partialCount} parciales, ${noStockCount} sin stock)`
        });

        if (partialCount > 0) {
          await logAdminAction({
            businessId: existingOrder.businessRefId,
            adminId: 'PROVIDER_PUBLIC_SYSTEM',
            adminEmail: existingOrder.supplierName || 'Proveedor',
            targetUserId: 'PUBLIC_ORDER',
            action: 'PROVIDER_CONFIRMED_PARTIAL',
            details: `Proveedor confirmó entrega parcial en ${partialCount} productos del pedido #${existingOrder.requestCode}`
          });
        }

        if (noStockCount > 0) {
          await logAdminAction({
            businessId: existingOrder.businessRefId,
            adminId: 'PROVIDER_PUBLIC_SYSTEM',
            adminEmail: existingOrder.supplierName || 'Proveedor',
            targetUserId: 'PUBLIC_ORDER',
            action: 'PROVIDER_CONFIRMED_NO_STOCK',
            details: `Proveedor informó sin stock en ${noStockCount} productos del pedido #${existingOrder.requestCode}`
          });
        }
      } catch (auditErr) {
        console.warn('Could not log audit for provider confirmation:', auditErr);
      }
    }

    return responseObj;
  });
}

/**
 * Updates public order status (e.g. when cancelled or when received in store)
 */
export async function updatePublicOrderStatus(
  tokenOrCodeOrReplenishmentId: string,
  status: PublicOrderStatus,
  extraData?: Partial<PublicOrder>
): Promise<void> {
  try {
    const now = new Date().toISOString();
    let token = tokenOrCodeOrReplenishmentId;

    // 1. Check if passed string is directly a token in public_orders
    const directDoc = await getDoc(doc(db, 'public_orders', token));
    if (!directDoc.exists()) {
      // 2. Check if passed string is a publicCode in public_code_index
      const indexDoc = await getDoc(doc(db, 'public_code_index', token));
      if (indexDoc.exists()) {
        token = indexDoc.data().token;
      } else {
        // 3. Try querying by orderRefId
        const q = query(
          collection(db, 'public_orders'),
          where('orderRefId', '==', tokenOrCodeOrReplenishmentId)
        );
        const snap = await getDocs(q);
        if (snap.empty) return;
        token = snap.docs[0].id;
      }
    }

    const docRef = doc(db, 'public_orders', token);
    const statusLabel = status === 'CANCELLED'
      ? 'Este pedido fue cancelado'
      : status === 'CONFIRMED_BY_PROVIDER'
      ? 'Pedido confirmado por proveedor'
      : status === 'RECEIVED'
      ? 'Pedido recibido'
      : 'Pedido pendiente';

    const updatePayload: Record<string, any> = {
      status,
      statusLabel,
      updatedAt: now,
      ...(status === 'CANCELLED' ? { cancelledAt: now } : {}),
      ...(status === 'RECEIVED' ? { receivedAt: now } : {}),
      ...(extraData ? sanitizeForFirestore(extraData) : {})
    };

    await updateDoc(docRef, sanitizeForFirestore(updatePayload));
  } catch (err) {
    console.warn('Error updating public order status:', err);
  }
}

export interface ShareOnlineOrderResult {
  status: 'shared' | 'copied' | 'cancelled' | 'manual_copy' | 'error';
  url: string;
  message?: string;
}

/**
 * Shares the online order link via the Web Share API (native WhatsApp / apps chooser)
 * or falls back cleanly to clipboard copy with the formatted short URL.
 */
export async function sharePublicOrderLink(
  order: PublicOrder | { token: string; publicCode?: string; requestCode: string; businessName: string; supplierName?: string; totalProductsCount?: number; totalUnitsCount?: number; createdAt?: string }
): Promise<ShareOnlineOrderResult> {
  const visibleCode = (order as any).publicCode || order.requestCode || order.token;
  const url = getPublicOrderUrl(visibleCode);
  const cleanBusiness = order.businessName || 'MiniMarket';
  const reqCode = order.requestCode || visibleCode;

  // Format date
  const now = new Date();
  let dateFormatted = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
  if (order.createdAt) {
    try {
      const d = new Date(order.createdAt);
      if (!isNaN(d.getTime())) {
        dateFormatted = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    } catch {
      // Keep today's date formatted
    }
  }

  const shareTitle = '📦 Pedido de productos';
  const shareText = `Pedido de productos de ${cleanBusiness}

Solicitud: ${reqCode}

${dateFormatted}

Podés consultar y confirmar las cantidades desde este enlace:

${url}`;

  // 1. Primary mobile-first path: navigator.share()
  if (
    typeof navigator !== 'undefined' &&
    typeof navigator.share === 'function'
  ) {
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: url
      });
      return {
        status: 'shared',
        url
      };
    } catch (err: any) {
      // 2. Cancellation handling: AbortError should be silent
      if (
        err?.name === 'AbortError' ||
        err?.message?.toLowerCase().includes('abort') ||
        err?.message?.toLowerCase().includes('cancel') ||
        err?.message?.toLowerCase().includes('dismiss')
      ) {
        return {
          status: 'cancelled',
          url
        };
      }

      // 3. Fallback to clipboard if share threw a non-abort error (e.g. iframe policy or permission)
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(url);
          return {
            status: 'copied',
            url,
            message: '✓ Enlace copiado'
          };
        }
      } catch {
        // Clipboard writeText failed
      }

      return {
        status: 'manual_copy',
        url,
        message: 'Copiá el enlace manualmente.'
      };
    }
  }

  // 4. Desktop / browser fallback when navigator.share is unavailable
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(url);
      return {
        status: 'copied',
        url,
        message: '✓ Enlace copiado'
      };
    }
  } catch {
    // Clipboard unavailable or denied
  }

  // 5. Fallback when clipboard is also unavailable
  return {
    status: 'manual_copy',
    url,
    message: 'Copiá el enlace manualmente.'
  };
}
