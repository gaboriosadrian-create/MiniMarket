import React, { useState } from 'react';
import { 
  CheckCircle, 
  RefreshCw, 
  Clock, 
  AlertCircle, 
  AlertTriangle,
  CloudOff,
  CloudCheck
} from 'lucide-react';
import { useSyncStatus } from '../lib/useSyncStatus';
import { useNetworkStatus } from '../lib/useNetworkStatus';
import { SyncOperationsModal } from './SyncOperationsModal';

interface SyncStatusIndicatorProps {
  businessId?: string | null;
  compact?: boolean;
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  businessId,
  compact = false
}) => {
  const { stats, syncNow } = useSyncStatus(businessId);
  const { isOnline } = useNetworkStatus();
  const [modalOpen, setModalOpen] = useState(false);

  if (!businessId) return null;

  const totalConflicts = stats.stockConflictCount + stats.errorCount;

  // Determine appearance based on sync and network state
  let badgeColor = 'bg-stone-100 text-stone-700 border-stone-200';
  let icon = <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
  let label = 'Todo sincronizado';

  if (stats.isSyncing) {
    badgeColor = 'bg-blue-50 text-blue-800 border-blue-200 animate-pulse';
    icon = <RefreshCw className="w-3.5 h-3.5 text-blue-600 animate-spin" />;
    label = 'Sincronizando...';
  } else if (totalConflicts > 0) {
    badgeColor = 'bg-red-50 text-red-800 border-red-200';
    icon = <AlertCircle className="w-3.5 h-3.5 text-red-600" />;
    label = `${totalConflicts} con conflicto/error`;
  } else if (stats.pendingCount > 0) {
    badgeColor = 'bg-amber-50 text-amber-900 border-amber-300';
    icon = <Clock className="w-3.5 h-3.5 text-amber-600" />;
    label = `${stats.pendingCount} venta${stats.pendingCount > 1 ? 's' : ''} pendiente${stats.pendingCount > 1 ? 's' : ''}`;
  } else if (!isOnline) {
    badgeColor = 'bg-stone-100 text-stone-700 border-stone-300';
    icon = <CheckCircle className="w-3.5 h-3.5 text-stone-500" />;
    label = 'Local al día';
  } else {
    badgeColor = 'bg-emerald-50 text-emerald-800 border-emerald-200';
    icon = <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />;
    label = 'Sincronizado';
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        title="Ver cola de operaciones offline y sincronización"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all hover:shadow-xs active:scale-95 ${badgeColor}`}
      >
        {icon}
        {!compact && <span className="font-semibold">{label}</span>}
        {compact && stats.pendingCount > 0 && (
          <span className="font-bold font-mono">{stats.pendingCount}</span>
        )}
      </button>

      <SyncOperationsModal
        businessId={businessId}
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
};
