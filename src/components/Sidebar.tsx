import React from 'react';
import { useAuth } from '../lib/authContext';
import { useNavigation } from '../lib/navigationContext';
import { useTheme } from '../lib/themeContext';
import { usePwa } from '../lib/usePwa';
import { getThemeVariant, ThemeVariantType } from '../lib/themeVariant';
import { NotificationBell } from './NotificationBell';
import { UwiLogo } from './UwiLogo';
import { 
  User, 
  LogOut, 
  ChevronRight, 
  ChevronLeft, 
  X,
  Store,
  Terminal as TerminalIcon,
  Layers,
  Sparkles,
  Compass,
  Cpu
} from 'lucide-react';

interface SidebarProps {
  variant?: 'desktop' | 'drawer';
  themeOverride?: ThemeVariantType;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  variant = 'desktop',
  themeOverride 
}) => {
  const { userProfile, business, logout } = useAuth();
  const { 
    navItems, 
    isSidebarCollapsed, 
    toggleSidebar, 
    setIsMobileMenuOpen 
  } = useNavigation();
  const { isInstallable, isStandalone, promptInstall } = usePwa();
  const { activeTheme } = useTheme();

  const themeVariant = themeOverride || getThemeVariant(activeTheme?.id, activeTheme?.layoutStyle);

  if (!userProfile) return null;

  const isDrawer = variant === 'drawer';

  const getRoleLabel = () => {
    switch (userProfile.role) {
      case 'SUPER_ADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Administrador';
      case 'SELLER':
        return 'Vendedor / Caja';
      default:
        return 'Usuario';
    }
  };

  const closeMenuIfMobile = () => {
    if (isDrawer) {
      setIsMobileMenuOpen(false);
    }
  };

  const handleMarketIconClick = () => {
    const posItem = navItems.find((item) => item.id === 'pos');
    if (posItem) {
      posItem.onClick();
    }
    if (isDrawer) {
      setIsMobileMenuOpen(false);
    } else {
      toggleSidebar();
    }
  };

  // =========================================================================
  // 1. EDITORIAL SIDEBAR VARIANT
  // Publication table-of-contents masthead, numbered sections (01., 02.), serif titles, hairlines
  // =========================================================================
  if (themeVariant === 'editorial') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-[#FAFAF9] text-stone-900 border-r-2 border-stone-900 select-none font-serif ${
          isDrawer 
            ? 'w-80 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-72 lg:w-76 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        {/* Editorial Masthead */}
        <div className="p-5 border-b-2 border-stone-900 bg-white shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-sans font-black uppercase tracking-widest text-stone-500">
              UWI · Vol. 2026
            </span>
            {isDrawer && (
              <button onClick={closeMenuIfMobile} className="p-1 hover:bg-stone-100 text-stone-900">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <h2 className="text-2xl font-serif font-black tracking-tight mt-1 text-stone-900 lowercase">
            uwi
          </h2>
          <p className="text-xs font-sans text-stone-600 font-medium italic mt-0.5">
            {business?.name || 'Índice de Operaciones'}
          </p>
        </div>

        {/* User Chapter */}
        <div className="px-5 py-3 border-b border-stone-300 bg-stone-100/50 flex items-center justify-between font-sans text-xs">
          <div className="truncate">
            <span className="font-bold text-stone-900 block truncate">{userProfile.displayName}</span>
            <span className="text-[10px] text-stone-500 uppercase tracking-wider">{getRoleLabel()}</span>
          </div>
          <NotificationBell isDark={false} />
        </div>

        {/* Numbered Table of Contents Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 font-sans">
          <div className="text-[9px] font-black uppercase tracking-widest text-stone-400 px-2 py-1">
            Índice de Contenido
          </div>
          {navItems.map((item, idx) => {
            const indexStr = String(idx + 1).padStart(2, '0');
            return (
              <button
                key={item.id}
                onClick={() => {
                  item.onClick();
                  closeMenuIfMobile();
                }}
                className={`w-full text-left py-2.5 px-3 flex items-center justify-between transition-all cursor-pointer ${
                  item.isActive
                    ? 'border-l-4 border-stone-900 bg-stone-200/60 font-black text-stone-950 pl-3'
                    : 'text-stone-700 hover:text-stone-950 hover:bg-stone-100 border-l-4 border-transparent font-medium'
                }`}
              >
                <div className="flex items-center space-x-2.5 truncate">
                  <span className="font-mono text-xs text-stone-400 font-bold">{indexStr}.</span>
                  <span className="text-xs truncate">{item.label.replace(/^(\p{Extended_Pictographic}|\p{Emoji})\s*/u, '')}</span>
                </div>
                {item.isActive && <span className="text-xs font-serif italic">→</span>}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-4 border-t-2 border-stone-900 font-sans text-xs flex items-center justify-between bg-white shrink-0">
          <button
            onClick={() => logout()}
            className="text-xs font-bold text-stone-600 hover:text-red-700 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
          {!isDrawer && (
            <button onClick={toggleSidebar} className="p-1 hover:bg-stone-100 text-stone-600 cursor-pointer" title="Colapsar">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 2. SWISS SIDEBAR VARIANT
  // Strict orthogonal grid, 0px radius, stark 2px solid black borders, uppercase grotesque typography
  // =========================================================================
  if (themeVariant === 'swiss') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-white text-black border-r-2 border-black select-none font-sans rounded-none ${
          isDrawer 
            ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        {/* Swiss Brand Block */}
        <div className="p-4 bg-black text-white border-b-2 border-black flex items-center justify-between shrink-0">
          <div>
            <div className="text-[9px] font-black tracking-widest uppercase text-stone-300">
              SWISS_GRID / 01
            </div>
            <h2 className="text-xl font-black tracking-tighter uppercase leading-none mt-0.5">
              UWI
            </h2>
          </div>
          {isDrawer ? (
            <button onClick={closeMenuIfMobile} className="p-1 text-white hover:bg-stone-800">
              <X className="w-5 h-5" />
            </button>
          ) : (
            <NotificationBell isDark={true} />
          )}
        </div>

        {/* User Bar */}
        <div className="p-3 border-b-2 border-black bg-white flex items-center justify-between text-xs font-black uppercase tracking-wider">
          <span className="truncate">{userProfile.displayName}</span>
          <span className="bg-black text-white text-[9px] px-1.5 py-0.5">{getRoleLabel()}</span>
        </div>

        {/* Swiss Grid Navigation Items */}
        <div className="flex-1 overflow-y-auto divide-y-2 divide-black">
          {navItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              className={`w-full py-3.5 px-4 text-left font-black text-xs uppercase tracking-wider flex items-center justify-between transition-colors cursor-pointer ${
                item.isActive 
                  ? 'bg-black text-white' 
                  : 'bg-white text-black hover:bg-stone-100'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="font-mono text-[11px] text-stone-400">[{String(idx + 1).padStart(2, '0')}]</span>
                <span className="truncate">{item.label.replace(/^(\p{Extended_Pictographic}|\p{Emoji})\s*/u, '')}</span>
              </div>
              {item.isActive && <span>■</span>}
            </button>
          ))}
        </div>

        {/* Swiss Footer */}
        <div className="p-3 border-t-2 border-black bg-white flex items-center justify-between text-xs font-black uppercase">
          <button
            onClick={() => logout()}
            className="text-black hover:bg-black hover:text-white px-2 py-1 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>LOGOUT</span>
          </button>
          {!isDrawer && (
            <button onClick={toggleSidebar} className="p-1 hover:bg-black hover:text-white cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 3. TERMINAL SIDEBAR VARIANT
  // Monospace console, telemetry indicators, wireframe borders, terminal prompt syntax
  // =========================================================================
  if (themeVariant === 'terminal') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-[#0B0F19] text-stone-200 border-r border-[#1F2937] select-none font-mono text-xs ${
          isDrawer 
            ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        {/* Terminal Header */}
        <div className="p-3 bg-[#111827] border-b border-[#1F2937] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
            <div>
              <div className="text-[10px] text-sky-400 font-bold">UWI_TERMINAL_V1</div>
              <div className="text-[9px] text-stone-500">{business?.name || 'SYS.ONLINE'}</div>
            </div>
          </div>
          {isDrawer ? (
            <button onClick={closeMenuIfMobile} className="text-stone-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <NotificationBell isDark={true} />
          )}
        </div>

        {/* User Terminal Status */}
        <div className="p-2.5 border-b border-[#1F2937] text-[10px] text-stone-400 flex items-center justify-between">
          <span className="text-sky-300 truncate">&gt; {userProfile.displayName}</span>
          <span className="text-emerald-400">[AUTH_OK]</span>
        </div>

        {/* Terminal Command Navigation */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="text-[9px] text-stone-500 uppercase px-2 py-1">
            // COMMAND_ROUTER
          </div>
          {navItems.map((item, idx) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              className={`w-full py-2 px-2.5 text-left flex items-center justify-between transition-all cursor-pointer border ${
                item.isActive
                  ? 'bg-[#1F2937] text-sky-400 border-sky-500/40 shadow-[0_0_8px_rgba(56,189,248,0.15)] font-bold'
                  : 'bg-transparent text-stone-400 border-transparent hover:bg-[#111827] hover:text-stone-200'
              }`}
            >
              <div className="flex items-center space-x-2 truncate">
                <span className="text-stone-500 text-[10px]">&gt;</span>
                <span className="truncate">{item.label.replace(/^(\p{Extended_Pictographic}|\p{Emoji})\s*/u, '')}</span>
              </div>
              <span className="text-[9px] text-stone-500">[{String(idx + 1).padStart(2, '0')}]</span>
            </button>
          ))}
        </div>

        {/* Terminal Footer */}
        <div className="p-2.5 border-t border-[#1F2937] bg-[#111827] flex items-center justify-between text-[10px]">
          <button
            onClick={() => logout()}
            className="text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer"
          >
            [EXIT]
          </button>
          {!isDrawer && (
            <button onClick={toggleSidebar} className="text-stone-500 hover:text-stone-300 cursor-pointer">
              &lt;&lt; HIDE
            </button>
          )}
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 4. BENTO SIDEBAR VARIANT
  // Apple Bento Grid modular layout with smooth 24px capsules and grouped tiles
  // =========================================================================
  if (themeVariant === 'bento') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-[#F1F5F9] text-stone-900 select-none p-3 ${
          isDrawer 
            ? 'w-80 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-72 lg:w-76 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-xs mb-3 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-50 text-[#0284C7] flex items-center justify-center font-bold">
                <UwiLogo variant="static" theme="gradient" size="xs" showText={false} />
              </div>
              <div>
                <h2 className="text-base font-black text-stone-900 lowercase leading-none">uwi</h2>
                <p className="text-xs text-stone-500 font-bold truncate mt-0.5">{business?.name || 'Modular'}</p>
              </div>
            </div>
            {isDrawer ? (
              <button onClick={closeMenuIfMobile} className="p-1 rounded-xl bg-stone-100 text-stone-600">
                <X className="w-4 h-4" />
              </button>
            ) : (
              <NotificationBell isDark={false} />
            )}
          </div>
        </div>

        {/* Navigation Bento Tile */}
        <div className="bg-white rounded-3xl p-3 border border-stone-200 shadow-xs flex-1 overflow-y-auto space-y-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-3 py-1">
            Módulos
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              className={`w-full py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                item.isActive
                  ? 'bg-[#0284C7] text-white shadow-xs'
                  : 'bg-stone-50 hover:bg-stone-100 text-stone-700'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.isActive && <span className="w-2 h-2 rounded-full bg-white"></span>}
            </button>
          ))}
        </div>

        {/* User Bento Tile */}
        <div className="bg-white rounded-3xl p-3 border border-stone-200 shadow-xs mt-3 flex items-center justify-between shrink-0">
          <div className="truncate">
            <div className="text-xs font-black text-stone-900 truncate">{userProfile.displayName}</div>
            <div className="text-[10px] text-stone-400 font-bold uppercase">{getRoleLabel()}</div>
          </div>
          <button
            onClick={() => logout()}
            className="w-9 h-9 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 flex items-center justify-center cursor-pointer transition-colors"
            title="Cerrar Sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 5. AURORA SIDEBAR VARIANT
  // Floating atmospheric glassmorphism with layered ambient glow and gradient accents
  // =========================================================================
  if (themeVariant === 'aurora') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-[#0D1117] text-white border-r border-[#30363D] select-none ${
          isDrawer 
            ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        {/* Ambient Top */}
        <div className="p-4 border-b border-[#30363D] bg-gradient-to-r from-violet-900/30 via-transparent to-emerald-900/20 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-violet-600/30 border border-violet-500/40 flex items-center justify-center p-1.5">
              <UwiLogo variant="static" theme="white" size="xs" showText={false} />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white leading-none">uwi</h2>
              <span className="text-[10px] text-violet-300 font-medium">{business?.name || 'Aurora'}</span>
            </div>
          </div>
          {isDrawer ? (
            <button onClick={closeMenuIfMobile} className="p-1 text-stone-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <NotificationBell isDark={true} />
          )}
        </div>

        {/* User Card */}
        <div className="p-3 border-b border-[#30363D] bg-[#161B22]/60 flex items-center justify-between text-xs">
          <div className="truncate">
            <div className="font-bold text-stone-200 truncate">{userProfile.displayName}</div>
            <div className="text-[10px] text-violet-400 font-semibold">{getRoleLabel()}</div>
          </div>
        </div>

        {/* Aurora Navigation Links */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          <div className="text-[10px] font-bold text-stone-500 uppercase px-2 py-1">
            Plataforma
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                item.isActive
                  ? 'bg-gradient-to-r from-violet-600 to-emerald-600 text-white shadow-[0_0_15px_rgba(139,92,246,0.3)]'
                  : 'text-stone-300 hover:bg-[#161B22] hover:text-white'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.isActive && <Sparkles className="w-3.5 h-3.5 text-white" />}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#30363D] bg-[#161B22] flex items-center justify-between text-xs">
          <button
            onClick={() => logout()}
            className="text-stone-400 hover:text-red-400 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir</span>
          </button>
          {!isDrawer && (
            <button onClick={toggleSidebar} className="p-1 hover:bg-stone-800 text-stone-400 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 6. NEO SIDEBAR VARIANT
  // Cyber HUD telemetry platform with neon micro-glow and tech borders
  // =========================================================================
  if (themeVariant === 'neo') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-[#0A0B0E] text-white border-r border-[#1F2737] select-none font-mono text-xs ${
          isDrawer 
            ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        <div className="p-3.5 bg-[#12151C] border-b border-[#1F2737] flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-[#00F59B] shadow-[0_0_8px_#00F59B]"></span>
            <span className="text-xs font-black text-[#00F59B] uppercase tracking-widest">[ UWI.NEO ]</span>
          </div>
          {isDrawer ? (
            <button onClick={closeMenuIfMobile} className="text-stone-400 hover:text-white p-1">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <NotificationBell isDark={true} />
          )}
        </div>

        {/* User Card */}
        <div className="p-2.5 border-b border-[#1F2737] text-[10px] text-stone-400 flex items-center justify-between bg-[#0E1015]">
          <span className="text-stone-300 truncate">OP: {userProfile.displayName}</span>
          <span className="text-[#00F59B]">{getRoleLabel()}</span>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <div className="text-[9px] text-stone-500 uppercase px-2 py-1">
            [ NAVIGATION_MATRIX ]
          </div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              className={`w-full py-2 px-3 rounded-lg text-left flex items-center justify-between transition-all cursor-pointer ${
                item.isActive
                  ? 'bg-[#181D27] text-[#00F59B] border border-[#00F59B]/50 shadow-[0_0_10px_rgba(0,245,155,0.15)] font-bold'
                  : 'text-stone-400 hover:bg-[#12151C] hover:text-stone-200'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.isActive && <span className="text-[#00F59B]">●</span>}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-2.5 border-t border-[#1F2737] bg-[#12151C] flex items-center justify-between text-[10px]">
          <button
            onClick={() => logout()}
            className="text-[#FF3366] hover:text-red-400 cursor-pointer"
          >
            [ LOGOUT ]
          </button>
          {!isDrawer && (
            <button onClick={toggleSidebar} className="text-stone-500 hover:text-stone-300 cursor-pointer">
              &lt; HIDE &gt;
            </button>
          )}
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 7. EMERALD SIDEBAR VARIANT
  // Commercial retail navigation, green identity, structured categories
  // =========================================================================
  if (themeVariant === 'emerald') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-white border-r border-[#D9E3DF] select-none ${
          isDrawer 
            ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        <div className="h-16 px-4 bg-[#008060] text-white flex items-center justify-between border-b border-[#006E52] shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <button
              onClick={handleMarketIconClick}
              className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white flex items-center justify-center font-bold shadow-xs shrink-0 cursor-pointer transition-all p-1.5 border border-white/20"
            >
              <UwiLogo variant="static" theme="white" size="xs" showText={false} />
            </button>
            <div className="min-w-0 flex-1">
              <h2 className="font-black text-base tracking-tight text-white leading-tight lowercase">uwi</h2>
              <p className="text-[11px] text-emerald-100 font-semibold truncate leading-tight mt-0.5">
                {business?.name || 'Comercio'}
              </p>
            </div>
          </div>
          {isDrawer ? (
            <button onClick={closeMenuIfMobile} className="p-1 rounded bg-[#006E52] text-white">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <NotificationBell isDark={true} />
          )}
        </div>

        {/* User info */}
        <div className="p-3 bg-[#F4F6F5] border-b border-[#D9E3DF] flex items-center justify-between text-xs">
          <div className="truncate">
            <p className="font-bold text-stone-900 truncate">{userProfile.displayName}</p>
            <p className="text-[10px] text-stone-500 font-medium">{getRoleLabel()}</p>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-2.5 flex-1 overflow-y-auto space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-[#008060] px-2 pt-1 pb-1">
            GESTIÓN COMERCIAL
          </p>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              className={`w-full p-2.5 rounded-xl font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                item.isActive
                  ? 'bg-[#008060] text-white shadow-xs'
                  : 'bg-white hover:bg-[#EDF3F0] text-stone-700 border border-[#D9E3DF]'
              }`}
            >
              <span className="truncate">{item.label}</span>
              {item.isActive && <span className="w-1.5 h-1.5 rounded-full bg-white"></span>}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#D9E3DF] bg-[#F4F6F5] flex items-center justify-between text-xs">
          <button
            onClick={() => logout()}
            className="text-stone-600 hover:text-red-600 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
          {!isDrawer && (
            <button onClick={toggleSidebar} className="p-1 hover:bg-stone-200 text-stone-600 cursor-pointer">
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 8. SOFT SIDEBAR VARIANT
  // Warm, rounded pill navigation elements, approachable friendly vibe
  // =========================================================================
  if (themeVariant === 'soft') {
    return (
      <aside 
        id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
        className={`flex flex-col bg-[#FAF9F6] text-stone-800 border-r border-stone-200 select-none p-3 ${
          isDrawer 
            ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
            : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
        }`}
      >
        <div className="bg-white rounded-3xl p-4 border border-stone-200 shadow-2xs mb-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <UwiLogo variant="static" theme="gradient" size="xs" showText={false} />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-800 lowercase leading-none">uwi</h2>
              <p className="text-xs text-stone-400 font-semibold truncate mt-0.5">{business?.name || 'Comercio'}</p>
            </div>
          </div>
          {isDrawer ? (
            <button onClick={closeMenuIfMobile} className="p-1 text-stone-500">
              <X className="w-4 h-4" />
            </button>
          ) : (
            <NotificationBell isDark={false} />
          )}
        </div>

        {/* Soft Navigation */}
        <div className="bg-white rounded-3xl p-3 border border-stone-200 shadow-2xs flex-1 overflow-y-auto space-y-1">
          <div className="text-[10px] font-bold text-stone-400 px-3 py-1">Menú</div>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              className={`w-full py-2.5 px-3 rounded-2xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                item.isActive
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              <span className="truncate">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="bg-white rounded-3xl p-3 border border-stone-200 shadow-2xs mt-3 flex items-center justify-between shrink-0 text-xs">
          <button
            onClick={() => logout()}
            className="text-stone-500 hover:text-red-500 font-bold flex items-center gap-1 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Salir</span>
          </button>
        </div>
      </aside>
    );
  }

  // =========================================================================
  // 9. CLEAN SIDEBAR VARIANT (Default UWI Clean)
  // Minimalist, modern, discrete SaaS sidebar
  // =========================================================================
  return (
    <aside 
      id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
      className={`flex flex-col bg-white border-r border-stone-200 select-none ${
        isDrawer 
          ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
          : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
      }`}
    >
      {/* 1. Top Header */}
      <div className="h-16 px-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={handleMarketIconClick}
            className="w-10 h-10 rounded-xl bg-stone-800 hover:bg-stone-700 active:scale-95 text-white flex items-center justify-center font-bold shadow-xs shrink-0 cursor-pointer transition-all p-1.5 border border-stone-700"
          >
            <UwiLogo variant="static" theme="gradient" size="xs" showText={false} />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-base tracking-tight text-white leading-tight lowercase">uwi</h2>
            <p className="text-[11px] text-stone-400 font-semibold truncate leading-tight mt-0.5">
              {business?.name || 'Comercio'}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <NotificationBell isDark={true} />
          <button
            onClick={() => {
              if (isDrawer) {
                setIsMobileMenuOpen(false);
              } else {
                toggleSidebar();
              }
            }}
            className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {isDrawer ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 2. User Info */}
      <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center space-x-3 shrink-0">
        <div className="w-9 h-9 rounded-lg bg-stone-200 text-stone-700 flex items-center justify-center shrink-0 font-bold text-xs">
          <User className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-stone-900 truncate leading-snug">
            {userProfile.displayName}
          </p>
          <span className="inline-block px-1.5 py-0.2 rounded text-[10px] font-bold bg-stone-200 text-stone-700 mt-0.5">
            {getRoleLabel()}
          </span>
        </div>
      </div>

      {/* 3. Navigation */}
      <div className="p-2.5 flex-1 overflow-y-auto space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400 px-2 pt-1 pb-1">
          MENÚ PRINCIPAL
        </p>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              item.onClick();
              closeMenuIfMobile();
            }}
            className={`w-full p-2.5 rounded-lg font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
              item.isActive
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200/70'
            }`}
          >
            <span className="truncate">{item.label}</span>
          </button>
        ))}
      </div>

      {/* 4. Footer */}
      <div className="p-3 border-t border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
        <button
          onClick={() => logout()}
          className="text-xs font-bold text-stone-600 hover:text-red-600 flex items-center gap-1.5 cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          <span>Cerrar Sesión</span>
        </button>
      </div>
    </aside>
  );
};
