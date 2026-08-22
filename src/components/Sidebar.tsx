import React from 'react';
import { useAuth } from '../lib/authContext';
import { useNavigation } from '../lib/navigationContext';
import { usePwa } from '../lib/usePwa';
import { LocalDataIndicator } from './LocalDataIndicator';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import { 
  Store, 
  User, 
  LogOut, 
  ChevronRight, 
  ChevronLeft, 
  X,
  Smartphone
} from 'lucide-react';

interface SidebarProps {
  variant?: 'desktop' | 'drawer';
}

export const Sidebar: React.FC<SidebarProps> = ({ variant = 'desktop' }) => {
  const { userProfile, business, logout } = useAuth();
  const { 
    navItems, 
    isSidebarCollapsed, 
    toggleSidebar, 
    setIsMobileMenuOpen 
  } = useNavigation();
  const { isInstallable, isStandalone, promptInstall } = usePwa();

  if (!userProfile) return null;

  const isDrawer = variant === 'drawer';

  const getRoleLabel = () => {
    switch (userProfile.role) {
      case 'SUPER_ADMIN':
        return 'Administrador de plataforma';
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

  // Function to navigate to Venta/POS and toggle sidebar
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

  // Render for Collapsed Desktop State
  if (!isDrawer && isSidebarCollapsed) {
    return (
      <aside 
        id="sidebar-collapsed"
        className="hidden md:flex flex-col w-16 bg-white border-r border-stone-200 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200 select-none"
      >
        {/* Top Logo Area */}
        <div className="h-16 bg-stone-900 flex items-center justify-center border-b border-stone-800 p-2 shrink-0">
          <button
            onClick={handleMarketIconClick}
            id="btn-expand-sidebar-collapsed"
            className="w-10 h-10 rounded bg-[#006AFF] hover:bg-[#0052CC] active:scale-95 text-white flex items-center justify-center font-bold shadow-xs transition-all cursor-pointer"
            title="Expandir menú lateral e ir a Venta"
          >
            <Store className="w-5 h-5" />
          </button>
        </div>

        {/* User Avatar Mini */}
        <div className="p-2.5 flex justify-center border-b border-stone-200 bg-stone-50">
          <div 
            className="w-9 h-9 rounded bg-stone-200 text-stone-700 flex items-center justify-center font-bold"
            title={`${userProfile.displayName} (${getRoleLabel()})`}
          >
            <User className="w-4 h-4" />
          </div>
        </div>

        {/* Navigation Items (Icons only) */}
        <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 py-3">
          {navItems.map((item) => {
            const hasEmoji = item.label.match(/^(\p{Extended_Pictographic}|\p{Emoji})/u);
            const emoji = hasEmoji ? item.label.split(' ')[0] : null;

            return (
              <button
                key={item.id}
                onClick={item.onClick}
                title={item.label}
                id={`nav-item-collapsed-${item.id}`}
                className={`w-11 h-11 mx-auto rounded flex items-center justify-center transition-all cursor-pointer ${
                  item.isActive
                    ? 'bg-[#006AFF] text-white shadow-xs'
                    : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
                }`}
              >
                {emoji ? (
                  <span className="text-lg leading-none select-none">{emoji}</span>
                ) : (
                  <span className={item.isActive ? 'text-white' : 'text-stone-600'}>
                    {item.icon}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Bottom Expand Toggle & Logout Mini */}
        <div className="p-2 border-t border-stone-200 space-y-2 bg-stone-50">
          <button
            onClick={toggleSidebar}
            className="w-11 h-9 mx-auto rounded text-stone-600 hover:bg-stone-200 hover:text-stone-900 flex items-center justify-center transition-colors cursor-pointer"
            title="Expandir menú lateral"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => logout()}
            className="w-11 h-9 mx-auto rounded bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 flex items-center justify-center transition-colors cursor-pointer"
            title="Cerrar Sesión"
            id="btn-sidebar-logout-collapsed"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>
    );
  }

  // Expanded Sidebar (Square POS Professional style)
  return (
    <aside 
      id={isDrawer ? "sidebar-mobile-drawer" : "sidebar-expanded"}
      className={`flex flex-col bg-white border-r border-stone-200 select-none ${
        isDrawer 
          ? 'w-76 max-w-[85vw] h-full shadow-2xl z-50 animate-in slide-in-from-left duration-200' 
          : 'hidden md:flex w-68 lg:w-72 shrink-0 h-screen sticky top-0 z-30 transition-all duration-200'
      }`}
    >
      {/* 1. TOP HEADER */}
      <div className="h-16 px-4 bg-stone-900 text-white flex items-center justify-between border-b border-stone-800 shrink-0">
        <div className="flex items-center space-x-3 min-w-0">
          <button
            onClick={handleMarketIconClick}
            title="Ir a Venta y colapsar/expandir menú"
            id="btn-market-icon-toggle"
            className="w-9 h-9 rounded bg-[#006AFF] hover:bg-[#0052CC] active:scale-95 text-white flex items-center justify-center font-bold shadow-xs shrink-0 cursor-pointer transition-all"
          >
            <Store className="w-5 h-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h2 className="font-black text-sm tracking-tight text-white leading-tight">
              MiniMarket
            </h2>
            <p className="text-[11px] text-stone-400 font-semibold truncate leading-tight mt-0.5">
              {business?.name || 'Comercio'}
            </p>
          </div>
        </div>

        {/* Close or Collapse Button */}
        <button
          onClick={() => {
            if (isDrawer) {
              setIsMobileMenuOpen(false);
            } else {
              toggleSidebar();
            }
          }}
          className="p-1.5 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer shrink-0"
          title={isDrawer ? "Cerrar menú" : "Colapsar menú lateral"}
          id="btn-close-sidebar"
        >
          {isDrawer ? <X className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* 2. USER INFO SECTION */}
      <div className="p-3 bg-stone-50 border-b border-stone-200 flex items-center space-x-3 shrink-0">
        <div className="w-10 h-10 rounded bg-stone-200 text-stone-700 flex items-center justify-center shrink-0 font-bold">
          <User className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black text-stone-900 truncate leading-snug">
            {userProfile.displayName}
          </p>
          <p className="text-[11px] text-stone-500 truncate leading-tight">
            {userProfile.email}
          </p>
          <div className="mt-0.5">
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-stone-200 text-stone-800">
              {getRoleLabel()}
            </span>
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION SECTION */}
      <div className="p-2.5 flex-1 overflow-y-auto space-y-1">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400 px-2 pt-1 pb-1">
          MENÚ PRINCIPAL
        </p>

        {navItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-stone-400">
            No hay opciones de navegación disponibles.
          </div>
        ) : (
          navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                item.onClick();
                closeMenuIfMobile();
              }}
              id={`nav-item-${item.id}`}
              className={`w-full p-2.5 rounded font-bold text-xs flex items-center justify-between transition-all cursor-pointer ${
                item.isActive
                  ? 'bg-[#006AFF] text-white shadow-xs'
                  : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200/70 hover:border-stone-300'
              }`}
            >
              <div className="flex items-center space-x-2.5 min-w-0">
                {item.label.match(/^(\p{Extended_Pictographic}|\p{Emoji})/u) ? (
                  <>
                    <span className="text-base leading-none shrink-0 select-none">
                      {item.label.split(' ')[0]}
                    </span>
                    <span className="truncate">
                      {item.label.substring(item.label.indexOf(' ') + 1)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className={`shrink-0 ${item.isActive ? 'text-white' : 'text-stone-600'}`}>
                      {item.icon}
                    </span>
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </div>

              <ChevronRight 
                className={`w-3.5 h-3.5 shrink-0 ${item.isActive ? 'text-white' : 'text-stone-400'}`} 
              />
            </button>
          ))
        )}
      </div>

      {/* 4. BOTTOM FOOTER / CERRAR SESIÓN */}
      <div className="p-3 bg-stone-50 border-t border-stone-200 shrink-0 space-y-2">
        {/* Status badges: visible ONLY in mobile drawer (hamburger menu) */}
        {business?.id && isDrawer && (
          <div className="flex flex-col gap-1.5 pb-1 bg-stone-100/80 p-2 rounded-xl border border-stone-200">
            <LocalDataIndicator businessId={business.id} businessName={business.name} className="w-full justify-center" />
            <div className="flex justify-center">
              <SyncStatusIndicator businessId={business.id} />
            </div>
            <div className="flex justify-center">
              <span className="px-2.5 py-1 rounded-md font-bold text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>✓ Caja Lista</span>
              </span>
            </div>
          </div>
        )}

        {isInstallable && !isStandalone && (
          <button
            type="button"
            onClick={() => {
              closeMenuIfMobile();
              promptInstall();
            }}
            id="btn-sidebar-install-pwa"
            className="w-full py-2 px-3 bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 text-emerald-800 border border-emerald-300 rounded font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
          >
            <Smartphone className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            <span>Instalar MiniMarket</span>
          </button>
        )}

        <button
          onClick={() => {
            closeMenuIfMobile();
            logout();
          }}
          id="btn-sidebar-logout"
          className="w-full py-2.5 px-3 bg-red-50 hover:bg-red-100 active:bg-red-200 text-red-700 border border-red-200 rounded font-bold text-xs flex items-center justify-center space-x-2 transition-colors cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 text-red-600" />
          <span>Cerrar Sesión</span>
        </button>

        <p className="mt-2 text-[10px] text-stone-400 text-center font-mono select-none">
          MiniMarket 1.0 - grstudio ©2026
        </p>
      </div>
    </aside>
  );
};
