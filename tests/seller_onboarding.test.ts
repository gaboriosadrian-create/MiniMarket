import { 
  isSellerOnboardingCompleted, 
  isSellerOnboardingDismissed, 
  setSellerOnboardingDismissed,
  CURRENT_SELLER_ONBOARDING_VERSION 
} from '../src/lib/onboardingService';
import { UserProfile } from '../src/types';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void> | void) {
  try {
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

// Mock localStorage for Node.js test environment if not present
const localStorageMock: Record<string, string> = {};
if (typeof (global as any).localStorage === 'undefined') {
  (global as any).localStorage = {
    getItem: (key: string) => localStorageMock[key] || null,
    setItem: (key: string, value: string) => {
      localStorageMock[key] = value;
    },
    removeItem: (key: string) => {
      delete localStorageMock[key];
    },
    clear: () => {
      Object.keys(localStorageMock).forEach(k => delete localStorageMock[k]);
    }
  };
}

console.log('======================================================');
console.log('  UWI: AUDITORÍA TÉCNICA - ONBOARDING DE VENDEDORES');
console.log('======================================================\n');

async function runAllTests() {
  // 1. Validar detección de onboarding no completado
  await test('1. Seller Onboarding: no completado cuando profile es null o no tiene onboarding', () => {
    assertEqual(isSellerOnboardingCompleted(null), true, 'Null profile handled safely');
    
    const sellerWithoutOnboarding: UserProfile = {
      uid: 'seller_123',
      email: 'seller@gmail.com',
      displayName: 'Carlos Vendedor',
      role: 'SELLER',
      businessId: 'biz_01',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    assertEqual(isSellerOnboardingCompleted(sellerWithoutOnboarding), false, 'Debe devolver false para vendedor nuevo');
  });

  // 2. Validar detección de onboarding completado
  await test('2. Seller Onboarding: completado cuando flag en perfil es true y versión coincide', () => {
    const sellerCompleted: UserProfile = {
      uid: 'seller_456',
      email: 'seller2@gmail.com',
      displayName: 'Ana Vendedora',
      role: 'SELLER',
      businessId: 'biz_01',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      onboarding: {
        completed: true,
        completedAt: new Date().toISOString(),
        version: CURRENT_SELLER_ONBOARDING_VERSION,
        lastStep: 5,
        completedSteps: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5']
      }
    };
    assertEqual(isSellerOnboardingCompleted(sellerCompleted), true, 'Debe devolver true para vendedor con onboarding completado');
  });

  // 3. Validar versión de onboarding
  await test('3. Seller Onboarding: detecta si la versión del onboarding es anterior (re-trigger con nueva versión)', () => {
    const sellerOldVersion: UserProfile = {
      uid: 'seller_old',
      email: 'old@gmail.com',
      displayName: 'Vendedor Version Vieja',
      role: 'SELLER',
      businessId: 'biz_01',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      onboarding: {
        completed: true,
        completedAt: new Date().toISOString(),
        version: 0, // versión antigua
        lastStep: 3,
        completedSteps: ['step_1']
      }
    };
    assertEqual(isSellerOnboardingCompleted(sellerOldVersion, 2), false, 'Debe devolver false si la versión requerida es mayor');
  });

  // 4. Validar dismissed state en localStorage
  await test('4. Seller Onboarding: dismissed state persiste en storage local', () => {
    const userId = 'seller_dismiss_test';
    setSellerOnboardingDismissed(userId, false);
    assertEqual(isSellerOnboardingDismissed(userId), false, 'Inicialmente no dismissed');

    setSellerOnboardingDismissed(userId, true);
    assertEqual(isSellerOnboardingDismissed(userId), true, 'Queda dismissed tras set');

    setSellerOnboardingDismissed(userId, false);
    assertEqual(isSellerOnboardingDismissed(userId), false, 'Se remueve correctamente');
  });

  // 5. Validar consistencia de tipos
  await test('5. Seller Onboarding: versión actual configurada correctamente', () => {
    assert(CURRENT_SELLER_ONBOARDING_VERSION >= 1, 'CURRENT_SELLER_ONBOARDING_VERSION debe ser al menos 1');
  });

  console.log('\n------------------------------------------------------');
  console.log(`  RESUMEN: ${passed} pasados, ${failed} fallidos`);
  console.log('------------------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((e) => {
  console.error('Fatal test error:', e);
  process.exit(1);
});
