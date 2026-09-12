import { doc, getDoc } from 'firebase/firestore';
import { db, firebaseConfig } from '../../src/lib/firebase.js';
import type { UserProfile, UserRole, UserStatus, UserPermissions } from '../../src/types.js';

export interface TestAuthUser {
  uid: string;
  email: string;
  displayName?: string;
  role: UserRole;
  businessId: string | null;
  active: boolean;
  status?: UserStatus;
  permissions?: UserPermissions;
}

export interface AuthResult {
  ok: boolean;
  status?: number; // 401 | 403 | 500
  code?: string; // 'UNAUTHORIZED' | 'FORBIDDEN' | 'INTERNAL_ERROR'
  message?: string;
  user?: {
    uid: string;
    email: string;
    role: UserRole;
    businessId: string | null;
  };
}

// In-memory registry for mock tokens during testing
const testUserRegistry = new Map<string, TestAuthUser>();

/**
 * Registers a mock user token for testing environments without contacting Google Identity Toolkit.
 */
export function registerTestUser(token: string, user: TestAuthUser): void {
  testUserRegistry.set(token, user);
}

/**
 * Clears all registered test users.
 */
export function clearTestUsers(): void {
  testUserRegistry.clear();
}

/**
 * Centralized Server-Side Firebase Auth & Tenant Authorization verifier.
 *
 * Verifies:
 * 1. Presence and format of `Authorization: Bearer <token>` header.
 * 2. Authenticity of the Firebase ID Token (via Google Identity Toolkit REST API or test registry).
 * 3. Existence and active status of the user profile in Firestore.
 * 4. User role authorization (SUPER_ADMIN, ADMIN, or SELLER with sales.create permission).
 * 5. Multi-tenant isolation: ensures user.businessId matches requestedBusinessId (except SUPER_ADMIN).
 */
export async function verifyAuthAndAuthorization(
  req: any,
  requestedBusinessId?: string
): Promise<AuthResult> {
  // 1. Validate presence of Authorization header
  const authHeader = req?.headers?.authorization || req?.headers?.Authorization;
  if (!authHeader || typeof authHeader !== 'string') {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Encabezado de autorización ausente o no válido.',
    };
  }

  // 2. Validate Bearer format
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match || !match[1]?.trim()) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Formato de autorización inválido. Se espera: Bearer <token>.',
    };
  }

  const token = match[1].trim();
  if (!token) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Token de autenticación vacío.',
    };
  }

  // 3. Verify token
  let verifiedUid: string | null = null;
  let verifiedEmail: string | null = null;
  let userProfile: UserProfile | TestAuthUser | null = null;

  if (testUserRegistry.has(token)) {
    userProfile = testUserRegistry.get(token)!;
    verifiedUid = userProfile.uid;
    verifiedEmail = userProfile.email;
  } else if (
    process.env.NODE_ENV === 'test' &&
    (token.startsWith('test-') ||
      token.startsWith('mock-') ||
      token.includes('invalid') ||
      token === 'fake-token' ||
      token === 'bad-token')
  ) {
    return {
      ok: false,
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'Token de autenticación no válido.',
    };
  } else {
    // Real validation against Google Identity Toolkit accounts:lookup
    try {
      const apiKey = firebaseConfig.apiKey;
      const response = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: token }),
        }
      );

      if (!response.ok) {
        return {
          ok: false,
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'Token de autenticación inválido o expirado.',
        };
      }

      const data: any = await response.json();
      const googleUser = data?.users?.[0];
      if (!googleUser || !googleUser.localId) {
        return {
          ok: false,
          status: 401,
          code: 'UNAUTHORIZED',
          message: 'No se pudo verificar la identidad del usuario en Firebase.',
        };
      }

      verifiedUid = googleUser.localId;
      verifiedEmail = googleUser.email || '';
    } catch (err) {
      console.error('[AuthMiddleware] Error verificando token con Google Identity Toolkit:', err);
      return {
        ok: false,
        status: 401,
        code: 'UNAUTHORIZED',
        message: 'Error al verificar token de autenticación.',
      };
    }
  }

  // 4. Fetch User Profile from Firestore if not provided by test registry
  if (!userProfile && verifiedUid) {
    try {
      const userDocRef = doc(db, 'users', verifiedUid);
      const userSnap = await getDoc(userDocRef);
      if (userSnap.exists()) {
        userProfile = userSnap.data() as UserProfile;
      } else {
        // Check if user is SuperAdmin Owner Google Account
        const superAdminEmail = (
          process.env.SUPERADMIN_EMAIL ||
          process.env.VITE_SUPERADMIN_EMAIL ||
          'gaboriosadrian@gmail.com'
        )
          .toLowerCase()
          .trim();

        if (verifiedEmail && verifiedEmail.toLowerCase().trim() === superAdminEmail) {
          userProfile = {
            uid: verifiedUid,
            email: verifiedEmail,
            displayName: 'Super Admin',
            role: 'SUPER_ADMIN',
            businessId: null,
            active: true,
            status: 'ACTIVE',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
      }
    } catch (err) {
      console.error('[AuthMiddleware] Error leyendo usuario de Firestore:', err);
      return {
        ok: false,
        status: 500,
        code: 'INTERNAL_ERROR',
        message: 'Error de servidor al validar usuario.',
      };
    }
  }

  // 5. Verify user existence
  if (!userProfile) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'El usuario no está registrado en el sistema.',
    };
  }

  // 6. Verify user status is ACTIVE (not BLOCKED or DISABLED)
  if (
    userProfile.active === false ||
    userProfile.status === 'BLOCKED' ||
    userProfile.status === 'DISABLED'
  ) {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message:
        userProfile.status === 'BLOCKED'
          ? 'Tu usuario se encuentra bloqueado.'
          : 'Tu usuario se encuentra inactivo o desactivado.',
    };
  }

  // 7. Verify user role & permissions
  const role = userProfile.role;
  if (role === 'SUPER_ADMIN' || role === 'ADMIN') {
    // ADMIN and SUPER_ADMIN have full permission to operate
  } else if (role === 'SELLER') {
    if (userProfile.permissions?.sales && userProfile.permissions.sales.create === false) {
      return {
        ok: false,
        status: 403,
        code: 'FORBIDDEN',
        message: 'No tienes permisos para generar ventas o cobros.',
      };
    }
  } else {
    return {
      ok: false,
      status: 403,
      code: 'FORBIDDEN',
      message: 'Rol de usuario no autorizado para procesar cobros.',
    };
  }

  // 8. Tenant Isolation: Check business authorization
  const reqBiz = String(requestedBusinessId || '').trim();
  if (reqBiz) {
    // SUPER_ADMIN has global authorization across all tenants
    if (role !== 'SUPER_ADMIN') {
      const userBiz = String(userProfile.businessId || '').trim();
      if (!userBiz || userBiz !== reqBiz) {
        return {
          ok: false,
          status: 403,
          code: 'FORBIDDEN',
          message: 'No tienes autorización para operar en este negocio.',
        };
      }
    }
  }

  return {
    ok: true,
    user: {
      uid: userProfile.uid,
      email: userProfile.email,
      role: userProfile.role,
      businessId: userProfile.businessId,
    },
  };
}
