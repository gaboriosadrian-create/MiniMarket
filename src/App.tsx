import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/authContext';
import { NavigationProvider, useNavigation } from './lib/navigationContext';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './components/LoginView';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SellerDashboard } from './components/SellerDashboard';
import { PublicOrderView } from './components/PublicOrderView';
import { NotFoundView } from './components/NotFoundView';
import { PwaStatusBanner } from './components/PwaStatusBanner';
import { Store, Menu } from 'lucide-react';

function getPublicOrderTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname;
  const hash = window.location.hash;
  const search = window.location.search;

  // 1. Check /pedido/:token in pathname
  const matchPath = pathname.match(/\/pedido\/([a-zA-Z0-9_-]+)/);
  if (matchPath && matchPath[1]) {
    return matchPath[1];
  }

  // 2. Check #/pedido/:token in hash
  const matchHash = hash.match(/#\/pedido\/([a-zA-Z0-9_-]+)/);
  if (matchHash && matchHash[1]) {
    return matchHash[1];
  }

  // 3. Check ?pedido=:token or ?token=:token in query params
  const params = new URLSearchParams(search);
  const paramToken = params.get('pedido') || params.get('token');
  if (paramToken) {
    return paramToken;
  }

  return null;
}

function isUnknownRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const pathname = window.location.pathname;
  if (!pathname || pathname === '/' || pathname === '/index.html') return false;
  if (pathname.startsWith('/pedido/')) return false;
  return true;
}

const MainAppContent: React.FC = () => {
  const { user, userProfile, loading } = useAuth();
  const { isMobileMenuOpen, setIsMobileMenuOpen, toggleMobileMenu } = useNavigation();

  if (loading) {
    return (
      <div 
        id="loading-splash-screen"
        className="min-h-screen bg-emerald-600 flex flex-col items-center justify-center p-6 select-none transition-colors"
      >
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-3xl bg-white/15 backdrop-blur-xs text-white flex items-center justify-center font-bold shadow-lg mb-4 border border-white/20 mm-logo-breath">
          <Store className="w-9 h-9 sm:w-11 sm:h-11 text-white" />
        </div>
        <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">MiniMarket</h1>
        <p className="text-sm font-bold text-white/95 mt-1">Cargando MiniMarket...</p>
        <p className="text-xs text-emerald-100/80 mt-1 font-medium text-center">Verificando sesión y permisos de acceso</p>
      </div>
    );
  }

  // Not authenticated or missing Firestore profile
  if (!user || !userProfile) {
    return <LoginView />;
  }

  // Check role-based views
  return (
    <div className="min-h-screen flex" style={{ backgroundColor: 'var(--mm-color-bg)' }}>
      {/* Persistent Left Sidebar on Desktop */}
      <Sidebar variant="desktop" />

      {/* Mobile Drawer (Slide-over Left) */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs transition-opacity"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <div className="relative z-50">
            <Sidebar variant="drawer" />
          </div>
        </div>
      )}

      {/* Main App Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header Trigger */}
        <header className="md:hidden sticky top-0 z-20 bg-stone-900 text-white px-4 py-2 flex items-center justify-between shadow-xs border-b border-stone-800 h-14 shrink-0">
          {/* Left: Branding */}
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded bg-[#006AFF] text-white flex items-center justify-center font-bold text-xs shadow-2xs">
              <Store className="w-4 h-4" />
            </div>
            <span className="text-sm font-black tracking-tight text-white">MiniMarket</span>
          </div>

          {/* Right: Hamburger Menu Button (Right thumb accessible with min 44x44px touch area) */}
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
        </header>

        <main className="flex-1">
          {userProfile.role === 'SUPER_ADMIN' && <SuperAdminDashboard />}
          {userProfile.role === 'ADMIN' && <AdminDashboard />}
          {userProfile.role === 'SELLER' && <SellerDashboard />}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-stone-200 py-2.5 px-6 text-center text-xs text-stone-500 shrink-0">
          <p className="font-semibold text-stone-700">MiniMarket 1.0 - grstudio ©2026</p>
          <p className="text-[11px] text-stone-400 mt-0.5">Sistema de punto de venta y gestión de stock</p>
        </footer>
      </div>
    </div>
  );
};

export default function App() {
  const [publicToken, setPublicToken] = useState<string | null>(() => getPublicOrderTokenFromUrl());
  const [is404, setIs404] = useState<boolean>(() => isUnknownRoute());

  useEffect(() => {
    const handleUrlChange = () => {
      setPublicToken(getPublicOrderTokenFromUrl());
      setIs404(isUnknownRoute());
    };

    window.addEventListener('popstate', handleUrlChange);
    window.addEventListener('hashchange', handleUrlChange);
    return () => {
      window.removeEventListener('popstate', handleUrlChange);
      window.removeEventListener('hashchange', handleUrlChange);
    };
  }, []);

  // If unknown 404 route
  if (is404) {
    return (
      <NotFoundView
        type="page"
        onAction={() => {
          window.location.href = '/';
        }}
        actionLabel="Ir al Panel Principal"
      />
    );
  }

  // If a public order token is detected, render the isolated public view directly
  if (publicToken) {
    return (
      <PublicOrderView
        token={publicToken}
        onExit={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  return (
    <AuthProvider>
      <NavigationProvider>
        <MainAppContent />
        <PwaStatusBanner />
      </NavigationProvider>
    </AuthProvider>
  );
}
