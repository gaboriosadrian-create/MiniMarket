import { SectionGuideConfig } from './types';

/**
 * Central registry for Section Guides across UWI modules.
 * Can be easily scaled to add new guides for POS, Products, Cash Control, Purchases, etc.
 */
export const SECTION_GUIDES: Record<string, SectionGuideConfig> = {
  dailyControl: {
    id: 'dailyControl',
    sectionName: 'Control Diario',
    intro: {
      title: 'Control Diario',
      badge: 'Resumen Financiero',
      description: 'Acá podés revisar de forma consolidada cómo fue el movimiento financiero y económico de tu negocio durante el período elegido.'
    },
    steps: [
      {
        target: 'daily-financial-result',
        title: 'Resultado Financiero',
        description: 'Indica si tuviste superávit o déficit de fondos, calculando las ventas cobradas menos los egresos efectivamente pagados.',
        position: 'bottom'
      },
      {
        target: 'daily-sales-income',
        title: 'Ingresos por Ventas',
        description: 'Muestra el total de ventas cobradas con el desglose entre efectivo, Mercado Pago y ticket promedio.',
        position: 'top'
      },
      {
        target: 'daily-expenses',
        title: 'Egresos Pagados',
        description: 'Agrupa las salidas reales de dinero del período por compras al contado, gastos operativos y pagos a proveedores.',
        position: 'top'
      },
      {
        target: 'daily-margin',
        title: 'Margen Bruto y Rentabilidad',
        description: 'Calcula la ganancia económica y porcentaje de margen contrastando el precio de venta contra el costo de reposición histórico (CMV).',
        position: 'top',
        roles: ['ADMIN', 'SUPER_ADMIN']
      },
      {
        target: 'daily-liabilities',
        title: 'Compras a Cancelar',
        description: 'Registra los compromisos y compras a crédito que no restan dinero de la caja física hasta su cancelación efectiva.',
        position: 'top',
        roles: ['ADMIN', 'SUPER_ADMIN']
      }
    ],
    conclusion: {
      title: '¡Listo!',
      description: 'Ya conocés los indicadores clave del Control Diario para monitorear la salud de tu negocio.'
    }
  }
};

/**
 * Retrieve a section guide by ID, optionally filtered by user role.
 */
export const getSectionGuide = (guideId: string, userRole?: string): SectionGuideConfig | null => {
  const guide = SECTION_GUIDES[guideId];
  if (!guide) return null;

  if (!userRole) return guide;

  // Filter steps according to role permissions
  const filteredSteps = guide.steps.filter((step) => {
    if (!step.roles || step.roles.length === 0) return true;
    return step.roles.includes(userRole as any);
  });

  return {
    ...guide,
    steps: filteredSteps
  };
};
