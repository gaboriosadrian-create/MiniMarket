import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../lib/authContext';
import { 
  BusinessEvent, 
  BusinessEntityType, 
  EventFilterOptions 
} from '../types';
import { 
  getBusinessEvents, 
  getEventNavigationTarget 
} from '../lib/eventService';
import { 
  Activity, 
  Search, 
  Filter, 
  RefreshCw, 
  ArrowRight, 
  Calendar, 
  ShoppingBag, 
  Truck, 
  Receipt, 
  CreditCard, 
  PackageCheck, 
  AlertTriangle, 
  FileText, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Info, 
  ExternalLink,
  SlidersHorizontal,
  Clock,
  User,
  Tag,
  Copy,
  Check,
  Ban,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface EventCenterProps {
  onNavigateTab?: (tab: string, entityId?: string) => void;
}

export const EventCenter: React.FC<EventCenterProps> = ({ onNavigateTab }) => {
  const { business } = useAuth();
  const [events, setEvents] = useState<BusinessEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<BusinessEvent | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  // Filters
  const [preset, setPreset] = useState<'HOY' | 'AYER' | 'ULTIMOS_7' | 'ULTIMOS_30' | 'CUSTOM'>('HOY');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [entityType, setEntityType] = useState<BusinessEntityType | 'ALL' | 'CANCELLATIONS'>('ALL');
  const [subFilter, setSubFilter] = useState<'ALL' | 'SHORTAGES' | 'SURPLUSES' | 'CANCELLATIONS'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadEvents = async () => {
    if (!business?.id) return;
    setLoading(true);
    try {
      const filter: EventFilterOptions = {
        preset,
        startDate: preset === 'CUSTOM' ? startDate : undefined,
        endDate: preset === 'CUSTOM' ? endDate : undefined,
        entityType,
        subFilter: entityType === 'RECEIVING' ? subFilter : undefined,
        searchQuery: searchQuery.trim() || undefined,
        limitCount: 150
      };
      const result = await getBusinessEvents(business.id, filter);
      setEvents(result);
    } catch (err) {
      console.error('[EventCenter] Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, [business?.id, preset, startDate, endDate, entityType, subFilter]);

  // Debounced/triggered search filter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadEvents();
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    if (!business?.id) return;
    setLoading(true);
    getBusinessEvents(business.id, {
      preset,
      startDate: preset === 'CUSTOM' ? startDate : undefined,
      endDate: preset === 'CUSTOM' ? endDate : undefined,
      entityType,
      subFilter: entityType === 'RECEIVING' ? subFilter : undefined,
      limitCount: 150
    })
      .then(res => setEvents(res))
      .catch(err => console.error('[EventCenter] Error resetting search:', err))
      .finally(() => setLoading(false));
  };

  const handleNavigate = (event: BusinessEvent) => {
    if (!onNavigateTab) return;
    const target = getEventNavigationTarget(event);
    onNavigateTab(target.tab, target.entityId);
  };

  const copyToClipboard = (text: string) => {
    if (!navigator.clipboard) return;
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getEntityBadge = (event: BusinessEvent) => {
    const isCancelled = event.type.includes('CANCELLED') || 
                        event.type.includes('REJECTED') || 
                        event.metadata?.status === 'CANCELLED' || 
                        event.metadata?.status === 'ANULADO';

    if (isCancelled) {
      return { 
        label: 'Anulación', 
        bg: 'bg-rose-50 text-rose-700 border-rose-200', 
        tagBg: 'bg-rose-100 text-rose-800',
        icon: Ban 
      };
    }

    if (event.type === 'SHORTAGE_DETECTED' || event.type === 'SHORTAGE_CLOSED') {
      return { 
        label: 'Faltante', 
        bg: 'bg-amber-50 text-amber-800 border-amber-200', 
        tagBg: 'bg-amber-100 text-amber-900',
        icon: AlertTriangle 
      };
    }

    if (event.type.startsWith('SURPLUS_')) {
      return { 
        label: 'Sobrante', 
        bg: 'bg-teal-50 text-teal-800 border-teal-200', 
        tagBg: 'bg-teal-100 text-teal-900',
        icon: CheckCircle2 
      };
    }

    switch (event.entityType) {
      case 'SALE':
        return { label: 'Venta', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', tagBg: 'bg-emerald-100 text-emerald-800', icon: ShoppingBag };
      case 'PURCHASE':
        return { label: 'Compra', bg: 'bg-blue-50 text-blue-700 border-blue-200', tagBg: 'bg-blue-100 text-blue-800', icon: Truck };
      case 'RECEIVING':
        return { label: 'Recepción', bg: 'bg-indigo-50 text-indigo-700 border-indigo-200', tagBg: 'bg-indigo-100 text-indigo-800', icon: PackageCheck };
      case 'EXPENSE':
        return { label: 'Gasto Op.', bg: 'bg-pink-50 text-pink-700 border-pink-200', tagBg: 'bg-pink-100 text-pink-800', icon: Receipt };
      case 'OBLIGATION':
        return { label: 'Deuda / Pago', bg: 'bg-amber-50 text-amber-700 border-amber-200', tagBg: 'bg-amber-100 text-amber-800', icon: CreditCard };
      case 'INVENTORY':
        return { label: 'Inventario', bg: 'bg-purple-50 text-purple-700 border-purple-200', tagBg: 'bg-purple-100 text-purple-800', icon: Tag };
      case 'REQUEST':
        return { label: 'Reposición', bg: 'bg-cyan-50 text-cyan-700 border-cyan-200', tagBg: 'bg-cyan-100 text-cyan-800', icon: FileText };
      case 'CASH':
        return { label: 'Caja', bg: 'bg-emerald-50 text-emerald-800 border-emerald-300', tagBg: 'bg-emerald-100 text-emerald-900', icon: DollarSign };
      default:
        return { label: 'Operación', bg: 'bg-stone-50 text-stone-700 border-stone-200', tagBg: 'bg-stone-100 text-stone-800', icon: Activity };
    }
  };

  const formatEventDate = (isoString?: string) => {
    if (!isoString) return '-';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: events.length,
      SALE: 0,
      PURCHASE: 0,
      RECEIVING: 0,
      EXPENSE: 0,
      OBLIGATION: 0,
      INVENTORY: 0,
      REQUEST: 0,
      CANCELLATIONS: 0
    };
    for (const e of events) {
      if (counts[e.entityType] !== undefined) {
        counts[e.entityType]++;
      }
      if (
        e.type.includes('CANCELLED') || 
        e.type.includes('REJECTED') || 
        e.metadata?.status === 'CANCELLED' || 
        e.metadata?.status === 'ANULADO' || 
        e.title.toLowerCase().includes('anulad')
      ) {
        counts.CANCELLATIONS++;
      }
    }
    return counts;
  }, [events]);

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="bg-white p-4 rounded-xl border border-stone-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 rounded-xl text-indigo-600 border border-indigo-100">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-stone-900">Centro de Eventos del Negocio</h2>
              <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-[10px] font-bold rounded-full uppercase tracking-wider">
                Trazabilidad Operacional
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              Línea de tiempo cronológica unificada de hechos del negocio: ventas, compras, recepciones, faltantes, deudas, gastos y anulaciones.
            </p>
          </div>
        </div>

        <button
          onClick={loadEvents}
          disabled={loading}
          className="self-start md:self-auto px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
          title="Actualizar eventos"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar</span>
        </button>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-3 rounded-xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Period Presets */}
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-xs font-semibold text-stone-500 mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" />
              Período:
            </span>
            {(['HOY', 'AYER', 'ULTIMOS_7', 'ULTIMOS_30', 'CUSTOM'] as const).map((p) => {
              const labels = {
                HOY: 'Hoy',
                AYER: 'Ayer',
                ULTIMOS_7: 'Últimos 7 días',
                ULTIMOS_30: 'Últimos 30 días',
                CUSTOM: 'Personalizado'
              };
              return (
                <button
                  key={p}
                  onClick={() => setPreset(p)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors cursor-pointer ${
                    preset === p
                      ? 'bg-indigo-600 text-white font-bold shadow-xs'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Search Query Form */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Producto, proveedor, ID, comprobante..."
                className="w-full pl-8 pr-7 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
                  title="Limpiar búsqueda"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Buscar
            </button>
          </form>
        </div>

        {/* Custom Date Range Picker */}
        {preset === 'CUSTOM' && (
          <div className="flex items-center gap-2 p-2 bg-stone-50 rounded-lg border border-stone-200 text-xs text-stone-700">
            <span className="font-semibold">Desde:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-2 py-1 bg-white border border-stone-200 rounded text-xs"
            />
            <span className="font-semibold">Hasta:</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-2 py-1 bg-white border border-stone-200 rounded text-xs"
            />
          </div>
        )}

        {/* Entity Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-stone-100 pt-2.5">
          <span className="text-xs font-semibold text-stone-500 mr-1 shrink-0 flex items-center gap-1">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Módulo:
          </span>
          {[
            { id: 'ALL', label: 'Todos los eventos' },
            { id: 'SALE', label: 'Ventas' },
            { id: 'PURCHASE', label: 'Compras' },
            { id: 'RECEIVING', label: 'Recepciones' },
            { id: 'OBLIGATION', label: 'Obligaciones' },
            { id: 'EXPENSE', label: 'Gastos' },
            { id: 'INVENTORY', label: 'Inventario' },
            { id: 'REQUEST', label: 'Reposición' },
            { id: 'CANCELLATIONS', label: 'Anulaciones' }
          ].map((tab) => {
            const isSelected = entityType === tab.id;
            const isCancelTab = tab.id === 'CANCELLATIONS';
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setEntityType(tab.id as any);
                  if (tab.id !== 'RECEIVING') setSubFilter('ALL');
                }}
                className={`px-2.5 py-1 text-xs rounded-lg font-medium whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? isCancelTab
                      ? 'bg-rose-700 text-white font-bold shadow-xs'
                      : 'bg-stone-900 text-white font-bold shadow-xs'
                    : isCancelTab
                    ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                }`}
              >
                <span>{tab.label}</span>
                {entityCounts[tab.id] !== undefined && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-stone-200 text-stone-700'
                  }`}>
                    {entityCounts[tab.id]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Subfilter for Receivings (Faltantes y Sobrantes) */}
        {entityType === 'RECEIVING' && (
          <div className="flex items-center gap-1.5 pt-1 text-xs">
            <span className="text-stone-400 font-medium mr-1">Filtro de Recepción:</span>
            {[
              { id: 'ALL', label: 'Todas las recepciones' },
              { id: 'SHORTAGES', label: 'Solo Faltantes' },
              { id: 'SURPLUSES', label: 'Solo Sobrantes' }
            ].map((sub) => (
              <button
                key={sub.id}
                onClick={() => setSubFilter(sub.id as any)}
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold cursor-pointer transition-colors ${
                  subFilter === sub.id
                    ? 'bg-indigo-600 text-white'
                    : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Events Timeline / List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500">
          <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin mx-auto mb-2" />
          <p className="text-sm font-semibold">Cargando eventos operativos...</p>
        </div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-xl border border-stone-200 p-12 text-center text-stone-500">
          <Activity className="w-10 h-10 text-stone-300 mx-auto mb-2" />
          <p className="text-sm font-bold text-stone-800">No se encontraron eventos para el filtro seleccionado</p>
          <p className="text-xs text-stone-400 mt-1">Prueba ampliando el rango de fechas o limpiando los términos de búsqueda.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1 text-xs text-stone-500">
            <span>Mostrando <strong>{events.length}</strong> hechos operativos</span>
            <span>Orden cronológico descendente (más reciente primero)</span>
          </div>

          <div className="space-y-2">
            {events.map((event) => {
              const badge = getEntityBadge(event);
              const Icon = badge.icon;
              const hasAmount = typeof event.metadata?.amount === 'number';
              const isCancelled = event.type.includes('CANCELLED') || event.type.includes('REJECTED');

              return (
                <div
                  key={event.id}
                  className={`bg-white p-3.5 rounded-xl border shadow-xs transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isCancelled ? 'border-rose-200 hover:border-rose-400 bg-rose-50/20' : 'border-stone-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg border ${badge.bg} shrink-0 mt-0.5`}>
                      <Icon className="w-4 h-4" />
                    </div>

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold ${badge.bg}`}>
                          {badge.label}
                        </span>
                        <h4 className="font-bold text-stone-900 text-xs sm:text-sm">
                          {event.title}
                        </h4>
                        {hasAmount && (
                          <span className="font-extrabold text-stone-900 text-xs px-2 py-0.5 bg-stone-100 rounded-md">
                            ${Number(event.metadata?.amount).toLocaleString('es-AR')}
                          </span>
                        )}
                        {event.metadata?.fundSource && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                            event.metadata.fundSource === 'PERSONAL' ? 'bg-purple-100 text-purple-800' : 'bg-stone-100 text-stone-700'
                          }`}>
                            Fondo: {String(event.metadata.fundSource)}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-stone-600">
                        {event.description}
                      </p>

                      <div className="flex items-center gap-3 text-[11px] text-stone-400 pt-1 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatEventDate(event.createdAt)}
                        </span>
                        {event.actorName && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {event.actorName}
                          </span>
                        )}
                        <span className="text-stone-400 font-mono text-[10px]">
                          ID: {event.entityId?.slice(-8) || event.id.slice(-8)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      onClick={() => {
                        setSelectedEvent(event);
                        setShowRawJson(false);
                      }}
                      className="px-2.5 py-1.5 text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                      title="Ver detalles del evento"
                    >
                      Ver Detalle
                    </button>

                    {onNavigateTab && (
                      <button
                        onClick={() => handleNavigate(event)}
                        className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <span>Ir a la operación</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Comprehensive Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="p-4 border-b border-stone-200 flex items-center justify-between bg-stone-50/50">
              <div className="flex items-center gap-2.5">
                <div className={`p-1.5 rounded-lg border ${getEntityBadge(selectedEvent).bg}`}>
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-stone-900">Detalle del Hecho Operativo</h3>
                  <p className="text-[11px] text-stone-400">Trazabilidad completa sin impacto contable secundario</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-4 text-xs text-stone-700 max-h-[72vh] overflow-y-auto">
              {/* Event Title & Summary */}
              <div className="bg-stone-50 p-3.5 rounded-xl border border-stone-200 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getEntityBadge(selectedEvent).tagBg}`}>
                      {getEntityBadge(selectedEvent).label}
                    </span>
                    <h4 className="font-bold text-stone-900 text-sm mt-1">
                      {selectedEvent.title}
                    </h4>
                    <p className="text-xs text-stone-600 mt-0.5">
                      {selectedEvent.description}
                    </p>
                  </div>
                </div>
              </div>

              {/* Four Essential Questions */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {/* 1. ¿Cuándo? */}
                <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">¿Cuándo ocurrió?</p>
                  <p className="font-semibold text-stone-900 mt-1">{formatEventDate(selectedEvent.createdAt)}</p>
                  <p className="text-[10px] text-stone-400 font-mono mt-0.5">{selectedEvent.createdAt}</p>
                </div>

                {/* 2. ¿Quién? */}
                <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">¿Quién lo realizó?</p>
                  <p className="font-semibold text-stone-900 mt-1">{selectedEvent.actorName || 'Operador / Sistema'}</p>
                  <p className="text-[10px] text-stone-400 font-mono mt-0.5">ID: {selectedEvent.actorUserId || 'N/A'}</p>
                </div>

                {/* 3. ¿Sobre qué operación? */}
                <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">¿Sobre qué operación?</p>
                    <button
                      onClick={() => copyToClipboard(selectedEvent.entityId)}
                      className="text-stone-400 hover:text-stone-700 flex items-center gap-0.5 text-[10px] cursor-pointer"
                      title="Copiar ID de la entidad"
                    >
                      {copiedId ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedId ? 'Copiado' : 'Copiar'}</span>
                    </button>
                  </div>
                  <p className="font-bold text-stone-900 mt-1">{selectedEvent.entityType}</p>
                  <p className="text-[10px] text-stone-500 font-mono break-all mt-0.5">{selectedEvent.entityId}</p>
                </div>

                {/* 4. ¿Qué estado produjo? */}
                <div className="p-3 bg-stone-50/80 rounded-lg border border-stone-200">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Tipo de Evento Normalizado</p>
                  <p className="font-mono font-bold text-indigo-900 mt-1">{selectedEvent.type}</p>
                  <p className="text-[10px] text-stone-400 mt-0.5">ID determinista idempotente</p>
                </div>
              </div>

              {/* Structured Relevant Metadata Grid */}
              {selectedEvent.metadata && Object.keys(selectedEvent.metadata).length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-stone-700 uppercase tracking-wider">Datos relevantes del hecho:</p>
                  <div className="bg-stone-50 p-3 rounded-lg border border-stone-200 grid grid-cols-2 gap-2 text-xs">
                    {Object.entries(selectedEvent.metadata)
                      .filter(([key]) => key !== 'destinationTab')
                      .map(([key, value]) => (
                        <div key={key} className="space-y-0.5">
                          <span className="text-[10px] font-semibold text-stone-400 uppercase">{key}:</span>
                          <p className="font-medium text-stone-800 break-words">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Collapsible Technical JSON Audit */}
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="w-full p-2.5 bg-stone-100 hover:bg-stone-200/70 text-left font-semibold text-stone-700 flex items-center justify-between text-xs cursor-pointer transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-stone-500" />
                    <span>Auditoría Técnica del Registro (JSON crudo)</span>
                  </div>
                  {showRawJson ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
                {showRawJson && (
                  <pre className="p-3 bg-stone-900 text-stone-100 text-[10px] overflow-x-auto font-mono max-h-48 leading-relaxed">
                    {JSON.stringify(selectedEvent, null, 2)}
                  </pre>
                )}
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-3 bg-stone-50 border-t border-stone-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-xs font-semibold rounded-lg cursor-pointer transition-colors"
              >
                Cerrar
              </button>
              {onNavigateTab && (
                <button
                  onClick={() => {
                    const ev = selectedEvent;
                    setSelectedEvent(null);
                    handleNavigate(ev);
                  }}
                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <span>Ir a la operación</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
