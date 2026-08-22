import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { useNavigation } from '../lib/navigationContext';
import { ProductManagement } from './ProductManagement';
import { PosCaja } from './PosCaja';
import { SalesList } from './SalesList';
import { CajaSummary } from './CajaSummary';
import { PurchaseManagement } from './PurchaseManagement';
import { ExpenseManagement } from './ExpenseManagement';
import { DailyControlOverview } from './DailyControlOverview';
import { SellerManagement } from './SellerManagement';
import { ReceivingModule } from './ReceivingModule';
import { StockAdjustmentModule } from './StockAdjustmentModule';
import { ReplenishmentModule } from './ReplenishmentModule';
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
  AlertTriangle,
  LayoutDashboard,
  Calculator,
  Truck,
  SlidersHorizontal,
  ClipboardList
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { userProfile, business } = useAuth();
  const { setNavItems } = useNavigation();
  const [activeTab, setActiveTab] = useState<
    'pos' | 'control' | 'ventas' | 'caja' | 'compras' | 'gastos' | 'products' | 'receivings' | 'adjustments' | 'replenishment' | 'sellers'
  >('pos');

  // Register navigation items for Mobile Hamburger Menu & Global Navbar
  useEffect(() => {
    setNavItems([
      {
        id: 'pos',
        label: '🛒 POS / Caja',
        icon: <Calculator className="w-4 h-4 text-[#006AFF]" />,
        isActive: activeTab === 'pos',
        onClick: () => setActiveTab('pos'),
      },
      {
        id: 'control',
        label: '📊 Control Diario',
        icon: <LayoutDashboard className="w-4 h-4 text-blue-600" />,
        isActive: activeTab === 'control',
        onClick: () => setActiveTab('control'),
      },
      {
        id: 'ventas',
        label: '📈 Ventas Históricas',
        icon: <TrendingUp className="w-4 h-4 text-emerald-600" />,
        isActive: activeTab === 'ventas',
        onClick: () => setActiveTab('ventas'),
      },
      {
        id: 'caja',
        label: '💵 Resumen de Caja',
        icon: <Store className="w-4 h-4 text-amber-600" />,
        isActive: activeTab === 'caja',
        onClick: () => setActiveTab('caja'),
      },
      {
        id: 'compras',
        label: '🛍️ Gestión de Compras',
        icon: <ShoppingCart className="w-4 h-4 text-amber-600" />,
        isActive: activeTab === 'compras',
        onClick: () => setActiveTab('compras'),
      },
      {
        id: 'gastos',
        label: '🧾 Gastos Operativos',
        icon: <Receipt className="w-4 h-4 text-rose-600" />,
        isActive: activeTab === 'gastos',
        onClick: () => setActiveTab('gastos'),
      },
      {
        id: 'products',
        label: '📦 Productos / Inventario',
        icon: <Package className="w-4 h-4 text-indigo-600" />,
        isActive: activeTab === 'products',
        onClick: () => setActiveTab('products'),
      },
      {
        id: 'receivings',
        label: '🚚 Recepción de Productos',
        icon: <Truck className="w-4 h-4 text-blue-700" />,
        isActive: activeTab === 'receivings',
        onClick: () => setActiveTab('receivings'),
      },
      {
        id: 'adjustments',
        label: '🎛️ Ajustes de Stock',
        icon: <SlidersHorizontal className="w-4 h-4 text-amber-700" />,
        isActive: activeTab === 'adjustments',
        onClick: () => setActiveTab('adjustments'),
      },
      {
        id: 'replenishment',
        label: '📋 Solicitud de Productos',
        icon: <ClipboardList className="w-4 h-4 text-purple-600" />,
        isActive: activeTab === 'replenishment',
        onClick: () => setActiveTab('replenishment'),
      },
      {
        id: 'sellers',
        label: '👥 Gestión de Vendedores',
        icon: <Users className="w-4 h-4 text-blue-600" />,
        isActive: activeTab === 'sellers',
        onClick: () => setActiveTab('sellers'),
      },
    ]);
  }, [activeTab, setNavItems]);

  if (!business) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-6 bg-red-50 rounded border border-red-200 text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto" />
        <h3 className="text-lg font-black text-red-900">Negocio No Encontrado</h3>
        <p className="text-xs text-red-700 font-medium">
          Su usuario no tiene un negocio válido asignado o el negocio fue eliminado. Contacte al Administrador del Sistema.
        </p>
      </div>
    );
  }

  const isInactive = business.status === 'inactive';

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4 space-y-3">
      
      {/* Inactive Business Warning Banner */}
      {isInactive && (
        <div className="bg-red-50 border border-red-200 rounded p-3 flex items-center space-x-3 text-red-900">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div>
            <p className="font-bold text-xs">Este negocio se encuentra INACTIVO</p>
            <p className="text-[11px] text-red-700">
              El Super Admin ha desactivado las operaciones para {business.name}.
            </p>
          </div>
        </div>
      )}

      {/* Header Banner (Desktop only, hidden on mobile) */}
      <div className="hidden sm:flex bg-white rounded p-4 border border-stone-200 shadow-xs flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-[#006AFF] border border-blue-200">
              Panel de Administración
            </span>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isInactive 
                ? 'bg-red-50 text-red-800 border border-red-200' 
                : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
            }`}>
              {isInactive ? 'Inactivo' : '✓ Operativo'}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black text-stone-900 mt-1.5 tracking-tight">
            {business.name}
          </h2>
          <p className="text-xs text-stone-500 mt-0.5">
            Administrador: <span className="font-bold text-stone-800">{userProfile?.displayName}</span> ({userProfile?.email})
          </p>
        </div>

        {/* Navigation Tabs Bar (Desktop only, Mobile uses Hamburger Menu) */}
        <div className="hidden sm:flex items-center gap-1 w-full md:w-auto justify-start sm:justify-end overflow-x-auto pb-1 sm:pb-0">
          <button
            onClick={() => setActiveTab('pos')}
            id="tab-admin-pos"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'pos' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>POS / Caja</span>
          </button>

          <button
            onClick={() => setActiveTab('control')}
            id="tab-control-diario"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'control' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Control Diario</span>
          </button>

          <button
            onClick={() => setActiveTab('ventas')}
            id="tab-ventas"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'ventas' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ventas</span>
          </button>

          <button
            onClick={() => setActiveTab('caja')}
            id="tab-caja-summary"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'caja' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <Store className="w-3.5 h-3.5" />
            <span>Resumen Caja</span>
          </button>

          <button
            onClick={() => setActiveTab('compras')}
            id="tab-compras"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'compras' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>Compras</span>
          </button>

          <button
            onClick={() => setActiveTab('gastos')}
            id="tab-gastos"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'gastos' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Gastos</span>
          </button>

          <button
            onClick={() => setActiveTab('products')}
            id="tab-products"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'products' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Productos</span>
          </button>

          <button
            onClick={() => setActiveTab('receivings')}
            id="tab-receivings"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'receivings' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <Truck className="w-3.5 h-3.5" />
            <span>Recepciones</span>
          </button>

          <button
            onClick={() => setActiveTab('adjustments')}
            id="tab-adjustments"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'adjustments' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>Ajustes</span>
          </button>

          <button
            onClick={() => setActiveTab('replenishment')}
            id="tab-replenishment"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'replenishment' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
            }`}
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Solicitud</span>
          </button>

          <button
            onClick={() => setActiveTab('sellers')}
            id="tab-sellers"
            className={`px-3 py-1.5 rounded font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
              activeTab === 'sellers' ? 'bg-[#006AFF] text-white shadow-xs' : 'bg-stone-100 text-stone-700 hover:bg-stone-200 border border-stone-200/60'
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

      {/* RECEIVINGS MODULE */}
      {activeTab === 'receivings' && (
        <ReceivingModule />
      )}

      {/* STOCK ADJUSTMENT MODULE */}
      {activeTab === 'adjustments' && (
        <StockAdjustmentModule />
      )}

      {/* REPLENISHMENT MODULE */}
      {activeTab === 'replenishment' && (
        <ReplenishmentModule />
      )}

      {/* SELLERS MANAGEMENT VIEW */}
      {activeTab === 'sellers' && (
        <SellerManagement />
      )}

    </div>
  );
};
