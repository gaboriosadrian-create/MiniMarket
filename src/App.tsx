import React from 'react';
import { AuthProvider, useAuth } from './lib/authContext';
import { Navbar } from './components/Navbar';
import { LoginView } from './components/LoginView';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { SellerDashboard } from './components/SellerDashboard';
import { Store, ShieldCheck, User, LogOut, RefreshCw } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md animate-pulse mb-4">
          <Store className="w-7 h-7" />
        </div>
        <p className="text-sm font-bold text-stone-700">Cargando MiniMarket...</p>
        <p className="text-xs text-stone-400 mt-1">Verificando sesión y reglas de acceso tenant</p>
      </div>
    );
  }

  // Not authenticated or missing Firestore profile
  if (!user || !userProfile) {
    return <LoginView />;
  }

  // Check role-based views
  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      <Navbar />

      <main className="flex-1">
        {userProfile.role === 'SUPER_ADMIN' && <SuperAdminDashboard />}
        {userProfile.role === 'ADMIN' && <AdminDashboard />}
        {userProfile.role === 'SELLER' && <SellerDashboard />}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-4 px-6 text-center text-xs text-stone-500">
        <p className="font-semibold text-stone-700">MiniMarket MVP — Sprint 0: Fundación & Multi-tenant</p>
        <p className="text-[11px] text-stone-400 mt-0.5">Aislamiento de datos activo por negocio (Firestore Security Rules)</p>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainAppContent />
    </AuthProvider>
  );
}
