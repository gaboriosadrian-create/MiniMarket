import React from 'react';
import { useAuth } from '../../lib/authContext';
import { useNavigation } from '../../lib/navigationContext';
import { useTheme } from '../../lib/themeContext';
import { getThemeVariant, ThemeVariantType } from '../../lib/themeVariant';
import { NotificationBell } from '../NotificationBell';
import { UwiLogo } from '../UwiLogo';
import { 
  Menu, 
  Store, 
  Terminal as TerminalIcon, 
  Layers, 
  Sparkles, 
  Activity,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

interface Props {
  variantOverride?: ThemeVariantType;
  title?: string;
  subtitle?: string;
}

export const HeaderVariant: React.FC<Props> = ({
  variantOverride,
  title,
  subtitle
}) => {
  const { userProfile, business } = useAuth();
  const { toggleMobileMenu, isMobileMenuOpen } = useNavigation();
  const { activeTheme } = useTheme();
  const variant = variantOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);

  const displayTitle = title || business?.name || 'uwi';
  const displaySubtitle = subtitle || (userProfile?.role === 'SUPER_ADMIN' ? 'Plataforma Global' : 'Punto de Venta');

  // 1. EDITORIAL HEADER: Typographic masthead with volume, date, and serif branding
  if (variant === 'editorial') {
    return (
      <header className="md:hidden sticky top-0 z-20 bg-[#FAFAF9] text-stone-900 px-4 py-3 flex items-center justify-between border-b-2 border-stone-900 font-serif h-16 shrink-0 shadow-none">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-none border border-black bg-white flex items-center justify-center font-bold">
            <UwiLogo variant="static" theme="monochrome" size="xs" showText={false} />
          </div>
          <div>
            <h1 className="text-base font-serif font-black tracking-tight leading-none lowercase">
              uwi
            </h1>
            <span className="text-[10px] font-sans font-semibold text-stone-500 uppercase tracking-wider block mt-0.5">
              {displayTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 font-sans">
          <NotificationBell isDark={false} />
          <button
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
            className="px-3 py-1.5 border border-black bg-white hover:bg-stone-100 text-black text-xs font-bold uppercase tracking-wider transition-colors"
          >
            Índice
          </button>
        </div>
      </header>
    );
  }

  // 2. SWISS HEADER: Strict orthogonal grid header with solid black border lines and 0px radius
  if (variant === 'swiss') {
    return (
      <header className="md:hidden sticky top-0 z-20 bg-white text-black px-4 py-2.5 flex items-center justify-between border-b-2 border-black font-sans h-14 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-black text-white flex items-center justify-center font-black text-xs">
            U
          </div>
          <div>
            <span className="text-sm font-black uppercase tracking-tight block leading-none">
              UWI / {displayTitle}
            </span>
            <span className="text-[9px] font-bold text-black/60 uppercase tracking-widest block">
              SISTEMA_OPERATIVO
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <NotificationBell isDark={false} />
          <button
            onClick={toggleMobileMenu}
            aria-label="Menú"
            className="px-3 py-1.5 bg-black text-white text-xs font-black uppercase tracking-wider rounded-none"
          >
            GRID [M]
          </button>
        </div>
      </header>
    );
  }

  // 3. TERMINAL HEADER: Monospace console status bar with live indicator
  if (variant === 'terminal') {
    return (
      <header className="md:hidden sticky top-0 z-20 bg-[#0B0F19] text-stone-200 px-3 py-2 flex items-center justify-between border-b border-[#1F2937] font-mono h-14 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold text-sky-400 lowercase">uwi@pos:~#</span>
          <span className="text-[11px] text-stone-400 hidden sm:inline">{displayTitle}</span>
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-[10px] text-emerald-400 font-bold border border-[#1F2937] px-1.5 py-0.5">
            [ONLINE]
          </span>
          <NotificationBell isDark={true} />
          <button
            onClick={toggleMobileMenu}
            aria-label="Menú consola"
            className="px-2.5 py-1 bg-[#1F2937] hover:bg-[#374151] text-sky-400 text-xs font-bold border border-sky-500/30"
          >
            &gt; CMD
          </button>
        </div>
      </header>
    );
  }

  // 4. AURORA HEADER: Translucent floating glass bar with ambient glow
  if (variant === 'aurora') {
    return (
      <header className="md:hidden sticky top-0 z-20 bg-[#0D1117]/80 backdrop-blur-md text-white px-4 py-2 flex items-center justify-between border-b border-[#30363D] h-14 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 rounded-xl bg-violet-600/30 border border-violet-400/40 flex items-center justify-center p-1">
            <UwiLogo variant="static" theme="white" size="xs" showText={false} />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-white block leading-none">
              uwi
            </span>
            <span className="text-[10px] text-violet-300 font-medium leading-none">
              {displayTitle}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <NotificationBell isDark={true} />
          <button
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
            className="px-3 py-1.5 rounded-xl bg-violet-600/20 hover:bg-violet-600/30 text-violet-200 border border-violet-500/40 text-xs font-bold transition-all"
          >
            Menú
          </button>
        </div>
      </header>
    );
  }

  // 5. NEO HEADER: Cyber platform with neon micro-glow
  if (variant === 'neo') {
    return (
      <header className="md:hidden sticky top-0 z-20 bg-[#0A0B0E] text-white px-4 py-2 flex items-center justify-between border-b border-[#1F2737] h-14 shrink-0">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-[#12151C] border border-[#00F59B]/40 flex items-center justify-center p-1">
            <UwiLogo variant="static" theme="gradient" size="xs" showText={false} />
          </div>
          <span className="text-xs font-mono font-black tracking-widest text-[#00F59B] uppercase">
            [ UWI.SYS ]
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <NotificationBell isDark={true} />
          <button
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
            className="px-3 py-1.5 rounded-lg bg-[#181D27] hover:bg-[#222A3A] text-[#00F59B] border border-[#00F59B]/30 text-xs font-mono font-bold transition-all shadow-[0_0_8px_rgba(0,245,155,0.15)]"
          >
            [ MENU ]
          </button>
        </div>
      </header>
    );
  }

  // 6. BENTO HEADER: Rounded modular pill header
  if (variant === 'bento') {
    return (
      <header className="md:hidden sticky top-0 z-20 bg-white/90 backdrop-blur-md text-stone-900 px-4 py-2 flex items-center justify-between border-b border-stone-200 h-14 shrink-0 shadow-xs">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center font-bold p-1 border border-sky-100">
            <UwiLogo variant="static" theme="gradient" size="xs" showText={false} />
          </div>
          <div>
            <span className="text-sm font-black text-stone-900 lowercase leading-none block">uwi</span>
            <span className="text-[10px] text-stone-500 font-semibold">{displayTitle}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <NotificationBell isDark={false} />
          <button
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
            className="px-3.5 py-1.5 rounded-2xl bg-[#0284C7] hover:bg-[#0369A1] text-white text-xs font-black shadow-xs transition-all"
          >
            Menú
          </button>
        </div>
      </header>
    );
  }

  // 7. EMERALD HEADER: Commercial retail merchant header
  if (variant === 'emerald') {
    return (
      <header className="md:hidden sticky top-0 z-20 bg-[#008060] text-white px-4 py-2 flex items-center justify-between shadow-xs border-b border-[#006E52] h-14 shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="w-7 h-7 bg-white/10 rounded-lg p-1 border border-white/20">
            <UwiLogo variant="static" theme="white" size="xs" showText={false} />
          </div>
          <div>
            <span className="text-base font-black tracking-tight text-white lowercase leading-none block">uwi</span>
            <span className="text-[10px] text-emerald-100 font-bold">{displayTitle}</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <NotificationBell isDark={true} />
          <button
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
            className="px-3 py-1.5 rounded-lg bg-[#006E52] hover:bg-[#005842] text-white font-bold text-xs border border-white/20 transition-all"
          >
            Menú
          </button>
        </div>
      </header>
    );
  }

  // 8. STANDARD CLEAN HEADER (Default)
  return (
    <header className="md:hidden sticky top-0 z-20 bg-stone-900 text-white px-4 py-2 flex items-center justify-between shadow-xs border-b border-stone-800 h-14 shrink-0">
      <div className="flex items-center space-x-2.5">
        <UwiLogo variant="static" theme="gradient" size="xs" showText={false} className="w-7 h-7 bg-stone-800 rounded-lg p-1" />
        <span className="text-base font-black tracking-tight text-white lowercase">uwi</span>
      </div>

      <div className="flex items-center space-x-2">
        <NotificationBell isDark={true} />
        <button
          onClick={toggleMobileMenu}
          id="btn-mobile-menu-trigger"
          aria-label={isMobileMenuOpen ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={isMobileMenuOpen}
          className="min-h-[44px] min-w-[44px] px-3 py-2 rounded bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-white flex items-center justify-center gap-1.5 text-xs font-bold cursor-pointer transition-all active:scale-95 border border-stone-700"
        >
          <Menu className="w-4 h-4 text-white shrink-0" />
          <span>Menú</span>
        </button>
      </div>
    </header>
  );
};
