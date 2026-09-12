import React from 'react';
import { Package, Edit3, Tag, Layers, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react';

export const DesignLabProduct: React.FC = () => {
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
            4. Ficha de Producto / Catálogo
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Estructura de visualización de información de producto, stock y reposición
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Product Card
        </span>
      </div>

      <div className="max-w-md mx-auto">
        <div 
          className="border p-4 sm:p-5 space-y-4 shadow-xs"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          {/* Header Title & Category */}
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span 
                  className="px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--dl-surface-subtle)',
                    color: 'var(--dl-text-muted)',
                    borderRadius: 'var(--dl-radius-sm)',
                    border: '1px solid var(--dl-border-subtle)'
                  }}
                >
                  Panificados
                </span>
                <span className="text-[11px] font-mono font-bold" style={{ color: 'var(--dl-text-muted)' }}>
                  SKU-8921
                </span>
              </div>
              <h4 className="text-lg font-black" style={{ color: 'var(--dl-text)' }}>
                Tortitas
              </h4>
            </div>

            {/* Status badge */}
            <span 
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black"
              style={{
                backgroundColor: 'var(--dl-success-bg)',
                borderColor: 'var(--dl-success-border)',
                color: 'var(--dl-success-text)',
                borderRadius: 'var(--dl-radius-sm)',
                border: '1px solid var(--dl-success-border)'
              }}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Stock normal</span>
            </span>
          </div>

          {/* Key Metric Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div 
              className="p-3 border space-y-0.5"
              style={{
                backgroundColor: 'var(--dl-surface-subtle)',
                borderColor: 'var(--dl-border)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--dl-text-muted)' }}>
                Stock Actual
              </span>
              <span className="text-xl font-black font-mono" style={{ color: 'var(--dl-text)' }}>
                24 <span className="text-xs font-normal" style={{ color: 'var(--dl-text-muted)' }}>un</span>
              </span>
            </div>

            <div 
              className="p-3 border space-y-0.5"
              style={{
                backgroundColor: 'var(--dl-surface-subtle)',
                borderColor: 'var(--dl-border)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--dl-text-muted)' }}>
                Precio de Venta
              </span>
              <span className="text-xl font-black font-mono" style={{ color: 'var(--dl-primary)' }}>
                $1.500
              </span>
            </div>
          </div>

          {/* Reposition thresholds */}
          <div 
            className="p-3 border space-y-2 text-xs"
            style={{
              backgroundColor: 'var(--dl-surface)',
              borderColor: 'var(--dl-border-subtle)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--dl-text-muted)' }}>Punto de reposición:</span>
              <strong className="font-mono" style={{ color: 'var(--dl-text)' }}>10 unidades</strong>
            </div>
            <div className="flex items-center justify-between">
              <span style={{ color: 'var(--dl-text-muted)' }}>Stock objetivo:</span>
              <strong className="font-mono" style={{ color: 'var(--dl-text)' }}>30 unidades</strong>
            </div>
          </div>

          {/* Edit Action Button */}
          <button
            type="button"
            className="w-full flex items-center justify-center gap-2 font-bold text-xs cursor-pointer border transition-all"
            style={{
              height: 'var(--dl-btn-height)',
              backgroundColor: 'var(--dl-secondary)',
              borderColor: 'var(--dl-border)',
              color: 'var(--dl-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar Producto</span>
          </button>
        </div>
      </div>
    </div>
  );
};
