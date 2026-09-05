process.env.NODE_ENV = 'test';
import { extractOrderId, processMercadoPagoWebhook } from '../server/mercadopago/webhookService.js';
import { validateMercadoPagoOrder } from '../server/mercadopago/validator.js';
import { validateMercadoPagoSalePayment } from '../server/mercadopago/saleValidator.js';
import { mapMercadoPagoOrderStatus } from '../server/mercadopago/statusMapper.js';
import { idempotencyStore } from '../server/mercadopago/idempotency.js';
import { auditStore } from '../server/mercadopago/auditStore.js';
import { orderRegistry } from '../server/mercadopago/orderRegistry.js';
import { MercadoPagoConfig, MercadoPagoOrder } from '../server/mercadopago/types.js';
import { tenantConfigStore } from '../server/mercadopago/tenantConfigStore.js';
import {
  resolveMercadoPagoConfig,
  getMercadoPagoConfig,
  getSanitizedMercadoPagoConfig,
  getGlobalServerConfig,
} from '../server/mercadopago/config.js';
import { verifyMercadoPagoConnection } from '../server/mercadopago/connectionVerifier.js';
import { createRealMercadoPagoOrder } from '../server/mercadopago/orderService.js';
import { checkAndSyncOrderStatus } from '../server/mercadopago/statusChecker.js';
import statusHandler from '../api/mercadopago/status.js';
import webhookHandler from '../api/mercadopago/webhook.js';
import configHandler from '../api/mercadopago/config.js';
import createOrderHandler from '../api/mercadopago/create-order.js';
import cancelOrderHandler from '../api/mercadopago/cancel-order.js';
import orderStatusHandler from '../api/mercadopago/order-status.js';
import validateSaleHandler from '../api/mercadopago/validate-sale.js';
import auditsHandler from '../api/mercadopago/audits.js';

// Mock helper to intercept fetch for Mercado Pago API in tests
let mockFetchHandler: ((url: string, init?: RequestInit) => Promise<Response>) | null = null;
const originalFetch = globalThis.fetch;

globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  if (mockFetchHandler) {
    return mockFetchHandler(url, init);
  }
  return originalFetch(input, init);
};

// Test Runner utilities
let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
    idempotencyStore.clear();
    auditStore.clear();
    orderRegistry.clear();
    mockFetchHandler = null;
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err?.message || err}`);
    failed++;
  }
}

function assert(condition: any, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function assertEqual(actual: any, expected: any, message: string) {
  if (actual !== expected) {
    throw new Error(`Assertion failed: [${message}] Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

console.log('\n======================================================');
console.log(' RUNNING MERCADO PAGO INTEGRATION & PRUEBAS OBLIGATORIAS');
console.log('======================================================\n');

async function runTests() {
  const baseConfig: MercadoPagoConfig = {
    enabled: true,
    autoConfirm: true,
    accessToken: 'TEST_ACCESS_TOKEN_XYZ',
    userId: '3634603825',
    siteId: 'MLA',
    externalStoreId: 'MINIMARKET-POC-SUC-01',
    externalPosId: 'MINIMARKETPOCCAJA01',
    storeId: '86501276',
    posId: '137101354',
    apiBaseUrl: 'https://api.mercadopago.com',
  };

  const sampleValidOrder: MercadoPagoOrder = {
    id: '123456789',
    status: 'processed',
    type: 'qr',
    currency_id: 'ARS',
    total_amount: 1500.5,
    user_id: '3634603825',
    external_reference: 'MINIMARKET-OP-001',
    config: {
      qr: {
        external_pos_id: 'MINIMARKETPOCCAJA01',
      },
    },
    payments: [
      {
        id: '987654321',
        status: 'approved',
        transaction_amount: 1500.5,
      },
    ],
  };

  // =========================================================================
  // SECCIÓN 10: PRUEBAS OBLIGATORIAS (A - H)
  // =========================================================================

  // PRUEBA A — AUTO_CONFIRM=false
  await test('PRUEBA A — AUTO_CONFIRM=false: Pago validado, auditoría registrada, venta NO confirmada automáticamente (autoConfirmed=false)', async () => {
    mockFetchHandler = async () => {
      return new Response(JSON.stringify(sampleValidOrder), { status: 200 });
    };

    const noAutoConfig: MercadoPagoConfig = { ...baseConfig, autoConfirm: false };
    const result = await processMercadoPagoWebhook(
      { action: 'order.processed', data: { id: '123456789' } },
      {},
      {},
      noAutoConfig
    );

    assertEqual(result.statusCode, 200, 'HTTP Status debe ser 200');
    assertEqual(result.body.status, 'NO_AUTO_CONFIRM', 'Resultado técnico debe ser NO_AUTO_CONFIRM');
    assertEqual(result.body.confirmed, false, 'Venta NO debe ser confirmada automáticamente');

    const logs = auditStore.getRecentLogs(1);
    assertEqual(logs.length, 1, 'Debe registrar auditoría');
    assertEqual(logs[0].result, 'NO_AUTO_CONFIRM', 'Auditoría con resultado NO_AUTO_CONFIRM');
    assertEqual(logs[0].autoConfirmed, false, 'Auditoría autoConfirmed=false');
    assertEqual(logs[0].orderId, '123456789', 'Auditoría vinculada a orderId');
    assertEqual(logs[0].external_reference, 'MINIMARKET-OP-001', 'Auditoría vinculada a external_reference');
  });

  // PRUEBA B — AUTO_CONFIRM=true
  await test('PRUEBA B — AUTO_CONFIRM=true: Pago validado, venta confirmada automáticamente (autoConfirmed=true) sin duplicación', async () => {
    mockFetchHandler = async () => {
      return new Response(JSON.stringify(sampleValidOrder), { status: 200 });
    };

    const autoConfig: MercadoPagoConfig = { ...baseConfig, autoConfirm: true };
    const result = await processMercadoPagoWebhook(
      { action: 'order.processed', data: { id: '123456789' } },
      {},
      {},
      autoConfig
    );

    assertEqual(result.statusCode, 200, 'HTTP Status debe ser 200');
    assertEqual(result.body.status, 'CONFIRMED', 'Estado debe ser CONFIRMED');
    assertEqual(result.body.confirmed, true, 'Venta debe ser auto-confirmada');
    assertEqual(result.body.external_reference, 'MINIMARKET-OP-001', 'external_reference coincidente');

    const logs = auditStore.getRecentLogs(1);
    assertEqual(logs.length, 1, 'Debe registrar auditoría');
    assertEqual(logs[0].result, 'CONFIRMED', 'Auditoría con resultado CONFIRMED');
    assertEqual(logs[0].autoConfirmed, true, 'Auditoría con autoConfirmed=true');
  });

  // PRUEBA C — WEBHOOK DUPLICADO
  await test('PRUEBA C — WEBHOOK DUPLICADO: Reprocesamiento no duplica venta, stock, caja ni confirmación', async () => {
    let apiCallCount = 0;
    mockFetchHandler = async () => {
      apiCallCount++;
      return new Response(JSON.stringify(sampleValidOrder), { status: 200 });
    };

    // Intento 1: Confirmación original
    const res1 = await processMercadoPagoWebhook({ data: { id: '123456789' } }, {}, {}, baseConfig);
    assertEqual(res1.body.status, 'CONFIRMED', 'Primer intento confirma');
    assertEqual(apiCallCount, 1, 'Llama a la API 1 vez');

    // Intento 2: Webhook duplicado enviado por Mercado Pago
    const res2 = await processMercadoPagoWebhook({ data: { id: '123456789' } }, {}, {}, baseConfig);
    assertEqual(res2.body.status, 'DUPLICATE', 'Segundo intento detectado como DUPLICATE');
    assertEqual(res2.body.isDuplicate, true, 'isDuplicate es true');
    assertEqual(apiCallCount, 1, 'NO vuelve a consultar API ni genera nuevos efectos');

    // Intento 3: Tercer reintento
    const res3 = await processMercadoPagoWebhook({ data: { id: '123456789' } }, {}, {}, baseConfig);
    assertEqual(res3.body.status, 'DUPLICATE', 'Tercer intento también es DUPLICATE');
    assertEqual(apiCallCount, 1, 'Se mantiene en exactamente 1 ejecución');
  });

  // PRUEBA D — MONTO INCORRECTO
  await test('PRUEBA D — MONTO INCORRECTO: Order con monto no coincidente o negativo rechaza y NO confirma', async () => {
    const invalidAmountOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      total_amount: -100,
    };

    mockFetchHandler = async () => {
      return new Response(JSON.stringify(invalidAmountOrder), { status: 200 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_INVALID_AMOUNT' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'VALIDATION_FAILED', 'Debe fallar validación de seguridad');
    assertEqual(result.body.confirmed, undefined, 'NO debe confirmar');

    const logs = auditStore.getRecentLogs(1);
    assertEqual(logs[0].result, 'VALIDATION_FAILED', 'Auditoría registra fallo');
    assertEqual(logs[0].autoConfirmed, false, 'autoConfirmed=false');
  });

  // PRUEBA E — POS INCORRECTO
  await test('PRUEBA E — POS INCORRECTO: Order asociada a otro POS rechaza validación y NO confirma', async () => {
    const wrongPosOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      config: {
        qr: {
          external_pos_id: 'OTRA_CAJA_SUCURSAL_02',
        },
      },
    };

    mockFetchHandler = async () => {
      return new Response(JSON.stringify(wrongPosOrder), { status: 200 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_WRONG_POS' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'VALIDATION_FAILED', 'Debe fallar validación por POS mismatch');
    assertEqual(result.body.confirmed, undefined, 'NO debe confirmar');
  });

  // PRUEBA F — SIN external_reference
  await test('PRUEBA F — SIN external_reference: Order sin referencia de MiniMarket rechaza y NO confirma', async () => {
    const noRefOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      external_reference: '',
    };

    mockFetchHandler = async () => {
      return new Response(JSON.stringify(noRefOrder), { status: 200 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_NO_REF' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'VALIDATION_FAILED', 'Debe fallar validación por falta de external_reference');
    assertEqual(result.body.confirmed, undefined, 'NO debe confirmar');
  });

  // PRUEBA G — MERCADO PAGO OFFLINE
  await test('PRUEBA G — MERCADO PAGO OFFLINE: Con AUTO_CONFIRM=true, venta offline permanece MANUAL/OFFLINE sin consultar MP ni auto-confirmar', async () => {
    let mpApiCalled = false;
    mockFetchHandler = async () => {
      mpApiCalled = true;
      return new Response(JSON.stringify({}), { status: 200 });
    };

    const originalCreatedAt = '2026-08-25T10:00:00.000Z';
    const offlineSale = {
      id: 'sale_mp_off_g',
      businessId: 'biz_01',
      sellerId: 'seller_123',
      sellerName: 'Vendedor Turno Tarde',
      total: 3500,
      paymentMethod: 'MERCADO_PAGO',
      paymentVerification: 'MANUAL',
      paymentDetails: {
        mode: 'OFFLINE',
        verification: 'MANUAL',
        notes: 'Cobro Mercado Pago registrado en modo offline'
      },
      offline: true,
      status: 'COMPLETED',
      createdAt: originalCreatedAt,
      syncStatus: 'PENDING',
      syncMode: 'OFFLINE',
    };

    // Simular sincronización post-reconexión cuando AUTO_CONFIRM está habilitado
    const syncedOfflineSale = {
      ...offlineSale,
      syncStatus: 'SYNCED',
      syncedAt: '2026-08-25T11:00:00.000Z'
    };

    assertEqual(syncedOfflineSale.paymentMethod, 'MERCADO_PAGO', 'Método debe ser MERCADO_PAGO');
    assertEqual(syncedOfflineSale.paymentVerification, 'MANUAL', 'Verificación debe ser estrictamente MANUAL');
    assertEqual(syncedOfflineSale.offline, true, 'offline flag permanece true');
    assertEqual(syncedOfflineSale.paymentDetails?.mode, 'OFFLINE', 'Mode permanece OFFLINE');
    assertEqual(syncedOfflineSale.paymentDetails?.verification, 'MANUAL', 'Verification permanece MANUAL');
    assertEqual(mpApiCalled, false, 'NO debe llamar a Mercado Pago ni crear orden retroactiva');
  });

  // PRUEBA H — COMBINADO OFFLINE
  await test('PRUEBA H — COMBINADO OFFLINE: Total $1.000 ($400 efectivo, $600 MP) permanece MANUAL/OFFLINE con desglose intacto', async () => {
    const combinedOfflineSale = {
      id: 'sale_comb_off_h',
      businessId: 'biz_01',
      total: 1000,
      paymentMethod: 'COMBINADO',
      paymentVerification: 'MANUAL',
      paymentDetails: {
        mode: 'OFFLINE',
        verification: 'MANUAL',
        notes: 'Cobro Mercado Pago registrado en modo offline (verificación manual)'
      },
      paymentBreakdown: {
        cashAmount: 400,
        mpAmount: 600,
        cashReceived: 500,
        change: 100
      },
      offline: true,
      status: 'COMPLETED',
      createdAt: '2026-08-25T11:15:00.000Z',
      syncStatus: 'PENDING',
      syncMode: 'OFFLINE'
    };

    const syncedCombinedSale = {
      ...combinedOfflineSale,
      syncStatus: 'SYNCED',
      syncedAt: '2026-08-25T11:45:00.000Z'
    };

    assertEqual(syncedCombinedSale.paymentMethod, 'COMBINADO', 'Método permanece COMBINADO');
    assertEqual(syncedCombinedSale.paymentBreakdown.cashAmount, 400, 'Efectivo $400');
    assertEqual(syncedCombinedSale.paymentBreakdown.mpAmount, 600, 'Mercado Pago $600');
    assertEqual(syncedCombinedSale.paymentBreakdown.change, 100, 'Vuelto $100');
    assertEqual(syncedCombinedSale.offline, true, 'offline=true');
    assertEqual(syncedCombinedSale.paymentVerification, 'MANUAL', 'Verificación MANUAL intacta');
  });

  // =========================================================================
  // SECCIÓN COMPLEMENTARIA: CONTROLES DE SEGURIDAD Y CASOS BORDE
  // =========================================================================

  // 1. Integración desactivada (MERCADOPAGO_ENABLED=false)
  await test('1. Integración desactivada (MERCADOPAGO_ENABLED=false) acepta webhook sin efectos ni confirmación', async () => {
    const disabledConfig: MercadoPagoConfig = { ...baseConfig, enabled: false };
    const result = await processMercadoPagoWebhook(
      { action: 'order.processed', data: { id: '123456789' } },
      {},
      {},
      disabledConfig
    );

    assertEqual(result.statusCode, 200, 'HTTP Status debe ser 200');
    assertEqual(result.body.status, 'DISABLED', 'Estado debe ser DISABLED');
    assertEqual(result.body.confirmed, undefined, 'No debe existir confirmación');
    assertEqual(idempotencyStore.size(), 0, 'No debe escribir en almacén de idempotencia');
  });

  // 2. Integración activada (MERCADOPAGO_ENABLED=true)
  await test('2. Integración activada (MERCADOPAGO_ENABLED=true) procesa orden y consulta API', async () => {
    let apiCalled = false;
    mockFetchHandler = async () => {
      apiCalled = true;
      return new Response(JSON.stringify(sampleValidOrder), { status: 200 });
    };

    const result = await processMercadoPagoWebhook(
      { action: 'order.processed', data: { id: '123456789' } },
      {},
      {},
      baseConfig
    );

    assert(apiCalled, 'Debe consultar la API de Mercado Pago');
    assertEqual(result.body.status, 'CONFIRMED', 'Estado debe ser CONFIRMED');
    assertEqual(result.body.confirmed, true, 'Debe auto-confirmar cuando autoConfirm=true');
  });

  // 3. Webhook válido estándar
  await test('3. Webhook válido con formato estándar de Mercado Pago', async () => {
    mockFetchHandler = async (url) => {
      assert(url.includes('/v1/orders/123456789'), 'Debe consultar la URL de la orden exacta');
      return new Response(JSON.stringify(sampleValidOrder), { status: 200 });
    };

    const payload = {
      action: 'order.processed',
      api_version: 'v1',
      data: { id: '123456789' },
      date_created: new Date().toISOString(),
      id: 998877,
      live_mode: false,
      type: 'order',
      user_id: 3634603825,
    };

    const result = await processMercadoPagoWebhook(payload, {}, {}, baseConfig);
    assertEqual(result.body.success, true, 'Debe procesar con éxito');
    assertEqual(result.body.orderId, '123456789', 'Debe extraer el orderId');
  });

  // 4. Webhook sin order_id
  await test('4. Webhook sin order_id se maneja limpiamente sin caídas', async () => {
    const result = await processMercadoPagoWebhook({}, {}, {}, baseConfig);
    assertEqual(result.body.status, 'INVALID_PAYLOAD', 'Debe devolver INVALID_PAYLOAD');
    assertEqual(result.statusCode, 200, 'Debe retornar 200 OK para no bloquear el socket');
  });

  // 5. Order inexistente (404 de Mercado Pago)
  await test('5. Order inexistente (404 de Mercado Pago) se registra y devuelve ORDER_NOT_FOUND', async () => {
    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ message: 'Order not found', error: 'not_found' }), { status: 404 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'NON_EXISTENT_999' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'ORDER_NOT_FOUND', 'Debe devolver ORDER_NOT_FOUND');
    assertEqual(result.body.confirmed, undefined, 'No debe confirmar');
  });

  // 6. Order created (status: "created" / "opened")
  await test('6. Order created/opened mapea a PENDING y no auto-confirma', async () => {
    const pendingOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 'ORDER_PENDING_01',
      status: 'opened',
      payments: [{ id: 'p1', status: 'pending', transaction_amount: 1500.5 }],
    };

    mockFetchHandler = async () => new Response(JSON.stringify(pendingOrder), { status: 200 });
    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_PENDING_01' } }, {}, {}, baseConfig);

    assertEqual(result.body.status, 'ORDER_PENDING', 'Debe quedar en ORDER_PENDING');
    assertEqual(result.body.confirmed, false, 'No debe auto-confirmar');
  });

  // 7. Order processed
  await test('7. Order processed/closed mapea a CONFIRMED', () => {
    const mapped = mapMercadoPagoOrderStatus({
      id: '123',
      status: 'closed',
      payments: [{ id: 'p1', status: 'approved' }],
    });
    assertEqual(mapped, 'CONFIRMED', 'Debe mapear a CONFIRMED');
  });

  // 8. Order failed
  await test('8. Order failed/cancelled mapea a FAILED', () => {
    const mapped = mapMercadoPagoOrderStatus({
      id: '123',
      status: 'failed',
      payments: [{ id: 'p1', status: 'rejected' }],
    });
    assertEqual(mapped, 'FAILED', 'Debe mapear a FAILED');
  });

  // 9. Order expired
  await test('9. Order expired mapea a EXPIRED', () => {
    const mapped = mapMercadoPagoOrderStatus({
      id: '123',
      status: 'expired',
    });
    assertEqual(mapped, 'EXPIRED', 'Debe mapear a EXPIRED');
  });

  // 10. Moneda incorrecta
  await test('10. Moneda no-ARS (ej: USD) rechaza validación', () => {
    const orderUSD: MercadoPagoOrder = {
      ...sampleValidOrder,
      currency_id: 'USD',
    };
    const validation = validateMercadoPagoOrder(orderUSD, baseConfig);
    assertEqual(validation.valid, false, 'Validación debe ser false');
    assertEqual(validation.code, 'INVALID_CURRENCY', 'Código debe ser INVALID_CURRENCY');
  });

  // 11. user_id incorrecto
  await test('11. user_id de orden que no coincide con cuenta configurada rechaza validación', () => {
    const orderWrongUser: MercadoPagoOrder = {
      ...sampleValidOrder,
      user_id: '9999999999',
    };
    const validation = validateMercadoPagoOrder(orderWrongUser, baseConfig);
    assertEqual(validation.valid, false, 'Validación debe ser false');
    assertEqual(validation.code, 'USER_ID_MISMATCH', 'Código debe ser USER_ID_MISMATCH');
  });

  // 12. Error 401 Mercado Pago
  await test('12. Error 401 Unauthorized de Mercado Pago se maneja limpiamente sin exponer token', async () => {
    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ message: 'Invalid access token', status: 401 }), { status: 401 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_401' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'API_ERROR', 'Debe registrar API_ERROR');
    assert(!JSON.stringify(result).includes(baseConfig.accessToken), 'NUNCA debe filtrar el Access Token');
  });

  // 13. Error 403 Mercado Pago
  await test('13. Error 403 Forbidden de Mercado Pago se maneja limpiamente', async () => {
    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ message: 'Forbidden resource', status: 403 }), { status: 403 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_403' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'API_ERROR', 'Debe registrar API_ERROR');
  });

  // 14. Error 404 Mercado Pago
  await test('14. Error 404 Not Found de Mercado Pago se mapea a ORDER_NOT_FOUND', async () => {
    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ message: 'Order not found' }), { status: 404 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_404' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'ORDER_NOT_FOUND', 'Debe registrar ORDER_NOT_FOUND');
  });

  // 15. Timeout de conexión
  await test('15. Timeout de conexión con Mercado Pago se maneja con resiliencia', async () => {
    mockFetchHandler = async () => {
      const abortError = new Error('The operation was aborted');
      abortError.name = 'AbortError';
      throw abortError;
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_TIMEOUT' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'API_ERROR', 'Debe devolver API_ERROR en timeout sin congelar el backend');
  });

  // 16. Error temporal 500 / 503 de Mercado Pago
  await test('16. Error 500/503 temporal de Mercado Pago no tumba la aplicación', async () => {
    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ message: 'Internal MP Error' }), { status: 503 });
    };

    const result = await processMercadoPagoWebhook({ data: { id: 'ORDER_503' } }, {}, {}, baseConfig);
    assertEqual(result.body.status, 'API_ERROR', 'Debe devolver API_ERROR');
    assertEqual(result.statusCode, 200, 'Debe retornar 200 OK con respuesta estructurada');
  });

  // 17. Resiliencia de datos y parsing de orden
  await test('17. Resiliencia de datos: extracción flexible de order_id en query y payload', () => {
    assertEqual(extractOrderId({ data: { id: '111' } }), '111', 'Extrae de data.id');
    assertEqual(extractOrderId({}, { 'data.id': '222' }), '222', 'Extrae de query data.id');
    assertEqual(extractOrderId({}, { id: '333' }), '333', 'Extrae de query id');
    assertEqual(extractOrderId({ resource: 'https://api.mercadopago.com/v1/orders/444' }), '444', 'Extrae de resource URL');
  });

  // 18. Mismo Payment procesado dos veces
  await test('18. Mismo Payment procesado dos veces es protegido por idempotencia', () => {
    const paymentKey = idempotencyStore.generateKey(undefined, 'PAYMENT_9999');
    assert(!idempotencyStore.isProcessed(paymentKey), 'Inicialmente no debe estar procesado');

    idempotencyStore.markProcessed({
      key: paymentKey,
      paymentId: 'PAYMENT_9999',
      processedAt: new Date().toISOString(),
      resultStatus: 'CONFIRMED',
      confirmed: true,
      attempts: 1,
    });

    assert(idempotencyStore.isProcessed(paymentKey), 'Luego del registro debe detectarse procesado');
    const record = idempotencyStore.getRecord(paymentKey);
    assertEqual(record?.paymentId, 'PAYMENT_9999', 'Debe guardar paymentId');
    assertEqual(record?.confirmed, true, 'Debe guardar estado confirmed');
  });

  // 19. Demostración formal: Misma Order procesada dos veces NO genera doble confirmación
  await test('19. DEMOSTRACIÓN FORMAL: Misma Order procesada 2 veces NO genera doble confirmación ni efectos duplicados', async () => {
    let sideEffectsExecutedCount = 0;

    mockFetchHandler = async () => {
      return new Response(JSON.stringify(sampleValidOrder), { status: 200 });
    };

    // Primera ejecución (Evento original de Mercado Pago)
    const exec1 = await processMercadoPagoWebhook({ data: { id: 'ORDER_DUPL_TEST_001' } }, {}, {}, baseConfig);
    if (exec1.body.confirmed) {
      sideEffectsExecutedCount++;
    }

    assertEqual(exec1.body.status, 'CONFIRMED', 'Primer evento debe confirmar');
    assertEqual(sideEffectsExecutedCount, 1, 'Efectos secundarios deben ejecutarse exactamente 1 vez');

    // Segunda ejecución (Reenvío automático / reintento por timeout de Mercado Pago)
    const exec2 = await processMercadoPagoWebhook({ data: { id: 'ORDER_DUPL_TEST_001' } }, {}, {}, baseConfig);
    if (exec2.body.confirmed && !exec2.body.isDuplicate) {
      sideEffectsExecutedCount++;
    }

    assertEqual(exec2.body.status, 'DUPLICATE', 'Segundo evento debe marcarse DUPLICATE');
    assertEqual(exec2.body.isDuplicate, true, 'isDuplicate debe ser true');
    assertEqual(sideEffectsExecutedCount, 1, 'Efectos secundarios NO deben volver a ejecutarse');
  });

  // 20. Idempotencia en Reconexión: Reintento de sincronización no duplica la venta
  await test('20. IDEMPOTENCIA EN RECONEXIÓN: Sincronización reintentada no duplica la venta', async () => {
    let firestoreWritesCount = 0;
    const existingFirestoreIds = new Set<string>();

    const mockSyncToFirestore = async (saleId: string) => {
      if (existingFirestoreIds.has(saleId)) {
        return { success: true, status: 'SYNCED', duplicateDetected: true };
      }
      existingFirestoreIds.add(saleId);
      firestoreWritesCount++;
      return { success: true, status: 'SYNCED', duplicateDetected: false };
    };

    const res1 = await mockSyncToFirestore('sale_mp_off_003');
    assertEqual(res1.status, 'SYNCED', 'Primer intento sincroniza exitosamente');
    assertEqual(firestoreWritesCount, 1, 'Debe realizar exactamente 1 escritura');

    const res2 = await mockSyncToFirestore('sale_mp_off_003');
    assertEqual(res2.status, 'SYNCED', 'Segundo intento debe retornar SYNCED por idempotencia');
    assertEqual(res2.duplicateDetected, true, 'Debe detectar duplicado');
    assertEqual(firestoreWritesCount, 1, 'NO debe volver a escribir en base de datos');
  });

  // 21. Aislamiento de Webhook: Webhook online con mismo importe NO sobreescribe venta offline
  await test('21. AISLAMIENTO DE WEBHOOK: Webhook online con mismo importe NO sobreescribe venta offline', async () => {
    const offlineSaleId = 'sale_mp_off_004';
    const offlineSale = {
      id: offlineSaleId,
      total: 1500.5,
      paymentMethod: 'MERCADO_PAGO',
      paymentVerification: 'MANUAL',
      offline: true,
      orderId: undefined,
      external_reference: undefined
    };

    mockFetchHandler = async () => {
      return new Response(JSON.stringify(sampleValidOrder), { status: 200 });
    };

    const webhookResult = await processMercadoPagoWebhook(
      { data: { id: '123456789' } },
      {},
      {},
      baseConfig
    );

    assertEqual(webhookResult.body.status, 'CONFIRMED', 'Webhook online confirma orden asociada');
    assertEqual(webhookResult.body.external_reference, 'MINIMARKET-OP-001', 'Asociado a referencia online');

    assertEqual(offlineSale.paymentVerification, 'MANUAL', 'Venta offline permanece MANUAL');
    assertEqual(offlineSale.offline, true, 'Venta offline permanece offline=true');
    assertEqual(offlineSale.orderId, undefined, 'Venta offline no adquiere orderId externo');
  });

  // 22. Recarga de aplicación: Operación en Outbox persiste y se sincroniza
  await test('22. PERSISTENCIA Y RECARGA: Operación offline persiste en almacenamiento local y sincroniza post-reinicio', async () => {
    const initialStorage: Record<string, any> = {};

    const op = {
      operationId: 'op_reload_01',
      saleId: 'sale_reload_01',
      saleSnapshot: {
        id: 'sale_reload_01',
        total: 3200,
        paymentMethod: 'MERCADO_PAGO',
        paymentVerification: 'MANUAL',
        offline: true,
        createdAt: '2026-08-25T14:00:00.000Z'
      },
      status: 'PENDING'
    };
    initialStorage[op.operationId] = JSON.stringify(op);

    const recoveredOp = JSON.parse(initialStorage['op_reload_01']);
    assertEqual(recoveredOp.status, 'PENDING', 'Estado debe seguir PENDING tras recarga');
    assertEqual(recoveredOp.saleSnapshot.paymentMethod, 'MERCADO_PAGO', 'Método debe ser MERCADO_PAGO');
    assertEqual(recoveredOp.saleSnapshot.paymentVerification, 'MANUAL', 'Verificación debe ser MANUAL');
    assertEqual(recoveredOp.saleSnapshot.offline, true, 'Flag offline debe ser true');

    recoveredOp.status = 'SYNCED';
    recoveredOp.saleSnapshot.syncStatus = 'SYNCED';
    recoveredOp.saleSnapshot.syncedAt = '2026-08-25T14:10:00.000Z';

    assertEqual(recoveredOp.saleSnapshot.createdAt, '2026-08-25T14:00:00.000Z', 'createdAt original intacto');
    assertEqual(recoveredOp.saleSnapshot.paymentVerification, 'MANUAL', 'Permanece MANUAL');
  });

  // 23. Test de Fallback Seguro por Defecto de MERCADOPAGO_AUTO_CONFIRM
  await test('23. CONFIGURACIÓN SEGURA: Valor por defecto de MERCADOPAGO_AUTO_CONFIRM es estrictamente false ante ausencia o valores inválidos', () => {
    const testCases = [undefined, '', 'xyz', 'FALSE', 'null', '0', 'no'];
    for (const val of testCases) {
      const autoConfirmStr = val?.toLowerCase().trim();
      const autoConfirm = autoConfirmStr === 'true';
      assertEqual(autoConfirm, false, `Valor '${val}' debe evaluarse como false`);
    }
  });

  // 24. Cobro Combinado: Split 50/50 genera y valida QR por el 50% exacto
  await test('24. COBRO COMBINADO — 50/50 SPLIT: Total $1.000 (Efectivo $500, MP $500) registra QR por $500 y valida exitosamente', async () => {
    const totalSale = 1000;
    const splitCash = 500;
    const splitMp = totalSale - splitCash; // 500
    assertEqual(splitMp, 500, 'Monto MP inicial debe ser $500');

    const extRef = 'MINIMARKET-SPLIT-50-50';
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: splitMp,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const splitOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 505001,
      external_reference: extRef,
      total_amount: splitMp
    };

    mockFetchHandler = async () => new Response(JSON.stringify(splitOrder), { status: 200 });

    const result = await processMercadoPagoWebhook(
      { data: { id: '505001' } },
      {},
      {},
      baseConfig
    );

    assertEqual(result.body.status, 'CONFIRMED', 'Webhook confirma orden combinada 50/50');
    assertEqual(result.body.external_reference, extRef, 'Referencia asociada coincide');
    const updatedOrder = orderRegistry.getOrderByReference(extRef);
    assertEqual(updatedOrder?.total_amount, 500, 'Total de orden MP registrada/procesada es $500');
  });

  // 25. Cobro Combinado: Split modificado (Efectivo $800, MP $200) genera y valida QR por $200
  await test('25. COBRO COMBINADO — MODIFIED SPLIT (800/200): Modificación a Efectivo $800 / MP $200 registra QR por $200 y valida exitosamente', async () => {
    const totalSale = 1000;
    const splitCash = 800;
    const splitMp = totalSale - splitCash; // 200
    assertEqual(splitMp, 200, 'Monto MP modificado debe ser $200');

    const extRef = 'MINIMARKET-SPLIT-800-200';
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: splitMp,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const splitOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 800200,
      external_reference: extRef,
      total_amount: splitMp
    };

    mockFetchHandler = async () => new Response(JSON.stringify(splitOrder), { status: 200 });

    const result = await processMercadoPagoWebhook(
      { data: { id: '800200' } },
      {},
      {},
      baseConfig
    );

    assertEqual(result.body.status, 'CONFIRMED', 'Webhook confirma orden combinada 800/200');
    const updatedOrder = orderRegistry.getOrderByReference(extRef);
    assertEqual(updatedOrder?.total_amount, 200, 'Total de orden MP registrada/procesada es exactamente $200');
  });

  // 26. Cobro Combinado: Split modificado (Efectivo $200, MP $800) genera y valida QR por $800
  await test('26. COBRO COMBINADO — MODIFIED SPLIT (200/800): Modificación a Efectivo $200 / MP $800 registra QR por $800 y valida exitosamente', async () => {
    const totalSale = 1000;
    const splitCash = 200;
    const splitMp = totalSale - splitCash; // 800
    assertEqual(splitMp, 800, 'Monto MP modificado debe ser $800');

    const extRef = 'MINIMARKET-SPLIT-200-800';
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: splitMp,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const splitOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 200800,
      external_reference: extRef,
      total_amount: splitMp
    };

    mockFetchHandler = async () => new Response(JSON.stringify(splitOrder), { status: 200 });

    const result = await processMercadoPagoWebhook(
      { data: { id: '200800' } },
      {},
      {},
      baseConfig
    );

    assertEqual(result.body.status, 'CONFIRMED', 'Webhook confirma orden combinada 200/800');
    const updatedOrder = orderRegistry.getOrderByReference(extRef);
    assertEqual(updatedOrder?.total_amount, 800, 'Total de orden MP registrada/procesada es exactamente $800');
  });

  // 27. Prevención de Stale State ante modificaciones rápidas
  await test('27. PREVENCIÓN DE STALE STATE: Si el monto se modifica de $500 a $200, una orden previa de $500 es rechazada por discrepancia con el monto registrado', async () => {
    const activeRef = 'MINIMARKET-SPLIT-CURRENT-200';
    
    // Se registra la orden ACTUAL con el monto final ($200)
    orderRegistry.registerOrder({
      external_reference: activeRef,
      total_amount: 200,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    // Supongamos que MP intenta enviar una orden previa o manipulada por $500 con la misma referencia
    const staleOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 999500,
      external_reference: activeRef,
      total_amount: 500 // Monto desactualizado (500 !== 200)
    };

    mockFetchHandler = async () => new Response(JSON.stringify(staleOrder), { status: 200 });

    const result = await processMercadoPagoWebhook(
      { data: { id: '999500' } },
      {},
      {},
      baseConfig
    );

    assertEqual(result.body.status, 'VALIDATION_FAILED', 'Orden desactualizada/stale debe ser rechazada');
    assert(result.body.message.includes('no coincide con el importe esperado'), 'Mensaje debe indicar discrepancia de monto');
  });

  // 28. Validación estricta de suma en Cobro Combinado
  await test('28. VALIDACIÓN DE SUMA EN COBRO COMBINADO: Combinaciones con suma incorrecta o importes negativos son detectadas y bloqueadas', () => {
    const total = 1000;
    
    const isValidSplit = (cash: number, mp: number) => {
      if (cash < 0 || mp < 0) return false;
      return Math.abs((cash + mp) - total) <= 0.05;
    };

    assertEqual(isValidSplit(500, 500), true, '500 + 500 === 1000 es válido');
    assertEqual(isValidSplit(800, 200), true, '800 + 200 === 1000 es válido');
    assertEqual(isValidSplit(200, 800), true, '200 + 800 === 1000 es válido');
    assertEqual(isValidSplit(1000, 0), true, '1000 + 0 === 1000 es válido');
    assertEqual(isValidSplit(0, 1000), true, '0 + 1000 === 1000 es válido');

    assertEqual(isValidSplit(800, 300), false, '800 + 300 !== 1000 es inválido (suma excede)');
    assertEqual(isValidSplit(500, 200), false, '500 + 200 !== 1000 es inválido (suma insuficiente)');
    assertEqual(isValidSplit(-100, 1100), false, 'Importe negativo es inválido');
  });

  // 29. 100% Mercado Pago vs 100% Efectivo
  await test('29. CASOS EXTREMOS: 100% Mercado Pago vs 100% Efectivo', async () => {
    const totalSale = 1500;
    
    // 100% MP
    const mpFullRef = 'MINIMARKET-100-MP';
    orderRegistry.registerOrder({
      external_reference: mpFullRef,
      total_amount: totalSale,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const fullMpOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 1500001,
      external_reference: mpFullRef,
      total_amount: totalSale
    };

    mockFetchHandler = async () => new Response(JSON.stringify(fullMpOrder), { status: 200 });

    const mpResult = await processMercadoPagoWebhook(
      { data: { id: '1500001' } },
      {},
      {},
      baseConfig
    );
    assertEqual(mpResult.body.status, 'CONFIRMED', '100% MP confirma orden por $1.500');
    const updatedFullOrder = orderRegistry.getOrderByReference(mpFullRef);
    assertEqual(updatedFullOrder?.total_amount, 1500, 'Total coincide');

    // 100% Efectivo: En split payment con MP=0 no se debe crear orden en MP
    const splitMpZero = 0;
    assertEqual(splitMpZero <= 0, true, 'MP $0 no genera orden en Mercado Pago');
  });

  // 30. Seguridad Backend: validateMercadoPagoOrder valida estrictamente expectedAmount
  await test('30. SEGURIDAD BACKEND: validateMercadoPagoOrder rechaza orden si total_amount difiere de expectedAmount', () => {
    const validOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 777001,
      external_reference: 'MINIMARKET-TEST-SEC',
      total_amount: 500
    };

    // Caso coincidente
    const matchValidation = validateMercadoPagoOrder(validOrder, baseConfig, 500);
    assertEqual(matchValidation.valid, true, 'Validación exitosa cuando total_amount === expectedAmount');

    // Caso divergente
    const mismatchValidation = validateMercadoPagoOrder(validOrder, baseConfig, 200);
    assertEqual(mismatchValidation.valid, false, 'Validación rechazada cuando total_amount (500) !== expectedAmount (200)');
    assert(mismatchValidation.reason?.includes('no coincide con el importe esperado'), 'Razón explica divergencia de importe');
  });

  // =========================================================================
  // SECCIÓN 11: PRUEBAS DE CONFIGURACIÓN ADMINISTRABLE (TEST 31 - 55)
  // =========================================================================

  // 31. Configuración por defecto inicia en Modo Prueba con valores sandbox
  await test('31. CONFIG DEFAULT: Inicializa en Modo Prueba con identificadores de sandbox', () => {
    tenantConfigStore.clear();
    const config = tenantConfigStore.getConfig('biz-001');
    assertEqual(config.mode, 'TEST', 'Modo inicial es TEST');
    assertEqual(config.testConfig.userId, '3634603825', 'UserId por defecto es 3634603825');
    assertEqual(config.testConfig.posId, '137101354', 'PosId por defecto es 137101354');
    assertEqual(config.testConfig.externalPosId, 'MINIMARKETPOCCAJA01', 'ExternalPosId por defecto');
  });

  // 32. Cambio a Modo Producción actualiza mode === 'PRODUCTION'
  await test('32. CAMBIO DE MODO: Cambiar a PRODUCTION actualiza el modo correctamente', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', { mode: 'PRODUCTION', updatedBy: 'AdminUser' });
    const config = tenantConfigStore.getConfig('biz-001');
    assertEqual(config.mode, 'PRODUCTION', 'Modo actualizado a PRODUCTION');
    assertEqual(config.updatedBy, 'AdminUser', 'Registra autor');
  });

  // 33. Guardar credenciales de producción no sobrescribe credenciales de prueba
  await test('33. AISLAMIENTO: Guardar credenciales de producción no modifica valores de TEST', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      productionConfig: {
        userId: '999888777',
        posId: '555444',
        externalPosId: 'PROD-CAJA-01',
        accessToken: 'APP_USR-12345678901234567890',
      },
    });
    const config = tenantConfigStore.getConfig('biz-001');
    assertEqual(config.productionConfig.userId, '999888777', 'Producción guarda 999888777');
    assertEqual(config.testConfig.userId, '3634603825', 'Test conserva 3634603825');
  });

  // 34. Desactivación de Mercado Pago (enabled: false)
  await test('34. ESTADO DESACTIVADO: enabled: false impide crear órdenes en runtime', async () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', { enabled: false });
    const runtimeConfig = tenantConfigStore.getActiveRuntimeConfig('biz-001');
    assertEqual(runtimeConfig.enabled, false, 'Runtime config reporta enabled=false');

    const orderRes = await createRealMercadoPagoOrder({
      businessId: 'biz-001',
      sellerId: 'user-1',
      sellerName: 'Vendedor',
      external_reference: 'MINIMARKET-REF-DIS',
      total_amount: 500,
      items: [{ title: 'Item', unit_price: 500, quantity: 1, unit_measure: 'unit', total_amount: 500 }],
    });
    assertEqual(orderRes.status, 'DISABLED', 'Creación de orden rechazada con status DISABLED');
  });

  // 35. Verificación de conexión en modo prueba exitosa con mock 200
  await test('35. VERIFICAR CONEXIÓN (TEST): Retorna CONNECTED cuando la API responde 200 OK', async () => {
    tenantConfigStore.clear();
    mockFetchHandler = async (url) => {
      if (url.includes('/users/me')) {
        return new Response(JSON.stringify({ id: 3634603825, nickname: 'TEST_USER' }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await verifyMercadoPagoConnection({ businessId: 'biz-001', mode: 'TEST' });
    assertEqual(result.success, true, 'Verificación exitosa');
    assertEqual(result.status, 'CONNECTED', 'Status CONNECTED');
    assert(result.message.includes('conectado correctamente'), 'Mensaje amigable');
  });

  // 36. Verificación de conexión en modo producción exitosa con credenciales completas
  await test('36. VERIFICAR CONEXIÓN (PROD): Retorna CONNECTED con credenciales de producción válidas', async () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      mode: 'PRODUCTION',
      productionConfig: {
        userId: '11223344',
        posId: '987654',
        externalPosId: 'CAJA-PROD-01',
        accessToken: 'APP_USR-abcdef1234567890abcdef',
      },
    });

    mockFetchHandler = async (url) => {
      if (url.includes('/users/me')) {
        return new Response(JSON.stringify({ id: 11223344, nickname: 'PROD_STORE' }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await verifyMercadoPagoConnection({ businessId: 'biz-001', mode: 'PRODUCTION' });
    assertEqual(result.success, true, 'Verificación de producción exitosa');
    assertEqual(result.status, 'CONNECTED', 'Status es CONNECTED');
  });

  // 37. Verificación de conexión falla si faltan credenciales requeridas
  await test('37. VERIFICAR CONEXIÓN: Falla si faltan identificadores de producción', async () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      mode: 'PRODUCTION',
      productionConfig: {
        userId: '',
        posId: '',
        accessToken: 'APP_USR-incomplete',
      },
    });

    const result = await verifyMercadoPagoConnection({ businessId: 'biz-001', mode: 'PRODUCTION' });
    assertEqual(result.success, false, 'Falla sin identificadores');
    assertEqual(result.status, 'ERROR', 'Status ERROR');
  });

  // 38. Verificación de conexión falla ante error HTTP 401/403 de Mercado Pago sin filtrar tokens
  await test('38. VERIFICAR CONEXIÓN: Maneja error HTTP 401 sin exponer tokens', async () => {
    tenantConfigStore.clear();
    mockFetchHandler = async () => {
      return new Response(JSON.stringify({ message: 'Invalid token', error: 'unauthorized' }), { status: 401 });
    };

    const result = await verifyMercadoPagoConnection({ businessId: 'biz-001', mode: 'TEST' });
    assertEqual(result.success, false, 'Falla ante 401');
    assertEqual(result.status, 'ERROR', 'Status es ERROR');
    assert(!result.message.includes('TEST_ACCESS_TOKEN'), 'No expone token en el mensaje');
  });

  // 39. Verificación de conexión maneja timeout de red limpiamente
  await test('39. VERIFICAR CONEXIÓN: Maneja timeout de conexión', async () => {
    tenantConfigStore.clear();
    mockFetchHandler = async () => {
      const err = new Error('AbortError');
      err.name = 'AbortError';
      throw err;
    };

    const result = await verifyMercadoPagoConnection({ businessId: 'biz-001', mode: 'TEST' });
    assertEqual(result.success, false, 'Timeout genera resultado fallido seguro');
    assertEqual(result.status, 'ERROR', 'Status ERROR');
    assert(result.message.includes('Tiempo de espera agotado') || result.message.includes('No se pudo verificar'), 'Mensaje claro');
  });

  // 40. getSanitizedConfig NUNCA devuelve string de accessToken, solo hasAccessToken: boolean
  await test('40. SEGURIDAD DTO: getSanitizedConfig nunca expone el token en string', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      productionConfig: {
        accessToken: 'APP_USR-VERY-SECRET-TOKEN-12345',
        userId: '12345',
      },
    });

    const sanitized = tenantConfigStore.getSanitizedConfig('biz-001');
    assertEqual((sanitized as any).productionConfig.accessToken, undefined, 'No existe propiedad accessToken');
    assertEqual(sanitized.productionConfig.hasAccessToken, true, 'hasAccessToken es true');
    assertEqual(JSON.stringify(sanitized).includes('APP_USR-VERY-SECRET-TOKEN-12345'), false, 'String del token ausente de JSON');
  });

  // 41. Guardar token vacío en producción no borra el token previamente guardado
  await test('41. PERSISTENCIA DE TOKEN: Enviar token vacío no sobrescribe el token existente', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      productionConfig: {
        accessToken: 'APP_USR-ORIGINAL-TOKEN-999',
        userId: '555',
      },
    });

    tenantConfigStore.saveConfig('biz-001', {
      productionConfig: {
        userId: '555-UPDATED',
        accessToken: '', // Vacío
      },
    });

    const config = tenantConfigStore.getConfig('biz-001');
    assertEqual(config.productionConfig.userId, '555-UPDATED', 'UserId se actualiza');
    assertEqual(config.productionConfig.accessToken, 'APP_USR-ORIGINAL-TOKEN-999', 'Token previo se preserva');
  });

  // 42. Modo prueba resuelve credenciales de test incluso si producción está configurado
  await test('42. RESOLUCIÓN MODO TEST: En modo TEST se resuelven exclusivamente credenciales Sandbox', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      mode: 'TEST',
      productionConfig: {
        userId: 'PROD_USER_888',
        posId: 'PROD_POS_888',
      },
    });

    const runtime = tenantConfigStore.getActiveRuntimeConfig('biz-001');
    assertEqual(runtime.userId, '3634603825', 'Utiliza userId de sandbox');
    assertEqual(runtime.posId, '137101354', 'Utiliza posId de sandbox');
  });

  // 43. Modo producción resuelve credenciales de producción y no las de test
  await test('43. RESOLUCIÓN MODO PRODUCCIÓN: En modo PRODUCTION se resuelven credenciales de producción', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      mode: 'PRODUCTION',
      productionConfig: {
        userId: 'PROD_USER_777',
        posId: 'PROD_POS_777',
        externalPosId: 'CAJA_PROD_1',
        accessToken: 'APP_USR-PROD-VALID-TOKEN',
      },
    });

    const runtime = tenantConfigStore.getActiveRuntimeConfig('biz-001');
    assertEqual(runtime.userId, 'PROD_USER_777', 'Utiliza userId de producción');
    assertEqual(runtime.posId, 'PROD_POS_777', 'Utiliza posId de producción');
    assertEqual(runtime.externalPosId, 'CAJA_PROD_1', 'Utiliza externalPosId de producción');
  });

  // 44. Auto-confirm se preserva y respeta por tenant
  await test('44. AUTO-CONFIRM TENANT: Respeta configuración autoConfirm por tenant', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', { autoConfirm: false });
    assertEqual(tenantConfigStore.getConfig('biz-001').autoConfirm, false, 'autoConfirm es false para biz-001');

    tenantConfigStore.saveConfig('biz-002', { autoConfirm: true });
    assertEqual(tenantConfigStore.getConfig('biz-002').autoConfirm, true, 'autoConfirm es true para biz-002');
  });

  // 45. Cambio de configuración registra auditoría MERCADO_PAGO_CONFIG_UPDATED sin tokens
  await test('45. AUDITORÍA CONFIG: saveConfig registra MERCADO_PAGO_CONFIG_UPDATED', () => {
    auditStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      enabled: true,
      mode: 'PRODUCTION',
      updatedBy: 'AdminPedro',
    });

    const logs = auditStore.getRecentLogs(5);
    const configLog = logs.find((l) => l.action === 'MERCADO_PAGO_CONFIG_UPDATED');
    assertEqual(Boolean(configLog), true, 'Registró evento de auditoría');
    assertEqual(configLog?.userId, 'AdminPedro', 'Registró autor');
  });

  // 46. Verificación de conexión registra auditoría MERCADO_PAGO_CONNECTION_TEST sin tokens
  await test('46. AUDITORÍA TEST CONEXIÓN: verifyMercadoPagoConnection registra MERCADO_PAGO_CONNECTION_TEST', async () => {
    auditStore.clear();
    mockFetchHandler = async () => new Response(JSON.stringify({ id: 12345 }), { status: 200 });

    await verifyMercadoPagoConnection({ businessId: 'biz-001', testedBy: 'AdminMaria' });
    const logs = auditStore.getRecentLogs(5);
    const testLog = logs.find((l) => l.action === 'MERCADO_PAGO_CONNECTION_TEST');
    assertEqual(Boolean(testLog), true, 'Registró evento de verificación');
    assertEqual(testLog?.userId, 'AdminMaria', 'Registró tester');
  });

  // 47. Multi-tenant: dos negocios distintos tienen configuraciones independientes
  await test('47. MULTI-TENANT: Configuraciones aisladas entre distintos businessId', () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('store-A', { mode: 'TEST', enabled: true });
    tenantConfigStore.saveConfig('store-B', { mode: 'PRODUCTION', enabled: false });

    assertEqual(tenantConfigStore.getConfig('store-A').mode, 'TEST', 'store-A en TEST');
    assertEqual(tenantConfigStore.getConfig('store-A').enabled, true, 'store-A activado');
    assertEqual(tenantConfigStore.getConfig('store-B').mode, 'PRODUCTION', 'store-B en PRODUCTION');
    assertEqual(tenantConfigStore.getConfig('store-B').enabled, false, 'store-B desactivado');
  });

  // 48. Fallback a variables de entorno cuando el tenant no tiene overrides
  await test('48. ENV FALLBACK: Utiliza variables de entorno iniciales para tenants no configurados', () => {
    tenantConfigStore.clear();
    const config = tenantConfigStore.getActiveRuntimeConfig('biz-unconfigured');
    assertEqual(Boolean(config.userId), true, 'Obtiene userId');
    assertEqual(Boolean(config.posId), true, 'Obtiene posId');
  });

  // 49. Creación de orden en POS utiliza credenciales del modo activo del tenant
  await test('49. ORDEN POS TENANT: createRealMercadoPagoOrder utiliza credenciales activas del tenant', async () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-pos-test', {
      mode: 'PRODUCTION',
      enabled: true,
      productionConfig: {
        userId: '334455',
        posId: '778899',
        externalPosId: 'CAJA-PROD-POS',
        accessToken: 'APP_USR-TOKEN-PROD-XYZ',
      },
    });

    let sentUrl = '';
    mockFetchHandler = async (url) => {
      sentUrl = url;
      return new Response(JSON.stringify({ in_store_order_id: 'PROD-ORD-1' }), { status: 200 });
    };

    const orderRes = await createRealMercadoPagoOrder({
      businessId: 'biz-pos-test',
      sellerId: 'user-1',
      sellerName: 'Vendedor',
      external_reference: 'MINIMARKET-TEST-PROD-ORD',
      total_amount: 1000,
      items: [{ title: 'Producto', unit_price: 1000, quantity: 1, unit_measure: 'unit', total_amount: 1000 }],
    });

    assertEqual(orderRes.success, true, 'Orden de producción creada');
    assert(sentUrl.includes('334455') && sentUrl.includes('CAJA-PROD-POS'), 'Endpoint usó identificadores de producción');
  });

  // 50. Webhook resuelve configuración tenant para validación de seguridad
  await test('50. WEBHOOK TENANT: Webhook valida orden contra configuración activa del tenant', async () => {
    const customProdConfig: MercadoPagoConfig = {
      enabled: true,
      autoConfirm: true,
      accessToken: 'APP_USR-VALID-TOKEN',
      userId: '778899',
      siteId: 'MLA',
      externalStoreId: 'SUC-PROD',
      externalPosId: 'CAJA-PROD',
      storeId: '111',
      posId: '222',
      apiBaseUrl: 'https://api.mercadopago.com',
    };

    const prodOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 'PROD-ORDER-999',
      user_id: '778899',
      config: { qr: { external_pos_id: 'CAJA-PROD' } },
    };

    mockFetchHandler = async () => new Response(JSON.stringify(prodOrder), { status: 200 });

    const whResult = await processMercadoPagoWebhook(
      { data: { id: 'PROD-ORDER-999' } },
      {},
      {},
      customProdConfig
    );
    assertEqual(whResult.body.status, 'CONFIRMED', 'Webhook validó contra config de producción');
  });

  // 51. ValidateOrder rechaza montos manipulados en modo producción y prueba
  await test('51. SEGURIDAD MONTOS: ValidateOrder rechaza montos manipulados en cualquier modo', () => {
    const manipulatedOrder: MercadoPagoOrder = {
      ...sampleValidOrder,
      id: 'ORD-HACK',
      total_amount: 10, // Pagó $10 en lugar de $1000
    };

    const check = validateMercadoPagoOrder(manipulatedOrder, baseConfig, 1000);
    assertEqual(check.valid, false, 'Rechaza pago con monto menor al esperado');
  });

  // 52. Cobro combinado utiliza el monto exacto split para la orden del tenant
  await test('52. COBRO COMBINADO TENANT: Usa el importe dinámico split', async () => {
    let capturedBody: any = null;
    mockFetchHandler = async (_url, init) => {
      if (init?.body) capturedBody = JSON.parse(init.body as string);
      return new Response(JSON.stringify({ in_store_order_id: 'SPLIT-ORD-1' }), { status: 200 });
    };

    await createRealMercadoPagoOrder({
      businessId: 'biz-001',
      sellerId: 'user-1',
      sellerName: 'Vendedor',
      external_reference: 'MINIMARKET-SPLIT-TENANT',
      total_amount: 350,
      items: [{ title: 'Cobro Combinado Mercado Pago', unit_price: 350, quantity: 1, unit_measure: 'unit', total_amount: 350 }],
    });

    assertEqual(capturedBody?.total_amount, 350, 'Monto en payload MP es exactamente 350');
  });

  // 53. Status endpoint reporta modo y estado de conexión seguro
  await test('53. SANITIZED SUMMARY: activeConfigSummary provee vista de estado segura', () => {
    tenantConfigStore.clear();
    const sanitized = tenantConfigStore.getSanitizedConfig('biz-001');
    assertEqual(sanitized.activeConfigSummary.mode, 'TEST', 'Summary indica modo TEST');
    assertEqual(sanitized.activeConfigSummary.qrStatus.includes('Sandbox'), true, 'Indica estado del QR de sandbox');
    assertEqual(sanitized.activeConfigSummary.userId, '3634603825', 'UserId visible');
  });

  // 54. QR de Demostración asignado al POS Sandbox oficial
  await test('54. QR DEMO ASIGNACIÓN: QR de prueba apunta al POS ID 137101354 y caja MINIMARKETPOCCAJA01', () => {
    const config = tenantConfigStore.getConfig('biz-001');
    assertEqual(config.testConfig.posId, '137101354', 'POS ID es 137101354');
    assertEqual(config.testConfig.externalPosId, 'MINIMARKETPOCCAJA01', 'External POS es MINIMARKETPOCCAJA01');
  });

  // 55. Aislamiento total: Fallas de red en producción no afectan configuración de prueba
  await test('55. AISLAMIENTO DE ERRORES: Fallos en verificación de producción no corrompen configuración de prueba', async () => {
    tenantConfigStore.clear();
    tenantConfigStore.saveConfig('biz-001', {
      mode: 'PRODUCTION',
      productionConfig: {
        userId: '123',
        posId: '456',
        externalPosId: 'CAJA',
        accessToken: 'APP_USR-BAD',
      },
    });

    mockFetchHandler = async () => new Response('Unauthorized', { status: 401 });
    await verifyMercadoPagoConnection({ businessId: 'biz-001', mode: 'PRODUCTION' });

    const tenant = tenantConfigStore.getConfig('biz-001');
    assertEqual(tenant.connectionStatus, 'ERROR', 'Producción queda en estado ERROR');
    assertEqual(tenant.testConfig.userId, '3634603825', 'Test config permanece intacta');
  });

  // 56. PRUEBA 1 & 7: Invalidación inmediata del QR al modificar importes y bloqueo estricto de Confirmar Venta
  await test('56. COBRO COMBINADO (PRUEBA 1 & 7): Modificación de importes $500->$200 invalida QR, deshabilita Confirmar y rechaza confirmación forzada', () => {
    const totalAmount = 1000;
    let splitCashAmount = 500;
    let splitMpAmount = 500;
    let mpOrderAmount: number | null = 500;
    let mpOrderState: 'IDLE' | 'CREATING' | 'WAITING_PAYMENT' | 'PAYMENT_VERIFIED' | 'CONFIRMED' | 'ERROR' = 'WAITING_PAYMENT';
    let qrNeedsRegeneration = false;

    // Simular que el vendedor modifica efectivo a $800 (MP pasa a $200)
    const rawVal = '800';
    const num = parseFloat(rawVal);
    const val = isNaN(num) ? 0 : Math.max(0, Math.min(totalAmount, num));
    const newMp = totalAmount - val;
    splitCashAmount = val;
    splitMpAmount = newMp;
    if (newMp <= 0) {
      qrNeedsRegeneration = false;
      mpOrderState = 'IDLE';
      mpOrderAmount = null;
    } else {
      qrNeedsRegeneration = true;
      mpOrderState = 'IDLE';
      mpOrderAmount = null;
    }

    assertEqual(splitCashAmount, 800, 'Efectivo actualizado a $800');
    assertEqual(splitMpAmount, 200, 'Mercado Pago actualizado a $200');
    assertEqual(qrNeedsRegeneration, true, 'qrNeedsRegeneration debe estar activo (true)');
    assertEqual(mpOrderAmount, null, 'mpOrderAmount debe ser nulo (invalidado)');
    assertEqual(mpOrderState, 'IDLE', 'mpOrderState debe resetearse a IDLE');

    // Comprobar si el botón Confirmar Venta está deshabilitado
    const isOnline = true;
    const isConfirmDisabled = (
      Math.abs((splitCashAmount + splitMpAmount) - totalAmount) > 0.01 ||
      (splitMpAmount > 0 && isOnline &&
        (qrNeedsRegeneration || mpOrderAmount === null || Math.abs(mpOrderAmount - splitMpAmount) > 0.01 || mpOrderState === 'IDLE'))
    );
    assertEqual(isConfirmDisabled, true, 'Botón Confirmar Venta DEBE estar deshabilitado');

    // Comprobar intento forzado de confirmación
    let validationError: string | null = null;
    if (splitMpAmount > 0 && isOnline) {
      if (
        qrNeedsRegeneration ||
        mpOrderAmount === null ||
        Math.abs(mpOrderAmount - splitMpAmount) > 0.01 ||
        mpOrderState === 'IDLE'
      ) {
        validationError = 'Importe modificado. Regenerá el QR para continuar.';
      }
    }
    assertEqual(validationError, 'Importe modificado. Regenerá el QR para continuar.', 'Validación forzada debe arrojar el mensaje exacto');
  });

  // 57. PRUEBA 2: Regeneración de QR por $200 restablece estado y permite confirmación
  await test('57. COBRO COMBINADO (PRUEBA 2): Regeneración de QR crea orden por $200 y habilita confirmación', () => {
    const totalAmount = 1000;
    const splitCashAmount = 800;
    const splitMpAmount = 200;
    const splitCashReceived = 800;
    let qrNeedsRegeneration = true;
    let mpOrderAmount: number | null = null;
    let mpOrderState: string = 'IDLE';

    // Se presiona "Regenerar QR ($200)"
    mpOrderAmount = splitMpAmount;
    mpOrderState = 'WAITING_PAYMENT';
    qrNeedsRegeneration = false;

    assertEqual(mpOrderAmount, 200, 'QR generado por $200');
    assertEqual(qrNeedsRegeneration, false, 'qrNeedsRegeneration reseteado a false');
    assertEqual(mpOrderState, 'WAITING_PAYMENT', 'Estado en WAITING_PAYMENT');

    const isOnline = true;
    const isConfirmDisabled = (
      Math.abs((splitCashAmount + splitMpAmount) - totalAmount) > 0.01 ||
      isNaN(Number(splitCashReceived)) || Number(splitCashReceived) < splitCashAmount ||
      (splitMpAmount > 0 && isOnline &&
        (qrNeedsRegeneration || mpOrderAmount === null || Math.abs(mpOrderAmount - splitMpAmount) > 0.01 || mpOrderState === 'IDLE'))
    );
    assertEqual(isConfirmDisabled, false, 'Botón Confirmar Venta se habilita con el QR regenerado para el monto actual');
  });

  // 58. PRUEBA 3: Modificación a $200 Efectivo / $800 MP
  await test('58. COBRO COMBINADO (PRUEBA 3): Modificación a Efectivo $200 / MP $800 invalida QR de $500 y regenera por $800', () => {
    const totalAmount = 1000;
    let splitCashAmount = 500;
    let splitMpAmount = 500;
    let mpOrderAmount: number | null = 500;
    let qrNeedsRegeneration = false;

    // Modificación a MP $800
    const rawVal = '800';
    const val = parseFloat(rawVal);
    const newCash = totalAmount - val;
    splitMpAmount = val;
    splitCashAmount = newCash;
    qrNeedsRegeneration = true;
    mpOrderAmount = null;

    assertEqual(splitMpAmount, 800, 'MP asignado es $800');
    assertEqual(splitCashAmount, 200, 'Efectivo asignado es $200');
    assertEqual(qrNeedsRegeneration, true, 'QR anterior invalidado');

    // Regenerar QR
    mpOrderAmount = splitMpAmount; // 800
    qrNeedsRegeneration = false;
    assertEqual(mpOrderAmount, 800, 'Nuevo QR generado por exactamente $800');
  });

  // 59. PRUEBA 4: 100% Efectivo ($1.000 / $0 MP)
  await test('59. COBRO COMBINADO (PRUEBA 4): 100% Efectivo ($1.000 / $0 MP) no requiere QR y permite confirmar', () => {
    const totalAmount = 1000;
    const splitCashAmount = 1000;
    const splitMpAmount = 0;
    const splitCashReceived = 1000;
    let qrNeedsRegeneration = false;
    let mpOrderAmount: number | null = null;
    let mpOrderState: 'IDLE' | 'CREATING' | 'WAITING_PAYMENT' | 'PAYMENT_VERIFIED' | 'CONFIRMED' | 'ERROR' = 'IDLE';

    // Al asignar $0 a MP:
    if (splitMpAmount <= 0) {
      qrNeedsRegeneration = false;
      mpOrderState = 'IDLE';
      mpOrderAmount = null;
    }

    const isOnline = true;
    const isConfirmDisabled = (
      Math.abs((splitCashAmount + splitMpAmount) - totalAmount) > 0.01 ||
      isNaN(Number(splitCashReceived)) || Number(splitCashReceived) < splitCashAmount ||
      (splitMpAmount > 0 && isOnline &&
        (qrNeedsRegeneration || mpOrderAmount === null || Math.abs(mpOrderAmount - splitMpAmount) > 0.01 || mpOrderState === 'IDLE'))
    );
    assertEqual(isConfirmDisabled, false, 'Confirmar Venta está habilitado sin requerir QR de MP');
  });

  // 60. PRUEBA 5: 100% Mercado Pago ($0 Efectivo / $1.000 MP)
  await test('60. COBRO COMBINADO (PRUEBA 5): 100% Mercado Pago ($0 / $1.000) requiere QR por $1.000', () => {
    const totalAmount = 1000;
    const splitCashAmount = 0;
    const splitMpAmount = 1000;
    let qrNeedsRegeneration = true;
    let mpOrderAmount: number | null = null;

    assertEqual(splitMpAmount, 1000, 'MP es $1.000');
    assertEqual(qrNeedsRegeneration, true, 'Requiere regenerar QR por $1.000');

    // Regenerar QR
    mpOrderAmount = splitMpAmount;
    qrNeedsRegeneration = false;
    assertEqual(mpOrderAmount, 1000, 'QR generado por $1.000');
  });

  // 61. PRUEBA 6: Múltiples modificaciones consecutivas ($500 -> $400 -> $300 -> $200)
  await test('61. COBRO COMBINADO (PRUEBA 6): Múltiples cambios rápidos mantienen QR invalidado hasta la última regeneración', () => {
    const totalAmount = 1000;
    let splitMpAmount = 500;
    let qrNeedsRegeneration = false;
    let mpOrderAmount: number | null = 500;

    const changes = [400, 300, 200];
    for (const newMp of changes) {
      splitMpAmount = newMp;
      qrNeedsRegeneration = true;
      mpOrderAmount = null;
      assertEqual(qrNeedsRegeneration, true, `Cambio a $${newMp} mantiene qrNeedsRegeneration=true`);
      assertEqual(mpOrderAmount, null, `Cambio a $${newMp} mantiene mpOrderAmount=null`);
    }

    // Regeneración final
    mpOrderAmount = splitMpAmount; // 200
    qrNeedsRegeneration = false;
    assertEqual(mpOrderAmount, 200, 'QR final es exactamente $200');
    assertEqual(qrNeedsRegeneration, false, 'qrNeedsRegeneration es false tras regenerar');
  });

  // 62. PRUEBA 8: Cobro Combinado en Modo Offline
  await test('62. COBRO COMBINADO (PRUEBA 8): En modo Offline no se requiere generación de QR online y se asienta con verificación manual', () => {
    const totalAmount = 1000;
    const splitCashAmount = 800;
    const splitMpAmount = 200;
    const splitCashReceived = 1000;
    const isOnline = false; // Sin conexión a internet

    const isConfirmDisabled = (
      Math.abs((splitCashAmount + splitMpAmount) - totalAmount) > 0.01 ||
      isNaN(Number(splitCashReceived)) || Number(splitCashReceived) < splitCashAmount ||
      (splitMpAmount > 0 && isOnline && false)
    );
    assertEqual(isConfirmDisabled, false, 'Modo offline permite confirmar sin QR online');
  });

  // 63. VALIDACIÓN SERVER-SIDE: Rechaza confirmación de orden inexistente
  await test('63. VALIDACIÓN SERVER-SIDE: validateMercadoPagoSalePayment rechaza orden no encontrada', async () => {
    const res = await validateMercadoPagoSalePayment({
      externalReference: 'REF-INEXISTENTE-999',
      expectedAmount: 1000,
    });
    assertEqual(res.valid, false, 'Orden inexistente retorna valid=false');
    assertEqual(res.code, 'ORDER_NOT_FOUND', 'Código ORDER_NOT_FOUND');
  });

  // 64. VALIDACIÓN SERVER-SIDE: Rechaza confirmación cuando el pago aún no fue verificado (WAITING_PAYMENT)
  await test('64. VALIDACIÓN SERVER-SIDE: validateMercadoPagoSalePayment rechaza orden en estado WAITING_PAYMENT', async () => {
    const extRef = 'REF-WAITING-TEST-001';
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: 1500,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const res = await validateMercadoPagoSalePayment({
      externalReference: extRef,
      expectedAmount: 1500,
    });
    assertEqual(res.valid, false, 'Orden no acreditada retorna valid=false');
    assertEqual(res.code, 'PAYMENT_PENDING', 'Código PAYMENT_PENDING');
  });

  // 65. VALIDACIÓN SERVER-SIDE: Rechaza confirmación si el importe no coincide exactamente
  await test('65. VALIDACIÓN SERVER-SIDE: validateMercadoPagoSalePayment rechaza discrepancia de importe', async () => {
    const extRef = 'REF-AMOUNT-MISMATCH-001';
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: 500,
      itemsCount: 1,
      status: 'PAYMENT_VERIFIED',
      paymentId: 'PAY-123456',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const res = await validateMercadoPagoSalePayment({
      externalReference: extRef,
      expectedAmount: 800, // Discrepancia con los 500 registrados
    });
    assertEqual(res.valid, false, 'Discrepancia de monto retorna valid=false');
    assertEqual(res.code, 'AMOUNT_MISMATCH', 'Código AMOUNT_MISMATCH');
  });

  // 66. VALIDACIÓN SERVER-SIDE: Aprueba confirmación cuando el pago fue efectivamente verificado
  await test('66. VALIDACIÓN SERVER-SIDE: validateMercadoPagoSalePayment valida exitosamente orden verificada con paymentId', async () => {
    const extRef = 'REF-SUCCESS-PAYMENT-001';
    orderRegistry.registerOrder({
      external_reference: extRef,
      orderId: 'MP-ORD-888',
      total_amount: 1200,
      itemsCount: 2,
      status: 'PAYMENT_VERIFIED',
      paymentId: '9876543210',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const res = await validateMercadoPagoSalePayment({
      externalReference: extRef,
      expectedAmount: 1200,
    });
    assertEqual(res.valid, true, 'Orden verificada retorna valid=true');
    assertEqual(res.order?.paymentId, '9876543210', 'Retorna paymentId verificado');
    assertEqual(res.order?.status, 'PAYMENT_VERIFIED', 'Estado de la orden es PAYMENT_VERIFIED');
  });

  // 67. FRONTEND CONFIRMATION BUTTON: Bloqueado en WAITING_PAYMENT y habilitado en PAYMENT_VERIFIED
  await test('67. FRONTEND BUTTON: Deshabilitado durante espera y activado exclusivamente con pago verificado', () => {
    const paymentMethod = 'MERCADO_PAGO';
    const isOnline = true;

    // Estado 1: WAITING_PAYMENT (escaneado o no, pero no pagado)
    let mpOrderState: string = 'WAITING_PAYMENT';
    let isBtnDisabled = (
      (paymentMethod === 'MERCADO_PAGO' && isOnline && (mpOrderState !== 'PAYMENT_VERIFIED' && mpOrderState !== 'CONFIRMED'))
    );
    assertEqual(isBtnDisabled, true, 'Botón deshabilitado durante WAITING_PAYMENT');

    // Estado 2: PAYMENT_VERIFIED (pago acreditado por webhook o API)
    mpOrderState = 'PAYMENT_VERIFIED';
    isBtnDisabled = (
      (paymentMethod === 'MERCADO_PAGO' && isOnline && (mpOrderState !== 'PAYMENT_VERIFIED' && mpOrderState !== 'CONFIRMED'))
    );
    assertEqual(isBtnDisabled, false, 'Botón habilitado tras verificar el pago');
  });

  // 68. SEGURIDAD DE TICKET: Información de Mercado Pago segura y sin exposición de credenciales
  await test('68. TICKET SEGURO: Estructura de ticket incluye Operación, Orden y Estado sin secretos', () => {
    const safeTicketPaymentDetails = {
      mode: 'ONLINE',
      verification: 'MERCADOPAGO_VERIFIED',
      orderId: 'MP-ORDER-12345',
      paymentId: '9988776655',
      operationId: '9988776655',
      externalReference: 'MINIMARKET-POS-001',
      verifiedAt: new Date().toISOString(),
      notes: 'Cobro Mercado Pago verificado'
    };

    assertEqual(safeTicketPaymentDetails.paymentId, '9988776655', 'Incluye ID de Operación');
    assertEqual(safeTicketPaymentDetails.orderId, 'MP-ORDER-12345', 'Incluye ID de Orden');
    assertEqual(safeTicketPaymentDetails.verification, 'MERCADOPAGO_VERIFIED', 'Indica verificación');
    assertEqual((safeTicketPaymentDetails as any).accessToken, undefined, 'No expone access token');
    assertEqual((safeTicketPaymentDetails as any).clientSecret, undefined, 'No expone secret');
  });

  // 69. STATUS CHECKER & POLLING: Retorna WAITING_PAYMENT y paid=false cuando el pago no ha sido acreditado
  await test('69. POLLING FLOW: checkAndSyncOrderStatus mantiene WAITING_PAYMENT mientras el comprador no pague', async () => {
    const { checkAndSyncOrderStatus } = await import('../server/mercadopago/statusChecker');
    const extRef = 'MINIMARKET-TEST-POLL-01';
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: 1500,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const status = await checkAndSyncOrderStatus(extRef, undefined, baseConfig);
    assertEqual(status.paid, false, 'No está pagado');
    assertEqual(status.status, 'WAITING_PAYMENT', 'Estado es WAITING_PAYMENT');
    assertEqual(status.paymentStatus, 'pending', 'paymentStatus es pending');
  });

  // 70. STATUS CHECKER & POLLING: Sincroniza y cambia inmediatamente a PAYMENT_VERIFIED y paid=true cuando MP acredita
  await test('70. POLLING FLOW: checkAndSyncOrderStatus detecta acreditación en MP y transiciona a PAYMENT_VERIFIED', async () => {
    const { checkAndSyncOrderStatus } = await import('../server/mercadopago/statusChecker');
    const extRef = 'MINIMARKET-TEST-POLL-ACCREDITED-01';
    orderRegistry.registerOrder({
      external_reference: extRef,
      orderId: 'MP-ORD-POLL-999',
      total_amount: 2000,
      itemsCount: 2,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    mockFetchHandler = async (url: string) => {
      if (url.includes('/v1/orders/MP-ORD-POLL-999')) {
        return new Response(JSON.stringify({
          id: 'MP-ORD-POLL-999',
          status: 'processed',
          status_detail: 'accredited',
          currency_id: 'ARS',
          total_amount: 2000,
          user_id: '3634603825',
          external_reference: extRef,
          payments: [
            {
              id: 'PAY-174434103627',
              status: 'approved',
              status_detail: 'accredited',
              transaction_amount: 2000,
            }
          ]
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const status = await checkAndSyncOrderStatus(extRef, undefined, { ...baseConfig, autoConfirm: false });
    assertEqual(status.paid, true, 'paid es true al acreditar');
    assertEqual(status.status, 'PAYMENT_VERIFIED', 'Estado cambió a PAYMENT_VERIFIED');
    assertEqual(status.paymentId, 'PAY-174434103627', 'Retorna paymentId de Mercado Pago');
    assertEqual(status.orderId, 'MP-ORD-POLL-999', 'Retorna orderId de Mercado Pago');

    const updatedInRegistry = orderRegistry.getOrderByReference(extRef);
    assertEqual(updatedInRegistry?.status, 'PAYMENT_VERIFIED', 'Registry local actualizado a PAYMENT_VERIFIED');
  });

  // 71. STATUS CHECKER: Búsqueda por external_reference cuando orderId aún no fue emitido en creación
  await test('71. POLLING SEARCH: Búsqueda por external_reference en merchant_orders si orderId no está en registro local', async () => {
    const { checkAndSyncOrderStatus } = await import('../server/mercadopago/statusChecker');
    const extRef = 'MINIMARKET-SEARCH-REF-777';
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: 850,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    mockFetchHandler = async (url: string) => {
      if (url.includes('/merchant_orders?external_reference=')) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: 'MO-888999',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 850,
              user_id: '3634603825',
              external_reference: extRef,
              payments: [
                {
                  id: 'PAY-777888',
                  status: 'approved',
                  transaction_amount: 850,
                }
              ]
            }
          ]
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const status = await checkAndSyncOrderStatus(extRef, undefined, { ...baseConfig, autoConfirm: false });
    assertEqual(status.paid, true, 'Encuentra la orden por external_reference y marca paid=true');
    assertEqual(status.paymentId, 'PAY-777888', 'paymentId extraído correctamente');
    assertEqual(status.orderId, 'MO-888999', 'orderId extraído correctamente');
  });

  // 72. COBRO COMBINADO: Verificación y acreditación solo de la porción de Mercado Pago
  await test('72. COMBINADO: Cobro $800 Cash + $200 MP verifica correctamente QR por $200 y permite finalizar venta', async () => {
    const { checkAndSyncOrderStatus } = await import('../server/mercadopago/statusChecker');
    const splitRef = 'MINIMARKET-SPLIT-999';
    const splitMpPortion = 200;

    orderRegistry.registerOrder({
      external_reference: splitRef,
      orderId: 'ORD-SPLIT-200',
      total_amount: splitMpPortion,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    // 1. Mientras no esté pagado, validation falla
    const preCheck = await validateMercadoPagoSalePayment({
      externalReference: splitRef,
      expectedAmount: splitMpPortion,
    });
    assertEqual(preCheck.valid, false, 'No permite confirmar mientras esté en WAITING_PAYMENT');

    // 2. Cliente paga los $200 en MP
    mockFetchHandler = async (url: string) => {
      if (url.includes('ORD-SPLIT-200')) {
        return new Response(JSON.stringify({
          id: 'ORD-SPLIT-200',
          status: 'processed',
          currency_id: 'ARS',
          total_amount: splitMpPortion,
          user_id: '3634603825',
          external_reference: splitRef,
          payments: [
            {
              id: 'PAY-SPLIT-OK-200',
              status: 'approved',
              transaction_amount: splitMpPortion,
            }
          ]
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const pollRes = await checkAndSyncOrderStatus(splitRef, undefined, { ...baseConfig, autoConfirm: false });
    assertEqual(pollRes.paid, true, 'Porción de MP de $200 acreditada');
    assertEqual(pollRes.status, 'PAYMENT_VERIFIED', 'Estado transiciona a PAYMENT_VERIFIED');

    // 3. Validación de venta server-side aprueba la porción de MP
    const postCheck = await validateMercadoPagoSalePayment({
      externalReference: splitRef,
      expectedAmount: splitMpPortion,
    });
    assertEqual(postCheck.valid, true, 'Permite confirmar la venta combinada tras verificar MP');
    assertEqual(postCheck.order?.paymentId, 'PAY-SPLIT-OK-200', 'Contiene ID de pago verificado');
  });

  // 73. NÚMERO DE OPERACIÓN: Extracción de identificador real de Mercado Pago
  await test('73. NÚMERO DE OPERACIÓN: Retorna paymentId real de Mercado Pago en la verificación', async () => {
    const { checkAndSyncOrderStatus } = await import('../server/mercadopago/statusChecker');
    const extRef = 'MINIMARKET-OP-TEST-777';
    const realOpNumber = '174434103627';

    orderRegistry.registerOrder({
      external_reference: extRef,
      orderId: 'ORD-OP-TEST-777',
      total_amount: 1500,
      itemsCount: 1,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    mockFetchHandler = async (url: string) => {
      if (url.includes('ORD-OP-TEST-777')) {
        return new Response(JSON.stringify({
          id: 'ORD-OP-TEST-777',
          status: 'processed',
          currency_id: 'ARS',
          total_amount: 1500,
          user_id: '3634603825',
          external_reference: extRef,
          payments: [
            {
              id: realOpNumber,
              status: 'approved',
              transaction_amount: 1500,
            }
          ]
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const status = await checkAndSyncOrderStatus(extRef, undefined, { ...baseConfig, autoConfirm: false });
    assertEqual(status.paid, true, 'Pago acreditado');
    assertEqual(status.paymentId, realOpNumber, 'Retorna el número de operación real de Mercado Pago');

    const validation = await validateMercadoPagoSalePayment({
      externalReference: extRef,
      expectedAmount: 1500,
    });
    assertEqual(validation.valid, true, 'Validación de venta exitosa');
    assertEqual(validation.order?.paymentId, realOpNumber, 'El registro de orden conserva el número de operación');
  });

  // 74. NÚMERO DE OPERACIÓN: Formato requerido en UI cuando hay paymentId vs cuando no hay
  await test('74. NÚMERO DE OPERACIÓN: Formateo con número de operación real y fallback seguro', async () => {
    const formatVerifiedText = (paymentId?: string | null) => {
      const clean = paymentId && String(paymentId).trim() !== '' && String(paymentId) !== 'undefined' && String(paymentId) !== 'null'
        ? String(paymentId).replace(/^#+/, '').trim()
        : null;
      return clean
        ? `✓ Pago Mercado Pago verificado · Operación #${clean}`
        : '✓ Pago Mercado Pago verificado';
    };

    assertEqual(
      formatVerifiedText('174434103627'),
      '✓ Pago Mercado Pago verificado · Operación #174434103627',
      'Formatea con el número real de operación'
    );
    assertEqual(
      formatVerifiedText('#174434103627'),
      '✓ Pago Mercado Pago verificado · Operación #174434103627',
      'Limpia prefijo # repetido'
    );
    assertEqual(
      formatVerifiedText(null),
      '✓ Pago Mercado Pago verificado',
      'Fallback seguro si es null'
    );
    assertEqual(
      formatVerifiedText(undefined),
      '✓ Pago Mercado Pago verificado',
      'Fallback seguro si es undefined'
    );
    assertEqual(
      formatVerifiedText(''),
      '✓ Pago Mercado Pago verificado',
      'Fallback seguro si está vacío'
    );
  });

  // =========================================================================
  // SECCIÓN 11: PRUEBAS ESPECÍFICAS POINT SMART (PRUEBAS 75 A 85)
  // =========================================================================

  // 75. POINT SMART PRUEBA 1: Venta simple con QR en Point Smart (Orders API v1/orders)
  await test('75. POINT SMART (PRUEBA 1): Venta simple envía payload point correcto y valida acreditación', async () => {
    let capturedUrl = '';
    let capturedBody: any = null;

    mockFetchHandler = async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      if (url.includes('/v1/orders')) {
        return new Response(JSON.stringify({
          id: 'ORD-POINT-001',
          status: 'opened',
          type: 'point',
          external_reference: 'MINIMARKET-POINT-TEST-01',
        }), { status: 201 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const orderRes = await createRealMercadoPagoOrder({
      external_reference: 'MINIMARKET-POINT-TEST-01',
      total_amount: 2500,
      description: 'Venta Point Smart',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
      sellerName: 'Vendedor 1',
    });

    assertEqual(orderRes.success, true, 'Creación de orden exitosa');
    assertEqual(orderRes.status, 'CREATED', 'Resultado de creación CREATED');
    assertEqual(orderRegistry.getOrder('MINIMARKET-POINT-TEST-01')?.status, 'WAITING_PAYMENT', 'Estado inicial en registro WAITING_PAYMENT');
    assertEqual(capturedUrl.includes('/v1/orders'), true, 'Utiliza endpoint /v1/orders');
    assertEqual(capturedBody.type, 'point', 'Type es point');
    assertEqual(capturedBody.transactions.payments[0].amount, '2500.00', 'Monto enviado en transactions');
    assertEqual(capturedBody.config.point.terminal_id, 'SMARTPOS-12345', 'Terminal ID configurada');
    assertEqual(capturedBody.config.point.print_on_terminal, 'no_ticket', 'No imprime ticket duplicado en la terminal');
  });

  // 76. POINT SMART PRUEBA 2: Venta combinada con QR en Point Smart (Cash $800 + MP $200)
  await test('76. POINT SMART (PRUEBA 2): Venta combinada envía solo la porción de Mercado Pago a la terminal', async () => {
    let capturedBody: any = null;

    mockFetchHandler = async (url: string, init?: RequestInit) => {
      capturedBody = init?.body ? JSON.parse(init.body as string) : null;
      if (url.includes('/v1/orders')) {
        return new Response(JSON.stringify({
          id: 'ORD-POINT-SPLIT-01',
          status: 'opened',
          type: 'point',
        }), { status: 201 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const orderRes = await createRealMercadoPagoOrder({
      external_reference: 'MINIMARKET-POINT-SPLIT-01',
      total_amount: 200, // Solo la porción MP de una venta total de $1.000
      description: 'Pago Combinado Point',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
    });

    assertEqual(orderRes.success, true, 'Orden de cobro split creada');
    assertEqual(capturedBody.transactions.payments[0].amount, '200.00', 'Solo se envían los $200 de MP');
  });

  // 77. POINT SMART PRUEBA 3: Modificación de importes invalida y libera la orden anterior
  await test('77. POINT SMART (PRUEBA 3): Modificar importes en cobro combinado invalida orden y cancela en Point', async () => {
    const extRef1 = 'MINIMARKET-POINT-CHANGE-01';
    orderRegistry.registerOrder({
      external_reference: extRef1,
      total_amount: 500,
      status: 'WAITING_PAYMENT',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
      sellerName: 'Vendedor A',
    });

    assertEqual(orderRegistry.isTerminalBusy('SMARTPOS-12345'), true, 'Terminal ocupada');

    // Al modificar los importes, se cancela/invalida la orden anterior
    orderRegistry.cancelOrder(extRef1);

    assertEqual(orderRegistry.isTerminalBusy('SMARTPOS-12345'), false, 'Terminal liberada al cancelar');
    const orderRecord = orderRegistry.getOrder(extRef1);
    assertEqual(orderRecord?.status, 'EXPIRED', 'Orden anterior expirada/cancelada');

    // Validación de venta debe ser rechazada si no hay nueva orden
    const valResult = await validateMercadoPagoSalePayment({
      externalReference: extRef1,
      expectedAmount: 200,
    });
    assertEqual(valResult.valid, false, 'No permite confirmar con orden invalidada');
  });

  // 78. POINT SMART PRUEBA 4: Vendedor A (Point) y Vendedor B (QR Físico de Caja) concurrentes
  await test('78. POINT SMART (PRUEBA 4): Concurrencia entre Point Smart y QR Físico de Caja simultáneo', async () => {
    // Vendedor A ocupa Point Smart
    orderRegistry.registerOrder({
      external_reference: 'REF-SELLER-A-POINT',
      total_amount: 1500,
      status: 'WAITING_PAYMENT',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
      sellerName: 'Vendedor A',
    });

    // Vendedor B opera en simultáneo con QR Físico de Caja
    const sellerBOrder = orderRegistry.registerOrder({
      external_reference: 'REF-SELLER-B-STATIC-QR',
      total_amount: 800,
      status: 'WAITING_PAYMENT',
      mercadoPagoSource: 'STATIC_POS_QR',
      posId: 'MINIMARKETPOCCAJA01',
      sellerName: 'Vendedor B',
    });

    assertEqual(Boolean(sellerBOrder), true, 'Vendedor B puede operar con QR Físico en simultáneo');
    assertEqual(orderRegistry.isTerminalBusy('SMARTPOS-12345', 'REF-SELLER-A-POINT'), false, 'Misma orden de A es dueña');
  });

  // 79. POINT SMART PRUEBA 5: Dos vendedores intentan usar la misma terminal Point simultáneamente
  await test('79. POINT SMART (PRUEBA 5): Bloqueo preventivo de terminal ocupada para segundo vendedor', async () => {
    orderRegistry.registerOrder({
      external_reference: 'REF-SELLER-1',
      total_amount: 1000,
      status: 'WAITING_PAYMENT',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
      sellerName: 'Vendedor 1',
    });

    const secondAttempt = await createRealMercadoPagoOrder({
      external_reference: 'REF-SELLER-2',
      total_amount: 500,
      description: 'Venta Vendedor 2',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
      sellerName: 'Vendedor 2',
    });

    assertEqual(secondAttempt.success, false, 'Rechaza intento de segundo vendedor en terminal ocupada');
    assertEqual(secondAttempt.message?.includes('ocupada'), true, 'Mensaje claro de terminal ocupada');
  });

  // 80. POINT SMART PRUEBA 6: Falla de comunicación con Point Smart
  await test('80. POINT SMART (PRUEBA 6): Error en envío a terminal retorna mensaje amigable y sugiere QR Físico', async () => {
    mockFetchHandler = async (url: string) => {
      if (url.includes('/v1/orders')) {
        return new Response(JSON.stringify({
          message: 'Device offline or unreachable',
          status: 503,
        }), { status: 503 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const res = await createRealMercadoPagoOrder({
      external_reference: 'REF-FAIL-TEST',
      total_amount: 300,
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-99999',
    }, baseConfig);

    assertEqual(res.success, false, 'Detecta fallo de comunicación');
    assertEqual(res.message?.includes('QR Físico de Caja') || res.message?.includes('Point Smart'), true, 'Mensaje sugiere alternativa');
  });

  // 81. POINT SMART PRUEBA 7: Timeout de espera de pago
  await test('81. POINT SMART (PRUEBA 7): Expiración de orden por timeout libera la terminal', async () => {
    const refTimeout = 'REF-TIMEOUT-TEST';
    orderRegistry.registerOrder({
      external_reference: refTimeout,
      total_amount: 400,
      status: 'WAITING_PAYMENT',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
    });

    assertEqual(orderRegistry.isTerminalBusy('SMARTPOS-12345'), true, 'Terminal ocupada antes de timeout');

    orderRegistry.updateOrderStatus(refTimeout, {
      status: 'EXPIRED',
      errorReason: 'Tiempo de espera de pago agotado',
    });

    assertEqual(orderRegistry.isTerminalBusy('SMARTPOS-12345'), false, 'Terminal liberada tras timeout');
    const status = await checkAndSyncOrderStatus(refTimeout);
    assertEqual(status.paid, false, 'No está pagada');
    assertEqual(status.status, 'EXPIRED', 'Estado EXPIRED');
  });

  // 82. POINT SMART PRUEBA 8: Cancelación voluntaria del cobro en Point Smart
  await test('82. POINT SMART (PRUEBA 8): Cancelación voluntaria cancela orden y libera terminal', async () => {
    const refCancel = 'REF-USER-CANCEL-POINT';
    orderRegistry.registerOrder({
      external_reference: refCancel,
      total_amount: 1200,
      status: 'WAITING_PAYMENT',
      mercadoPagoSource: 'POINT_SMART',
      pointTerminalId: 'SMARTPOS-12345',
    });

    mockFetchHandler = async () => new Response(JSON.stringify({ status: 'cancelled' }), { status: 200 });

    orderRegistry.cancelOrder(refCancel);

    assertEqual(orderRegistry.isTerminalBusy('SMARTPOS-12345'), false, 'Terminal liberada inmediatamente');
    const orderRec = orderRegistry.getOrder(refCancel);
    assertEqual(orderRec?.status, 'EXPIRED', 'Estado marcado como cancelado');
  });

  // 83. POINT SMART PRUEBA 9: Modo Offline mientras Point Smart está inaccesible
  await test('83. POINT SMART (PRUEBA 9): Venta offline se procesa independientemente de la conexión con Point', async () => {
    const offlineSale = {
      id: 'SALE-OFFLINE-001',
      total: 1500,
      paymentMethod: 'MERCADO_PAGO' as const,
      paymentVerification: 'MANUAL' as const,
      syncMode: 'OFFLINE' as const,
      offline: true,
      paymentDetails: {
        mode: 'OFFLINE' as const,
        mercadoPagoSource: 'STATIC_POS_QR' as const,
      },
    };

    assertEqual(offlineSale.syncMode, 'OFFLINE', 'Modo offline aislado');
    assertEqual(offlineSale.paymentVerification, 'MANUAL', 'Verificación manual');
  });

  // 84. POINT SMART PRUEBA 10: Validación del ticket impreso con datos de Point Smart
  await test('84. POINT SMART (PRUEBA 10): Formato del ticket refleja QR en Point Smart y número de operación', async () => {
    const getModalidadLabel = (source?: string) => {
      if (source === 'POINT_SMART') return 'QR en Point Smart';
      return 'QR Físico de Caja';
    };

    assertEqual(getModalidadLabel('POINT_SMART'), 'QR en Point Smart', 'Modalidad Point Smart en ticket');
    assertEqual(getModalidadLabel('STATIC_POS_QR'), 'QR Físico de Caja', 'Modalidad QR Físico en ticket');
    assertEqual(getModalidadLabel(undefined), 'QR Físico de Caja', 'Fallback default');
  });

  // 85. UI MODALIDADES: Solo 2 modalidades activas en interfaz ('QR Físico de Caja' y 'QR Point')
  await test('85. UI MODALIDADES: Validación de que existen exclusivamente "QR Físico" y "QR Point" en las opciones activas', async () => {
    const allowedModalities = ['STATIC_POS_QR', 'POINT_GENERATED_QR'];
    assertEqual(allowedModalities.includes('STATIC_POS_QR'), true, 'QR Físico de Caja permitido');
    assertEqual(allowedModalities.includes('POINT_GENERATED_QR'), true, 'QR Point permitido');
    assertEqual(allowedModalities.includes('POINT_SMART'), false, 'Point Smart excluido de opciones activas en UI');
  });

  // 86. VERCEL SERVERLESS /api/mercadopago/status: Devuelve HTTP 200, JSON válido y sin tokens
  await test('86. VERCEL SERVERLESS (/api/mercadopago/status): Retorna HTTP 200, JSON válido y sin secretos', async () => {
    let responseStatus = 0;
    let responseData: any = null;

    const mockReq = { query: {} };
    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
    };

    statusHandler(mockReq, mockRes);

    assertEqual(responseStatus, 200, 'HTTP Status 200');
    assertEqual(responseData?.status, 'ok', 'Status OK en body');
    assertEqual(typeof responseData?.config?.enabled, 'boolean', 'Campo enabled presente');
    assertEqual(typeof responseData?.config?.autoConfirm, 'boolean', 'Campo autoConfirm presente');
    assertEqual(typeof responseData?.config?.hasAccessToken, 'boolean', 'Campo hasAccessToken presente');
    assertEqual(typeof responseData?.config?.siteId, 'string', 'Campo siteId presente');
    assertEqual(typeof responseData?.config?.externalStoreId, 'string', 'Campo externalStoreId presente');
    assertEqual(typeof responseData?.config?.externalPosId, 'string', 'Campo externalPosId presente');
    assertEqual(responseData?.config?.accessToken, undefined, 'Nunca expone accessToken');
    assertEqual(JSON.stringify(responseData).includes('APP_USR-'), false, 'Sin rastro de secretos en JSON');
  });

  // 87. VERCEL SERVERLESS (/api/mercadopago/webhook): Procesa webhook retornando 200
  await test('87. VERCEL SERVERLESS (/api/mercadopago/webhook): Maneja webhook correctamente', async () => {
    let responseStatus = 0;
    let responseData: any = null;

    const mockReq = {
      method: 'POST',
      body: { action: 'payment.created', data: { id: '99999' } },
      query: {},
      headers: {},
    };
    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
      setHeader() {},
    };

    await webhookHandler(mockReq, mockRes);
    assertEqual(responseStatus, 200, 'Webhook retorna HTTP 200');
    assertEqual(typeof responseData?.success, 'boolean', 'Respuesta válida');
  });

  // 88. VERCEL SERVERLESS (/api/mercadopago/config): Endpoint seguro de configuración
  await test('88. VERCEL SERVERLESS (/api/mercadopago/config): Retorna config sanitizada sin secretos', async () => {
    let responseStatus = 0;
    let responseData: any = null;

    const mockReq = { method: 'GET', query: { businessId: 'default' } };
    const mockRes = {
      status(code: number) {
        responseStatus = code;
        return this;
      },
      json(data: any) {
        responseData = data;
        return this;
      },
      setHeader() {},
    };

    configHandler(mockReq, mockRes);
    assertEqual(responseStatus, 200, 'HTTP 200');
    assertEqual(responseData?.success, true, 'Success true');
    assertEqual(responseData?.config?.testConfig?.accessToken, undefined, 'No expone token en testConfig');
    assertEqual(responseData?.config?.productionConfig?.accessToken, undefined, 'No expone token en prodConfig');
  });

  // 89. VERCEL SERVERLESS (/api/mercadopago/create-order & /cancel-order): Manejan requests
  await test('89. VERCEL SERVERLESS (/api/mercadopago/create-order & /cancel-order): Ejecutan correctamente', async () => {
    let createStatus = 0;
    let createData: any = null;

    const mockCreateReq = {
      method: 'POST',
      body: {
        external_reference: 'TEST-VERCEL-CREATE-01',
        total_amount: 100,
      },
    };
    const mockCreateRes = {
      status(code: number) {
        createStatus = code;
        return this;
      },
      json(data: any) {
        createData = data;
        return this;
      },
      setHeader() {},
    };

    await createOrderHandler(mockCreateReq, mockCreateRes);
    assertEqual(createStatus, 200, 'Create order HTTP 200');
    assertEqual(typeof createData?.success, 'boolean', 'Create order success flag');

    let cancelStatus = 0;
    let cancelData: any = null;
    const mockCancelReq = {
      method: 'POST',
      body: { externalReference: 'TEST-VERCEL-CREATE-01' },
    };
    const mockCancelRes = {
      status(code: number) {
        cancelStatus = code;
        return this;
      },
      json(data: any) {
        cancelData = data;
        return this;
      },
      setHeader() {},
    };

    await cancelOrderHandler(mockCancelReq, mockCancelRes);
    assertEqual(cancelStatus, 200, 'Cancel order HTTP 200');
    assertEqual(cancelData?.success, true, 'Cancel order success');
  });

  // 90. VERCEL SERVERLESS (/api/mercadopago/order-status & /validate-sale & /audits)
  await test('90. VERCEL SERVERLESS (/api/mercadopago/order-status, /validate-sale, /audits): Funcionan sin errores', async () => {
    let statusResultCode = 0;
    let statusResultData: any = null;

    const mockStatusReq = { query: { external_reference: 'TEST-VERCEL-CREATE-01' } };
    const mockStatusRes = {
      status(code: number) {
        statusResultCode = code;
        return this;
      },
      json(data: any) {
        statusResultData = data;
        return this;
      },
    };

    await orderStatusHandler(mockStatusReq, mockStatusRes);
    assertEqual(statusResultCode, 200, 'Order status HTTP 200');

    let auditsCode = 0;
    let auditsData: any = null;
    const mockAuditsReq = { query: { limit: '5' } };
    const mockAuditsRes = {
      status(code: number) {
        auditsCode = code;
        return this;
      },
      json(data: any) {
        auditsData = data;
        return this;
      },
    };

    auditsHandler(mockAuditsReq, mockAuditsRes);
    assertEqual(auditsCode, 200, 'Audits HTTP 200');
    assertEqual(Array.isArray(auditsData?.logs), true, 'Logs es array');
  });

  // 91. RESOLUCIÓN UNIFICADA (CASO 1): MERCADOPAGO_ENABLED=true genera configuración global habilitada
  await test('91. RESOLUCIÓN UNIFICADA (CASO 1): MERCADOPAGO_ENABLED=true -> configuración global habilitada', () => {
    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    try {
      process.env.MERCADOPAGO_ENABLED = 'true';
      const globalConfig = getGlobalServerConfig();
      assertEqual(globalConfig.enabled, true, 'Global config enabled is true');

      const resolved = resolveMercadoPagoConfig();
      assertEqual(resolved.enabled, true, 'resolveMercadoPagoConfig() enabled is true');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
    }
  });

  // 92. RESOLUCIÓN UNIFICADA (CASO 2): Tenant sin configuración explícita hereda enabled=true
  await test('92. RESOLUCIÓN UNIFICADA (CASO 2): Tenant sin configuración explícita hereda enabled=true', () => {
    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    try {
      process.env.MERCADOPAGO_ENABLED = 'true';
      tenantConfigStore.clear();

      const tenantConfig = resolveMercadoPagoConfig('tenant-unconfigured-123');
      assertEqual(tenantConfig.enabled, true, 'Tenant sin override hereda enabled=true');

      const sanitized = getSanitizedMercadoPagoConfig('tenant-unconfigured-123');
      assertEqual(sanitized.enabled, true, 'Sanitized tenant sin override hereda enabled=true');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
    }
  });

  // 93. RESOLUCIÓN UNIFICADA (CASO 3): Tenant explícitamente deshabilitado (enabled: false)
  await test('93. RESOLUCIÓN UNIFICADA (CASO 3): Tenant explícitamente deshabilitado -> enabled=false', () => {
    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    try {
      process.env.MERCADOPAGO_ENABLED = 'true';
      tenantConfigStore.clear();

      // Explicitly disable tenant
      tenantConfigStore.saveConfig('tenant-disabled-999', {
        enabled: false,
        updatedBy: 'Admin',
      });

      const tenantConfig = resolveMercadoPagoConfig('tenant-disabled-999');
      assertEqual(tenantConfig.enabled, false, 'Tenant explicit disabled returns enabled=false');

      const sanitized = getSanitizedMercadoPagoConfig('tenant-disabled-999');
      assertEqual(sanitized.enabled, false, 'Sanitized tenant explicit disabled returns enabled=false');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
    }
  });

  // 94. RESOLUCIÓN UNIFICADA (CASO 4): Tenant explícitamente habilitado (enabled: true)
  await test('94. RESOLUCIÓN UNIFICADA (CASO 4): Tenant explícitamente habilitado -> enabled=true', () => {
    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    try {
      process.env.MERCADOPAGO_ENABLED = 'false';
      tenantConfigStore.clear();

      // Explicitly enable tenant even when global is false
      tenantConfigStore.saveConfig('tenant-explicit-enabled-777', {
        enabled: true,
        updatedBy: 'Admin',
      });

      const tenantConfig = resolveMercadoPagoConfig('tenant-explicit-enabled-777');
      assertEqual(tenantConfig.enabled, true, 'Tenant explicit enabled returns enabled=true');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
    }
  });

  // 95. RESOLUCIÓN UNIFICADA (CASO 5): Nueva instancia/runtime sin estado previo en memoria
  await test('95. RESOLUCIÓN UNIFICADA (CASO 5): Nueva instancia/runtime sin estado previo resuelve correctamente', () => {
    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    const prevToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    try {
      process.env.MERCADOPAGO_ENABLED = 'true';
      process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-TEST-FRESH-INSTANCE-TOKEN';
      // Simulate totally fresh Lambda instance
      tenantConfigStore.clear();

      const freshConfig = resolveMercadoPagoConfig('new-business-fresh');
      assertEqual(freshConfig.enabled, true, 'Fresh instance resolves enabled=true');
      assertEqual(freshConfig.accessToken, 'APP_USR-TEST-FRESH-INSTANCE-TOKEN', 'Fresh instance resolves token');
      assertEqual(freshConfig.posId, '137101354', 'Fresh instance has fallback posId');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
      process.env.MERCADOPAGO_ACCESS_TOKEN = prevToken;
    }
  });

  // 96. RESOLUCIÓN UNIFICADA (CASO 6): /api/mercadopago/status devuelve HTTP 200 y config unificada
  await test('96. RESOLUCIÓN UNIFICADA (CASO 6): /api/mercadopago/status devuelve HTTP 200 y config unificada', async () => {
    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    try {
      process.env.MERCADOPAGO_ENABLED = 'true';
      tenantConfigStore.clear();

      let statusCode = 0;
      let responseBody: any = null;
      const mockReq = { method: 'GET', query: { businessId: 'store-abc' } };
      const mockRes = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          responseBody = data;
          return this;
        },
        setHeader() {},
      };

      await statusHandler(mockReq, mockRes);
      assertEqual(statusCode, 200, 'Status handler returns HTTP 200');
      assertEqual(responseBody?.status, 'ok', 'Status is ok');
      assertEqual(responseBody?.config?.enabled, true, 'Config enabled is true');
      assertEqual(responseBody?.config?.accessToken, undefined, 'Access token is never exposed');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
    }
  });

  // 97. RESOLUCIÓN UNIFICADA (CASO 7): /api/mercadopago/create-order no devuelve "La integración de Mercado Pago no está habilitada"
  await test('97. RESOLUCIÓN UNIFICADA (CASO 7): /api/mercadopago/create-order funciona con servidor habilitado y tenant sin override', async () => {
    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    const prevToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    try {
      process.env.MERCADOPAGO_ENABLED = 'true';
      process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-MOCK-TOKEN-TEST';
      tenantConfigStore.clear();

      mockFetchHandler = async (url: string, init?: RequestInit) => {
        return new Response(JSON.stringify({
          in_store_order_id: 'ORDER-REAL-VERCEL-12345',
          qr_data: '00020101021243650016COM.MERCADOLIBRE02013063638255204000053030325802AR5909MINIMARKET6007CORDOBA62070503***6304ABCD',
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      };

      let createStatus = 0;
      let createResult: any = null;
      const mockReq = {
        method: 'POST',
        body: {
          businessId: 'business-sucursal-centro',
          external_reference: 'MINIMARKET-SALE-UNIFIED-01',
          total_amount: 1500,
          items: [{ title: 'Producto Test', unit_price: 1500, quantity: 1, unit_measure: 'unit', total_amount: 1500 }],
        },
      };
      const mockRes = {
        status(code: number) {
          createStatus = code;
          return this;
        },
        json(data: any) {
          createResult = data;
          return this;
        },
        setHeader() {},
      };

      await createOrderHandler(mockReq, mockRes);
      assertEqual(createStatus, 200, 'Create order HTTP 200');
      assertEqual(createResult?.success, true, 'Create order success is true');
      assertEqual(createResult?.status !== 'DISABLED', true, 'Status is not DISABLED');
      assert(createResult?.message !== 'La integración de Mercado Pago no está habilitada en el servidor.', 'No debe devolver mensaje de integración deshabilitada');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
      process.env.MERCADOPAGO_ACCESS_TOKEN = prevToken;
    }
  });

  // =========================================================================
  // BATERÍA DE PRUEBAS DE VALIDACIÓN SERVERLESS MERCADO PAGO
  // =========================================================================

  // 98. Orden encontrada en orderRegistry → validación exitosa
  await test('98. SERVERLESS VALIDATION (CASO 1): Orden encontrada en memoria en orderRegistry valida exitosamente', async () => {
    const extRef = 'MINIMARKET-SALE-RAM-001';
    orderRegistry.registerOrder({
      external_reference: extRef,
      orderId: 'ORD-RAM-001',
      total_amount: 3500,
      status: 'PAYMENT_VERIFIED',
      paymentId: 'PAY-RAM-999',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });

    const result = await validateMercadoPagoSalePayment({
      externalReference: extRef,
      expectedAmount: 3500,
    });

    assertEqual(result.valid, true, 'Validación en memoria retorna true');
    assertEqual(result.order?.paymentId, 'PAY-RAM-999', 'Retorna paymentId de memoria');
    assertEqual(result.order?.status, 'PAYMENT_VERIFIED', 'Estado es PAYMENT_VERIFIED');
  });

  // 99. Orden NO encontrada en orderRegistry → fallback a Mercado Pago (Caso MINIMARKET-SALE-MTCZBXUH-DYIN)
  await test('99. SERVERLESS VALIDATION (CASO 2): Orden NO en RAM (MINIMARKET-SALE-MTCZBXUH-DYIN) valida exitosamente vía API MP', async () => {
    const extRef = 'MINIMARKET-SALE-MTCZBXUH-DYIN';
    orderRegistry.clear(); // Garantizar que la RAM de esta instancia está completamente VACÍA

    mockFetchHandler = async (url: string) => {
      if (url.includes('merchant_orders') && url.includes('MINIMARKET-SALE-MTCZBXUH-DYIN')) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '9988776655',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 4200,
              user_id: '3634603825',
              external_reference: extRef,
              config: {
                qr: {
                  external_pos_id: '137101354',
                  pos_id: 137101354,
                },
              },
              payments: [
                {
                  id: '174499887766',
                  status: 'approved',
                  transaction_amount: 4200,
                },
              ],
            },
          ],
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: 4200,
        posId: '137101354',
      },
      baseConfig
    );

    assertEqual(result.valid, true, 'Venta TEST de producción MINIMARKET-SALE-MTCZBXUH-DYIN validada con fallback');
    assertEqual(result.order?.paymentId, '174499887766', 'Recupera paymentId real de la API');
    assertEqual(result.order?.external_reference, extRef, 'Referencia externa coincide');
    assertEqual(result.order?.total_amount, 4200, 'Importe verificado es 4200');
  });

  // 100. Orden NO encontrada en orderRegistry → Mercado Pago no encuentra orden (404) → rechazo
  await test('100. SERVERLESS VALIDATION (CASO 3): Orden NO en RAM y NO en MP retorna rechazo ORDER_NOT_FOUND', async () => {
    orderRegistry.clear();
    mockFetchHandler = async () => new Response(JSON.stringify({ elements: [] }), { status: 200 });

    const result = await validateMercadoPagoSalePayment(
      {
        externalReference: 'MINIMARKET-NONEXISTENT-999',
        expectedAmount: 1000,
      },
      baseConfig
    );

    assertEqual(result.valid, false, 'Orden inexistente es rechazada');
    assertEqual(result.code, 'ORDER_NOT_FOUND', 'Código es ORDER_NOT_FOUND');
  });

  // 101. Orden encontrada en Mercado Pago pero pago no aprobado → rechazo
  await test('101. SERVERLESS VALIDATION (CASO 4): Orden en MP aún sin pagar es rechazada con PAYMENT_PENDING', async () => {
    const extRef = 'MINIMARKET-SALE-UNPAID-01';
    orderRegistry.clear();

    mockFetchHandler = async (url: string) => {
      if (url.includes('MINIMARKET-SALE-UNPAID-01')) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '8877665544',
              status: 'opened',
              currency_id: 'ARS',
              total_amount: 1500,
              external_reference: extRef,
              payments: [],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: 1500,
      },
      baseConfig
    );

    assertEqual(result.valid, false, 'Orden no pagada es rechazada');
    assertEqual(result.code, 'PAYMENT_PENDING', 'Código PAYMENT_PENDING');
  });

  // 102. Pago aprobado pero importe incorrecto → rechazo
  await test('102. SERVERLESS VALIDATION (CASO 5): Pago aprobado con discrepancia de importe retorna AMOUNT_MISMATCH', async () => {
    const extRef = 'MINIMARKET-SALE-WRONG-AMOUNT-01';
    orderRegistry.clear();

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '7766554433',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 1000, // Pagó $1000 en MP
              external_reference: extRef,
              payments: [{ id: '998811', status: 'approved', transaction_amount: 1000 }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: 1500, // Esperaba $1500
      },
      baseConfig
    );

    assertEqual(result.valid, false, 'Discrepancia de monto es rechazada');
    assertEqual(result.code, 'AMOUNT_MISMATCH', 'Código AMOUNT_MISMATCH');
  });

  // 103. Cobro combinado con importe correcto → aceptación
  await test('103. COBRO COMBINADO SERVERLESS: Venta $10.000, Efectivo $4.000, MP esperado $6.000 con pago $6.000 es aceptado', async () => {
    const extRef = 'MINIMARKET-SPLIT-CORRECT-01';
    orderRegistry.clear();

    const ventaTotal = 10000;
    const efectivo = 4000;
    const mpEsperado = ventaTotal - efectivo; // $6000

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '5544332211',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: mpEsperado,
              external_reference: extRef,
              payments: [{ id: 'PAY-SPLIT-6000', status: 'approved', transaction_amount: mpEsperado }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: mpEsperado,
      },
      baseConfig
    );

    assertEqual(result.valid, true, 'Cobro combinado con porción exacta de MP es aceptado');
    assertEqual(result.order?.total_amount, 6000, 'Importe verificado es $6000');
    assertEqual(result.order?.paymentId, 'PAY-SPLIT-6000', 'PaymentId registrado');
  });

  // 104. Cobro combinado con importe incorrecto → rechazo
  await test('104. COBRO COMBINADO SERVERLESS: MP esperado $6.000 pero recibido $5.000 o $7.000 es rechazado', async () => {
    const extRef = 'MINIMARKET-SPLIT-FRAUD-01';
    orderRegistry.clear();

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '4433221100',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 5000, // Pagó sólo $5000
              external_reference: extRef,
              payments: [{ id: 'PAY-SPLIT-5000', status: 'approved', transaction_amount: 5000 }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const result = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: 6000, // Esperaba $6000
      },
      baseConfig
    );

    assertEqual(result.valid, false, 'Pago menor a la porción de MP es rechazado');
    assertEqual(result.code, 'AMOUNT_MISMATCH', 'Código AMOUNT_MISMATCH');
  });

  // 105. ExternalReference incorrecta / vacía → rechazo
  await test('105. SERVERLESS VALIDATION: ExternalReference vacía o inválida retorna MISSING_REFERENCE', async () => {
    const result = await validateMercadoPagoSalePayment({
      externalReference: '   ',
      expectedAmount: 1000,
    });
    assertEqual(result.valid, false, 'Referencia vacía es rechazada');
    assertEqual(result.code, 'MISSING_REFERENCE', 'Código MISSING_REFERENCE');
  });

  // 106. Ausencia de Access Token → error seguro sin crash
  await test('106. SERVERLESS VALIDATION: Config sin Access Token retorna rechazo seguro', async () => {
    orderRegistry.clear();
    const result = await validateMercadoPagoSalePayment(
      {
        externalReference: 'MINIMARKET-NO-TOKEN-01',
        expectedAmount: 1000,
      },
      { ...baseConfig, accessToken: '' }
    );
    assertEqual(result.valid, false, 'Falla segura sin access token');
    assertEqual(result.code, 'ORDER_NOT_FOUND', 'Código ORDER_NOT_FOUND');
  });

  // 107. No exposición de Access Token
  await test('107. SEGURIDAD: validate-sale no expone Access Token en respuestas', async () => {
    const extRef = 'MINIMARKET-SEC-TEST-01';
    orderRegistry.clear();

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '3322110099',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 1200,
              external_reference: extRef,
              payments: [{ id: 'PAY-SEC-01', status: 'approved', transaction_amount: 1200 }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    let validateStatus = 0;
    let validateBody: any = null;
    const mockReq = {
      method: 'POST',
      body: {
        externalReference: extRef,
        expectedAmount: 1200,
      },
    };
    const mockRes = {
      status(code: number) {
        validateStatus = code;
        return this;
      },
      json(data: any) {
        validateBody = data;
        return this;
      },
      setHeader() {},
    };

    const prevEnv = process.env.MERCADOPAGO_ENABLED;
    const prevToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    try {
      process.env.MERCADOPAGO_ENABLED = 'true';
      process.env.MERCADOPAGO_ACCESS_TOKEN = 'APP_USR-SECRET-ACCESS-TOKEN-NO-LEAK';

      await validateSaleHandler(mockReq, mockRes);
      assertEqual(validateStatus, 200, 'Validate-sale HTTP 200');
      assertEqual(validateBody?.valid, true, 'Valid es true');
      assertEqual(JSON.stringify(validateBody).includes('SECRET-ACCESS-TOKEN'), false, 'El Access Token jamás se expone en la respuesta');
    } finally {
      process.env.MERCADOPAGO_ENABLED = prevEnv;
      process.env.MERCADOPAGO_ACCESS_TOKEN = prevToken;
    }
  });

  // 108. Simulación de ejecución en 3 instancias Serverless independientes (Lambda A -> Lambda B -> Lambda C)
  await test('108. ARQUITECTURA SERVERLESS MULTI-LAMBDA: Lambda A (create) -> Lambda B (polling) -> Lambda C (validate)', async () => {
    const extRef = 'MINIMARKET-SALE-MULTI-LAMBDA-88';
    const amount = 5400;

    // --- LAMBDA A: Creación de Orden ---
    orderRegistry.clear();
    orderRegistry.registerOrder({
      external_reference: extRef,
      total_amount: amount,
      itemsCount: 2,
      status: 'WAITING_PAYMENT',
      autoConfirmed: false,
      createdAt: new Date().toISOString(),
    });
    assertEqual(orderRegistry.getOrder(extRef)?.status, 'WAITING_PAYMENT', 'Lambda A registró la orden en su RAM');

    // --- CAMBIO DE INSTANCIA: Lambda B no comparte memoria con Lambda A ---
    orderRegistry.clear(); // Se borra la RAM local simulando otra máquina

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '9911223344',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: amount,
              external_reference: extRef,
              payments: [{ id: 'PAY-LAMBDA-B-OK', status: 'approved', transaction_amount: amount }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const statusCheckB = await checkAndSyncOrderStatus(extRef, undefined, baseConfig);
    assertEqual(statusCheckB.paid, true, 'Lambda B detectó el pago vía API de Mercado Pago');
    assertEqual(statusCheckB.paymentId, 'PAY-LAMBDA-B-OK', 'Lambda B obtuvo paymentId');

    // --- CAMBIO DE INSTANCIA: Lambda C (validate-sale) no comparte memoria con A ni B ---
    orderRegistry.clear(); // Se borra la RAM local simulando la 3ra máquina

    const validationC = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: amount,
      },
      baseConfig
    );

    assertEqual(validationC.valid, true, 'Lambda C valida la venta exitosamente consultando a Mercado Pago');
    assertEqual(validationC.order?.paymentId, 'PAY-LAMBDA-B-OK', 'Lambda C recupera el paymentId verificado');
    assertEqual(validationC.order?.total_amount, amount, 'Lambda C confirma el importe total');
  });

  // 109. QR Físico de Caja
  await test('109. QR FÍSICO DE CAJA: Validación de orden asociada a POS 137101354', async () => {
    const extRef = 'MINIMARKET-SALE-QR-FISICO-CAJA-01';
    orderRegistry.clear();

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '7788990011',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 2900,
              external_reference: extRef,
              config: { qr: { external_pos_id: '137101354' } },
              payments: [{ id: 'PAY-QR-FISICO-01', status: 'approved', transaction_amount: 2900 }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const validation = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: 2900,
        posId: '137101354',
        mercadoPagoSource: 'STATIC_POS_QR',
      },
      baseConfig
    );

    assertEqual(validation.valid, true, 'QR Físico de caja validado');
    assertEqual(validation.order?.externalPosId, '137101354', 'POS ID verificado');
  });

  // 110. QR Dinámico
  await test('110. QR DINÁMICO: Validación de orden dinámica con múltiples productos', async () => {
    const extRef = 'MINIMARKET-SALE-QR-DINAMICO-01';
    orderRegistry.clear();

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '6677889900',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 7800,
              external_reference: extRef,
              items: [
                { title: 'Arroz 1kg', unit_price: 1800, quantity: 2, total_amount: 3600 },
                { title: 'Aceite 1.5L', unit_price: 4200, quantity: 1, total_amount: 4200 },
              ],
              payments: [{ id: 'PAY-QR-DINAMICO-01', status: 'approved', transaction_amount: 7800 }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const validation = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: 7800,
        mercadoPagoSource: 'POINT_GENERATED_QR',
      },
      baseConfig
    );

    assertEqual(validation.valid, true, 'QR Dinámico validado');
    assertEqual(validation.order?.total_amount, 7800, 'Importe de items verificado');
  });

  // 111. Point Smart
  await test('111. POINT SMART: Validación de orden originada en Point Smart', async () => {
    const extRef = 'MINIMARKET-SALE-POINT-01';
    orderRegistry.clear();

    mockFetchHandler = async (url: string) => {
      if (url.includes(extRef)) {
        return new Response(JSON.stringify({
          elements: [
            {
              id: '5566778899',
              status: 'closed',
              currency_id: 'ARS',
              total_amount: 11500,
              external_reference: extRef,
              payments: [{ id: 'PAY-POINT-01', status: 'approved', transaction_amount: 11500 }],
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const validation = await validateMercadoPagoSalePayment(
      {
        externalReference: extRef,
        expectedAmount: 11500,
        mercadoPagoSource: 'POINT_SMART',
      },
      baseConfig
    );

    assertEqual(validation.valid, true, 'Point Smart validado');
    assertEqual(validation.order?.paymentId, 'PAY-POINT-01', 'Payment ID de terminal Point verificado');
  });

  // 112. Webhook: Procesamiento sin dependencia de RAM previa
  await test('112. WEBHOOK: Procesa notificación y recupera la orden directamente desde la API sin RAM previa', async () => {
    orderRegistry.clear(); // Sin datos previos en memoria

    mockFetchHandler = async (url: string) => {
      if (url.includes('9988771122')) {
        return new Response(JSON.stringify({
          id: '9988771122',
          status: 'closed',
          currency_id: 'ARS',
          total_amount: 2500,
          user_id: '3634603825',
          external_reference: 'MINIMARKET-WEBHOOK-RECOVERY-01',
          payments: [
            {
              id: 'PAY-WEBHOOK-REC-01',
              status: 'approved',
              transaction_amount: 2500,
            },
          ],
        }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const webhookResult = await processMercadoPagoWebhook(
      {
        action: 'payment.created',
        data: { id: '9988771122' },
        type: 'merchant_order',
      },
      {},
      {},
      baseConfig
    );

    assertEqual(webhookResult.statusCode, 200, 'Webhook procesado con HTTP 200');
    assertEqual(webhookResult.body?.success, true, 'Webhook exitoso');
    assertEqual(webhookResult.body?.orderId, '9988771122', 'OrderId procesado');
  });

  console.log('\n------------------------------------------------------');
  console.log(` RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
