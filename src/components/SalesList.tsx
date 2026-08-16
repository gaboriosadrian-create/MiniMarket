import React, { useState, useEffect } from 'react';
import { useAuth } from '../lib/authContext';
import { Sale } from '../types';
import { getSalesByBusiness } from '../lib/saleService';
import { DateFilter } from './DateFilter';
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
  DollarSign
} from 'lucide-react';

export const SalesList: React.FC = () => {
  const { business } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [dateRangeLabel, setDateRangeLabel] = useState('Hoy');
  const [startDateIso, setStartDateIso] = useState<string>('');
  const [endDateIso, setEndDateIso] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const loadSales = async (start?: string, end?: string) => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const data = await getSalesByBusiness(business.id, start || startDateIso, end || endDateIso);
      setSales(data);
    } catch (err) {
      console.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDateRangeChange = (start: string, end: string, label: string) => {
    setStartDateIso(start);
    setEndDateIso(end);
    setDateRangeLabel(label);
    loadSales(start, end);
  };

  // Metrics calculation
  const totalCount = sales.length;
  const totalAmount = sales.reduce((acc, s) => acc + (s.total || 0), 0);
  const cashAmount = sales
    .filter((s) => s.paymentMethod === 'EFECTIVO')
    .reduce((acc, s) => acc + (s.total || 0), 0);
  const mpAmount = sales
    .filter((s) => s.paymentMethod === 'MERCADO_PAGO')
    .reduce((acc, s) => acc + (s.total || 0), 0);

  const filteredSales = sales.filter((s) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.id?.toLowerCase().includes(term) ||
      s.sellerName?.toLowerCase().includes(term) ||
      s.paymentMethod?.toLowerCase().includes(term) ||
      s.items?.some((i) => i.productName.toLowerCase().includes(term))
    );
  });

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
      {/* Date Filter */}
      <DateFilter onDateRangeChange={handleDateRangeChange} />

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
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-emerald-600" />
            <h3 className="text-base font-extrabold text-stone-900">
              Histórico de Ventas ({filteredSales.length})
            </h3>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
              <input
                type="text"
                placeholder="Buscar venta, producto..."
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

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-700">
            <thead className="bg-stone-50 border-b border-stone-200 uppercase tracking-wider text-[11px] text-stone-500 font-bold">
              <tr>
                <th className="py-3 px-4">Hora / Fecha</th>
                <th className="py-3 px-4">Vendedor</th>
                <th className="py-3 px-4">Productos</th>
                <th className="py-3 px-4">Medio de Pago</th>
                <th className="py-3 px-4 text-right">Total</th>
                <th className="py-3 px-4 text-center">Estado</th>
                <th className="py-3 px-4 text-right">Acción</th>
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
              ) : filteredSales.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-stone-400">
                    No se encontraron ventas para el período seleccionado.
                  </td>
                </tr>
              ) : (
                filteredSales.map((sale) => (
                  <tr 
                    key={sale.id} 
                    onClick={() => setSelectedSale(sale)}
                    className="hover:bg-stone-50/80 cursor-pointer transition-colors"
                  >
                    <td className="py-3 px-4 font-mono font-bold text-stone-900">
                      <div>{formatTime(sale.createdAt)}</div>
                      <div className="text-[10px] text-stone-400 font-normal">{formatDate(sale.createdAt)}</div>
                    </td>

                    <td className="py-3 px-4 font-semibold text-stone-800">
                      <div className="flex items-center space-x-1.5">
                        <User className="w-3 h-3 text-stone-400 shrink-0" />
                        <span>{sale.sellerName}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 max-w-xs truncate text-stone-600">
                      {sale.items?.map((i) => `${i.quantity}x ${i.productName}`).join(', ')}
                    </td>

                    <td className="py-3 px-4">
                      {sale.paymentMethod === 'EFECTIVO' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          💵 EFECTIVO
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-200">
                          🟦 MERCADO PAGO
                        </span>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-black text-stone-900 font-mono text-sm">
                      {formatCurrency(sale.total)}
                    </td>

                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-stone-100 text-stone-700">
                        {sale.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right">
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
                <span className="font-extrabold text-emerald-700">{selectedSale.paymentMethod}</span>
              </div>

              <div>
                <span className="text-stone-400 block text-[10px] font-bold uppercase">Estado</span>
                <span className="font-extrabold text-stone-700">{selectedSale.status}</span>
              </div>
            </div>

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
    </div>
  );
};
