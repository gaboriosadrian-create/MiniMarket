import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, ThemeVariantType } from '../../lib/themeVariant';

export interface MetricCardItem {
  id: string;
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  icon?: LucideIcon;
  accent?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  kicker?: string;
  badge?: string;
  span?: '1x1' | '2x1' | '2x2';
}

interface Props {
  metric: MetricCardItem;
  variantOverride?: ThemeVariantType;
  className?: string;
}

export const MetricCardVariant: React.FC<Props> = ({ 
  metric, 
  variantOverride, 
  className = '' 
}) => {
  const { activeTheme } = useTheme();
  const variant = variantOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);
  const Icon = metric.icon;

  // 1. EDITORIAL VARIANT: Huge headline number + quiet label + fine bottom divider (NO box enclosure!)
  if (variant === 'editorial') {
    return (
      <div className={`py-4 px-2 border-b border-stone-300 transition-all font-serif ${className}`}>
        {metric.kicker && (
          <span className="text-[10px] font-sans font-black tracking-widest uppercase text-stone-500 block mb-1">
            {metric.kicker}
          </span>
        )}
        <div className="flex items-baseline justify-between gap-2">
          <div className="text-4xl sm:text-5xl font-black font-serif tracking-tight text-stone-900 leading-none">
            {metric.value}
          </div>
          {metric.trend && (
            <span className={`text-xs font-sans font-bold flex items-center gap-0.5 ${
              metric.trend.isPositive ? 'text-emerald-700' : 'text-stone-600'
            }`}>
              {metric.trend.isPositive ? '↑' : '↓'} {metric.trend.value}
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-stone-600 font-sans">
          <span className="font-bold uppercase tracking-wider text-[11px] text-stone-700">{metric.title}</span>
          {metric.subtitle && <span className="text-stone-500 italic">{metric.subtitle}</span>}
        </div>
      </div>
    );
  }

  // 2. SWISS VARIANT: Pure 0px radius, heavy 2px black grid lines, bold grotesque typography, stark high contrast
  if (variant === 'swiss') {
    return (
      <div className={`p-4 bg-white border-2 border-black rounded-none shadow-none transition-all ${className}`}>
        <div className="flex items-center justify-between border-b border-black pb-2 mb-3">
          <span className="text-[11px] font-black uppercase tracking-widest text-black font-sans">
            {metric.title}
          </span>
          {metric.badge && (
            <span className="text-[10px] font-black uppercase tracking-wider bg-black text-white px-1.5 py-0.5">
              {metric.badge}
            </span>
          )}
        </div>
        <div className="text-4xl sm:text-5xl font-black text-black font-sans tracking-tight leading-none my-1">
          {metric.value}
        </div>
        <div className="mt-3 pt-2 border-t border-black/30 flex items-center justify-between text-[11px] font-bold text-black/80 font-sans">
          <span>{metric.subtitle || 'INDICADOR_ACTUAL'}</span>
          {metric.trend && (
            <span className="bg-black text-white px-1 font-mono text-[10px]">
              {metric.trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 3. TERMINAL VARIANT: Monospace console telemetry card with bracketed stats and wireframe borders
  if (variant === 'terminal') {
    return (
      <div className={`p-3 bg-[#0B0F19] border border-[#1F2937] text-stone-200 font-mono text-xs rounded-none transition-all relative overflow-hidden ${className}`}>
        <div className="flex items-center justify-between text-[10px] text-sky-400 border-b border-[#1F2937] pb-1.5 mb-2">
          <span className="font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
            SYS.{metric.id.toUpperCase()}
          </span>
          <span className="text-stone-500 font-mono">[LOG_OK]</span>
        </div>
        <div className="py-1">
          <div className="text-[10px] text-stone-400 uppercase tracking-wider">{metric.title}</div>
          <div className="text-2xl sm:text-3xl font-black text-sky-400 font-mono tracking-tight my-1">
            {metric.value}
          </div>
        </div>
        <div className="mt-1 pt-1.5 border-t border-[#1F2937] flex items-center justify-between text-[10px] text-stone-400">
          <span>{metric.subtitle || 'STATUS: NOMINAL'}</span>
          {metric.trend && (
            <span className={metric.trend.isPositive ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
              [{metric.trend.value}]
            </span>
          )}
        </div>
      </div>
    );
  }

  // 4. BENTO VARIANT: Modular tile with smooth 24px radius, distinct contrast fills, and modern icon island
  if (variant === 'bento') {
    const isPrimary = metric.accent === 'primary';
    return (
      <div className={`p-5 rounded-3xl transition-all shadow-xs border flex flex-col justify-between ${
        isPrimary 
          ? 'bg-[#0284C7] text-white border-transparent shadow-md' 
          : 'bg-white text-stone-900 border-stone-200/80 hover:border-stone-300'
      } ${className}`}>
        <div className="flex items-start justify-between">
          <div>
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${
              isPrimary ? 'text-sky-100' : 'text-stone-500'
            }`}>
              {metric.title}
            </span>
            <div className="text-3xl sm:text-4xl font-black tracking-tight mt-1">
              {metric.value}
            </div>
          </div>
          {Icon && (
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isPrimary ? 'bg-white/20 text-white' : 'bg-sky-50 text-[#0284C7]'
            }`}>
              <Icon className="w-5 h-5" />
            </div>
          )}
        </div>
        <div className={`mt-4 pt-3 flex items-center justify-between text-xs font-medium border-t ${
          isPrimary ? 'border-white/20 text-sky-100' : 'border-stone-100 text-stone-500'
        }`}>
          <span>{metric.subtitle || 'Actualizado en tiempo real'}</span>
          {metric.trend && (
            <span className={`font-bold flex items-center gap-0.5 ${
              isPrimary ? 'text-white' : metric.trend.isPositive ? 'text-emerald-600' : 'text-red-600'
            }`}>
              {metric.trend.isPositive ? '↑' : '↓'} {metric.trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 5. AURORA VARIANT: Atmospheric glassmorphism with layered ambient glow and gradient typography
  if (variant === 'aurora') {
    return (
      <div className={`p-5 rounded-2xl bg-[#161B22]/90 backdrop-blur-md border border-[#30363D] text-white shadow-lg relative overflow-hidden transition-all group ${className}`}>
        {/* Ambient subtle glow patch */}
        <div className="absolute -top-10 -right-10 w-28 h-28 bg-violet-600/20 rounded-full blur-2xl pointer-events-none group-hover:bg-emerald-500/20 transition-colors"></div>
        <div className="flex items-center justify-between relative z-10">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">
            {metric.title}
          </span>
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/30 text-violet-300 flex items-center justify-center">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="text-3xl sm:text-4xl font-black tracking-tight mt-2 bg-gradient-to-r from-emerald-400 via-teal-300 to-violet-300 bg-clip-text text-transparent leading-tight relative z-10">
          {metric.value}
        </div>
        <div className="mt-3 pt-2.5 border-t border-stone-800 flex items-center justify-between text-xs text-stone-400 relative z-10">
          <span>{metric.subtitle || 'Flujo activo'}</span>
          {metric.trend && (
            <span className="text-emerald-400 font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> {metric.trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 6. NEO VARIANT: Cyber HUD panel with micro-glow, corner accents, and neon green telemetry
  if (variant === 'neo') {
    return (
      <div className={`p-4 rounded-xl bg-[#12151C] border border-[#1F2737] hover:border-[#00F59B]/50 transition-all text-white shadow-[0_0_12px_rgba(0,0,0,0.6)] relative group ${className}`}>
        <div className="flex items-center justify-between border-b border-[#1F2737] pb-2">
          <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-[#00F59B]">
            [ {metric.title} ]
          </span>
          <span className="text-[9px] font-mono text-stone-500">FEED.01</span>
        </div>
        <div className="text-3xl font-black font-mono text-[#00F59B] tracking-tight mt-2 drop-shadow-[0_0_8px_rgba(0,245,155,0.3)]">
          {metric.value}
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] font-mono text-stone-400">
          <span>{metric.subtitle || 'TELEMETRY_OK'}</span>
          {metric.trend && (
            <span className="text-[#00F59B] font-bold">
              +{metric.trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 7. COMMAND VARIANT: High-density operational cockpit metric card with inline status chips
  if (variant === 'command') {
    return (
      <div className={`p-3.5 bg-white rounded-md border border-stone-300 shadow-2xs transition-all ${className}`}>
        <div className="flex items-center justify-between text-xs text-stone-600">
          <span className="font-bold text-stone-800">{metric.title}</span>
          {Icon && <Icon className="w-3.5 h-3.5 text-indigo-600" />}
        </div>
        <div className="text-2xl sm:text-3xl font-black text-stone-900 font-mono tracking-tight mt-1">
          {metric.value}
        </div>
        <div className="mt-2 pt-1.5 border-t border-stone-100 flex items-center justify-between text-[11px] text-stone-500">
          <span>{metric.subtitle || 'Operación regular'}</span>
          {metric.trend && (
            <span className={`px-1 py-0.5 rounded text-[10px] font-mono font-bold ${
              metric.trend.isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}>
              {metric.trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 8. SOFT VARIANT: Friendly tactile bubble card with generous 24px radius, soft pastel background
  if (variant === 'soft') {
    return (
      <div className={`p-5 rounded-3xl bg-white border border-stone-200/90 shadow-xs hover:shadow-sm transition-all ${className}`}>
        <div className="flex items-center space-x-3">
          {Icon && (
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <Icon className="w-6 h-6" />
            </div>
          )}
          <div>
            <span className="text-xs font-bold text-stone-500 block">{metric.title}</span>
            <div className="text-2xl sm:text-3xl font-black text-stone-800 tracking-tight">
              {metric.value}
            </div>
          </div>
        </div>
        {metric.subtitle && (
          <p className="text-xs text-stone-400 mt-2 font-medium">{metric.subtitle}</p>
        )}
      </div>
    );
  }

  // 9. GRAPHITE VARIANT: Dark slate control panel with high-contrast glowing values
  if (variant === 'graphite') {
    return (
      <div className={`p-4 rounded-xl bg-[#1A1C20] border border-[#2A2D36] text-stone-100 shadow-md ${className}`}>
        <div className="flex items-center justify-between text-xs text-stone-400">
          <span className="font-bold">{metric.title}</span>
          {Icon && <Icon className="w-4 h-4 text-emerald-400" />}
        </div>
        <div className="text-3xl font-black text-emerald-400 font-mono tracking-tight mt-1.5">
          {metric.value}
        </div>
        <div className="mt-2.5 pt-2 border-t border-[#2A2D36] flex items-center justify-between text-[11px] text-stone-400">
          <span>{metric.subtitle || 'Modo Grafito'}</span>
          {metric.trend && (
            <span className="text-emerald-400 font-mono font-bold">
              {metric.trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 10. EMERALD VARIANT: Commercial retail card with strong brand green identity and stock focus
  if (variant === 'emerald') {
    return (
      <div className={`p-4 sm:p-5 rounded-2xl bg-white border border-[#D9E3DF] shadow-xs hover:border-[#008060] transition-all ${className}`}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
            {metric.title}
          </span>
          {Icon && (
            <div className="w-9 h-9 rounded-xl bg-[#E6F4EE] text-[#008060] flex items-center justify-center font-bold">
              <Icon className="w-4 h-4" />
            </div>
          )}
        </div>
        <div className="text-2xl sm:text-3xl font-black text-[#008060] tracking-tight mt-2">
          {metric.value}
        </div>
        <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
          <span>{metric.subtitle || 'Comercio UWI'}</span>
          {metric.trend && (
            <span className="text-[#008060] font-bold flex items-center gap-0.5">
              <ArrowUpRight className="w-3.5 h-3.5" /> {metric.trend.value}
            </span>
          )}
        </div>
      </div>
    );
  }

  // 11. CLEAN VARIANT (Default): Minimalist, clean card with 1px border and crisp typography
  return (
    <div className={`p-4 sm:p-5 bg-white rounded-xl border border-stone-200 shadow-2xs transition-all ${className}`}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
          {metric.title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-700 flex items-center justify-center">
            <Icon className="w-4 h-4" />
          </div>
        )}
      </div>
      <div className="text-2xl sm:text-3xl font-black text-stone-900 tracking-tight mt-1.5">
        {metric.value}
      </div>
      <div className="mt-3 pt-2 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
        <span>{metric.subtitle || 'Registro activo'}</span>
        {metric.trend && (
          <span className={`font-bold flex items-center gap-0.5 ${
            metric.trend.isPositive ? 'text-emerald-600' : 'text-stone-600'
          }`}>
            {metric.trend.value}
          </span>
        )}
      </div>
    </div>
  );
};
