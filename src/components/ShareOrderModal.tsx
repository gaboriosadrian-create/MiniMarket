import React, { useState, useEffect } from 'react';
import {
  Globe,
  FileText,
  Share2,
  Download,
  ExternalLink,
  Copy,
  Check,
  X,
  Loader2,
  Truck,
  RotateCw,
  MessageCircle,
  ClipboardCheck,
  ShoppingBag,
  Calendar,
  CheckCircle2,
  Clock,
  Ban,
  ArrowLeft
} from 'lucide-react';
import { ReplenishmentList, PublicOrder } from '../types';
import { formatRequestCode, shareReplenishmentPDF, downloadReplenishmentPDF } from '../lib/replenishmentPdf';
import { createOrGetPublicOrder, sharePublicOrderLink, getPublicOrderUrl } from '../lib/publicOrderService';
import { markReplenishmentSentToProvider } from '../lib/replenishmentService';
import { logAdminAction } from '../lib/auditService';
import { useMobileBackHandler } from '../lib/navigationContext';
import { PublicOrderView } from './PublicOrderView';

interface ShareOrderModalProps {
  order: ReplenishmentList;
  businessName: string;
  userId?: string;
  userName?: string;
  isOpen: boolean;
  onClose: () => void;
  onShowNotify?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export function generatePlainTextOrder(order: ReplenishmentList, businessName: string): string {
  const reqCode = formatRequestCode(order.id);
  const rawDate = order.exportedAt || order.createdAt || new Date().toISOString();
  const dateStr = new Date(rawDate).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const totalUnits = (order.items || []).reduce((sum, item) => sum + (item.requestedQuantity || 0), 0);

  const lines = [
    'SOLICITUD DE PRODUCTOS',
    '',
    businessName || 'uwi',
    `Solicitud #${reqCode}`,
    dateStr,
    '',
    `Proveedor: ${order.supplierName || 'Proveedor sin especificar'}`,
    '',
    'PRODUCTOS',
    ''
  ];

  (order.items || []).forEach(item => {
    lines.push(`• ${item.productName} × ${item.requestedQuantity}`);
  });

  lines.push('');
  lines.push(`Total de unidades: ${totalUnits}`);

  return lines.join('\n');
}

export const ShareOrderModal: React.FC<ShareOrderModalProps> = ({
  order,
  businessName,
  userId,
  userName,
  isOpen,
  onClose,
  onShowNotify
}) => {
  const [loadingToken, setLoadingToken] = useState<boolean>(false);
  const [publicOrder, setPublicOrder] = useState<PublicOrder | null>(null);
  const [publicUrl, setPublicUrl] = useState<string>('');
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedText, setCopiedText] = useState<boolean>(false);
  const [sharingOnline, setSharingOnline] = useState<boolean>(false);
  const [sharingPdf, setSharingPdf] = useState<boolean>(false);
  const [resending, setResending] = useState<boolean>(false);

  const [manualCopyModalUrl, setManualCopyModalUrl] = useState<string | null>(null);
  const [manualCopyTextModal, setManualCopyTextModal] = useState<string | null>(null);
  const [showInternalPreview, setShowInternalPreview] = useState<boolean>(false);

  // Mobile Back Handlers for LIFO stack
  useMobileBackHandler(showInternalPreview, () => {
    setShowInternalPreview(false);
  });

  useMobileBackHandler(isOpen && !showInternalPreview && !manualCopyModalUrl && !manualCopyTextModal, () => {
    onClose();
  });

  useMobileBackHandler(!!manualCopyModalUrl, () => {
    setManualCopyModalUrl(null);
  });

  useMobileBackHandler(!!manualCopyTextModal, () => {
    setManualCopyTextModal(null);
  });

  const reqCode = formatRequestCode(order?.id || '');

  const totalUnits = (order?.items || []).reduce((sum, item) => sum + (item.approvedQuantity !== undefined ? item.approvedQuantity : (item.requestedQuantity || 0)), 0);

  const orderDate = new Date(order?.exportedAt || order?.createdAt || Date.now()).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const isApproved = order?.status === 'APPROVED';
  const isConfirmed = !isApproved && (!!order?.providerResponse || order?.publicOrderStatus === 'CONFIRMED_BY_PROVIDER');
  const isReceived = order?.status === 'RECEIVED';
  const isCancelled = order?.status === 'CANCELLED';

  // Initialize or get the public order token
  useEffect(() => {
    if (!isOpen || !order) return;

    let isMounted = true;
    async function initPublicOrder() {
      setLoadingToken(true);
      try {
        const res = await createOrGetPublicOrder(order, businessName, userId, userName);
        if (isMounted) {
          setPublicOrder(res.order);
          setPublicUrl(res.url);
        }
      } catch (err) {
        console.error('Error generating public order:', err);
      } finally {
        if (isMounted) {
          setLoadingToken(false);
        }
      }
    }

    initPublicOrder();
    return () => {
      isMounted = false;
    };
  }, [isOpen, order?.id, businessName]);

  if (!isOpen || !order) return null;

  const handleShareOnline = async () => {
    let orderToShare = publicOrder;
    let urlToShare = publicUrl;

    setSharingOnline(true);
    try {
      if (!orderToShare) {
        const res = await createOrGetPublicOrder(order, businessName, userId, userName);
        orderToShare = res.order;
        urlToShare = res.url;
        setPublicOrder(res.order);
        setPublicUrl(res.url);
      }

      if (!orderToShare) {
        onShowNotify?.('No pudimos generar el enlace del pedido.', 'error');
        return;
      }

      const res = await sharePublicOrderLink(orderToShare);

      // Trigger workflow transition to EXPORTED & notify admin
      if (order.status === 'APPROVED' || order.status === 'DRAFT') {
        markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'ONLINE_LINK').catch(() => {});
      }

      if (res.status === 'shared') {
        // Native share sheet successfully opened
      } else if (res.status === 'copied') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
        onShowNotify?.('✓ Enlace copiado', 'success');
      } else if (res.status === 'cancelled') {
        // user cancelled
      } else if (res.status === 'manual_copy') {
        setManualCopyModalUrl(res.url || urlToShare || getPublicOrderUrl(reqCode));
      }
    } catch (err: any) {
      if (
        err?.name === 'AbortError' ||
        err?.message?.toLowerCase().includes('abort') ||
        err?.message?.toLowerCase().includes('cancel') ||
        err?.message?.toLowerCase().includes('dismiss')
      ) {
        return;
      }
      console.error('Error sharing online order:', err);
      const fallbackUrl = urlToShare || publicUrl || getPublicOrderUrl(reqCode);
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(fallbackUrl);
          if (order.status === 'APPROVED' || order.status === 'DRAFT') {
            markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'COPY_LINK').catch(() => {});
          }
          setCopiedLink(true);
          setTimeout(() => setCopiedLink(false), 2500);
          onShowNotify?.('✓ Enlace copiado', 'success');
          return;
        }
      } catch {
        setManualCopyModalUrl(fallbackUrl);
        return;
      }
      onShowNotify?.('No pudimos generar el enlace del pedido.', 'error');
    } finally {
      setSharingOnline(false);
    }
  };

  const handleCopyLink = async () => {
    const url = publicUrl || (publicOrder?.token ? getPublicOrderUrl(publicOrder.token) : getPublicOrderUrl(reqCode));
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(url);
        if (order.status === 'APPROVED' || order.status === 'DRAFT') {
          markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'COPY_LINK').catch(() => {});
        }
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
        onShowNotify?.('✓ Enlace copiado', 'success');
      } else {
        setManualCopyModalUrl(url);
      }
    } catch {
      setManualCopyModalUrl(url);
    }
  };

  const handleCopyPlainText = async () => {
    const plainText = generatePlainTextOrder(order, businessName);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(plainText);
        if (order.status === 'APPROVED' || order.status === 'DRAFT') {
          markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'PLAIN_TEXT').catch(() => {});
        }
        setCopiedText(true);
        setTimeout(() => setCopiedText(false), 2500);
        onShowNotify?.('✓ Texto copiado', 'success');
      } else {
        setManualCopyTextModal(plainText);
      }
    } catch {
      setManualCopyTextModal(plainText);
    }
  };

  const handleShareWhatsApp = () => {
    const plainText = generatePlainTextOrder(order, businessName);
    const linkUrl = publicUrl || (publicOrder?.token ? getPublicOrderUrl(publicOrder.token) : '');
    const messageWithLink = linkUrl ? `${plainText}\n\nVer pedido online interactivo:\n${linkUrl}` : plainText;
    const encoded = encodeURIComponent(messageWithLink);
    if (order.status === 'APPROVED' || order.status === 'DRAFT') {
      markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'WHATSAPP').catch(() => {});
    }
    window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer');
  };

  const handleResendOrder = async () => {
    setResending(true);
    try {
      // 1. Log audit trail: Reenviar no crea una nueva solicitud, solo registra el evento
      await logAdminAction({
        businessId: order.businessId,
        adminId: userId || 'unknown',
        adminEmail: userName || 'Usuario',
        targetUserId: order.createdBy || 'unknown',
        action: 'SOLICITUD_REENVIADA',
        details: `Solicitud #${reqCode} (${order.supplierName || 'Sin proveedor'}) reenviada por ${userName || 'Usuario'}`
      });

      markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'RESEND').catch(() => {});

      // 2. Open WhatsApp directly or copy text
      handleShareWhatsApp();
      onShowNotify?.('✓ Solicitud reenviada con éxito.', 'success');
    } catch (err) {
      console.error('Error logging resend action:', err);
      handleShareWhatsApp();
    } finally {
      setResending(false);
    }
  };

  const handleOpenPreview = () => {
    setShowInternalPreview(true);
  };

  const handleSharePdf = async () => {
    setSharingPdf(true);
    try {
      const res = await shareReplenishmentPDF(order, businessName);
      if (order.status === 'APPROVED' || order.status === 'DRAFT') {
        markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'PDF').catch(() => {});
      }
      if (res.status === 'shared') {
        onShowNotify?.('PDF compartido con éxito.', 'success');
      } else if (res.status === 'downloaded') {
        onShowNotify?.(res.message || 'El PDF fue descargado.', 'info');
      }
    } catch (err) {
      console.error('Error sharing PDF:', err);
      onShowNotify?.('Ocurrió un error al compartir el PDF.', 'error');
    } finally {
      setSharingPdf(false);
    }
  };

  const handleDownloadPdf = () => {
    try {
      const fileName = downloadReplenishmentPDF(order, businessName);
      if (order.status === 'APPROVED' || order.status === 'DRAFT') {
        markReplenishmentSentToProvider(order.id, order.businessId, userId || '', userName || '', 'PDF').catch(() => {});
      }
      onShowNotify?.(`PDF descargado (${fileName})`, 'success');
    } catch (err) {
      console.error('Error downloading PDF:', err);
      onShowNotify?.('Ocurrió un error al descargar el PDF.', 'error');
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in">
        <div className="bg-white rounded-3xl max-w-lg w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-stone-200 max-h-[90vh] overflow-y-auto">
          
          {/* Header */}
          <div className="flex items-start justify-between border-b border-stone-100 pb-3">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 bg-blue-50 text-[#0057FF] text-xs font-mono font-black px-2.5 py-0.5 rounded-md border border-blue-200">
                  Solicitud #{reqCode}
                </span>

                {isCancelled ? (
                  <span className="text-[10px] font-extrabold bg-stone-100 text-stone-700 px-2 py-0.5 rounded-full uppercase border border-stone-200 flex items-center gap-1">
                    <Ban className="w-3 h-3 text-stone-500" />
                    <span>CANCELADO</span>
                  </span>
                ) : isReceived ? (
                  <span className="text-[10px] font-extrabold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full uppercase border border-blue-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-blue-600" />
                    <span>RECIBIDO</span>
                  </span>
                ) : isApproved ? (
                  <span className="text-[10px] font-extrabold bg-purple-100 text-purple-900 px-2.5 py-0.5 rounded-full uppercase border border-purple-200 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-purple-600" />
                    <span>APROBADO</span>
                  </span>
                ) : isConfirmed ? (
                  <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase flex items-center gap-1 border border-emerald-200">
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>CONFIRMADO POR PROVEEDOR</span>
                  </span>
                ) : (
                  <span className="text-[10px] font-extrabold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase border border-amber-200">
                    SOLICITADO
                  </span>
                )}
              </div>

              <h3 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                {order.supplierName || 'Proveedor sin especificar'}
              </h3>
              <p className="text-xs text-stone-500 flex items-center gap-1.5 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                <span>Fecha: {orderDate}</span>
              </p>
            </div>

            <button
              onClick={onClose}
              id="btn-close-share-modal"
              className="p-1.5 text-stone-400 hover:text-stone-700 rounded-xl hover:bg-stone-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* SECTION: DETALLE DE PRODUCTOS */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-stone-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-stone-800">
                  Detalle de Productos ({order.items?.length || 0})
                </h4>
              </div>
              <span className="text-xs font-black text-stone-900 bg-stone-200 px-2.5 py-0.5 rounded-md font-mono">
                Total: {totalUnits} un
              </span>
            </div>

            <div className="divide-y divide-stone-100 bg-white border border-stone-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto">
              {(order.items || []).map((item) => {
                const qty = item.approvedQuantity !== undefined ? item.approvedQuantity : item.requestedQuantity;
                return (
                  <div key={item.productId} className="p-2.5 flex items-center justify-between text-xs">
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-stone-900 truncate">{item.productName}</p>
                      {item.category && <p className="text-[10px] text-stone-500">{item.category}</p>}
                    </div>
                    <span className="font-black text-[#0057FF] bg-blue-50 px-2 py-0.5 rounded-md font-mono text-xs shrink-0">
                      × {qty}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SECTION 1: WHATSAPP Y COPIAR EN TEXTO */}
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 text-white rounded-xl">
                  <MessageCircle className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-black text-emerald-950">
                  Compartir Pedido
                </h4>
              </div>
              <span className="text-[10px] font-extrabold bg-emerald-200 text-emerald-900 px-2 py-0.5 rounded-full">
                WhatsApp Directo
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                id="btn-share-whatsapp"
                onClick={handleShareWhatsApp}
                className="w-full py-3 px-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-2 cursor-pointer transition-colors min-h-[44px]"
              >
                <MessageCircle className="w-4 h-4" />
                <span>[ WhatsApp ]</span>
              </button>

              <button
                type="button"
                id="btn-copiar-en-texto"
                onClick={handleCopyPlainText}
                className="w-full py-3 px-3.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-900 font-extrabold text-xs rounded-xl shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors min-h-[44px]"
              >
                {copiedText ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>✓ Texto copiado</span>
                  </>
                ) : (
                  <>
                    <ClipboardCheck className="w-4 h-4 text-emerald-700" />
                    <span>[ Copiar en texto ]</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* SECTION 2: REENVIAR SOLICITUD (Reutiliza solicitudId, no crea nueva) */}
          <div className="p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="space-y-0.5 min-w-0">
              <div className="flex items-center gap-1.5">
                <RotateCw className="w-4 h-4 text-indigo-700 shrink-0" />
                <h4 className="text-xs font-black text-indigo-950 truncate">Reenviar solicitud</h4>
              </div>
              <p className="text-[11px] text-indigo-800/80 leading-tight">
                Vuelve a enviar esta solicitud #{reqCode} al proveedor sin crear duplicados.
              </p>
            </div>

            <button
              onClick={handleResendOrder}
              disabled={resending}
              id="btn-reenviar-solicitud"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 transition-all min-h-[44px]"
            >
              {resending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Reenviando...</span>
                </>
              ) : (
                <>
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Reenviar</span>
                </>
              )}
            </button>
          </div>

          {/* SECTION 3: PEDIDO ONLINE INTERACTIVO */}
          <div className="p-4 bg-gradient-to-b from-blue-50/60 to-blue-50/20 border-2 border-blue-200 rounded-2xl space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 bg-[#0057FF] text-white rounded-xl shadow-xs shrink-0 mt-0.5">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-black text-stone-900">Enlace Interactivo Online</h4>
                <p className="text-xs text-stone-600 mt-0.5 leading-snug">
                  Permite al proveedor confirmar cantidades desde su celular sin iniciar sesión.
                </p>
              </div>
            </div>

            {/* Main Action: Compartir Pedido Online */}
            <button
              onClick={handleShareOnline}
              disabled={loadingToken || sharingOnline}
              className="w-full py-3 bg-[#0057FF] hover:bg-[#0047DB] active:scale-[0.99] text-white font-black text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-75 min-h-[44px]"
            >
              {loadingToken || sharingOnline ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>📤 Preparando enlace...</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  <span>📤 Compartir enlace online</span>
                </>
              )}
            </button>

            {/* Visible Short Link */}
            <div className="bg-white/90 border border-blue-200/80 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-2xs">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-900/60">Enlace del pedido</p>
                <p className="text-xs font-mono font-bold text-stone-800 truncate select-all">
                  {publicUrl || getPublicOrderUrl(reqCode)}
                </p>
              </div>
              <button
                onClick={handleCopyLink}
                disabled={loadingToken}
                title="Copiar enlace"
                className="p-2 bg-blue-50 hover:bg-blue-100 text-[#0057FF] rounded-lg transition-colors cursor-pointer shrink-0 flex items-center gap-1 text-xs font-bold"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                <span className="hidden sm:inline">{copiedLink ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>

            {/* Secondary Actions: Ver Pedido & Copiar Enlace */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                onClick={handleOpenPreview}
                disabled={loadingToken}
                className="py-2.5 px-3 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs min-h-[40px]"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-500" />
                <span>Ver Pedido</span>
              </button>

              <button
                onClick={handleCopyLink}
                disabled={loadingToken}
                className="py-2.5 px-3 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs min-h-[40px]"
              >
                {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-stone-500" />}
                <span>{copiedLink ? '¡Enlace copiado!' : 'Copiar Enlace'}</span>
              </button>
            </div>
          </div>

          {/* SECTION 4: DOCUMENTO PDF */}
          <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-2xl space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-stone-200 text-stone-700 rounded-xl">
                  <FileText className="w-4 h-4" />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-stone-800">Documento PDF</h4>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSharePdf}
                disabled={sharingPdf}
                className="py-2.5 px-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
              >
                {sharingPdf ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>Compartir PDF</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                className="py-2.5 px-3 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer min-h-[40px]"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Descargar PDF</span>
              </button>
            </div>
          </div>

          {/* Footer info */}
          <div className="text-center pt-1">
            <button
              onClick={onClose}
              id="btn-footer-close-share-modal"
              className="text-xs font-bold text-stone-500 hover:text-stone-800 px-4 py-2 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>

      {/* Manual Copy Text Dialog Fallback */}
      {manualCopyTextModal && (
        <div className="fixed inset-0 z-60 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-stone-200">
            <div className="flex items-center justify-between border-b border-stone-100 pb-2">
              <h4 className="text-sm font-black text-stone-900">Texto de la Solicitud</h4>
              <button onClick={() => setManualCopyTextModal(null)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <textarea
              readOnly
              rows={10}
              value={manualCopyTextModal}
              onFocus={(e) => e.target.select()}
              className="w-full p-3 bg-stone-50 border border-stone-300 rounded-xl text-xs font-mono font-medium outline-none select-all resize-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setManualCopyTextModal(null)}
                className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
              >
                Cerrar
              </button>

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(manualCopyTextModal);
                    setCopiedText(true);
                    setTimeout(() => setCopiedText(false), 2500);
                    onShowNotify?.('✓ Texto copiado', 'success');
                  } catch {
                    // Fallback select
                  }
                  setManualCopyTextModal(null);
                }}
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Todo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Copy Dialog Fallback */}
      {manualCopyModalUrl && (
        <div className="fixed inset-0 z-60 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 border border-stone-200 text-center">
            <div className="w-10 h-10 bg-blue-100 text-[#0057FF] rounded-2xl flex items-center justify-center mx-auto">
              <Copy className="w-5 h-5" />
            </div>

            <div>
              <h4 className="text-sm font-black text-stone-900 uppercase tracking-wide">
                Enlace del Pedido
              </h4>
              <p className="text-xs text-stone-500 mt-1">
                Seleccioná y copiá el enlace para enviárselo a tu proveedor:
              </p>
            </div>

            <div className="space-y-2 text-left">
              <input
                type="text"
                readOnly
                autoFocus
                value={manualCopyModalUrl}
                onFocus={(e) => e.target.select()}
                className="w-full px-3 py-2.5 bg-stone-50 border-2 border-blue-300 rounded-xl text-xs font-mono font-bold text-stone-900 outline-none select-all text-center"
              />

              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(manualCopyModalUrl);
                    setCopiedLink(true);
                    setTimeout(() => setCopiedLink(false), 2500);
                    onShowNotify?.('✓ Enlace copiado', 'success');
                  } catch {
                    // Fallback select
                  }
                  setManualCopyModalUrl(null);
                }}
                className="w-full py-2.5 bg-[#0057FF] hover:bg-[#0047DB] text-white font-extrabold text-xs rounded-xl shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>[ COPIAR ]</span>
              </button>
            </div>

            <div className="pt-1 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setManualCopyModalUrl(null)}
                className="text-xs font-bold text-stone-500 hover:text-stone-800 cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Internal Order View Overlay */}
      {showInternalPreview && (
        <div className="fixed inset-0 z-[70] bg-stone-100 flex flex-col overflow-hidden animate-in fade-in duration-200">
          {/* Header with clear Volver button */}
          <header className="sticky top-0 z-30 bg-stone-900 text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow-md border-b border-stone-800 shrink-0">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setShowInternalPreview(false)}
                id="btn-back-from-order-preview"
                aria-label="Volver al detalle de recepción"
                className="min-h-[44px] min-w-[44px] px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-white flex items-center gap-2 text-xs font-bold cursor-pointer transition-all active:scale-95 border border-stone-700 shrink-0 shadow-xs"
              >
                <ArrowLeft className="w-4 h-4 text-white shrink-0" />
                <span>Volver</span>
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs sm:text-sm font-black text-white truncate">
                    Pedido #{reqCode}
                  </span>
                  <span className="text-[10px] font-bold bg-blue-900/70 text-blue-200 border border-blue-600/50 px-2 py-0.5 rounded-md hidden xs:inline">
                    Enlace interactivo
                  </span>
                </div>
                <p className="text-[11px] text-stone-400 truncate">
                  {order.supplierName || 'Solicitud de reposición'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const url = publicUrl || (publicOrder?.token ? getPublicOrderUrl(publicOrder.token) : getPublicOrderUrl(reqCode));
                  window.open(url, '_blank', 'noopener,noreferrer');
                }}
                title="Abrir en pestaña externa del navegador"
                aria-label="Abrir en pestaña externa"
                className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 active:bg-stone-600 text-stone-300 hover:text-white flex items-center gap-1.5 text-xs font-bold border border-stone-700 transition-colors cursor-pointer"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-300" />
                <span className="hidden md:inline">Navegador externo</span>
              </button>
            </div>
          </header>

          {/* Public Order Content View */}
          <div className="flex-1 overflow-y-auto">
            <PublicOrderView
              token={publicOrder?.token || reqCode}
              onExit={() => setShowInternalPreview(false)}
            />
          </div>
        </div>
      )}
    </>
  );
};

