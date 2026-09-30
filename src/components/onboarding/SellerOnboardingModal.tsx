import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/authContext';
import { 
  updateSellerOnboarding, 
  setSellerOnboardingDismissed,
  CURRENT_SELLER_ONBOARDING_VERSION 
} from '../../lib/onboardingService';
import { 
  Calculator, 
  Search, 
  DollarSign, 
  Coins, 
  Truck, 
  ClipboardList, 
  ShoppingBag, 
  SlidersHorizontal,
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  CheckCircle2, 
  X, 
  Zap, 
  ShieldCheck, 
  Smartphone, 
  QrCode, 
  CreditCard,
  Tag,
  Camera,
  Store,
  HelpCircle,
  Clock,
  Package
} from 'lucide-react';
import { UwiLogo } from '../UwiLogo';
import {
  SceneSellerWelcome,
  SceneSellerPOS,
  SceneSellerCashShift,
  SceneSellerCatalog,
  SceneSellerLaunch
} from './SellerOnboardingScenes';

interface SellerOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'pos' | 'catalog' | 'receiving' | 'purchases' | 'adjustments' | 'replenishment' | 'daily-control') => void;
}

const TOTAL_STEPS = 5;

export const SellerOnboardingModal: React.FC<SellerOnboardingModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { userProfile, business } = useAuth();
  
  const [currentStep, setCurrentStep] = useState<number>(() => {
    return userProfile?.onboarding?.lastStep || 1;
  });

  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    return userProfile?.onboarding?.completedSteps || [];
  });

  const [isFinishing, setIsFinishing] = useState(false);

  // Keyboard navigation support
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss();
      } else if (e.key === 'ArrowRight' && currentStep < TOTAL_STEPS) {
        handleNext();
      } else if (e.key === 'ArrowLeft' && currentStep > 1) {
        handlePrev();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStep]);

  if (!isOpen) return null;

  const markStepDone = (stepKey: string, nextStepNum: number) => {
    const updated = completedSteps.includes(stepKey) ? completedSteps : [...completedSteps, stepKey];
    setCompletedSteps(updated);

    if (userProfile?.uid) {
      updateSellerOnboarding(userProfile.uid, {
        completed: false,
        version: CURRENT_SELLER_ONBOARDING_VERSION,
        lastStep: nextStepNum,
        completedSteps: updated,
      }).catch(console.warn);
    }
  };

  const handleNext = () => {
    const stepKey = `step_${currentStep}`;
    const nextStep = currentStep + 1;
    markStepDone(stepKey, nextStep);
    setCurrentStep(nextStep);
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleDismiss = () => {
    if (userProfile?.uid) {
      setSellerOnboardingDismissed(userProfile.uid, true);
    }
    onClose();
  };

  const handleFinish = async (targetTab: 'pos' | 'daily-control' | 'catalog' = 'pos') => {
    setIsFinishing(true);
    try {
      if (userProfile?.uid) {
        await updateSellerOnboarding(userProfile.uid, {
          completed: true,
          completedAt: new Date().toISOString(),
          version: CURRENT_SELLER_ONBOARDING_VERSION,
          lastStep: TOTAL_STEPS,
          completedSteps: ['step_1', 'step_2', 'step_3', 'step_4', 'step_5'],
          dismissed: false,
        });
      }
      onClose();
      if (onNavigateTab) {
        onNavigateTab(targetTab);
      }
    } catch (error) {
      console.warn('Error completing seller onboarding:', error);
      onClose();
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-xs overflow-y-auto animate-fade-in">
      <div 
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-stone-200 overflow-hidden flex flex-col my-auto transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header Bar */}
        <div className="px-5 sm:px-6 pt-5 pb-3 border-b border-stone-100 flex items-center justify-between bg-stone-50/70">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
              <UwiLogo size="sm" variant="static" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm sm:text-base font-extrabold text-stone-900 leading-tight">
                  Guía de Inicio del Vendedor
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                  Paso {currentStep} de {TOTAL_STEPS}
                </span>
              </div>
              <p className="text-[11px] text-stone-500 font-medium">
                {business?.name ? `Comercio: ${business.name}` : 'Uwi Punto de Venta'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 hover:bg-stone-200/60 transition-colors cursor-pointer"
            title="Cerrar guía por ahora"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="w-full bg-stone-100 h-1.5">
          <div 
            className="bg-gradient-to-r from-blue-600 to-indigo-600 h-1.5 transition-all duration-300"
            style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
          />
        </div>

        {/* Modal Body / Dynamic Step Content */}
        <div className="p-5 sm:p-7 space-y-4 max-h-[78vh] overflow-y-auto">
          
          {/* ========================================================= */}
          {/* PASO 1: BIENVENIDA & ROL                                  */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fade-in">
              <SceneSellerWelcome 
                businessName={business?.name || 'Comercio'} 
                sellerName={userProfile?.displayName || 'Vendedor'} 
              />

              <div className="text-center space-y-1">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-800 inline-block">
                  ¡Hola {userProfile?.displayName ? userProfile.displayName.split(' ')[0] : 'Vendedor'}! 👋
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  ¡Te damos la bienvenida al equipo!
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
                  Estás listo para operar en <strong className="text-stone-900">{business?.name || 'este comercio'}</strong>. Tu rol es clave para una atención ágil y una caja ordenada.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 space-y-1.5 hover:border-blue-300 transition-colors">
                  <div className="flex items-center space-x-2 text-blue-600">
                    <Zap className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Ventas Rápidas</h4>
                  </div>
                  <p className="text-xs text-stone-600">
                    Buscá productos al instante, escaneá códigos de barras con tu cámara o lector y cobrá en pocos segundos.
                  </p>
                </div>

                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-4 space-y-1.5 hover:border-emerald-300 transition-colors">
                  <div className="flex items-center space-x-2 text-emerald-600">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">Transparencia Total</h4>
                  </div>
                  <p className="text-xs text-stone-600">
                    Cada venta, cobro y movimiento que realizás queda asociado a tu turno para un arqueo de caja exacto y sin errores.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50/80 border border-blue-200/70 rounded-2xl p-3.5 flex items-start space-x-3 text-xs text-blue-900">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-blue-950">Acceso seguro con Google</p>
                  <p className="text-[11px] text-blue-800/90 mt-0.5">
                    Podés ingresar a Uwi desde cualquier dispositivo ingresando con tu cuenta de Google autorizada.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 2: POS & COBRO RÁPIDO                                */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fade-in">
              <SceneSellerPOS />

              <div className="text-center space-y-1">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 inline-block">
                  Punto de Venta
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  Vender y cobrar en segundos
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
                  El POS de Uwi está diseñado para que nunca hagas esperar a tus clientes en el mostrador.
                </p>
              </div>

              <div className="space-y-2.5 pt-1">
                <div className="flex items-start space-x-3 bg-stone-50 border border-stone-200/80 p-3 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Search className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-stone-900">Búsqueda rápida y código de barras</p>
                    <p className="text-stone-600 mt-0.5">
                      Escribí el nombre del producto o usá la cámara / lector para sumar artículos al carrito al instante.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 bg-stone-50 border border-stone-200/80 p-3 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                    <DollarSign className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-stone-900">Cálculo de vuelto automático</p>
                    <p className="text-stone-600 mt-0.5">
                      Ingresá el importe entregado por el cliente y el sistema te muestra en grande el vuelto exacto a entregar.
                    </p>
                  </div>
                </div>

                <div className="flex items-start space-x-3 bg-stone-50 border border-stone-200/80 p-3 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div className="text-xs">
                    <p className="font-bold text-stone-900">Múltiples formas de cobro</p>
                    <p className="text-stone-600 mt-0.5">
                      Cobrá en Efectivo, con Transferencia (mostrando Alias / CBU del negocio) o mediante Mercado Pago QR.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 3: APERTURA Y CONTROL DE CAJA                        */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fade-in">
              <SceneSellerCashShift />

              <div className="text-center space-y-1">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 inline-block">
                  Control de Turno
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  Tu Caja y Turno Operativo
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
                  Abrí tu turno al comenzar la jornada y cerralo con tranquilidad al terminar.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-emerald-700">
                    <Coins className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900">1. Fondo Inicial de Cambio</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Si tu caja lo requiere, ingresá el importe con el que arrancás el turno para dar vuelto a los primeros clientes.
                  </p>
                </div>

                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-1.5">
                  <div className="flex items-center space-x-2 text-blue-700">
                    <Clock className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900">2. Registro de Turno</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Cada venta se acumula automáticamente dividida por medio de pago (efectivo, transferencias, QR).
                  </p>
                </div>

                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-1.5 sm:col-span-2">
                  <div className="flex items-center space-x-2 text-indigo-700">
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900">3. Arqueo y Cierre Seguro</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Al terminar tu turno, ingresás el efectivo físico contado. Uwi compara el total esperado y emite un comprobante de cierre claro.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 4: CATÁLOGO Y HERRAMIENTAS ADICIONALES               */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fade-in">
              <SceneSellerCatalog />

              <div className="text-center space-y-1">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 inline-block">
                  Herramientas
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  Consulta de Stock y Módulos
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-lg mx-auto">
                  Herramientas complementarias para resolver las dudas de tus clientes en el momento.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center space-x-2 text-sky-700">
                    <Search className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900">Consulta de Precios</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Verificá precios actualizados y existencias de cualquier producto sin salir de tu panel.
                  </p>
                </div>

                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center space-x-2 text-indigo-700">
                    <Truck className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900">Recepción de Mercadería</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Si tenés permiso, podés controlar y confirmar los remitos de mercadería recibida de proveedores.
                  </p>
                </div>

                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center space-x-2 text-purple-700">
                    <ClipboardList className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900">Solicitudes de Reposición</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Avisá al administrador cuando un producto se esté terminando en góndola o mostrador.
                  </p>
                </div>

                <div className="bg-stone-50 border border-stone-200/80 rounded-2xl p-3.5 space-y-1">
                  <div className="flex items-center space-x-2 text-amber-700">
                    <ShoppingBag className="w-4 h-4 shrink-0" />
                    <h4 className="text-xs font-bold text-stone-900">Compras de Caja Chica</h4>
                  </div>
                  <p className="text-[11px] text-stone-600">
                    Registrá gastos o compras menores autorizadas directamente con fondos del turno.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PASO 5: LISTO PARA VENDER                                 */}
          {/* ========================================================= */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-fade-in">
              <SceneSellerLaunch />

              <div className="text-center space-y-1.5">
                <span className="px-3 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 inline-block">
                  ¡Todo Listo! 🚀
                </span>
                <h3 className="text-2xl sm:text-3xl font-black text-stone-900">
                  ¡Listo para tu primer turno!
                </h3>
                <p className="text-xs sm:text-sm text-stone-600 max-w-md mx-auto">
                  Ya conocés lo fundamental para operar en <strong className="text-stone-900">{business?.name || 'tu comercio'}</strong>. ¡Te deseamos una excelente jornada de ventas!
                </p>
              </div>

              {/* Pro tips recap box */}
              <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-4 space-y-2">
                <h4 className="text-xs font-extrabold text-emerald-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Consejos para una gran experiencia
                </h4>
                <ul className="text-xs text-emerald-900/90 space-y-1.5 list-disc pl-4">
                  <li>
                    <strong>Uso en celular o tablet:</strong> Uwi funciona en cualquier navegador móvil, podés escanear con la cámara trasera.
                  </li>
                  <li>
                    <strong>Atajos de teclado:</strong> Podés usar la tecla <kbd className="px-1.5 py-0.5 bg-white border border-emerald-300 rounded-md text-[10px] font-mono shadow-2xs font-bold">Enter</kbd> para cobrar rápidamente en el POS.
                  </li>
                  <li>
                    <strong>Revisar esta guía:</strong> Si querés volver a ver esta guía en cualquier momento, podés hacerlo desde el botón de ayuda en tu panel.
                  </li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer / Navigation Actions */}
        <div className="p-4 sm:p-5 border-t border-stone-100 bg-stone-50/60 flex items-center justify-between gap-2">
          {/* Left Action: Omitir or Back */}
          <div>
            {currentStep === 1 ? (
              <button
                type="button"
                onClick={handleDismiss}
                className="px-3 sm:px-4 py-2 text-stone-500 hover:text-stone-800 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Omitir recorrido
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePrev}
                className="px-3 sm:px-4 py-2 border border-stone-200 bg-white hover:bg-stone-100 text-stone-700 text-xs font-bold rounded-xl transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
            )}
          </div>

          {/* Dots Indicator */}
          <div className="hidden sm:flex items-center space-x-1.5">
            {[1, 2, 3, 4, 5].map((stepNum) => (
              <button
                key={stepNum}
                type="button"
                onClick={() => setCurrentStep(stepNum)}
                className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                  currentStep === stepNum
                    ? 'w-6 bg-blue-600'
                    : completedSteps.includes(`step_${stepNum}`)
                    ? 'bg-emerald-500'
                    : 'bg-stone-300 hover:bg-stone-400'
                }`}
                title={`Ir al paso ${stepNum}`}
              />
            ))}
          </div>

          {/* Right Action: Siguiente or Comenzar */}
          <div>
            {currentStep < TOTAL_STEPS ? (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 sm:px-5 py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white text-xs font-extrabold rounded-xl transition-all inline-flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                disabled={isFinishing}
                onClick={() => handleFinish('pos')}
                className="px-5 sm:px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white text-xs font-black rounded-xl transition-all inline-flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isFinishing ? 'Guardando...' : '¡Comenzar a Vender!'}</span>
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
