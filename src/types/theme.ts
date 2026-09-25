export type ThemeStatus = 'active' | 'saved' | 'archived';
export type ThemeCategory = 'core' | 'experimental';

export interface ThemeTokens {
  // Surface & Background Neutrals
  bg: string;
  surface: string;
  surfaceSubtle: string;
  surfaceHover: string;
  surfaceActive: string;

  // Borders & Dividers
  border: string;
  borderSubtle: string;
  borderStrong: string;
  borderFocus: string;

  // Typography & Text
  text: string;
  textSecondary: string;
  textMuted: string;
  textSubtle: string;
  textInverse: string;

  // Primary Brand & Action
  primary: string;
  primaryHover: string;
  primaryActive: string;
  primarySubtle: string;
  primaryText: string;

  // Secondary Button / Surface
  secondary: string;
  secondaryHover: string;
  secondaryText: string;
  secondaryBorder: string;

  // Semantic Feedback: Success
  success: string;
  successBg: string;
  successBorder: string;
  successText: string;

  // Semantic Feedback: Warning
  warning: string;
  warningBg: string;
  warningBorder: string;
  warningText: string;

  // Semantic Feedback: Danger
  danger: string;
  dangerBg: string;
  dangerBorder: string;
  dangerText: string;

  // Semantic Feedback: Info
  info: string;
  infoBg: string;
  infoBorder: string;
  infoText: string;

  // Radii
  radiusSm: string;
  radiusMd: string;
  radiusLg: string;
  radiusXl: string;
  radiusFull: string;

  // Shadows
  shadowXs: string;
  shadowSm: string;
  shadowMd: string;
  shadowLg: string;

  // Typography & Sizing
  fontSans: string;
  fontMono: string;
  spacingFactor: number;
  btnHeight: string;
  btnHeightSm: string;
  inputHeight: string;
  touchTarget: string;
}

export interface ThemeModel {
  id: string;
  name: string;
  description?: string;
  subtitle?: string;
  badge?: string;
  category?: ThemeCategory;
  layoutStyle?: string;
  keyFeatures?: string[];
  status: ThemeStatus;
  version: number;
  isPreset?: boolean;
  tokens: ThemeTokens;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface DesignLabGlobalConfig {
  activeThemeId: string;
  updatedAt: string;
  updatedBy?: string;
}

// =============================================================
// CATEGORÍA 1: UWI CORE (5 TEMAS EXISTENTES)
// =============================================================

// TEMA 01: UWI CLEAN (Predeterminado — Minimalista, Moderno, Vercel/Linear)
export const PRESET_UWI_CLEAN: ThemeModel = {
  id: 'uwi-clean',
  name: 'UWI Clean',
  subtitle: 'Minimalista & Moderno',
  description: 'Fondo general ultra limpio, superficies blancas, bordes sutiles y máxima jerarquía tipográfica. Inspirado en Linear y Vercel.',
  badge: 'Predeterminado',
  category: 'core',
  layoutStyle: 'standard',
  keyFeatures: [
    'Superficies blancas con bordes sutiles de 1px',
    'Sombras mínimas y máxima nitidez tipográfica',
    'Sidebar sobrio y compacto con acentos precisos',
    'Sensación de producto SaaS profesional'
  ],
  status: 'active',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#F8F9FA',
    surface: '#FFFFFF',
    surfaceSubtle: '#F1F3F5',
    surfaceHover: '#E9ECEF',
    surfaceActive: '#DEE2E6',

    border: '#E4E7EB',
    borderSubtle: '#EFF1F3',
    borderStrong: '#94A3B8',
    borderFocus: '#0F172A',

    text: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    textInverse: '#FFFFFF',

    primary: '#0F172A',
    primaryHover: '#1E293B',
    primaryActive: '#334155',
    primarySubtle: '#F1F5F9',
    primaryText: '#FFFFFF',

    secondary: '#FFFFFF',
    secondaryHover: '#F8FAFC',
    secondaryText: '#0F172A',
    secondaryBorder: '#CBD5E1',

    success: '#10B981',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    successText: '#065F46',

    warning: '#F59E0B',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    warningText: '#92400E',

    danger: '#EF4444',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText: '#991B1B',

    info: '#3B82F6',
    infoBg: '#EFF6FF',
    infoBorder: '#BFDBFE',
    infoText: '#1E40AF',

    radiusSm: '4px',
    radiusMd: '8px',
    radiusLg: '12px',
    radiusXl: '16px',
    radiusFull: '9999px',

    shadowXs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    shadowSm: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.03)',
    shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
    shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.06), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 1.0,
    btnHeight: '38px',
    btnHeightSm: '32px',
    inputHeight: '38px',
    touchTarget: '44px'
  }
};

// TEMA 02: UWI EMERALD (Identidad Comercial UWI)
export const PRESET_UWI_EMERALD: ThemeModel = {
  id: 'uwi-emerald',
  name: 'UWI Emerald',
  subtitle: 'Identidad UWI Comercial',
  description: 'Verde esmeralda UWI (#008060) para acciones primarias, estados activos y puntos de venta. Diseñado para alta tracción comercial y cercanía.',
  badge: 'Identidad UWI',
  category: 'core',
  layoutStyle: 'standard',
  keyFeatures: [
    'Acento verde esmeralda UWI (#008060) protagónico',
    'Cards con jerarquía visual amigable',
    'Estados y badges semánticos con contraste nítido',
    'Optimizado para Super Admin, Inventario y POS'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#F4F6F5',
    surface: '#FFFFFF',
    surfaceSubtle: '#EDF3F0',
    surfaceHover: '#E2ECE7',
    surfaceActive: '#D3E2DB',

    border: '#D9E3DF',
    borderSubtle: '#EBF1EE',
    borderStrong: '#6B8378',
    borderFocus: '#008060',

    text: '#17231E',
    textSecondary: '#33483E',
    textMuted: '#586E64',
    textSubtle: '#80968D',
    textInverse: '#FFFFFF',

    primary: '#008060',
    primaryHover: '#006E52',
    primaryActive: '#005842',
    primarySubtle: '#E6F4EE',
    primaryText: '#FFFFFF',

    secondary: '#FFFFFF',
    secondaryHover: '#F0F6F3',
    secondaryText: '#17231E',
    secondaryBorder: '#B5C8C0',

    success: '#008060',
    successBg: '#E6F4EE',
    successBorder: '#A5DFC8',
    successText: '#004D3A',

    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FCD34D',
    warningText: '#92400E',

    danger: '#DC2626',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FCA5A5',
    dangerText: '#991B1B',

    info: '#0284C7',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
    infoText: '#0369A1',

    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '18px',
    radiusFull: '9999px',

    shadowXs: '0 1px 2px rgba(0, 128, 96, 0.04)',
    shadowSm: '0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 128, 96, 0.03)',
    shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 128, 96, 0.04)',
    shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.07), 0 4px 6px -2px rgba(0, 128, 96, 0.04)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 1.0,
    btnHeight: '40px',
    btnHeightSm: '34px',
    inputHeight: '38px',
    touchTarget: '44px'
  }
};

// TEMA 03: UWI GRAPHITE (Premium & Tecnológico — Modo Grafito)
export const PRESET_UWI_GRAPHITE: ThemeModel = {
  id: 'uwi-graphite',
  name: 'UWI Graphite',
  subtitle: 'Premium & Tecnológico',
  description: 'Base oscura de grafito con jerarquía entre fondo (#111215), sidebar (#0E0F12), cards (#1A1C20) y modales (#23262D). Acento verde esmeralda brillante (#10B981).',
  badge: 'Modo Grafito',
  category: 'core',
  layoutStyle: 'standard',
  keyFeatures: [
    'Superficies grafito diferenciadas para lectura descansada',
    'Acento verde UWI (#10B981) de alto contraste',
    'Bordes oscuros sutiles y sombras de profundidad',
    'Excelente para entornos de poca luz y jornadas intensivas'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#111215',
    surface: '#1A1C20',
    surfaceSubtle: '#23262D',
    surfaceHover: '#2C3039',
    surfaceActive: '#353A45',

    border: '#2A2D36',
    borderSubtle: '#1E2026',
    borderStrong: '#4A5060',
    borderFocus: '#10B981',

    text: '#F3F4F6',
    textSecondary: '#D1D5DB',
    textMuted: '#9CA3AF',
    textSubtle: '#6B7280',
    textInverse: '#111215',

    primary: '#10B981',
    primaryHover: '#059669',
    primaryActive: '#047857',
    primarySubtle: '#064E3B',
    primaryText: '#FFFFFF',

    secondary: '#23262D',
    secondaryHover: '#2C3039',
    secondaryText: '#F3F4F6',
    secondaryBorder: '#374151',

    success: '#10B981',
    successBg: '#064E3B',
    successBorder: '#059669',
    successText: '#6EE7B7',

    warning: '#F59E0B',
    warningBg: '#78350F',
    warningBorder: '#D97706',
    warningText: '#FDE68A',

    danger: '#EF4444',
    dangerBg: '#7F1D1D',
    dangerBorder: '#DC2626',
    dangerText: '#FECACA',

    info: '#38BDF8',
    infoBg: '#0C4A6E',
    infoBorder: '#0284C7',
    infoText: '#BAE6FD',

    radiusSm: '4px',
    radiusMd: '8px',
    radiusLg: '12px',
    radiusXl: '16px',
    radiusFull: '9999px',

    shadowXs: '0 1px 2px rgba(0, 0, 0, 0.4)',
    shadowSm: '0 1px 3px rgba(0, 0, 0, 0.5), 0 1px 2px rgba(0, 0, 0, 0.3)',
    shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)',
    shadowLg: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -2px rgba(0, 0, 0, 0.4)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 1.0,
    btnHeight: '38px',
    btnHeightSm: '32px',
    inputHeight: '38px',
    touchTarget: '44px'
  }
};

// TEMA 04: UWI SOFT (Amigable & Accesible)
export const PRESET_UWI_SOFT: ThemeModel = {
  id: 'uwi-soft',
  name: 'UWI Soft',
  subtitle: 'Amigable & Accesible',
  description: 'Gama cálida y suave (#FAF8F5), esquinas redondeadas amplias (12px–16px), sombras difuminadas y acento teal calmante (#0D9488). Ideal para uso ameno.',
  badge: 'Gama Cálida',
  category: 'core',
  layoutStyle: 'standard',
  keyFeatures: [
    'Bordes redondeados amplios y suaves (12px - 16px)',
    'Fondo cálido tipo lino (#FAF8F5) y contraste amable',
    'Acento teal calmante (#0D9488)',
    'Excelente accesibilidad visual y menor fatiga'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#FAF8F5',
    surface: '#FFFFFF',
    surfaceSubtle: '#F4EFEA',
    surfaceHover: '#ECE5DE',
    surfaceActive: '#E2D8CF',

    border: '#E8E1D9',
    borderSubtle: '#F2ECE5',
    borderStrong: '#8C7E72',
    borderFocus: '#0D9488',

    text: '#2D2824',
    textSecondary: '#4A423B',
    textMuted: '#70655B',
    textSubtle: '#998D81',
    textInverse: '#FFFFFF',

    primary: '#0D9488',
    primaryHover: '#0F766E',
    primaryActive: '#115E59',
    primarySubtle: '#CCFBF1',
    primaryText: '#FFFFFF',

    secondary: '#FFFFFF',
    secondaryHover: '#F7F3EE',
    secondaryText: '#2D2824',
    secondaryBorder: '#D8CEC3',

    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#A7F3D0',
    successText: '#065F46',

    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    warningText: '#92400E',

    danger: '#E11D48',
    dangerBg: '#FFF1F2',
    dangerBorder: '#FECDD3',
    dangerText: '#9F1239',

    info: '#0284C7',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
    infoText: '#0369A1',

    radiusSm: '8px',
    radiusMd: '12px',
    radiusLg: '16px',
    radiusXl: '22px',
    radiusFull: '9999px',

    shadowXs: '0 1px 2px rgba(45, 40, 36, 0.04)',
    shadowSm: '0 2px 4px rgba(45, 40, 36, 0.05), 0 1px 2px rgba(45, 40, 36, 0.03)',
    shadowMd: '0 6px 12px -2px rgba(45, 40, 36, 0.06), 0 3px 6px -2px rgba(45, 40, 36, 0.04)',
    shadowLg: '0 12px 20px -4px rgba(45, 40, 36, 0.08), 0 4px 8px -2px rgba(45, 40, 36, 0.04)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 1.05,
    btnHeight: '42px',
    btnHeightSm: '34px',
    inputHeight: '40px',
    touchTarget: '44px'
  }
};

// TEMA 05: UWI COMMAND (Centro de Control & Operaciones)
export const PRESET_UWI_COMMAND: ThemeModel = {
  id: 'uwi-command',
  name: 'UWI Command',
  subtitle: 'Centro de Control & Datos',
  description: 'Densidad de datos optimizada (spacing 0.88x), tablas compactas de alta legibilidad, sidebar estructurado y acento índigo (#4F46E5). Inspirado en Stripe y Retool.',
  badge: 'Alta Densidad',
  category: 'core',
  layoutStyle: 'standard',
  keyFeatures: [
    'Densidad compacta para visualizar más métricas en pantalla',
    'Radios de 4px–6px y estructura geométrica precisa',
    'Acento índigo (#4F46E5) de alto enfoque operacional',
    'Ideal para supervisión de flotas de comercios y auditoría'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceSubtle: '#E2E8F0',
    surfaceHover: '#CBD5E1',
    surfaceActive: '#94A3B8',

    border: '#CBD5E1',
    borderSubtle: '#E2E8F0',
    borderStrong: '#64748B',
    borderFocus: '#4F46E5',

    text: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    textInverse: '#FFFFFF',

    primary: '#4F46E5',
    primaryHover: '#4338CA',
    primaryActive: '#3730A3',
    primarySubtle: '#EEF2FF',
    primaryText: '#FFFFFF',

    secondary: '#FFFFFF',
    secondaryHover: '#F8F9FA',
    secondaryText: '#1E293B',
    secondaryBorder: '#ADB5BD',

    success: '#059669',
    successBg: '#ECFDF5',
    successBorder: '#6EE7B7',
    successText: '#065F46',

    warning: '#D97706',
    warningBg: '#FFFBEB',
    warningBorder: '#FCD34D',
    warningText: '#92400E',

    danger: '#E11D48',
    dangerBg: '#FFF1F2',
    dangerBorder: '#FDA4AF',
    dangerText: '#9F1239',

    info: '#0284C7',
    infoBg: '#F0F9FF',
    infoBorder: '#7DD3FC',
    infoText: '#075985',

    radiusSm: '3px',
    radiusMd: '5px',
    radiusLg: '7px',
    radiusXl: '10px',
    radiusFull: '9999px',

    shadowXs: 'none',
    shadowSm: '0 1px 1px rgba(0, 0, 0, 0.05)',
    shadowMd: '0 2px 4px rgba(0, 0, 0, 0.05)',
    shadowLg: '0 4px 6px rgba(0, 0, 0, 0.06)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 0.88,
    btnHeight: '34px',
    btnHeightSm: '30px',
    inputHeight: '32px',
    touchTarget: '44px'
  }
};

// =============================================================
// CATEGORÍA 2: UWI EXPERIMENTAL (6 NUEVOS TEMAS RADICALES)
// =============================================================

// TEMA 06: UWI EDITORIAL (Inspirado en revistas de diseño, cultura y publicaciones premium)
export const PRESET_UWI_EDITORIAL: ThemeModel = {
  id: 'uwi-editorial',
  name: 'UWI Editorial',
  subtitle: 'Alta Revista & Tipografía Expresiva',
  description: 'Inspirado en publicaciones de alto diseño. Fuerte contraste tipográfico, títulos imponentes, amplio espacio negativo, divisores finos y métricas estilo titulares de prensa económica.',
  badge: 'Nuevo',
  category: 'experimental',
  layoutStyle: 'editorial',
  keyFeatures: [
    'Composición asimétrica y amplio espacio negativo',
    'Métricas como titulares con números gigantes y labels sutiles',
    'Divisores finos de 1px sin saturación de cajas flotantes',
    'Sidebar minimalista y elegante tipo sumario de publicación'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#FAFAF9',
    surface: '#FFFFFF',
    surfaceSubtle: '#F5F5F4',
    surfaceHover: '#E7E5E4',
    surfaceActive: '#D6D3D1',

    border: '#E7E5E4',
    borderSubtle: '#F5F5F4',
    borderStrong: '#1C1917',
    borderFocus: '#1C1917',

    text: '#0C0A09',
    textSecondary: '#292524',
    textMuted: '#57534E',
    textSubtle: '#78716C',
    textInverse: '#FAFAF9',

    primary: '#1C1917',
    primaryHover: '#292524',
    primaryActive: '#44403C',
    primarySubtle: '#F5F5F4',
    primaryText: '#FFFFFF',

    secondary: '#FFFFFF',
    secondaryHover: '#F5F5F4',
    secondaryText: '#1C1917',
    secondaryBorder: '#D6D3D1',

    success: '#008060',
    successBg: '#F0FDF4',
    successBorder: '#BBF7D0',
    successText: '#166534',

    warning: '#B45309',
    warningBg: '#FFFBEB',
    warningBorder: '#FDE68A',
    warningText: '#92400E',

    danger: '#B91C1C',
    dangerBg: '#FEF2F2',
    dangerBorder: '#FECACA',
    dangerText: '#991B1B',

    info: '#0369A1',
    infoBg: '#F0F9FF',
    infoBorder: '#BAE6FD',
    infoText: '#075985',

    radiusSm: '1px',
    radiusMd: '2px',
    radiusLg: '3px',
    radiusXl: '4px',
    radiusFull: '9999px',

    shadowXs: 'none',
    shadowSm: '0 1px 2px rgba(28, 25, 23, 0.03)',
    shadowMd: '0 4px 6px -1px rgba(28, 25, 23, 0.04)',
    shadowLg: '0 10px 15px -3px rgba(28, 25, 23, 0.05)',

    fontSans: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
    fontMono: 'ui-monospace, "Courier New", Courier, monospace',
    spacingFactor: 1.15,
    btnHeight: '42px',
    btnHeightSm: '34px',
    inputHeight: '40px',
    touchTarget: '44px'
  }
};

// TEMA 07: UWI BENTO (Apple-style Bento Grid modular & dinámico)
export const PRESET_UWI_BENTO: ThemeModel = {
  id: 'uwi-bento',
  name: 'UWI Bento',
  subtitle: 'Composición Modular Bento Grid',
  description: 'Composición visual dinámica en grilla Bento. Módulos de 1 y 2 columnas con alturas variables, métricas integradas dentro de tarjetas visuales y bordes redondeados pronunciados.',
  badge: 'Nuevo',
  category: 'experimental',
  layoutStyle: 'bento',
  keyFeatures: [
    'Cards modulares bento de 1x1, 2x1 y módulos verticales',
    'Métricas integradas en bloques con fondo de contraste',
    'Bordes curvos pronunciados (18px a 24px) estilo Apple UI',
    'Sidebar integrado fluidamente con la grilla de módulos'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#F1F5F9',
    surface: '#FFFFFF',
    surfaceSubtle: '#E2E8F0',
    surfaceHover: '#CBD5E1',
    surfaceActive: '#94A3B8',

    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    borderStrong: '#94A3B8',
    borderFocus: '#0284C7',

    text: '#0F172A',
    textSecondary: '#334155',
    textMuted: '#64748B',
    textSubtle: '#94A3B8',
    textInverse: '#FFFFFF',

    primary: '#0284C7',
    primaryHover: '#0369A1',
    primaryActive: '#075985',
    primarySubtle: '#E0F2FE',
    primaryText: '#FFFFFF',

    secondary: '#FFFFFF',
    secondaryHover: '#F8FAFC',
    secondaryText: '#0F172A',
    secondaryBorder: '#CBD5E1',

    success: '#10B981',
    successBg: '#D1FAE5',
    successBorder: '#6EE7B7',
    successText: '#065F46',

    warning: '#F59E0B',
    warningBg: '#FEF3C7',
    warningBorder: '#FCD34D',
    warningText: '#92400E',

    danger: '#EF4444',
    dangerBg: '#FEE2E2',
    dangerBorder: '#FCA5A5',
    dangerText: '#991B1B',

    info: '#0284C7',
    infoBg: '#E0F2FE',
    infoBorder: '#7DD3FC',
    infoText: '#075985',

    radiusSm: '10px',
    radiusMd: '18px',
    radiusLg: '24px',
    radiusXl: '32px',
    radiusFull: '9999px',

    shadowXs: '0 2px 4px rgba(15, 23, 42, 0.04)',
    shadowSm: '0 4px 12px rgba(15, 23, 42, 0.06)',
    shadowMd: '0 8px 24px rgba(15, 23, 42, 0.08)',
    shadowLg: '0 16px 36px rgba(15, 23, 42, 0.1)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 1.08,
    btnHeight: '44px',
    btnHeightSm: '36px',
    inputHeight: '42px',
    touchTarget: '44px'
  }
};

// TEMA 08: UWI NEO (Cyber Platform & Neón Control)
export const PRESET_UWI_NEO: ThemeModel = {
  id: 'uwi-neo',
  name: 'UWI Neo',
  subtitle: 'Cyber Platform & Neón Control',
  description: 'Futurista, tecnológico y experimental. Fondo negro cósmico (#0A0B0E), paneles translúcidos con micro-glow, acentos verde neón (#00F59B) e indicadores de telemetría viva.',
  badge: 'Nuevo',
  category: 'experimental',
  layoutStyle: 'neo',
  keyFeatures: [
    'Superficies oscuras con micro-glow e iluminación de borde',
    'Acentos verde neón (#00F59B) y cian luminosos',
    'Sidebar iconográfico compacto con highlights al hover',
    'Sensación de plataforma de control aeroespacial / telecom'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#0A0B0E',
    surface: '#12151C',
    surfaceSubtle: '#181D27',
    surfaceHover: '#222A3A',
    surfaceActive: '#2C3549',

    border: '#1F2737',
    borderSubtle: '#151A24',
    borderStrong: '#00F59B',
    borderFocus: '#00F59B',

    text: '#F8FAFC',
    textSecondary: '#CBD5E1',
    textMuted: '#94A3B8',
    textSubtle: '#64748B',
    textInverse: '#0A0B0E',

    primary: '#00F59B',
    primaryHover: '#00D686',
    primaryActive: '#00B872',
    primarySubtle: 'rgba(0, 245, 155, 0.12)',
    primaryText: '#0A0B0E',

    secondary: '#181D27',
    secondaryHover: '#222A3A',
    secondaryText: '#F8FAFC',
    secondaryBorder: '#2A3449',

    success: '#00F59B',
    successBg: 'rgba(0, 245, 155, 0.15)',
    successBorder: '#00F59B',
    successText: '#00F59B',

    warning: '#FACC15',
    warningBg: 'rgba(250, 204, 21, 0.15)',
    warningBorder: '#FACC15',
    warningText: '#FACC15',

    danger: '#FF3366',
    dangerBg: 'rgba(255, 51, 102, 0.15)',
    dangerBorder: '#FF3366',
    dangerText: '#FF3366',

    info: '#00E5FF',
    infoBg: 'rgba(0, 229, 255, 0.15)',
    infoBorder: '#00E5FF',
    infoText: '#00E5FF',

    radiusSm: '6px',
    radiusMd: '10px',
    radiusLg: '14px',
    radiusXl: '18px',
    radiusFull: '9999px',

    shadowXs: '0 0 10px rgba(0, 245, 155, 0.08)',
    shadowSm: '0 2px 14px rgba(0, 0, 0, 0.6), 0 0 12px rgba(0, 245, 155, 0.1)',
    shadowMd: '0 8px 24px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 245, 155, 0.15)',
    shadowLg: '0 16px 36px rgba(0, 0, 0, 0.8), 0 0 28px rgba(0, 245, 155, 0.2)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, "Fira Code", monospace',
    spacingFactor: 0.95,
    btnHeight: '40px',
    btnHeightSm: '34px',
    inputHeight: '38px',
    touchTarget: '44px'
  }
};

// TEMA 09: UWI SWISS (International Typographic Style)
export const PRESET_UWI_SWISS: ThemeModel = {
  id: 'uwi-swiss',
  name: 'UWI Swiss',
  subtitle: 'International Typographic Style',
  description: 'Diseño suizo radical y riguroso. Fuerte uso de la grilla ortogonal, tipografía protagónica sin ornamentos, líneas divisorias negras nítidas y estética purista de alto impacto.',
  badge: 'Nuevo',
  category: 'experimental',
  layoutStyle: 'swiss',
  keyFeatures: [
    'Grilla estricta y tipografía sobredimensionada de alto impacto',
    'Divisores lineales sólidos en lugar de cajas flotantes',
    'Paleta estricta en blanco, negro y acento suizo (#008060 / #E11D48)',
    'Estructura sin radios (0px) con rigor geométrico absoluto'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceSubtle: '#F4F4F4',
    surfaceHover: '#EAEAEA',
    surfaceActive: '#DCDCDC',

    border: '#000000',
    borderSubtle: '#CCCCCC',
    borderStrong: '#000000',
    borderFocus: '#000000',

    text: '#000000',
    textSecondary: '#171717',
    textMuted: '#525252',
    textSubtle: '#737373',
    textInverse: '#FFFFFF',

    primary: '#000000',
    primaryHover: '#262626',
    primaryActive: '#404040',
    primarySubtle: '#F5F5F5',
    primaryText: '#FFFFFF',

    secondary: '#FFFFFF',
    secondaryHover: '#F5F5F5',
    secondaryText: '#000000',
    secondaryBorder: '#000000',

    success: '#008060',
    successBg: '#FFFFFF',
    successBorder: '#008060',
    successText: '#008060',

    warning: '#D97706',
    warningBg: '#FFFFFF',
    warningBorder: '#D97706',
    warningText: '#D97706',

    danger: '#E11D48',
    dangerBg: '#FFFFFF',
    dangerBorder: '#E11D48',
    dangerText: '#E11D48',

    info: '#0284C7',
    infoBg: '#FFFFFF',
    infoBorder: '#0284C7',
    infoText: '#0284C7',

    radiusSm: '0px',
    radiusMd: '0px',
    radiusLg: '0px',
    radiusXl: '0px',
    radiusFull: '0px',

    shadowXs: 'none',
    shadowSm: 'none',
    shadowMd: 'none',
    shadowLg: 'none',

    fontSans: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    fontMono: 'ui-monospace, "Courier New", monospace',
    spacingFactor: 1.05,
    btnHeight: '40px',
    btnHeightSm: '32px',
    inputHeight: '38px',
    touchTarget: '44px'
  }
};

// TEMA 10: UWI TERMINAL (Observability & DevOps Console)
export const PRESET_UWI_TERMINAL: ThemeModel = {
  id: 'uwi-terminal',
  name: 'UWI Terminal',
  subtitle: 'Observability & DevOps Console',
  description: 'Centro de operaciones y telemetría en tiempo real. Tipografía monospace para datos, IDs y timestamps, tablas densas y flags de estado precisos [ ONLINE ] [ ERR: 0 ].',
  badge: 'Nuevo',
  category: 'experimental',
  layoutStyle: 'terminal',
  keyFeatures: [
    'Tipografía monoespaciada para todos los datos numéricos y técnicos',
    'Tablas hiperdensas de monitoreo con separadores de consola',
    'Fondo terminal oscuro (#0B0F19) y bordes estilo wireframe',
    'Indicadores semánticos compactos de ingeniería de sistemas'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#0B0F19',
    surface: '#111827',
    surfaceSubtle: '#1F2937',
    surfaceHover: '#374151',
    surfaceActive: '#4B5563',

    border: '#1F2937',
    borderSubtle: '#161E2E',
    borderStrong: '#38BDF8',
    borderFocus: '#38BDF8',

    text: '#F3F4F6',
    textSecondary: '#CBD5E1',
    textMuted: '#9CA3AF',
    textSubtle: '#6B7280',
    textInverse: '#0B0F19',

    primary: '#38BDF8',
    primaryHover: '#0EA5E9',
    primaryActive: '#0284C7',
    primarySubtle: 'rgba(56, 189, 248, 0.12)',
    primaryText: '#0B0F19',

    secondary: '#1F2937',
    secondaryHover: '#374151',
    secondaryText: '#F3F4F6',
    secondaryBorder: '#374151',

    success: '#22C55E',
    successBg: 'rgba(34, 197, 94, 0.12)',
    successBorder: '#22C55E',
    successText: '#4ADE80',

    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.12)',
    warningBorder: '#F59E0B',
    warningText: '#FBBF24',

    danger: '#EF4444',
    dangerBg: 'rgba(239, 68, 68, 0.12)',
    dangerBorder: '#EF4444',
    dangerText: '#F87171',

    info: '#38BDF8',
    infoBg: 'rgba(56, 189, 248, 0.12)',
    infoBorder: '#38BDF8',
    infoText: '#7DD3FC',

    radiusSm: '2px',
    radiusMd: '4px',
    radiusLg: '6px',
    radiusXl: '8px',
    radiusFull: '9999px',

    shadowXs: 'none',
    shadowSm: '0 1px 2px rgba(0, 0, 0, 0.5)',
    shadowMd: '0 4px 6px -1px rgba(0, 0, 0, 0.6)',
    shadowLg: '0 8px 16px -2px rgba(0, 0, 0, 0.7)',

    fontSans: 'ui-monospace, "Fira Code", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    fontMono: 'ui-monospace, "Fira Code", SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 0.82,
    btnHeight: '32px',
    btnHeightSm: '28px',
    inputHeight: '30px',
    touchTarget: '44px'
  }
};

// TEMA 11: UWI AURORA (Atmospheric & Ambient Gradient)
export const PRESET_UWI_AURORA: ThemeModel = {
  id: 'uwi-aurora',
  name: 'UWI Aurora',
  subtitle: 'Atmospheric & Ambient Gradient',
  description: 'Inmersivo, premium y expresivo. Iluminación ambiental suave con gradientes de verde esmeralda y violeta místico, cards multicapa con profundidad y métricas visuales luminosas.',
  badge: 'Nuevo',
  category: 'experimental',
  layoutStyle: 'aurora',
  keyFeatures: [
    'Fondos oscuros profundos con mallas de color ambiental suave',
    'Cards con bordes sutiles y profundidad multicapa',
    'Métricas destacadas con gradientes aurora esmeralda-violeta',
    'Experiencia visual envolvente de última generación'
  ],
  status: 'saved',
  version: 1,
  isPreset: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  tokens: {
    bg: '#0D1117',
    surface: '#161B22',
    surfaceSubtle: '#21262D',
    surfaceHover: '#30363D',
    surfaceActive: '#3B434D',

    border: '#30363D',
    borderSubtle: '#21262D',
    borderStrong: '#8B5CF6',
    borderFocus: '#10B981',

    text: '#F0F6FC',
    textSecondary: '#C9D1D9',
    textMuted: '#8B949E',
    textSubtle: '#6E7681',
    textInverse: '#0D1117',

    primary: '#10B981',
    primaryHover: '#059669',
    primaryActive: '#047857',
    primarySubtle: 'rgba(16, 185, 129, 0.15)',
    primaryText: '#FFFFFF',

    secondary: '#21262D',
    secondaryHover: '#30363D',
    secondaryText: '#F0F6FC',
    secondaryBorder: '#484F58',

    success: '#10B981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    successBorder: '#059669',
    successText: '#6EE7B7',

    warning: '#F59E0B',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    warningBorder: '#D97706',
    warningText: '#FDE68A',

    danger: '#F43F5E',
    dangerBg: 'rgba(244, 63, 94, 0.15)',
    dangerBorder: '#E11D48',
    dangerText: '#FDA4AF',

    info: '#8B5CF6',
    infoBg: 'rgba(139, 92, 246, 0.15)',
    infoBorder: '#7C3AED',
    infoText: '#C4B5FD',

    radiusSm: '8px',
    radiusMd: '14px',
    radiusLg: '20px',
    radiusXl: '28px',
    radiusFull: '9999px',

    shadowXs: '0 2px 4px rgba(0, 0, 0, 0.3)',
    shadowSm: '0 4px 12px rgba(0, 0, 0, 0.4), 0 0 16px rgba(16, 185, 129, 0.08)',
    shadowMd: '0 8px 24px rgba(0, 0, 0, 0.5), 0 0 24px rgba(139, 92, 246, 0.12)',
    shadowLg: '0 16px 36px rgba(0, 0, 0, 0.6), 0 0 36px rgba(16, 185, 129, 0.15)',

    fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    spacingFactor: 1.02,
    btnHeight: '42px',
    btnHeightSm: '34px',
    inputHeight: '40px',
    touchTarget: '44px'
  }
};

// =============================================================
// COLECCIÓN COMPLETA DE LOS 11 TEMAS VISUALES DE UWI
// =============================================================
export const INITIAL_PRESET_THEMES: ThemeModel[] = [
  // 5 CORE
  PRESET_UWI_CLEAN,
  PRESET_UWI_EMERALD,
  PRESET_UWI_GRAPHITE,
  PRESET_UWI_SOFT,
  PRESET_UWI_COMMAND,
  // 6 EXPERIMENTAL
  PRESET_UWI_EDITORIAL,
  PRESET_UWI_BENTO,
  PRESET_UWI_NEO,
  PRESET_UWI_SWISS,
  PRESET_UWI_TERMINAL,
  PRESET_UWI_AURORA
];

// Backwards-compatible aliases
export const PRESET_SHOPIFY = PRESET_UWI_CLEAN;
export const PRESET_SQUARE = PRESET_UWI_COMMAND;
export const PRESET_SHOP_COMPACT = PRESET_UWI_COMMAND;
export const PRESET_UWI_DARK = PRESET_UWI_GRAPHITE;
export const PRESET_MINIMAL_STONE = PRESET_UWI_SOFT;
