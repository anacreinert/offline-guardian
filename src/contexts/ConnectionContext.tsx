import React, { createContext, useContext, ReactNode } from 'react';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { ConnectionStatus } from '@/types/weighing';

interface ConnectionContextType {
  status: ConnectionStatus;
  isOnline: boolean;
  isOffline: boolean;
  isSyncing: boolean;
  hasError: boolean;
  isSimulatedOffline: boolean;
  lastOnline: Date | null;
  checkConnection: () => Promise<boolean>;
  setStatus: (status: ConnectionStatus) => void;
  toggleSimulatedOffline: () => void;
}

const ConnectionContext = createContext<ConnectionContextType | undefined>(undefined);

export function ConnectionProvider({ children }: { children: ReactNode }) {
  const connectionStatus = useConnectionStatus();

  return (
    <ConnectionContext.Provider value={connectionStatus}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextType {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}
