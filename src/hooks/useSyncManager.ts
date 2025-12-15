import { useCallback, useRef } from 'react';
import { WeighingRecord } from '@/types/weighing';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface SyncManagerOptions {
  getPendingRecords: () => WeighingRecord[];
  updateRecordSyncStatus: (id: string, status: WeighingRecord['syncStatus'], error?: string) => void;
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

  const syncToDatabase = async (record: WeighingRecord): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        console.error('User not authenticated');
        return { success: false, error: 'Usuário não autenticado' };
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
          // Set status based on whether it was created offline
          status: record.createdOffline ? 'pending_approval' : (record.status || 'completed'),
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
          return { success: true };
        }
        console.error('Error syncing record:', error);
        return { success: false, error: error.message || `Erro: ${error.code}` };
      }

      console.log('Record synced successfully:', record.id);
      return { success: true };
    } catch (err: any) {
      console.error('Error syncing record:', err);
      return { success: false, error: err?.message || 'Erro desconhecido' };
    }
  };

  const syncRecord = useCallback(async (record: WeighingRecord): Promise<{ success: boolean; error?: string }> => {
    updateRecordSyncStatus(record.id, 'syncing');
    
    try {
      const result = await syncToDatabase(record);
      
      if (result.success) {
        updateRecordSyncStatus(record.id, 'synced');
        return { success: true };
      } else {
        updateRecordSyncStatus(record.id, 'error', result.error);
        return { success: false, error: result.error };
      }
    } catch (err: any) {
      const errorMsg = err?.message || 'Erro desconhecido';
      updateRecordSyncStatus(record.id, 'error', errorMsg);
      return { success: false, error: errorMsg };
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
    
    // Sync all pending records (including offline - they go with pending_approval status)
    const recordsToSync = pendingRecords;
    
    if (recordsToSync.length === 0) {
      toast.info('Nenhum registro pendente para sincronizar');
      return;
    }

    isSyncing.current = true;
    setConnectionStatus('syncing');
    setSyncQueue(prev => ({ ...prev, isProcessing: true }));

    toast.info(`Sincronizando ${recordsToSync.length} registro(s)...`);

    let successCount = 0;
    let errorCount = 0;

    for (const record of recordsToSync) {
      const result = await syncRecord(record);
      if (result.success) {
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

    // Offline records will be synced with pending_approval status
    if (record.createdOffline) {
      console.log('Syncing offline record (will require manager approval):', recordId);
    }

    console.log('Syncing record:', recordId);
    setSyncQueue(prev => ({ ...prev, isProcessing: true }));
    const result = await syncRecord(record);
    setSyncQueue(prev => ({ 
      ...prev, 
      isProcessing: false,
      lastSyncTime: new Date(),
    }));

    if (result.success) {
      toast.success('Registro sincronizado com sucesso!');
    } else {
      toast.error(result.error || 'Falha ao sincronizar registro');
    }

    return result.success;
  }, [getPendingRecords, syncRecord, setSyncQueue, isOnline]);

  return {
    syncAll,
    syncSingle,
    isSyncing: isSyncing.current,
  };
}
