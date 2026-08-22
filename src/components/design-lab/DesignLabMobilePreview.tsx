import React, { useState } from 'react';
import { 
  Smartphone, 
  ShoppingCart, 
  Truck, 
  ClipboardList, 
  LayoutDashboard, 
  Package, 
  Menu, 
  Search, 
  Minus, 
  Plus, 
  DollarSign, 
  Check, 
  AlertTriangle, 
  CheckCircle2, 
  Share2, 
  Save, 
  Store, 
  User, 
  ChevronRight,
  Wifi,
  Battery,
  Signal
} from 'lucide-react';

export const DesignLabMobilePreview: React.FC = () => {
  const [mobileTab, setMobileTab] = useState<'pos' | 'recepcion' | 'solicitud' | 'dashboard' | 'menu'>('pos');
  const [posQty1, setPosQty1] = useState(2);
  const [posQty2, setPosQty2] = useState(1);
  const [recQty, setRecQty] = useState(2);

  const posTotal = (posQty1 * 1500) + (posQty2 * 1200);

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
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <h3 className="text-sm font-black flex items-center gap-2" style={{ color: 'var(--dl-text)' }}>
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>14. 📱 Mobile Preview (Simulador 390 × 844 px)</span>
          </h3>
          <p className="text-xs" style={{ color: 'var(--dl-text-muted)' }}>
            Simulación interactiva 1:1 para evaluar ergonomía táctil, tamaños de fuente y densidad en teléfonos móviles
          </p>
        </div>

        {/* Mobile screen view switcher */}
        <div className="flex items-center gap-1.5 p-1 border rounded-xl" style={{ borderColor: 'var(--dl-border)', backgroundColor: 'var(--dl-surface-subtle)' }}>
          <button
            type="button"
            onClick={() => setMobileTab('pos')}
            className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              mobileTab === 'pos' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            POS / Caja
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('recepcion')}
            className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              mobileTab === 'recepcion' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Recepción
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('solicitud')}
            className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              mobileTab === 'solicitud' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Solicitud
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('dashboard')}
            className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              mobileTab === 'dashboard' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('menu')}
            className={`px-3 py-1 text-xs font-bold rounded-lg cursor-pointer transition-all ${
              mobileTab === 'menu' ? 'bg-stone-900 text-white shadow-xs' : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Menú Drawer
          </button>
        </div>
      </div>

      {/* Phone Simulator Frame */}
      <div className="flex justify-center py-4 overflow-x-auto">
        <div 
          className="w-[390px] h-[780px] rounded-[44px] p-3 border-4 border-stone-800 bg-stone-950 shadow-2xl relative flex flex-col shrink-0 select-none"
        >
          {/* Dynamic Island / Notch */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-5 bg-stone-900 rounded-full z-30 flex items-center justify-end px-3">
            <div className="w-2.5 h-2.5 rounded-full bg-stone-800 border border-stone-700" />
          </div>

          {/* Inner Phone Screen */}
          <div 
            className="w-full h-full rounded-[36px] overflow-hidden flex flex-col relative"
            style={{
              backgroundColor: 'var(--dl-bg)',
              fontFamily: 'var(--dl-font-sans)'
            }}
          >
            {/* Status Bar */}
            <div className="h-10 px-6 flex items-center justify-between text-[11px] font-bold shrink-0 pt-2" style={{ color: 'var(--dl-text)' }}>
              <span>09:41</span>
              <div className="flex items-center gap-1.5 opacity-80">
                <Signal className="w-3.5 h-3.5" />
                <Wifi className="w-3.5 h-3.5" />
                <Battery className="w-4 h-4" />
              </div>
            </div>

            {/* Mobile App Header */}
            <div 
              className="px-4 py-2.5 border-b flex items-center justify-between shrink-0 shadow-2xs"
              style={{
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)'
              }}
            >
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 flex items-center justify-center font-bold"
                  style={{
                    backgroundColor: 'var(--dl-primary)',
                    color: 'var(--dl-primary-text)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black leading-tight" style={{ color: 'var(--dl-text)' }}>
                    MiniMarket
                  </h4>
                  <p className="text-[10px] leading-tight" style={{ color: 'var(--dl-text-muted)' }}>
                    Kiosco Central
                  </p>
                </div>
              </div>

              <span 
                className="text-[10px] font-black uppercase px-2 py-0.5 border"
                style={{
                  backgroundColor: 'var(--dl-surface-subtle)',
                  borderColor: 'var(--dl-border-subtle)',
                  color: 'var(--dl-primary)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                {mobileTab.toUpperCase()}
              </span>
            </div>

            {/* Mobile Screen Content */}
            <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
              
              {/* VIEW 1: POS */}
              {mobileTab === 'pos' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--dl-text-muted)' }} />
                    <input
                      type="text"
                      readOnly
                      value="Tortitas"
                      placeholder="Buscar producto..."
                      className="w-full pl-8 pr-3 text-xs font-bold border outline-none"
                      style={{
                        height: '36px',
                        backgroundColor: 'var(--dl-surface)',
                        borderColor: 'var(--dl-border)',
                        color: 'var(--dl-text)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    />
                  </div>

                  {/* Cart Items */}
                  <div className="space-y-2">
                    <div 
                      className="p-3 border flex items-center justify-between gap-2 shadow-2xs"
                      style={{
                        backgroundColor: 'var(--dl-surface)',
                        borderColor: 'var(--dl-border)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black truncate" style={{ color: 'var(--dl-text)' }}>
                          Tortitas
                        </p>
                        <p className="text-[11px] font-mono font-black" style={{ color: 'var(--dl-primary)' }}>
                          $1.500 <span className="text-[9px] font-normal" style={{ color: 'var(--dl-text-muted)' }}>(Stock: 24)</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPosQty1(prev => Math.max(0, prev - 1))}
                          className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer"
                          style={{
                            backgroundColor: 'var(--dl-secondary)',
                            borderColor: 'var(--dl-border)',
                            color: 'var(--dl-text)',
                            borderRadius: 'var(--dl-radius-sm)'
                          }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-black" style={{ color: 'var(--dl-text)' }}>
                          {posQty1}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPosQty1(prev => prev + 1)}
                          className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer"
                          style={{
                            backgroundColor: 'var(--dl-secondary)',
                            borderColor: 'var(--dl-border)',
                            color: 'var(--dl-text)',
                            borderRadius: 'var(--dl-radius-sm)'
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div 
                      className="p-3 border flex items-center justify-between gap-2 shadow-2xs"
                      style={{
                        backgroundColor: 'var(--dl-surface)',
                        borderColor: 'var(--dl-border)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-black truncate" style={{ color: 'var(--dl-text)' }}>
                          Medialunas
                        </p>
                        <p className="text-[11px] font-mono font-black" style={{ color: 'var(--dl-primary)' }}>
                          $1.200 <span className="text-[9px] font-normal" style={{ color: 'var(--dl-text-muted)' }}>(Stock: 12)</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setPosQty2(prev => Math.max(0, prev - 1))}
                          className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer"
                          style={{
                            backgroundColor: 'var(--dl-secondary)',
                            borderColor: 'var(--dl-border)',
                            color: 'var(--dl-text)',
                            borderRadius: 'var(--dl-radius-sm)'
                          }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-mono font-black" style={{ color: 'var(--dl-text)' }}>
                          {posQty2}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPosQty2(prev => prev + 1)}
                          className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer"
                          style={{
                            backgroundColor: 'var(--dl-secondary)',
                            borderColor: 'var(--dl-border)',
                            color: 'var(--dl-text)',
                            borderRadius: 'var(--dl-radius-sm)'
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Total Card */}
                  <div 
                    className="p-3 border space-y-1.5"
                    style={{
                      backgroundColor: 'var(--dl-surface-subtle)',
                      borderColor: 'var(--dl-border)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <div className="flex justify-between items-baseline">
                      <span className="text-[11px] font-black uppercase" style={{ color: 'var(--dl-text)' }}>
                        TOTAL
                      </span>
                      <span className="text-xl font-mono font-black" style={{ color: 'var(--dl-text)' }}>
                        ${posTotal.toLocaleString('es-AR')}
                      </span>
                    </div>
                  </div>

                  {/* Cobrar Button */}
                  <button
                    type="button"
                    className="w-full h-12 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wide cursor-pointer shadow-md"
                    style={{
                      backgroundColor: 'var(--dl-primary)',
                      color: 'var(--dl-primary-text)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <DollarSign className="w-4 h-4" />
                    <span>COBRAR (${posTotal.toLocaleString('es-AR')})</span>
                  </button>
                </div>
              )}

              {/* VIEW 2: RECEPCIÓN */}
              {mobileTab === 'recepcion' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div 
                    className="p-3 border space-y-1"
                    style={{
                      backgroundColor: 'var(--dl-surface)',
                      borderColor: 'var(--dl-border)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--dl-text-muted)' }}>
                      Proveedor
                    </span>
                    <p className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                      Panadería López
                    </p>
                  </div>

                  <div 
                    className="p-3 border space-y-3"
                    style={{
                      backgroundColor: 'var(--dl-surface)',
                      borderColor: 'var(--dl-border)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--dl-text-muted)' }}>Producto</span>
                        <p className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>Tortitas</p>
                      </div>
                      <span 
                        className="text-[9px] font-black uppercase px-2 py-0.5 border"
                        style={{
                          backgroundColor: 'var(--dl-warning-bg)',
                          borderColor: 'var(--dl-warning-border)',
                          color: 'var(--dl-warning-text)',
                          borderRadius: 'var(--dl-radius-full)'
                        }}
                      >
                        ⚠ Faltante (1)
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 border rounded" style={{ borderColor: 'var(--dl-border-subtle)', backgroundColor: 'var(--dl-surface-subtle)' }}>
                        <span className="text-[10px]" style={{ color: 'var(--dl-text-muted)' }}>Solicitado:</span>
                        <p className="font-mono font-black" style={{ color: 'var(--dl-text)' }}>3 un</p>
                      </div>
                      <div className="p-2 border rounded" style={{ borderColor: 'var(--dl-border-subtle)', backgroundColor: 'var(--dl-surface-subtle)' }}>
                        <span className="text-[10px]" style={{ color: 'var(--dl-text-muted)' }}>Recibido:</span>
                        <p className="font-mono font-black" style={{ color: 'var(--dl-warning-text)' }}>{recQty} un</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 flex-1">
                        <button
                          type="button"
                          onClick={() => setRecQty(prev => Math.max(0, prev - 1))}
                          className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer"
                          style={{
                            backgroundColor: 'var(--dl-secondary)',
                            borderColor: 'var(--dl-border)',
                            color: 'var(--dl-text)',
                            borderRadius: 'var(--dl-radius-sm)'
                          }}
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="w-8 text-center text-xs font-mono font-black" style={{ color: 'var(--dl-text)' }}>
                          {recQty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRecQty(prev => prev + 1)}
                          className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer"
                          style={{
                            backgroundColor: 'var(--dl-secondary)',
                            borderColor: 'var(--dl-border)',
                            color: 'var(--dl-text)',
                            borderRadius: 'var(--dl-radius-sm)'
                          }}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => setRecQty(3)}
                        className="px-2.5 h-8 text-[11px] font-black border cursor-pointer"
                        style={{
                          backgroundColor: 'var(--dl-success-bg)',
                          borderColor: 'var(--dl-success-border)',
                          color: 'var(--dl-success-text)',
                          borderRadius: 'var(--dl-radius-sm)'
                        }}
                      >
                        ✓ COMPLETO
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full h-11 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wide cursor-pointer shadow-md"
                    style={{
                      backgroundColor: 'var(--dl-primary)',
                      color: 'var(--dl-primary-text)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CONFIRMAR RECEPCIÓN</span>
                  </button>
                </div>
              )}

              {/* VIEW 3: SOLICITUD */}
              {mobileTab === 'solicitud' && (
                <div className="space-y-3 animate-in fade-in duration-150">
                  <div 
                    className="p-3 border space-y-1"
                    style={{
                      backgroundColor: 'var(--dl-surface)',
                      borderColor: 'var(--dl-border)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--dl-text-muted)' }}>
                      Proveedor
                    </span>
                    <p className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                      Panadería López
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    {[
                      { name: 'Tortitas', qty: 3 },
                      { name: 'Medialunas', qty: 2 },
                      { name: 'Alfajores', qty: 12 },
                    ].map((item, idx) => (
                      <div 
                        key={idx}
                        className="p-2.5 border flex items-center justify-between text-xs"
                        style={{
                          backgroundColor: 'var(--dl-surface)',
                          borderColor: 'var(--dl-border)',
                          borderRadius: 'var(--dl-radius-sm)'
                        }}
                      >
                        <span className="font-black" style={{ color: 'var(--dl-text)' }}>{item.name}</span>
                        <span className="font-mono font-black px-2 py-0.5 border rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border-subtle)', color: 'var(--dl-text)' }}>
                          {item.qty} un
                        </span>
                      </div>
                    ))}
                  </div>

                  <div 
                    className="p-2.5 border text-center text-xs font-black"
                    style={{
                      backgroundColor: 'var(--dl-surface-subtle)',
                      borderColor: 'var(--dl-border)',
                      color: 'var(--dl-text)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    8 productos · 42 unidades
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      className="h-10 flex items-center justify-center gap-1 text-xs font-bold border cursor-pointer"
                      style={{
                        backgroundColor: 'var(--dl-secondary)',
                        borderColor: 'var(--dl-border)',
                        color: 'var(--dl-text)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>GUARDAR</span>
                    </button>
                    <button
                      type="button"
                      className="h-10 flex items-center justify-center gap-1 text-xs font-black uppercase cursor-pointer"
                      style={{
                        backgroundColor: 'var(--dl-primary)',
                        color: 'var(--dl-primary-text)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      <span>COMPARTIR</span>
                    </button>
                  </div>
                </div>
              )}

              {/* VIEW 4: DASHBOARD */}
              {mobileTab === 'dashboard' && (
                <div className="space-y-2.5 animate-in fade-in duration-150">
                  <div 
                    className="p-3.5 border flex items-center justify-between"
                    style={{
                      backgroundColor: 'var(--dl-surface)',
                      borderColor: 'var(--dl-border)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--dl-text-muted)' }}>Ventas Hoy</span>
                      <p className="text-xl font-black font-mono" style={{ color: 'var(--dl-text)' }}>$125.400</p>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
                      +14%
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div 
                      className="p-3 border"
                      style={{
                        backgroundColor: 'var(--dl-surface)',
                        borderColor: 'var(--dl-border)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--dl-text-muted)' }}>Stock Bajo</span>
                      <p className="text-lg font-black font-mono" style={{ color: 'var(--dl-warning-text)' }}>12</p>
                    </div>
                    <div 
                      className="p-3 border"
                      style={{
                        backgroundColor: 'var(--dl-surface)',
                        borderColor: 'var(--dl-border)',
                        borderRadius: 'var(--dl-radius-sm)'
                      }}
                    >
                      <span className="text-[10px] font-bold uppercase block" style={{ color: 'var(--dl-text-muted)' }}>Recep. Pend.</span>
                      <p className="text-lg font-black font-mono" style={{ color: 'var(--dl-danger-text)' }}>2</p>
                    </div>
                  </div>
                </div>
              )}

              {/* VIEW 5: MENU */}
              {mobileTab === 'menu' && (
                <div className="space-y-2 animate-in fade-in duration-150">
                  <div 
                    className="p-3 flex items-center gap-2 border"
                    style={{
                      backgroundColor: 'var(--dl-surface-subtle)',
                      borderColor: 'var(--dl-border-subtle)',
                      borderRadius: 'var(--dl-radius-sm)'
                    }}
                  >
                    <div className="w-8 h-8 rounded-full bg-stone-300 flex items-center justify-center font-bold text-stone-700">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>Adrián Ríos</p>
                      <p className="text-[10px]" style={{ color: 'var(--dl-text-muted)' }}>Admin</p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {['Dashboard', 'Ventas / POS', 'Inventario', 'Recepción', 'Solicitud', 'Historial'].map((name, i) => (
                      <div 
                        key={i}
                        className="px-3 py-2.5 text-xs font-bold border flex items-center justify-between"
                        style={{
                          backgroundColor: i === 0 ? 'var(--dl-primary)' : 'var(--dl-surface)',
                          color: i === 0 ? 'var(--dl-primary-text)' : 'var(--dl-text)',
                          borderColor: 'var(--dl-border-subtle)',
                          borderRadius: 'var(--dl-radius-sm)'
                        }}
                      >
                        <span>{name}</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-60" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

            {/* Mobile Bottom Navigation Bar */}
            <div 
              className="h-14 px-4 border-t flex items-center justify-around shrink-0"
              style={{
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border)'
              }}
            >
              <button 
                type="button"
                onClick={() => setMobileTab('pos')}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
                style={{ color: mobileTab === 'pos' ? 'var(--dl-primary)' : 'var(--dl-text-muted)' }}
              >
                <ShoppingCart className="w-4 h-4" />
                <span className="text-[9px] font-bold">POS</span>
              </button>

              <button 
                type="button"
                onClick={() => setMobileTab('recepcion')}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
                style={{ color: mobileTab === 'recepcion' ? 'var(--dl-primary)' : 'var(--dl-text-muted)' }}
              >
                <Truck className="w-4 h-4" />
                <span className="text-[9px] font-bold">Recepción</span>
              </button>

              <button 
                type="button"
                onClick={() => setMobileTab('solicitud')}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
                style={{ color: mobileTab === 'solicitud' ? 'var(--dl-primary)' : 'var(--dl-text-muted)' }}
              >
                <ClipboardList className="w-4 h-4" />
                <span className="text-[9px] font-bold">Solicitud</span>
              </button>

              <button 
                type="button"
                onClick={() => setMobileTab('dashboard')}
                className="flex flex-col items-center gap-0.5 cursor-pointer"
                style={{ color: mobileTab === 'dashboard' ? 'var(--dl-primary)' : 'var(--dl-text-muted)' }}
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="text-[9px] font-bold">Inicio</span>
              </button>
            </div>

            {/* Home indicator bar */}
            <div className="h-4 flex items-center justify-center shrink-0">
              <div className="w-32 h-1 bg-stone-300 rounded-full" />
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};
