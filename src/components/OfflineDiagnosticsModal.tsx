import React, { useState, useEffect } from 'react';
import { 
  X, 
  Database, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Search, 
  Layers, 
  Package, 
  Barcode, 
  Sparkles,
  Info,
  ShieldCheck,
  Clock,
  AlertCircle
} from 'lucide-react';
import { localDataStore, OfflineDiagnosticsData } from '../lib/localDataStore';
import { syncProductsToLocalStore } from '../lib/productService';
import { Product } from '../types';
import { syncEngine } from '../lib/syncEngine';

interface OfflineDiagnosticsModalProps {
  isOpen: boolean;
  onClose: () => void;
  businessId: string | null;
  businessName?: string;
  isOnline: boolean;
  onDataChanged?: () => void;
}

export const OfflineDiagnosticsModal: React.FC<OfflineDiagnosticsModalProps> = ({
  isOpen,
  onClose,
  businessId,
  businessName,
  isOnline,
  onDataChanged
}) => {
  const [data, setData] = useState<OfflineDiagnosticsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Barcode test search state
  const [testBarcode, setTestBarcode] = useState('');
  const [barcodeTestResult, setBarcodeTestResult] = useState<Product | null | 'NOT_FOUND'>(null);
  const [searchingBarcode, setSearchingBarcode] = useState(false);

  const loadDiagnostics = async () => {
    setLoading(true);
    try {
      const diag = await localDataStore.getDatabaseDiagnostics(businessId);
      setData(diag);
    } catch (err) {
      console.error('Error cargando diagnóstico de IndexedDB:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadDiagnostics();
      setActionFeedback(null);
      setBarcodeTestResult(null);
      setTestBarcode('');
    }
  }, [isOpen, businessId]);

  if (!isOpen) return null;

  const handleForceSync = async () => {
    if (!businessId) {
      setActionFeedback({ message: 'No hay un negocio seleccionado', type: 'error' });
      return;
    }
    if (!isOnline) {
      setActionFeedback({ message: 'No se puede sincronizar sin conexión a Internet', type: 'error' });
      return;
    }

    setSyncing(true);
    setActionFeedback(null);
    try {
      // 1. Sync pending sales in outbox
      await syncEngine.syncBusiness(businessId);

      // 2. Sync catalog products
      const res = await syncProductsToLocalStore(businessId, businessName);
      if (res.success) {
        setActionFeedback({ 
          message: `Sincronización exitosa: ${res.count} productos y cola de ventas actualizados`, 
          type: 'success' 
        });
        await loadDiagnostics();
        if (onDataChanged) onDataChanged();
      } else {
        setActionFeedback({ message: `Error al sincronizar catálogo: ${res.error}`, type: 'error' });
      }
    } catch (err: any) {
      setActionFeedback({ message: `Error: ${err.message}`, type: 'error' });
    } finally {
      setSyncing(false);
    }
  };

  const handleClearBusinessCatalog = async () => {
    if (!businessId) return;
    if (!window.confirm(`¿Estás seguro de limpiar el catálogo local para el negocio actual (${businessId})?`)) {
      return;
    }

    try {
      await localDataStore.clearBusinessCatalog(businessId);
      setActionFeedback({ 
        message: 'Catálogo local limpiado correctamente (Las ventas pendientes en outbox se preservaron)', 
        type: 'success' 
      });
      await loadDiagnostics();
      if (onDataChanged) onDataChanged();
    } catch (err: any) {
      setActionFeedback({ message: `Error al limpiar datos: ${err.message}`, type: 'error' });
    }
  };

  const handleTestBarcodeLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessId || !testBarcode.trim()) return;

    setSearchingBarcode(true);
    setBarcodeTestResult(null);
    try {
      const prod = await localDataStore.getProductByBarcode(businessId, testBarcode.trim());
      setBarcodeTestResult(prod || 'NOT_FOUND');
    } catch (err) {
      console.error('Error probando búsqueda por código:', err);
      setBarcodeTestResult('NOT_FOUND');
    } finally {
      setSearchingBarcode(false);
    }
  };

  const formatTimestamp = (isoStr: string | null) => {
    if (!isoStr) return 'Nunca / Sin sincronizar';
    try {
      const d = new Date(isoStr);
      return d.toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return isoStr;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="diagnostics-modal-title"
    >
      <div className="bg-white rounded-2xl shadow-2xl border border-stone-200 w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden text-stone-800">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-stone-200 bg-stone-50 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 id="diagnostics-modal-title" className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                  Diagnóstico de Datos Locales & Outbox
                </h2>
                <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                  FASE 3
                </span>
              </div>
              <p className="text-xs text-stone-500 mt-0.5">
                Verificación de persistencia, cola de operaciones offline y aislamiento multi-tenant.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar diagnóstico"
            className="p-1.5 rounded-xl hover:bg-stone-200 text-stone-400 hover:text-stone-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div 
            className={`px-4 py-2.5 text-xs font-semibold flex items-center justify-between ${
              actionFeedback.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' 
                : 'bg-red-50 text-red-800 border-b border-red-200'
            }`}
          >
            <div className="flex items-center space-x-2">
              {actionFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              )}
              <span>{actionFeedback.message}</span>
            </div>
            <button 
              type="button" 
              onClick={() => setActionFeedback(null)} 
              className="text-stone-400 hover:text-stone-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          
          {/* 1. System Overview Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            
            {/* Status de Conexión & DB */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Motor de Persistencia
              </span>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-stone-900">
                    {data?.isSupported ? 'IndexedDB v2 Activo' : 'No soportado'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-stone-500 font-bold">
                  {data?.dbName}
                </span>
              </div>
              <div className="pt-2 border-t border-stone-200 flex items-center justify-between text-xs">
                <span className="text-stone-500">Estado de red:</span>
                <span className={`inline-flex items-center gap-1 font-bold ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                  {isOnline ? 'En línea' : 'Sin conexión'}
                </span>
              </div>
            </div>

            {/* Negocio & Tenant */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Tenant Activo
              </span>
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-stone-900 truncate">
                  {businessName || 'Negocio'}
                </span>
              </div>
              <div className="pt-2 border-t border-stone-200 text-xs text-stone-500 space-y-1">
                <div className="flex justify-between">
                  <span>Business ID:</span>
                  <span className="font-mono text-stone-700 font-bold">{businessId || 'No asignado'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Catálogo:</span>
                  <span className="font-mono text-stone-700 font-bold">{data?.catalogVersion || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* Outbox Overview */}
            <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 space-y-2">
              <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">
                Cola Outbox (Fase 3)
              </span>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-900">
                  {data?.pendingOutboxCount || 0} pendientes
                </span>
                <span className="text-xs font-bold text-emerald-700">
                  {data?.syncedOutboxCount || 0} sincronizadas
                </span>
              </div>
              <div className="pt-2 border-t border-stone-200 flex justify-between text-xs text-stone-500">
                <span>Conflictos / Errores:</span>
                <span className="font-mono font-bold text-red-600">
                  {(data?.stockConflictCount || 0) + (data?.errorOutboxCount || 0)}
                </span>
              </div>
            </div>

          </div>

          {/* 2. Products Counts by Type */}
          <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-emerald-700" />
                <h3 className="text-xs font-black uppercase tracking-wider text-emerald-900">
                  Inventario en Almacén Local
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-emerald-800">
                Total: {data?.productCount || 0} productos
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-stone-500 block text-[10px]">Con Stock</span>
                <span className="font-bold font-mono text-emerald-800 text-sm">
                  {data?.tracksStockCount || 0}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-stone-500 block text-[10px]">Sin Stock (Servicios)</span>
                <span className="font-bold font-mono text-emerald-800 text-sm">
                  {data?.nonTracksStockCount || 0}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-stone-500 block text-[10px]">Combos</span>
                <span className="font-bold font-mono text-purple-700 text-sm">
                  {data?.combosCount || 0}
                </span>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <span className="text-stone-500 block text-[10px]">Con Código</span>
                <span className="font-bold font-mono text-stone-800 text-sm">
                  {data?.barcodesCount || 0}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Barcode Lookup Test */}
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200 space-y-3">
            <div className="flex items-center space-x-2">
              <Barcode className="w-4 h-4 text-stone-700" />
              <h3 className="text-xs font-black uppercase tracking-wider text-stone-900">
                Prueba de Consulta por Código de Barras (IndexedDB)
              </h3>
            </div>
            <p className="text-[11px] text-stone-500">
              Verifica que el índice <code className="font-mono bg-stone-200 px-1 rounded">by_business_barcode</code> responda instantáneamente sin acceso a Internet.
            </p>

            <form onSubmit={handleTestBarcodeLookup} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Ingrese código de barras (ej. 779...)"
                  value={testBarcode}
                  onChange={(e) => setTestBarcode(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-stone-200 rounded-lg focus:outline-hidden focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                disabled={searchingBarcode || !testBarcode.trim()}
                className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                {searchingBarcode ? 'Buscando...' : 'Buscar Local'}
              </button>
            </form>

            {barcodeTestResult && (
              <div className="p-2.5 rounded-lg bg-white border border-stone-200 text-xs">
                {barcodeTestResult === 'NOT_FOUND' ? (
                  <span className="text-red-600 font-medium">
                    ❌ Producto no encontrado en el almacén local para este código.
                  </span>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-900">{barcodeTestResult.name}</span>
                      <span className="font-mono font-bold text-emerald-700">
                        ${barcodeTestResult.salePrice}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[11px] text-stone-500">
                      <span>Stock local: <strong className="font-mono">{barcodeTestResult.stock} u.</strong></span>
                      <span>Categoría: {barcodeTestResult.category}</span>
                      <span>Tipo: {barcodeTestResult.isCombo ? 'Combo' : barcodeTestResult.tracksStock ? 'Inventariado' : 'Servicio'}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 4. Sample Products Table */}
          {data?.sampleProducts && data.sampleProducts.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-stone-700">Muestra de Productos Locales (Top 5)</span>
                <span className="text-[11px] text-stone-400 font-mono">Última sinc: {formatTimestamp(data.lastSyncedAt)}</span>
              </div>
              <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-stone-100 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="p-2">Producto</th>
                      <th className="p-2">Código</th>
                      <th className="p-2 text-right">Precio</th>
                      <th className="p-2 text-right">Stock Local</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {data.sampleProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-stone-50">
                        <td className="p-2 font-medium text-stone-900 truncate max-w-[180px]">
                          {p.name}
                          {p.isCombo && (
                            <span className="ml-1 px-1 py-0.2 bg-purple-100 text-purple-800 text-[9px] font-bold rounded">
                              Combo
                            </span>
                          )}
                        </td>
                        <td className="p-2 font-mono text-stone-500">{p.barcode || '—'}</td>
                        <td className="p-2 text-right font-mono text-stone-900">${p.salePrice}</td>
                        <td className="p-2 text-right font-mono font-bold text-stone-700">
                          {p.tracksStock ? `${p.stock} u.` : 'Inf.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 5. Sample Outbox Operations */}
          {data?.sampleOutbox && data.sampleOutbox.length > 0 && (
            <div className="space-y-2">
              <span className="font-bold text-xs text-stone-700">Muestra de Operaciones en Outbox (Últimas 5)</span>
              <div className="border border-stone-200 rounded-xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-stone-100 text-stone-600 font-bold border-b border-stone-200">
                    <tr>
                      <th className="p-2">Venta ID</th>
                      <th className="p-2">Estado</th>
                      <th className="p-2 text-right">Total</th>
                      <th className="p-2">Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 bg-white">
                    {data.sampleOutbox.map((o) => (
                      <tr key={o.operationId} className="hover:bg-stone-50">
                        <td className="p-2 font-mono font-bold text-stone-900">
                          #{o.saleId.slice(-6).toUpperCase()}
                        </td>
                        <td className="p-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            o.status === 'SYNCED' ? 'bg-emerald-100 text-emerald-800' :
                            o.status === 'STOCK_CONFLICT' ? 'bg-red-100 text-red-800' :
                            'bg-amber-100 text-amber-900'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono text-stone-900">${o.total}</td>
                        <td className="p-2 text-stone-500 font-mono text-[11px]">
                          {new Date(o.createdAt).toLocaleTimeString('es-AR')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleForceSync}
              disabled={syncing || !isOnline}
              className="flex-1 sm:flex-none inline-flex items-center justify-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Sincronizando...' : 'Forzar Sincronización'}</span>
            </button>

            <button
              type="button"
              onClick={handleClearBusinessCatalog}
              className="inline-flex items-center justify-center space-x-1 px-3 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-colors cursor-pointer"
              title="Limpia la base de datos local para este negocio"
            >
              <Trash2 className="w-3.5 h-3.5 text-stone-500" />
              <span>Limpiar Catálogo</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2 rounded-xl bg-stone-200 hover:bg-stone-300 active:bg-stone-400 text-stone-800 text-xs font-bold transition-colors cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
