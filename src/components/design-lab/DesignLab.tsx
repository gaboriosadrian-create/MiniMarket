import React, { useState } from 'react';
import './designTokens.css';
import { DesignVariant } from './types';
import { DesignLabHeader } from './DesignLabHeader';
import { DesignLabMobilePreview } from './DesignLabMobilePreview';
import { DesignLabNavigation } from './DesignLabNavigation';
import { DesignLabDashboard } from './DesignLabDashboard';
import { DesignLabPOS } from './DesignLabPOS';
import { DesignLabProduct } from './DesignLabProduct';
import { DesignLabReceiving } from './DesignLabReceiving';
import { DesignLabRequest } from './DesignLabRequest';
import { DesignLabSuggestions } from './DesignLabSuggestions';
import { DesignLabStates } from './DesignLabStates';
import { DesignLabForms } from './DesignLabForms';
import { DesignLabButtons } from './DesignLabButtons';
import { DesignLabTables } from './DesignLabTables';
import { DesignLabModal } from './DesignLabModal';
import { DesignLabAlerts } from './DesignLabAlerts';
import { DesignLabMicrointeractions } from './DesignLabMicrointeractions';
import { DesignLabEvaluation } from './DesignLabEvaluation';
import { 
  Sparkles, 
  Smartphone, 
  Layout, 
  Layers, 
  Compass, 
  SlidersHorizontal,
  Eye,
  Zap
} from 'lucide-react';

export const DesignLab: React.FC = () => {
  const [currentVariant, setCurrentVariant] = useState<DesignVariant>('shopify');
  const [activeSectionFilter, setActiveSectionFilter] = useState<'all' | 'micro' | 'mobile' | 'components' | 'flows'>('all');
  const [reducedMotion, setReducedMotion] = useState(false);

  return (
    <div 
      className="design-lab-scope min-h-screen pb-16 transition-colors duration-200" 
      data-design={currentVariant} 
      data-reduced-motion={reducedMotion}
      style={{ backgroundColor: 'var(--dl-bg)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 space-y-8">
        
        {/* 1. Header & Variant Switcher */}
        <DesignLabHeader
          currentVariant={currentVariant}
          onSelectVariant={(v) => setCurrentVariant(v)}
        />

        {/* Quick Filter Navigation Bar */}
        <div className="sticky top-0 z-20 py-2.5 backdrop-blur-md bg-stone-100/90 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 border-b border-stone-200/80 flex items-center justify-between gap-3 overflow-x-auto">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs font-black text-stone-500 uppercase tracking-wider mr-1 hidden sm:inline">
              Vistas:
            </span>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSectionFilter === 'all'
                  ? 'bg-stone-900 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              Todos los componentes (16)
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('micro')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'micro'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>⚡ Microinteracciones (16)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('mobile')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'mobile'
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>📱 Mobile Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('flows')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'flows'
                  ? 'bg-blue-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Layout className="w-3.5 h-3.5" />
              <span>Flujos (POS / Recepción / Solicitud)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSectionFilter('components')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeSectionFilter === 'components'
                  ? 'bg-purple-700 text-white shadow-xs'
                  : 'bg-white text-stone-700 hover:bg-stone-200 border border-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>UI Tokens (Botones / Formularios / Estados)</span>
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs font-bold text-stone-500 hidden md:inline">
              Variante:
            </span>
            <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider" style={{ backgroundColor: 'var(--dl-primary-subtle)', color: 'var(--dl-primary)' }}>
              {currentVariant.toUpperCase()}
            </span>
          </div>
        </div>

        {/* 2. Microinteractions & Animation Showcase (Section 16 / 38) */}
        {(activeSectionFilter === 'all' || activeSectionFilter === 'micro') && (
          <div id="section-microinteractions" className="space-y-4">
            <DesignLabMicrointeractions 
              reducedMotion={reducedMotion}
              onToggleReducedMotion={() => setReducedMotion(!reducedMotion)}
            />
          </div>
        )}

        {/* 3. Mobile Preview Section */}
        {(activeSectionFilter === 'all' || activeSectionFilter === 'mobile') && (
          <div id="section-mobile-preview" className="space-y-4">
            <DesignLabMobilePreview />
          </div>
        )}

        {/* 4. Core Business Flows (Dashboard, POS, Recepción, Solicitud, Sugerencias) */}
        {(activeSectionFilter === 'all' || activeSectionFilter === 'flows') && (
          <div className="space-y-6">
            <DesignLabDashboard />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DesignLabPOS />
              <DesignLabReceiving />
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DesignLabRequest />
              <DesignLabProduct />
            </div>
            <DesignLabSuggestions />
          </div>
        )}

        {/* 5. Atomic UI Components & Tokens (Navigation, States, Forms, Buttons, Tables, Modal, Alerts) */}
        {(activeSectionFilter === 'all' || activeSectionFilter === 'components') && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DesignLabNavigation />
              <DesignLabStates />
            </div>
            <DesignLabForms />
            <DesignLabButtons />
            <DesignLabTables />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <DesignLabModal />
              <DesignLabAlerts />
            </div>
          </div>
        )}

        {/* 6. Visual Evaluation Criteria Rubric */}
        {(activeSectionFilter === 'all' || activeSectionFilter === 'micro' || activeSectionFilter === 'mobile' || activeSectionFilter === 'flows' || activeSectionFilter === 'components') && (
          <DesignLabEvaluation currentVariant={currentVariant} />
        )}

      </div>
    </div>
  );
};

