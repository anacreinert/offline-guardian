import { useState, useEffect, useCallback } from 'react';
import { ConnectionStatus } from '@/types/weighing';

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [lastOnline, setLastOnline] = useState<Date | null>(null);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(false);

  const checkConnection = useCallback(async () => {
    // If simulated offline mode is enabled, always return offline
    if (isSimulatedOffline) {
      if (status !== 'syncing') {
        setStatus('offline');
      }
      return false;
    }

    // Use browser's native online/offline detection
    if (!navigator.onLine) {
      if (status !== 'syncing') {
        setStatus('offline');
      }
      return false;
    }
    
    // If browser says we're online, trust it
    if (status !== 'syncing') {
      setStatus('online');
      setLastOnline(new Date());
    }
    return true;
  }, [status, isSimulatedOffline]);

  useEffect(() => {
    // Initial check
    checkConnection();

    // Listen for online/offline events
    const handleOnline = () => {
      if (!isSimulatedOffline) {
        setStatus('online');
        setLastOnline(new Date());
      }
    };
    
    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check every 30 seconds
    const interval = setInterval(checkConnection, 30000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection, isSimulatedOffline]);

  // When simulated offline changes, update status immediately
  useEffect(() => {
    if (isSimulatedOffline) {
      setStatus('offline');
    } else if (navigator.onLine) {
      setStatus('online');
      setLastOnline(new Date());
    }
  }, [isSimulatedOffline]);

  const setManualStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
  }, []);

  const toggleSimulatedOffline = useCallback(() => {
    setIsSimulatedOffline(prev => !prev);
  }, []);

  return {
    status,
    lastOnline,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isSyncing: status === 'syncing',
    hasError: status === 'error',
    isSimulatedOffline,
    checkConnection,
    setStatus: setManualStatus,
    toggleSimulatedOffline,
  };
}
