import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  CheckCircle, 
  CheckCircle2,
  Clock, 
  AlertCircle, 
  AlertTriangle, 
  ShoppingBag, 
  ArrowRight,
  Database,
  Banknote,
  QrCode,
  Layers,
  Search,
  Zap,
  Trash2,
  ShieldAlert
} from 'lucide-react';
import { OutboxOperation, OutboxStatus } from '../types';
import { localDataStore } from '../lib/localDataStore';
import { useSyncStatus } from '../lib/useSyncStatus';
import { syncEngine } from '../lib/syncEngine';
import { repairAndMigrateAllOfflineOperations } from '../lib/offlineRepairUtils';

interface SyncOperationsModalProps {
  businessId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const SyncOperationsModal: React.FC<SyncOperationsModalProps> = ({
  businessId,
  isOpen,
  onClose
}) => {
  const { stats, syncNow } = useSyncStatus(businessId);
  const [operations, setOperations] = useState<OutboxOperation[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'RETRY' | 'CANCEL' | 'FORCE' | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [actionErrorMsg, setActionErrorMsg] = useState<string | null>(null);
  const [confirmActionState, setConfirmActionState] = useState<{
    type: 'CANCEL' | 'FORCE';
    op: OutboxOperation;
  } | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const loadOperations = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      await repairAndMigrateAllOfflineOperations(businessId);
      const ops = await localDataStore.getOutboxOperations(businessId);
      setOperations(ops);
    } catch (err) {
      console.error('Error loading outbox operations:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadOperations();
    }
  }, [isOpen, businessId, stats.isSyncing, stats.stockConflictCount]);

  if (!isOpen) return null;

  const handleRetrySingle = async (op: OutboxOperation) => {
    const code = (op.saleId || op.operationId).slice(-6).toUpperCase();
    setActionInProgress(op.operationId);
    setActionType('RETRY');
    setActionSuccessMsg(null);
    setActionErrorMsg(null);

    try {
      const res = await syncEngine.retrySingleOperation(businessId, op.operationId, op.saleId);
      if (res.success) {
        setActionSuccessMsg(`Operación #${code} sincronizada con éxito con Firestore.`);
      } else if (res.status === 'STOCK_CONFLICT') {
        setActionErrorMsg(`Conflicto de stock al sincronizar #${code}: ${res.error || 'Stock insuficiente en el servidor'}`);
      } else {
        setActionErrorMsg(`Error al sincronizar #${code}: ${res.error || 'Fallo de sincronización con el servidor'}`);
      }
      await loadOperations();
    } catch (err: any) {
      console.error('Error reintentando operación:', err);
      setActionErrorMsg(`Error inesperado al reintentar #${code}: ${err?.message || 'Error desconocido'}`);
    } finally {
      setActionInProgress(null);
      setActionType(null);
    }
  };

  const handleForceSync = (op: OutboxOperation) => {
    setConfirmActionState({ type: 'FORCE', op });
  };

  const executeForceSync = async (op: OutboxOperation) => {
    const code = (op.saleId || op.operationId).slice(-6).toUpperCase();
    setActionInProgress(op.operationId);
    setActionType('FORCE');
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    setConfirmActionState(null);

    try {
      const res = await syncEngine.forceSyncSingleOperation(businessId, op.operationId, op.saleId);
      if (res.success) {
        setActionSuccessMsg(`Venta #${code} forzada y sincronizada con éxito. Se generaron los movimientos de ajuste.`);
      } else {
        setActionErrorMsg(`Error al forzar #${code}: ${res.error || 'No se pudo forzar la sincronización'}`);
      }
      await loadOperations();
    } catch (err: any) {
      console.error('Error forzando operación:', err);
      setActionErrorMsg(`Error inesperado al forzar #${code}: ${err?.message || 'Error desconocido'}`);
    } finally {
      setActionInProgress(null);
      setActionType(null);
    }
  };

  const handleCancelOperation = (op: OutboxOperation) => {
    setConfirmActionState({ type: 'CANCEL', op });
  };

  const executeCancelOperation = async (op: OutboxOperation) => {
    const code = (op.saleId || op.operationId).slice(-6).toUpperCase();
    setActionInProgress(op.operationId);
    setActionType('CANCEL');
    setActionSuccessMsg(null);
    setActionErrorMsg(null);
    setConfirmActionState(null);

    try {
      const res = await syncEngine.cancelSingleOperation(
        businessId,
        op.saleId || op.operationId,
        op.operationId,
        'Cancelada por el administrador desde el gestor de operaciones offline'
      );
      if (res.success) {
        const detail = res.items && res.items.length > 0 ? ` (${res.items.join(', ')})` : '';
        setActionSuccessMsg(`Operación #${code} anulada con éxito y stock repuesto localmente${detail}.`);
      } else {
        setActionErrorMsg(`No se pudo anular #${code}: ${res.message || 'Error al procesar anulación'}`);
      }
      await loadOperations();
    } catch (err: any) {
      console.error('Error anulando operación:', err);
      setActionErrorMsg(`Error inesperado al anular #${code}: ${err?.message || 'Error desconocido'}`);
    } finally {
      setActionInProgress(null);
      setActionType(null);
    }
  };

  const cancelledCount = stats.cancelledCount || operations.filter(o => o.status === 'CANCELLED').length;

  const filteredOps = operations.filter((op) => {
    if (filterStatus === 'PENDING' && (op.status !== 'PENDING' && op.status !== 'SYNCING')) return false;
    if (filterStatus === 'CONFLICT' && (op.status !== 'STOCK_CONFLICT' && op.status !== 'ERROR')) return false;
    if (filterStatus === 'SYNCED' && op.status !== 'SYNCED') return false;
    if (filterStatus === 'CANCELLED' && op.status !== 'CANCELLED') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = (op.saleId || '').toLowerCase().includes(q) || op.operationId.toLowerCase().includes(q);
      const matchSeller = (op.userName || '').toLowerCase().includes(q);
      const matchSaleItem = op.saleSnapshot?.items?.some(i => (i.productName || '').toLowerCase().includes(q));
      const matchAdjItem = op.adjustmentSnapshot?.items?.some(i => (i.productName || '').toLowerCase().includes(q));
      const matchRecItem = op.receivingSnapshot?.items?.some(i => (i.productName || '').toLowerCase().includes(q));
      const matchExpense = op.expenseSnapshot?.description?.toLowerCase().includes(q);
      if (!matchId && !matchSeller && !matchSaleItem && !matchAdjItem && !matchRecItem && !matchExpense) return false;
    }

    return true;
  });

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0
    }).format(val);
  };

  const getStatusBadge = (status: OutboxStatus) => {
    switch (status) {
      case 'SYNCED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-3 h-3" />
            Sincronizada
          </span>
        );
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200 animate-pulse">
            <RefreshCw className="w-3 h-3 animate-spin" />
            Sincronizando...
          </span>
        );
      case 'STOCK_CONFLICT':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800 border border-red-200">
            <AlertCircle className="w-3 h-3" />
            Conflicto Stock
          </span>
        );
      case 'ERROR':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <AlertTriangle className="w-3 h-3" />
            Error de Envío
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-stone-100 text-stone-600 border border-stone-300">
            <X className="w-3 h-3" />
            Anulada / Repuesta
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
            <Clock className="w-3 h-3" />
            Pendiente
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between bg-stone-50 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-stone-900">
                  Cola de Operaciones Offline (Outbox)
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-200">
                  FASE 4
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Registro transaccional, resolución de conflictos de stock y consistencia local
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 hover:bg-stone-200 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Success Alert if any */}
        {actionSuccessMsg && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-900 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMsg}</span>
            </div>
            <button
              onClick={() => setActionSuccessMsg(null)}
              className="text-emerald-700 hover:text-emerald-900 text-sm font-bold px-1.5 py-0.5"
            >
              ×
            </button>
          </div>
        )}

        {/* Action Error Alert if any */}
        {actionErrorMsg && (
          <div className="p-3 bg-red-50 border-b border-red-200 text-red-900 text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{actionErrorMsg}</span>
            </div>
            <button
              onClick={() => setActionErrorMsg(null)}
              className="text-red-700 hover:text-red-900 text-sm font-bold px-1.5 py-0.5"
            >
              ×
            </button>
          </div>
        )}

        {/* Stats Summary & Action Bar */}
        <div className="p-3 sm:p-4 bg-stone-100/70 border-b border-stone-200 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 text-center">
          <div className="bg-white p-2.5 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Pendientes</span>
            <span className="text-lg font-black text-amber-700 font-mono">{stats.pendingCount}</span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Sincronizadas</span>
            <span className="text-lg font-black text-emerald-700 font-mono">{stats.syncedCount}</span>
          </div>

          <div className="bg-white p-2.5 rounded-xl border border-stone-200">
            <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider block">Conflictos / Errores</span>
            <span className="text-lg font-black text-red-700 font-mono">{stats.stockConflictCount + stats.errorCount}</span>
          </div>

          <div className="bg-white p-2 rounded-xl border border-stone-200 flex items-center justify-center">
            <button
              onClick={syncNow}
              disabled={stats.isSyncing}
              className="w-full h-full py-2 px-3 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${stats.isSyncing ? 'animate-spin' : ''}`} />
              {stats.isSyncing ? 'Sincronizando...' : 'Sincronizar Todo'}
            </button>
          </div>
        </div>

        {/* Filters & Search */}
        <div className="p-3 border-b border-stone-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white shrink-0">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            {[
              { id: 'ALL', label: 'Todas' },
              { id: 'CONFLICT', label: `Requieren Atención (${stats.stockConflictCount + stats.errorCount})` },
              { id: 'PENDING', label: `Pendientes (${stats.pendingCount})` },
              { id: 'SYNCED', label: `Sincronizadas (${stats.syncedCount})` },
              ...(cancelledCount > 0 ? [{ id: 'CANCELLED', label: `Anuladas (${cancelledCount})` }] : [])
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterStatus(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                  filterStatus === tab.id
                    ? 'bg-amber-600 text-white'
                    : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por ID, producto o vendedor..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-stone-50 border border-stone-200 rounded-lg w-full sm:w-64 focus:outline-hidden focus:border-amber-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Operations List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
          {filteredOps.length === 0 ? (
            <div className="text-center py-12 text-stone-500 space-y-2">
              <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto" />
              <p className="font-bold text-sm">No hay operaciones que coincidan con el filtro.</p>
              <p className="text-xs text-stone-400">
                Las operaciones registradas sin conexión se guardarán aquí automáticamente.
              </p>
            </div>
          ) : (
            filteredOps.map((op) => {
              const isWorking = actionInProgress === op.operationId;
              const dateStr = new Date(op.createdAt).toLocaleString('es-AR', {
                dateStyle: 'short',
                timeStyle: 'medium'
              });

              const isConflictOrError = op.status === 'STOCK_CONFLICT' || op.status === 'ERROR';
              const isPending = op.status === 'PENDING' || op.status === 'SYNCING';
              const isCancelled = op.status === 'CANCELLED';
              const isActionable = (isConflictOrError || isPending) && !isCancelled;

              const opType = op.operationType || 'SALE';
              const typeLabel = 
                opType === 'EXPENSE' ? 'Gasto' :
                opType === 'STOCK_ADJUSTMENT' ? 'Ajuste de Stock' :
                opType === 'RECEIVING' ? 'Recepción' : 'Venta';

              const opCode = 
                opType === 'EXPENSE' ? `Gasto #${(op.expenseId || op.saleId || '').slice(-6).toUpperCase()}` :
                opType === 'STOCK_ADJUSTMENT' ? `Ajuste #${(op.adjustmentId || op.saleId || '').slice(-6).toUpperCase()}` :
                opType === 'RECEIVING' ? `Recepción #${(op.receivingId || op.saleId || '').slice(-6).toUpperCase()}` :
                `Venta #${(op.saleId || '').slice(-6).toUpperCase()}`;

              const opTotalDisplay = 
                opType === 'EXPENSE' ? (op.expenseSnapshot ? formatCurrency(op.expenseSnapshot.amount) : '-') :
                opType === 'STOCK_ADJUSTMENT' ? `${op.adjustmentSnapshot?.items?.length || 0} productos` :
                opType === 'RECEIVING' ? `${op.receivingSnapshot?.items?.length || 0} productos` :
                formatCurrency(op.saleSnapshot?.total || 0);

              return (
                <div
                  key={op.operationId}
                  className={`rounded-xl border transition-all ${
                    isCancelled
                      ? 'border-stone-300 bg-stone-50/80 opacity-90'
                      : op.status === 'STOCK_CONFLICT'
                      ? 'border-red-300 bg-red-50/40'
                      : op.status === 'ERROR'
                      ? 'border-amber-300 bg-amber-50/40'
                      : op.status === 'SYNCED'
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-stone-200 bg-white hover:border-stone-300'
                  } p-3.5`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-stone-100 text-stone-700 border border-stone-200">
                        {typeLabel}
                      </span>
                      <span className="font-mono font-black text-xs text-stone-900">
                        {opCode}
                      </span>
                      {getStatusBadge(op.status)}
                      <span className="text-[11px] text-stone-500 font-mono">
                        {dateStr}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-xs text-stone-600">
                        Usuario: <strong className="font-bold text-stone-900">{op.userName}</strong>
                      </span>
                      <span className="text-sm font-black text-stone-900 font-mono">
                        {opTotalDisplay}
                      </span>
                    </div>
                  </div>

                  {/* Error / Conflict details if present */}
                  {op.lastError && (
                    <div className="mt-2 p-2.5 rounded-lg bg-red-100/70 border border-red-200 text-xs text-red-900 flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <strong className="font-bold block">
                          {op.status === 'STOCK_CONFLICT' ? 'Conflicto de Stock en Servidor:' : 'Detalle del Error:'}
                        </strong>
                        <span className="text-[11px] font-mono text-red-800">{op.lastError}</span>
                      </div>
                    </div>
                  )}

                  {/* Items snapshot summary depending on opType */}
                  {opType === 'SALE' && op.saleSnapshot?.items && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-stone-500 font-medium">Productos:</span>
                      {op.saleSnapshot.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-800 text-[11px]"
                        >
                          <span className="font-bold text-amber-800 font-mono">{item.quantity}x</span>
                          <span className="truncate max-w-[150px]">{item.productName}</span>
                          {item.isCombo && (
                            <span className="px-1 bg-purple-100 text-purple-800 font-bold rounded text-[9px]">
                              Combo
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}

                  {opType === 'EXPENSE' && op.expenseSnapshot && (
                    <div className="mt-2.5 flex items-center gap-2 text-xs text-stone-700">
                      <span className="text-stone-500 font-medium">Detalle:</span>
                      <span className="font-bold text-stone-900">{op.expenseSnapshot.description}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-stone-100 text-stone-600 font-bold">
                        {op.expenseSnapshot.category}
                      </span>
                    </div>
                  )}

                  {opType === 'STOCK_ADJUSTMENT' && op.adjustmentSnapshot?.items && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-stone-500 font-medium">Ajustes:</span>
                      {op.adjustmentSnapshot.items.map((item, idx) => (
                        <span
                          key={idx}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${
                            item.adjustmentType === 'IN' 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}
                        >
                          <span className="font-bold font-mono">{item.adjustmentType === 'IN' ? '+' : '-'}{item.quantity}</span>
                          <span className="truncate max-w-[150px]">{item.productName}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {opType === 'RECEIVING' && op.receivingSnapshot?.items && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="text-stone-500 font-medium">Recepción:</span>
                      <span className="font-bold text-stone-800">{op.receivingSnapshot.supplierName || 'Proveedor'}</span>
                      {op.receivingSnapshot.deliveryNoteNumber && (
                        <span className="font-mono text-[11px] text-stone-500">Remito #{op.receivingSnapshot.deliveryNoteNumber}</span>
                      )}
                      {op.receivingSnapshot.items.map((item, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 border border-stone-200 text-stone-800 text-[11px]"
                        >
                          <span className="font-bold text-indigo-700 font-mono">+{item.quantity}</span>
                          <span className="truncate max-w-[150px]">{item.productName}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Cancelled Indicator Banner */}
                  {isCancelled && (
                    <div className="mt-3 pt-2 border-t border-stone-200 flex items-center justify-between gap-2 bg-stone-100/90 px-3 py-2 rounded-lg text-xs font-bold text-stone-700">
                      <div className="flex items-center gap-1.5 text-stone-600">
                        <CheckCircle2 className="w-4 h-4 text-stone-500" />
                        <span>Operación Anulada • Stock repuesto localmente</span>
                      </div>
                      <span className="text-[11px] font-mono text-stone-500 font-normal">
                        No se sincronizará
                      </span>
                    </div>
                  )}

                  {/* Conflict / Action Resolution Bar */}
                  {isActionable && (
                    <div className={`mt-3 pt-2.5 border-t flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg ${
                      isConflictOrError ? 'border-red-200/80 bg-red-50/70' : 'border-amber-200 bg-amber-50/60'
                    }`}>
                      <div className="flex items-center gap-1 text-[11px] font-bold text-stone-800">
                        <ShieldAlert className={`w-4 h-4 ${isConflictOrError ? 'text-red-600' : 'text-amber-600'}`} />
                        <span>{isConflictOrError ? 'Resolución de Conflicto:' : 'Acciones disponibles:'}</span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {/* 1. Reintentar */}
                        <button
                          onClick={() => handleRetrySingle(op)}
                          disabled={isWorking}
                          className="px-2.5 py-1 bg-white hover:bg-stone-50 border border-stone-300 text-stone-800 font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-60"
                          title="Reintentar sincronización con el servidor"
                        >
                          <RefreshCw className={`w-3 h-3 ${isWorking && actionType === 'RETRY' ? 'animate-spin text-amber-600' : ''}`} />
                          <span>{isWorking && actionType === 'RETRY' ? 'Reintentando...' : 'Reintentar'}</span>
                        </button>

                        {/* 2. Forzar Venta (only for sales with stock conflict) */}
                        {opType === 'SALE' && op.status === 'STOCK_CONFLICT' && (
                          <button
                            onClick={() => handleForceSync(op)}
                            disabled={isWorking}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                            title="Forzar venta y ajustar stock en servidor con balance restante"
                          >
                            <Zap className={`w-3 h-3 ${isWorking && actionType === 'FORCE' ? 'animate-bounce' : ''}`} />
                            <span>{isWorking && actionType === 'FORCE' ? 'Forzando...' : 'Forzar Venta'}</span>
                          </button>
                        )}

                        {/* 3. Anular Localmente (only for sales) */}
                        {opType === 'SALE' && (
                          <button
                            onClick={() => handleCancelOperation(op)}
                            disabled={isWorking}
                            className="px-2.5 py-1 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs disabled:opacity-60"
                            title="Anular venta y reponer stock en la base local"
                          >
                            <Trash2 className={`w-3 h-3 ${isWorking && actionType === 'CANCEL' ? 'animate-pulse' : ''}`} />
                            <span>{isWorking && actionType === 'CANCEL' ? 'Anulando...' : 'Anular y Reponer'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Metadata footer */}
                  <div className="mt-2.5 pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between text-[10px] text-stone-500 font-mono">
                    <span>Op ID: {op.operationId}</span>
                    <span>Dispositivo: {op.deviceId.slice(0, 16)}</span>
                    <span>Intentos: {op.attempts}</span>
                    {op.syncedAt && (
                      <span className="text-emerald-700 font-bold">
                        Sincronizado: {new Date(op.syncedAt).toLocaleTimeString('es-AR')}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Confirmation Modal Dialog for Anular/Forzar */}
        {confirmActionState && (
          <div className="absolute inset-0 bg-stone-900/50 backdrop-blur-xs flex items-center justify-center p-4 z-60 animate-in fade-in duration-150">
            <div className="bg-white rounded-2xl p-5 shadow-2xl border border-stone-200 max-w-md w-full space-y-4">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                  confirmActionState.type === 'CANCEL' ? 'bg-red-600' : 'bg-amber-600'
                }`}>
                  {confirmActionState.type === 'CANCEL' ? <Trash2 className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-base font-black text-stone-900">
                    {confirmActionState.type === 'CANCEL'
                      ? `¿Anular y Reponer Venta #${(confirmActionState.op.saleId || confirmActionState.op.operationId).slice(-6).toUpperCase()}?`
                      : `¿Forzar Venta #${(confirmActionState.op.saleId || confirmActionState.op.operationId).slice(-6).toUpperCase()}?`
                    }
                  </h4>
                  <p className="text-xs text-stone-500">
                    {confirmActionState.type === 'CANCEL'
                      ? 'Devuelve el stock a la base local y anula la operación.'
                      : 'Sincroniza en Firestore y ajusta el stock restante disponible.'
                    }
                  </p>
                </div>
              </div>

              {confirmActionState.type === 'CANCEL' && (
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs space-y-2">
                  <div className="font-bold text-stone-700">Productos a reponer en stock local:</div>
                  <div className="space-y-1">
                    {(confirmActionState.op.saleSnapshot?.items || []).map((it, idx) => (
                      <div key={idx} className="flex justify-between text-stone-600">
                        <span>• {it.productName}</span>
                        <span className="font-bold text-emerald-700 font-mono">+{it.quantity} un.</span>
                      </div>
                    ))}
                  </div>
                  <div className="text-[11px] text-stone-500 pt-1 border-t border-stone-200">
                    La operación quedará marcada como <strong>CANCELADA</strong> y no volverá a enviarse al servidor.
                  </div>
                </div>
              )}

              {confirmActionState.type === 'FORCE' && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1 text-amber-900">
                  <p className="font-bold">Advertencia:</p>
                  <p>Se creará la venta en la nube deduciendo el inventario disponible y ajustando diferencias en el servidor.</p>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setConfirmActionState(null)}
                  disabled={actionInProgress !== null}
                  className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-bold transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    if (confirmActionState.type === 'CANCEL') {
                      executeCancelOperation(confirmActionState.op);
                    } else {
                      executeForceSync(confirmActionState.op);
                    }
                  }}
                  disabled={actionInProgress !== null}
                  className={`px-4 py-2 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 ${
                    confirmActionState.type === 'CANCEL'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {confirmActionState.type === 'CANCEL' ? (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Confirmar Anulación y Reposición</span>
                    </>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5" />
                      <span>Confirmar y Forzar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-stone-500 font-mono">
            {filteredOps.length} operaciones mostradas
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 font-bold text-xs rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};

