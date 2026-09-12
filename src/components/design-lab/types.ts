export type DesignVariant = 'shopify' | 'square' | 'shop';

export interface DesignVariantMeta {
  id: DesignVariant;
  name: string;
  subtitle: string;
  tagline: string;
  badge: string;
  keyFeatures: string[];
}

export const DESIGN_VARIANTS: Record<DesignVariant, DesignVariantMeta> = {
  shopify: {
    id: 'shopify',
    name: 'Shopify Light',
    subtitle: 'Commerce moderno',
    tagline: 'Superficies claras, bordes suaves y estética SaaS de comercio moderno con acentos controlados.',
    badge: 'SaaS Commerce',
    keyFeatures: [
      'Radios suaves (10–12px) y sombras sutiles',
      'Acento comercial limpio y balanceado',
      'Jerarquía clara con tipografía de alta legibilidad',
      'Cards moderadas y espaciado armónico'
    ]
  },
  square: {
    id: 'square',
    name: 'Square',
    subtitle: 'POS profesional',
    tagline: 'Mucho espacio visual, componentes planos, botones táctiles y alta velocidad de operación de punto de venta.',
    badge: 'POS & Terminal',
    keyFeatures: [
      'Bordes nítidos y radios limpios (6–8px)',
      'Contraste absoluto y botones táctiles grandes (48px+)',
      'Máxima legibilidad de precios y cantidades',
      'Componentes planos sin adornos superfluos'
    ]
  },
  shop: {
    id: 'shop',
    name: 'Shop Compact',
    subtitle: 'Backoffice compacto',
    tagline: 'Mayor densidad de información, spacing reducido pero cómodo y excelente aprovechamiento del espacio.',
    badge: 'Backoffice Denso',
    keyFeatures: [
      'Densidad de datos optimizada para gestión rápida',
      'Spacing compacto (8–12px) y tablas eficientes',
      'Radios sutiles (4–6px) y controles precisos',
      'Menor volumen de tarjetas y visualización concentrada'
    ]
  }
};
