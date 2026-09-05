import React, { useState } from 'react';
import { MercadoPagoSettings } from './MercadoPagoSettings';
import {
  CreditCard,
  Building2,
  ExternalLink,
} from 'lucide-react';

interface AdminSettingsProps {
  onNavigateToTab?: (tab: 'business') => void;
  initialBusinessId?: string;
}

export const AdminSettings: React.FC<AdminSettingsProps> = ({ onNavigateToTab, initialBusinessId }) => {
  const [activeSubTab, setActiveSubTab] = useState<'mercadopago'>('mercadopago');

  return (
    <div className="space-y-4">
      {/* Notice Banner linking to Mi Negocio */}
      {onNavigateToTab && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5 text-xs text-blue-900">
            <Building2 className="w-4 h-4 text-[#006AFF] shrink-0" />
            <span>
              <strong>¿Deseas conectar Mercado Pago a tu negocio o editar tus datos comerciales?</strong>
              <span className="text-blue-800 ml-1">Puedes gestionarlo de forma simple y guiada en <strong>Mi Negocio</strong>.</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onNavigateToTab('business')}
            className="px-3 py-1.5 bg-[#006AFF] hover:bg-[#0055CC] text-white text-xs font-bold rounded-lg shadow-2xs transition-all flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
          >
            <span>Ir a Mi Negocio</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Sub-navigation for Settings */}
      <div className="bg-white rounded-xl border border-stone-200 shadow-xs p-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          id="subtab-integrations-mp"
          onClick={() => setActiveSubTab('mercadopago')}
          className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 cursor-pointer ${
            activeSubTab === 'mercadopago'
              ? 'bg-[#006AFF] text-white shadow-xs'
              : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200/60'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>Mercado Pago (Parámetros y Auditoría Técnica)</span>
        </button>
      </div>

      {/* Render active subtab */}
      {activeSubTab === 'mercadopago' && (
        <MercadoPagoSettings
          initialBusinessId={initialBusinessId}
          onNavigateToBusiness={onNavigateToTab ? () => onNavigateToTab('business') : undefined}
        />
      )}
    </div>
  );
};
