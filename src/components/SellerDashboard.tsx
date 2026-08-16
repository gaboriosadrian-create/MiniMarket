import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { Product } from '../types';
import { getProductsByBusiness } from '../lib/productService';
import { PosCaja } from './PosCaja';
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
  Calculator
} from 'lucide-react';

export const SellerDashboard: React.FC = () => {
  const { userProfile, business } = useAuth();
  const [activeTab, setActiveTab] = useState<'pos' | 'catalog'>('pos');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* Navigation Tabs for Seller */}
      <div className="flex items-center justify-between border-b border-stone-200 pb-3">
        <div className="flex space-x-2">
          <button
            onClick={() => setActiveTab('pos')}
            id="tab-seller-pos"
            className={`px-4 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'pos'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <Calculator className="w-4 h-4 text-emerald-400" />
            <span>POS / Caja de Venta</span>
          </button>

          <button
            onClick={() => setActiveTab('catalog')}
            id="tab-seller-catalog"
            className={`px-4 py-2.5 rounded-xl font-extrabold text-sm flex items-center gap-2 transition-all ${
              activeTab === 'catalog'
                ? 'bg-stone-900 text-white shadow-xs'
                : 'bg-white text-stone-600 hover:bg-stone-100 border border-stone-200'
            }`}
          >
            <Package className="w-4 h-4 text-emerald-400" />
            <span>Consulta de Catálogo</span>
          </button>
        </div>

        <div className="hidden sm:flex items-center space-x-2 text-xs font-semibold text-stone-500">
          <Store className="w-4 h-4 text-emerald-600" />
          <span>{business.name}</span>
        </div>
      </div>

      {/* VIEW 1: POS / CAJA */}
      {activeTab === 'pos' && <PosCaja />}

      {/* VIEW 2: READ-ONLY CATALOG */}
      {activeTab === 'catalog' && (
        <div className="bg-white rounded-2xl border border-stone-200 p-6 shadow-2xs space-y-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
            <div>
              <h3 className="text-lg font-bold text-stone-900 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-600" />
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
                  <th className="px-4 py-3 text-left font-bold text-stone-500 uppercase">Producto</th>
                  <th className="px-4 py-3 text-left font-bold text-stone-500 uppercase">Código</th>
                  <th className="px-4 py-3 text-left font-bold text-stone-500 uppercase">Categoría</th>
                  <th className="px-4 py-3 text-right font-bold text-stone-500 uppercase">Precio Venta</th>
                  <th className="px-4 py-3 text-center font-bold text-stone-500 uppercase">Stock Disponible</th>
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
                    <tr key={p.id} className="hover:bg-stone-50">
                      <td className="px-4 py-3 font-bold text-sm text-stone-900">{p.name}</td>
                      <td className="px-4 py-3 font-mono text-stone-600">{p.barcode || 'Sin código'}</td>
                      <td className="px-4 py-3 font-medium text-stone-600">{p.category}</td>
                      <td className="px-4 py-3 text-right font-bold text-sm font-mono text-stone-900">{formatCurrency(p.salePrice)}</td>
                      <td className="px-4 py-3 text-center">
                        {p.stock <= 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-800">Sin stock ({p.stock})</span>
                        ) : p.stock <= p.minimumStock ? (
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800">Stock Bajo ({p.stock})</span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">Disponible ({p.stock})</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

        </div>
      )}

    </div>
  );
};

