import { useState, useEffect, useCallback, useRef } from 'react';
import { WeighingRecord, SyncQueue } from '@/types/weighing';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

const STORAGE_KEY = 'weighing_records';

export function useWeighingRecords() {
  const { user, canAccessGestorFeatures } = useAuth();
  const [records, setRecords] = useState<WeighingRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueue>({
    pendingCount: 0,
    isProcessing: false,
  });
  const [isLoaded, setIsLoaded] = useState(false);
  const recordsRef = useRef<WeighingRecord[]>([]);

  // Keep ref in sync with state
  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  // Load records from localStorage (for offline support)
  const loadLocalRecords = useCallback((): WeighingRecord[] => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((r: WeighingRecord) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          lastSyncAttempt: r.lastSyncAttempt ? new Date(r.lastSyncAttempt) : undefined,
        }));
      }
    } catch (error) {
      console.error('Error loading records from localStorage:', error);
    }
    return [];
  }, []);

  // Save local records to localStorage
  const saveLocalRecords = useCallback((localRecords: WeighingRecord[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localRecords));
      console.log('Records saved to localStorage:', localRecords.length);
    } catch (error) {
      console.error('Error saving records to localStorage:', error);
    }
  }, []);

  // Fetch records from database
  const fetchDatabaseRecords = useCallback(async (): Promise<WeighingRecord[]> => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('weighing_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching records from database:', error);
        return [];
      }

      return (data || []).map(r => ({
        id: r.id,
        vehiclePlate: r.vehicle_plate,
        driverName: r.driver_name || undefined,
        product: r.product || undefined,
        grossWeight: Number(r.gross_weight),
        tareWeight: Number(r.tare_weight),
        netWeight: Number(r.net_weight),
        origin: r.origin || undefined,
        destination: r.destination || undefined,
        notes: r.notes || undefined,
        timestamp: new Date(r.created_at),
        syncStatus: 'synced' as const,
        syncAttempts: 0,
        createdOffline: r.created_offline || false,
        photoUrls: r.photo_urls as { vehiclePlate?: string; tare?: string; product?: string } | undefined,
        approvedAt: r.approved_at ? new Date(r.approved_at) : undefined,
        approvedBy: r.approved_by || undefined,
        rejectedAt: r.rejected_at ? new Date(r.rejected_at) : undefined,
        rejectedBy: r.rejected_by || undefined,
        rejectionReason: r.rejection_reason || undefined,
      }));
    } catch (error) {
      console.error('Error fetching records from database:', error);
      return [];
    }
  }, [user]);

  // Merge local and database records
  const mergeRecords = useCallback((localRecords: WeighingRecord[], dbRecords: WeighingRecord[]): WeighingRecord[] => {
    const mergedMap = new Map<string, WeighingRecord>();

    // Add database records first
    dbRecords.forEach(r => {
      mergedMap.set(r.id, r);
    });

    // Add/update with local records (local pending/error records take priority)
    localRecords.forEach(r => {
      const existing = mergedMap.get(r.id);
      if (!existing) {
        // Record only exists locally (pending sync)
        mergedMap.set(r.id, r);
      } else if (r.syncStatus === 'pending' || r.syncStatus === 'error') {
        // Keep local pending/error status
        mergedMap.set(r.id, r);
      }
      // If synced in both, database version is used
    });

    // Sort by timestamp descending
    return Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }, []);

  // Load all records (local + database)
  const loadAllRecords = useCallback(async () => {
    const localRecords = loadLocalRecords();
    const dbRecords = await fetchDatabaseRecords();
    
    const merged = mergeRecords(localRecords, dbRecords);
    setRecords(merged);
    recordsRef.current = merged;

    // Update pending count
    const pendingCount = merged.filter(
      r => r.syncStatus === 'pending' || r.syncStatus === 'error'
    ).length;

    // Find the most recent synced record timestamp for lastSyncTime
    const syncedRecords = merged.filter(r => r.syncStatus === 'synced');
    const lastSyncTime = syncedRecords.length > 0 
      ? new Date(Math.max(...syncedRecords.map(r => new Date(r.timestamp).getTime())))
      : undefined;

    setSyncQueue(prev => ({ ...prev, pendingCount, lastSyncTime }));

    setIsLoaded(true);
  }, [loadLocalRecords, fetchDatabaseRecords, mergeRecords]);

  // Initial load
  useEffect(() => {
    if (user) {
      loadAllRecords();
    } else {
      // If no user, just load local records
      const localRecords = loadLocalRecords();
      setRecords(localRecords);
      recordsRef.current = localRecords;
      
      const pendingCount = localRecords.filter(
        r => r.syncStatus === 'pending' || r.syncStatus === 'error'
      ).length;
      setSyncQueue(prev => ({ ...prev, pendingCount }));
      setIsLoaded(true);
    }
  }, [user, loadAllRecords, loadLocalRecords]);

  // Add a new record
  const addRecord = useCallback((
    record: Omit<WeighingRecord, 'id' | 'timestamp' | 'syncStatus' | 'syncAttempts' | 'createdOffline'>,
    isOffline: boolean
  ) => {
    const newRecord: WeighingRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      syncStatus: 'pending',
      syncAttempts: 0,
      createdOffline: isOffline,
    };

    setRecords(prev => {
      const updated = [newRecord, ...prev];
      recordsRef.current = updated;
      
      // Save only local pending records to localStorage
      const localRecords = updated.filter(
        r => r.syncStatus === 'pending' || r.syncStatus === 'error' || r.syncStatus === 'syncing'
      );
      saveLocalRecords(localRecords);
      
      return updated;
    });

    setSyncQueue(prev => ({
      ...prev,
      pendingCount: prev.pendingCount + 1,
    }));

    return newRecord;
  }, [saveLocalRecords]);

  // Update record sync status
  const updateRecordSyncStatus = useCallback((id: string, syncStatus: WeighingRecord['syncStatus']) => {
    setRecords(prev => {
      const updated = prev.map(record =>
        record.id === id
          ? {
              ...record,
              syncStatus,
              syncAttempts: record.syncAttempts + 1,
              lastSyncAttempt: new Date(),
            }
          : record
      );
      recordsRef.current = updated;

      // Save only pending records to localStorage
      const localRecords = updated.filter(
        r => r.syncStatus === 'pending' || r.syncStatus === 'error' || r.syncStatus === 'syncing'
      );
      saveLocalRecords(localRecords);

      return updated;
    });

    // Update pending count only when synced successfully
    if (syncStatus === 'synced') {
      setSyncQueue(prev => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
      }));
    }
  }, [saveLocalRecords]);

  // Get pending records (use ref for immediate access)
  const getPendingRecords = useCallback(() => {
    return recordsRef.current.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'error');
  }, []);

  // Get today's records
  const getTodayRecords = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return records.filter(r => new Date(r.timestamp) >= today);
  }, [records]);

  // Refresh records from database
  const refreshRecords = useCallback(async () => {
    await loadAllRecords();
  }, [loadAllRecords]);

  return {
    records,
    syncQueue,
    addRecord,
    updateRecordSyncStatus,
    getPendingRecords,
    getTodayRecords,
    setSyncQueue,
    refreshRecords,
    isLoaded,
  };
}
