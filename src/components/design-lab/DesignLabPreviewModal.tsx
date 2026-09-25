import React, { useState } from 'react';
import { ThemeModel } from '../../types/theme';
import { getTokensCssProperties } from '../../lib/themeService';
import { 
  X, 
  Check, 
  Eye, 
  Sparkles, 
  ShoppingCart, 
  Package, 
  Truck, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowLeft,
  Plus,
  Minus,
  Search,
  Building2,
  DollarSign,
  TrendingUp,
  Receipt,
  Store,
  ShieldCheck,
  Send
} from 'lucide-react';

interface Props {
  theme: ThemeModel;
  isOpen: boolean;
  onClose: () => void;
  onApply: (theme: ThemeModel) => void;
}

export const DesignLabPreviewModal: React.FC<Props> = ({
  theme,
  isOpen,
  onClose,
  onApply
}) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'inventory' | 'receiving' | 'dashboard'>('pos');
  const [posQty1, setPosQty1] = useState(2);
  const [posQty2, setPosQty2] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mp' | 'combined'>('cash');
  const [cashAmount, setCashAmount] = useState(3000);

  if (!isOpen) return null;

  const total = posQty1 * 1500 + posQty2 * 1200;
  const mpAmount = total - cashAmount;
  const scopedStyles = getTokensCssProperties(theme.tokens);

  return (
    <div 
      className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-md flex flex-col items-center justify-start p-2 sm:p-4 md:p-6"
      id="modal-design-lab-preview"
    >
      {/* Container with scoped CSS variables */}
      <div 
        className="w-full max-w-6xl rounded-3xl overflow-hidden flex flex-col shadow-2xl border transition-all my-auto"
        style={{
          ...scopedStyles,
          backgroundColor: 'var(--mm-color-bg)',
          borderColor: 'var(--mm-color-border-strong)',
          color: 'var(--mm-color-text)'
        }}
      >
        {/* Sticky Preview Header Bar */}
        <div 
          className="px-6 py-4 flex flex-wrap items-center justify-between gap-4 border-b shadow-xs"
          style={{
            backgroundColor: 'var(--mm-color-surface)',
            borderColor: 'var(--mm-color-border)'
          }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center font-bold shadow-xs"
              style={{
                backgroundColor: 'var(--mm-color-primary-subtle)',
                color: 'var(--mm-color-primary)'
              }}
            >
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span 
                  className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                  style={{
                    backgroundColor: 'var(--mm-color-primary)',
                    color: 'var(--mm-color-primary-text)'
                  }}
                >
                  Vista Previa Temporal
                </span>
                <span className="text-xs font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>
                  v{theme.version}
                </span>
              </div>
              <h2 className="text-lg font-black tracking-tight" style={{ color: 'var(--mm-color-text)' }}>
                {theme.name}
              </h2>
            </div>
          </div>

          {/* Quick Tab Switcher inside simulation */}
          <div 
            className="flex items-center gap-1 p-1 rounded-xl border"
            style={{
              backgroundColor: 'var(--mm-color-surface-subtle)',
              borderColor: 'var(--mm-color-border)'
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('pos')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'pos' 
                  ? 'shadow-xs font-black' 
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={activeTab === 'pos' ? {
                backgroundColor: 'var(--mm-color-primary)',
                color: 'var(--mm-color-primary-text)'
              } : { color: 'var(--mm-color-text)' }}
            >
              Terminal POS
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'inventory' 
                  ? 'shadow-xs font-black' 
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={activeTab === 'inventory' ? {
                backgroundColor: 'var(--mm-color-primary)',
                color: 'var(--mm-color-primary-text)'
              } : { color: 'var(--mm-color-text)' }}
            >
              Inventario & Productos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('receiving')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'receiving' 
                  ? 'shadow-xs font-black' 
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={activeTab === 'receiving' ? {
                backgroundColor: 'var(--mm-color-primary)',
                color: 'var(--mm-color-primary-text)'
              } : { color: 'var(--mm-color-text)' }}
            >
              Recepciones & Pedidos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'dashboard' 
                  ? 'shadow-xs font-black' 
                  : 'opacity-70 hover:opacity-100'
              }`}
              style={activeTab === 'dashboard' ? {
                backgroundColor: 'var(--mm-color-primary)',
                color: 'var(--mm-color-primary-text)'
              } : { color: 'var(--mm-color-text)' }}
            >
              Dashboard Métricas
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              id="btn-close-preview"
              className="px-4 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer hover:opacity-80"
              style={{
                backgroundColor: 'var(--mm-color-surface)',
                borderColor: 'var(--mm-color-border)',
                color: 'var(--mm-color-text)'
              }}
            >
              Cerrar Vista Previa
            </button>
            <button
              type="button"
              onClick={() => onApply(theme)}
              id="btn-apply-from-preview"
              className="px-5 py-2 rounded-xl text-xs font-black shadow-md transition-all cursor-pointer flex items-center gap-1.5 hover:scale-[1.02]"
              style={{
                backgroundColor: 'var(--mm-color-primary)',
                color: 'var(--mm-color-primary-text)',
                borderRadius: 'var(--mm-radius-md)'
              }}
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Aplicar este tema ahora</span>
            </button>
          </div>
        </div>

        {/* Simulation Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* TAB 1: POS TERMINAL */}
          {activeTab === 'pos' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Product Catalog Grid (8 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <div 
                  className="p-4 rounded-2xl border flex items-center justify-between gap-4 shadow-xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)',
                    borderRadius: 'var(--mm-radius-lg)'
                  }}
                >
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--mm-color-text-muted)' }} />
                    <input 
                      type="text" 
                      placeholder="Buscar producto o escanear código..."
                      readOnly
                      value="Coca-Cola Zero 500ml"
                      className="w-full pl-9 pr-3 text-xs font-medium border rounded-xl"
                      style={{
                        height: 'var(--mm-input-height)',
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)',
                        color: 'var(--mm-color-text)'
                      }}
                    />
                  </div>
                  <span 
                    className="px-3 py-1 text-xs font-bold rounded-lg border"
                    style={{
                      backgroundColor: 'var(--mm-color-surface-subtle)',
                      borderColor: 'var(--mm-color-border)',
                      color: 'var(--mm-color-text-muted)'
                    }}
                  >
                    Bebidas (14)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div 
                    className="p-3 border rounded-2xl transition-all cursor-pointer hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--mm-color-surface)',
                      borderColor: 'var(--mm-color-border)',
                      borderRadius: 'var(--mm-radius-md)',
                      boxShadow: 'var(--mm-shadow-xs)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--mm-color-primary-subtle)', color: 'var(--mm-color-primary)' }}>
                        Stock: 24
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>#779123</span>
                    </div>
                    <p className="font-bold text-xs mt-2" style={{ color: 'var(--mm-color-text)' }}>Coca-Cola Zero 500ml</p>
                    <p className="text-base font-black mt-1" style={{ color: 'var(--mm-color-primary)' }}>$1.500</p>
                    <button 
                      type="button" 
                      onClick={() => setPosQty1(posQty1 + 1)}
                      className="w-full mt-2 py-1.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)',
                        color: 'var(--mm-color-text)'
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>

                  <div 
                    className="p-3 border rounded-2xl transition-all cursor-pointer hover:shadow-md"
                    style={{
                      backgroundColor: 'var(--mm-color-surface)',
                      borderColor: 'var(--mm-color-border)',
                      borderRadius: 'var(--mm-radius-md)',
                      boxShadow: 'var(--mm-shadow-xs)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--mm-color-primary-subtle)', color: 'var(--mm-color-primary)' }}>
                        Stock: 12
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>#779456</span>
                    </div>
                    <p className="font-bold text-xs mt-2" style={{ color: 'var(--mm-color-text)' }}>Alfajor Havanna 70%</p>
                    <p className="text-base font-black mt-1" style={{ color: 'var(--mm-color-primary)' }}>$1.200</p>
                    <button 
                      type="button" 
                      onClick={() => setPosQty2(posQty2 + 1)}
                      className="w-full mt-2 py-1.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)',
                        color: 'var(--mm-color-text)'
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>

                  <div 
                    className="p-3 border rounded-2xl transition-all opacity-80"
                    style={{
                      backgroundColor: 'var(--mm-color-surface)',
                      borderColor: 'var(--mm-color-border)',
                      borderRadius: 'var(--mm-radius-md)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--mm-color-warning-bg)', color: 'var(--mm-color-warning-text)' }}>
                        Stock: 3
                      </span>
                      <span className="text-[10px] font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>#779888</span>
                    </div>
                    <p className="font-bold text-xs mt-2" style={{ color: 'var(--mm-color-text)' }}>Papas Lays Clásicas</p>
                    <p className="text-base font-black mt-1" style={{ color: 'var(--mm-color-primary)' }}>$1.800</p>
                    <button 
                      type="button" 
                      className="w-full mt-2 py-1.5 text-xs font-bold rounded-xl border flex items-center justify-center gap-1 cursor-pointer"
                      style={{
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)',
                        color: 'var(--mm-color-text)'
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar
                    </button>
                  </div>
                </div>
              </div>

              {/* POS Cart Ticket (5 cols) */}
              <div 
                className="lg:col-span-5 p-5 border rounded-3xl flex flex-col justify-between shadow-md space-y-4"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)',
                  borderRadius: 'var(--mm-radius-lg)',
                  boxShadow: 'var(--mm-shadow-md)'
                }}
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" style={{ color: 'var(--mm-color-primary)' }} />
                      <h3 className="font-black text-sm" style={{ color: 'var(--mm-color-text)' }}>Ticket de Venta #1042</h3>
                    </div>
                    <span className="text-xs font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>Caja 01</span>
                  </div>

                  {/* Items List */}
                  <div className="divide-y py-2 space-y-2" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--mm-color-text)' }}>Coca-Cola Zero 500ml</p>
                        <p className="text-[11px]" style={{ color: 'var(--mm-color-text-muted)' }}>$1.500 c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setPosQty1(Math.max(1, posQty1 - 1))}
                          className="w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer"
                          style={{ borderColor: 'var(--mm-color-border)', backgroundColor: 'var(--mm-color-surface-subtle)' }}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{posQty1}</span>
                        <button 
                          onClick={() => setPosQty1(posQty1 + 1)}
                          className="w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer"
                          style={{ borderColor: 'var(--mm-color-border)', backgroundColor: 'var(--mm-color-surface-subtle)' }}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black ml-2" style={{ color: 'var(--mm-color-text)' }}>${posQty1 * 1500}</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <div>
                        <p className="text-xs font-bold" style={{ color: 'var(--mm-color-text)' }}>Alfajor Havanna 70%</p>
                        <p className="text-[11px]" style={{ color: 'var(--mm-color-text-muted)' }}>$1.200 c/u</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => setPosQty2(Math.max(0, posQty2 - 1))}
                          className="w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer"
                          style={{ borderColor: 'var(--mm-color-border)', backgroundColor: 'var(--mm-color-surface-subtle)' }}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold w-4 text-center">{posQty2}</span>
                        <button 
                          onClick={() => setPosQty2(posQty2 + 1)}
                          className="w-6 h-6 rounded-md border flex items-center justify-center cursor-pointer"
                          style={{ borderColor: 'var(--mm-color-border)', backgroundColor: 'var(--mm-color-surface-subtle)' }}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-black ml-2" style={{ color: 'var(--mm-color-text)' }}>${posQty2 * 1200}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Total & Payment Buttons */}
                <div className="space-y-3 pt-3 border-t" style={{ borderColor: 'var(--mm-color-border)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>Total a Pagar</span>
                    <span className="text-2xl font-black" style={{ color: 'var(--mm-color-primary)' }}>${total.toLocaleString('es-AR')}</span>
                  </div>

                  {/* Payment selector */}
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'cash' ? 'shadow-xs font-black' : ''
                      }`}
                      style={paymentMethod === 'cash' ? {
                        backgroundColor: 'var(--mm-color-primary)',
                        color: 'var(--mm-color-primary-text)',
                        borderColor: 'var(--mm-color-primary)'
                      } : {
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)',
                        color: 'var(--mm-color-text)'
                      }}
                    >
                      💵 Efectivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('mp')}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'mp' ? 'shadow-xs font-black' : ''
                      }`}
                      style={paymentMethod === 'mp' ? {
                        backgroundColor: 'var(--mm-color-primary)',
                        color: 'var(--mm-color-primary-text)',
                        borderColor: 'var(--mm-color-primary)'
                      } : {
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)',
                        color: 'var(--mm-color-text)'
                      }}
                    >
                      📱 Mercado Pago
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('combined')}
                      className={`py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        paymentMethod === 'combined' ? 'shadow-xs font-black' : ''
                      }`}
                      style={paymentMethod === 'combined' ? {
                        backgroundColor: 'var(--mm-color-primary)',
                        color: 'var(--mm-color-primary-text)',
                        borderColor: 'var(--mm-color-primary)'
                      } : {
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)',
                        color: 'var(--mm-color-text)'
                      }}
                    >
                      $ Combinado
                    </button>
                  </div>

                  {paymentMethod === 'combined' && (
                    <div 
                      className="p-3 rounded-xl border space-y-2 text-xs"
                      style={{
                        backgroundColor: 'var(--mm-color-surface-subtle)',
                        borderColor: 'var(--mm-color-border)'
                      }}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Efectivo:</span>
                        <span className="font-mono font-bold">${cashAmount.toLocaleString('es-AR')}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Mercado Pago QR:</span>
                        <span className="font-mono font-bold" style={{ color: 'var(--mm-color-primary)' }}>${mpAmount.toLocaleString('es-AR')}</span>
                      </div>
                    </div>
                  )}

                  <button
                    type="button"
                    className="w-full py-3 text-sm font-black rounded-2xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01]"
                    style={{
                      backgroundColor: 'var(--mm-color-primary)',
                      color: 'var(--mm-color-primary-text)',
                      borderRadius: 'var(--mm-radius-md)',
                      height: 'var(--mm-btn-height)'
                    }}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    <span>Cobrar ${total.toLocaleString('es-AR')}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: INVENTORY & PRODUCTS */}
          {activeTab === 'inventory' && (
            <div className="space-y-4">
              <div 
                className="p-4 rounded-2xl border flex items-center justify-between gap-4"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)',
                  borderRadius: 'var(--mm-radius-lg)'
                }}
              >
                <h3 className="font-black text-sm" style={{ color: 'var(--mm-color-text)' }}>
                  Catálogo de Productos (842 items)
                </h3>
                <button
                  type="button"
                  className="px-4 py-2 text-xs font-bold rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  style={{
                    backgroundColor: 'var(--mm-color-primary)',
                    color: 'var(--mm-color-primary-text)',
                    borderRadius: 'var(--mm-radius-sm)'
                  }}
                >
                  <Plus className="w-4 h-4" /> Nuevo Producto
                </button>
              </div>

              <div 
                className="border rounded-2xl overflow-hidden shadow-xs"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)',
                  borderRadius: 'var(--mm-radius-lg)'
                }}
              >
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderBottom: '1px solid var(--mm-color-border)' }}>
                      <th className="p-3 font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>CÓDIGO</th>
                      <th className="p-3 font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>PRODUCTO</th>
                      <th className="p-3 font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>RUBRO</th>
                      <th className="p-3 font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>PRECIO VENTA</th>
                      <th className="p-3 font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>COSTO</th>
                      <th className="p-3 font-bold" style={{ color: 'var(--mm-color-text-muted)' }}>STOCK</th>
                      <th className="p-3 font-bold text-right" style={{ color: 'var(--mm-color-text-muted)' }}>ESTADO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--mm-color-border-subtle)' }}>
                    <tr>
                      <td className="p-3 font-mono">77912345601</td>
                      <td className="p-3 font-bold" style={{ color: 'var(--mm-color-text)' }}>Coca-Cola Zero 500ml</td>
                      <td className="p-3">Bebidas</td>
                      <td className="p-3 font-bold" style={{ color: 'var(--mm-color-primary)' }}>$1.500</td>
                      <td className="p-3 font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>$920</td>
                      <td className="p-3 font-bold">48 un.</td>
                      <td className="p-3 text-right">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--mm-color-success-bg)', color: 'var(--mm-color-success-text)' }}>
                          En Stock
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono">77912345602</td>
                      <td className="p-3 font-bold" style={{ color: 'var(--mm-color-text)' }}>Alfajor Havanna 70% Cacao</td>
                      <td className="p-3">Golosinas</td>
                      <td className="p-3 font-bold" style={{ color: 'var(--mm-color-primary)' }}>$1.200</td>
                      <td className="p-3 font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>$750</td>
                      <td className="p-3 font-bold">12 un.</td>
                      <td className="p-3 text-right">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--mm-color-warning-bg)', color: 'var(--mm-color-warning-text)' }}>
                          Bajo Stock
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td className="p-3 font-mono">77912345603</td>
                      <td className="p-3 font-bold" style={{ color: 'var(--mm-color-text)' }}>Café Molido Cabrales 250g</td>
                      <td className="p-3">Almacén</td>
                      <td className="p-3 font-bold" style={{ color: 'var(--mm-color-primary)' }}>$3.800</td>
                      <td className="p-3 font-mono" style={{ color: 'var(--mm-color-text-muted)' }}>$2.400</td>
                      <td className="p-3 font-bold">0 un.</td>
                      <td className="p-3 text-right">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--mm-color-danger-bg)', color: 'var(--mm-color-danger-text)' }}>
                          Agotado
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: RECEIVING & ORDERS */}
          {activeTab === 'receiving' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className="p-5 border rounded-2xl space-y-3"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)',
                  borderRadius: 'var(--mm-radius-lg)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Recepción #REC-2026-089
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--mm-color-info-bg)', color: 'var(--mm-color-info-text)' }}>
                    En Control
                  </span>
                </div>
                <h4 className="font-bold text-sm" style={{ color: 'var(--mm-color-text)' }}>
                  Proveedor: Distribuidora Los Andes S.A.
                </h4>
                <div className="p-3 rounded-xl border space-y-1 text-xs" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                  <div className="flex justify-between">
                    <span>Items Esperados:</span>
                    <span className="font-bold">24 bultos</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Controlados:</span>
                    <span className="font-bold" style={{ color: 'var(--mm-color-success)' }}>24 bultos (100%)</span>
                  </div>
                </div>
                <button 
                  type="button"
                  className="w-full py-2 text-xs font-bold rounded-xl cursor-pointer"
                  style={{
                    backgroundColor: 'var(--mm-color-primary)',
                    color: 'var(--mm-color-primary-text)',
                    borderRadius: 'var(--mm-radius-sm)'
                  }}
                >
                  Confirmar e Ingresar a Stock
                </button>
              </div>

              <div 
                className="p-5 border rounded-2xl space-y-3"
                style={{
                  backgroundColor: 'var(--mm-color-surface)',
                  borderColor: 'var(--mm-color-border)',
                  borderRadius: 'var(--mm-radius-lg)'
                }}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Solicitud #SOL-2026-041
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: 'var(--mm-color-warning-bg)', color: 'var(--mm-color-warning-text)' }}>
                    Pendiente Aprobación
                  </span>
                </div>
                <h4 className="font-bold text-sm" style={{ color: 'var(--mm-color-text)' }}>
                  Proveedor: Lácteos La Serenísima
                </h4>
                <div className="p-3 rounded-xl border space-y-1 text-xs" style={{ backgroundColor: 'var(--mm-color-surface-subtle)', borderColor: 'var(--mm-color-border)' }}>
                  <div className="flex justify-between">
                    <span>Total Estimado:</span>
                    <span className="font-bold font-mono">$184.500</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Generado por:</span>
                    <span className="font-bold">Cajero Turno Mañana</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    type="button"
                    className="py-2 text-xs font-bold rounded-xl cursor-pointer border"
                    style={{
                      backgroundColor: 'var(--mm-color-surface-subtle)',
                      borderColor: 'var(--mm-color-border)',
                      color: 'var(--mm-color-text)'
                    }}
                  >
                    Revisar Detalles
                  </button>
                  <button 
                    type="button"
                    className="py-2 text-xs font-bold rounded-xl cursor-pointer"
                    style={{
                      backgroundColor: 'var(--mm-color-primary)',
                      color: 'var(--mm-color-primary-text)',
                      borderRadius: 'var(--mm-radius-sm)'
                    }}
                  >
                    Aprobar Solicitud
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DASHBOARD METRICS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div 
                  className="p-5 border rounded-2xl space-y-1 shadow-2xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)',
                    borderRadius: 'var(--mm-radius-lg)'
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Ventas del Día
                  </p>
                  <p className="text-2xl font-black" style={{ color: 'var(--mm-color-primary)' }}>
                    $482.900
                  </p>
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--mm-color-success)' }}>
                    +18.4% vs ayer
                  </p>
                </div>

                <div 
                  className="p-5 border rounded-2xl space-y-1 shadow-2xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)',
                    borderRadius: 'var(--mm-radius-lg)'
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Tickets Emitidos
                  </p>
                  <p className="text-2xl font-black" style={{ color: 'var(--mm-color-text)' }}>
                    142
                  </p>
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Promedio $3.400 / ticket
                  </p>
                </div>

                <div 
                  className="p-5 border rounded-2xl space-y-1 shadow-2xs"
                  style={{
                    backgroundColor: 'var(--mm-color-surface)',
                    borderColor: 'var(--mm-color-border)',
                    borderRadius: 'var(--mm-radius-lg)'
                  }}
                >
                  <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--mm-color-text-muted)' }}>
                    Efectivo en Caja
                  </p>
                  <p className="text-2xl font-black" style={{ color: 'var(--mm-color-text)' }}>
                    $195.400
                  </p>
                  <p className="text-[11px] font-semibold" style={{ color: 'var(--mm-color-info)' }}>
                    Mercado Pago: $287.500
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div 
          className="px-6 py-4 flex items-center justify-between border-t text-xs"
          style={{
            backgroundColor: 'var(--mm-color-surface)',
            borderColor: 'var(--mm-color-border)',
            color: 'var(--mm-color-text-muted)'
          }}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: 'var(--mm-color-primary)' }} />
            <span>Los cambios no se aplican a los usuarios finales hasta que presiones <strong>"Aplicar este tema ahora"</strong>.</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="font-bold underline cursor-pointer hover:opacity-80"
            style={{ color: 'var(--mm-color-text)' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
