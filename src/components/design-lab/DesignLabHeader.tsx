import React from 'react';
import { DesignVariant, DESIGN_VARIANTS } from './types';
import { Palette, Sparkles, Layout, Smartphone, Check, ArrowRight } from 'lucide-react';

interface Props {
  currentVariant: DesignVariant;
  onSelectVariant: (variant: DesignVariant) => void;
}

export const DesignLabHeader: React.FC<Props> = ({ currentVariant, onSelectVariant }) => {
  const currentMeta = DESIGN_VARIANTS[currentVariant];

  return (
    <div className="space-y-6">
      {/* Top Banner / Notice */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-800 to-stone-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-700/60 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-gradient-to-bl from-blue-500/10 via-emerald-500/10 to-transparent pointer-events-none rounded-full blur-3xl" />

        <div className="relative z-10 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-stone-800/90 border border-stone-600 text-xs font-black tracking-wide text-amber-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>LABORATORIO VISUAL DE EVALUACIÓN</span>
            </div>
            <span className="text-xs text-stone-400 font-mono">
              Acceso exclusivo: Super Admin
            </span>
          </div>

          <div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white flex items-center gap-3">
              <Palette className="w-8 h-8 text-emerald-400" />
              <span>uwi Design Lab</span>
            </h1>
            <p className="text-stone-300 text-sm sm:text-base mt-2 max-w-3xl leading-relaxed">
              Compará y evaluá 3 propuestas de Design System para uwi en tiempo real. Todos los componentes y datos son compartidos y utilizan tokens visuales independientes.
            </p>
          </div>

          {/* 3 Variant Selector Tabs */}
          <div className="pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {(Object.keys(DESIGN_VARIANTS) as DesignVariant[]).map((vKey) => {
                const meta = DESIGN_VARIANTS[vKey];
                const isSelected = currentVariant === vKey;

                return (
                  <button
                    key={vKey}
                    onClick={() => onSelectVariant(vKey)}
                    className={`p-4 rounded-2xl text-left transition-all relative cursor-pointer border ${
                      isSelected
                        ? 'bg-white text-stone-900 border-white shadow-lg ring-4 ring-emerald-500/30 translate-y-[-2px]'
                        : 'bg-stone-800/80 hover:bg-stone-800 text-stone-300 border-stone-700 hover:border-stone-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[11px] font-black uppercase px-2 py-0.5 rounded-md ${
                        isSelected 
                          ? 'bg-stone-900 text-white' 
                          : 'bg-stone-700 text-stone-300'
                      }`}>
                        {meta.badge}
                      </span>
                      {isSelected && (
                        <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                      )}
                    </div>
                    
                    <h3 className={`text-base font-black mt-2 ${isSelected ? 'text-stone-900' : 'text-white'}`}>
                      {meta.name}
                    </h3>
                    <p className={`text-xs font-bold ${isSelected ? 'text-emerald-700' : 'text-stone-400'}`}>
                      {meta.subtitle}
                    </p>
                    <p className={`text-[11px] mt-1 line-clamp-2 ${isSelected ? 'text-stone-600' : 'text-stone-400'}`}>
                      {meta.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Active Variant Profile & Key Guidelines */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-stone-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">Variante activa:</span>
            <span className="px-2.5 py-0.5 rounded-lg bg-stone-900 text-white font-black text-xs">
              {currentMeta.name}
            </span>
            <span className="text-xs text-stone-500 font-medium">({currentMeta.subtitle})</span>
          </div>
          <span className="text-xs text-stone-500 flex items-center gap-1 font-mono">
            Atributo CSS: <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-800 font-bold">[data-design="{currentVariant}"]</code>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-1">
          {currentMeta.keyFeatures.map((feat, idx) => (
            <div key={idx} className="flex items-start gap-2 text-xs text-stone-700">
              <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 font-bold text-[10px]">
                ✓
              </span>
              <span>{feat}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
