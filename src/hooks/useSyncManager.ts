import { useCallback, useRef } from 'react';
import { WeighingRecord } from '@/types/weighing';
import { toast } from 'sonner';

interface SyncManagerOptions {
  getPendingRecords: () => WeighingRecord[];
  updateRecordSyncStatus: (id: string, status: WeighingRecord['syncStatus']) => void;
  setSyncQueue: React.Dispatch<React.SetStateAction<{
    pendingCount: number;
    lastSyncTime?: Date;
    isProcessing: boolean;
  }>>;
  setConnectionStatus: (status: 'online' | 'offline' | 'syncing' | 'error') => void;
  isOnline: boolean;
}

export function useSyncManager({
  getPendingRecords,
  updateRecordSyncStatus,
  setSyncQueue,
  setConnectionStatus,
  isOnline,
}: SyncManagerOptions) {
  const isSyncing = useRef(false);

  const simulateSync = async (record: WeighingRecord): Promise<boolean> => {
    // Simulate network request with random delay
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
    
    // 95% success rate simulation
    return Math.random() > 0.05;
  };

  const syncRecord = useCallback(async (record: WeighingRecord) => {
    updateRecordSyncStatus(record.id, 'syncing');
    
    try {
      const success = await simulateSync(record);
      
      if (success) {
        updateRecordSyncStatus(record.id, 'synced');
        return true;
      } else {
        updateRecordSyncStatus(record.id, 'error');
        return false;
      }
    } catch (error) {
      updateRecordSyncStatus(record.id, 'error');
      return false;
    }
  }, [updateRecordSyncStatus]);

  const syncAll = useCallback(async () => {
    if (isSyncing.current || !isOnline) {
      if (!isOnline) {
        toast.error('Sem conexão com a rede');
      }
      return;
    }

    const pendingRecords = getPendingRecords();
    
    if (pendingRecords.length === 0) {
      toast.info('Nenhum registro pendente para sincronizar');
      return;
    }

    isSyncing.current = true;
    setConnectionStatus('syncing');
    setSyncQueue(prev => ({ ...prev, isProcessing: true }));

    toast.info(`Sincronizando ${pendingRecords.length} registro(s)...`);

    let successCount = 0;
    let errorCount = 0;

    for (const record of pendingRecords) {
      const success = await syncRecord(record);
      if (success) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    isSyncing.current = false;
    setSyncQueue(prev => ({ 
      ...prev, 
      isProcessing: false,
      lastSyncTime: new Date(),
      pendingCount: errorCount,
    }));

    if (errorCount > 0) {
      setConnectionStatus('error');
      toast.error(`${errorCount} registro(s) falharam na sincronização`);
    } else {
      setConnectionStatus('online');
      toast.success(`${successCount} registro(s) sincronizado(s) com sucesso!`);
    }
  }, [getPendingRecords, syncRecord, setSyncQueue, setConnectionStatus, isOnline]);

  const syncSingle = useCallback(async (recordId: string) => {
    if (!isOnline) {
      toast.error('Sem conexão com a rede');
      return false;
    }

    const pendingRecords = getPendingRecords();
    const record = pendingRecords.find(r => r.id === recordId);
    
    if (!record) {
      toast.error('Registro não encontrado');
      return false;
    }

    setSyncQueue(prev => ({ ...prev, isProcessing: true }));
    const success = await syncRecord(record);
    setSyncQueue(prev => ({ 
      ...prev, 
      isProcessing: false,
      lastSyncTime: new Date(),
    }));

    if (success) {
      toast.success('Registro sincronizado com sucesso!');
    } else {
      toast.error('Falha ao sincronizar registro');
    }

    return success;
  }, [getPendingRecords, syncRecord, setSyncQueue, isOnline]);

  return {
    syncAll,
    syncSingle,
    isSyncing: isSyncing.current,
  };
}
