import React from 'react';
import { 
  TrendingUp, 
  Package, 
  AlertTriangle, 
  ClipboardList, 
  Truck,
  ArrowUpRight
} from 'lucide-react';

export const DesignLabDashboard: React.FC = () => {
  const metrics = [
    {
      id: 'ventas',
      title: 'Ventas de hoy',
      value: '$125.400',
      subtitle: '+14% vs ayer',
      icon: TrendingUp,
      accent: 'primary'
    },
    {
      id: 'productos',
      title: 'Productos',
      value: '348',
      subtitle: 'En catálogo activo',
      icon: Package,
      accent: 'neutral'
    },
    {
      id: 'stock-bajo',
      title: 'Stock bajo',
      value: '12',
      subtitle: 'Requiere reposición',
      icon: AlertTriangle,
      accent: 'warning'
    },
    {
      id: 'solicitudes',
      title: 'Solicitudes pendientes',
      value: '3',
      subtitle: 'Enviadas a proveedor',
      icon: ClipboardList,
      accent: 'info'
    },
    {
      id: 'recepciones',
      title: 'Recepciones pendientes',
      value: '2',
      subtitle: 'Por ingresar a stock',
      icon: Truck,
      accent: 'danger'
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
      <div className="flex items-center justify-between pb-3 mb-4 border-b" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <h3 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
            2. Dashboard / Tarjetas Métricas
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Jerarquía visual de indicadores clave de rendimiento del negocio
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          5 KPI Cards
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {metrics.map((m) => {
          const Icon = m.icon;
          
          let iconBg = 'var(--dl-surface-subtle)';
          let iconColor = 'var(--dl-text)';
          let borderAccent = 'var(--dl-border)';

          if (m.accent === 'primary') {
            iconBg = 'var(--dl-primary-subtle)';
            iconColor = 'var(--dl-primary)';
          } else if (m.accent === 'warning') {
            iconBg = 'var(--dl-warning-bg)';
            iconColor = 'var(--dl-warning-text)';
          } else if (m.accent === 'danger') {
            iconBg = 'var(--dl-danger-bg)';
            iconColor = 'var(--dl-danger-text)';
          } else if (m.accent === 'info') {
            iconBg = 'var(--dl-info-bg)';
            iconColor = 'var(--dl-info-text)';
          }

          return (
            <div
              key={m.id}
              className="p-4 border transition-all flex flex-col justify-between"
              style={{
                backgroundColor: 'var(--dl-surface)',
                borderColor: borderAccent,
                borderRadius: 'var(--dl-radius-md)',
                boxShadow: 'var(--dl-shadow-xs)'
              }}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold leading-tight" style={{ color: 'var(--dl-text-muted)' }}>
                  {m.title}
                </span>
                <div 
                  className="w-8 h-8 flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: iconBg,
                    color: iconColor,
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <Icon className="w-4 h-4" />
                </div>
              </div>

              <div className="mt-3">
                <div className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--dl-text)' }}>
                  {m.value}
                </div>
                <div className="flex items-center gap-1 mt-1 text-[11px] font-bold" style={{ color: 'var(--dl-text-muted)' }}>
                  <span>{m.subtitle}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
