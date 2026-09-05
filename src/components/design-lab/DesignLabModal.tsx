import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, PackagePlus, Eye, Loader2, Check } from 'lucide-react';

export const DesignLabModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'saving' | 'confirmed'>('idle');

  const handleConfirm = () => {
    setConfirmStatus('saving');
    setTimeout(() => {
      setConfirmStatus('confirmed');
      setTimeout(() => {
        setIsOpen(false);
        setConfirmStatus('idle');
      }, 1000);
    }, 500);
  };

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
            12. Modal / Diálogo de Confirmación
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Overlay con fade suave, escala contenida (0.96 → 1.0) y salida rápida sin animaciones lentas
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Modal Dialog
        </span>
      </div>

      <div className="max-w-md mx-auto space-y-4">
        {/* Inline Card preview */}
        <div 
          className="border p-5 space-y-4 relative"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)',
            boxShadow: 'var(--dl-shadow-md)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--dl-border-subtle)' }}>
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 flex items-center justify-center font-bold"
                style={{
                  backgroundColor: 'var(--dl-primary-subtle)',
                  color: 'var(--dl-primary)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <PackagePlus className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
                Confirmar Recepción
              </h4>
            </div>
            <button 
              type="button"
              className="p-1 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
              style={{ color: 'var(--dl-text-muted)' }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body content */}
          <div className="space-y-3">
            <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--dl-text)' }}>
              ¿Confirmás el ingreso de <strong className="font-mono font-black">24 unidades</strong> al stock general del negocio?
            </p>

            <div 
              className="p-3 border space-y-1 text-xs"
              style={{
                backgroundColor: 'var(--dl-surface-subtle)',
                borderColor: 'var(--dl-border-subtle)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              <div className="flex justify-between">
                <span style={{ color: 'var(--dl-text-muted)' }}>Proveedor:</span>
                <strong style={{ color: 'var(--dl-text)' }}>Panadería López</strong>
              </div>
              <div className="flex justify-between">
                <span style={{ color: 'var(--dl-text-muted)' }}>Comprobante:</span>
                <span className="font-mono font-bold" style={{ color: 'var(--dl-text)' }}>FC-0001-00012345</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--dl-border-subtle)' }}>
            <button
              type="button"
              className="px-4 text-xs font-bold border cursor-pointer transition-all"
              style={{
                height: 'var(--dl-btn-height)',
                backgroundColor: 'var(--dl-secondary)',
                borderColor: 'var(--dl-border)',
                color: 'var(--dl-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="px-4 text-xs font-black uppercase tracking-wide cursor-pointer transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
              style={{
                height: 'var(--dl-btn-height)',
                backgroundColor: 'var(--dl-primary)',
                color: 'var(--dl-primary-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Abrir en Pantalla Completa</span>
            </button>
          </div>
        </div>
      </div>

      {/* Real Interactive Overlay Modal */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 dl-anim-fade"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full max-w-md border p-5 space-y-4 shadow-xl dl-anim-modal"
            style={{
              backgroundColor: 'var(--dl-surface)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-md)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--dl-border-subtle)' }}>
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: 'var(--dl-primary-subtle)',
                    color: 'var(--dl-primary)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <PackagePlus className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
                  Confirmar Recepción
                </h4>
              </div>
              <button 
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
                style={{ color: 'var(--dl-text-muted)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium leading-relaxed" style={{ color: 'var(--dl-text)' }}>
                ¿Confirmás el ingreso de <strong className="font-mono font-black">24 unidades</strong> al stock general del negocio?
              </p>

              <div 
                className="p-3 border space-y-1 text-xs"
                style={{
                  backgroundColor: 'var(--dl-surface-subtle)',
                  borderColor: 'var(--dl-border-subtle)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <div className="flex justify-between">
                  <span style={{ color: 'var(--dl-text-muted)' }}>Proveedor:</span>
                  <strong style={{ color: 'var(--dl-text)' }}>Panadería López</strong>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--dl-text-muted)' }}>Comprobante:</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--dl-text)' }}>FC-0001-00012345</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t" style={{ borderColor: 'var(--dl-border-subtle)' }}>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 text-xs font-bold border cursor-pointer transition-all"
                style={{
                  height: 'var(--dl-btn-height)',
                  backgroundColor: 'var(--dl-secondary)',
                  borderColor: 'var(--dl-border)',
                  color: 'var(--dl-text)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={confirmStatus !== 'idle'}
                className="px-4 text-xs font-black uppercase tracking-wide cursor-pointer transition-all shadow-sm active:scale-95 disabled:cursor-not-allowed flex items-center gap-1.5"
                style={{
                  height: 'var(--dl-btn-height)',
                  backgroundColor: confirmStatus === 'confirmed' ? 'var(--dl-success-bg)' : 'var(--dl-primary)',
                  color: confirmStatus === 'confirmed' ? 'var(--dl-success-text)' : 'var(--dl-primary-text)',
                  border: confirmStatus === 'confirmed' ? '1px solid var(--dl-success-border)' : 'none',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                {confirmStatus === 'idle' && <span>Confirmar Recepción</span>}
                {confirmStatus === 'saving' && (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Guardando...</span>
                  </>
                )}
                {confirmStatus === 'confirmed' && (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>✓ Confirmado</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

