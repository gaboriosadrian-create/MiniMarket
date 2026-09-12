import React, { useState, useEffect, useMemo } from 'react';
import { ReplenishmentList, Product } from '../types';
import { formatRequestCode, downloadReplenishmentPDF } from '../lib/replenishmentPdf';
import { 
  FileSpreadsheet, 
  Search, 
  Filter, 
  RotateCcw, 
  Calendar, 
  Clock, 
  Truck, 
  User, 
  CheckCircle2, 
  XCircle, 
  X,
  AlertTriangle, 
  Download, 
  Share2, 
  Eye, 
  RefreshCw,
  LayoutList,
  LayoutGrid,
  ShieldCheck,
  Ban
} from 'lucide-react';

interface ReplenishmentHistoryViewProps {
  businessId: string;
  businessName: string;
  isAdmin: boolean;
  orders: ReplenishmentList[];
  loading: boolean;
  onRefresh: () => void;
  onSelectOrderForReview?: (order: ReplenishmentList) => void;
  onShareOrder: (order: ReplenishmentList) => void;
  onShowNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
  focusedOrderId?: string | null;
  onClearFocusedOrder?: () => void;
}

export const ReplenishmentHistoryView: React.FC<ReplenishmentHistoryViewProps> = ({
  businessId,
  businessName,
  isAdmin,
  orders,
  loading,
  onRefresh,
  onSelectOrderForReview,
  onShareOrder,
  onShowNotify,
  focusedOrderId = null,
  onClearFocusedOrder
}) => {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM'>('ALL');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // View mode
  const [viewMode, setViewMode] = useState<'ROW' | 'GRID'>('ROW');

  // Selected Order for Detail inspection
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<ReplenishmentList | null>(null);

  // Distinct suppliers from orders list
  const distinctSuppliers = useMemo(() => {
    const set = new Set<string>();
    orders.forEach(o => {
      if (o.supplierName && o.supplierName.trim()) {
        set.add(o.supplierName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [orders]);

  // Filtered orders
  const filteredOrders = useMemo(() => {
    if (focusedOrderId) {
      return orders.filter(order => order.id === focusedOrderId);
    }

    return orders.filter(order => {
      // 1. Search text
      if (searchTerm.trim()) {
        const query = searchTerm.trim().toLowerCase();
        const code = formatRequestCode(order.id).toLowerCase();
        const sup = (order.supplierName || '').toLowerCase();
        const creator = (order.creatorName || order.submitterName || '').toLowerCase();
        const hasProduct = (order.items || []).some(i => i.productName.toLowerCase().includes(query));
        if (!code.includes(query) && !sup.includes(query) && !creator.includes(query) && !hasProduct) {
          return false;
        }
      }

      // 2. Supplier
      if (supplierFilter !== 'ALL' && order.supplierName !== supplierFilter) {
        return false;
      }

      // 3. Status
      if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false;
      }

      // 4. Date filter
      const itemDateStr = order.createdAt || order.exportedAt || order.updatedAt;
      if (itemDateStr) {
        const orderDate = new Date(itemDateStr);
        const now = new Date();

        if (dateFilter === 'TODAY') {
          if (orderDate.toDateString() !== now.toDateString()) return false;
        } else if (dateFilter === 'WEEK') {
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          if (orderDate < weekAgo) return false;
        } else if (dateFilter === 'MONTH') {
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          if (orderDate < monthAgo) return false;
        } else if (dateFilter === 'CUSTOM') {
          if (dateStart) {
            const start = new Date(dateStart + 'T00:00:00');
            if (orderDate < start) return false;
          }
          if (dateEnd) {
            const end = new Date(dateEnd + 'T23:59:59.999');
            if (orderDate > end) return false;
          }
        }
      }

      return true;
    });
  }, [orders, searchTerm, supplierFilter, statusFilter, dateFilter, dateStart, dateEnd]);

  // Download PDF
  const handleDownloadPDF = (order: ReplenishmentList) => {
    try {
      const fileName = downloadReplenishmentPDF(order, businessName || 'uwi');
      onShowNotify(`PDF descargado (${fileName})`, 'success');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      onShowNotify('Error al descargar el PDF.', 'error');
    }
  };

  const getStatusBadge = (order: ReplenishmentList) => {
    switch (order.status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full uppercase border border-amber-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-amber-600" />
            <span>Pendiente Aprobación</span>
          </span>
        );
      case 'APPROVED':
        return (
          <span className="text-[10px] font-extrabold bg-purple-100 text-purple-950 px-2 py-0.5 rounded-full uppercase border border-purple-200 flex items-center gap-1">
            <ShieldCheck className="w-3 h-3 text-purple-600" />
            <span>Aprobado</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="text-[10px] font-extrabold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full uppercase border border-rose-200 flex items-center gap-1">
            <XCircle className="w-3 h-3 text-rose-600" />
            <span>Rechazado</span>
          </span>
        );
      case 'EXPORTED':
        return (
          <span className="text-[10px] font-extrabold bg-blue-100 text-blue-900 px-2 py-0.5 rounded-full uppercase border border-blue-200 flex items-center gap-1">
            <Truck className="w-3 h-3 text-blue-600" />
            <span>Enviado / Exportado</span>
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full uppercase border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            <span>Recibido en Stock</span>
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="text-[10px] font-extrabold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full uppercase border border-stone-200">
            Cancelado
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-extrabold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full uppercase">
            {order.status || 'Borrador'}
          </span>
        );
    }
  };

  const hasActiveFilters = searchTerm || supplierFilter !== 'ALL' || statusFilter !== 'ALL' || dateFilter !== 'ALL';

  return (
    <div className="space-y-4">
      {/* EXCLUSIVE FILTER BANNER FROM EVENT/NOTIFICATION */}
      {focusedOrderId && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in shadow-2xs">
          <div className="flex items-center gap-2.5 text-xs text-amber-950 font-bold">
            <Filter className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Mostrando exclusivamente la solicitud #{formatRequestCode(focusedOrderId)} vinculada al evento.</span>
          </div>
          {onClearFocusedOrder && (
            <button
              onClick={onClearFocusedOrder}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs rounded-xl transition-colors shrink-0 cursor-pointer flex items-center gap-1 shadow-2xs"
            >
              <X className="w-3.5 h-3.5" />
              <span>Ver todo el historial</span>
            </button>
          )}
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div className="bg-white border border-stone-200 rounded-2xl p-3.5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-purple-600" />
            Filtros del Historial
          </span>
          {hasActiveFilters && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSupplierFilter('ALL');
                setStatusFilter('ALL');
                setDateFilter('ALL');
                setDateStart('');
                setDateEnd('');
              }}
              className="text-[11px] font-bold text-purple-600 hover:text-purple-800 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Limpiar Filtros</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              placeholder="Buscar por código, proveedor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-purple-500 bg-white"
            />
          </div>

          {/* Supplier */}
          <div>
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-purple-500 bg-white font-medium cursor-pointer"
            >
              <option value="ALL">Todos los Proveedores ({distinctSuppliers.length})</option>
              {distinctSuppliers.map((sup) => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-purple-500 bg-white font-medium cursor-pointer"
            >
              <option value="ALL">Todos los Estados</option>
              <option value="PENDING_APPROVAL">Pendiente de Aprobación</option>
              <option value="APPROVED">Aprobado</option>
              <option value="EXPORTED">Enviado / Exportado</option>
              <option value="RECEIVED">Recibido en Stock</option>
              <option value="REJECTED">Rechazado</option>
              <option value="CANCELLED">Cancelado</option>
            </select>
          </div>

          {/* Date quick filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-stone-300 rounded-xl text-xs outline-none focus:ring-1 focus:ring-purple-500 bg-white font-medium cursor-pointer"
            >
              <option value="ALL">Todas las Fechas</option>
              <option value="TODAY">Hoy</option>
              <option value="WEEK">Últimos 7 días</option>
              <option value="MONTH">Últimos 30 días</option>
              <option value="CUSTOM">Rango personalizado</option>
            </select>
          </div>
        </div>

        {/* Custom date range picker */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
            <span className="text-[11px] font-bold text-stone-600">Desde:</span>
            <input
              type="date"
              value={dateStart}
              onChange={(e) => setDateStart(e.target.value)}
              className="px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs outline-none bg-white"
            />
            <span className="text-[11px] font-bold text-stone-600">Hasta:</span>
            <input
              type="date"
              value={dateEnd}
              onChange={(e) => setDateEnd(e.target.value)}
              className="px-2.5 py-1.5 border border-stone-300 rounded-lg text-xs outline-none bg-white"
            />
          </div>
        )}
      </div>

      {/* HEADER & VIEW TOGGLE */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
          Registros ({filteredOrders.length})
        </h4>
        <div className="flex items-center gap-1 bg-stone-100 p-0.5 rounded-lg border border-stone-200">
          <button
            type="button"
            onClick={() => setViewMode('ROW')}
            className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
              viewMode === 'ROW' ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Vista en Lista"
          >
            <LayoutList className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('GRID')}
            className={`p-1.5 rounded-md text-xs transition-all cursor-pointer ${
              viewMode === 'GRID' ? 'bg-white text-purple-700 shadow-2xs font-bold' : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Vista en Tarjetas"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ORDERS LIST */}
      {loading ? (
        <div className="p-8 text-center text-stone-500 text-xs bg-white rounded-2xl border border-stone-200">
          <RefreshCw className="w-5 h-5 animate-spin mx-auto text-purple-600 mb-2" />
          <span>Cargando historial de solicitudes...</span>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="p-8 text-center text-stone-500 text-xs bg-white rounded-2xl border border-stone-200 space-y-2">
          <FileSpreadsheet className="w-8 h-8 text-stone-400 mx-auto" />
          <p className="font-bold text-stone-700">No se encontraron solicitudes</p>
          <p className="text-stone-500 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Prueba modificando o limpiando los filtros seleccionados.'
              : 'Aún no se han generado solicitudes de reposición.'}
          </p>
        </div>
      ) : viewMode === 'ROW' ? (
        /* ROW VIEW */
        <div className="space-y-2.5">
          {filteredOrders.map((order) => {
            const reqCode = formatRequestCode(order.id);
            const totalUnits = (order.items || []).reduce((sum, i) => sum + (Number(i.requestedQuantity) || 0), 0);
            const orderDate = new Date(order.createdAt || order.exportedAt || Date.now()).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            });

            return (
              <div
                key={order.id}
                className="bg-white border border-stone-200 hover:border-purple-200 rounded-2xl p-3.5 sm:p-4 transition-all shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-black bg-purple-100 text-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-200">
                      {reqCode}
                    </span>
                    {getStatusBadge(order)}
                    <span className="text-xs font-bold text-stone-900 truncate">
                      {order.supplierName || 'Sin especificar'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5 text-xs text-stone-500 flex-wrap">
                    <span className="font-semibold text-stone-700">
                      {order.items?.length || 0} variedades · {totalUnits} un.
                    </span>
                    <span className="text-stone-300">|</span>
                    <span className="flex items-center gap-1 text-[11px]">
                      <Clock className="w-3 h-3 text-stone-400" />
                      {orderDate}
                    </span>
                    {(order.submitterName || order.creatorName) && (
                      <>
                        <span className="text-stone-300">|</span>
                        <span className="text-[11px] text-stone-600">
                          Por: {order.submitterName || order.creatorName}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Approval / Rejection notice */}
                  {order.status === 'REJECTED' && order.rejectReason && (
                    <div className="bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1 text-xs text-rose-900 mt-1 flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                      <span><strong>Motivo de rechazo:</strong> {order.rejectReason}</span>
                    </div>
                  )}

                  {order.status === 'APPROVED' && order.approverName && (
                    <div className="bg-purple-50/70 border border-purple-200 rounded-xl px-2.5 py-1 text-xs text-purple-900 mt-1 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                      <span>Aprobado por: <strong>{order.approverName}</strong> {order.approvalNotes ? `· "${order.approvalNotes}"` : ''}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-stretch lg:self-center shrink-0 border-t lg:border-t-0 pt-2 lg:pt-0 border-stone-100">
                  {order.status === 'PENDING_APPROVAL' && isAdmin && onSelectOrderForReview && (
                    <button
                      onClick={() => onSelectOrderForReview(order)}
                      className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Revisar y Aprobar</span>
                    </button>
                  )}

                  <button
                    onClick={() => setSelectedOrderDetail(order)}
                    className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-stone-500" />
                    <span>Detalle</span>
                  </button>

                  <button
                    onClick={() => onShareOrder(order)}
                    className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-xl cursor-pointer"
                    title="Compartir pedido"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => handleDownloadPDF(order)}
                    className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl cursor-pointer"
                    title="Descargar PDF"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filteredOrders.map((order) => {
            const reqCode = formatRequestCode(order.id);
            const totalUnits = (order.items || []).reduce((sum, i) => sum + (Number(i.requestedQuantity) || 0), 0);
            const orderDate = new Date(order.createdAt || order.exportedAt || Date.now()).toLocaleDateString('es-AR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric'
            });

            return (
              <div
                key={order.id}
                className="bg-white border border-stone-200 hover:border-purple-200 rounded-2xl p-4 space-y-3 transition-all shadow-2xs flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-mono font-black bg-purple-100 text-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-200">
                      {reqCode}
                    </span>
                    {getStatusBadge(order)}
                  </div>

                  <div>
                    <h4 className="font-bold text-stone-900 text-sm">{order.supplierName || 'Sin especificar'}</h4>
                    <p className="text-xs text-stone-500 mt-0.5">
                      {order.items?.length || 0} variedades · {totalUnits} unidades
                    </p>
                  </div>

                  {order.status === 'REJECTED' && order.rejectReason && (
                    <p className="text-[11px] text-rose-800 bg-rose-50 p-2 rounded-xl border border-rose-200">
                      <strong>Rechazo:</strong> {order.rejectReason}
                    </p>
                  )}
                </div>

                <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
                  <span className="text-stone-400 text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {orderDate}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {order.status === 'PENDING_APPROVAL' && isAdmin && onSelectOrderForReview && (
                      <button
                        onClick={() => onSelectOrderForReview(order)}
                        className="px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-lg cursor-pointer"
                      >
                        Revisar
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedOrderDetail(order)}
                      className="p-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg cursor-pointer"
                      title="Ver detalle"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => onShareOrder(order)}
                      className="p-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg cursor-pointer"
                      title="Compartir"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedOrderDetail && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl border border-stone-200 space-y-4 my-auto">
            <div className="flex items-start justify-between border-b border-stone-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-black bg-purple-100 text-purple-950 px-2.5 py-0.5 rounded-lg">
                    {formatRequestCode(selectedOrderDetail.id)}
                  </span>
                  {getStatusBadge(selectedOrderDetail)}
                </div>
                <h3 className="font-extrabold text-stone-900 text-base mt-1">
                  {selectedOrderDetail.supplierName || 'Proveedor'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedOrderDetail(null)}
                className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-stone-700">
                Productos ({selectedOrderDetail.items?.length || 0})
              </h4>
              <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden max-h-56 overflow-y-auto bg-stone-50/50">
                {selectedOrderDetail.items?.map((item) => (
                  <div key={item.productId} className="p-3 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-bold text-stone-900">{item.productName}</p>
                      <p className="text-[10px] text-stone-500 font-mono">Stock ref: {item.currentStock} un</p>
                    </div>
                    <div className="text-right">
                      <span className="font-black text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg font-mono">
                        {item.approvedQuantity !== undefined ? item.approvedQuantity : item.requestedQuantity} un
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedOrderDetail.notes && (
              <div className="text-xs bg-stone-50 p-3 rounded-xl border border-stone-200 text-stone-700">
                <strong>Notas:</strong> {selectedOrderDetail.notes}
              </div>
            )}

            <div className="pt-2 border-t border-stone-100 flex items-center justify-between gap-2">
              <button
                onClick={() => handleDownloadPDF(selectedOrderDetail)}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => {
                  const o = selectedOrderDetail;
                  setSelectedOrderDetail(null);
                  onShareOrder(o);
                }}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartir</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
