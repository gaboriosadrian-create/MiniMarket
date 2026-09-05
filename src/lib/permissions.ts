import { UserProfile, UserPermissions, PermissionPath } from '../types';

export const DEFAULT_SELLER_PERMISSIONS: UserPermissions = {
  sales: {
    create: true,
    view: true,
  },
  inventory: {
    view: true,
    receive: false,
    stockEntry: false,
    editBarcode: true,
  },
  receiving: {
    create: false,
    view: false,
    confirm: false,
  },
  purchases: {
    create: false,
    view: false,
  },
  cash: {
    view: false,
    purchasePayment: false,
    controlCaja: false,
  },
  replenishment: {
    create: false,
    view: false,
    export: false,
  },
};

/**
  * Returns effective permissions for a user profile.
  * ADMIN and SUPER_ADMIN have all permissions set to true.
  * For legacy SELLERS without explicit permissions object, returns DEFAULT_SELLER_PERMISSIONS.
  */
export function getEffectivePermissions(user: UserProfile | null): UserPermissions {
  if (!user) return DEFAULT_SELLER_PERMISSIONS;

  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return {
      sales: { create: true, view: true },
      inventory: { view: true, receive: true, stockEntry: true, editBarcode: true },
      receiving: { create: true, view: true, confirm: true },
      purchases: { create: true, view: true },
      cash: { view: true, purchasePayment: true, controlCaja: true },
      replenishment: { create: true, view: true, export: true },
    };
  }

  if (!user.permissions) {
    return DEFAULT_SELLER_PERMISSIONS;
  }

  return {
    sales: {
      create: user.permissions.sales?.create ?? true,
      view: user.permissions.sales?.view ?? true,
    },
    inventory: {
      view: user.permissions.inventory?.view ?? true,
      receive: user.permissions.inventory?.receive ?? false,
      stockEntry: user.permissions.inventory?.stockEntry ?? false,
      editBarcode: user.permissions.inventory?.editBarcode ?? true,
    },
    receiving: {
      create: user.permissions.receiving?.create ?? false,
      view: user.permissions.receiving?.view ?? false,
      confirm: user.permissions.receiving?.confirm ?? false,
    },
    purchases: {
      create: user.permissions.purchases?.create ?? false,
      view: user.permissions.purchases?.view ?? false,
    },
    cash: {
      view: user.permissions.cash?.view ?? false,
      purchasePayment: user.permissions.cash?.purchasePayment ?? false,
      controlCaja: user.permissions.cash?.controlCaja ?? false,
    },
    replenishment: {
      create: user.permissions.replenishment?.create ?? false,
      view: user.permissions.replenishment?.view ?? false,
      export: user.permissions.replenishment?.export ?? false,
    },
  };
}

/**
  * Centralized permission checking helper.
  * Evaluates user status (ACTIVE / BLOCKED / DISABLED / active flag) and granular permissions.
  */
export function hasPermission(
  user: UserProfile | null,
  permission: PermissionPath
): boolean {
  if (!user) return false;

  // If user is inactive, blocked, or disabled, deny all protected operations
  if (user.active === false || user.status === 'BLOCKED' || user.status === 'DISABLED') {
    return false;
  }

  // SuperAdmin and Admin have full access
  if (user.role === 'SUPER_ADMIN' || user.role === 'ADMIN') {
    return true;
  }

  // Seller evaluation
  if (user.role === 'SELLER') {
    const eff = getEffectivePermissions(user);
    switch (permission) {
      case 'sales.create':
        return eff.sales.create;
      case 'sales.view':
        return eff.sales.view;
      case 'inventory.view':
        return eff.inventory.view;
      case 'inventory.receive':
        return eff.inventory.receive;
      case 'inventory.stock_entry':
        return eff.inventory.stockEntry;
      case 'inventory.edit_barcode':
        return eff.inventory.editBarcode ?? true;
      case 'receiving.create':
        return eff.receiving.create;
      case 'receiving.view':
        return eff.receiving.view;
      case 'receiving.confirm':
        return eff.receiving.confirm;
      case 'purchases.create':
        return eff.purchases.create;
      case 'purchases.view':
        return eff.purchases.view;
      case 'cash.view':
        return eff.cash.view;
      case 'cash.purchase_payment':
        return eff.cash.purchasePayment;
      case 'cash.control_caja':
        return eff.cash.controlCaja ?? false;
      case 'replenishment.create':
        return eff.replenishment?.create ?? false;
      case 'replenishment.view':
        return eff.replenishment?.view ?? false;
      case 'replenishment.export':
        return eff.replenishment?.export ?? false;
      default:
        return false;
    }
  }

  return false;
}
