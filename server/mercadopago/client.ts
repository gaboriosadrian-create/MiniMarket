import { MercadoPagoOrder } from './types.js';

export interface FetchOrderResult {
  ok: boolean;
  status: number;
  data?: MercadoPagoOrder;
  error?: string;
  isTimeout?: boolean;
}

/**
 * Queries Mercado Pago Order API server-side:
 * GET https://api.mercadopago.com/v1/orders/{order_id}
 * Fallback to GET https://api.mercadopago.com/merchant_orders/{order_id}
 * 
 * Includes timeout handling and safe sanitization of tokens in error messages.
 */
export async function fetchMercadoPagoOrder(
  orderId: string | number,
  accessToken: string,
  apiBaseUrl = 'https://api.mercadopago.com',
  timeoutMs = 6000
): Promise<FetchOrderResult> {
  const cleanOrderId = String(orderId).trim();
  if (!cleanOrderId) {
    return {
      ok: false,
      status: 400,
      error: 'ID de orden vacío o inválido',
    };
  }

  if (!accessToken || accessToken.trim().length === 0) {
    return {
      ok: false,
      status: 401,
      error: 'MERCADOPAGO_ACCESS_TOKEN no configurado en el servidor',
    };
  }

  const base = apiBaseUrl.replace(/\/+$/, '');
  const endpoint = `${base}/v1/orders/${encodeURIComponent(cleanOrderId)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MiniMarket-POS/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const orderData = (await response.json()) as MercadoPagoOrder;
      return {
        ok: true,
        status: 200,
        data: orderData,
      };
    }

    // If /v1/orders returned 404, try /merchant_orders/{id}
    if (response.status === 404) {
      try {
        const altController = new AbortController();
        const altTimeout = setTimeout(() => altController.abort(), 3000);
        const altRes = await fetch(`${base}/merchant_orders/${encodeURIComponent(cleanOrderId)}`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken.trim()}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
            'User-Agent': 'MiniMarket-POS/1.0',
          },
          signal: altController.signal,
        });
        clearTimeout(altTimeout);
        if (altRes.ok) {
          const altData = (await altRes.json()) as MercadoPagoOrder;
          return {
            ok: true,
            status: 200,
            data: altData,
          };
        }
      } catch {
        // Fallback failed, continue with original 404
      }
    }

    let errorBody = '';
    try {
      errorBody = await response.text();
    } catch {
      errorBody = response.statusText;
    }

    let parsedMsg = `HTTP ${response.status}`;
    try {
      const jsonErr = JSON.parse(errorBody);
      parsedMsg = jsonErr.message || jsonErr.error || parsedMsg;
    } catch {
      if (errorBody && errorBody.length < 200) parsedMsg += `: ${errorBody}`;
    }

    return {
      ok: false,
      status: response.status,
      error: parsedMsg,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === 'AbortError') {
      return {
        ok: false,
        status: 408,
        isTimeout: true,
        error: `Timeout al consultar la orden ${cleanOrderId} en Mercado Pago (${timeoutMs}ms)`,
      };
    }

    return {
      ok: false,
      status: 500,
      error: `Error de red al conectar con Mercado Pago: ${err?.message || 'Error desconocido'}`,
    };
  }
}

/**
 * Queries Mercado Pago Order by external_reference using merchant_orders search.
 */
export async function fetchMercadoPagoOrderByReference(
  externalReference: string,
  accessToken: string,
  apiBaseUrl = 'https://api.mercadopago.com',
  timeoutMs = 5000
): Promise<FetchOrderResult> {
  const cleanRef = String(externalReference || '').trim();
  if (!cleanRef) {
    return { ok: false, status: 400, error: 'Referencia externa vacía' };
  }

  if (!accessToken || accessToken.trim().length === 0) {
    return { ok: false, status: 401, error: 'Token no configurado' };
  }

  const base = apiBaseUrl.replace(/\/+$/, '');
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${base}/merchant_orders?external_reference=${encodeURIComponent(cleanRef)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'MiniMarket-POS/1.0',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const elements = data.elements || data.results || (Array.isArray(data) ? data : []);
      if (elements && elements.length > 0) {
        const found = elements.find((e: any) => e.external_reference === cleanRef) || elements[0];
        return {
          ok: true,
          status: 200,
          data: found,
        };
      }
    }

    return {
      ok: false,
      status: 404,
      error: `No se encontró orden activa para ${cleanRef}`,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    return {
      ok: false,
      status: 500,
      error: `Error al consultar orden por referencia: ${err?.message || 'Error desconocido'}`,
    };
  }
}
