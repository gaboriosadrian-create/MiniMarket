import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/authContext';
import { Business, BusinessCommercialData, UserProfile } from '../../types';
import { 
  updateBusinessCommercialData, 
  updateBusinessOnboarding,
  createSellerForBusiness 
} from '../../lib/businessService';
import { 
  STARTER_KITS, 
  applyStarterKit, 
  setupInitialCashShift 
} from '../../lib/onboardingService';
import { createProduct } from '../../lib/productService';
import { getOrCreateDefaultCashRegister } from '../../lib/cashCoreService';
import { 
  Building2, 
  Store, 
  Package, 
  Coins, 
  CreditCard, 
  Users, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft, 
  Sparkles, 
  X, 
  Plus, 
  Check, 
  AlertCircle,
  HelpCircle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Zap,
  ShoppingBag,
  DollarSign,
  Smartphone,
  QrCode,
  Info
} from 'lucide-react';
import { UwiLogo } from '../UwiLogo';
import {
  SceneIdentity,
  SceneProducts,
  SceneCash,
  ScenePayments,
  SceneTeam,
  SceneLaunch,
} from './OnboardingScenes';

interface OnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTab?: (tab: 'pos' | 'control' | 'business' | 'products' | 'cash-control' | 'sellers') => void;
}

const BUSINESS_TYPES = [
  'Minimarket',
  'Kiosco',
  'Almacén',
  'Despensa',
  'Librería',
  'Cafetería',
  'Fiambrería',
  'Carnicería',
  'Verdulería',
  'Otro',
];

const INITIAL_FLOATS = [0, 5000, 10000, 20000, 50000];

export const OnboardingModal: React.FC<OnboardingModalProps> = ({
  isOpen,
  onClose,
  onNavigateTab,
}) => {
  const { business, userProfile } = useAuth();
  
  // Steps: 1: Identity, 2: Catalog, 3: Cash, 4: Payments, 5: Sellers, 6: Success
  const [currentStep, setCurrentStep] = useState<number>(() => {
    return business?.onboarding?.lastStep || 1;
  });

  const [completedSteps, setCompletedSteps] = useState<string[]>(() => {
    return business?.onboarding?.completedSteps || [];
  });

  // Step 1: Commercial Data
  const [bizName, setBizName] = useState(business?.name || '');
  const [bizType, setBizType] = useState(business?.businessType || 'Minimarket');
  const [bizAddress, setBizAddress] = useState(business?.address || '');
  const [bizPhone, setBizPhone] = useState(business?.phone || '');

  // Step 2: Catalog mode: 'none' | 'starter-kit' | 'custom'
  const [catalogChoice, setCatalogChoice] = useState<'starter' | 'custom' | 'skip'>('starter');
  const [selectedKit, setSelectedKit] = useState<string>('kiosco');
  const [isKitApplied, setIsKitApplied] = useState(false);
  
  // Custom single product state
  const [customProdName, setCustomProdName] = useState('');
  const [customProdCategory, setCustomProdCategory] = useState('General');
  const [customProdBarcode, setCustomProdBarcode] = useState('');
  const [customProdCost, setCustomProdCost] = useState<string>('');
  const [customProdPrice, setCustomProdPrice] = useState<string>('');
  const [customProdStock, setCustomProdStock] = useState<string>('10');
  const [customProdCreated, setCustomProdCreated] = useState<string[]>([]);

  // Step 3: Cash shift opening
  const [openCashNow, setOpenCashNow] = useState(true);
  const [selectedFloat, setSelectedFloat] = useState<number>(10000);
  const [customFloat, setCustomFloat] = useState<string>('');
  const [cashRegisterName, setCashRegisterName] = useState('Caja Principal');
  const [cashInitialized, setCashInitialized] = useState(false);

  // Step 4: Payments
  const [transferAlias, setTransferAlias] = useState('');
  const [transferCbu, setTransferCbu] = useState('');
  const [transferBank, setTransferBank] = useState('');
  const [transferHolder, setTransferHolder] = useState('');

  // Step 5: Team mode
  const [teamMode, setTeamMode] = useState<'solo' | 'seller'>('solo');
  const [sellerName, setSellerName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [sellerPhone, setSellerPhone] = useState('');
  const [sellerCreated, setSellerCreated] = useState(false);

  // UI status
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    if (business) {
      if (!bizName) setBizName(business.name || '');
      if (!bizAddress) setBizAddress(business.address || '');
      if (!bizPhone) setBizPhone(business.phone || '');
      if (business.businessType) setBizType(business.businessType);
    }
  }, [business]);

  if (!isOpen) return null;

  const markStepComplete = (stepKey: string) => {
    if (!completedSteps.includes(stepKey)) {
      const updated = [...completedSteps, stepKey];
      setCompletedSteps(updated);
      if (business?.id) {
        updateBusinessOnboarding(business.id, {
          completedSteps: updated,
          lastStep: currentStep + 1,
        }).catch(console.warn);
      }
    }
  };

  // -------------------------------------------------------------
  // Step 1: Save Business Identity
  // -------------------------------------------------------------
  const handleSaveIdentity = async () => {
    if (!business?.id) return;
    if (!bizName.trim()) {
      setFeedback({ type: 'error', message: 'Por favor ingresá el nombre de tu negocio.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      await updateBusinessCommercialData(business.id, {
        name: bizName.trim(),
        businessType: bizType,
        address: bizAddress.trim(),
        phone: bizPhone.trim(),
      });
      markStepComplete('identity');
      setCurrentStep(2);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar los datos del negocio.' });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Step 2: Save Catalog / Products
  // -------------------------------------------------------------
  const handleApplyKit = async () => {
    if (!business?.id || !userProfile?.uid) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      const res = await applyStarterKit(business.id, userProfile.uid, selectedKit);
      setIsKitApplied(true);
      markStepComplete('catalog');
      setFeedback({ 
        type: 'success', 
        message: `¡Se agregaron ${res.added} productos de ejemplo a tu catálogo!` 
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al cargar el kit de inicio.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateCustomProduct = async () => {
    if (!business?.id || !userProfile?.uid) return;
    if (!customProdName.trim()) {
      setFeedback({ type: 'error', message: 'Ingresá el nombre del producto.' });
      return;
    }
    const salePrice = Number(customProdPrice) || 0;
    if (salePrice <= 0) {
      setFeedback({ type: 'error', message: 'Ingresá un precio de venta mayor a 0.' });
      return;
    }

    setIsSaving(true);
    setFeedback(null);
    try {
      const prod = await createProduct(business.id, userProfile.uid, {
        name: customProdName.trim(),
        category: customProdCategory.trim() || 'General',
        barcode: customProdBarcode.trim() || null,
        costPrice: Number(customProdCost) || 0,
        salePrice: salePrice,
        initialStock: Number(customProdStock) || 0,
        minimumStock: 2,
        tracksStock: true,
      });

      setCustomProdCreated(prev => [...prev, prod.name]);
      markStepComplete('catalog');
      setFeedback({ type: 'success', message: `¡Producto "${prod.name}" creado con éxito!` });
      // Reset inputs for next addition
      setCustomProdName('');
      setCustomProdBarcode('');
      setCustomProdCost('');
      setCustomProdPrice('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al crear producto.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleNextFromCatalog = () => {
    markStepComplete('catalog');
    setCurrentStep(3);
  };

  // -------------------------------------------------------------
  // Step 3: Save Cash Register & Opening Float
  // -------------------------------------------------------------
  const handleSaveCash = async () => {
    if (!business?.id || !userProfile) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      if (openCashNow) {
        const floatAmount = customFloat !== '' ? Number(customFloat) || 0 : selectedFloat;
        await setupInitialCashShift(business.id, userProfile, floatAmount);
      } else {
        await getOrCreateDefaultCashRegister(business.id, undefined, userProfile.uid, userProfile.displayName);
      }
      setCashInitialized(true);
      markStepComplete('cash');
      setCurrentStep(4);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al configurar la caja.' });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Step 4: Save Payment Info
  // -------------------------------------------------------------
  const handleSavePayments = async () => {
    if (!business?.id) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      // If bank details provided, save to business record
      if (transferAlias || transferCbu || transferBank || transferHolder) {
        await updateBusinessCommercialData(business.id, {
          name: bizName || business.name,
          // Custom notes or address storage if needed
        });
      }
      markStepComplete('payments');
      setCurrentStep(5);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Error al guardar medios de cobro.' });
    } finally {
      setIsSaving(false);
    }
  };

  // -------------------------------------------------------------
  // Step 5: Save Team / Seller
  // -------------------------------------------------------------
  const handleSaveTeam = async () => {
    if (!business?.id) return;
    if (teamMode === 'seller') {
      if (!sellerName.trim() || !sellerEmail.trim()) {
        setFeedback({ type: 'error', message: 'Completá el nombre y correo Gmail del vendedor.' });
        return;
      }

      setIsSaving(true);
      setFeedback(null);
      try {
        await createSellerForBusiness(
          {
            sellerName: sellerName.trim(),
            sellerEmail: sellerEmail.trim().toLowerCase(),
            phone: sellerPhone.trim() || undefined,
            businessId: business.id,
          },
          undefined,
          { uid: userProfile?.uid || '', email: userProfile?.email || '' }
        );
        setSellerCreated(true);
        markStepComplete('team');
        setCurrentStep(6);
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Error al preautorizar al vendedor.' });
      } finally {
        setIsSaving(false);
      }
    } else {
      markStepComplete('team');
      setCurrentStep(6);
    }
  };

  // -------------------------------------------------------------
  // Step 6: Finish Onboarding & Mark Complete
  // -------------------------------------------------------------
  const handleCompleteOnboarding = async (targetTab?: 'pos' | 'control' | 'business') => {
    if (!business?.id) return;
    setIsSaving(true);
    try {
      await updateBusinessOnboarding(business.id, {
        completed: true,
        completedAt: new Date().toISOString(),
        completedSteps: ['identity', 'catalog', 'cash', 'payments', 'team', 'launch'],
        lastStep: 6,
        dismissed: false,
      });

      onClose();
      if (targetTab && onNavigateTab) {
        onNavigateTab(targetTab);
      }
    } catch (err: any) {
      console.error('Error finalizando onboarding:', err);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  // Step definitions for top bar
  const STEPS = [
    { num: 1, key: 'identity', title: 'Identidad', icon: Store },
    { num: 2, key: 'catalog', title: 'Catálogo', icon: Package },
    { num: 3, key: 'cash', title: 'Caja', icon: Coins },
    { num: 4, key: 'payments', title: 'Cobros', icon: CreditCard },
    { num: 5, key: 'team', title: 'Equipo', icon: Users },
    { num: 6, key: 'launch', title: '¡Listo!', icon: Sparkles },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl overflow-hidden flex flex-col my-auto max-h-[92vh]">
        
        {/* Modal Top Header */}
        <div className="px-5 sm:px-6 py-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/80 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shadow-md shadow-blue-500/20">
              <UwiLogo variant="compact" theme="white" size="sm" showText={false} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900 leading-tight">
                Guía de Inicio Rápido
              </h2>
              <p className="text-xs text-stone-500">
                Configurá tu negocio en pocos pasos para empezar a vender
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 p-1.5 rounded-lg hover:bg-stone-200/60 transition-colors"
            title="Cerrar y continuar más tarde"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Progress Indicator */}
        <div className="px-5 sm:px-6 py-3 bg-white border-b border-stone-100 shrink-0">
          <div className="flex items-center justify-between gap-1 sm:gap-2">
            {STEPS.map((s, idx) => {
              const StepIcon = s.icon;
              const isActive = currentStep === s.num;
              const isDone = completedSteps.includes(s.key) || currentStep > s.num;
              
              return (
                <div 
                  key={s.num} 
                  className="flex-1 flex flex-col items-center cursor-pointer group"
                  onClick={() => {
                    // Allow navigating back or to steps already completed
                    if (s.num <= currentStep || isDone) {
                      setCurrentStep(s.num);
                    }
                  }}
                >
                  <div className="flex items-center w-full">
                    {idx > 0 && (
                      <div className={`h-0.5 flex-1 transition-colors ${
                        isDone ? 'bg-emerald-500' : 'bg-stone-200'
                      }`} />
                    )}
                    <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shrink-0 ${
                      isActive 
                        ? 'bg-blue-600 text-white ring-4 ring-blue-100 shadow-sm' 
                        : isDone 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-stone-100 text-stone-400'
                    }`}>
                      {isDone && !isActive ? (
                        <Check className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                      ) : (
                        <span>{s.num}</span>
                      )}
                    </div>
                    {idx < STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 transition-colors ${
                        completedSteps.includes(STEPS[idx + 1].key) || currentStep > s.num
                          ? 'bg-emerald-500' 
                          : 'bg-stone-200'
                      }`} />
                    )}
                  </div>
                  <span className={`text-[10px] sm:text-xs font-medium mt-1 hidden sm:block truncate max-w-[80px] text-center ${
                    isActive ? 'text-blue-600 font-bold' : isDone ? 'text-stone-700' : 'text-stone-400'
                  }`}>
                    {s.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Body / Active Step Content */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-8 py-5 space-y-5">
          
          {/* Feedback message banner */}
          {feedback && (
            <div className={`p-3.5 rounded-xl border flex items-center space-x-2.5 text-xs font-medium ${
              feedback.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}>
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 1: IDENTIDAD DEL NEGOCIO */}
          {/* ========================================================= */}
          {currentStep === 1 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Contextual Visual Scene */}
              <SceneIdentity businessName={bizName} />

              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Paso 1 de 5
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                  ¿Cómo se llama tu negocio?
                </h3>
                <p className="text-xs text-stone-500">
                  Primero conocemos tu negocio. Esta información aparecerá en tus tickets de venta y reportes.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nombre comercial o de fantasía <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={bizName}
                    onChange={(e) => setBizName(e.target.value)}
                    placeholder="Ej. Minimarket Los Pinos, Kiosco El Sol..."
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Tipo de rubro / actividad
                  </label>
                  <select
                    value={bizType}
                    onChange={(e) => setBizType(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
                  >
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Dirección comercial
                    </label>
                    <input
                      type="text"
                      value={bizAddress}
                      onChange={(e) => setBizAddress(e.target.value)}
                      placeholder="Ej. Av. San Martín 1234"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Teléfono o WhatsApp de contacto
                    </label>
                    <input
                      type="tel"
                      value={bizPhone}
                      onChange={(e) => setBizPhone(e.target.value)}
                      placeholder="Ej. +54 9 11 1234-5678"
                      className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-300 rounded-xl text-stone-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 2: CATÁLOGO Y PRIMEROS PRODUCTOS */}
          {/* ========================================================= */}
          {currentStep === 2 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Contextual Visual Scene */}
              <SceneProducts />

              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Paso 2 de 5
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                  Ahora cargamos lo que vendés
                </h3>
                <p className="text-xs text-stone-500">
                  Podés importar un kit de ejemplo listo para vender, cargar un producto a mano o continuar si preferís hacerlo después.
                </p>
              </div>

              {/* Sample Data Disclaimer Banner */}
              <div className="p-3 bg-amber-50/90 border border-amber-200/90 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold block text-amber-950">Productos de ejemplo</strong>
                  <span>Los kits cargan productos, precios y stock orientativos para que puedas comenzar más rápido. Podés editarlos o eliminarlos después desde Productos.</span>
                </div>
              </div>

              {/* Choice selector */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setCatalogChoice('starter')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    catalogChoice === 'starter'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-blue-600 font-bold text-xs mb-1">
                    <Sparkles className="w-4 h-4" />
                    <span>Kit de Inicio Rápido</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Cargá productos estándar con precios y stock de prueba.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCatalogChoice('custom')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    catalogChoice === 'custom'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-stone-800 font-bold text-xs mb-1">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    <span>Crear Producto Propio</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Ingresá manualmente uno de tus productos reales.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setCatalogChoice('skip')}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    catalogChoice === 'skip'
                      ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="flex items-center space-x-2 text-stone-600 font-bold text-xs mb-1">
                    <ChevronRight className="w-4 h-4" />
                    <span>Configurar Después</span>
                  </div>
                  <p className="text-[11px] text-stone-500">
                    Continuar al siguiente paso sin agregar productos ahora.
                  </p>
                </button>
              </div>

              {/* Starter Kit option view */}
              {catalogChoice === 'starter' && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <h4 className="text-xs font-bold text-stone-800">
                    Elegí un rubro para precargar productos de muestra:
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {STARTER_KITS.map((kit) => (
                      <button
                        key={kit.id}
                        type="button"
                        onClick={() => setSelectedKit(kit.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          selectedKit === kit.id
                            ? 'bg-white border-blue-600 shadow-sm ring-2 ring-blue-500/20'
                            : 'bg-white/60 border-stone-200 hover:border-stone-300'
                        }`}
                      >
                        <div className="text-xl mb-1">{kit.icon}</div>
                        <div className="text-xs font-bold text-stone-900">{kit.name}</div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-stone-500 line-clamp-1">{kit.description}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200/60 shrink-0 ml-1">
                            Kit de ejemplo
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>

                  {isKitApplied && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-emerald-900 animate-fadeIn">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>
                          <strong>Productos de ejemplo agregados.</strong> Podés revisar y modificar precios, costos y stock desde Productos.
                        </span>
                      </div>
                      {onNavigateTab && (
                        <button
                          type="button"
                          onClick={() => {
                            markStepComplete('catalog');
                            onClose();
                            onNavigateTab('products');
                          }}
                          className="px-3 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold rounded-lg text-[11px] transition-colors self-end sm:self-auto cursor-pointer"
                        >
                          Revisar Productos
                        </button>
                      )}
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-[11px] text-stone-500">
                      Incluye 3-4 productos con código de barra, costo, precio y stock de ejemplo.
                    </span>
                    <button
                      type="button"
                      disabled={isSaving || isKitApplied}
                      onClick={handleApplyKit}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors flex items-center space-x-1.5 disabled:opacity-50"
                    >
                      {isKitApplied ? (
                        <>
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>¡Kit Aplicado!</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>{isSaving ? 'Cargando...' : 'Cargar Productos'}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Custom single product view */}
              {catalogChoice === 'custom' && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Nombre del producto <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customProdName}
                        onChange={(e) => setCustomProdName(e.target.value)}
                        placeholder="Ej. Coca Cola 1.5L, Pan Lactal..."
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Código de barras (opcional)
                      </label>
                      <input
                        type="text"
                        value={customProdBarcode}
                        onChange={(e) => setCustomProdBarcode(e.target.value)}
                        placeholder="Ej. 7791234567890"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Categoría
                      </label>
                      <input
                        type="text"
                        value={customProdCategory}
                        onChange={(e) => setCustomProdCategory(e.target.value)}
                        placeholder="Ej. Bebidas, Almacén..."
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Precio de Venta ($) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customProdPrice}
                        onChange={(e) => setCustomProdPrice(e.target.value)}
                        placeholder="0.00"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Stock Inicial
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={customProdStock}
                        onChange={(e) => setCustomProdStock(e.target.value)}
                        placeholder="10"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleCreateCustomProduct}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Guardando...' : 'Guardar Producto'}</span>
                    </button>
                  </div>

                  {customProdCreated.length > 0 && (
                    <div className="pt-2 border-t border-stone-200">
                      <span className="text-[11px] font-bold text-emerald-700 block mb-1">
                        Productos agregados ({customProdCreated.length}):
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {customProdCreated.map((name, i) => (
                          <span key={i} className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-medium">
                            ✓ {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 3: CAJA Y FONDO INICIAL */}
          {/* ========================================================= */}
          {currentStep === 3 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Contextual Visual Scene */}
              <SceneCash floatAmount={customFloat !== '' ? Number(customFloat) || 0 : selectedFloat} />

              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Paso 3 de 5
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                  Caja y Fondo Inicial de Efectivo
                </h3>
                <p className="text-xs text-stone-500">
                  Tu caja queda lista para comenzar. Tu negocio cuenta con una <strong>Caja Principal</strong> para registrar cobros en efectivo y turnos de trabajo.
                </p>
              </div>

              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Nombre de la caja
                  </label>
                  <input
                    type="text"
                    value={cashRegisterName}
                    onChange={(e) => setCashRegisterName(e.target.value)}
                    placeholder="Caja Principal"
                    className="w-full px-3.5 py-2.5 bg-white border border-stone-300 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                  />
                </div>

                <div className="pt-2 border-t border-stone-200 space-y-3">
                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="openCashCheckbox"
                      checked={openCashNow}
                      onChange={(e) => setOpenCashNow(e.target.checked)}
                      className="mt-1 w-4 h-4 text-blue-600 rounded border-stone-300 focus:ring-blue-500"
                    />
                    <label htmlFor="openCashCheckbox" className="text-xs text-stone-800 font-medium cursor-pointer">
                      <span className="font-bold block text-stone-900">Abrir turno de caja ahora mismo con fondo inicial</span>
                      Dejá la caja lista para dar cambio en tu primera venta del día.
                    </label>
                  </div>

                  {openCashNow && (
                    <div className="pl-7 space-y-3 pt-1">
                      <label className="block text-xs font-bold text-stone-700">
                        Seleccioná el monto inicial para cambio:
                      </label>

                      <div className="flex flex-wrap gap-2">
                        {INITIAL_FLOATS.map((amount) => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => {
                              setSelectedFloat(amount);
                              setCustomFloat('');
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              selectedFloat === amount && customFloat === ''
                                ? 'bg-blue-600 text-white shadow-sm'
                                : 'bg-white border border-stone-300 text-stone-700 hover:bg-stone-100'
                            }`}
                          >
                            ${amount.toLocaleString('es-AR')}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center space-x-2 pt-1 max-w-xs">
                        <span className="text-xs text-stone-500 font-medium">O ingresá otro monto:</span>
                        <div className="relative flex-1">
                          <span className="absolute left-2.5 top-1.5 text-xs text-stone-400 font-bold">$</span>
                          <input
                            type="number"
                            min="0"
                            value={customFloat}
                            onChange={(e) => setCustomFloat(e.target.value)}
                            placeholder="Otro monto"
                            className="w-full pl-6 pr-2.5 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 4: MEDIOS DE COBRO */}
          {/* ========================================================= */}
          {currentStep === 4 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Contextual Visual Scene */}
              <ScenePayments />

              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Paso 4 de 5
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                  Medios de Pago y Cobro
                </h3>
                <p className="text-xs text-stone-500">
                  Configurá las opciones con las que tus clientes podrán abonar en el mostrador.
                </p>
              </div>

              <div className="space-y-3 pt-1">
                {/* Cash Method */}
                <div className="p-3.5 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-black text-sm">
                      💵
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-stone-900">Efectivo</h4>
                      <p className="text-[11px] text-stone-500">Activo por defecto con control de vuelto y arqueo de caja.</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    ✓ Activo
                  </span>
                </div>

                {/* Bank Transfer / QR */}
                <div className="p-4 bg-stone-50 border border-stone-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-black text-sm">
                        🏦
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900">Transferencia Bancaria / CVU / CBU</h4>
                        <p className="text-[11px] text-stone-500">Mostrá tu Alias o datos bancarios para transferencias inmediatas.</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-stone-400 font-medium">Configuración informativa</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-0.5">
                        Alias de cobro
                      </label>
                      <input
                        type="text"
                        value={transferAlias}
                        onChange={(e) => setTransferAlias(e.target.value)}
                        placeholder="ejemplo.negocio.mp"
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-stone-700 mb-0.5">
                        Banco o Billetera
                      </label>
                      <input
                        type="text"
                        value={transferBank}
                        onChange={(e) => setTransferBank(e.target.value)}
                        placeholder="Ej. Mercado Pago, Santander, Galicia..."
                        className="w-full px-3 py-1.5 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                  </div>
                </div>

                {/* Mercado Pago Integration */}
                <div className="p-4 bg-sky-50/60 border border-sky-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-black text-sm shadow-xs">
                        💳
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-stone-900">Mercado Pago Point / QR</h4>
                        <p className="text-[11px] text-stone-500">Cobrá con lector físico Point o QR dinámico integrado a UWI.</p>
                      </div>
                    </div>
                    <span className="text-[10px] text-sky-700 font-bold bg-sky-100 px-2 py-0.5 rounded-full">
                      Vinculación en Mi Negocio
                    </span>
                  </div>
                  <p className="text-[11px] text-sky-800">
                    Podés vincular tu cuenta oficial de Mercado Pago en cualquier momento desde <strong>Mi Negocio &gt; Cobros</strong>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 5: EQUIPO Y VENDEDORES */}
          {/* ========================================================= */}
          {currentStep === 5 && (
            <div className="space-y-4 animate-fadeIn">
              {/* Contextual Visual Scene */}
              <SceneTeam teamMode={teamMode} />

              <div className="space-y-1">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Paso 5 de 5
                </span>
                <h3 className="text-lg sm:text-xl font-bold text-stone-900">
                  ¿Quiénes atenderán el mostrador?
                </h3>
                <p className="text-xs text-stone-500">
                  Podés empezar solo o sumar a tu equipo. Podés operar con tu cuenta o crear accesos para tus vendedores/cajeros.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setTeamMode('solo')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    teamMode === 'solo'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center mb-2">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-stone-900">Atenderé yo mismo</h4>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Operar con tu cuenta de Administrador con acceso completo a POS, Control y Reportes.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setTeamMode('seller')}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    teamMode === 'seller'
                      ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                      : 'border-stone-200 hover:border-stone-300 bg-white'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center mb-2">
                    <Users className="w-5 h-5" />
                  </div>
                  <h4 className="text-xs font-bold text-stone-900">Crear cuenta para Vendedor</h4>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Crear un acceso con permisos restringidos para un cajero o empleado.
                  </p>
                </button>
              </div>

              {teamMode === 'seller' && (
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-3 animate-fadeIn">
                  <h4 className="text-xs font-bold text-stone-800">
                    Datos del vendedor a autorizar:
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Nombre y Apellido <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={sellerName}
                        onChange={(e) => setSellerName(e.target.value)}
                        placeholder="Ej. Juan Pérez"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Correo Gmail <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={sellerEmail}
                        onChange={(e) => setSellerEmail(e.target.value)}
                        placeholder="vendedor@gmail.com"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Teléfono de contacto (opcional)
                      </label>
                      <input
                        type="tel"
                        value={sellerPhone}
                        onChange={(e) => setSellerPhone(e.target.value)}
                        placeholder="Ej. +54 9 11 1234-5678"
                        className="w-full px-3 py-2 bg-white border border-stone-300 rounded-lg text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>

                    <div className="sm:col-span-2 p-3 bg-blue-50/80 rounded-xl border border-blue-200/80 flex items-start gap-2.5 text-xs text-blue-900">
                      <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold block text-blue-950">Acceso mediante Google</strong>
                        <span>Registrá a tu vendedor con su cuenta de Gmail. El vendedor ingresará a Uwi utilizando <strong>"Continuar con Google"</strong> sin necesidad de contraseñas.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* STEP 6: RESUMEN Y LANZAMIENTO */}
          {/* ========================================================= */}
          {currentStep === 6 && (
            <div className="space-y-5 animate-fadeIn text-center sm:text-left">
              {/* Contextual Visual Scene */}
              <SceneLaunch />

              <div className="flex flex-col sm:flex-row items-center space-y-3 sm:space-y-0 sm:space-x-4 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/20 shrink-0">
                  <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-emerald-950">
                    ¡Tu negocio ya está listo para operar!
                  </h3>
                  <p className="text-xs text-emerald-800 mt-0.5">
                    Completaste la configuración inicial con éxito. Podés empezar a cobrar inmediatamente.
                  </p>
                </div>
              </div>

              {/* Checklist review */}
              <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 space-y-2.5 text-left">
                <h4 className="text-xs font-bold text-stone-800 uppercase tracking-wider mb-2">
                  Resumen de tu configuración:
                </h4>
                
                <div className="flex items-center space-x-2.5 text-xs text-stone-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Comercio:</strong> {bizName || business?.name} ({bizType})</span>
                </div>

                <div className="flex items-center space-x-2.5 text-xs text-stone-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Catálogo:</strong> Preparado para vender</span>
                </div>

                <div className="flex items-center space-x-2.5 text-xs text-stone-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Caja:</strong> {cashRegisterName} {openCashNow ? '(Turno abierto con fondo inicial)' : '(Lista)'}</span>
                </div>

                <div className="flex items-center space-x-2.5 text-xs text-stone-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Medios de Cobro:</strong> Efectivo y Transferencias habilitadas</span>
                </div>

                <div className="flex items-center space-x-2.5 text-xs text-stone-700 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span><strong>Equipo:</strong> {teamMode === 'seller' ? `Vendedor autorizado con Google (${sellerEmail})` : 'Administrador listo'}</span>
                </div>
              </div>

              {/* Direct Quick Action Buttons */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-stone-600 block text-left">
                  ¿Por dónde querés comenzar?
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleCompleteOnboarding('pos')}
                    className="p-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex flex-col items-center justify-center space-y-1 shadow-sm transition-all text-center group"
                  >
                    <ShoppingBag className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">Ir al POS a Vender</span>
                    <span className="text-[10px] text-blue-100">Abrir punto de venta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCompleteOnboarding('control')}
                    className="p-3.5 rounded-xl bg-stone-900 hover:bg-black text-white flex flex-col items-center justify-center space-y-1 shadow-sm transition-all text-center group"
                  >
                    <Coins className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">Ver Control Diario</span>
                    <span className="text-[10px] text-stone-300">Resumen y métricas</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCompleteOnboarding('business')}
                    className="p-3.5 rounded-xl border border-stone-300 hover:bg-stone-100 text-stone-800 flex flex-col items-center justify-center space-y-1 transition-all text-center group bg-white"
                  >
                    <Store className="w-5 h-5 text-stone-600 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold">Explorar Mi Negocio</span>
                    <span className="text-[10px] text-stone-500">Ajustes y apariencia</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="px-5 sm:px-8 py-3.5 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <div>
            {currentStep > 1 && currentStep < 6 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
                className="px-3.5 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-200/60 transition-colors flex items-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {currentStep < 6 && (
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-xs font-medium text-stone-500 hover:text-stone-700 rounded-xl hover:bg-stone-200/50 transition-colors"
              >
                Continuar después
              </button>
            )}

            {currentStep === 1 && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveIdentity}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                <span>{isSaving ? 'Guardando...' : 'Siguiente Paso'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 2 && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleNextFromCatalog}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                <span>Siguiente Paso</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 3 && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveCash}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                <span>{isSaving ? 'Configurando...' : 'Siguiente Paso'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 4 && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSavePayments}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                <span>{isSaving ? 'Guardando...' : 'Siguiente Paso'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 5 && (
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSaveTeam}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center space-x-1.5"
              >
                <span>{isSaving ? 'Guardando...' : 'Ver Resumen'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            {currentStep === 6 && (
              <button
                type="button"
                disabled={isSaving}
                onClick={() => handleCompleteOnboarding('pos')}
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all flex items-center space-x-1.5"
              >
                <span>Finalizar y Comenzar</span>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
