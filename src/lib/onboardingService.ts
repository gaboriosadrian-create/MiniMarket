import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Business, BusinessOnboarding, CreateProductInput, UserProfile, UserOnboarding } from '../types';
import { updateBusinessOnboarding, updateBusinessCommercialData, createSellerForBusiness } from './businessService';
import { createProduct } from './productService';
import { getOrCreateDefaultCashRegister, openCashSession, getCashRegisters } from './cashCoreService';

export const CURRENT_SELLER_ONBOARDING_VERSION = 1;

export interface StarterProductTemplate {
  name: string;
  category: string;
  barcode: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  minimumStock: number;
  icon?: string;
}

export interface StarterKit {
  id: string;
  name: string;
  description: string;
  icon: string;
  products: StarterProductTemplate[];
}

export const STARTER_KITS: StarterKit[] = [
  {
    id: 'kiosco',
    name: 'Kiosco & Golosinas',
    description: 'Alfajores, gaseosas, caramelos y chocolates de alta rotación.',
    icon: '🍬',
    products: [
      {
        name: 'Gaseosa Cola 500ml',
        category: 'Bebidas',
        barcode: '7790895000430',
        costPrice: 1100,
        salePrice: 1700,
        stock: 24,
        minimumStock: 6,
        icon: '🥤',
      },
      {
        name: 'Alfajor Chocolate Triple 70g',
        category: 'Golosinas',
        barcode: '7791234567890',
        costPrice: 500,
        salePrice: 900,
        stock: 30,
        minimumStock: 8,
        icon: '🍫',
      },
      {
        name: 'Chicles Menta Extra Fresh',
        category: 'Golosinas',
        barcode: '7799876543210',
        costPrice: 350,
        salePrice: 600,
        stock: 20,
        minimumStock: 5,
        icon: '🍬',
      },
      {
        name: 'Agua Mineral Sin Gas 500ml',
        category: 'Bebidas',
        barcode: '7795554443331',
        costPrice: 600,
        salePrice: 1000,
        stock: 24,
        minimumStock: 6,
        icon: '💧',
      },
    ],
  },
  {
    id: 'almacen',
    name: 'Almacén & Despensa',
    description: 'Fideos, arroz, leche y aceite de primera necesidad.',
    icon: '🛒',
    products: [
      {
        name: 'Leche Entera Larga Vida 1L',
        category: 'Lácteos',
        barcode: '7798123456001',
        costPrice: 1150,
        salePrice: 1550,
        stock: 20,
        minimumStock: 6,
        icon: '🥛',
      },
      {
        name: 'Fideos Tallarines 500g',
        category: 'Almacén',
        barcode: '7798123456002',
        costPrice: 750,
        salePrice: 1200,
        stock: 25,
        minimumStock: 8,
        icon: '🍝',
      },
      {
        name: 'Aceite de Girasol 900ml',
        category: 'Almacén',
        barcode: '7798123456003',
        costPrice: 1800,
        salePrice: 2600,
        stock: 15,
        minimumStock: 4,
        icon: '🌻',
      },
      {
        name: 'Arroz Largo Fino 1kg',
        category: 'Almacén',
        barcode: '7798123456004',
        costPrice: 1200,
        salePrice: 1750,
        stock: 20,
        minimumStock: 5,
        icon: '🍚',
      },
    ],
  },
  {
    id: 'limpieza',
    name: 'Limpieza & Perfumería',
    description: 'Lavandina, detergente, jabón y desinfectantes.',
    icon: '🧼',
    products: [
      {
        name: 'Lavandina Clásica 1L',
        category: 'Limpieza',
        barcode: '7798123456005',
        costPrice: 900,
        salePrice: 1400,
        stock: 15,
        minimumStock: 4,
        icon: '🧴',
      },
      {
        name: 'Detergente para Platos 500ml',
        category: 'Limpieza',
        barcode: '7798123456006',
        costPrice: 1300,
        salePrice: 1950,
        stock: 18,
        minimumStock: 5,
        icon: '🧼',
      },
      {
        name: 'Jabón de Tocador 90g',
        category: 'Perfumería',
        barcode: '7798123456007',
        costPrice: 550,
        salePrice: 900,
        stock: 24,
        minimumStock: 6,
        icon: '🫧',
      },
    ],
  },
];

/**
 * Checks whether the business has completed onboarding or if it should be displayed.
 */
export function isBusinessOnboardingCompleted(business?: Business | null): boolean {
  if (!business) return true;
  if (business.onboarding?.completed) return true;

  // Check local storage fallback
  if (typeof localStorage !== 'undefined') {
    try {
      const local = localStorage.getItem(`uwi_onboarding_${business.id}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.completed) return true;
      }
    } catch {
      // Ignore
    }
  }

  return false;
}

/**
 * Checks if the onboarding guide banner was temporarily dismissed.
 */
export function isOnboardingDismissed(businessId: string): boolean {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(`uwi_onboarding_dismissed_${businessId}`) === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Sets dismissed state for onboarding banner.
 */
export function setOnboardingDismissed(businessId: string, dismissed: boolean): void {
  if (typeof localStorage !== 'undefined') {
    try {
      if (dismissed) {
        localStorage.setItem(`uwi_onboarding_dismissed_${businessId}`, 'true');
      } else {
        localStorage.removeItem(`uwi_onboarding_dismissed_${businessId}`);
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Saves starter pack products into business catalog.
 */
export async function applyStarterKit(
  businessId: string,
  userId: string,
  kitId: string
): Promise<{ added: number; errors: number }> {
  const kit = STARTER_KITS.find((k) => k.id === kitId);
  if (!kit) throw new Error('Kit de inicio no encontrado');

  let added = 0;
  let errors = 0;

  for (const item of kit.products) {
    try {
      await createProduct(businessId, userId, {
        name: item.name,
        category: item.category,
        barcode: item.barcode,
        costPrice: item.costPrice,
        salePrice: item.salePrice,
        initialStock: item.stock,
        minimumStock: item.minimumStock,
        tracksStock: true,
        icon: item.icon,
      });
      added++;
    } catch (err: any) {
      // If barcode exists, try with a timestamp suffix
      try {
        await createProduct(businessId, userId, {
          name: item.name,
          category: item.category,
          barcode: `${item.barcode}_${Date.now().toString().slice(-4)}`,
          costPrice: item.costPrice,
          salePrice: item.salePrice,
          initialStock: item.stock,
          minimumStock: item.minimumStock,
          tracksStock: true,
          icon: item.icon,
        });
        added++;
      } catch (innerErr) {
        console.warn(`[onboardingService] Error al agregar producto ${item.name}:`, innerErr);
        errors++;
      }
    }
  }

  return { added, errors };
}

/**
 * Opens initial cash shift with starter fund.
 */
export async function setupInitialCashShift(
  businessId: string,
  user: UserProfile,
  initialFloat: number
): Promise<void> {
  const cashRegister = await getOrCreateDefaultCashRegister(
    businessId,
    undefined,
    user.uid,
    user.displayName
  );

  // If already open, do not re-open
  if (cashRegister.currentSessionId) {
    return;
  }

  if (initialFloat >= 0) {
    await openCashSession({
      businessId,
      cashRegisterId: cashRegister.id,
      cashRegisterName: cashRegister.name || 'Caja Principal',
      initialAmount: initialFloat,
      userId: user.uid,
      userName: user.displayName,
      notes: 'Apertura inicial desde Guía de Configuración Inicial (Onboarding)',
    });
  }
}

/**
 * Checks whether the seller user has completed onboarding for the current version.
 */
export function isSellerOnboardingCompleted(
  userProfile?: UserProfile | null,
  currentVersion: number = CURRENT_SELLER_ONBOARDING_VERSION
): boolean {
  if (!userProfile) return true;
  
  // Check userProfile field from Firestore
  if (userProfile.onboarding?.completed) {
    const v = userProfile.onboarding.version ?? 1;
    if (v >= currentVersion) return true;
  }

  // Fallback check in localStorage
  if (typeof localStorage !== 'undefined') {
    try {
      const local = localStorage.getItem(`uwi_seller_onboarding_${userProfile.uid}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed.completed && (parsed.version ?? 1) >= currentVersion) {
          return true;
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return false;
}

/**
 * Checks if the seller onboarding modal was temporarily dismissed for the current session.
 */
export function isSellerOnboardingDismissed(userId: string): boolean {
  if (typeof localStorage !== 'undefined') {
    try {
      return localStorage.getItem(`uwi_seller_onboarding_dismissed_${userId}`) === 'true';
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Sets dismissed state for seller onboarding.
 */
export function setSellerOnboardingDismissed(userId: string, dismissed: boolean): void {
  if (typeof localStorage !== 'undefined') {
    try {
      if (dismissed) {
        localStorage.setItem(`uwi_seller_onboarding_dismissed_${userId}`, 'true');
      } else {
        localStorage.removeItem(`uwi_seller_onboarding_dismissed_${userId}`);
      }
    } catch {
      // Ignore
    }
  }
}

/**
 * Persists seller onboarding status in Firestore user doc and localStorage.
 */
export async function updateSellerOnboarding(
  userId: string,
  data: Partial<UserOnboarding>
): Promise<void> {
  const now = new Date().toISOString();
  const payload: UserOnboarding = {
    completed: data.completed ?? true,
    completedAt: data.completedAt ?? now,
    version: data.version ?? CURRENT_SELLER_ONBOARDING_VERSION,
    lastStep: data.lastStep ?? 5,
    completedSteps: data.completedSteps ?? [],
    dismissed: data.dismissed ?? false,
  };

  // 1. Sync to local storage
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(`uwi_seller_onboarding_${userId}`, JSON.stringify(payload));
    } catch {
      // Ignore
    }
  }

  // 2. Persist to Firestore doc users/{userId}
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      onboarding: payload,
      updatedAt: now,
    });
  } catch (error) {
    console.warn('[onboardingService] Error al guardar onboarding de vendedor en Firestore:', error);
  }
}

