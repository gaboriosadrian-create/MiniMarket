import React, { useState, useEffect, useMemo } from 'react';
import { ReplenishmentList, ReplenishmentItem, Product } from '../types';
import { approveReplenishmentOrder, rejectReplenishmentOrder } from '../lib/replenishmentService';
import { formatRequestCode } from '../lib/replenishmentPdf';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  User, 
  Clock, 
  Truck, 
  FileText, 
  DollarSign, 
  Edit3, 
  ArrowRight, 
  X, 
  ShieldCheck,
  Building2,
  RefreshCw
} from 'lucide-react';

interface ReplenishmentApprovalModalProps {
  order: ReplenishmentList | null;
  isOpen: boolean;
  isAdmin: boolean;
  products: Product[];
  currentUserId?: string;
  currentUserName?: string;
  businessId?: string;
  businessName?: string;
  onClose: () => void;
  onApproved: (updatedOrder: ReplenishmentList) => void;
  onRejected: (updatedOrder: ReplenishmentList) => void;
  onShowNotify: (message: string, type?: 'success' | 'error' | 'warning' | 'info') => void;
}

export const ReplenishmentApprovalModal: React.FC<ReplenishmentApprovalModalProps> = ({
  order,
  isOpen,
  isAdmin,
  products,
  currentUserId,
  currentUserName,
  businessId,
  businessName,
  onClose,
  onApproved,
  onRejected,
  onShowNotify
}) => {
  if (!isOpen || !order) return null;

  // Editable items for quantity adjustment
  const [items, setItems] = useState<ReplenishmentItem[]>([]);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reject sub-modal
  const [showRejectPrompt, setShowRejectPrompt] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [isApprovedSuccess, setIsApprovedSuccess] = useState<boolean>(order.status === 'APPROVED');

  const isAlreadyApproved = order.status === 'APPROVED' || isApprovedSuccess;

  // Map products for fast cost price lookup (Admin only)
  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach(p => map.set(p.id, p));
    return map;
  }, [products]);

  // Initialize items when order changes
  useEffect(() => {
    if (order.items) {
      setItems(order.items.map(item => ({
        ...item,
        approvedQuantity: item.approvedQuantity !== undefined ? item.approvedQuantity : item.requestedQuantity
      })));
    } else {
      setItems([]);
    }
    setApprovalNotes(order.approvalNotes || '');
    setShowRejectPrompt(false);
    setRejectReason('');
    setRejectError('');
  }, [order]);

  // Compute metrics
  const totalRequestedUnits = useMemo(() => {
    return items.reduce((sum, i) => sum + (Number(i.requestedQuantity) || 0), 0);
  }, [items]);

  const totalApprovedUnits = useMemo(() => {
    return items.reduce((sum, i) => sum + (Number(i.approvedQuantity !== undefined ? i.approvedQuantity : i.requestedQuantity) || 0), 0);
  }, [items]);

  // Admin-only: compute estimated cost
  const estimatedTotalCost = useMemo(() => {
    if (!isAdmin) return 0;
    return items.reduce((sum, item) => {
      const prod = productMap.get(item.productId);
      const cost = prod?.costPrice || item.costPrice || 0;
      const qty = item.approvedQuantity !== undefined ? item.approvedQuantity : item.requestedQuantity;
      return sum + (cost * qty);
    }, 0);
  }, [items, isAdmin, productMap]);

  const hasModifications = useMemo(() => {
    return items.some(item => (item.approvedQuantity !== undefined && item.approvedQuantity !== item.requestedQuantity));
  }, [items]);

  // Handle quantity change
  const handleSetApprovedQuantity = (productId: string, newQty: number) => {
    const sanitized = Math.max(0, Math.floor(newQty || 0));
    setItems(prev => prev.map(item => {
      if (item.productId === productId) {
        return {
          ...item,
          approvedQuantity: sanitized,
          approvalStatus: sanitized !== item.requestedQuantity ? 'MODIFIED' : 'APPROVED'
        };
      }
      return item;
    }));
  };

  // Handle Approve
  const handleApproveOrder = async () => {
    if (!businessId || !currentUserId) {
      onShowNotify('No se pudo identificar la sesión de administrador.', 'error');
      return;
    }

    if (totalApprovedUnits === 0) {
      onShowNotify('No puedes aprobar una solicitud con 0 unidades. Si deseas cancelarla, utiliza Rechazar.', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      const approvedOrder = await approveReplenishmentOrder(
        order.id,
        businessId,
        currentUserId,
        currentUserName || 'Administrador',
        items,
        approvalNotes
      );

      onShowNotify(
        `Solicitud #${formatRequestCode(order.id)} aprobada con éxito${hasModifications ? ' (con ajustes de cantidad)' : ''}.`,
        'success'
      );
      onApproved(approvedOrder);
      onClose();
    } catch (err: any) {
      console.error('Error al aprobar solicitud:', err);
      onShowNotify(err?.message || 'Error al procesar la aprobación.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!businessId || !currentUserId) return;
    const cleanReason = rejectReason.trim();
    if (!cleanReason) {
      setRejectError('Debes ingresar un motivo para el rechazo.');
      return;
    }

    setIsSubmitting(true);
    try {
      const rejectedOrder = await rejectReplenishmentOrder(
        order.id,
        businessId,
        currentUserId,
        currentUserName || 'Administrador',
        cleanReason
      );

      onShowNotify(`Solicitud #${formatRequestCode(order.id)} rechazada.`, 'info');
      onRejected(rejectedOrder);
      setShowRejectPrompt(false);
      onClose();
    } catch (err: any) {
      console.error('Error al rechazar solicitud:', err);
      onShowNotify(err?.message || 'Error al procesar el rechazo.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const reqCode = formatRequestCode(order.id);
  const orderDate = new Date(order.createdAt || Date.now()).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-stone-200 space-y-4 my-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between border-b border-stone-100 pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono font-black bg-purple-100 text-purple-950 px-2.5 py-0.5 rounded-lg border border-purple-200">
                {reqCode}
              </span>
              <span className="text-[10px] font-extrabold bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full uppercase border border-amber-200">
                Pendiente de Aprobación
              </span>
            </div>
            <h3 className="font-extrabold text-stone-900 text-base sm:text-lg flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-purple-600" />
              Revisión de Solicitud de Reposición
            </h3>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            title="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-stone-50 p-3.5 rounded-2xl border border-stone-200">
          <div className="space-y-1">
            <span className="text-stone-500 flex items-center gap-1 font-semibold">
              <User className="w-3.5 h-3.5 text-stone-400" /> Solicitado por:
            </span>
            <p className="font-bold text-stone-900">{order.submitterName || order.creatorName || 'Vendedor'}</p>
            <p className="text-[11px] text-stone-500 font-mono flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-400" /> {orderDate}
            </p>
          </div>

          <div className="space-y-1">
            <span className="text-stone-500 flex items-center gap-1 font-semibold">
              <Truck className="w-3.5 h-3.5 text-stone-400" /> Proveedor destino:
            </span>
            <p className="font-bold text-stone-900">{order.supplierName || 'Sin especificar'}</p>
            {order.notes && (
              <p className="text-[11px] text-stone-600 italic bg-white p-1.5 rounded-lg border border-stone-200 mt-1">
                "{order.notes}"
              </p>
            )}
          </div>
        </div>

        {/* Cost Summary Box (Admin Only) */}
        {isAdmin && (
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-3.5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Costo Estimado del Pedido (Admin)
                </span>
                <span className="text-xs text-emerald-800">
                  Calculado en base al precio de costo unitario actual de cada producto
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-base sm:text-lg font-black text-emerald-950 font-mono">
                ${estimatedTotalCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Items Review Table */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-extrabold text-stone-700 uppercase tracking-wider">
            <span>Productos ({items.length} variedades)</span>
            <span>
              Total: {totalApprovedUnits} un {hasModifications && <span className="text-amber-600 font-bold">(Modificado)</span>}
            </span>
          </div>

          <div className="divide-y divide-stone-100 border border-stone-200 rounded-2xl overflow-hidden max-h-60 overflow-y-auto bg-stone-50/50">
            {items.map((item) => {
              const prod = productMap.get(item.productId);
              const costPrice = isAdmin ? (prod?.costPrice || item.costPrice || 0) : null;
              const approvedQty = item.approvedQuantity !== undefined ? item.approvedQuantity : item.requestedQuantity;
              const isQtyModified = approvedQty !== item.requestedQuantity;
              const lineCost = costPrice !== null ? costPrice * approvedQty : null;

              return (
                <div key={item.productId} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs hover:bg-stone-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-stone-900">{item.productName}</p>
                      {isQtyModified && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded border border-amber-200">
                          Ajustado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-stone-500 font-mono mt-0.5 flex-wrap">
                      <span>Stock actual: {item.currentStock} un</span>
                      <span>· Solicitó: <strong className="text-stone-700">{item.requestedQuantity} un</strong></span>
                      {isAdmin && costPrice !== null && (
                        <span>· Costo unit: <strong>${costPrice.toFixed(2)}</strong></span>
                      )}
                      {isAdmin && lineCost !== null && (
                        <span className="text-emerald-700 font-bold">· Subtotal: ${lineCost.toFixed(2)}</span>
                      )}
                    </div>
                  </div>

                  {/* Quantity adjustment controls (Admin can tweak) */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {isAdmin ? (
                      <div className="flex items-center border border-stone-300 rounded-xl overflow-hidden bg-white shadow-2xs">
                        <button
                          type="button"
                          onClick={() => handleSetApprovedQuantity(item.productId, approvedQty - 1)}
                          className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                          title="Restar una unidad"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          min="0"
                          value={approvedQty}
                          onChange={(e) => handleSetApprovedQuantity(item.productId, parseInt(e.target.value) || 0)}
                          onFocus={(e) => e.target.select()}
                          onClick={(e) => (e.target as HTMLInputElement).select()}
                          className={`w-14 text-center font-black text-xs font-mono py-1 border-x focus:outline-none ${
                            isQtyModified ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-purple-700 bg-stone-50 border-stone-200'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => handleSetApprovedQuantity(item.productId, approvedQty + 1)}
                          className="w-8 h-8 flex items-center justify-center text-stone-700 hover:bg-stone-100 font-bold cursor-pointer"
                          title="Sumar una unidad"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <span className="font-mono font-bold text-xs bg-purple-100 text-purple-950 px-2.5 py-1 rounded-lg">
                        {item.requestedQuantity} un
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Approval Notes */}
        {isAdmin && (
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
              Notas o Indicaciones de Aprobación (Opcional)
            </label>
            <input
              type="text"
              value={approvalNotes}
              onChange={(e) => setApprovalNotes(e.target.value)}
              placeholder="Ej: Se ajustó la cantidad de yerba por capacidad de depósito..."
              className="w-full px-3.5 py-2 border border-stone-300 rounded-xl text-xs focus:ring-2 focus:ring-purple-500 outline-none bg-white font-medium"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 border-t border-stone-100 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setShowRejectPrompt(true)}
                disabled={isSubmitting}
                className="w-full sm:w-auto px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs rounded-xl border border-rose-200 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                <XCircle className="w-4 h-4" />
                <span>Rechazar Solicitud</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl transition-colors cursor-pointer"
            >
              Cerrar
            </button>

            {isAdmin ? (
              <button
                type="button"
                onClick={handleApproveOrder}
                disabled={isSubmitting || isAlreadyApproved || totalApprovedUnits === 0}
                className={`w-full sm:w-auto px-6 py-2.5 font-extrabold text-xs sm:text-sm rounded-xl shadow-xs flex items-center justify-center gap-2 transition-colors ${
                  isAlreadyApproved
                    ? 'bg-emerald-600 text-white cursor-not-allowed opacity-95'
                    : 'bg-purple-600 hover:bg-purple-700 text-white cursor-pointer'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Aprobando...</span>
                  </>
                ) : isAlreadyApproved ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>✓ Aprobado</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>[ APROBAR SOLICITUD ]</span>
                  </>
                )}
              </button>
            ) : null}
          </div>
        </div>

        {/* REJECT CONFIRMATION SUB-MODAL */}
        {showRejectPrompt && (
          <div className="fixed inset-0 z-60 bg-stone-900/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-3.5 border border-stone-200">
              <div className="flex items-center gap-2 text-rose-600 font-extrabold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Rechazar Solicitud #{reqCode}</span>
              </div>

              <p className="text-xs text-stone-600 leading-relaxed">
                Ingresa el motivo del rechazo para que el vendedor comprenda por qué no fue aprobada.
              </p>

              {rejectError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl">
                  {rejectError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Motivo de rechazo <span className="text-rose-600 font-black">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => {
                    setRejectReason(e.target.value);
                    if (rejectError) setRejectError('');
                  }}
                  placeholder="Ej: El proveedor no reparte esta semana o ya se emitió un pedido similar."
                  className="w-full px-3 py-2 border-2 border-rose-200 focus:border-rose-500 rounded-xl text-xs outline-none bg-rose-50/20 font-medium resize-none"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowRejectPrompt(false)}
                  disabled={isSubmitting}
                  className="px-3.5 py-2 text-xs font-bold text-stone-600 hover:bg-stone-100 rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={isSubmitting || !rejectReason.trim()}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs rounded-xl shadow-2xs flex items-center gap-1.5 cursor-pointer"
                >
                  {isSubmitting ? 'Rechazando...' : 'Confirmar Rechazo'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
