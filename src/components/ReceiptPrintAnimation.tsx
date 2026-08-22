import React, { useState, useEffect, useMemo } from 'react';
import { Sale } from '../types';
import { X, CheckCircle2, Zap } from 'lucide-react';

interface ReceiptPrintAnimationProps {
  sale: Sale;
  businessName?: string;
  onComplete?: () => void;
  durationMs?: number;
}

/**
 * Deterministic SVG Barcode generator based on Sale ID.
 * Generates realistic-looking Code-128 style bars.
 */
const BarcodeGraphic: React.FC<{ value: string }> = ({ value }) => {
  const bars = useMemo(() => {
    const clean = (value || 'SALE-000000').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const result: { width: number; space: number }[] = [];
    
    // Initial start guard bars
    result.push({ width: 2, space: 2 });
    result.push({ width: 1, space: 2 });

    let hash = 0;
    for (let i = 0; i < clean.length; i++) {
      hash = (hash * 31 + clean.charCodeAt(i)) % 1000000;
      const w = (hash % 3) + 1; // 1, 2, or 3px
      const s = ((hash >> 2) % 3) + 1; // 1, 2, or 3px
      result.push({ width: w, space: s });
    }

    // Trailing guard bars
    result.push({ width: 3, space: 2 });
    result.push({ width: 1, space: 1 });
    result.push({ width: 2, space: 0 });

    return result;
  }, [value]);

  let currentX = 10;
  const rects: React.ReactNode[] = [];

  bars.forEach((bar, idx) => {
    rects.push(
      <rect
        key={idx}
        x={currentX}
        y="0"
        width={bar.width * 1.5}
        height="38"
        fill="#1c1917"
      />
    );
    currentX += (bar.width * 1.5) + (bar.space * 1.5);
  });

  return (
    <div className="flex flex-col items-center justify-center my-2 select-none">
      <svg
        viewBox={`0 0 ${Math.max(currentX + 10, 180)} 38`}
        className="h-9 w-auto max-w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {rects}
      </svg>
      <span className="font-mono text-[9px] tracking-widest text-stone-600 mt-0.5">
        *{value?.slice(-12).toUpperCase() || 'MINIMARKET'}*
      </span>
    </div>
  );
};

/**
 * Zig-Zag Jagged Paper Edge SVG
 */
const JaggedEdge: React.FC<{ position: 'top' | 'bottom'; color?: string }> = ({ position, color = '#fffdfa' }) => {
  return (
    <div className={`w-full overflow-hidden leading-none h-[6px] relative ${position === 'top' ? '-mb-[1px]' : '-mt-[1px]'}`}>
      <svg
        viewBox="0 0 320 6"
        preserveAspectRatio="none"
        className="w-full h-[6px] block"
        style={{ fill: color }}
      >
        {position === 'top' ? (
          <path d="M0,6 L10,0 L20,6 L30,0 L40,6 L50,0 L60,6 L70,0 L80,6 L90,0 L100,6 L110,0 L120,6 L130,0 L140,6 L150,0 L160,6 L170,0 L180,6 L190,0 L200,6 L210,0 L220,6 L230,0 L240,6 L250,0 L260,6 L270,0 L280,6 L290,0 L300,6 L310,0 L320,6 L320,6 L0,6 Z" />
        ) : (
          <path d="M0,0 L10,6 L20,0 L30,6 L40,0 L50,6 L60,0 L70,6 L80,0 L90,6 L100,0 L110,6 L120,0 L130,6 L140,0 L150,6 L160,0 L170,6 L180,0 L190,6 L200,0 L210,6 L220,0 L230,6 L240,0 L250,6 L260,0 L270,6 L280,0 L290,6 L300,0 L310,6 L320,0 L320,0 L0,0 Z" />
        )}
      </svg>
    </div>
  );
};

export const ReceiptPrintAnimation: React.FC<ReceiptPrintAnimationProps> = ({
  sale,
  businessName = 'MINIMARKET',
  onComplete,
  durationMs = 4000
}) => {
  const [phase, setPhase] = useState<'ENTERING' | 'PRINTING' | 'VISIBLE' | 'EXITING'>('ENTERING');
  const [isDismissed, setIsDismissed] = useState(false);

  // Check prefers-reduced-motion
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Format date & time
  const formattedDate = useMemo(() => {
    const d = sale.createdAt ? new Date(sale.createdAt) : new Date();
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }, [sale.createdAt]);

  const saleNumber = useMemo(() => {
    if (!sale.id) return '000001';
    return sale.id.slice(-6).toUpperCase();
  }, [sale.id]);

  // Payment label & breakdown
  const paymentLabel = useMemo(() => {
    if (sale.paymentMethod === 'EFECTIVO') return 'EFECTIVO';
    if (sale.paymentMethod === 'MERCADO_PAGO') return 'MERCADO PAGO';
    if (sale.paymentMethod === 'COMBINADO') return 'PAGO COMBINADO';
    return sale.paymentMethod || 'EFECTIVO';
  }, [sale.paymentMethod]);

  // Lifecycle timer sequence
  useEffect(() => {
    if (isDismissed) return;

    if (prefersReducedMotion) {
      // Short-circuit animation for reduced-motion users
      setPhase('VISIBLE');
      const timer = setTimeout(() => {
        handleDismiss();
      }, 2500);
      return () => clearTimeout(timer);
    }

    // 1. 0 - 150ms: Entering
    const t1 = setTimeout(() => {
      setPhase('PRINTING');
    }, 150);

    // 2. 150ms - 1500ms: Printing paper ejection
    const t2 = setTimeout(() => {
      setPhase('VISIBLE');
    }, 1500);

    // 3. 1500ms - 3500ms: Fully visible (2000ms pause)
    const t3 = setTimeout(() => {
      setPhase('EXITING');
    }, durationMs - 500);

    // 4. 4000ms: Complete and clean up
    const t4 = setTimeout(() => {
      handleDismiss();
    }, durationMs);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [durationMs, prefersReducedMotion, isDismissed]);

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onComplete) {
      onComplete();
    }
  };

  if (isDismissed) return null;

  return (
    <div
      role="dialog"
      aria-label="Comprobante de venta impresa"
      aria-modal="false"
      className={`fixed inset-0 z-50 pointer-events-none flex flex-col items-center justify-start pt-12 sm:pt-16 px-4 transition-opacity duration-300 ${
        phase === 'EXITING' ? 'opacity-0 scale-95' : 'opacity-100 scale-100'
      }`}
    >
      {/* Subtle backdrop overlay (non-blocking for background clicks, but with low opacity to highlight ticket) */}
      <div 
        onClick={handleDismiss}
        className="absolute inset-0 bg-stone-900/25 backdrop-blur-[1px] pointer-events-auto transition-opacity duration-300"
        title="Haz clic para cerrar el comprobante"
      />

      {/* Main Thermal POS Printer + Ticket Container */}
      <div 
        className="relative pointer-events-auto flex flex-col items-center w-full max-w-[310px] sm:max-w-[330px] select-none"
        style={{
          perspective: '1000px'
        }}
      >
        {/* Quick Close Button Floating on Top Right */}
        <button
          onClick={handleDismiss}
          type="button"
          aria-label="Cerrar ticket"
          className="absolute -top-3 -right-3 z-30 w-7 h-7 rounded-full bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 shadow-md flex items-center justify-center cursor-pointer transition-colors border border-stone-600 active:scale-95"
          title="Cerrar"
        >
          <X className="w-3.5 h-3.5" />
        </button>

        {/* 1. THERMAL POS PRINTER BODY (Compact Modern Head) */}
        <div 
          className={`w-full bg-linear-to-b from-stone-900 via-stone-800 to-stone-900 rounded-t-2xl border-t border-x border-stone-700 shadow-xl px-4 py-2.5 z-20 flex flex-col items-center relative transition-transform ${
            phase === 'PRINTING' ? 'mm-printer-vibe' : ''
          }`}
        >
          {/* Top Bezel Details: Brand + LED */}
          <div className="w-full flex items-center justify-between text-[10px] text-stone-400 font-mono tracking-wider mb-1.5 px-0.5">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-stone-500" />
              <span className="font-bold text-stone-300 text-[9px] uppercase tracking-widest">MINIMARKET POS</span>
            </div>
            
            {/* LED Status Light */}
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] text-stone-400 font-sans uppercase">
                {phase === 'PRINTING' ? 'IMPRIMIENDO' : 'LISTO'}
              </span>
              <span 
                className={`w-2 h-2 rounded-full transition-all duration-200 ${
                  phase === 'PRINTING'
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse'
                    : 'bg-emerald-500 shadow-[0_0_4px_#10b981]'
                }`} 
              />
            </div>
          </div>

          {/* Ejection Slot (Ranura de salida de papel) */}
          <div className="w-full h-2 bg-stone-950 rounded-full border border-stone-900 shadow-inner relative flex items-center justify-center overflow-hidden">
            <div className="w-4/5 h-[1px] bg-stone-800" />
          </div>
        </div>

        {/* 2. PAPER SLIT MASK & EJECTION CONTAINER */}
        <div className="w-full relative overflow-hidden -mt-1 pt-1 z-10">
          
          {/* THE THERMAL RECEIPT (El Ticket) */}
          <div 
            className={`w-full transition-all ease-out ${
              prefersReducedMotion
                ? 'transform-none opacity-100'
                : phase === 'ENTERING'
                ? '-translate-y-[102%] opacity-90'
                : phase === 'PRINTING'
                ? 'translate-y-0 opacity-100 duration-1300'
                : 'translate-y-0 opacity-100 duration-300'
            }`}
            style={{
              transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)'
            }}
          >
            {/* Top Jagged Serrated Edge */}
            <JaggedEdge position="top" color="#fffdf8" />

            {/* Receipt Paper Content */}
            <div 
              className="bg-[#fffdf8] text-[#1c1917] px-4 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.22)] border-x border-[#f0ece1] text-[11px] font-mono leading-tight space-y-2 max-h-[60vh] sm:max-h-[68vh] overflow-y-auto"
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
              }}
            >
              {/* Header */}
              <div className="text-center space-y-0.5 border-b border-dashed border-stone-300 pb-2">
                <p className="font-black text-sm text-stone-900 tracking-wider uppercase">
                  {businessName}
                </p>
                <p className="text-[10px] font-semibold text-stone-500 tracking-tight">
                  PUNTO DE VENTA & CAJA
                </p>
                <div className="flex items-center justify-center gap-2 pt-1 text-[9.5px] text-stone-600 font-medium">
                  <span>{formattedDate}</span>
                  <span>•</span>
                  <span className="font-bold text-stone-800">TICKET #{saleNumber}</span>
                </div>
                <div className="text-[9.5px] text-stone-500">
                  Vendedor: <span className="font-semibold text-stone-700">{sale.sellerName || 'Cajero'}</span>
                </div>
              </div>

              {/* Status Badge (Online / Offline) */}
              <div className="flex items-center justify-between text-[9px] px-1 py-0.5 bg-stone-100/80 rounded text-stone-600 border border-stone-200/60">
                <span className="flex items-center gap-1 font-bold text-emerald-700">
                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                  VENTA CONFIRMADA
                </span>
                <span>
                  {sale.syncStatus === 'PENDING' ? 'MODO LOCAL (OFFLINE)' : 'SINCRONIZADO'}
                </span>
              </div>

              {/* Items Table */}
              <div className="space-y-1 pt-1">
                <div className="flex justify-between font-bold text-[9.5px] text-stone-500 border-b border-stone-200 pb-0.5">
                  <span className="w-8 text-left">CANT</span>
                  <span className="flex-1 text-left px-1">DETALLE</span>
                  <span className="w-16 text-right">TOTAL</span>
                </div>

                <div className="space-y-1 divide-y divide-dashed divide-stone-200/70 max-h-40 overflow-y-auto pr-0.5">
                  {sale.items.map((item, index) => (
                    <div key={index} className="flex justify-between items-baseline pt-1 text-[10.5px]">
                      <span className="w-8 text-left font-bold text-stone-700">{item.quantity}x</span>
                      <div className="flex-1 text-left px-1 min-w-0">
                        <p className="font-semibold text-stone-900 truncate">{item.productName}</p>
                        {item.quantity > 1 && (
                          <p className="text-[8.5px] text-stone-500">@ ${item.unitPrice.toLocaleString('es-AR')}</p>
                        )}
                      </div>
                      <span className="w-16 text-right font-bold text-stone-900">
                        ${item.subtotal.toLocaleString('es-AR')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals & Breakdown */}
              <div className="border-t border-dashed border-stone-300 pt-2 space-y-1">
                <div className="flex justify-between items-center text-xs font-black text-stone-950 pt-0.5">
                  <span className="tracking-wide">TOTAL VENTA</span>
                  <span className="text-sm font-black text-emerald-800">
                    ${sale.total.toLocaleString('es-AR')}
                  </span>
                </div>

                {/* Payment Method & Cash details */}
                <div className="border-t border-stone-200 pt-1.5 space-y-0.5 text-[10px] text-stone-700">
                  <div className="flex justify-between font-semibold">
                    <span>Medio de Pago:</span>
                    <span className="font-bold text-stone-900 uppercase">{paymentLabel}</span>
                  </div>

                  {sale.paymentMethod === 'COMBINADO' && sale.paymentBreakdown && (
                    <div className="text-[9px] text-stone-600 space-y-0.5 bg-stone-50 p-1 rounded border border-stone-200/50 mt-1">
                      <div className="flex justify-between">
                        <span>• Efectivo:</span>
                        <span className="font-mono font-bold">${sale.paymentBreakdown.cashAmount.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Mercado Pago:</span>
                        <span className="font-mono font-bold">${sale.paymentBreakdown.mpAmount.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  )}

                  {sale.cashReceived !== undefined && sale.cashReceived > 0 && (
                    <div className="flex justify-between text-stone-600">
                      <span>Efectivo Recibido:</span>
                      <span className="font-mono">${sale.cashReceived.toLocaleString('es-AR')}</span>
                    </div>
                  )}

                  {sale.change !== undefined && sale.change > 0 && (
                    <div className="flex justify-between font-bold text-emerald-800">
                      <span>Vuelto Entregado:</span>
                      <span className="font-mono">${sale.change.toLocaleString('es-AR')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Deterministic Barcode */}
              <div className="border-t border-dashed border-stone-300 pt-2 text-center">
                <BarcodeGraphic value={sale.id || saleNumber} />
                <p className="text-[9px] text-stone-500 font-sans italic mt-1">
                  ¡Gracias por su compra!
                </p>
                <p className="text-[8px] text-stone-400 uppercase tracking-tighter">
                  Comprobante térmico de control interno
                </p>
              </div>
            </div>

            {/* Bottom Jagged Serrated Edge */}
            <JaggedEdge position="bottom" color="#fffdf8" />
          </div>
        </div>

        {/* Small dismiss indicator under ticket */}
        <div className="mt-2 text-center text-[10px] text-stone-300/80 font-sans tracking-wide">
          <span>Toca en cualquier parte para continuar</span>
        </div>
      </div>
    </div>
  );
};
