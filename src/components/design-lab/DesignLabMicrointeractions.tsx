import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  Plus, 
  Minus, 
  Check, 
  Loader2, 
  Bell, 
  X, 
  Smartphone, 
  Layers, 
  Eye, 
  EyeOff, 
  ArrowRight,
  Sparkles,
  ShoppingBag,
  Clock,
  ShieldCheck,
  Menu,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

interface Props {
  reducedMotion: boolean;
  onToggleReducedMotion: () => void;
}

export const DesignLabMicrointeractions: React.FC<Props> = ({ reducedMotion, onToggleReducedMotion }) => {
  // 1. Agregar Producto Demo State
  const [cartItems, setCartItems] = useState([
    { id: '1', name: 'Tortitas mendocinas', qty: 2, justAdded: false },
    { id: '2', name: 'Medialunas de manteca', qty: 1, justAdded: false }
  ]);
  const [isAddingItem, setIsAddingItem] = useState(false);

  const handleAddProductDemo = () => {
    setIsAddingItem(true);
    const newItemId = String(Date.now());
    const newItem = { id: newItemId, name: 'Alfajor chocolate negro', qty: 1, justAdded: true };
    setCartItems(prev => [newItem, ...prev]);

    setTimeout(() => {
      setCartItems(prev => prev.map(item => item.id === newItemId ? { ...item, justAdded: false } : item));
      setIsAddingItem(false);
    }, 250);
  };

  // 2. Cambio de Cantidad Demo State
  const [stepperVal, setStepperVal] = useState(3);
  const [stepperAnimKey, setStepperAnimKey] = useState(0);

  const handleStepperChange = (delta: number) => {
    setStepperVal(prev => Math.max(1, prev + delta));
    setStepperAnimKey(prev => prev + 1);
  };

  // 3. Confirmación Demo State
  const [confirmStatus, setConfirmStatus] = useState<'idle' | 'processing' | 'confirmed'>('idle');

  const handleConfirmDemo = () => {
    if (confirmStatus !== 'idle') return;
    setConfirmStatus('processing');
    setTimeout(() => {
      setConfirmStatus('confirmed');
      setTimeout(() => setConfirmStatus('idle'), 2000);
    }, 350);
  };

  // 4. Guardado con Prevención de Doble Clic Demo State
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSaveDemo = () => {
    if (saveStatus !== 'idle') return;
    setSaveStatus('saving');
    setTimeout(() => {
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2200);
    }, 600);
  };

  // 5. Toast Notification Demo State
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('Stock actualizado correctamente');

  const handleTriggerToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
  };

  useEffect(() => {
    if (toastVisible) {
      const timer = setTimeout(() => setToastVisible(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastVisible]);

  // 6. Cambio de Tabs Demo State
  const [activeTab, setActiveTab] = useState<'sugerencias' | 'borrador' | 'historial'>('sugerencias');

  // 7. Menú Mobile Drawer Demo State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // 8. Modales Demo State
  const [isModalOpen, setIsModalOpen] = useState(false);

  // 9. Loading States Demo
  const [loadingMode, setLoadingMode] = useState<'content' | 'skeleton' | 'spinner'>('content');

  // 10. Estados Demo
  const [productState, setProductState] = useState<'normal' | 'low' | 'critical'>('normal');

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
      {/* Header & Reduced Motion Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-6 border-b" style={{ borderColor: 'var(--dl-border-subtle)' }}>
        <div>
          <h3 className="text-base font-black flex items-center gap-2" style={{ color: 'var(--dl-text)' }}>
            <Zap className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span>16. Microinteracciones y Animaciones Operativas</span>
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--dl-text-muted)' }}>
            Principio rector: <strong className="text-stone-800 font-black">"Feedback, no decoración"</strong>. Transiciones inmediatas (150–250 ms), respuesta háptica visual y respeto a accesibilidad.
          </p>
        </div>

        {/* Accessibility reduced-motion toggle */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleReducedMotion}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl border flex items-center gap-1.5 cursor-pointer transition-colors ${
              reducedMotion 
                ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-xs' 
                : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
            }`}
          >
            {reducedMotion ? <EyeOff className="w-3.5 h-3.5 text-amber-700" /> : <Eye className="w-3.5 h-3.5 text-stone-500" />}
            <span>prefers-reduced-motion: <strong>{reducedMotion ? 'ACTIVADO' : 'DESACTIVADO'}</strong></span>
          </button>
        </div>
      </div>

      {/* Grid of Microinteractions Demonstrators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        
        {/* 1. AGREGAR PRODUCTO */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                1. Agregar Producto
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                150–250 ms
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Feedback visual de destaque temporal y actualización suave al añadir al pedido.
            </p>

            {/* List preview */}
            <div className="space-y-1.5 pt-1">
              {cartItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className={`p-2 border flex items-center justify-between text-xs transition-all ${
                    item.justAdded ? 'dl-anim-flash' : ''
                  }`}
                  style={{
                    backgroundColor: item.justAdded ? 'var(--dl-primary-subtle)' : 'var(--dl-surface)',
                    borderColor: item.justAdded ? 'var(--dl-primary)' : 'var(--dl-border-subtle)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <span className="font-bold truncate" style={{ color: 'var(--dl-text)' }}>{item.name}</span>
                  <span className="font-mono font-black shrink-0 px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--dl-surface-subtle)', color: 'var(--dl-primary)' }}>
                    x{item.qty}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAddProductDemo}
            className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wide cursor-pointer transition-all border shadow-xs"
            style={{
              backgroundColor: 'var(--dl-primary)',
              color: 'var(--dl-primary-text)',
              borderColor: 'var(--dl-primary)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>+ Agregar Producto</span>
          </button>
        </div>

        {/* 2. CAMBIO DE CANTIDAD */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                2. Cambio de Cantidad
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                180 ms Pop
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Transición micro sobre el número al presionar [ − ] o [ + ] sin animación invasiva.
            </p>

            <div className="p-3 border flex items-center justify-between" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border-subtle)', borderRadius: 'var(--dl-radius-sm)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--dl-text)' }}>Tortitas (unidades)</span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleStepperChange(-1)}
                  className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer select-none active:scale-95 transition-transform"
                  style={{ backgroundColor: 'var(--dl-surface)', borderColor: 'var(--dl-border)', color: 'var(--dl-text)', borderRadius: 'var(--dl-radius-sm)' }}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>

                <span 
                  key={stepperAnimKey}
                  className="w-8 text-center text-sm font-mono font-black dl-anim-num-pop"
                  style={{ color: 'var(--dl-text)' }}
                >
                  {stepperVal}
                </span>

                <button
                  type="button"
                  onClick={() => handleStepperChange(1)}
                  className="w-8 h-8 flex items-center justify-center font-bold border cursor-pointer select-none active:scale-95 transition-transform"
                  style={{ backgroundColor: 'var(--dl-surface)', borderColor: 'var(--dl-border)', color: 'var(--dl-text)', borderRadius: 'var(--dl-radius-sm)' }}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-center font-mono" style={{ color: 'var(--dl-text-muted)' }}>
            Transformación por aceleración GPU (sin repintado de layout)
          </p>
        </div>

        {/* 3. CONFIRMACIÓN OPERATIVA */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                3. Confirmación Inmediata
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Feedback instantáneo
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Feedback visual claro tras confirmar Venta, Recepción o Solicitud.
            </p>

            <div className="p-3 border text-center" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border-subtle)', borderRadius: 'var(--dl-radius-sm)' }}>
              <span className="text-[11px] font-mono block" style={{ color: 'var(--dl-text-muted)' }}>
                Estado actual:
              </span>
              <span className="text-xs font-black" style={{ color: confirmStatus === 'confirmed' ? 'var(--dl-success-text)' : 'var(--dl-text)' }}>
                {confirmStatus === 'idle' && 'En espera de confirmación'}
                {confirmStatus === 'processing' && 'Validando stock...'}
                {confirmStatus === 'confirmed' && '✓ ¡OPERACIÓN CONFIRMADA!'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleConfirmDemo}
            disabled={confirmStatus !== 'idle'}
            className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wide cursor-pointer transition-all border shadow-xs"
            style={{
              backgroundColor: confirmStatus === 'confirmed' ? 'var(--dl-success-bg)' : 'var(--dl-primary)',
              color: confirmStatus === 'confirmed' ? 'var(--dl-success-text)' : 'var(--dl-primary-text)',
              borderColor: confirmStatus === 'confirmed' ? 'var(--dl-success-border)' : 'var(--dl-primary)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            {confirmStatus === 'idle' && (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Confirmar Venta ($4.200)</span>
              </>
            )}
            {confirmStatus === 'processing' && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Procesando...</span>
              </>
            )}
            {confirmStatus === 'confirmed' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>✓ Confirmado</span>
              </>
            )}
          </button>
        </div>

        {/* 4. GUARDADO CON PREVENCIÓN DE DOBLE CLIC */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                4. Guardado y Anti-Doble Clic
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                Guardando → Guardado
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              El botón bloquea clics secundarios accidentales mientras se procesa la solicitud.
            </p>

            <div className="p-3 border text-center" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border-subtle)', borderRadius: 'var(--dl-radius-sm)' }}>
              <span className="text-[11px] font-mono block" style={{ color: 'var(--dl-text-muted)' }}>
                Protección de idempotencia:
              </span>
              <span className="text-xs font-mono font-bold" style={{ color: 'var(--dl-text)' }}>
                {saveStatus === 'saving' ? '🔒 Botón bloqueado' : '🔓 Listo para interactuar'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveDemo}
            disabled={saveStatus !== 'idle'}
            className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-black uppercase tracking-wide cursor-pointer transition-all border shadow-xs disabled:cursor-not-allowed"
            style={{
              backgroundColor: saveStatus === 'saved' ? 'var(--dl-success-bg)' : 'var(--dl-secondary)',
              color: saveStatus === 'saved' ? 'var(--dl-success-text)' : 'var(--dl-text)',
              borderColor: saveStatus === 'saved' ? 'var(--dl-success-border)' : 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            {saveStatus === 'idle' && (
              <>
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>Guardar Solicitud</span>
              </>
            )}
            {saveStatus === 'saving' && (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-stone-600" />
                <span>Guardando...</span>
              </>
            )}
            {saveStatus === 'saved' && (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                <span>✓ Guardado</span>
              </>
            )}
          </button>
        </div>

        {/* 5. TOAST NOTIFICACIONES */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                5. Toasts No Invasivos
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200">
                Fade + Slide 220ms
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Aparición suave, permanencia de 3 segundos y cierre sin saltos visuales.
            </p>

            {/* Toast inline container */}
            <div className="h-14 flex items-center justify-center">
              {toastVisible ? (
                <div 
                  className="w-full p-2.5 border flex items-center justify-between gap-2 shadow-sm dl-anim-toast"
                  style={{
                    backgroundColor: 'var(--dl-surface)',
                    borderColor: 'var(--dl-primary)',
                    borderRadius: 'var(--dl-radius-sm)'
                  }}
                >
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="font-bold truncate" style={{ color: 'var(--dl-text)' }}>{toastMessage}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToastVisible(false)}
                    className="p-1 opacity-60 hover:opacity-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <span className="text-xs font-mono" style={{ color: 'var(--dl-text-muted)' }}>
                  (Toast inactivo)
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleTriggerToast('Recepción #0042 guardada en stock')}
            className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all border shadow-xs"
            style={{
              backgroundColor: 'var(--dl-surface-subtle)',
              borderColor: 'var(--dl-border)',
              color: 'var(--dl-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Disparar Toast Demo</span>
          </button>
        </div>

        {/* 6. CAMBIO DE TABS */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                6. Transición de Tabs
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                150–200 ms
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Cambio sutil y suave entre vistas sin recarga ni parpadeo.
            </p>

            {/* Tabs Bar */}
            <div className="flex items-center p-1 border rounded-lg" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border)' }}>
              {(['sugerencias', 'borrador', 'historial'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 py-1 text-[11px] font-bold rounded cursor-pointer capitalize transition-all ${
                    activeTab === tab 
                      ? 'bg-stone-900 text-white shadow-xs' 
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content with fade anim */}
            <div 
              key={activeTab}
              className="p-2.5 border text-center text-xs dl-anim-fade"
              style={{
                backgroundColor: 'var(--dl-surface)',
                borderColor: 'var(--dl-border-subtle)',
                borderRadius: 'var(--dl-radius-sm)',
                color: 'var(--dl-text)'
              }}
            >
              {activeTab === 'sugerencias' && '💡 3 productos con stock bajo sugeridos para compra.'}
              {activeTab === 'borrador' && '📝 Borrador actual con 8 productos y 42 unidades.'}
              {activeTab === 'historial' && '📦 14 solicitudes confirmadas en los últimos 30 días.'}
            </div>
          </div>

          <p className="text-[10px] text-center font-mono" style={{ color: 'var(--dl-text-muted)' }}>
            Transición en 180 ms con cubic-bezier suave
          </p>
        </div>

        {/* 7. MENÚ MOBILE DRAWER */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                7. Menú Mobile Drawer
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                200 ms Inmediato
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Apertura lateral suave sin lentitud para operación ágil en mostrador.
            </p>

            {/* Drawer Mockup Container */}
            <div className="h-20 border rounded relative overflow-hidden flex items-center justify-center" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border)' }}>
              {isDrawerOpen ? (
                <div className="absolute inset-0 bg-black/30 z-10 flex">
                  <div 
                    className="w-3/4 h-full p-2.5 bg-stone-900 text-white dl-anim-drawer flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex justify-between items-center pb-1 border-b border-stone-800">
                        <span className="text-[10px] font-bold text-stone-400">MiniMarket</span>
                        <button type="button" onClick={() => setIsDrawerOpen(false)} className="text-stone-400 hover:text-white">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <div className="pt-1 space-y-0.5 text-[10px] font-bold text-stone-300">
                        <div>• POS / Caja</div>
                        <div>• Recepción</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-xs font-mono" style={{ color: 'var(--dl-text-muted)' }}>
                  Menú colapsado
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsDrawerOpen(!isDrawerOpen)}
            className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all border shadow-xs"
            style={{
              backgroundColor: 'var(--dl-secondary)',
              borderColor: 'var(--dl-border)',
              color: 'var(--dl-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Menu className="w-3.5 h-3.5" />
            <span>{isDrawerOpen ? 'Cerrar Menú' : 'Abrir Menú Drawer'}</span>
          </button>
        </div>

        {/* 8. MODAL CON ENTRADA SUAVE */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                8. Modales (Fade + Scale)
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-bold border border-blue-200">
                Scale 0.96 → 1.0
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Entrada suave con fade y escala contenida sin efectos de zoom desmedidos.
            </p>

            <div className="h-20 border rounded flex items-center justify-center p-2 text-center" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border)' }}>
              <span className="text-xs font-mono" style={{ color: 'var(--dl-text-muted)' }}>
                {isModalOpen ? 'Modal interactivo activo' : 'Presioná para probar la animación'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="w-full h-9 flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all border shadow-xs"
            style={{
              backgroundColor: 'var(--dl-secondary)',
              borderColor: 'var(--dl-border)',
              color: 'var(--dl-text)',
              borderRadius: 'var(--dl-radius-sm)'
            }}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Abrir Modal de Prueba</span>
          </button>
        </div>

        {/* 9. LOADING / SKELETON STATES */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                9. Indicadores de Carga
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-50 text-purple-700 font-bold border border-purple-200">
                Skeleton & Spinner
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Evita pantallas congeladas proporcionando feedback visual de progreso.
            </p>

            {/* Mode Preview */}
            <div className="h-16 border rounded p-2.5 flex items-center" style={{ backgroundColor: 'var(--dl-surface)', borderColor: 'var(--dl-border)' }}>
              {loadingMode === 'content' && (
                <div className="w-full flex justify-between items-center text-xs">
                  <span className="font-bold" style={{ color: 'var(--dl-text)' }}>Tortitas mendocinas</span>
                  <span className="font-mono font-black" style={{ color: 'var(--dl-primary)' }}>$1.500</span>
                </div>
              )}
              {loadingMode === 'skeleton' && (
                <div className="w-full space-y-2">
                  <div className="h-3 w-3/4 rounded dl-skeleton" />
                  <div className="h-2.5 w-1/2 rounded dl-skeleton" />
                </div>
              )}
              {loadingMode === 'spinner' && (
                <div className="w-full flex items-center justify-center gap-2 text-xs font-bold" style={{ color: 'var(--dl-text-muted)' }}>
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  <span>Sincronizando inventario...</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLoadingMode('content')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded cursor-pointer border ${loadingMode === 'content' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'}`}
            >
              Datos
            </button>
            <button
              type="button"
              onClick={() => setLoadingMode('skeleton')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded cursor-pointer border ${loadingMode === 'skeleton' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'}`}
            >
              Skeleton
            </button>
            <button
              type="button"
              onClick={() => setLoadingMode('spinner')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded cursor-pointer border ${loadingMode === 'spinner' ? 'bg-stone-900 text-white' : 'bg-white text-stone-600'}`}
            >
              Spinner
            </button>
          </div>
        </div>

        {/* 10. TRANSICIÓN DE ESTADOS */}
        <div 
          className="p-4 border space-y-3 flex flex-col justify-between"
          style={{
            backgroundColor: 'var(--dl-surface)',
            borderColor: 'var(--dl-border)',
            borderRadius: 'var(--dl-radius-md)'
          }}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black" style={{ color: 'var(--dl-text)' }}>
                10. Transición de Estados
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                Smooth Badge
              </span>
            </div>
            <p className="text-[11px]" style={{ color: 'var(--dl-text-muted)' }}>
              Transición suave sin parpadeo cuando un producto cambia su condición de stock.
            </p>

            <div className="p-3 border flex items-center justify-between" style={{ backgroundColor: 'var(--dl-surface-subtle)', borderColor: 'var(--dl-border-subtle)', borderRadius: 'var(--dl-radius-sm)' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--dl-text)' }}>Medialunas</span>

              <span 
                className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 border transition-all duration-200"
                style={{
                  backgroundColor: productState === 'normal' ? 'var(--dl-success-bg)' : productState === 'low' ? 'var(--dl-warning-bg)' : 'var(--dl-danger-bg)',
                  borderColor: productState === 'normal' ? 'var(--dl-success-border)' : productState === 'low' ? 'var(--dl-warning-border)' : 'var(--dl-danger-border)',
                  color: productState === 'normal' ? 'var(--dl-success-text)' : productState === 'low' ? 'var(--dl-warning-text)' : 'var(--dl-danger-text)',
                  borderRadius: 'var(--dl-radius-full)'
                }}
              >
                {productState === 'normal' && '✓ Stock Normal'}
                {productState === 'low' && '⚠ Stock Bajo (5 un)'}
                {productState === 'critical' && '⛔ Stock Crítico (1 un)'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setProductState('normal')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded cursor-pointer border ${productState === 'normal' ? 'bg-emerald-700 text-white' : 'bg-white text-stone-600'}`}
            >
              Normal
            </button>
            <button
              type="button"
              onClick={() => setProductState('low')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded cursor-pointer border ${productState === 'low' ? 'bg-amber-700 text-white' : 'bg-white text-stone-600'}`}
            >
              Bajo
            </button>
            <button
              type="button"
              onClick={() => setProductState('critical')}
              className={`flex-1 py-1.5 text-[10px] font-bold rounded cursor-pointer border ${productState === 'critical' ? 'bg-red-700 text-white' : 'bg-white text-stone-600'}`}
            >
              Crítico
            </button>
          </div>
        </div>

      </div>

      {/* Embedded Live Modal Dialog for Demo 8 */}
      {isModalOpen && (
        <div 
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 dl-anim-fade"
          onClick={() => setIsModalOpen(false)}
        >
          <div 
            className="w-full max-w-sm border p-5 space-y-4 shadow-xl dl-anim-modal"
            style={{
              backgroundColor: 'var(--dl-surface)',
              borderColor: 'var(--dl-border)',
              borderRadius: 'var(--dl-radius-md)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b pb-2.5" style={{ borderColor: 'var(--dl-border-subtle)' }}>
              <h4 className="text-sm font-black" style={{ color: 'var(--dl-text)' }}>
                Demostración de Entrada Modal
              </h4>
              <button type="button" onClick={() => setIsModalOpen(false)} className="p-1 text-stone-400 hover:text-stone-700 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--dl-text)' }}>
              Esta ventana utiliza una escala contenida (0.96 → 1.0) y un fade sutil en 200 ms, cumpliendo los principios de velocidad operativa.
            </p>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold border cursor-pointer"
                style={{
                  backgroundColor: 'var(--dl-secondary)',
                  borderColor: 'var(--dl-border)',
                  color: 'var(--dl-text)',
                  borderRadius: 'var(--dl-radius-sm)'
                }}
              >
                Cerrar (Salida Rápida)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
