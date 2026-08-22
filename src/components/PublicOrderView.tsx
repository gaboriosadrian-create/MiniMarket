import React, { useEffect, useState, useMemo } from 'react';
import {
  Calendar,
  User,
  Truck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  Share2,
  Printer,
  Check,
  Package,
  Layers,
  FileText,
  Store,
  Minus,
  Plus,
  ArrowRight,
  Send,
  Sparkles,
  HelpCircle
} from 'lucide-react';
import { PublicOrder, PublicOrderItem, ProviderOrderResponse } from '../types';
import { getPublicOrder, confirmPublicOrderByProvider, sharePublicOrderLink } from '../lib/publicOrderService';
import { NotFoundView } from './NotFoundView';

interface PublicOrderViewProps {
  token: string;
  onExit?: () => void;
}

export const PublicOrderView: React.FC<PublicOrderViewProps> = ({ token, onExit }) => {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  // Supplier Confirmation Form State
  const [confirmedQtys, setConfirmedQtys] = useState<Record<string, number>>({});
  const [providerNote, setProviderNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [justConfirmed, setJustConfirmed] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await getPublicOrder(token);
        if (!data) {
          setError('No se encontró el pedido o el enlace no es válido.');
        } else {
          setOrder(data);
          // Initialize confirmed quantities with requested quantities
          const initial: Record<string, number> = {};
          data.items.forEach((it) => {
            const key = it.productName;
            if (data.providerResponse?.items) {
              const matched = data.providerResponse.items.find(r => r.productName === it.productName);
              initial[key] = matched ? matched.confirmedQuantity : it.requestedQuantity;
            } else if (it.confirmedQuantity !== undefined) {
              initial[key] = it.confirmedQuantity;
            } else {
              initial[key] = it.requestedQuantity;
            }
          });
          setConfirmedQtys(initial);
          if (data.providerNote || data.providerResponse?.providerNote) {
            setProviderNote(data.providerNote || data.providerResponse?.providerNote || '');
          }
        }
      } catch (err: any) {
        console.error('Error loading public order:', err);
        setError('Ocurrió un error al cargar la información del pedido.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [token]);

  // Group items by category
  const categorizedItems: Record<string, PublicOrderItem[]> = useMemo(() => {
    if (!order?.items) return {};
    const map: Record<string, PublicOrderItem[]> = {};
    order.items.forEach((item) => {
      const cat = (item.category && item.category.trim()) ? item.category.trim().toUpperCase() : 'VARIOS';
      if (!map[cat]) {
        map[cat] = [];
      }
      map[cat].push(item);
    });
    // Sort categories alphabetically
    const sortedMap: Record<string, PublicOrderItem[]> = {};
    Object.keys(map).sort((a, b) => a.localeCompare(b, 'es')).forEach((key) => {
      sortedMap[key] = map[key].sort((a, b) => a.productName.localeCompare(b.productName, 'es'));
    });
    return sortedMap;
  }, [order?.items]);

  // Handle stepping quantities
  const handleSetQuantity = (productName: string, value: number) => {
    const clean = Math.max(0, Math.floor(Number(value) || 0));
    setConfirmedQtys(prev => ({
      ...prev,
      [productName]: clean
    }));
  };

  const handleStepQuantity = (productName: string, delta: number) => {
    setConfirmedQtys(prev => {
      const current = prev[productName] ?? 0;
      const next = Math.max(0, current + delta);
      return {
        ...prev,
        [productName]: next
      };
    });
  };

  // Mass actions
  const handleMarkAllComplete = () => {
    if (!order) return;
    const next: Record<string, number> = {};
    order.items.forEach(it => {
      next[it.productName] = it.requestedQuantity;
    });
    setConfirmedQtys(next);
  };

  const handleMarkAllOutOfStock = () => {
    if (!order) return;
    const next: Record<string, number> = {};
    order.items.forEach(it => {
      next[it.productName] = 0;
    });
    setConfirmedQtys(next);
  };

  // Summary Metrics
  const summary = useMemo(() => {
    if (!order?.items) {
      return { totalRequested: 0, totalConfirmed: 0, complete: 0, partial: 0, noStock: 0, surplus: 0 };
    }
    let totalRequested = 0;
    let totalConfirmed = 0;
    let complete = 0;
    let partial = 0;
    let noStock = 0;
    let surplus = 0;

    order.items.forEach(it => {
      const req = it.requestedQuantity;
      const conf = confirmedQtys[it.productName] ?? req;
      totalRequested += req;
      totalConfirmed += conf;

      if (conf === 0) {
        noStock++;
      } else if (conf === req) {
        complete++;
      } else if (conf < req) {
        partial++;
      } else {
        surplus++;
      }
    });

    return { totalRequested, totalConfirmed, complete, partial, noStock, surplus };
  }, [order?.items, confirmedQtys]);

  // Submit supplier confirmation
  const handleConfirmOrder = async () => {
    if (!order) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const inputItems = order.items.map(it => ({
        productId: it.productId,
        productName: it.productName,
        requestedQuantity: it.requestedQuantity,
        confirmedQuantity: confirmedQtys[it.productName] ?? it.requestedQuantity,
        unitText: it.unitText,
        category: it.category
      }));

      const res = await confirmPublicOrderByProvider(
        order.token || order.publicCode,
        inputItems,
        providerNote
      );

      // Update local order state
      setOrder(prev => {
        if (!prev) return null;
        return {
          ...prev,
          status: 'CONFIRMED_BY_PROVIDER',
          statusLabel: 'Pedido confirmado por proveedor',
          providerResponse: res,
          providerConfirmedAt: res.confirmedAt,
          providerNote: res.providerNote,
          totalUnitsConfirmed: res.totalUnitsConfirmed
        };
      });

      setShowConfirmModal(false);
      setJustConfirmed(true);
    } catch (err: any) {
      console.error('Error confirming order:', err);
      setSubmitError(err?.message || 'Error al guardar la confirmación.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyTextSummary = async () => {
    if (!order) return;
    const lines: string[] = [];
    const isConf = order.status === 'CONFIRMED_BY_PROVIDER' || justConfirmed;

    lines.push(`📦 *PEDIDO DE MERCADERÍA - ${order.businessName}*`);
    lines.push(`📄 Solicitud N.º ${order.requestCode}`);
    lines.push(`📅 Fecha: ${formatDate(order.createdAt)} · ${formatTime(order.createdAt)}`);
    if (order.supplierName) lines.push(`🚚 Proveedor: ${order.supplierName}`);
    lines.push(`👤 Solicitado por: ${order.requestedBy}`);

    if (isConf) {
      lines.push(`🟢 *ESTADO: CONFIRMADO POR PROVEEDOR*`);
      if (order.providerConfirmedAt) {
        lines.push(`⏰ Confirmado el: ${formatDate(order.providerConfirmedAt)} ${formatTime(order.providerConfirmedAt)}`);
      }
    }
    lines.push('');
    lines.push('📋 *PRODUCTOS:*');

    Object.entries(categorizedItems).forEach(([category, items]) => {
      lines.push(`\n📁 *${category}*`);
      items.forEach((it) => {
        const conf = confirmedQtys[it.productName] ?? it.requestedQuantity;
        if (isConf) {
          let mark = '✅';
          if (conf === 0) mark = '❌ (Sin stock)';
          else if (conf < it.requestedQuantity) mark = `⚠️ (Parcial: ${conf}/${it.requestedQuantity})`;
          else if (conf > it.requestedQuantity) mark = `➕ (Extra: ${conf}/${it.requestedQuantity})`;
          lines.push(`• ${it.productName}: ${conf} un. confirmadas (de ${it.requestedQuantity} pedidas) ${mark}`);
        } else {
          lines.push(`• ${it.requestedQuantity} ${it.unitText || 'un'} - ${it.productName}`);
        }
      });
    });

    lines.push('');
    if (isConf) {
      lines.push(`🔢 *TOTAL CONFIRMADO:* ${summary.totalConfirmed} unidades (de ${summary.totalRequested} solicitadas)`);
      lines.push(`📊 *RESUMEN:* ${summary.complete} completos · ${summary.partial} parciales · ${summary.noStock} sin stock`);
      if (providerNote || order.providerNote) {
        lines.push(`📝 *Aclaración del Proveedor:* ${providerNote || order.providerNote}`);
      }
    } else {
      lines.push(`🔢 *TOTAL:* ${order.totalProductsCount} variedades · ${order.totalUnitsCount} unidades`);
      if (order.notes) {
        lines.push(`📝 *Notas:* ${order.notes}`);
      }
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 2500);
    } catch {
      alert('No se pudo copiar automáticamente.');
    }
  };

  const handleShareLink = async () => {
    if (!order) return;
    const res = await sharePublicOrderLink(order);
    if (res.status === 'copied') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes} hs`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-200 text-center max-w-sm w-full space-y-4">
          <div className="w-12 h-12 border-4 border-[#0057FF] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <div>
            <h2 className="text-base font-extrabold text-stone-900">Cargando pedido...</h2>
            <p className="text-xs text-stone-500 mt-1">Obteniendo el detalle de la solicitud</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <NotFoundView
        type="order"
        requestCode={token}
        message={error || 'El pedido no fue encontrado o el enlace ha caducado. Por favor, verifica el enlace con el emisor.'}
        onAction={onExit}
        actionLabel="Volver al Inicio"
      />
    );
  }

  const isCancelled = order.status === 'CANCELLED';
  const isReceived = order.status === 'RECEIVED';
  const isConfirmedByProvider = order.status === 'CONFIRMED_BY_PROVIDER' || justConfirmed;
  const isEditable = !isCancelled && !isReceived && !isConfirmedByProvider;

  return (
    <div className="min-h-screen bg-stone-100 py-4 sm:py-8 px-3 sm:px-4 flex justify-center selection:bg-blue-200">
      <div className="w-full max-w-2xl space-y-4 pb-20">
        
        {/* JUST CONFIRMED CELEBRATION BANNER */}
        {justConfirmed && (
          <div className="bg-emerald-600 text-white p-4 sm:p-5 rounded-3xl shadow-md flex items-center gap-3.5 animate-in fade-in slide-in-from-top-2">
            <div className="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight">¡Pedido confirmado con éxito!</h3>
              <p className="text-xs text-emerald-100 mt-0.5">
                Tu respuesta de cantidades quedó registrada y fue informada a {order.businessName}.
              </p>
            </div>
          </div>
        )}

        {/* TOP STATUS BANNER IF CANCELLED OR RECEIVED OR ALREADY CONFIRMED */}
        {isCancelled && (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="font-extrabold block text-sm">Este pedido fue cancelado</strong>
              <span>La solicitud ya no está vigente ni pendiente de entrega.</span>
              {order.cancelledAt && (
                <span className="block text-[11px] text-rose-700 mt-0.5">
                  Cancelado el {formatDate(order.cancelledAt)} a las {formatTime(order.cancelledAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {isReceived && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="font-extrabold block text-sm">Productos recibidos en local</strong>
              <span>Este pedido ya fue recibido e ingresado al stock del comercio.</span>
              {order.receivedAt && (
                <span className="block text-[11px] text-emerald-700 mt-0.5">
                  Recibido el {formatDate(order.receivedAt)} a las {formatTime(order.receivedAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {isConfirmedByProvider && !justConfirmed && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-950 p-4 rounded-2xl flex items-start gap-3 shadow-xs animate-in fade-in">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <strong className="font-extrabold block text-sm text-emerald-900">Pedido confirmado previamente</strong>
              <span>Tu compromiso de entrega ya se encuentra registrado.</span>
              {order.providerConfirmedAt && (
                <span className="block text-[11px] text-emerald-700 mt-0.5 font-medium">
                  Confirmado el {formatDate(order.providerConfirmedAt)} a las {formatTime(order.providerConfirmedAt)}
                </span>
              )}
            </div>
          </div>
        )}

        {/* MAIN ORDER CARD */}
        <div className="bg-white rounded-3xl border border-stone-200 shadow-sm overflow-hidden">
          
          {/* HEADER SECTION (Deep Slate Background) */}
          <div className="bg-[#064E3B] text-white p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 w-36 h-36 bg-emerald-700/20 rounded-full blur-xl pointer-events-none" />

            <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 bg-emerald-900/60 border border-emerald-500/30 text-emerald-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider mb-2">
                  <Store className="w-3.5 h-3.5" />
                  <span>{order.businessName}</span>
                </div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                  Pedido de Productos
                </h1>
                <p className="text-xs text-emerald-100/80 font-mono font-bold mt-0.5">
                  Solicitud N.º {order.requestCode}
                </p>
              </div>

              {/* Status Badge */}
              <div className="self-start sm:self-center">
                <span className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wide border shadow-2xs ${
                  isCancelled 
                    ? 'bg-rose-600 text-white border-rose-500' 
                    : isReceived 
                    ? 'bg-emerald-500 text-white border-emerald-400' 
                    : isConfirmedByProvider
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-[#0057FF] text-white border-blue-400'
                }`}>
                  {isCancelled ? (
                    <>
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Cancelado</span>
                    </>
                  ) : isReceived ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Recibido</span>
                    </>
                  ) : isConfirmedByProvider ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirmado por Proveedor</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Pendiente de Confirmación</span>
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* METADATA BAR */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-stone-50 border-b border-stone-200 text-xs">
            <div className="flex items-center gap-2.5 text-stone-700">
              <Calendar className="w-4 h-4 text-stone-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Fecha Solicitud</span>
                <span className="font-bold text-stone-800">
                  {formatDate(order.createdAt)} · {formatTime(order.createdAt)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-stone-700">
              <Truck className="w-4 h-4 text-stone-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Proveedor</span>
                <strong className="text-stone-900 font-extrabold">
                  {order.supplierName || 'Sin especificar'}
                </strong>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-stone-700">
              <User className="w-4 h-4 text-stone-400 shrink-0" />
              <div>
                <span className="text-[10px] uppercase font-bold text-stone-400 block">Solicitado por</span>
                <span className="font-bold text-stone-800">{order.requestedBy}</span>
              </div>
            </div>
          </div>

          {/* EDITABLE INSTRUCTIONS & MASS ACTIONS (When in PENDING mode) */}
          {isEditable && (
            <div className="p-4 bg-blue-50/60 border-b border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <HelpCircle className="w-4 h-4 text-[#0057FF] shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950">
                  <strong className="font-bold block">Confirmá las cantidades a entregar:</strong>
                  <span className="text-blue-900/80">
                    Ajustá con los botones (+/-) o ingresá la cantidad que podés entregar de cada ítem.
                  </span>
                </div>
              </div>

              {/* Quick Mass Actions */}
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={handleMarkAllComplete}
                  className="px-2.5 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-[11px] rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3 h-3 text-emerald-600" />
                  <span>Todo Completo</span>
                </button>
                <button
                  type="button"
                  onClick={handleMarkAllOutOfStock}
                  className="px-2.5 py-1.5 bg-white hover:bg-rose-50 border border-rose-200 text-rose-800 font-bold text-[11px] rounded-xl shadow-2xs transition-colors cursor-pointer flex items-center gap-1"
                >
                  <XCircle className="w-3 h-3 text-rose-600" />
                  <span>Todo Sin Stock</span>
                </button>
              </div>
            </div>
          )}

          {/* PRODUCTS LIST */}
          <div className="p-4 sm:p-6 space-y-6">
            
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold text-stone-900 uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4 text-[#0057FF]" />
                <span>Detalle de Productos ({order.totalProductsCount})</span>
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-600 bg-stone-100 px-2.5 py-1 rounded-xl border border-stone-200">
                  Pedido: {order.totalUnitsCount} un.
                </span>
                {isConfirmedByProvider && (
                  <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">
                    Confirmado: {summary.totalConfirmed} un.
                  </span>
                )}
              </div>
            </div>

            {Object.keys(categorizedItems).length === 0 ? (
              <div className="text-center py-8 text-stone-500 text-xs font-bold">
                No hay productos en esta solicitud.
              </div>
            ) : (
              <div className="space-y-5">
                {Object.entries(categorizedItems).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    
                    {/* Category Title Pill */}
                    <div className="bg-stone-100 border border-stone-200/80 px-3 py-1.5 rounded-xl flex items-center justify-between text-xs">
                      <span className="font-black text-stone-800 flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-stone-500" />
                        <span>{category}</span>
                      </span>
                      <span className="text-[11px] font-bold text-stone-500">
                        {items.length} {items.length === 1 ? 'ítem' : 'ítems'}
                      </span>
                    </div>

                    {/* Products in Category */}
                    <div className="grid grid-cols-1 gap-2.5">
                      {items.map((item, idx) => {
                        const reqQty = item.requestedQuantity;
                        const confQty = confirmedQtys[item.productName] ?? reqQty;
                        const isComplete = confQty === reqQty;
                        const isNoStock = confQty === 0;
                        const isPartial = confQty > 0 && confQty < reqQty;
                        const isSurplus = confQty > reqQty;

                        return (
                          <div
                            key={idx}
                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isNoStock
                                ? 'bg-rose-50/60 border-rose-200'
                                : isPartial
                                ? 'bg-amber-50/60 border-amber-200'
                                : isSurplus
                                ? 'bg-blue-50/60 border-blue-200'
                                : 'bg-white border-stone-200 shadow-2xs hover:border-stone-300'
                            }`}
                          >
                            {/* Product Info & Requested Qty */}
                            <div className="flex items-start sm:items-center gap-3">
                              {/* Requested Quantity Badge */}
                              <div className="px-3 py-2 bg-stone-100 border border-stone-200 rounded-xl text-center shrink-0 min-w-[65px]">
                                <span className="block text-xs font-bold text-stone-500 uppercase tracking-wider leading-none">
                                  Pide
                                </span>
                                <span className="block text-base font-black text-stone-900 leading-tight mt-0.5">
                                  {reqQty}
                                </span>
                                <span className="block text-[9px] font-bold uppercase text-stone-500">
                                  {item.unitText || 'un'}
                                </span>
                              </div>

                              {/* Title & Status Pill */}
                              <div>
                                <span className={`text-sm font-extrabold text-stone-900 block leading-tight ${
                                  isNoStock ? 'line-through text-stone-400' : ''
                                }`}>
                                  {item.productName}
                                </span>

                                <div className="mt-1 flex items-center gap-2">
                                  {isNoStock ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-md">
                                      <XCircle className="w-3 h-3" /> Sin stock
                                    </span>
                                  ) : isPartial ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                                      <AlertTriangle className="w-3 h-3" /> Parcial ({confQty} de {reqQty})
                                    </span>
                                  ) : isSurplus ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                                      <Plus className="w-3 h-3" /> Extra ({confQty} de {reqQty})
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                      <Check className="w-3 h-3" /> Completo ({confQty})
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Quantity Controls or Readonly display */}
                            {isEditable ? (
                              <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                {/* Direct Stepper (Touch targets >= 44px) */}
                                <div className="flex items-center bg-white border border-stone-300 rounded-xl overflow-hidden shadow-2xs">
                                  <button
                                    type="button"
                                    onClick={() => handleStepQuantity(item.productName, -1)}
                                    disabled={confQty <= 0}
                                    className="w-10 h-10 flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                                    title="Restar 1 unidad"
                                  >
                                    <Minus className="w-4 h-4" />
                                  </button>

                                  <input
                                    type="number"
                                    min="0"
                                    value={confQty}
                                    onChange={(e) => handleSetQuantity(item.productName, Number(e.target.value))}
                                    onFocus={(e) => e.target.select()}
                                    onClick={(e) => (e.target as HTMLInputElement).select()}
                                    className="w-14 h-10 text-center font-black text-base text-stone-900 border-x border-stone-200 bg-stone-50/50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#0057FF]"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => handleStepQuantity(item.productName, 1)}
                                    className="w-10 h-10 flex items-center justify-center text-stone-600 hover:bg-stone-100 active:bg-stone-200 transition-colors cursor-pointer"
                                    title="Sumar 1 unidad"
                                  >
                                    <Plus className="w-4 h-4" />
                                  </button>
                                </div>

                                {/* Quick Shortcuts */}
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => handleSetQuantity(item.productName, reqQty)}
                                    className={`px-2.5 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                      isComplete
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-100'
                                    }`}
                                    title="Entregar todo lo solicitado"
                                  >
                                    Todo
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleSetQuantity(item.productName, 0)}
                                    className={`px-2 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${
                                      isNoStock
                                        ? 'bg-rose-600 text-white border-rose-600'
                                        : 'bg-white text-rose-700 border-stone-300 hover:bg-rose-50'
                                    }`}
                                    title="Sin stock (0 unidades)"
                                  >
                                    0
                                  </button>
                                </div>
                              </div>
                            ) : (
                              /* Read-only Confirmed Badge */
                              <div className="text-right shrink-0 self-end sm:self-center">
                                <span className="text-[10px] uppercase font-bold text-stone-400 block">
                                  Confirmado
                                </span>
                                <span className="font-black text-stone-900 text-base">
                                  {confQty} <span className="text-xs font-normal text-stone-500">un.</span>
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  </div>
                ))}
              </div>
            )}

            {/* PROVIDER OBSERVATIONS / NOTES INPUT (When Editable) */}
            {isEditable && (
              <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-2">
                <label className="text-xs font-extrabold text-stone-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-[#0057FF]" />
                  <span>Observaciones o Aclaraciones de Entrega (Opcional):</span>
                </label>
                <textarea
                  value={providerNote}
                  onChange={(e) => setProviderNote(e.target.value)}
                  placeholder="Ej: Las facturas se entregan mañana a primera hora. El pan bimbo llegará en el reparto de la tarde..."
                  rows={2}
                  className="w-full text-xs p-3 rounded-xl border border-stone-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#0057FF] resize-none"
                />
              </div>
            )}

            {/* ORDER NOTES FROM STORE */}
            {order.notes && (
              <div className="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-xs">
                  <FileText className="w-4 h-4 text-amber-700" />
                  <span>Indicaciones del Comercio:</span>
                </div>
                <p className="text-xs text-amber-950 whitespace-pre-wrap leading-relaxed">
                  {order.notes}
                </p>
              </div>
            )}

            {/* READONLY PROVIDER NOTES IF ALREADY CONFIRMED */}
            {(order.providerNote || (order.providerResponse?.providerNote)) && !isEditable && (
              <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4 space-y-1">
                <div className="flex items-center gap-1.5 text-emerald-900 font-extrabold text-xs">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>Aclaración del Proveedor:</span>
                </div>
                <p className="text-xs text-emerald-950 whitespace-pre-wrap leading-relaxed">
                  {order.providerNote || order.providerResponse?.providerNote}
                </p>
              </div>
            )}

            {/* RESUMEN BOX */}
            <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-stone-500 font-bold block">Resumen de Solicitud</span>
                  <span className="font-extrabold text-stone-900 text-sm">
                    {order.totalProductsCount} variedades solicitadas
                  </span>
                </div>

                <div className="flex items-center gap-4 text-left sm:text-right">
                  <div>
                    <span className="text-stone-400 font-bold block text-[10px] uppercase">Solicitado</span>
                    <span className="font-black text-stone-800 text-sm">
                      {summary.totalRequested} un.
                    </span>
                  </div>
                  <div>
                    <span className="text-[#0057FF] font-bold block text-[10px] uppercase">A Entregar</span>
                    <span className="font-black text-[#0057FF] text-base">
                      {summary.totalConfirmed} un.
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Chips */}
              <div className="pt-2 border-t border-stone-200 flex flex-wrap items-center gap-2 text-xs">
                <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg text-[11px]">
                  ✅ {summary.complete} completos
                </span>
                {summary.partial > 0 && (
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-bold rounded-lg text-[11px]">
                    ⚠️ {summary.partial} parciales
                  </span>
                )}
                {summary.noStock > 0 && (
                  <span className="px-2.5 py-1 bg-rose-100 text-rose-800 font-bold rounded-lg text-[11px]">
                    ❌ {summary.noStock} sin stock
                  </span>
                )}
                {summary.surplus > 0 && (
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 font-bold rounded-lg text-[11px]">
                    ➕ {summary.surplus} excedente
                  </span>
                )}
              </div>
            </div>

            {/* CONFIRM BUTTON (Primary Call to Action) */}
            {isEditable && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(true)}
                  className="w-full py-4 bg-[#0057FF] hover:bg-[#0047DB] text-white font-black text-base rounded-2xl shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer hover:shadow-lg active:scale-[0.99]"
                >
                  <Send className="w-5 h-5" />
                  <span>Confirmar Pedido ({summary.totalConfirmed} unidades)</span>
                </button>
              </div>
            )}

          </div>

          {/* ACTION BUTTONS (Share, Copy, Print) */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            
            <button
              onClick={handleCopyTextSummary}
              className="py-2.5 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-stone-500" />}
              <span>{copiedText ? '¡Copiado en texto!' : 'Copiar en texto'}</span>
            </button>

            <button
              onClick={handleShareLink}
              className="py-2.5 px-3 bg-[#0057FF] hover:bg-[#0047DB] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              {copiedLink ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
              <span>{copiedLink ? '¡Enlace copiado!' : 'Compartir Pedido'}</span>
            </button>

            <button
              onClick={() => window.print()}
              className="py-2.5 px-3 bg-white hover:bg-stone-100 border border-stone-300 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4 text-stone-500" />
              <span>Imprimir</span>
            </button>

          </div>

        </div>

        {/* FOOTER */}
        <div className="text-center py-2 text-[11px] text-stone-400 font-medium">
          <p>MiniMarket · Sistema de Gestión de Productos</p>
        </div>

      </div>

      {/* CONFIRMATION MODAL (Pre-Submit Review) */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-stone-900">
                  Revisar y Confirmar Entrega
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Pedido #{order.requestCode} · {order.businessName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="w-8 h-8 rounded-full bg-stone-200/80 hover:bg-stone-300 flex items-center justify-center text-stone-600 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body / Summary */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1 text-xs">
              
              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Status Overview Card */}
              <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3.5 flex items-center justify-around text-center">
                <div>
                  <span className="text-stone-500 font-bold block text-[10px] uppercase">Solicitado</span>
                  <span className="font-extrabold text-stone-800 text-base">{summary.totalRequested} un.</span>
                </div>
                <div className="text-stone-300 font-light">→</div>
                <div>
                  <span className="text-[#0057FF] font-bold block text-[10px] uppercase">A Entregar</span>
                  <span className="font-black text-[#0057FF] text-base">{summary.totalConfirmed} un.</span>
                </div>
              </div>

              {/* Breakdown List */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                <span className="font-extrabold text-stone-700 block uppercase text-[10px] tracking-wider">
                  Detalle de productos a confirmar:
                </span>

                {order.items.map((it, i) => {
                  const req = it.requestedQuantity;
                  const conf = confirmedQtys[it.productName] ?? req;
                  const isComp = conf === req;
                  const isZero = conf === 0;

                  return (
                    <div
                      key={i}
                      className="p-2.5 rounded-xl border border-stone-200 bg-stone-50 flex items-center justify-between gap-2"
                    >
                      <div className="truncate">
                        <span className={`font-bold block text-stone-800 truncate ${isZero ? 'line-through text-stone-400' : ''}`}>
                          {it.productName}
                        </span>
                        <span className="text-[10px] text-stone-500">
                          Solicitó: {req} un.
                        </span>
                      </div>

                      <div className="shrink-0">
                        {isZero ? (
                          <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-black rounded-md text-[11px]">
                            0 un. (Sin stock)
                          </span>
                        ) : isComp ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black rounded-md text-[11px]">
                            {conf} un. (Completo)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-100 text-amber-900 font-black rounded-md text-[11px]">
                            {conf} un. (Parcial)
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Provider note preview if entered */}
              {providerNote.trim().length > 0 && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-3">
                  <span className="text-[10px] uppercase font-bold text-stone-400 block">
                    Observación adjunta:
                  </span>
                  <p className="text-stone-700 italic mt-0.5">{providerNote}</p>
                </div>
              )}

              <div className="text-[11px] text-stone-500 leading-relaxed">
                ℹ️ Al presionar Confirmar, se enviará tu compromiso de entrega a {order.businessName}.
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stone-200 bg-stone-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                disabled={isSubmitting}
                className="py-2.5 px-4 bg-white hover:bg-stone-100 border border-stone-300 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Volver a revisar
              </button>

              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isSubmitting}
                className="py-2.5 px-5 bg-[#0057FF] hover:bg-[#0047DB] text-white font-black text-xs rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span>Confirmar Entrega</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
