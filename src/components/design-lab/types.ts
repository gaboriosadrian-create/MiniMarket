export type DesignVariant = 
  // 5 Core
  | 'uwi-clean' 
  | 'uwi-emerald' 
  | 'uwi-graphite' 
  | 'uwi-soft' 
  | 'uwi-command'
  // 6 Experimental
  | 'uwi-editorial'
  | 'uwi-bento'
  | 'uwi-neo'
  | 'uwi-swiss'
  | 'uwi-terminal'
  | 'uwi-aurora'
  // Legacy aliases
  | 'shopify' 
  | 'square' 
  | 'shop';

export interface DesignVariantMeta {
  id: DesignVariant;
  name: string;
  subtitle: string;
  tagline: string;
  badge: string;
  category: 'core' | 'experimental';
  layoutStyle: string;
  keyFeatures: string[];
}

export const DESIGN_VARIANTS: Record<DesignVariant, DesignVariantMeta> = {
  // CORE 5
  'uwi-clean': {
    id: 'uwi-clean',
    name: 'UWI Clean',
    subtitle: 'Minimalista & Moderno',
    tagline: 'Superficies blancas, bordes sutiles de 1px y máxima nitidez tipográfica inspirada en Linear y Vercel.',
    badge: 'Predeterminado',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: [
      'Bordes sutiles y máxima legibilidad',
      'Sombras mínimas y fondo limpio',
      'Sidebar compacto y sobrio',
      'Excelente experiencia SaaS'
    ]
  },
  'uwi-emerald': {
    id: 'uwi-emerald',
    name: 'UWI Emerald',
    subtitle: 'Identidad UWI Comercial',
    tagline: 'Verde esmeralda UWI (#008060) para acciones primarias, estados activos y puntos de venta.',
    badge: 'Identidad UWI',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: [
      'Acento verde UWI estratégico',
      'Cards expresivas con jerarquía armónica',
      'Badges y estados nítidos',
      'Ideal para Super Admin y POS'
    ]
  },
  'uwi-graphite': {
    id: 'uwi-graphite',
    name: 'UWI Graphite',
    subtitle: 'Premium & Tecnológico',
    tagline: 'Base oscura grafito con jerarquía entre fondo, sidebar, cards y modales. Acento verde esmeralda brillante.',
    badge: 'Modo Grafito',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: [
      'Superficies grafito diferenciadas (#111215 / #1A1C20)',
      'Verde UWI (#10B981) de alto contraste',
      'Bordes oscuros sutiles',
      'Excelente lectura nocturna'
    ]
  },
  'uwi-soft': {
    id: 'uwi-soft',
    name: 'UWI Soft',
    subtitle: 'Amigable & Accesible',
    tagline: 'Gama cálida y suave (#FAF8F5), esquinas redondeadas amplias (12px–16px) y acento teal calmante.',
    badge: 'Gama Cálida',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: [
      'Bordes redondeados amplios (12px-16px)',
      'Fondo cálido tipo lino y contraste amable',
      'Acento teal calmante (#0D9488)',
      'Menor fatiga visual'
    ]
  },
  'uwi-command': {
    id: 'uwi-command',
    name: 'UWI Command',
    subtitle: 'Centro de Control & Operaciones',
    tagline: 'Densidad de datos optimizada (0.88x), tablas compactas, sidebar estructurado y acento índigo (#4F46E5).',
    badge: 'Alta Densidad',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: [
      'Densidad compacta para más datos por pantalla',
      'Radios precisos (4px-6px)',
      'Acento índigo (#4F46E5) de alto foco',
      'Inspirado en Stripe y Retool'
    ]
  },

  // EXPERIMENTAL 6
  'uwi-editorial': {
    id: 'uwi-editorial',
    name: 'UWI Editorial',
    subtitle: 'Alta Revista & Tipografía Expresiva',
    tagline: 'Inspirado en revistas de diseño y productos culturales. Títulos imponentes, divisores finos y métricas como titulares periodísticos.',
    badge: 'Nuevo',
    category: 'experimental',
    layoutStyle: 'editorial',
    keyFeatures: [
      'Composición asimétrica y amplio espacio negativo',
      'Métricas gigantes con labels pequeños',
      'Divisores finos de 1px sin cajas saturadas',
      'Sidebar tipo sumario editorial de lujo'
    ]
  },
  'uwi-bento': {
    id: 'uwi-bento',
    name: 'UWI Bento',
    subtitle: 'Composición Modular Bento Grid',
    tagline: 'Sistema visual bento grid inspirado en Apple UI con módulos dinámicos de 1 y 2 columnas y bordes curvos de 18-24px.',
    badge: 'Nuevo',
    category: 'experimental',
    layoutStyle: 'bento',
    keyFeatures: [
      'Cards modulares dinámicas de 1x1, 2x1 y verticales',
      'Métricas integradas en bloques con fondo de contraste',
      'Bordes curvos pronunciados (18px - 24px)',
      'Composición adaptable y modular'
    ]
  },
  'uwi-neo': {
    id: 'uwi-neo',
    name: 'UWI Neo',
    subtitle: 'Cyber Platform & Neón Control',
    tagline: 'Futurista y tecnológico. Fondo oscuro profundo (#0A0B0E), paneles translúcidos con micro-glow y acentos verde neón.',
    badge: 'Nuevo',
    category: 'experimental',
    layoutStyle: 'neo',
    keyFeatures: [
      'Superficies oscuras con micro-glow translúcido',
      'Acentos verde neón (#00F59B) luminosos',
      'Sidebar iconográfico compacto con hover expansible',
      'Telemetría viva y sensación de plataforma espacial'
    ]
  },
  'uwi-swiss': {
    id: 'uwi-swiss',
    name: 'UWI Swiss',
    subtitle: 'International Typographic Style',
    tagline: 'Diseño suizo radical. Grilla estricta, tipografía sobredimensionada, líneas de corte negras y cero decoración.',
    badge: 'Nuevo',
    category: 'experimental',
    layoutStyle: 'swiss',
    keyFeatures: [
      'Grilla rigurosa y tipografía de máxima jerarquía',
      'Líneas divisorias negras sólidas sin tarjetas flotantes',
      'Estética blanco/negro con acento suizo (#008060 / #E11D48)',
      'Estructura sin redondeos (0px)'
    ]
  },
  'uwi-terminal': {
    id: 'uwi-terminal',
    name: 'UWI Terminal',
    subtitle: 'Observability & DevOps Console',
    tagline: 'Consola de operaciones de alta densidad. Tipografía monospace para datos técnicos, timestamps y flags [ ONLINE ].',
    badge: 'Nuevo',
    category: 'experimental',
    layoutStyle: 'terminal',
    keyFeatures: [
      'Tipografía monoespaciada para todos los datos numéricos',
      'Tablas hiperdensas tipo monitor de sistema operativo',
      'Fondo terminal oscuro (#0B0F19) con líneas de consola',
      'Indicadores de estado técnicos precisos'
    ]
  },
  'uwi-aurora': {
    id: 'uwi-aurora',
    name: 'UWI Aurora',
    subtitle: 'Atmospheric & Ambient Gradient',
    tagline: 'Experiencia inmersiva con gradientes ambientales, iluminación atmosférica esmeralda-violeta y cards multicapa.',
    badge: 'Nuevo',
    category: 'experimental',
    layoutStyle: 'aurora',
    keyFeatures: [
      'Fondo oscuro con mallas de iluminación suave',
      'Cards con profundidad multicapa y sombras difusas',
      'Métricas destacadas con gradiente aurora',
      'Sensación SaaS premium de 2026'
    ]
  },

  // Aliases
  'shopify': {
    id: 'uwi-clean',
    name: 'UWI Clean',
    subtitle: 'Minimalista & Moderno',
    tagline: 'Superficies blancas, bordes sutiles de 1px.',
    badge: 'Predeterminado',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: ['Bordes sutiles y máxima legibilidad']
  },
  'square': {
    id: 'uwi-command',
    name: 'UWI Command',
    subtitle: 'Centro de Control & Operaciones',
    tagline: 'Densidad de datos optimizada.',
    badge: 'Alta Densidad',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: ['Densidad compacta']
  },
  'shop': {
    id: 'uwi-command',
    name: 'UWI Command',
    subtitle: 'Centro de Control & Operaciones',
    tagline: 'Densidad de datos optimizada.',
    badge: 'Alta Densidad',
    category: 'core',
    layoutStyle: 'standard',
    keyFeatures: ['Densidad compacta']
  }
};
