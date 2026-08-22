import React from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Truck, 
  PackageCheck, 
  AlertCircle, 
  Flame,
  ShieldAlert
} from 'lucide-react';

export const DesignLabStates: React.FC = () => {
  const statesList = [
    {
      id: 'confirmed',
      label: 'Confirmado',
      sublabel: 'Aceptado por proveedor',
      icon: CheckCircle2,
      bg: 'var(--dl-success-bg)',
      border: 'var(--dl-success-border)',
      text: 'var(--dl-success-text)'
    },
    {
      id: 'pending',
      label: 'Pendiente',
      sublabel: 'Esperando respuesta',
      icon: Clock,
      bg: 'var(--dl-warning-bg)',
      border: 'var(--dl-warning-border)',
      text: 'var(--dl-warning-text)'
    },
    {
      id: 'missing',
      label: 'Faltante',
      sublabel: 'Recibido parcial',
      icon: AlertTriangle,
      bg: 'var(--dl-warning-bg)',
      border: 'var(--dl-warning-border)',
      text: 'var(--dl-warning-text)'
    },
    {
      id: 'cancelled',
      label: 'Cancelado',
      sublabel: 'Anulado por usuario',
      icon: XCircle,
      bg: 'var(--dl-danger-bg)',
      border: 'var(--dl-danger-border)',
      text: 'var(--dl-danger-text)'
    },
    {
      id: 'receiving-pending',
      label: 'Recepción pendiente',
      sublabel: 'Productos en tránsito',
      icon: Truck,
      bg: 'var(--dl-info-bg)',
      border: 'var(--dl-info-border)',
      text: 'var(--dl-info-text)'
    },
    {
      id: 'stock-normal',
      label: 'Stock normal',
      sublabel: 'Nivel óptimo en góndola',
      icon: PackageCheck,
      bg: 'var(--dl-success-bg)',
      border: 'var(--dl-success-border)',
      text: 'var(--dl-success-text)'
    },
    {
      id: 'stock-low',
      label: 'Stock bajo',
      sublabel: 'Cerca de punto de reposición',
      icon: AlertCircle,
      bg: 'var(--dl-warning-bg)',
      border: 'var(--dl-warning-border)',
      text: 'var(--dl-warning-text)'
    },
    {
      id: 'stock-critical',
      label: 'Stock crítico',
      sublabel: 'Riesgo inminente de quiebre',
      icon: Flame,
      bg: 'var(--dl-danger-bg)',
      border: 'var(--dl-danger-border)',
      text: 'var(--dl-danger-text)'
    },
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
            8. Sistema de Estados y Accesibilidad
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            No depende solo del color: combina icono, texto semántico, contraste WCAG AA y contenedor nítido
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          8 Status Tokens
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {statesList.map((st) => {
          const Icon = st.icon;
          return (
            <div
              key={st.id}
              className="p-3.5 border flex items-center gap-3 transition-all"
              style={{
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)',
                borderRadius: 'var(--dl-radius-md)'
              }}
            >
              <div 
                className="w-10 h-10 flex items-center justify-center shrink-0 border"
                style={{
                  backgroundColor: st.bg,
                  borderColor: st.border,
                  color: st.text,
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <Icon className="w-5 h-5" />
              </div>

              <div className="min-w-0 flex-1">
                <span 
                  className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-wider px-2 py-0.5 border"
                  style={{
                    backgroundColor: st.bg,
                    borderColor: st.border,
                    color: st.text,
                    borderRadius: 'var(--dl-radius-full)'
                  }}
                >
                  <Icon className="w-3 h-3" />
                  <span>{st.label}</span>
                </span>
                <p className="text-[11px] font-medium mt-1 truncate" style={{ color: 'var(--dl-text-muted)' }}>
                  {st.sublabel}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
