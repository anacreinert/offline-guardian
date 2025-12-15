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

  // Upload photos to storage and return URLs
  const uploadPhotos = async (record: WeighingRecord, userId: string): Promise<Record<string, string>> => {
    const photoUrls: Record<string, string> = {};
    
    if (!record.photos || record.photos.length === 0) {
      return photoUrls;
    }

    for (const photo of record.photos) {
      try {
        // Convert data URL to blob
        const response = await fetch(photo.dataUrl);
        const blob = await response.blob();

        // Generate unique filename
        const timestamp = new Date().getTime();
        const extension = photo.format === 'png' ? 'png' : 'jpg';
        const filePath = `${userId}/${record.id}/${photo.category}_${timestamp}.${extension}`;

        // Upload to Supabase Storage
        const { data, error: uploadError } = await supabase.storage
          .from('weighing-photos')
          .upload(filePath, blob, {
            contentType: `image/${extension}`,
            upsert: false,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('weighing-photos')
          .getPublicUrl(data.path);

        photoUrls[photo.category] = urlData.publicUrl;
      } catch (err) {
        console.error('Photo upload error:', err);
      }
    }

    return photoUrls;
  };

  const syncToDatabase = async (record: WeighingRecord): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        return false;
      }

      // Upload photos first
      const photoUrls = await uploadPhotos(record, user.id);

      const { error } = await supabase
        .from('weighing_records')
        .insert({
          id: record.id,
          user_id: user.id,
          // Identification
          ticket_number: record.ticketNumber || null,
          vehicle_plate: record.vehiclePlate,
          vehicle_type: record.vehicleType || null,
          driver_name: record.driverName || null,
          supplier: record.supplier || null,
          origin: record.origin || null,
          // Product
          product: record.product || null,
          harvest: record.harvest || null,
          destination: record.destination || null,
          // Weighing
          gross_weight: record.grossWeight,
          tare_weight: record.tareWeight,
          net_weight: record.netWeight,
          scale_number: record.scaleNumber || null,
          entry_time: record.entryTime?.toISOString() || null,
          exit_time: record.exitTime?.toISOString() || null,
          status: record.status || 'completed',
          // Weight method
          weight_method: record.weightMethod || 'scale',
          is_estimated: record.isEstimated || false,
          estimated_reason: record.estimatedReason || null,
          // Additional
          notes: record.notes || null,
          created_offline: record.createdOffline,
          synced_at: new Date().toISOString(),
          created_at: record.timestamp.toISOString(),
          photo_urls: photoUrls,
        } as any);

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
    
    // Filter out offline records - they require manager approval before syncing
    const recordsToSync = pendingRecords.filter(r => !r.createdOffline);
    
    if (recordsToSync.length === 0) {
      const offlineCount = pendingRecords.filter(r => r.createdOffline).length;
      if (offlineCount > 0) {
        toast.info(`${offlineCount} registro(s) offline aguardando aprovação do gestor`);
      } else {
        toast.info('Nenhum registro pendente para sincronizar');
      }
      return;
    }

    isSyncing.current = true;
    setConnectionStatus('syncing');
    setSyncQueue(prev => ({ ...prev, isProcessing: true }));

    toast.info(`Sincronizando ${recordsToSync.length} registro(s)...`);

    let successCount = 0;
    let errorCount = 0;

    for (const record of recordsToSync) {
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
      console.log('Cannot sync - offline');
      return false;
    }

    // Retry finding the record a few times
    let record = null;
    let attempts = 0;
    const maxAttempts = 5;
    
    while (!record && attempts < maxAttempts) {
      const pendingRecords = getPendingRecords();
      record = pendingRecords.find(r => r.id === recordId);
      
      if (!record) {
        attempts++;
        console.log(`Record not found, attempt ${attempts}/${maxAttempts}:`, recordId);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    if (!record) {
      console.log('Record not found after retries:', recordId);
      return false;
    }

    // Block sync for offline records - they require manager approval
    if (record.createdOffline) {
      toast.info('Registros offline precisam de aprovação do gestor antes de sincronizar');
      return false;
    }

    console.log('Syncing record:', recordId);
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
