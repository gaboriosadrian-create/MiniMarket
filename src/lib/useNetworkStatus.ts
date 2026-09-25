import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  lastOnlineAt: string | null;
  lastOfflineAt: string | null;
  checkOnline: () => boolean;
}

/**
 * Centralized hook for network connectivity monitoring
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });

  const [lastOnlineAt, setLastOnlineAt] = useState<string | null>(() => {
    return typeof navigator !== 'undefined' && navigator.onLine ? new Date().toISOString() : null;
  });

  const [lastOfflineAt, setLastOfflineAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date().toISOString());
    };

    const handleOffline = () => {
      setIsOnline(false);
      setLastOfflineAt(new Date().toISOString());
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const checkOnline = useCallback(() => {
    const current = typeof navigator !== 'undefined' ? navigator.onLine : true;
    setIsOnline(current);
    return current;
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    lastOnlineAt,
    lastOfflineAt,
    checkOnline
  };
}
