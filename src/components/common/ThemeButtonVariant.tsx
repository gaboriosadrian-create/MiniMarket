import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, ThemeVariantType } from '../../lib/themeVariant';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variantType?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  variantOverride?: ThemeVariantType;
  children: React.ReactNode;
}

export const ThemeButtonVariant: React.FC<Props> = ({
  variantType = 'primary',
  size = 'md',
  variantOverride,
  children,
  className = '',
  ...props
}) => {
  const { activeTheme } = useTheme();
  const variant = variantOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);

  // Size mappings
  const sizeClasses = {
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-4 py-2 text-xs font-bold',
    lg: 'px-5 py-2.5 text-sm font-bold'
  }[size];

  // 1. SWISS: 0px radius, stark black border, uppercase grotesque typography
  if (variant === 'swiss') {
    let swissColor = 'bg-black text-white hover:bg-stone-800 border-2 border-black';
    if (variantType === 'secondary') swissColor = 'bg-white text-black hover:bg-stone-100 border-2 border-black';
    if (variantType === 'danger') swissColor = 'bg-[#E11D48] text-white hover:bg-red-700 border-2 border-black';
    if (variantType === 'ghost') swissColor = 'bg-transparent text-black hover:bg-stone-100 border-2 border-transparent hover:border-black';

    return (
      <button
        {...props}
        className={`rounded-none uppercase tracking-widest font-black transition-all cursor-pointer ${sizeClasses} ${swissColor} ${className}`}
      >
        {children}
      </button>
    );
  }

  // 2. TERMINAL: Monospace bracket button
  if (variant === 'terminal') {
    let termColor = 'bg-[#1F2937] hover:bg-sky-900/40 text-sky-400 border border-sky-500/30';
    if (variantType === 'secondary') termColor = 'bg-[#111827] hover:bg-[#1F2937] text-stone-300 border border-[#374151]';
    if (variantType === 'danger') termColor = 'bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/40';

    return (
      <button
        {...props}
        className={`rounded-none font-mono uppercase tracking-wider transition-colors cursor-pointer ${sizeClasses} ${termColor} ${className}`}
      >
        [ {children} ]
      </button>
    );
  }

  // 3. EDITORIAL: Refined serif/sans button with high editorial restraint
  if (variant === 'editorial') {
    let edColor = 'bg-stone-900 text-white hover:bg-stone-800 border border-stone-900';
    if (variantType === 'secondary') edColor = 'bg-white text-stone-900 hover:bg-stone-100 border border-stone-300';
    if (variantType === 'danger') edColor = 'bg-red-700 text-white hover:bg-red-800 border border-red-700';

    return (
      <button
        {...props}
        className={`rounded-xs font-sans uppercase tracking-widest text-[11px] font-black transition-all cursor-pointer ${sizeClasses} ${edColor} ${className}`}
      >
        {children}
      </button>
    );
  }

  // 4. SOFT: Rounded pill buttons (rounded-full)
  if (variant === 'soft') {
    let softColor = 'bg-amber-500 hover:bg-amber-600 text-white shadow-xs active:scale-95';
    if (variantType === 'secondary') softColor = 'bg-stone-100 hover:bg-stone-200 text-stone-800 border border-stone-200';
    if (variantType === 'danger') softColor = 'bg-rose-500 hover:bg-rose-600 text-white';

    return (
      <button
        {...props}
        className={`rounded-full font-bold transition-all cursor-pointer ${sizeClasses} ${softColor} ${className}`}
      >
        {children}
      </button>
    );
  }

  // 5. BENTO: Smooth 20px rounded button
  if (variant === 'bento') {
    let bentoColor = 'bg-[#0284C7] hover:bg-[#0369A1] text-white shadow-sm active:scale-95';
    if (variantType === 'secondary') bentoColor = 'bg-white hover:bg-stone-50 text-stone-900 border border-stone-200';
    if (variantType === 'danger') bentoColor = 'bg-red-600 hover:bg-red-700 text-white';

    return (
      <button
        {...props}
        className={`rounded-2xl font-black transition-all cursor-pointer ${sizeClasses} ${bentoColor} ${className}`}
      >
        {children}
      </button>
    );
  }

  // 6. NEO: Cyber neon button with glow
  if (variant === 'neo') {
    let neoColor = 'bg-[#181D27] hover:bg-[#222A3A] text-[#00F59B] border border-[#00F59B]/50 shadow-[0_0_10px_rgba(0,245,155,0.15)]';
    if (variantType === 'secondary') neoColor = 'bg-[#12151C] hover:bg-[#181D27] text-stone-300 border border-[#1F2737]';
    if (variantType === 'danger') neoColor = 'bg-[#221015] hover:bg-[#331820] text-[#FF3366] border border-[#FF3366]/50';

    return (
      <button
        {...props}
        className={`rounded-lg font-mono font-bold transition-all cursor-pointer ${sizeClasses} ${neoColor} ${className}`}
      >
        {children}
      </button>
    );
  }

  // 7. AURORA: Layered gradient depth button
  if (variant === 'aurora') {
    let auroraColor = 'bg-gradient-to-r from-emerald-500 to-violet-600 hover:from-emerald-400 hover:to-violet-500 text-white shadow-md border border-white/10';
    if (variantType === 'secondary') auroraColor = 'bg-[#21262D] hover:bg-[#30363D] text-violet-200 border border-[#30363D]';
    if (variantType === 'danger') auroraColor = 'bg-red-600/80 hover:bg-red-600 text-white border border-red-500/30';

    return (
      <button
        {...props}
        className={`rounded-xl font-bold transition-all cursor-pointer ${sizeClasses} ${auroraColor} ${className}`}
      >
        {children}
      </button>
    );
  }

  // 8. EMERALD: Retail commercial green button
  if (variant === 'emerald') {
    let emColor = 'bg-[#008060] hover:bg-[#006E52] text-white shadow-xs';
    if (variantType === 'secondary') emColor = 'bg-white hover:bg-stone-50 text-stone-800 border border-[#D9E3DF]';
    if (variantType === 'danger') emColor = 'bg-red-600 hover:bg-red-700 text-white';

    return (
      <button
        {...props}
        className={`rounded-xl font-bold transition-all cursor-pointer ${sizeClasses} ${emColor} ${className}`}
      >
        {children}
      </button>
    );
  }

  // 9. CLEAN (Default)
  let defaultColor = 'bg-stone-900 hover:bg-stone-800 text-white shadow-2xs';
  if (variantType === 'secondary') defaultColor = 'bg-white hover:bg-stone-100 text-stone-800 border border-stone-200';
  if (variantType === 'danger') defaultColor = 'bg-red-600 hover:bg-red-700 text-white';

  return (
    <button
      {...props}
      className={`rounded-lg font-bold transition-all cursor-pointer ${sizeClasses} ${defaultColor} ${className}`}
    >
      {children}
    </button>
  );
};
