import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { useNavigation } from '../lib/navigationContext';
import { ProductManagement } from './ProductManagement';
import { PosCaja } from './PosCaja';
import { SalesList } from './SalesList';
import { CajaSummary } from './CajaSummary';
import { PurchaseManagement } from './PurchaseManagement';
import { ExpenseManagement } from './ExpenseManagement';
import { ObligationManagement } from './ObligationManagement';
import { BusinessAnalysis } from './BusinessAnalysis';
import { EventCenter } from './EventCenter';
import { DailyControlOverview } from './DailyControlOverview';
import { SellerManagement } from './SellerManagement';
import { ReceivingModule } from './ReceivingModule';
import { StockAdjustmentModule } from './StockAdjustmentModule';
import { ReplenishmentModule } from './ReplenishmentModule';
import { AdminSettings } from './AdminSettings';
import { MyBusiness } from './MyBusiness';
import { checkAndGenerateRecurringObligations, checkAndNotifyDueObligations } from '../lib/recurringExpenseService';
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
  ClipboardList,
  Settings,
  CreditCard,
  PieChart,
  Activity
} from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { userProfile, business } = useAuth();
  const { setNavItems } = useNavigation();
  const [activeTab, setActiveTab] = useState<
    'pos' | 'control' | 'ventas' | 'caja' | 'compras' | 'obligations' | 'gastos' | 'analysis' | 'events' | 'products' | 'receivings' | 'adjustments' | 'replenishment' | 'sellers' | 'business' | 'config'
  >('pos');

  // Handle URL hash or redirect for Mi Negocio & Mercado Pago callback
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (
        window.location.hash === '#minegocio' ||
        window.location.search.includes('mp_connected') ||
        window.location.search.includes('mp_error')
      ) {
        setActiveTab('business');
      }
    }
  }, []);

  // Redirect away from technical config if not SUPER_ADMIN
  useEffect(() => {
    if (activeTab === 'config' && userProfile?.role !== 'SUPER_ADMIN') {
      setActiveTab('business');
    }
  }, [activeTab, userProfile]);

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
        id: 'analysis',
        label: '📈 Análisis y Rentabilidad',
        icon: <BarChart3 className="w-4 h-4 text-blue-700" />,
        isActive: activeTab === 'analysis',
        onClick: () => setActiveTab('analysis'),
      },
      {
        id: 'events',
        label: '⚡ Centro de Eventos',
        icon: <Activity className="w-4 h-4 text-indigo-600" />,
        isActive: activeTab === 'events',
        onClick: () => setActiveTab('events'),
      },
      {
        id: 'ventas',
        label: '💰 Ventas Históricas',
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
        id: 'obligations',
        label: '🏢 Proveedores a Cancelar',
        icon: <Building2 className="w-4 h-4 text-amber-700" />,
        isActive: activeTab === 'obligations',
        onClick: () => setActiveTab('obligations'),
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
      {
        id: 'business',
        label: '🏪 Mi Negocio',
        icon: <Building2 className="w-4 h-4 text-stone-700" />,
        isActive: activeTab === 'business',
        onClick: () => setActiveTab('business'),
      },
      ...(userProfile?.role === 'SUPER_ADMIN'
        ? [
            {
              id: 'config' as const,
              label: '⚙️ Configuración Técnica',
              icon: <Settings className="w-4 h-4 text-stone-700" />,
              isActive: activeTab === 'config',
              onClick: () => setActiveTab('config'),
            },
          ]
        : []),
    ]);
  }, [activeTab, setNavItems, userProfile]);

  // Background recurring obligations generation and due date notification checks on mount
  useEffect(() => {
    if (!business?.id || !userProfile) return;
    if (userProfile.role !== 'ADMIN' && userProfile.role !== 'SUPER_ADMIN') return;

    let isMounted = true;
    const runChecks = async () => {
      try {
        await checkAndGenerateRecurringObligations(business.id, userProfile);
        if (isMounted) {
          await checkAndNotifyDueObligations(business.id);
        }
      } catch (err) {
        console.warn('[AdminDashboard] Error en verificación en segundo plano:', err);
      }
    };

    runChecks();

    return () => {
      isMounted = false;
    };
  }, [business?.id, userProfile]);

  // Navigation listener from Event Center / Notifications for Obligations
  useEffect(() => {
    const handleNavigateObligations = (event: any) => {
      setActiveTab('obligations');
    };

    window.addEventListener('minimarket:navigate-obligations', handleNavigateObligations);
    return () => {
      window.removeEventListener('minimarket:navigate-obligations', handleNavigateObligations);
    };
  }, []);

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

      {/* POS / CAJA MODULE */}
      {activeTab === 'pos' && (
        <PosCaja />
      )}

      {/* CONTROL DIARIO / DASHBOARD OVERVIEW */}
      {activeTab === 'control' && (
        <DailyControlOverview />
      )}

      {/* BUSINESS ANALYSIS & PROFITABILITY MODULE */}
      {activeTab === 'analysis' && (
        <BusinessAnalysis 
          onNavigateToObligations={() => setActiveTab('obligations')}
          onNavigateToProducts={() => setActiveTab('products')}
          onNavigateToPurchases={() => setActiveTab('compras')}
        />
      )}

      {/* CENTRO DE EVENTOS Y TRAZABILIDAD */}
      {activeTab === 'events' && (
        <EventCenter 
          onNavigateTab={(tab, entityId) => {
            if (tab && typeof tab === 'string') {
              setActiveTab(tab as any);
            }
          }}
        />
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

      {/* DEUDAS, OBLIGACIONES Y PAGOS */}
      {activeTab === 'obligations' && (
        <ObligationManagement />
      )}

      {/* GASTOS MANAGEMENT */}
      {activeTab === 'gastos' && (
        <ExpenseManagement />
      )}

      {/* PRODUCTS & INVENTORY MODULE */}
      {activeTab === 'products' && (
        <ProductManagement onNavigateToTab={(tab) => setActiveTab(tab)} />
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

      {/* MI NEGOCIO Y MEDIOS DE COBRO */}
      {(activeTab === 'business' || (activeTab === 'config' && userProfile?.role !== 'SUPER_ADMIN')) && (
        <MyBusiness />
      )}

      {/* CONFIGURACIÓN TÉCNICA (SUPER ADMIN ONLY) */}
      {activeTab === 'config' && userProfile?.role === 'SUPER_ADMIN' && (
        <AdminSettings onNavigateToTab={(tab) => setActiveTab(tab)} />
      )}

    </div>
  );
};
