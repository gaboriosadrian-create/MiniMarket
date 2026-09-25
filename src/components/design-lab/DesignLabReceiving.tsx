import React, { useState } from 'react';
import { Truck, Plus, Minus, Check, AlertTriangle, CheckCircle2, ArrowRight, Loader2 } from 'lucide-react';

export const DesignLabReceiving: React.FC = () => {
  const [receivedQty, setReceivedQty] = useState(2);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [completeFlash, setCompleteFlash] = useState(false);
  const requestedQty = 3;

  const isComplete = receivedQty === requestedQty;
  const isMissing = receivedQty < requestedQty;

  const handleSetComplete = () => {
    setReceivedQty(requestedQty);
    setCompleteFlash(true);
    setTimeout(() => setCompleteFlash(false), 250);
  };

  const handleConfirmReceiving = () => {
    if (saveStatus !== 'idle') return;
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2200);
    }, 550);
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
            5. Recepción de Productos
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Operación móvil rápida: cotejo entre solicitado y recibido, detección de faltantes e ingreso seguro a stock
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Receiving Flow
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
          {/* Top Header */}
          <div className="flex items-center justify-between border-b pb-3" style={{ borderColor: 'var(--dl-border-subtle)' }}>
            <div className="flex items-center gap-2">
              <div 
                className="w-7 h-7 flex items-center justify-center font-bold"
                style={{
                  backgroundColor: 'var(--dl-primary-subtle)',
                  color: 'var(--dl-primary)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <Truck className="w-4 h-4" />
              </div>
              <h4 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
                Nueva Recepción
              </h4>
            </div>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
              REC-0042
            </span>
          </div>

          {/* Supplier Info */}
          <div 
            className="p-3 border space-y-1"
            style={{
              backgroundColor: 'var(--dl-surface-subtle)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--dl-text-muted)' }}>
              Proveedor
            </span>
            <p className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
              Panadería López
            </p>
          </div>

          {/* Product receiving row */}
          <div 
            className={`p-3.5 border space-y-3 transition-all ${completeFlash ? 'dl-anim-flash' : ''}`}
            style={{
              backgroundColor: 'var(--dl-surface)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider block" style={{ color: 'var(--dl-text-muted)' }}>
                  Producto
                </span>
                <h5 className="text-base font-black" style={{ color: 'var(--dl-text)' }}>
                  Tortitas
                </h5>
              </div>

              {/* Status indicator */}
              {isMissing ? (
                <span 
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black transition-colors"
                  style={{
                    backgroundColor: 'var(--dl-warning-bg)',
                    borderColor: 'var(--dl-warning-border)',
                    color: 'var(--dl-warning-text)',
                    borderRadius: 'var(--dl-radius-sm)',
                    border: '1px solid var(--dl-warning-border)'
                  }}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Faltante ({requestedQty - receivedQty})</span>
                </span>
              ) : (
                <span 
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black transition-colors"
                  style={{
                    backgroundColor: 'var(--dl-success-bg)',
                    borderColor: 'var(--dl-success-border)',
                    color: 'var(--dl-success-text)',
                    borderRadius: 'var(--dl-radius-sm)',
                    border: '1px solid var(--dl-success-border)'
                  }}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Completo</span>
                </span>
              )}
            </div>

            {/* Counts Comparison */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 border rounded" style={{ borderColor: 'var(--dl-border-subtle)', backgroundColor: 'var(--dl-surface-subtle)' }}>
                <span style={{ color: 'var(--dl-text-muted)' }}>Solicitado:</span>
                <div className="text-base font-mono font-black" style={{ color: 'var(--dl-text)' }}>
                  {requestedQty} <span className="text-xs font-normal">un</span>
                </div>
              </div>
              <div className="p-2 border rounded" style={{ borderColor: 'var(--dl-border-subtle)', backgroundColor: 'var(--dl-surface-subtle)' }}>
                <span style={{ color: 'var(--dl-text-muted)' }}>Recibido:</span>
                <div className="text-base font-mono font-black" style={{ color: isMissing ? 'var(--dl-warning-text)' : 'var(--dl-success)' }}>
                  {receivedQty} <span className="text-xs font-normal">un</span>
                </div>
              </div>
            </div>

            {/* Interactive Quantity Stepper & Quick Complete */}
            <div className="flex items-center gap-2 pt-1">
              <div className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setReceivedQty(prev => Math.max(0, prev - 1))}
                  className="w-10 h-10 flex items-center justify-center font-black border transition-transform cursor-pointer select-none active:scale-90"
                  style={{
                    backgroundColor: 'var(--dl-secondary)',
                    borderColor: 'var(--dl-border)',
                    color: 'var(--dl-text)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span 
                  key={`rec-${receivedQty}`}
                  className="w-12 text-center text-base font-black font-mono dl-anim-num-pop"
                  style={{ color: 'var(--dl-text)' }}
                >
                  {receivedQty}
                </span>
                <button
                  type="button"
                  onClick={() => setReceivedQty(prev => prev + 1)}
                  className="w-10 h-10 flex items-center justify-center font-black border transition-transform cursor-pointer select-none active:scale-90"
                  style={{
                    backgroundColor: 'var(--dl-secondary)',
                    borderColor: 'var(--dl-border)',
                    color: 'var(--dl-text)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <button
                type="button"
                onClick={handleSetComplete}
                className="px-3 h-10 flex items-center gap-1.5 text-xs font-black border transition-all cursor-pointer shrink-0 active:scale-95"
                style={{
                  backgroundColor: 'var(--dl-success-bg)',
                  borderColor: 'var(--dl-success-border)',
                  color: 'var(--dl-success-text)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                <Check className="w-3.5 h-3.5" />
                <span>COMPLETO</span>
              </button>
            </div>
          </div>

          {/* Confirm Action Button with Save and Lock */}
          <button
            type="button"
            onClick={handleConfirmReceiving}
            disabled={saveStatus !== 'idle'}
            className="w-full flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wide cursor-pointer transition-all shadow-sm active:scale-98 disabled:cursor-not-allowed"
            style={{
              height: 'var(--dl-btn-height)',
              minHeight: '44px',
              backgroundColor: saveStatus === 'saved' ? 'var(--dl-success-bg)' : 'var(--dl-primary)',
              color: saveStatus === 'saved' ? 'var(--dl-success-text)' : 'var(--dl-primary-text)',
              border: saveStatus === 'saved' ? '1px solid var(--dl-success-border)' : 'none',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            {saveStatus === 'idle' && (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>CONFIRMAR RECEPCIÓN</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>GUARDANDO EN INVENTARIO...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-4 h-4" />
                <span>✓ RECEPCIÓN GUARDADA</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

