import { useState, useEffect, useCallback } from 'react';
import { ConnectionStatus } from '@/types/weighing';

export function useConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatus>('online');
  const [lastOnline, setLastOnline] = useState<Date | null>(null);

  const checkConnection = useCallback(async () => {
    try {
      // Try to reach a reliable endpoint
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (status !== 'syncing') {
        setStatus('online');
        setLastOnline(new Date());
      }
      return true;
    } catch {
      if (status !== 'syncing') {
        setStatus('offline');
      }
      return false;
    }
  }, [status]);

  useEffect(() => {
    // Initial check
    checkConnection();

    // Listen for online/offline events
    const handleOnline = () => {
      setStatus('online');
      setLastOnline(new Date());
    };
    
    const handleOffline = () => {
      setStatus('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Periodic check every 10 seconds
    const interval = setInterval(checkConnection, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkConnection]);

  const setManualStatus = useCallback((newStatus: ConnectionStatus) => {
    setStatus(newStatus);
  }, []);

  return {
    status,
    lastOnline,
    isOnline: status === 'online',
    isOffline: status === 'offline',
    isSyncing: status === 'syncing',
    hasError: status === 'error',
    checkConnection,
    setStatus: setManualStatus,
  };
}
