import assert from 'node:assert';
import { normalizeApiBaseUrl, getApiBaseUrl, getApiUrl } from '../src/lib/apiConfig';

console.log('\n======================================================');
console.log('  UWI: API CONFIGURATION & ROUTING TESTS');
console.log('======================================================\n');

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    console.error(`  ✗ ${name}:`, err.message);
    process.exit(1);
  }
}

// 1. Base URL normalization
test('1. Normaliza URL limpia sin cambios', () => {
  const result = normalizeApiBaseUrl('https://api.example.com');
  assert.strictEqual(result, 'https://api.example.com');
});

test('2. Remueve barra final en la base URL (trailing slash)', () => {
  const result = normalizeApiBaseUrl('https://api.example.com/');
  assert.strictEqual(result, 'https://api.example.com');
});

test('3. Remueve múltiples barras finales', () => {
  const result = normalizeApiBaseUrl('https://api.example.com///');
  assert.strictEqual(result, 'https://api.example.com');
});

test('4. Remueve sufijo accidental "/api" para evitar "/api/api"', () => {
  const result = normalizeApiBaseUrl('https://api.example.com/api');
  assert.strictEqual(result, 'https://api.example.com');
});

test('5. Remueve sufijo accidental "/api/" con barra final', () => {
  const result = normalizeApiBaseUrl('https://api.example.com/api/');
  assert.strictEqual(result, 'https://api.example.com');
});

test('6. Maneja cadenas vacías o con solo espacios', () => {
  assert.strictEqual(normalizeApiBaseUrl(''), '');
  assert.strictEqual(normalizeApiBaseUrl('   '), '');
});

// 2. Default same-origin Vercel / local execution (empty VITE_API_BASE_URL)
test('7. ARQUITECTURA VERCEL: getApiUrl("/api/mercadopago/connect") === "/api/mercadopago/connect" con base vacía', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  delete process.env.VITE_API_BASE_URL;
  try {
    assert.strictEqual(getApiBaseUrl(), '');
    const result = getApiUrl('/api/mercadopago/connect');
    assert.strictEqual(result, '/api/mercadopago/connect');
  } finally {
    if (originalEnv !== undefined) process.env.VITE_API_BASE_URL = originalEnv;
  }
});

test('8. NO CLOUD RUN: En Vercel (*.vercel.app), getApiUrl produce ruta relativa y NUNCA ais-pre/run.app', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  const originalWindow = (globalThis as any).window;
  delete process.env.VITE_API_BASE_URL;
  (globalThis as any).window = {
    location: { hostname: 'minimarket-roan.vercel.app' }
  };
  try {
    const connectUrl = getApiUrl('/api/mercadopago/connect?businessId=biz_central_school');
    assert.strictEqual(
      connectUrl,
      '/api/mercadopago/connect?businessId=biz_central_school'
    );
    assert.ok(!connectUrl.includes('run.app'), 'No debe contener run.app');
    assert.ok(!connectUrl.includes('ais-pre'), 'No debe contener ais-pre');
  } finally {
    if (originalEnv !== undefined) process.env.VITE_API_BASE_URL = originalEnv;
    (globalThis as any).window = originalWindow;
  }
});

test('9. MIGRATED ENDPOINTS: Ninguna llamada frontend genera URL hacia ais-pre...run.app', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  delete process.env.VITE_API_BASE_URL;
  try {
    const endpointsToVerify = [
      '/api/mercadopago/connect?businessId=biz_123',
      '/api/mercadopago/status?businessId=biz_123',
      '/api/mercadopago/disconnect',
      '/api/mercadopago/create-order',
      '/api/mercadopago/order-status?external_reference=order_456',
      '/api/mercadopago/cancel-order',
      '/api/mercadopago/validate-sale',
      '/api/mercadopago/config?businessId=biz_123',
      '/api/mercadopago/merchants',
      '/api/mercadopago/platform-config',
      '/api/mercadopago/audits?limit=8',
      '/api/mercadopago/config/test',
      '/api/health',
    ];

    for (const ep of endpointsToVerify) {
      const resolved = getApiUrl(ep);
      assert.ok(resolved.startsWith('/api/'), `Debe iniciar con /api/: ${resolved}`);
      assert.ok(!resolved.includes('run.app'), `No debe contener run.app: ${resolved}`);
      assert.ok(!resolved.includes('ais-pre'), `No debe contener ais-pre: ${resolved}`);
    }
  } finally {
    if (originalEnv !== undefined) process.env.VITE_API_BASE_URL = originalEnv;
  }
});

test('10. Limpieza de prefijo /api/api/ duplicado', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  delete process.env.VITE_API_BASE_URL;
  try {
    const result = getApiUrl('/api/api/mercadopago/connect?businessId=biz_central_school');
    assert.strictEqual(result, '/api/mercadopago/connect?businessId=biz_central_school');
  } finally {
    if (originalEnv !== undefined) process.env.VITE_API_BASE_URL = originalEnv;
  }
});

test('11. Conserva query parameters complejos y hashes en rutas relativas', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  delete process.env.VITE_API_BASE_URL;
  try {
    const queryUrl = getApiUrl(
      '/api/mercadopago/connect?businessId=biz_1&uid=user_2&returnOrigin=https%3A%2F%2Fminimarket-roan.vercel.app'
    );
    assert.strictEqual(
      queryUrl,
      '/api/mercadopago/connect?businessId=biz_1&uid=user_2&returnOrigin=https%3A%2F%2Fminimarket-roan.vercel.app'
    );
  } finally {
    if (originalEnv !== undefined) process.env.VITE_API_BASE_URL = originalEnv;
  }
});

test('12. Soporta VITE_API_BASE_URL explícita si se configura un backend o proxy personalizado', () => {
  const originalEnv = process.env.VITE_API_BASE_URL;
  process.env.VITE_API_BASE_URL = 'https://custom-gateway.io/api/';
  try {
    const customUrl = getApiUrl('/api/mercadopago/connect?businessId=biz_custom');
    assert.strictEqual(
      customUrl,
      'https://custom-gateway.io/api/mercadopago/connect?businessId=biz_custom'
    );
    assert.ok(!customUrl.includes('/api/api/'));
  } finally {
    if (originalEnv !== undefined) {
      process.env.VITE_API_BASE_URL = originalEnv;
    } else {
      delete process.env.VITE_API_BASE_URL;
    }
  }
});

console.log('\n------------------------------------------------------');
console.log(' ALL 12 API ROUTING TESTS PASSED');
console.log('------------------------------------------------------\n');

