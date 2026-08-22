import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { useNavigation } from '../lib/navigationContext';
import { Product } from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { PosCaja } from './PosCaja';
import { ReceivingModule } from './ReceivingModule';
import { PurchaseModule } from './PurchaseModule';
import { StockAdjustmentModule } from './StockAdjustmentModule';
import { ReplenishmentModule } from './ReplenishmentModule';
import { hasPermission } from '../lib/permissions';
import { 
  Store, 
  ShoppingCart, 
  Barcode, 
  DollarSign, 
  Clock, 
  AlertTriangle,
  Building2,
  Package,
  Search,
  CheckCircle2,
  XCircle,
  Eye,
  Calculator,
  ChevronLeft,
  ChevronRight,
  X,
  Tag,
  ShieldAlert,
  Truck,
  ShoppingBag,
  SlidersHorizontal,
  ClipboardList
} from 'lucide-react';

export const SellerDashboard: React.FC = () => {
  const { userProfile, business } = useAuth();
  const { setNavItems } = useNavigation();
  const [activeTab, setActiveTab] = useState<'pos' | 'catalog' | 'receiving' | 'purchases' | 'adjustments' | 'replenishment'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const canCreateSales = hasPermission(userProfile, 'sales.create');
  const canViewInventory = hasPermission(userProfile, 'inventory.view');
  const canReceive = hasPermission(userProfile, 'inventory.receive') || hasPermission(userProfile, 'receiving.create');
  const canRegisterPurchases = hasPermission(userProfile, 'purchases.create') || hasPermission(userProfile, 'purchases.view');
  const canAdjustStock = hasPermission(userProfile, 'inventory.stock_entry');
  const canReplenish = hasPermission(userProfile, 'replenishment.view');

  // Register navigation items for Mobile Hamburger Menu & Global Navbar
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[DEBUG SellerDashboard Replenishment Visibility]', {
        role: userProfile?.role,
        status: userProfile?.status,
        active: userProfile?.active,
        businessId: userProfile?.businessId,
        permissions: userProfile?.permissions,
        canReplenish,
      });
    }

    const items = [];

    if (canCreateSales) {
      items.push({
        id: 'pos',
        label: '🛒 Venta',
        icon: <Calculator className="w-4 h-4 text-emerald-500" />,
        isActive: activeTab === 'pos',
        onClick: () => setActiveTab('pos'),
      });
    }
    if (canReceive) {
      items.push({
        id: 'receiving',
        label: '🚚 Recepción',
        icon: <Truck className="w-4 h-4 text-indigo-500" />,
        isActive: activeTab === 'receiving',
        onClick: () => setActiveTab('receiving'),
      });
    }
    if (canReplenish) {
      items.push({
        id: 'replenishment',
        label: '📋 Solicitud',
        icon: <ClipboardList className="w-4 h-4 text-purple-500" />,
        isActive: activeTab === 'replenishment',
        onClick: () => setActiveTab('replenishment'),
      });
    }
    if (canRegisterPurchases) {
      items.push({
        id: 'purchases',
        label: '🛍️ Compras Directas',
        icon: <ShoppingBag className="w-4 h-4 text-amber-500" />,
        isActive: activeTab === 'purchases',
        onClick: () => setActiveTab('purchases'),
      });
    }
    if (canAdjustStock) {
      items.push({
        id: 'adjustments',
        label: '🎛️ Ajustar Stock',
        icon: <SlidersHorizontal className="w-4 h-4 text-amber-600" />,
        isActive: activeTab === 'adjustments',
        onClick: () => setActiveTab('adjustments'),
      });
    }
    if (canViewInventory) {
      items.push({
        id: 'catalog',
        label: '🔍 Consulta de Catálogo',
        icon: <Search className="w-4 h-4 text-sky-600" />,
        isActive: activeTab === 'catalog',
        onClick: () => setActiveTab('catalog'),
      });
    }
    setNavItems(items);
  }, [activeTab, canCreateSales, canViewInventory, canReceive, canRegisterPurchases, canAdjustStock, canReplenish, userProfile, setNavItems]);

  useEffect(() => {
    if (business?.id && activeTab === 'catalog') {
      setLoading(true);
      getProductsByBusiness(business.id)
        .then(setProducts)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [business?.id, activeTab]);

  const filteredProducts = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return products.filter(p => p.active);
    return products.filter((p) => 
      p.active && (
        p.name.toLowerCase().includes(term) ||
        (p.barcode && p.barcode.toLowerCase().includes(term)) ||
        (p.category && p.category.toLowerCase().includes(term))
      )
    );
  }, [products, searchTerm]);

  if (!business) {
    return (
      <div className="max-w-4xl mx-auto my-12 p-8 bg-red-50 rounded-2xl border border-red-200 text-center space-y-3">
        <AlertTriangle className="w-10 h-10 text-red-500 mx-auto" />
        <h3 className="text-xl font-bold text-red-900">Sin Negocio Asignado</h3>
        <p className="text-sm text-red-700">
          Su usuario no tiene un negocio asignado o el negocio no existe.
        </p>
      </div>
    );
  }

  const isInactive = business.status === 'inactive';

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="w-full">
      {/* Main Content Area */}
      <div className="w-full">
        {/* VIEW 1: POS / CAJA */}
        {activeTab === 'pos' && (
          canCreateSales ? (
            <PosCaja />
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-lg font-bold text-stone-900">Acceso Restringido</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                No tienes permisos suficientes para realizar ventas. Contacta al Administrador de tu negocio para habilitar este permiso.
              </p>
            </div>
          )
        )}

        {/* VIEW 2: RECEPCIÓN DE MERCADERÍA */}
        {activeTab === 'receiving' && <ReceivingModule />}

        {/* VIEW 3: COMPRAS DIRECTAS */}
        {activeTab === 'purchases' && <PurchaseModule />}

        {/* VIEW 4: AJUSTES DE STOCK */}
        {activeTab === 'adjustments' && <StockAdjustmentModule />}

        {/* VIEW 5: REPOSICIÓN DE STOCK */}
        {activeTab === 'replenishment' && <ReplenishmentModule />}

        {/* VIEW 2: READ-ONLY CATALOG */}
        {activeTab === 'catalog' && (
          canViewInventory ? (
            <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Search className="w-5 h-5 text-sky-600" />
                Consulta de Productos y Stock
              </h3>
              <p className="text-xs text-stone-500">
                Catálogo de {business.name} (Modo Lectura para Vendedores)
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <input
                type="text"
                placeholder="Buscar por nombre o código..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-stone-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Product Table (Read-only) */}
          <div className="overflow-x-auto border border-stone-200 rounded-xl">
            <table className="min-w-full divide-y divide-stone-200 text-xs">
              <thead className="bg-stone-50">
                <tr>
                  <th className="px-3 sm:px-4 py-3 text-left font-bold text-stone-500 uppercase">Producto</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left font-bold text-stone-500 uppercase">Código</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left font-bold text-stone-500 uppercase">Categoría</th>
                  <th className="px-3 sm:px-4 py-3 text-right font-bold text-stone-500 uppercase">Precio Venta</th>
                  <th className="px-3 sm:px-4 py-3 text-center font-bold text-stone-500 uppercase">Stock Disponible</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-stone-200">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-500">Cargando catálogo de productos...</td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-stone-500">No se encontraron productos activos.</td>
                  </tr>
                ) : (
                  filteredProducts.map((p) => (
                    <tr 
                      key={p.id} 
                      onClick={() => setSelectedProduct(p)}
                      className="hover:bg-stone-50/80 cursor-pointer transition-colors"
                    >
                      <td className="px-3 sm:px-4 py-3 font-bold text-xs sm:text-sm text-stone-900">
                        <div>{p.name}</div>
                        <div className="sm:hidden text-[10px] font-semibold text-stone-400 mt-0.5">{p.category || 'General'}</div>
                      </td>
                      <td className="hidden sm:table-cell px-4 py-3 font-mono text-stone-600">{p.barcode || 'Sin código'}</td>
                      <td className="hidden sm:table-cell px-4 py-3 font-medium text-stone-600">{p.category}</td>
                      <td className="px-3 sm:px-4 py-3 text-right font-bold text-xs sm:text-sm font-mono text-stone-900">{formatCurrency(p.salePrice)}</td>
                      <td className="px-3 sm:px-4 py-3 text-center">
                        {p.stock <= 0 ? (
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-full font-bold text-[10px] sm:text-xs bg-red-100 text-red-800">Sin stock ({p.stock})</span>
                        ) : p.stock <= p.minimumStock ? (
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-full font-bold text-[10px] sm:text-xs bg-amber-100 text-amber-800">Stock Bajo ({p.stock})</span>
                        ) : (
                          <span className="px-2 sm:px-2.5 py-0.5 rounded-full font-bold text-[10px] sm:text-xs bg-emerald-100 text-emerald-800">Disponible ({p.stock})</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
          ) : (
            <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-3">
              <ShieldAlert className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-lg font-bold text-stone-900">Acceso Restringido</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                No tienes permisos suficientes para consultar el catálogo. Contacta al Administrador de tu negocio para habilitar este permiso.
              </p>
            </div>
          )
        )}

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div 
          className="fixed inset-0 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setSelectedProduct(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-600 uppercase">
                    {selectedProduct.category || 'General'}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-stone-900 leading-tight mt-0.5">
                    {selectedProduct.name}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Grid of details */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/60 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">Precio de Venta</p>
                <p className="text-base font-black font-mono text-emerald-700">
                  {formatCurrency(selectedProduct.salePrice)}
                </p>
              </div>

              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/60 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">Stock Disponible</p>
                <p className="text-base font-black font-mono text-stone-900">
                  {selectedProduct.stock} u.
                </p>
              </div>

              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/60 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">Código de Barras</p>
                <p className="text-xs font-mono font-bold text-stone-800 truncate">
                  {selectedProduct.barcode || 'Sin código'}
                </p>
              </div>

              <div className="bg-stone-50 p-3 rounded-2xl border border-stone-200/60 space-y-0.5">
                <p className="text-[10px] font-extrabold uppercase text-stone-400 tracking-wider">Stock Mínimo</p>
                <p className="text-xs font-mono font-bold text-stone-800">
                  {selectedProduct.minimumStock} u.
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <div className="pt-2 flex items-center justify-between border-t border-stone-100">
              <span className="text-xs text-stone-500 font-medium">Estado de Inventario:</span>
              {selectedProduct.stock <= 0 ? (
                <span className="px-3 py-1 rounded-full font-extrabold text-xs bg-red-100 text-red-800 border border-red-200">
                  Sin Stock
                </span>
              ) : selectedProduct.stock <= selectedProduct.minimumStock ? (
                <span className="px-3 py-1 rounded-full font-extrabold text-xs bg-amber-100 text-amber-800 border border-amber-200">
                  Stock Bajo
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full font-extrabold text-xs bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Disponible
                </span>
              )}
            </div>

            {/* Close Button */}
            <div className="pt-1">
              <button
                onClick={() => setSelectedProduct(null)}
                className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl text-xs transition-colors shadow-2xs"
              >
                Cerrar Detalle
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};

