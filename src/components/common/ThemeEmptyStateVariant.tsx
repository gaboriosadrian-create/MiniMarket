import React from 'react';
import { LucideIcon, Inbox, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, ThemeVariantType } from '../../lib/themeVariant';

interface Props {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  variantOverride?: ThemeVariantType;
  className?: string;
}

export const ThemeEmptyStateVariant: React.FC<Props> = ({
  icon: Icon = Inbox,
  title,
  description,
  action,
  variantOverride,
  className = ''
}) => {
  const { activeTheme } = useTheme();
  const variant = variantOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);

  // 1. SWISS: 0px radius, heavy black lines, stark layout
  if (variant === 'swiss') {
    return (
      <div className={`p-8 bg-white border-2 border-black rounded-none text-center font-sans ${className}`}>
        <span className="text-[10px] font-black uppercase tracking-widest bg-black text-white px-2 py-0.5 inline-block mb-2">
          ESTADO_VACÍO
        </span>
        <h4 className="text-base font-black uppercase tracking-tight text-black mt-1">
          {title}
        </h4>
        {description && <p className="text-xs text-black/70 font-medium mt-1.5 max-w-sm mx-auto">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  // 2. TERMINAL: Monospace console telemetry log
  if (variant === 'terminal') {
    return (
      <div className={`p-6 bg-[#0B0F19] border border-[#1F2937] text-center font-mono text-xs text-stone-300 rounded-none ${className}`}>
        <div className="text-sky-400 font-bold mb-1">
          &gt; NULL_STREAM_DETECTED: [ {title.toUpperCase()} ]
        </div>
        {description && <div className="text-stone-500 text-[11px] mt-1">{description}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  // 3. EDITORIAL: Typographic headline with spacious margins
  if (variant === 'editorial') {
    return (
      <div className={`py-12 px-4 text-center font-serif border-y border-stone-300 bg-[#FAFAF9] ${className}`}>
        <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-stone-500 block mb-1">
          Sin registros actuales
        </span>
        <h4 className="text-2xl font-serif font-black text-stone-900 leading-snug max-w-md mx-auto">
          {title}
        </h4>
        {description && <p className="text-xs font-sans text-stone-600 mt-2 max-w-sm mx-auto">{description}</p>}
        {action && <div className="mt-5 font-sans">{action}</div>}
      </div>
    );
  }

  // 4. BENTO: Rounded modular empty state
  if (variant === 'bento') {
    return (
      <div className={`p-8 bg-white rounded-3xl border border-stone-200 text-center shadow-xs ${className}`}>
        <div className="w-12 h-12 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center mx-auto mb-3">
          <Icon className="w-6 h-6" />
        </div>
        <h4 className="text-base font-black text-stone-800">{title}</h4>
        {description && <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  // 5. AURORA: Atmospheric glowing empty state
  if (variant === 'aurora') {
    return (
      <div className={`p-8 bg-[#161B22]/90 backdrop-blur-md rounded-2xl border border-[#30363D] text-center text-white shadow-lg ${className}`}>
        <div className="w-12 h-12 rounded-xl bg-violet-600/20 text-violet-300 border border-violet-500/30 flex items-center justify-center mx-auto mb-3">
          <Icon className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-stone-100">{title}</h4>
        {description && <p className="text-xs text-stone-400 mt-1 max-w-sm mx-auto">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  // 6. NEO: Cyber HUD empty telemetry panel
  if (variant === 'neo') {
    return (
      <div className={`p-6 bg-[#12151C] rounded-xl border border-[#1F2737] text-center font-mono text-xs text-stone-300 shadow-md ${className}`}>
        <div className="text-[#00F59B] font-bold mb-1">[ ZERO_STATE: {title.toUpperCase()} ]</div>
        {description && <div className="text-stone-400 text-[11px] mt-1">{description}</div>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    );
  }

  // 7. STANDARD CLEAN (Default)
  return (
    <div className={`p-8 bg-white rounded-xl border border-stone-200 text-center shadow-2xs ${className}`}>
      <div className="w-10 h-10 rounded-lg bg-stone-100 text-stone-600 flex items-center justify-center mx-auto mb-2.5">
        <Icon className="w-5 h-5" />
      </div>
      <h4 className="text-sm font-bold text-stone-900">{title}</h4>
      {description && <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
};
