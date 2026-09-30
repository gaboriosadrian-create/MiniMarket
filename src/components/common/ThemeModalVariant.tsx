import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, ThemeVariantType } from '../../lib/themeVariant';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  variantOverride?: ThemeVariantType;
}

export const ThemeModalVariant: React.FC<Props> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  variantOverride
}) => {
  const { activeTheme } = useTheme();
  const variant = variantOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl'
  }[maxWidth];

  // 1. SWISS MODAL: 0px radius, heavy 2px black border, grid structure
  if (variant === 'swiss') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 font-sans">
        <div className={`w-full ${maxWidthClasses} bg-white border-2 border-black rounded-none shadow-none`}>
          <div className="bg-black text-white p-3.5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">{title}</h3>
              {subtitle && <p className="text-[10px] text-stone-300 uppercase tracking-wider">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-stone-800 text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-5">{children}</div>
          {footer && (
            <div className="border-t-2 border-black p-3.5 bg-stone-50 flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. TERMINAL MODAL: Monospace console window
  if (variant === 'terminal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 font-mono text-xs">
        <div className={`w-full ${maxWidthClasses} bg-[#0B0F19] border border-sky-500/50 text-stone-200 rounded-none shadow-2xl`}>
          <div className="bg-[#111827] border-b border-[#1F2937] p-2.5 flex items-center justify-between text-sky-400">
            <span className="font-bold">[ WINDOW: {title.toUpperCase()} ]</span>
            <button
              onClick={onClose}
              className="px-1.5 py-0.5 bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-500/40 text-[10px] cursor-pointer"
            >
              [X]
            </button>
          </div>
          <div className="p-4">{children}</div>
          {footer && (
            <div className="border-t border-[#1F2937] p-3 bg-[#0E1322] flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. EDITORIAL MODAL: Expansive, minimalist, serif title
  if (variant === 'editorial') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs font-serif">
        <div className={`w-full ${maxWidthClasses} bg-[#FAFAF9] border-2 border-stone-900 rounded-xs shadow-xl`}>
          <div className="p-6 border-b border-stone-300 flex items-start justify-between">
            <div>
              <span className="text-[10px] font-sans font-bold uppercase tracking-widest text-stone-500">
                UWI Publicación
              </span>
              <h3 className="text-xl font-serif font-black text-stone-900 mt-1">{title}</h3>
              {subtitle && <p className="text-xs font-sans text-stone-600 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1 hover:bg-stone-200 rounded-xs text-stone-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 font-sans text-sm">{children}</div>
          {footer && (
            <div className="border-t border-stone-200 p-4 bg-stone-100/50 flex justify-end gap-3 font-sans">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 4. BENTO MODAL: Smooth 32px rounded modal
  if (variant === 'bento') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm">
        <div className={`w-full ${maxWidthClasses} bg-white rounded-3xl border border-stone-200 shadow-2xl overflow-hidden`}>
          <div className="p-6 pb-4 flex items-center justify-between border-b border-stone-100">
            <div>
              <h3 className="text-lg font-black text-stone-900">{title}</h3>
              {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-6">{children}</div>
          {footer && (
            <div className="p-4 bg-stone-50/80 border-t border-stone-100 flex justify-end gap-2.5">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 5. AURORA MODAL: Glassmorphism translucent modal with ambient glow
  if (variant === 'aurora') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
        <div className={`w-full ${maxWidthClasses} bg-[#161B22]/95 border border-[#30363D] text-white rounded-2xl shadow-[0_0_30px_rgba(139,92,246,0.15)] overflow-hidden`}>
          <div className="p-5 border-b border-[#30363D] flex items-center justify-between bg-gradient-to-r from-violet-900/20 to-emerald-900/20">
            <div>
              <h3 className="text-base font-bold text-white">{title}</h3>
              {subtitle && <p className="text-xs text-violet-300 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-stone-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 text-stone-200 text-sm">{children}</div>
          {footer && (
            <div className="p-4 bg-[#11161D] border-t border-[#30363D] flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 6. NEO MODAL: Cyber HUD dialog
  if (variant === 'neo') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 font-mono text-xs">
        <div className={`w-full ${maxWidthClasses} bg-[#12151C] border border-[#00F59B]/50 text-white rounded-xl shadow-[0_0_20px_rgba(0,245,155,0.2)] overflow-hidden`}>
          <div className="p-4 border-b border-[#1F2737] flex items-center justify-between bg-[#181D27]">
            <div>
              <h3 className="text-sm font-bold text-[#00F59B] uppercase tracking-wider">[ {title} ]</h3>
              {subtitle && <p className="text-[10px] text-stone-400 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded bg-[#222A3A] hover:bg-[#2C3549] text-[#00F59B] cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-4">{children}</div>
          {footer && (
            <div className="p-3 bg-[#181D27] border-t border-[#1F2737] flex justify-end gap-2">
              {footer}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 7. STANDARD CLEAN MODAL (Default)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className={`w-full ${maxWidthClasses} bg-white rounded-xl border border-stone-200 shadow-xl overflow-hidden`}>
        <div className="p-5 border-b border-stone-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-stone-900">{title}</h3>
            {subtitle && <p className="text-xs text-stone-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-500 hover:text-stone-900 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 text-sm">{children}</div>
        {footer && (
          <div className="p-4 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
