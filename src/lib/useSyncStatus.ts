import { useState, useEffect } from 'react';
import { syncEngine, SyncStats } from './syncEngine';

export function useSyncStatus(businessId?: string | null): {
  stats: SyncStats;
  syncNow: () => Promise<void>;
  refreshStats: () => Promise<void>;
} {
  const [stats, setStats] = useState<SyncStats>({
    isSyncing: false,
    pendingCount: 0,
    syncingCount: 0,
    syncedCount: 0,
    errorCount: 0,
    stockConflictCount: 0,
    cancelledCount: 0,
    lastSyncAt: null,
    lastError: null
  });

  useEffect(() => {
    if (!businessId) return;

    syncEngine.setActiveBusiness(businessId);

    const unsubscribe = syncEngine.subscribe((newStats) => {
      setStats(newStats);
    });

    syncEngine.refreshStats(businessId);

    return () => {
      unsubscribe();
    };
  }, [businessId]);

  const syncNow = async () => {
    if (!businessId) return;
    await syncEngine.syncBusiness(businessId);
  };

  const refreshStats = async () => {
    if (!businessId) return;
    await syncEngine.refreshStats(businessId);
  };

  return {
    stats,
    syncNow,
    refreshStats
  };
}
