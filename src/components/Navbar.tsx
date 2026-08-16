import React from 'react';
import { useAuth } from '../lib/authContext';
import { Store, UserCheck, LogOut, ShieldAlert, Building2 } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { userProfile, business, logout } = useAuth();

  if (!userProfile) return null;

  const getRoleBadge = () => {
    switch (userProfile.role) {
      case 'SUPER_ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300">Super Admin</span>;
      case 'ADMIN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">Administrador</span>;
      case 'SELLER':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Vendedor / Caja</span>;
      default:
        return null;
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-stone-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand Logo & Context */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-xs">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-stone-900 tracking-tight">MiniMarket</h1>
              <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded-md font-medium border border-stone-200">
                MVP Sprint 0
              </span>
            </div>
            {business && (
              <p className="text-xs text-stone-500 flex items-center space-x-1">
                <Building2 className="w-3 h-3 text-stone-400" />
                <span className="font-medium text-stone-700">{business.name}</span>
                <span className={`inline-block w-2 h-2 rounded-full ${business.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
              </p>
            )}
          </div>
        </div>

        {/* User Info & Actions */}
        <div className="flex items-center space-x-4">
          <div className="hidden sm:flex flex-col items-end">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-stone-800">{userProfile.displayName}</span>
              {getRoleBadge()}
            </div>
            <span className="text-xs text-stone-500">{userProfile.email}</span>
          </div>

          <button
            onClick={() => logout()}
            className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 border border-stone-300 rounded-lg text-sm font-medium text-stone-700 bg-white hover:bg-stone-50 transition-colors shadow-2xs"
            title="Cerrar sesión"
            id="logout-btn"
          >
            <LogOut className="w-4 h-4 text-stone-500" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
};
