import { getMercadoPagoConfig } from './config.js';
import { MercadoPagoConfig, MercadoPagoOrderItem, MercadoPagoSource } from './types.js';
import { orderRegistry } from './orderRegistry.js';

export interface CreateRealOrderInput {
  businessId?: string;
  sellerId?: string;
  sellerName?: string;
  external_reference: string;
  total_amount: number;
  items?: Array<{
    title: string;
    unit_price: number;
    quantity: number;
    unit_measure?: string;
    total_amount?: number;
    external_code?: string;
  }>;
  title?: string;
  description?: string;
  notification_url?: string;
  mercadoPagoSource?: MercadoPagoSource;
  pointTerminalId?: string;
  pointModel?: 'POINT_SMART_1' | 'POINT_SMART_2';
}

export interface CreateRealOrderResult {
  success: boolean;
  status: 'CREATED' | 'DISABLED' | 'ERROR' | 'INVALID_INPUT' | 'TERMINAL_BUSY';
  message: string;
  external_reference?: string;
  total_amount?: number;
  autoConfirm?: boolean;
  orderId?: string;
  mercadoPagoSource?: MercadoPagoSource;
  details?: string;
}

/**
 * Creates a REAL In-Store QR Order in Mercado Pago for the active POS.
 * Uses exact cart items and amounts from MiniMarket POS.
 */
export async function createRealMercadoPagoOrder(
  input: CreateRealOrderInput,
  customConfig?: MercadoPagoConfig,
  timeoutMs = 6000
): Promise<CreateRealOrderResult> {
  const config = customConfig || getMercadoPagoConfig(input.businessId);

  // 1. Check if integration is enabled
  if (!config.enabled) {
    return {
      success: false,
      status: 'DISABLED',
      message: 'La integración de Mercado Pago no está habilitada en el servidor.',
    };
  }

  // 2. Validate Access Token
  if (!config.accessToken || config.accessToken.trim().length === 0) {
    return {
      success: false,
      status: 'ERROR',
      message: 'Access Token de Mercado Pago no configurado en el servidor.',
    };
  }

  // 3. Validate external_reference
  const cleanRef = String(input.external_reference || '').trim();
  if (!cleanRef) {
    return {
      success: false,
      status: 'INVALID_INPUT',
      message: 'external_reference es obligatorio y debe ser único.',
    };
  }

  // 4. Validate total_amount and items
  const totalAmount = Number(input.total_amount);
  if (isNaN(totalAmount) || totalAmount <= 0) {
    return {
      success: false,
      status: 'INVALID_INPUT',
      message: `Monto total inválido: ${input.total_amount}`,
    };
  }

  const rawItems = Array.isArray(input.items) && input.items.length > 0
    ? input.items
    : [{
        title: input.title || input.description || 'Cobro MiniMarket',
        unit_price: totalAmount,
        quantity: 1,
        total_amount: totalAmount,
      }];

  // Sanitize and validate items
  let calculatedSum = 0;
  const sanitizedItems: MercadoPagoOrderItem[] = [];

  for (const it of rawItems) {
    const title = String(it.title || 'Producto').trim().slice(0, 255);
    const unitPrice = Number(it.unit_price);
    const quantity = Number(it.quantity);

    if (isNaN(unitPrice) || unitPrice < 0) {
      return {
        success: false,
        status: 'INVALID_INPUT',
        message: `Precio unitario inválido para "${title}": ${it.unit_price}`,
      };
    }

    if (isNaN(quantity) || quantity <= 0) {
      return {
        success: false,
        status: 'INVALID_INPUT',
        message: `Cantidad inválida para "${title}": ${it.quantity}`,
      };
    }

    const itemTotal = it.total_amount !== undefined ? Number(it.total_amount) : unitPrice * quantity;
    calculatedSum += itemTotal;

    sanitizedItems.push({
      title,
      unit_price: unitPrice,
      quantity,
      total_amount: itemTotal,
      description: it.external_code ? `Código: ${it.external_code}` : undefined,
    });
  }

  // Server-side check: sum of items must equal total amount
  if (Math.abs(calculatedSum - totalAmount) > 0.05) {
    return {
      success: false,
      status: 'INVALID_INPUT',
      message: `La suma de los items ($${calculatedSum}) no coincide con el total de la orden ($${totalAmount}).`,
    };
  }

  const mpSource: MercadoPagoSource = input.mercadoPagoSource || 'STATIC_POS_QR';
  const isPoint = mpSource === 'POINT_SMART' || mpSource === 'POINT_GENERATED_QR';

  // 5. Build MP Order payload and select endpoint based on modality
  const userId = config.userId || '3634603825';
  const externalPosId = config.externalPosId || 'MINIMARKETPOCCAJA01';
  const pointTerminalId = input.pointTerminalId || config.pointTerminalId || 'SMARTPOS-POC-01';
  const pointModel = input.pointModel || config.pointModel || 'POINT_SMART_1';
  const apiBaseUrl = (config.apiBaseUrl || 'https://api.mercadopago.com').replace(/\/+$/, '');

  const pointLabel = pointModel === 'POINT_SMART_2' ? 'Point Smart 2' : 'Point Smart 1';

  // Check if Point Terminal is currently busy with another active payment
  if (isPoint && orderRegistry.isTerminalBusy(pointTerminalId, cleanRef)) {
    return {
      success: false,
      status: 'TERMINAL_BUSY',
      message: `La terminal ${pointLabel} (${pointTerminalId}) está ocupada con otra operación en curso. Por favor, espere o utilice el QR Físico de Caja.`,
      details: 'TERMINAL_BUSY',
    };
  }

  // Register in active order store
  orderRegistry.registerOrder({
    external_reference: cleanRef,
    total_amount: totalAmount,
    itemsCount: sanitizedItems.length,
    status: 'WAITING_PAYMENT',
    autoConfirmed: config.autoConfirm,
    createdAt: new Date().toISOString(),
    externalPosId: isPoint ? undefined : externalPosId,
    posId: isPoint ? pointTerminalId : config.posId,
    pointTerminalId: isPoint ? pointTerminalId : undefined,
    sellerName: input.sellerName,
    mercadoPagoSource: mpSource,
  });

  let endpoint = '';
  let method = 'POST';
  let payload: any = {};

  if (isPoint) {
    // Official Mercado Pago Orders API for Point Smart 1 & 2 (/v1/orders)
    endpoint = `${apiBaseUrl}/v1/orders`;
    method = 'POST';
    payload = {
      type: 'point',
      external_reference: cleanRef,
      description: input.description || `Cobro en terminal ${pointLabel} MiniMarket`,
      transactions: {
        payments: [
          {
            amount: totalAmount.toFixed(2),
          },
        ],
      },
      config: {
        point: {
          terminal_id: pointTerminalId,
          print_on_terminal: 'no_ticket',
        },
      },
      ...(input.notification_url ? { notification_url: input.notification_url } : {}),
    };
  } else {
    // In-Store Static QR Orders API
    endpoint = `${apiBaseUrl}/instore/qr/seller/collectors/${encodeURIComponent(userId)}/pos/${encodeURIComponent(externalPosId)}/orders`;
    method = 'PUT';
    payload = {
      external_reference: cleanRef,
      title: input.title || 'Venta MiniMarket',
      description: input.description || 'Cobro en POS MiniMarket',
      total_amount: totalAmount,
      items: sanitizedItems.map((item, idx) => ({
        title: item.title,
        unit_price: item.unit_price,
        quantity: item.quantity,
        unit_measure: 'unit',
        total_amount: item.total_amount,
        ...(rawItems[idx]?.external_code ? { external_code: String(rawItems[idx].external_code).slice(0, 100) } : {}),
      })),
      ...(input.notification_url ? { notification_url: input.notification_url } : {}),
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': 'MiniMarket-POS/1.0',
    };
    if (isPoint) {
      headers['X-Idempotency-Key'] = cleanRef;
    }

    const response = await fetch(endpoint, {
      method,
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // API returns 204 No Content, 200 OK, or 201 Created on success
    if (response.ok || response.status === 204 || response.status === 200 || response.status === 201) {
      let data: any = {};
      try {
        if (response.status !== 204) {
          data = await response.json();
        }
      } catch {
        // 204 has no body, ignore json parse
      }

      const generatedOrderId = data?.id || data?.order_id || data?.in_store_order_id;
      if (generatedOrderId) {
        orderRegistry.updateOrderStatus(cleanRef, {
          orderId: String(generatedOrderId),
        });
      }

      return {
        success: true,
        status: 'CREATED',
        message: isPoint
          ? `Orden enviada a terminal ${pointLabel} (${pointTerminalId}).`
          : 'Order creada exitosamente en Mercado Pago.',
        external_reference: cleanRef,
        total_amount: totalAmount,
        autoConfirm: config.autoConfirm,
        orderId: generatedOrderId ? String(generatedOrderId) : undefined,
        mercadoPagoSource: mpSource,
      };
    }

    // Handle error response without exposing sensitive tokens
    let errorText = '';
    try {
      errorText = await response.text();
    } catch {
      errorText = response.statusText;
    }

    let parsedMsg = `HTTP ${response.status}`;
    try {
      const jsonErr = JSON.parse(errorText);
      parsedMsg = jsonErr.message || jsonErr.error || parsedMsg;
    } catch {
      if (errorText && errorText.length < 150) parsedMsg += `: ${errorText}`;
    }

    // Clean up registry if the terminal rejected the order
    orderRegistry.updateOrderStatus(cleanRef, {
      status: 'FAILED',
      errorReason: parsedMsg,
    });

    return {
      success: false,
      status: 'ERROR',
      message: isPoint
        ? `No se pudo enviar la orden a la terminal ${pointLabel}. Intentá nuevamente o utilizá el QR Físico de Caja.`
        : 'No se pudo iniciar el cobro con Mercado Pago.',
      details: parsedMsg,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err?.name === 'AbortError') {
      return {
        success: false,
        status: 'ERROR',
        message: 'Tiempo de espera agotado al conectar con Mercado Pago.',
      };
    }

    return {
      success: false,
      status: 'ERROR',
      message: 'No se pudo conectar con Mercado Pago. Verifique su conexión.',
      details: err?.message || 'Error desconocido',
    };
  }
}

/**
 * Cancels an active order in Mercado Pago (Point or In-Store QR).
 */
export async function cancelMercadoPagoOrder(
  externalReferenceOrOrderId: string,
  businessId?: string
): Promise<{ success: boolean; message: string }> {
  const cleanId = String(externalReferenceOrOrderId || '').trim();
  if (!cleanId) {
    return { success: false, message: 'Identificador de orden requerido.' };
  }

  const config = getMercadoPagoConfig(businessId);
  const existingRecord = orderRegistry.getOrder(cleanId);

  // Update registry status to FAILED/EXPIRED so POS stops waiting
  if (existingRecord) {
    orderRegistry.updateOrderStatus(cleanId, {
      status: 'FAILED',
      errorReason: 'Orden cancelada por el vendedor en MiniMarket',
    });
  }

  if (!config.enabled || !config.accessToken) {
    return { success: true, message: 'Orden cancelada localmente.' };
  }

  const apiBaseUrl = (config.apiBaseUrl || 'https://api.mercadopago.com').replace(/\/+$/, '');

  try {
    const isPoint = existingRecord?.mercadoPagoSource === 'POINT_SMART' || existingRecord?.mercadoPagoSource === 'POINT_GENERATED_QR';
    if (isPoint && existingRecord?.orderId) {
      // Cancel Point order via Orders API: POST /v1/orders/{id}/cancel
      await fetch(`${apiBaseUrl}/v1/orders/${encodeURIComponent(existingRecord.orderId)}/cancel`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json',
        },
      });
    } else if (!isPoint && config.userId && config.externalPosId) {
      // Cancel In-Store QR order: DELETE /instore/qr/seller/collectors/{userId}/pos/{externalPosId}/orders
      await fetch(`${apiBaseUrl}/instore/qr/seller/collectors/${encodeURIComponent(config.userId)}/pos/${encodeURIComponent(config.externalPosId)}/orders`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${config.accessToken}`,
        },
      });
    }

    return { success: true, message: 'Orden cancelada exitosamente.' };
  } catch (err: any) {
    return { success: true, message: 'Orden cancelada localmente.' };
  }
}
