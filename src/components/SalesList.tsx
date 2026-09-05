import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { Sale } from '../types';
import { getSalesByBusiness } from '../lib/saleService';
import { getProductsByBusiness } from '../lib/productService';
import { DateFilter } from './DateFilter';
import { useSyncStatus } from '../lib/useSyncStatus';
import { SyncOperationsModal } from './SyncOperationsModal';
import { 
  TrendingUp, 
  Banknote, 
  QrCode, 
  Clock, 
  Receipt, 
  X, 
  Search, 
  User, 
  RefreshCw,
  ShoppingBag,
  DollarSign,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Smartphone
} from 'lucide-react';

export const SalesList: React.FC = () => {
  const { business } = useAuth();
  const { stats: syncStats } = useSyncStatus(business?.id);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [sales, setSales] = useState<Sale[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hoy');
  const getInitialTodayRange = () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return { startIso: start.toISOString(), endIso: end.toISOString() };
  };

  const initialRange = getInitialTodayRange();
  const [startDateIso, setStartDateIso] = useState<string>(initialRange.startIso);
  const [endDateIso, setEndDateIso] = useState<string>(initialRange.endIso);
  const [searchTerm, setSearchTerm] = useState('');

  // View Mode: 'sales' (Por Ventas) or 'categories' (Agrupado por Categorías)
  const [viewMode, setViewMode] = useState<'sales' | 'categories'>('sales');

  // Sorting for Sales View
  const [saleSortField, setSaleSortField] = useState<'date' | 'seller' | 'products' | 'payment' | 'total'>('date');
  const [saleSortDir, setSaleSortDir] = useState<'asc' | 'desc'>('desc');

  // Sorting for Categories View
  const [catSortField, setCatSortField] = useState<'category' | 'quantity' | 'total'>('total');
  const [catSortDir, setCatSortDir] = useState<'asc' | 'desc'>('desc');

  const loadSales = async (start?: string, end?: string) => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const sIso = start !== undefined ? start : startDateIso;
      const eIso = end !== undefined ? end : endDateIso;

      const [data, prods] = await Promise.all([
        getSalesByBusiness(business.id, sIso, eIso),
        getProductsByBusiness(business.id)
      ]);
      setSales(data);

      const catMap: Record<string, string> = {};
      prods.forEach((p) => {
        if (p.id) catMap[p.id] = p.category || 'General';
      });
      setCategoryMap(catMap);
    } catch (err) {
      console.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSales(startDateIso, endDateIso);
  }, [business?.id]);

  const handleDateRangeChange = (start: string, end: string, label: string) => {
    setStartDateIso(start);
    setEndDateIso(end);
    setDateRangeLabel(label);
    loadSales(start, end);
  };

  // Metrics calculation
  const totalCount = sales.length;
  const totalAmount = sales.reduce((acc, s) => acc + (s.total || 0), 0);
  const cashAmount = sales.reduce((acc, s) => {
    if (s.paymentMethod === 'EFECTIVO') return acc + (s.total || 0);
    if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return acc + (s.paymentBreakdown.cashAmount || 0);
    return acc;
  }, 0);
  const mpAmount = sales.reduce((acc, s) => {
    if (s.paymentMethod === 'MERCADO_PAGO') return acc + (s.total || 0);
    if (s.paymentMethod === 'COMBINADO' && s.paymentBreakdown) return acc + (s.paymentBreakdown.mpAmount || 0);
    return acc;
  }, 0);

  const filteredSales = sales.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.id?.toLowerCase().includes(term) ||
      s.sellerName?.toLowerCase().includes(term) ||
      s.paymentMethod?.toLowerCase().includes(term) ||
      s.items?.some((i) => 
        i.productName.toLowerCase().includes(term) ||
        (i.category && i.category.toLowerCase().includes(term)) ||
        (categoryMap[i.productId] && categoryMap[i.productId].toLowerCase().includes(term))
      )
    );
  });

  // Sorted Sales List
  const sortedSales = [...filteredSales].sort((a, b) => {
    let valA: any = 0;
    let valB: any = 0;

    if (saleSortField === 'date') {
      valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    } else if (saleSortField === 'seller') {
      valA = (a.sellerName || '').toLowerCase();
      valB = (b.sellerName || '').toLowerCase();
    } else if (saleSortField === 'products') {
      valA = (a.items?.map((i) => i.productName).join(' ') || '').toLowerCase();
      valB = (b.items?.map((i) => i.productName).join(' ') || '').toLowerCase();
    } else if (saleSortField === 'payment') {
      valA = (a.paymentMethod || '').toLowerCase();
      valB = (b.paymentMethod || '').toLowerCase();
    } else if (saleSortField === 'total') {
      valA = a.total || 0;
      valB = b.total || 0;
    }

    if (valA < valB) return saleSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return saleSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  // Category Aggregation
  const categoryStats = React.useMemo(() => {
    const map: Record<string, { categoryName: string; totalQuantity: number; totalAmount: number }> = {};

    filteredSales.forEach((sale) => {
      sale.items?.forEach((item) => {
        const cat = item.category || categoryMap[item.productId] || 'Sin Categoría';
        if (!map[cat]) {
          map[cat] = {
            categoryName: cat,
            totalQuantity: 0,
            totalAmount: 0
          };
        }
        map[cat].totalQuantity += item.quantity || 0;
        map[cat].totalAmount += item.subtotal || (item.quantity * item.unitPrice) || 0;
      });
    });

    return Object.values(map);
  }, [filteredSales, categoryMap]);

  // Sorted Category Stats
  const sortedCategoryStats = React.useMemo(() => {
    return [...categoryStats].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      if (catSortField === 'category') {
        valA = a.categoryName.toLowerCase();
        valB = b.categoryName.toLowerCase();
      } else if (catSortField === 'quantity') {
        valA = a.totalQuantity;
        valB = b.totalQuantity;
      } else if (catSortField === 'total') {
        valA = a.totalAmount;
        valB = b.totalAmount;
      }

      if (valA < valB) return catSortDir === 'asc' ? -1 : 1;
      if (valA > valB) return catSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [categoryStats, catSortField, catSortDir]);

  const handleSalesSort = (field: typeof saleSortField) => {
    if (saleSortField === field) {
      setSaleSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSaleSortField(field);
      setSaleSortDir('desc');
    }
  };

  const handleCatSort = (field: typeof catSortField) => {
    if (catSortField === field) {
      setCatSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setCatSortField(field);
      setCatSortDir('desc');
    }
  };

  const renderSortIcon = (field: string, currentField: string, currentDir: 'asc' | 'desc') => {
    if (field !== currentField) {
      return <ArrowUpDown className="w-3 h-3 text-stone-300 ml-1 inline shrink-0" />;
    }
    return currentDir === 'asc' ? (
      <ArrowUp className="w-3 h-3 text-emerald-600 ml-1 inline shrink-0" />
    ) : (
      <ArrowDown className="w-3 h-3 text-emerald-600 ml-1 inline shrink-0" />
    );
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatTime = (isoString?: string) => {
    if (!isoString) return '--:--';
    const date = new Date(isoString);
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (isoString?: string) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div className="space-y-6">
      {/* Attention Banner if conflicts exist */}
      {Boolean(syncStats && (syncStats.stockConflictCount > 0 || syncStats.errorCount > 0)) && (
        <div className="bg-red-50 border border-red-300 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-red-900 shadow-2xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-black text-sm text-red-900">
                {syncStats.stockConflictCount + syncStats.errorCount} venta{syncStats.stockConflictCount + syncStats.errorCount > 1 ? 's' : ''} offline requiere{syncStats.stockConflictCount + syncStats.errorCount > 1 ? 'n' : ''} resolución
              </p>
              <p className="text-xs text-red-700">
                Hay operaciones locales que no pudieron sincronizarse debido a falta de stock en el servidor u otros errores.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowSyncModal(true)}
            className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs shrink-0 self-end sm:self-auto cursor-pointer"
          >
            Resolver Conflictos
          </button>
        </div>
      )}

      {/* Date Filter */}
      <DateFilter viewTitle="Ventas Históricas" onDateRangeChange={handleDateRangeChange} />

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Total Sales Count */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-500">
            <span className="text-xs font-bold uppercase tracking-wider">Ventas</span>
            <Receipt className="w-4 h-4 text-stone-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-stone-900">{totalCount}</p>
          <span className="text-[11px] text-stone-500 font-medium">{dateRangeLabel}</span>
        </div>

        {/* Total Sold */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Total Vendido</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-700 font-mono">
            {formatCurrency(totalAmount)}
          </p>
          <span className="text-[11px] text-emerald-800 font-medium">Facturación bruta</span>
        </div>

        {/* Total Cash */}
        <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-emerald-800">
            <span className="text-xs font-bold uppercase tracking-wider">Efectivo</span>
            <Banknote className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-stone-900 font-mono">
            {formatCurrency(cashAmount)}
          </p>
          <span className="text-[11px] text-stone-500 font-medium">
            {totalAmount > 0 ? `${Math.round((cashAmount / totalAmount) * 100)}% del total` : '0%'}
          </span>
        </div>

        {/* Total Mercado Pago */}
        <div className="bg-white p-4 rounded-2xl border border-sky-100 bg-sky-50/30 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-sky-800">
            <span className="text-xs font-bold uppercase tracking-wider">Mercado Pago</span>
            <QrCode className="w-4 h-4 text-sky-600" />
          </div>
          <p className="text-2xl sm:text-3xl font-black text-sky-900 font-mono">
            {formatCurrency(mpAmount)}
          </p>
          <span className="text-[11px] text-sky-700 font-medium">
            {totalAmount > 0 ? `${Math.round((mpAmount / totalAmount) * 100)}% del total` : '0%'}
          </span>
        </div>
      </div>

      {/* Sales List Table Section */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center space-x-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base font-extrabold text-stone-900">
                {viewMode === 'sales' ? `Histórico de Ventas (${sortedSales.length})` : `Por Categorías (${sortedCategoryStats.length})`}
              </h3>
            </div>

            {/* View Mode Toggle Switch */}
            <div className="flex items-center bg-stone-100 p-0.5 rounded-xl border border-stone-200">
              <button
                onClick={() => setViewMode('sales')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 ${
                  viewMode === 'sales'
                    ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Ventas</span>
              </button>
              <button
                onClick={() => setViewMode('categories')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all flex items-center space-x-1 ${
                  viewMode === 'categories'
                    ? 'bg-white text-stone-900 shadow-2xs font-extrabold'
                    : 'text-stone-500 hover:text-stone-800'
                }`}
              >
                <Tag className="w-3.5 h-3.5" />
                <span>Categorías</span>
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder={viewMode === 'sales' ? "Buscar venta, producto..." : "Buscar categoría..."}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>

            <button
              onClick={() => loadSales()}
              className="p-1.5 border border-stone-200 hover:bg-stone-50 rounded-xl text-stone-600"
              title="Actualizar"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Table View */}
        <div className="overflow-x-auto">
          {viewMode === 'sales' ? (
            /* POR VENTAS TABLE */
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 border-b border-stone-200 uppercase tracking-wider text-[11px] text-stone-500 font-bold select-none">
                <tr>
                  <th 
                    onClick={() => handleSalesSort('date')}
                    className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    <span className="sm:hidden">Fecha {renderSortIcon('date', saleSortField, saleSortDir)}</span>
                    <span className="hidden sm:inline">Hora / Fecha {renderSortIcon('date', saleSortField, saleSortDir)}</span>
                  </th>

                  <th 
                    onClick={() => handleSalesSort('seller')}
                    className="hidden sm:table-cell py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    Vendedor {renderSortIcon('seller', saleSortField, saleSortDir)}
                  </th>

                  <th 
                    onClick={() => handleSalesSort('products')}
                    className="py-3 px-3 sm:px-4 cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    Productos {renderSortIcon('products', saleSortField, saleSortDir)}
                  </th>

                  <th 
                    onClick={() => handleSalesSort('payment')}
                    className="hidden sm:table-cell py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    Medio de Pago {renderSortIcon('payment', saleSortField, saleSortDir)}
                  </th>

                  <th 
                    onClick={() => handleSalesSort('total')}
                    className="py-3 px-3 sm:px-4 text-right cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    <span className="sm:hidden">Total Venta {renderSortIcon('total', saleSortField, saleSortDir)}</span>
                    <span className="hidden sm:inline">Total {renderSortIcon('total', saleSortField, saleSortDir)}</span>
                  </th>

                  <th className="hidden sm:table-cell py-3 px-4 text-center">Estado</th>
                  <th className="hidden sm:table-cell py-3 px-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-stone-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Cargando ventas...
                    </td>
                  </tr>
                ) : sortedSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-stone-400">
                      No se encontraron ventas para el período seleccionado.
                    </td>
                  </tr>
                ) : (
                  sortedSales.map((sale) => (
                    <tr 
                      key={sale.id} 
                      onClick={() => setSelectedSale(sale)}
                      className="hover:bg-stone-50/80 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-3 sm:px-4 font-mono font-bold text-stone-900">
                        <div className="hidden sm:block">{formatTime(sale.createdAt)}</div>
                        <div className="text-xs sm:text-[10px] text-stone-700 sm:text-stone-400 font-semibold sm:font-normal">{formatDate(sale.createdAt)}</div>
                      </td>

                      <td className="hidden sm:table-cell py-3 px-4 font-semibold text-stone-800">
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3 h-3 text-stone-400 shrink-0" />
                          <span>{sale.sellerName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 sm:px-4 max-w-[110px] sm:max-w-xs truncate text-stone-600 font-medium">
                        {sale.items?.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                      </td>

                      <td className="hidden sm:table-cell py-3 px-4">
                        {sale.paymentMethod === 'EFECTIVO' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Efectivo
                          </span>
                        ) : sale.paymentMethod === 'MERCADO_PAGO' ? (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                              Mercado Pago
                            </span>
                            <div className="text-[10px] leading-tight">
                              {sale.syncMode === 'OFFLINE' || sale.offline ? (
                                <span className="text-amber-800 font-semibold">• Registrado offline • Manual</span>
                              ) : sale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? (
                                <div className="space-y-0.5">
                                  <span className="text-sky-700 font-semibold block">✓ Pago verificado</span>
                                  <span className="text-amber-800 font-semibold block">• Confirmación manual pendiente</span>
                                </div>
                              ) : sale.paymentVerification === 'AUTOMATIC' ? (
                                <span className="text-emerald-700 font-semibold">✓ Verificado automáticamente</span>
                              ) : (
                                <span className="text-amber-800 font-semibold">• Verificación manual</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                              Combinado
                            </span>
                            {sale.paymentBreakdown?.mpAmount ? (
                              <div className="text-[10px] leading-tight">
                                {sale.syncMode === 'OFFLINE' || sale.offline ? (
                                  <span className="text-amber-800 font-semibold">• MP Offline (Manual)</span>
                                ) : sale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? (
                                  <div className="space-y-0.5">
                                    <span className="text-sky-700 font-semibold block">✓ MP Pago verificado</span>
                                    <span className="text-amber-800 font-semibold block">• Confirmación manual pendiente</span>
                                  </div>
                                ) : sale.paymentVerification === 'AUTOMATIC' ? (
                                  <span className="text-emerald-700 font-semibold">✓ MP Automático</span>
                                ) : (
                                  <span className="text-amber-800 font-semibold">• MP Manual</span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-3 sm:px-4 text-right font-black text-stone-900 font-mono text-xs sm:text-sm">
                        {formatCurrency(sale.total)}
                      </td>

                      <td className="hidden sm:table-cell py-3 px-4 text-center">
                        {sale.syncStatus === 'PENDING' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300">
                            <Clock className="w-2.5 h-2.5" />
                            Pendiente Sync
                          </span>
                        ) : sale.syncMode === 'OFFLINE' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Offline Sincronizada
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-700">
                            {sale.status === 'COMPLETED' ? 'Completada' : sale.status === 'CANCELLED' ? 'Cancelada' : sale.status}
                          </span>
                        )}
                      </td>

                      <td className="hidden sm:table-cell py-3 px-4 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedSale(sale);
                          }}
                          className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-[11px] rounded-lg transition-colors"
                        >
                          Ver Detalle
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            /* POR CATEGORÍAS TABLE */
            <table className="w-full text-left text-xs text-stone-700">
              <thead className="bg-stone-50 border-b border-stone-200 uppercase tracking-wider text-[11px] text-stone-500 font-bold select-none">
                <tr>
                  <th 
                    onClick={() => handleCatSort('category')}
                    className="py-3 px-4 cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    Categoría {renderSortIcon('category', catSortField, catSortDir)}
                  </th>

                  <th 
                    onClick={() => handleCatSort('quantity')}
                    className="py-3 px-4 text-center cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    Cantidad Total {renderSortIcon('quantity', catSortField, catSortDir)}
                  </th>

                  <th 
                    onClick={() => handleCatSort('total')}
                    className="py-3 px-4 text-right cursor-pointer hover:bg-stone-100 transition-colors"
                  >
                    Importe Total {renderSortIcon('total', catSortField, catSortDir)}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {loading ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-stone-400">
                      <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-600" />
                      Calculando categorías...
                    </td>
                  </tr>
                ) : sortedCategoryStats.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-stone-400">
                      No hay datos de categorías para las ventas de este período.
                    </td>
                  </tr>
                ) : (
                  sortedCategoryStats.map((cat, idx) => (
                    <tr key={idx} className="hover:bg-stone-50/80 transition-colors">
                      <td className="py-3.5 px-4 font-bold text-stone-900">
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-800 font-bold text-xs">
                          <Tag className="w-3.5 h-3.5 text-stone-500" />
                          <span>{cat.categoryName}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-center font-mono font-bold text-stone-900 text-xs sm:text-sm">
                        {cat.totalQuantity} u.
                      </td>

                      <td className="py-3.5 px-4 text-right font-mono font-black text-emerald-700 text-xs sm:text-sm">
                        {formatCurrency(cat.totalAmount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Sale Detail Modal */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 animate-in fade-in zoom-in duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 block">
                  Detalle de Venta
                </span>
                <h3 className="text-lg font-black text-stone-900 font-mono">
                  #{selectedSale.id?.slice(-6).toUpperCase()}
                </h3>
              </div>
              <button
                onClick={() => setSelectedSale(null)}
                className="text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Sale Meta info */}
            <div className="grid grid-cols-2 gap-2 text-xs bg-stone-50 p-3 rounded-xl border border-stone-200">
              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Fecha y Hora</span>
                <span className="font-bold text-stone-800">
                  {formatDate(selectedSale.createdAt)} - {formatTime(selectedSale.createdAt)} hs
                </span>
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Vendedor</span>
                <span className="font-bold text-stone-800">{selectedSale.sellerName}</span>
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Medio de Pago</span>
                <span className="font-extrabold text-emerald-700">
                  {selectedSale.paymentMethod === 'EFECTIVO' ? 'Efectivo' : selectedSale.paymentMethod === 'MERCADO_PAGO' ? 'Mercado Pago' : 'Pago Combinado'}
                </span>
                {selectedSale.paymentMethod === 'MERCADO_PAGO' && (
                  <div className="mt-1.5 bg-stone-50 p-2.5 rounded-xl border border-stone-200 text-[11px] space-y-1.5 text-stone-700">
                    <div className="font-bold flex items-center gap-1.5">
                      {selectedSale.syncMode === 'OFFLINE' || selectedSale.offline ? (
                        <span className="text-amber-800 flex items-center gap-1">
                          <span>• Registrado offline</span>
                          <span className="text-stone-300 font-normal">|</span>
                          <span>• Verificación manual</span>
                        </span>
                      ) : selectedSale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? (
                        <div className="space-y-0.5">
                          <span className="text-sky-700 flex items-center gap-1">✓ Pago verificado</span>
                          <span className="text-amber-800 flex items-center gap-1">• Confirmación manual pendiente</span>
                        </div>
                      ) : selectedSale.paymentVerification === 'AUTOMATIC' ? (
                        <span className="text-emerald-700 flex items-center gap-1">
                          ✓ Verificado automáticamente
                        </span>
                      ) : (
                        <span className="text-amber-800 flex items-center gap-1">
                          • Verificación manual
                        </span>
                      )}
                    </div>
                    <div className="bg-white/80 p-2 rounded-lg border border-stone-100 text-[10px] space-y-0.5 text-stone-600 font-mono">
                      <div className="flex justify-between">
                        <span className="text-stone-500">Modo:</span>
                        <strong className="text-stone-900">{selectedSale.syncMode === 'OFFLINE' || selectedSale.offline ? 'OFFLINE' : 'ONLINE'}</strong>
                      </div>
                      {selectedSale.paymentDetails?.mercadoPagoSource && (
                        <div className="flex justify-between">
                          <span className="text-stone-500">Modalidad:</span>
                          <strong className="text-stone-900">
                            {selectedSale.paymentDetails.mercadoPagoSource === 'POINT_GENERATED_QR' ? 'QR Point/POS' : 'QR Físico'}
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-stone-500">Verificación:</span>
                        <strong className="text-stone-900">
                          {selectedSale.syncMode === 'OFFLINE' || selectedSale.offline || selectedSale.paymentVerification === 'MANUAL'
                            ? 'Manual (Sin orden en Mercado Pago)'
                            : selectedSale.paymentVerification === 'MERCADOPAGO_VERIFIED'
                            ? 'Pago verificado por Mercado Pago (Confirmación manual pendiente)'
                            : 'Automática (Mercado Pago / Webhook)'}
                        </strong>
                      </div>
                      {selectedSale.paymentDetails?.paymentId && selectedSale.syncMode !== 'OFFLINE' && !selectedSale.offline && (
                        <div className="flex justify-between">
                          <span className="text-stone-500">Operación:</span>
                          <strong className="text-stone-900 font-mono">#{selectedSale.paymentDetails.paymentId.replace(/^#+/, '')}</strong>
                        </div>
                      )}
                      {selectedSale.paymentDetails?.orderId && (
                        <div className="flex justify-between">
                          <span className="text-stone-500">Orden:</span>
                          <strong className="text-stone-900 truncate max-w-[200px]" title={selectedSale.paymentDetails.orderId}>{selectedSale.paymentDetails.orderId}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedSale.paymentMethod === 'COMBINADO' && selectedSale.paymentBreakdown && (
                  <div className="mt-1.5 text-[11px] space-y-1 text-stone-600 font-medium">
                    <div className="flex justify-between pl-1">
                      <span>💵 Efectivo:</span>
                      <strong className="text-stone-900 font-mono">{formatCurrency(selectedSale.paymentBreakdown.cashAmount)}</strong>
                    </div>
                    <div className="flex justify-between pl-1">
                      <span>📱 Mercado Pago:</span>
                      <strong className="text-stone-900 font-mono">{formatCurrency(selectedSale.paymentBreakdown.mpAmount)}</strong>
                    </div>
                    {selectedSale.cashReceived !== undefined && selectedSale.cashReceived > 0 && (
                      <div className="text-[10px] text-stone-500 pl-1">
                        (Recibido: {formatCurrency(selectedSale.cashReceived)}, Vuelto: {formatCurrency(selectedSale.change || 0)})
                      </div>
                    )}
                    <div className="mt-1 bg-stone-50 p-2 rounded-lg border border-stone-200 text-[10px] font-mono space-y-0.5 text-stone-700">
                      <div className="font-bold pb-0.5 border-b border-stone-200/60 mb-1">
                        {selectedSale.syncMode === 'OFFLINE' || selectedSale.offline ? (
                          <span className="text-amber-800">• MP Registrado offline • Verificación manual</span>
                        ) : selectedSale.paymentVerification === 'MERCADOPAGO_VERIFIED' ? (
                          <div className="space-y-0.5">
                            <span className="text-sky-700 font-bold block">✓ MP Pago verificado</span>
                            <span className="text-amber-800 font-semibold block">• Confirmación manual pendiente</span>
                          </div>
                        ) : selectedSale.paymentVerification === 'AUTOMATIC' ? (
                          <span className="text-emerald-700">✓ MP Verificado automáticamente</span>
                        ) : (
                          <span className="text-amber-800">• MP Verificación manual</span>
                        )}
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Modo MP:</span>
                        <strong className="text-stone-900">{selectedSale.syncMode === 'OFFLINE' || selectedSale.offline ? 'OFFLINE' : 'ONLINE'}</strong>
                      </div>
                      {selectedSale.paymentDetails?.mercadoPagoSource && (
                        <div className="flex justify-between">
                          <span className="text-stone-500">Modalidad:</span>
                          <strong className="text-stone-900">
                            {selectedSale.paymentDetails.mercadoPagoSource === 'POINT_GENERATED_QR' ? 'QR Point/POS' : 'QR Físico'}
                          </strong>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-stone-500">Verificación MP:</span>
                        <strong className="text-stone-900">
                          {selectedSale.syncMode === 'OFFLINE' || selectedSale.offline || selectedSale.paymentVerification === 'MANUAL'
                            ? 'Manual'
                            : selectedSale.paymentVerification === 'MERCADOPAGO_VERIFIED'
                            ? 'Pago verificado por Mercado Pago (Confirmación manual pendiente)'
                            : 'Automática'}
                        </strong>
                      </div>
                      {selectedSale.paymentDetails?.paymentId && selectedSale.syncMode !== 'OFFLINE' && !selectedSale.offline && (
                        <div className="flex justify-between">
                          <span className="text-stone-500">Operación:</span>
                          <strong className="text-stone-900 font-mono">#{selectedSale.paymentDetails.paymentId.replace(/^#+/, '')}</strong>
                        </div>
                      )}
                      {selectedSale.paymentDetails?.orderId && (
                        <div className="flex justify-between">
                          <span className="text-stone-500">Orden:</span>
                          <strong className="text-stone-900 truncate max-w-[200px]" title={selectedSale.paymentDetails.orderId}>{selectedSale.paymentDetails.orderId}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {selectedSale.paymentMethod === 'EFECTIVO' && selectedSale.cashReceived !== undefined && selectedSale.cashReceived > selectedSale.total && (
                  <div className="mt-0.5 text-[10px] text-stone-500">
                    Recibido: {formatCurrency(selectedSale.cashReceived)} • Vuelto: {formatCurrency(selectedSale.change || 0)}
                  </div>
                )}
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Estado</span>
                <span className="font-extrabold text-stone-700">
                  {selectedSale.status === 'COMPLETED' ? 'Completada' : selectedSale.status === 'CANCELLED' ? 'Cancelada' : selectedSale.status}
                </span>
                {selectedSale.syncStatus && (
                  <div className="mt-1">
                    {selectedSale.syncStatus === 'PENDING' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <Clock className="w-2.5 h-2.5" />
                        Pendiente de Sincronización
                      </span>
                    ) : selectedSale.syncStatus === 'STOCK_CONFLICT' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-900 border border-red-300">
                        <AlertCircle className="w-2.5 h-2.5" />
                        Conflicto de Stock
                      </span>
                    ) : selectedSale.syncStatus === 'ERROR' ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        Error de Sincronización
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle className="w-2.5 h-2.5" />
                        Sincronizada
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Offline metadata & Error banner if present */}
            {(selectedSale.syncMode === 'OFFLINE' || selectedSale.deviceId || selectedSale.syncError) && (
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-1 font-mono text-stone-600">
                <div className="flex items-center justify-between text-[11px]">
                  <span>Modo de Creación: <strong className="text-stone-800">{selectedSale.syncMode || 'ONLINE'}</strong></span>
                  {selectedSale.deviceId && (
                    <span className="text-[10px] text-stone-500">Dispositivo: {selectedSale.deviceId.slice(0, 12)}...</span>
                  )}
                </div>
                {selectedSale.syncError && (
                  <div className="mt-1 p-2 bg-red-50 border border-red-200 rounded text-red-900 text-[11px]">
                    <strong>Error / Conflicto:</strong> {selectedSale.syncError}
                  </div>
                )}
                {(selectedSale.syncStatus === 'STOCK_CONFLICT' || selectedSale.syncStatus === 'ERROR') && (
                  <button
                    onClick={() => {
                      setSelectedSale(null);
                      setShowSyncModal(true);
                    }}
                    className="mt-2 w-full py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1"
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Abrir Gestor de Conflictos Outbox</span>
                  </button>
                )}
              </div>
            )}

            {/* Items List */}
            <div className="space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-stone-600 block">
                Productos Vendidos ({selectedSale.items?.length || 0})
              </span>

              <div className="divide-y divide-stone-100 border border-stone-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
                {selectedSale.items?.map((item, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between bg-white text-xs">
                    <div>
                      <p className="font-bold text-stone-900">{item.productName}</p>
                      <p className="text-[10px] text-stone-400">
                        {item.quantity} u. x {formatCurrency(item.unitPrice)}
                        {item.barcode && ` • ${item.barcode}`}
                      </p>
                    </div>
                    <span className="font-black text-stone-900 font-mono">
                      {formatCurrency(item.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total Footer */}
            <div className="bg-stone-900 text-white p-3.5 rounded-xl flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-stone-400">Total Venta</span>
              <span className="text-2xl font-black font-mono text-emerald-400">
                {formatCurrency(selectedSale.total)}
              </span>
            </div>

            <button
              onClick={() => setSelectedSale(null)}
              className="w-full py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold rounded-xl text-xs transition-colors"
            >
              Cerrar
            </button>

          </div>
        </div>
      )}

      {/* Sync Operations Modal */}
      {business?.id && (
        <SyncOperationsModal
          businessId={business.id}
          isOpen={showSyncModal}
          onClose={() => setShowSyncModal(false)}
        />
      )}
    </div>
  );
};
