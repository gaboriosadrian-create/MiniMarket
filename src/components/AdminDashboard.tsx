import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { getUsersByBusiness, createSellerForBusiness } from '../lib/businessService';
import { ProductManagement } from './ProductManagement';
import { PosCaja } from './PosCaja';
import { SalesList } from './SalesList';
import { CajaSummary } from './CajaSummary';
import { PurchaseManagement } from './PurchaseManagement';
import { ExpenseManagement } from './ExpenseManagement';
import { DailyControlOverview } from './DailyControlOverview';
import { UserProfile } from '../types';
import { 
  Building2, 
  Store, 
  Package, 
  Boxes, 
  ShoppingCart, 
  Receipt, 
  TrendingUp, 
  BarChart3, 
  Users, 
  Clock, 
  AlertTriangle,
  Plus,
  UserCheck,
  X,
  Mail,
  Lock,
  User,
  CheckCircle2,
  LayoutDashboard,
  Calculator
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { userProfile, business } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'pos' | 'control' | 'ventas' | 'caja' | 'compras' | 'gastos' | 'products' | 'sellers'
  >('pos');

  // Sellers management
  const [sellers, setSellers] = useState<UserProfile[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(false);
  const [showAddSellerModal, setShowAddSellerModal] = useState(false);
  const [sellerName, setSellerName] = useState('');
  const [sellerEmail, setSellerEmail] = useState('');
  const [sellerPassword, setSellerPassword] = useState('123');
  const [savingSeller, setSavingSeller] = useState(false);

  const loadSellers = async () => {
    if (!business?.id) return;
    setLoadingSellers(true);
    try {
      const usersList = await getUsersByBusiness(business.id);
      setSellers(usersList.filter((u) => u.role === 'SELLER'));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingSellers(false);
    }
  };

  useEffect(() => {
    loadSellers();
  }, [business?.id]);

  const handleAddSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!business?.id || !sellerName.trim() || !sellerEmail.trim()) return;

    setSavingSeller(true);
    try {
      await createSellerForBusiness({
        sellerName,
        sellerEmail,
        sellerPassword,
        businessId: business.id
      });
      setSellerName('');
      setSellerEmail('');
      setSellerPassword('123');
      setShowAddSellerModal(false);
      await loadSellers();
    } catch (err: any) {
      alert('Error al crear vendedor: ' + err.message);
    } finally {
      setSavingSeller(false);
    }
  };

  if (!business) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-xl font-bold text-red-900">Negocio No Encontrado</h3>
        <p className="text-sm text-red-700">
          Su usuario no tiene un negocio válido asignado o el negocio fue eliminado. Contacte al Administrador del Sistema.
        </p>
      </div>
    );
  }

  const isInactive = business.status === 'inactive';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      
      {/* Inactive Business Warning Banner */}
      {isInactive && (
        <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-4 flex items-center space-x-3 text-red-800">
          <AlertTriangle className="w-6 h-6 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-sm">Este negocio se encuentra INACTIVO</p>
            <p className="text-xs text-red-700">
              El Super Admin ha desactivado las operaciones para {business.name}.
            </p>
          </div>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-6 border border-stone-200 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
              Panel de Administración
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              isInactive ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {isInactive ? 'Inactivo' : 'Operativo'}
            </span>
          </div>

          <h2 className="text-2xl sm:text-3xl font-extrabold text-stone-900 mt-2 tracking-tight">
            {business.name}
          </h2>
          <p className="text-sm text-stone-500 mt-0.5">
            Administrador: <span className="font-semibold text-stone-800">{userProfile?.displayName}</span> ({userProfile?.email})
          </p>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-1.5 w-full md:w-auto justify-start sm:justify-end overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('pos')}
            id="tab-admin-pos"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'pos' ? 'bg-stone-900 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-emerald-400" />
            <span>POS / Caja</span>
          </button>

          <button
            onClick={() => setActiveTab('control')}
            id="tab-control-diario"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'control' ? 'bg-stone-900 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
            <span>Control Diario</span>
          </button>

          <button
            onClick={() => setActiveTab('ventas')}
            id="tab-ventas"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'ventas' ? 'bg-emerald-600 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ventas</span>
          </button>

          <button
            onClick={() => setActiveTab('caja')}
            id="tab-caja-summary"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'caja' ? 'bg-stone-800 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Store className="w-3.5 h-3.5 text-amber-400" />
            <span>Resumen Caja</span>
          </button>

          <button
            onClick={() => setActiveTab('compras')}
            id="tab-compras"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'compras' ? 'bg-amber-600 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Compras</span>
          </button>

          <button
            onClick={() => setActiveTab('gastos')}
            id="tab-gastos"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'gastos' ? 'bg-rose-600 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Gastos</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            id="tab-products"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'products' ? 'bg-indigo-600 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Productos</span>
          </button>

          <button
            onClick={() => setActiveTab('sellers')}
            id="tab-sellers"
            className={`px-3 py-2 rounded-xl font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
              activeTab === 'sellers' ? 'bg-blue-600 text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Vendedores</span>
          </button>
        </div>
      </div>

      {/* POS / CAJA MODULE */}
      {activeTab === 'pos' && (
        <PosCaja />
      )}

      {/* CONTROL DIARIO / DASHBOARD OVERVIEW */}
      {activeTab === 'control' && (
        <DailyControlOverview />
      )}

      {/* VENTAS LIST */}
      {activeTab === 'ventas' && (
        <SalesList />
      )}

      {/* CAJA SUMMARY */}
      {activeTab === 'caja' && (
        <CajaSummary />
      )}

      {/* COMPRAS MANAGEMENT */}
      {activeTab === 'compras' && (
        <PurchaseManagement />
      )}

      {/* GASTOS MANAGEMENT */}
      {activeTab === 'gastos' && (
        <ExpenseManagement />
      )}

      {/* PRODUCTS & INVENTORY MODULE */}
      {activeTab === 'products' && (
        <ProductManagement />
      )}

      {/* SELLERS MANAGEMENT VIEW */}
      {activeTab === 'sellers' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-stone-900">Vendedores Asignados</h3>
              <p className="text-xs text-stone-500">
                Usuarios con rol de Vendedor/Cajero en {business.name}.
              </p>
            </div>

            <button
              onClick={() => setShowAddSellerModal(true)}
              id="btn-add-seller"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Vendedor</span>
            </button>
          </div>

          <div className="divide-y divide-stone-200 border border-stone-200 rounded-xl overflow-hidden">
            {sellers.length === 0 ? (
              <div className="p-8 text-center text-stone-500 text-sm">
                No hay vendedores registrados aún para este negocio. Haz clic en "+ Nuevo Vendedor" para agregar uno.
              </div>
            ) : (
              sellers.map((s) => (
                <div key={s.uid} className="p-4 flex items-center justify-between bg-white hover:bg-stone-50">
                  <div className="flex items-center space-x-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-sm">
                      {s.displayName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-stone-900">{s.displayName}</p>
                      <p className="text-xs text-stone-500">{s.email}</p>
                    </div>
                  </div>

                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" /> Vendedor
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Modal: Crear Vendedor */}
      {showAddSellerModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <h3 className="text-lg font-bold text-stone-900">Agregar Vendedor</h3>
              <button
                onClick={() => setShowAddSellerModal(false)}
                className="text-stone-400 hover:text-stone-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSeller} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Nombre Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Martínez"
                  value={sellerName}
                  onChange={(e) => setSellerName(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Email del Vendedor *
                </label>
                <input
                  type="email"
                  required
                  placeholder="vendedor@kiosco.com"
                  value={sellerEmail}
                  onChange={(e) => setSellerEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Contraseña Inicial
                </label>
                <input
                  type="text"
                  placeholder="123"
                  value={sellerPassword}
                  onChange={(e) => setSellerPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-stone-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => setShowAddSellerModal(false)}
                  className="px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSeller}
                  className="px-5 py-2 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors"
                >
                  {savingSeller ? 'Guardando...' : 'Crear Vendedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

