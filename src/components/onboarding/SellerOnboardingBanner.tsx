import React, { useState } from 'react';
import { useAuth } from '../../lib/authContext';
import { 
  Sparkles, 
  CheckCircle2, 
  ArrowRight, 
  X, 
  Calculator, 
  Coins, 
  Search, 
  ShieldCheck 
} from 'lucide-react';
import { setSellerOnboardingDismissed } from '../../lib/onboardingService';
import { BusinessLogo } from '../common/BusinessLogo';

interface SellerOnboardingBannerProps {
  onOpenWizard: () => void;
}

export const SellerOnboardingBanner: React.FC<SellerOnboardingBannerProps> = ({
  onOpenWizard,
}) => {
  const { userProfile, business } = useAuth();
  const [isDismissed, setIsDismissed] = useState(false);

  if (!userProfile || userProfile.onboarding?.completed || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (userProfile.uid) {
      setSellerOnboardingDismissed(userProfile.uid, true);
    }
  };

  return (
    <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-950 text-white rounded-2xl p-4 sm:p-5 shadow-lg border border-blue-800/60 mb-4 transition-all animate-fade-in relative overflow-hidden">
      {/* Glow highlight */}
      <div className="absolute -right-8 -bottom-8 w-44 h-44 bg-blue-500/15 rounded-full blur-2xl pointer-events-none" />

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center space-x-3.5">
          {business?.logoUrl ? (
            <BusinessLogo
              src={business.logoUrl}
              name={business.name}
              size="md"
              shape="rounded"
              border={false}
              className="w-10 h-10 object-cover rounded-xl border border-white/20 shadow-xs shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-500/25 border border-blue-400/30 flex items-center justify-center text-blue-300 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
          )}
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-sm sm:text-base font-extrabold text-white leading-tight">
                ¡Bienvenido a tu turno en {business?.name || 'Uwi'}!
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-200 border border-blue-400/30">
                Guía Rápida
              </span>
            </div>
            <p className="text-xs text-blue-200/90 mt-0.5">
              Descubrí cómo cobrar en el POS, gestionar tu fondo de caja y buscar productos.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={onOpenWizard}
            className="px-4 py-2 bg-white hover:bg-blue-50 text-blue-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer active:scale-98"
          >
            <span>Ver Guía del Vendedor</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          
          <button
            type="button"
            onClick={handleDismiss}
            className="p-2 rounded-xl text-blue-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
