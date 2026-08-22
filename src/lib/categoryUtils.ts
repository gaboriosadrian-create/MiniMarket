/**
 * Utility helpers for category and supplier normalization,
 * duplicate prevention, and icon resolution.
 */

// Normalizes text by removing leading/trailing spaces and collapsing multiple spaces
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text.trim().replace(/\s+/g, ' ');
}

export const normalizeCategoryName = normalizeText;

export const CATEGORIES_PRESETS = [
  'Bebidas',
  'Golosinas',
  'Snacks / Galletitas',
  'Lácteos',
  'Almacén',
  'Limpieza / Perfumería',
  'Cigarrillos',
  'Panadería',
  'Fiambres'
];

export interface AvailableIcon {
  name: string;
  label: string;
}

export const AVAILABLE_ICONS: AvailableIcon[] = [
  { name: 'Package', label: 'General / Caja' },
  { name: 'CupSoda', label: 'Bebidas / Gaseosas' },
  { name: 'Beer', label: 'Cervezas' },
  { name: 'Wine', label: 'Vinos / Licores' },
  { name: 'Coffee', label: 'Cafetería / Infusiones' },
  { name: 'Milk', label: 'Lácteos / Quesos' },
  { name: 'Cookie', label: 'Galletitas / Snacks' },
  { name: 'Candy', label: 'Golosinas / Kiosco' },
  { name: 'Pizza', label: 'Comidas / Congelados' },
  { name: 'Sandwich', label: 'Fiambres / Fiambrería' },
  { name: 'IceCream', label: 'Helados / Postres' },
  { name: 'Apple', label: 'Frutería / Verduras' },
  { name: 'Carrot', label: 'Verdulería' },
  { name: 'Beef', label: 'Carnicería / Carnes' },
  { name: 'Fish', label: 'Pescados' },
  { name: 'Egg', label: 'Huevos' },
  { name: 'Utensils', label: 'Panadería / Rotisería' },
  { name: 'Sparkles', label: 'Limpieza / Perfumería' },
  { name: 'SprayCan', label: 'Aerosoles / Cuidado' },
  { name: 'Shirt', label: 'Indumentaria / Textil' },
  { name: 'Flame', label: 'Cigarrillos / Fósforos' },
  { name: 'Tag', label: 'Ofertas / Promos' },
  { name: 'Boxes', label: 'Combos / Packs' },
  { name: 'ShoppingBag', label: 'Bolsas / Varios' }
];

export const CATEGORY_ICONS = AVAILABLE_ICONS;

// Find existing category ignoring casing and redundant spaces
export function findMatchingCategory(inputCategory: string, existingCategories: string[]): string | null {
  const normalizedInput = normalizeText(inputCategory).toLowerCase();
  if (!normalizedInput) return null;

  for (const cat of existingCategories) {
    if (normalizeText(cat).toLowerCase() === normalizedInput) {
      return cat.trim();
    }
  }
  return null;
}

// Find existing supplier ignoring casing and redundant spaces
export function findMatchingSupplier(inputSupplier: string, existingSuppliers: string[]): string | null {
  const normalizedInput = normalizeText(inputSupplier).toLowerCase();
  if (!normalizedInput) return null;

  for (const sup of existingSuppliers) {
    if (normalizeText(sup).toLowerCase() === normalizedInput) {
      return sup.trim();
    }
  }
  return null;
}

// Extract unique normalized categories list from a list of products or category strings
export function getUniqueCategories(items: (string | { category?: string } | undefined | null)[]): string[] {
  const categoryMap = new Map<string, string>(); // lowercase -> canonical

  items.forEach((item) => {
    const rawCategory = typeof item === 'string' ? item : item?.category;
    const raw = normalizeText(rawCategory);
    if (raw) {
      const lower = raw.toLowerCase();
      if (!categoryMap.has(lower)) {
        categoryMap.set(lower, raw);
      }
    }
  });

  return Array.from(categoryMap.values()).sort((a, b) => a.localeCompare(b));
}

// Extract unique normalized suppliers list from replenishment/receiving lists or supplier strings
export function getUniqueSuppliers(items: (string | { supplierName?: string; supplier?: string } | undefined | null)[]): string[] {
  const supplierMap = new Map<string, string>(); // lowercase -> canonical

  items.forEach((item) => {
    const rawSupplier = typeof item === 'string' ? item : (item?.supplierName || item?.supplier);
    const raw = normalizeText(rawSupplier);
    if (raw) {
      const lower = raw.toLowerCase();
      if (!supplierMap.has(lower)) {
        supplierMap.set(lower, raw);
      }
    }
  });

  return Array.from(supplierMap.values()).sort((a, b) => a.localeCompare(b));
}

// Heuristic to suggest a Lucide icon based on category or product name
export function getDefaultIconForCategoryOrProduct(nameOrCategory: string): string {
  const str = (nameOrCategory || '').toLowerCase();
  
  if (str.includes('coca') || str.includes('gaseosa') || str.includes('jugo') || str.includes('agua') || str.includes('soda') || str.includes('bebida') || str.includes('pepsi') || str.includes('sprite') || str.includes('fanta')) {
    return 'CupSoda';
  }
  if (str.includes('cerveza') || str.includes('birra') || str.includes('quilmes') || str.includes('brahma') || str.includes('heineken') || str.includes('stella')) {
    return 'Beer';
  }
  if (str.includes('vino') || str.includes('fernet') || str.includes('champagne') || str.includes('whisky') || str.includes('licor')) {
    return 'Wine';
  }
  if (str.includes('cafe') || str.includes('café') || str.includes('te ') || str.includes('té') || str.includes('yerba') || str.includes('mate') || str.includes('infusion')) {
    return 'Coffee';
  }
  if (str.includes('lacteo') || str.includes('lácteo') || str.includes('leche') || str.includes('queso') || str.includes('yogur') || str.includes('manteca') || str.includes('crema')) {
    return 'Milk';
  }
  if (str.includes('gallet') || str.includes('pepitos') || str.includes('oreo') || str.includes('snack') || str.includes('papas') || str.includes('chizito') || str.includes('alfajor')) {
    return 'Cookie';
  }
  if (str.includes('caramelo') || str.includes('chicle') || str.includes('golosina') || str.includes('chocolate') || str.includes('kiosco') || str.includes('tnt')) {
    return 'Candy';
  }
  if (str.includes('helado') || str.includes('postre') || str.includes('flan')) {
    return 'IceCream';
  }
  if (str.includes('pan') || str.includes('factura') || str.includes('medialuna') || str.includes('bizcocho') || str.includes('tostada') || str.includes('panaderia') || str.includes('panadería')) {
    return 'Utensils';
  }
  if (str.includes('fiambre') || str.includes('jamon') || str.includes('jamón') || str.includes('salame') || str.includes('salchicha') || str.includes('sandwich') || str.includes('sándwich')) {
    return 'Sandwich';
  }
  if (str.includes('carne') || str.includes('pollo') || str.includes('asado') || str.includes('milanesa') || str.includes('hamburguesa')) {
    return 'Beef';
  }
  if (str.includes('fruta') || str.includes('manzana') || str.includes('banana') || str.includes('naranja') || str.includes('limon') || str.includes('limón')) {
    return 'Apple';
  }
  if (str.includes('verdura') || str.includes('lechuga') || str.includes('tomate') || str.includes('papa') || str.includes('cebolla') || str.includes('zanahoria')) {
    return 'Carrot';
  }
  if (str.includes('limpieza') || str.includes('detergente') || str.includes('lavandina') || str.includes('jabon') || str.includes('jabón') || str.includes('shampoo') || str.includes('desodorante')) {
    return 'Sparkles';
  }
  if (str.includes('cigarro') || str.includes('cigarrillo') || str.includes('tabaco') || str.includes('fosforo') || str.includes('fósforo') || str.includes('encendedor')) {
    return 'Flame';
  }
  if (str.includes('combo') || str.includes('pack') || str.includes('promo')) {
    return 'Boxes';
  }

  return 'Package';
}

export interface CategoryColorTheme {
  bg: string;
  text: string;
  border: string;
}

// Color palette mapping for category and product icons
export function getCategoryColorClasses(categoryOrName?: string | null): CategoryColorTheme {
  const str = (categoryOrName || '').toLowerCase();

  // Bebidas: gaseosas, agua, jugo, cerveza, vino
  if (str.includes('coca') || str.includes('gaseosa') || str.includes('pepsi') || str.includes('sprite') || str.includes('fanta')) {
    return { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200' };
  }
  if (str.includes('jugo') || str.includes('agua') || str.includes('soda') || str.includes('bebida') || str.includes('cerveza') || str.includes('birra') || str.includes('quilmes') || str.includes('brahma') || str.includes('heineken') || str.includes('stella')) {
    return { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200' };
  }
  if (str.includes('vino') || str.includes('fernet') || str.includes('champagne') || str.includes('whisky') || str.includes('licor')) {
    return { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' };
  }
  // Golosinas / Kiosco / Chocolates
  if (str.includes('caramelo') || str.includes('chicle') || str.includes('golosina') || str.includes('chocolate') || str.includes('kiosco') || str.includes('tnt')) {
    return { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700', border: 'border-fuchsia-200' };
  }
  // Snacks / Galletitas / Alfajores
  if (str.includes('gallet') || str.includes('pepitos') || str.includes('oreo') || str.includes('snack') || str.includes('papas') || str.includes('chizito') || str.includes('alfajor')) {
    return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
  }
  // Cafetería / Infusiones / Yerba
  if (str.includes('cafe') || str.includes('café') || str.includes('te ') || str.includes('té') || str.includes('yerba') || str.includes('mate') || str.includes('infusion')) {
    return { bg: 'bg-amber-100/80', text: 'text-amber-800', border: 'border-amber-300' };
  }
  // Lácteos / Quesos
  if (str.includes('lacteo') || str.includes('lácteo') || str.includes('leche') || str.includes('queso') || str.includes('yogur') || str.includes('manteca') || str.includes('crema')) {
    return { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' };
  }
  // Panadería / Rotisería / Pastas
  if (str.includes('pan') || str.includes('factura') || str.includes('medialuna') || str.includes('bizcocho') || str.includes('tostada') || str.includes('panaderia') || str.includes('panadería')) {
    return { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' };
  }
  // Fiambres / Carnes
  if (str.includes('fiambre') || str.includes('jamon') || str.includes('jamón') || str.includes('salame') || str.includes('salchicha') || str.includes('sandwich') || str.includes('sándwich') || str.includes('carne') || str.includes('pollo') || str.includes('asado') || str.includes('milanesa') || str.includes('hamburguesa')) {
    return { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' };
  }
  // Frutas / Verduras
  if (str.includes('fruta') || str.includes('manzana') || str.includes('banana') || str.includes('naranja') || str.includes('limon') || str.includes('limón') || str.includes('verdura') || str.includes('lechuga') || str.includes('tomate') || str.includes('papa') || str.includes('cebolla') || str.includes('zanahoria')) {
    return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
  }
  // Limpieza / Perfumería
  if (str.includes('limpieza') || str.includes('detergente') || str.includes('lavandina') || str.includes('jabon') || str.includes('jabón') || str.includes('shampoo') || str.includes('desodorante')) {
    return { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' };
  }
  // Cigarrillos / Fósforos
  if (str.includes('cigarro') || str.includes('cigarrillo') || str.includes('tabaco') || str.includes('fosforo') || str.includes('fósforo') || str.includes('encendedor')) {
    return { bg: 'bg-stone-100', text: 'text-stone-700', border: 'border-stone-300' };
  }

  // Default / General
  return { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' };
}

