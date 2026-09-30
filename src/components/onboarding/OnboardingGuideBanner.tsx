import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  ChevronDown, 
  ChevronUp, 
  X, 
  Store, 
  Package, 
  Coins, 
  CreditCard, 
  Users 
} from 'lucide-react';
import { setOnboardingDismissed } from '../../lib/onboardingService';

interface OnboardingGuideBannerProps {
  onOpenWizard: () => void;
  onNavigateTab?: (tab: 'pos' | 'control' | 'business' | 'products' | 'cash-control' | 'sellers') => void;
}

export const OnboardingGuideBanner: React.FC<OnboardingGuideBannerProps> = ({
  onOpenWizard,
  onNavigateTab,
}) => {
  const { business } = useAuth();
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!business || business.onboarding?.completed || isDismissed) {
    return null;
  }

  const completedSteps = business.onboarding?.completedSteps || [];
  const totalCoreSteps = 5;
  const completedCount = completedSteps.length;
  const progressPercent = Math.min(100, Math.round((completedCount / totalCoreSteps) * 100));

  const handleDismiss = () => {
    setIsDismissed(true);
    setOnboardingDismissed(business.id, true);
  };

  const stepsList = [
    { key: 'identity', title: 'Datos del Negocio', icon: Store },
    { key: 'catalog', title: 'Catálogo de Productos', icon: Package },
    { key: 'cash', title: 'Caja y Fondo Inicial', icon: Coins },
    { key: 'payments', title: 'Medios de Cobro', icon: CreditCard },
    { key: 'team', title: 'Equipo y Vendedores', icon: Users },
  ];

  return (
    <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-blue-800/60 mb-4 transition-all animate-fadeIn relative overflow-hidden">
      {/* Subtle background glow effect */}
      <div className="absolute -right-10 -bottom-10 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-bold text-white leading-snug">
                Guía de Configuración Inicial de tu Negocio
              </h3>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                {completedCount} de {totalCoreSteps} completados
              </span>
            </div>
            <p className="text-xs text-blue-200/80 mt-0.5">
              Completá estos pasos recomendados para dejar tu comercio listo para la operación diaria.
            </p>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            type="button"
            onClick={() => setIsMinimized(prev => !prev)}
            className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
            title={isMinimized ? 'Expandir guía' : 'Minimizar guía'}
          >
            {isMinimized ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-blue-300 hover:text-white hover:bg-white/10 transition-colors"
            title="Ocultar banner de guía"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Expanded Content */}
      {!isMinimized && (
        <div className="mt-4 pt-3 border-t border-blue-800/60 relative z-10 space-y-3">
          
          {/* Progress Bar */}
          <div className="w-full bg-blue-950/60 rounded-full h-2 overflow-hidden border border-blue-800/40">
            <div 
              className="bg-emerald-400 h-full rounded-full transition-all duration-500 shadow-xs"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Steps Horizontal Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
            {stepsList.map((step, idx) => {
              const StepIcon = step.icon;
              const isDone = completedSteps.includes(step.key);

              return (
                <div 
                  key={step.key}
                  onClick={onOpenWizard}
                  className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center space-x-2 ${
                    isDone 
                      ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200' 
                      : 'bg-white/5 border-white/10 text-blue-200 hover:bg-white/10'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                    isDone ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-400/20 text-blue-300'
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </div>
                  <span className="text-[11px] font-medium truncate">
                    {step.title}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Bottom Action */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span className="text-[11px] text-blue-300 font-medium text-center sm:text-left">
              💡 Podés pausar y retomar en cualquier momento.
            </span>
            <button
              type="button"
              onClick={onOpenWizard}
              className="w-full sm:w-auto px-4 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-xl text-xs font-bold shadow-md shadow-blue-500/30 transition-all flex items-center justify-center space-x-1.5"
            >
              <span>Continuar Configuración</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

        </div>
      )}
    </div>
  );
};
