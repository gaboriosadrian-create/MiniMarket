process.env.NODE_ENV = 'test';
import { paymentProviderService, maskUserId } from '../server/mercadopago/paymentProviderService.js';
import { tenantConfigStore } from '../server/mercadopago/tenantConfigStore.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
  if (condition) {
    console.log(`  ✓ ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    failed++;
  }
}

async function runTests() {
  console.log('======================================================');
  console.log('  UWI: MULTI-TENANT MERCADO PAGO ARCHITECTURE TESTS');
  console.log('======================================================');

  const businessA = 'BIZ_ALMACEN_CENTRAL';
  const businessB = 'BIZ_KIOSCO_ESQUINA';

  // Ensure clean test state
  paymentProviderService.disconnectBusiness(businessA);
  paymentProviderService.disconnectBusiness(businessB);

  // 1. Initial State: Unconnected
  const initialStatusA = paymentProviderService.getSanitizedStatus(businessA);
  assert(initialStatusA.connected === false, '1. Negocio A inicia en estado NO conectado');
  assert(initialStatusA.status === 'DISCONNECTED', '2. Negocio A inicia con status DISCONNECTED');
  assert(!initialStatusA.accountInfo?.userId, '3. Negocio A no expone accountInfo.userId cuando está desconectado');

  // 2. Connect Business A
  const connectResultA = await paymentProviderService.connectBusiness({
    businessId: businessA,
    accountNickname: 'Almacén Central MP',
  });
  assert(connectResultA.success === true, '4. Conexión de Mercado Pago para Negocio A es exitosa');
  assert(connectResultA.provider.status === 'CONNECTED', '5. Provider de Negocio A queda en CONNECTED');

  const statusA = paymentProviderService.getSanitizedStatus(businessA);
  assert(statusA.connected === true, '6. getSanitizedStatus(businessA) reporta connected: true');
  assert(statusA.status === 'CONNECTED', '7. getSanitizedStatus(businessA) reporta status: CONNECTED');
  assert(Boolean(statusA.accountInfo?.externalStoreId), '8. Negocio A tiene externalStoreId generado de forma determinista');
  assert(Boolean(statusA.accountInfo?.externalPosId), '9. Negocio A tiene externalPosId generado de forma determinista');

  // 3. Security: No secrets exposed
  const statusStr = JSON.stringify(statusA);
  assert(!statusStr.includes('accessToken'), '10. SEGURIDAD: getSanitizedStatus jamás expone accessToken');
  assert(!statusStr.includes('clientSecret'), '11. SEGURIDAD: getSanitizedStatus jamás expone clientSecret');
  assert(!statusStr.includes('refreshToken'), '12. SEGURIDAD: getSanitizedStatus jamás expone refreshToken');

  // 4. Multi-Tenant Isolation: Business B remains disconnected
  const statusB = paymentProviderService.getSanitizedStatus(businessB);
  assert(statusB.connected === false, '13. AISLAMIENTO MULTI-TENANT: Negocio B permanece desconectado cuando A se conecta');
  assert(statusB.status === 'DISCONNECTED', '14. AISLAMIENTO MULTI-TENANT: status de B no es afectado por A');

  // 5. Connect Business B with different account
  const connectResultB = await paymentProviderService.connectBusiness({
    businessId: businessB,
    userId: '9876543210',
    accountNickname: 'Kiosco Esquina MP',
  });
  assert(connectResultB.success === true, '15. Conexión de Mercado Pago para Negocio B es exitosa');

  const statusBConnected = paymentProviderService.getSanitizedStatus(businessB);
  assert(statusBConnected.connected === true, '16. Negocio B reporta connected: true');
  assert(statusBConnected.accountInfo?.externalStoreId !== statusA.accountInfo?.externalStoreId,
    '17. Sucursal de Negocio B es distinta e independiente de la de Negocio A');
  assert(statusBConnected.accountInfo?.externalPosId !== statusA.accountInfo?.externalPosId,
    '18. Caja de Negocio B es distinta e independiente de la de Negocio A');

  // 6. Masked User ID Helper
  assert(maskUserId('3634603825') === '******3825', '19. maskUserId enmascara correctamente el número de usuario');
  assert(maskUserId('123') === '****123', '20. maskUserId maneja IDs cortos de forma segura');

  // 7. Disconnect Business A
  const disconnectResultA = paymentProviderService.disconnectBusiness(businessA);
  assert(disconnectResultA.success === true, '21. Desconexión de Negocio A es exitosa');

  const statusADisconnected = paymentProviderService.getSanitizedStatus(businessA);
  assert(statusADisconnected.connected === false, '22. Negocio A vuelve a status DISCONNECTED');
  assert(statusADisconnected.enabled === false, '23. enabled de Negocio A queda en false');

  // 8. Business B remains connected after Business A disconnects
  const statusBAfterADisconnect = paymentProviderService.getSanitizedStatus(businessB);
  assert(statusBAfterADisconnect.connected === true, '24. AISLAMIENTO: Desconectar A NO afecta el estado conectado de B');

  // 9. Lookup business by POS or User for Webhook routing
  const resolvedBusiness = paymentProviderService.findBusinessByPosOrUser({
    userId: '9876543210',
  });
  assert(resolvedBusiness === businessB, '25. WEBHOOK MULTI-TENANT: Resuelve businessId B a partir de su userId');

  console.log('------------------------------------------------------');
  console.log(` RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('------------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
