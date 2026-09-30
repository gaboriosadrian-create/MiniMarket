import React, { useState } from 'react';
import { Search, Plus, Minus, ShoppingCart, Trash2, CreditCard, DollarSign, Check, Loader2, Sparkles } from 'lucide-react';

export const DesignLabPOS: React.FC = () => {
  const [quantities, setQuantities] = useState<Record<string, number>>({
    tortitas: 2,
    medialunas: 1
  });
  const [checkoutState, setCheckoutState] = useState<'idle' | 'processing' | 'success'>('idle');

  const updateQty = (id: string, delta: number) => {
    setQuantities(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const handleCheckout = () => {
    if (checkoutState !== 'idle') return;
    setCheckoutState('processing');
    setTimeout(() => {
      setCheckoutState('success');
      setTimeout(() => setCheckoutState('idle'), 2200);
    }, 450);
  };

  const total = (quantities.tortitas * 1500) + (quantities.medialunas * 1200);

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
            3. POS / Punto de Venta (Mobile-First)
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Prioridad: Botones táctiles, lectura inmediata de precios, microtransiciones de cantidad y cobro instantáneo
          </p>
        </div>
        <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-text-muted)' }}>
          Caja Rápida
        </span>
      </div>

      <div className="max-w-md mx-auto">
        <div 
          className="border p-4 space-y-4 shadow-xs"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          {/* Top Search bar */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--dl-text-muted)' }} />
            <input
              type="text"
              readOnly
              value="Tortitas"
              placeholder="Buscar producto o escanear..."
              className="w-full pl-9 pr-3 text-xs font-bold border outline-none"
              style={{
                height: 'var(--dl-input-height)',
                backgroundColor: 'var(--dl-surface-subtle)',
                borderColor: 'var(--dl-border)',
                color: 'var(--dl-text)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            />
          </div>

          {/* Product Items in Cart */}
          <div className="space-y-2.5">
            {/* Item 1: Tortitas */}
            <div 
              className="p-3.5 border flex items-center justify-between gap-3 transition-all"
              style={{
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black truncate" style={{ color: 'var(--dl-text)' }}>
                  Tortitas
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span style={{ color: 'var(--dl-text-muted)' }}>Stock: <strong>24</strong></span>
                  <span style={{ color: 'var(--dl-border)' }}>•</span>
                  <span className="font-mono font-black" style={{ color: 'var(--dl-primary)' }}>
                    $1.500 c/u
                  </span>
                </div>
              </div>

              {/* Counter Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => updateQty('tortitas', -1)}
                  className="w-9 h-9 flex items-center justify-center font-black border transition-transform cursor-pointer select-none active:scale-90"
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
                  key={`tortitas-${quantities.tortitas}`}
                  className="w-8 text-center text-sm font-black font-mono dl-anim-num-pop"
                  style={{ color: 'var(--dl-text)' }}
                >
                  {quantities.tortitas}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty('tortitas', 1)}
                  className="w-9 h-9 flex items-center justify-center font-black border transition-transform cursor-pointer select-none active:scale-90"
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
            </div>

            {/* Item 2: Medialunas */}
            <div 
              className="p-3.5 border flex items-center justify-between gap-3 transition-all"
              style={{
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)',
                borderRadius: 'var(--dl-radius-sm)'
              }}
            >
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-black truncate" style={{ color: 'var(--dl-text)' }}>
                  Medialunas
                </h4>
                <div className="flex items-center gap-2 mt-0.5 text-xs">
                  <span style={{ color: 'var(--dl-text-muted)' }}>Stock: <strong>12</strong></span>
                  <span style={{ color: 'var(--dl-border)' }}>•</span>
                  <span className="font-mono font-black" style={{ color: 'var(--dl-primary)' }}>
                    $1.200 c/u
                  </span>
                </div>
              </div>

              {/* Counter Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => updateQty('medialunas', -1)}
                  className="w-9 h-9 flex items-center justify-center font-black border transition-transform cursor-pointer select-none active:scale-90"
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
                  key={`medialunas-${quantities.medialunas}`}
                  className="w-8 text-center text-sm font-black font-mono dl-anim-num-pop"
                  style={{ color: 'var(--dl-text)' }}
                >
                  {quantities.medialunas}
                </span>
                <button
                  type="button"
                  onClick={() => updateQty('medialunas', 1)}
                  className="w-9 h-9 flex items-center justify-center font-black border transition-transform cursor-pointer select-none active:scale-90"
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
            </div>
          </div>

          {/* Cart Summary & Total */}
          <div 
            className="p-3.5 border space-y-2"
            style={{
              backgroundColor: 'var(--dl-surface-subtle)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <div className="flex items-center justify-between text-xs font-bold" style={{ color: 'var(--dl-text-muted)' }}>
              <span>Total ítems: {quantities.tortitas + quantities.medialunas} unidades</span>
              <span>Subtotal: ${total.toLocaleString('es-AR')}</span>
            </div>

            <div className="flex items-baseline justify-between pt-1 border-t" style={{ borderColor: 'var(--dl-border)' }}>
              <span className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--dl-text)' }}>
                TOTAL A COBRAR
              </span>
              <span className="text-2xl font-black font-mono" style={{ color: 'var(--dl-text)' }}>
                ${total.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Primary Action Button with Microinteraction */}
          <button
            type="button"
            onClick={handleCheckout}
            disabled={checkoutState !== 'idle'}
            className="w-full flex items-center justify-center gap-2 font-black text-sm uppercase tracking-wide cursor-pointer transition-all shadow-sm active:scale-98 disabled:cursor-not-allowed"
            style={{
              height: 'var(--dl-btn-height)',
              minHeight: '44px',
              backgroundColor: checkoutState === 'success' ? 'var(--dl-success-bg)' : 'var(--dl-primary)',
              color: checkoutState === 'success' ? 'var(--dl-success-text)' : 'var(--dl-primary-text)',
              border: checkoutState === 'success' ? '1px solid var(--dl-success-border)' : 'none',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            {checkoutState === 'idle' && (
              <>
                <DollarSign className="w-5 h-5" />
                <span>COBRAR (${total.toLocaleString('es-AR')})</span>
              </>
            )}
            {checkoutState === 'processing' && (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>PROCESANDO VENTA...</span>
              </>
            )}
            {checkoutState === 'success' && (
              <>
                <Check className="w-5 h-5" />
                <span>✓ ¡COBRO EXITOSO!</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

