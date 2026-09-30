import { ThemeModel } from '../types/theme';

export type ThemeVariantType = 
  | 'clean'
  | 'emerald'
  | 'graphite'
  | 'soft'
  | 'command'
  | 'editorial'
  | 'bento'
  | 'neo'
  | 'swiss'
  | 'terminal'
  | 'aurora';

/**
 * Resolves a theme ID or layoutStyle into one of the 11 concrete visual design directions.
 */
export function getThemeVariant(themeId?: string, layoutStyle?: string): ThemeVariantType {
  const id = (themeId || '').toLowerCase();
  const layout = (layoutStyle || '').toLowerCase();

  // 1. Explicit ID checks
  if (id.includes('editorial')) return 'editorial';
  if (id.includes('bento')) return 'bento';
  if (id.includes('neo')) return 'neo';
  if (id.includes('swiss')) return 'swiss';
  if (id.includes('terminal')) return 'terminal';
  if (id.includes('aurora')) return 'aurora';
  if (id.includes('command')) return 'command';
  if (id.includes('soft')) return 'soft';
  if (id.includes('graphite')) return 'graphite';
  if (id.includes('emerald') || id.includes('shopify')) return 'emerald';
  if (id.includes('clean') || id.includes('square')) return 'clean';

  // 2. Explicit layoutStyle checks
  if (layout === 'editorial') return 'editorial';
  if (layout === 'bento') return 'bento';
  if (layout === 'neo') return 'neo';
  if (layout === 'swiss') return 'swiss';
  if (layout === 'terminal') return 'terminal';
  if (layout === 'aurora') return 'aurora';
  if (layout === 'command') return 'command';

  // Default fallback
  return 'clean';
}

/**
 * Helper to get theme metadata descriptor
 */
export function getThemeDescriptor(variant: ThemeVariantType) {
  switch (variant) {
    case 'editorial':
      return {
        name: 'UWI Editorial',
        vibe: 'Alta Revista & Tipografía Expresiva',
        fontFamily: 'serif',
        radiusClass: 'rounded-none sm:rounded-xs',
        density: 'relaxed',
        structure: 'asymmetric-whitespace'
      };
    case 'bento':
      return {
        name: 'UWI Bento',
        vibe: 'Composición Modular Apple Bento',
        fontFamily: 'sans',
        radiusClass: 'rounded-3xl',
        density: 'balanced',
        structure: 'modular-tiles'
      };
    case 'swiss':
      return {
        name: 'UWI Swiss',
        vibe: 'International Typographic Style',
        fontFamily: 'sans',
        radiusClass: 'rounded-none',
        density: 'rigid-grid',
        structure: 'orthogonal-lines'
      };
    case 'terminal':
      return {
        name: 'UWI Terminal',
        vibe: 'DevOps & Telemetry Console',
        fontFamily: 'mono',
        radiusClass: 'rounded-xs',
        density: 'hyper-dense',
        structure: 'monospace-wireframe'
      };
    case 'aurora':
      return {
        name: 'UWI Aurora',
        vibe: 'Atmospheric Ambient Glow',
        fontFamily: 'sans',
        radiusClass: 'rounded-2xl',
        density: 'spacious',
        structure: 'glassmorphism-depth'
      };
    case 'neo':
      return {
        name: 'UWI Neo',
        vibe: 'Cyber Platform & Neón Control',
        fontFamily: 'sans',
        radiusClass: 'rounded-xl',
        density: 'high-tech',
        structure: 'floating-hud'
      };
    case 'command':
      return {
        name: 'UWI Command',
        vibe: 'Panel Operativo de Alta Densidad',
        fontFamily: 'sans',
        radiusClass: 'rounded-md',
        density: 'compact',
        structure: 'split-cockpit'
      };
    case 'soft':
      return {
        name: 'UWI Soft',
        vibe: 'Cálido & Accesible',
        fontFamily: 'sans',
        radiusClass: 'rounded-2xl',
        density: 'friendly',
        structure: 'pill-containers'
      };
    case 'graphite':
      return {
        name: 'UWI Graphite',
        vibe: 'Premium & Modo Oscuro',
        fontFamily: 'sans',
        radiusClass: 'rounded-lg',
        density: 'balanced',
        structure: 'dark-slate'
      };
    case 'emerald':
      return {
        name: 'UWI Emerald',
        vibe: 'Identidad UWI Comercial',
        fontFamily: 'sans',
        radiusClass: 'rounded-xl',
        density: 'commercial',
        structure: 'retail-flow'
      };
    case 'clean':
    default:
      return {
        name: 'UWI Clean',
        vibe: 'Minimalista & Moderno',
        fontFamily: 'sans',
        radiusClass: 'rounded-lg',
        density: 'standard',
        structure: 'clean-saas'
      };
  }
}
