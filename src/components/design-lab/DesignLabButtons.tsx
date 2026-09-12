import React from 'react';
import { Plus, Check, Trash2, X, Eye, ArrowRight, Sparkles, RefreshCw } from 'lucide-react';

export const DesignLabButtons: React.FC = () => {
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
            10. Jerarquía de Botones y Acciones
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Primary, Secondary, Success, Danger, Ghost e Icon buttons con dimensiones táctiles operativas
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Button Hierarchy
        </span>
      </div>

      <div className="space-y-4">
        {/* Row 1: Hierarchies */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Primary */}
          <button
            type="button"
            className="px-4 text-xs font-black uppercase tracking-wide flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
            style={{
              height: 'var(--dl-btn-height)',
              backgroundColor: 'var(--dl-primary)',
              color: 'var(--dl-primary-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nueva Recepción (Primary)</span>
          </button>

          {/* Secondary */}
          <button
            type="button"
            className="px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all"
            style={{
              height: 'var(--dl-btn-height)',
              backgroundColor: 'var(--dl-secondary)',
              borderColor: 'var(--dl-border)',
              color: 'var(--dl-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <X className="w-3.5 h-3.5" />
            <span>Cancelar (Secondary)</span>
          </button>

          {/* Success */}
          <button
            type="button"
            className="px-4 text-xs font-black uppercase tracking-wide flex items-center gap-1.5 cursor-pointer transition-all border"
            style={{
              height: 'var(--dl-btn-height)',
              backgroundColor: 'var(--dl-success-bg)',
              borderColor: 'var(--dl-success-border)',
              color: 'var(--dl-success-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Check className="w-3.5 h-3.5" />
            <span>Confirmar (Success)</span>
          </button>

          {/* Danger */}
          <button
            type="button"
            className="px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all border"
            style={{
              height: 'var(--dl-btn-height)',
              backgroundColor: 'var(--dl-danger-bg)',
              borderColor: 'var(--dl-danger-border)',
              color: 'var(--dl-danger-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Eliminar (Danger)</span>
          </button>

          {/* Ghost */}
          <button
            type="button"
            className="px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer hover:underline transition-all"
            style={{
              height: 'var(--dl-btn-height)',
              color: 'var(--dl-text-muted)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Ver Detalle (Ghost)</span>
          </button>

          {/* Icon Button */}
          <button
            type="button"
            className="w-10 flex items-center justify-center font-bold border cursor-pointer transition-all shadow-xs"
            style={{
              height: 'var(--dl-btn-height)',
              backgroundColor: 'var(--dl-secondary)',
              borderColor: 'var(--dl-border)',
              color: 'var(--dl-primary)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Row 2: States Comparison (Disabled, Mobile Touch Target) */}
        <div 
          className="p-3.5 border flex flex-wrap items-center justify-between gap-3 text-xs"
          style={{
            backgroundColor: 'var(--dl-surface-subtle)',
            borderColor: 'var(--dl-border-subtle)',
            borderRadius: 'var(--dl-radius-sm)'
          }}
        >
          <div className="flex items-center gap-3">
            <span className="font-bold" style={{ color: 'var(--dl-text-muted)' }}>Estado Disabled:</span>
            <button
              type="button"
              disabled
              className="px-4 text-xs font-bold opacity-40 cursor-not-allowed border"
              style={{
                height: 'var(--dl-btn-height)',
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border-subtle)',
                color: 'var(--dl-text-muted)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              Acción Deshabilitada
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--dl-text-muted)' }}>
              Target táctil: min-height 44px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
