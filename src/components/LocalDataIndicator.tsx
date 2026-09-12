import React, { useState, useEffect } from 'react';
import { Database, Wifi, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useNetworkStatus } from '../lib/useNetworkStatus';
import { localDataStore, BusinessMetadata } from '../lib/localDataStore';
import { OfflineDiagnosticsModal } from './OfflineDiagnosticsModal';

interface LocalDataIndicatorProps {
  businessId: string | null;
  businessName?: string;
  className?: string;
}

export const LocalDataIndicator: React.FC<LocalDataIndicatorProps> = ({
  businessId,
  businessName,
  className = ''
}) => {
  const { isOnline } = useNetworkStatus();
  const [meta, setMeta] = useState<BusinessMetadata | null>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const fetchMeta = async () => {
    if (!businessId) return;
    try {
      const data = await localDataStore.getBusinessMetadata(businessId);
      setMeta(data);
    } catch (err) {
      console.warn('Error obteniendo metadatos locales:', err);
    }
  };

  useEffect(() => {
    fetchMeta();
  }, [businessId, isOnline]);

  const formatShortTime = (isoStr: string | null | undefined) => {
    if (!isoStr) return null;
    try {
      const d = new Date(isoStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day}/${month} ${hours}:${mins}`;
    } catch {
      return null;
    }
  };

  const syncTimeFormatted = formatShortTime(meta?.lastSyncedAt);

  return (
    <>
      <button
        type="button"
        onClick={() => setShowDiagnostics(true)}
        id="btn-local-data-indicator"
        title="Ver diagnóstico de datos locales e IndexedDB"
        className={`inline-flex items-center space-x-2 px-2.5 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer border ${
          isOnline
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300'
            : 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100 hover:border-amber-400'
        } ${className}`}
      >
        {/* Status dot & icon */}
        <span className="flex items-center space-x-1">
          <span
            className={`w-2 h-2 rounded-full ${
              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}
          />
          {isOnline ? (
            <Wifi className="w-3 h-3 text-emerald-700" />
          ) : (
            <WifiOff className="w-3 h-3 text-amber-700" />
          )}
        </span>

        {/* Text Details */}
        <div className="flex items-center space-x-1.5 leading-none">
          <span className="font-bold">
            {isOnline ? 'Conectado' : 'Sin conexión'}
          </span>
          <span className="text-stone-400">•</span>
          <span className="text-stone-600 font-medium">
            {syncTimeFormatted 
              ? (isOnline ? `Datos: ${syncTimeFormatted}` : `Local: ${syncTimeFormatted}`) 
              : 'Datos locales listos'}
          </span>
          {meta?.productCount !== undefined && meta.productCount > 0 && (
            <span className="hidden sm:inline text-stone-500 font-mono text-[10px]">
              ({meta.productCount} prods)
            </span>
          )}
        </div>

        <Database className="w-3 h-3 opacity-60 text-current" />
      </button>

      {/* Diagnostics Modal for Dev & Testing */}
      <OfflineDiagnosticsModal
        isOpen={showDiagnostics}
        onClose={() => setShowDiagnostics(false)}
        businessId={businessId}
        businessName={businessName}
        isOnline={isOnline}
        onDataChanged={fetchMeta}
      />
    </>
  );
};
