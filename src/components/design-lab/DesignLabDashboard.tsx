import React from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ClipboardList, 
  Truck,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Activity
} from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, getThemeDescriptor } from '../../lib/themeVariant';
import { MetricCardVariant, MetricCardItem } from '../common/MetricCardVariant';

export const DesignLabDashboard: React.FC = () => {
  const { activeTheme } = useTheme();
  const variant = getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);
  const descriptor = getThemeDescriptor(variant);

  const metrics: MetricCardItem[] = [
    {
      id: 'ventas',
      title: 'Ventas de hoy',
      value: '$125.400',
      subtitle: '+14% vs ayer',
      trend: { value: '+14%', isPositive: true },
      icon: TrendingUp,
      accent: 'primary',
      kicker: 'INGRESOS TOTALES',
      badge: '01_KPI'
    },
    {
      id: 'productos',
      title: 'Productos en Catálogo',
      value: '348',
      subtitle: 'En catálogo activo',
      trend: { value: 'Activos', isPositive: true },
      icon: Package,
      accent: 'neutral',
      kicker: 'INVENTARIO GENERAL',
      badge: '02_KPI'
    },
    {
      id: 'stock-bajo',
      title: 'Stock Bajo',
      value: '12',
      subtitle: 'Requiere reposición',
      trend: { value: 'Alerta', isPositive: false },
      icon: AlertTriangle,
      accent: 'warning',
      kicker: 'CRÍTICO',
      badge: '03_KPI'
    },
    {
      id: 'solicitudes',
      title: 'Solicitudes Pendientes',
      value: '3',
      subtitle: 'Enviadas a proveedor',
      trend: { value: 'En curso', isPositive: true },
      icon: ClipboardList,
      accent: 'info',
      kicker: 'ABASTECIMIENTO',
      badge: '04_KPI'
    },
    {
      id: 'recepciones',
      title: 'Recepciones por Ingresar',
      value: '2',
      subtitle: 'Por ingresar a stock',
      trend: { value: 'Pendiente', isPositive: false },
      icon: Truck,
      accent: 'danger',
      kicker: 'LOGÍSTICA',
      badge: '05_KPI'
    }
  ];

  return (
    <div 
      className="p-4 sm:p-6 border transition-all"
      style={{
        backgroundColor: 'var(--dl-surface)',
        borderColor: 'var(--dl-border)',
        borderRadius: 'var(--dl-radius-lg)',
        boxShadow: 'var(--dl-shadow-sm)'
      }}
    >
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-5 border-b gap-2" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
              2. Dashboard / Composición de Métricas
            </h3>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              {descriptor.name}
            </span>
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--dl-text-muted)' }}>
            Estructura visual nativa: <strong>{descriptor.vibe}</strong> ({descriptor.structure})
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] font-mono font-bold px-2 py-1 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
            {metrics.length} Indicadores Clave
          </span>
        </div>
      </div>

      {/* Dynamic structural composition */}
      {variant === 'editorial' && (
        <div className="space-y-6">
          <div className="border-b-2 border-stone-900 pb-3 flex items-baseline justify-between">
            <h2 className="text-3xl sm:text-4xl font-serif font-black text-stone-900 tracking-tight">
              Reporte General de Desempeño
            </h2>
            <span className="text-xs font-serif italic text-stone-500 hidden sm:inline">Edición Ejecutiva</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2">
              <MetricCardVariant metric={metrics[0]} />
            </div>
            <div>
              <MetricCardVariant metric={metrics[1]} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <MetricCardVariant metric={metrics[2]} />
            <MetricCardVariant metric={metrics[3]} />
            <MetricCardVariant metric={metrics[4]} />
          </div>
        </div>
      )}

      {variant === 'bento' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <MetricCardVariant metric={metrics[0]} className="h-full" />
          </div>
          <div>
            <MetricCardVariant metric={metrics[1]} className="h-full" />
          </div>
          <div>
            <MetricCardVariant metric={metrics[2]} />
          </div>
          <div>
            <MetricCardVariant metric={metrics[3]} />
          </div>
          <div>
            <MetricCardVariant metric={metrics[4]} />
          </div>
        </div>
      )}

      {variant === 'swiss' && (
        <div className="space-y-4">
          <div className="border-b-2 border-black pb-2 flex justify-between items-center font-sans">
            <span className="text-xs font-black uppercase tracking-widest text-black">INDICADORES_SISTEMA</span>
            <span className="text-[10px] font-mono bg-black text-white px-2 py-0.5 font-bold">GRID_STRICT</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {metrics.map((m) => (
              <MetricCardVariant key={m.id} metric={m} />
            ))}
          </div>
        </div>
      )}

      {variant === 'terminal' && (
        <div className="space-y-3">
          <div className="bg-[#111827] border border-[#1F2937] p-2 text-sky-400 font-mono text-xs flex justify-between items-center">
            <span>&gt; TELEMETRY_FEED --POLL_FREQ=1s</span>
            <span className="text-emerald-400 font-bold">[SYNC_ACTIVE]</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {metrics.map((m) => (
              <MetricCardVariant key={m.id} metric={m} />
            ))}
          </div>
        </div>
      )}

      {variant !== 'editorial' && variant !== 'bento' && variant !== 'swiss' && variant !== 'terminal' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {metrics.map((m) => (
            <MetricCardVariant key={m.id} metric={m} />
          ))}
        </div>
      )}
    </div>
  );
};
