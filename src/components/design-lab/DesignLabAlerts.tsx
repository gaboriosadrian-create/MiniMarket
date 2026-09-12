import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export const DesignLabAlerts: React.FC = () => {
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
            13. Mensajes de Alerta y Notificaciones
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Alertas no invasivas, de alta legibilidad con contraste equilibrado
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Alert Banners
        </span>
      </div>

      <div className="space-y-3 max-w-2xl mx-auto">
        {/* Success Alert */}
        <div 
          className="p-3.5 border flex items-start justify-between gap-3 shadow-xs"
          style={{
            backgroundColor: 'var(--dl-success-bg)',
            borderColor: 'var(--dl-success-border)',
            color: 'var(--dl-success-text)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-black">Operación realizada correctamente</h5>
              <p className="text-[11px] opacity-90 font-medium">
                Se guardó la recepción de productos y el stock fue actualizado en tiempo real.
              </p>
            </div>
          </div>
          <button type="button" className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Warning Alert */}
        <div 
          className="p-3.5 border flex items-start justify-between gap-3 shadow-xs"
          style={{
            backgroundColor: 'var(--dl-warning-bg)',
            borderColor: 'var(--dl-warning-border)',
            color: 'var(--dl-warning-text)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-black">Hay productos faltantes en la entrega</h5>
              <p className="text-[11px] opacity-90 font-medium">
                Se recibieron 2 de 3 unidades solicitadas al proveedor Panadería López.
              </p>
            </div>
          </div>
          <button type="button" className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Danger Alert */}
        <div 
          className="p-3.5 border flex items-start justify-between gap-3 shadow-xs"
          style={{
            backgroundColor: 'var(--dl-danger-bg)',
            borderColor: 'var(--dl-danger-border)',
            color: 'var(--dl-danger-text)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="flex items-start gap-2.5">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <h5 className="text-xs font-black">No se pudo guardar la solicitud</h5>
              <p className="text-[11px] opacity-90 font-medium">
                Error de conexión o datos incompletos. Intente nuevamente en unos instantes.
              </p>
            </div>
          </div>
          <button type="button" className="opacity-60 hover:opacity-100 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
