import { useCallback, useRef } from 'react';
import { WeighingRecord } from '@/types/weighing';
import { supabase } from '@/integrations/supabase/client';
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

  const syncToDatabase = async (record: WeighingRecord): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        return false;
      }

      const { error } = await supabase
        .from('weighing_records')
        .insert({
          id: record.id,
          user_id: user.id,
          vehicle_plate: record.vehiclePlate,
          driver_name: record.driverName || null,
          product: record.product || null,
          gross_weight: record.grossWeight,
          tare_weight: record.tareWeight,
          net_weight: record.netWeight,
          origin: record.origin || null,
          destination: record.destination || null,
          notes: record.notes || null,
          created_offline: record.createdOffline,
          synced_at: new Date().toISOString(),
          created_at: record.timestamp.toISOString(),
        });

      if (error) {
        // If record already exists, consider it synced
        if (error.code === '23505') {
          console.log('Record already exists in database:', record.id);
          return true;
        }
        console.error('Error syncing record:', error);
        return false;
      }

      console.log('Record synced successfully:', record.id);
      return true;
    } catch (error) {
      console.error('Error syncing record:', error);
      return false;
    }
  };

  const syncRecord = useCallback(async (record: WeighingRecord) => {
    updateRecordSyncStatus(record.id, 'syncing');
    
    try {
      const success = await syncToDatabase(record);
      
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
