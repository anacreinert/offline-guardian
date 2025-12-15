import { useState, useEffect, useCallback } from 'react';
import { WeighingRecord, SyncQueue } from '@/types/weighing';

const STORAGE_KEY = 'weighing_records';
const SYNC_QUEUE_KEY = 'sync_queue';

export function useLocalStorage() {
  const [records, setRecords] = useState<WeighingRecord[]>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueue>({
    pendingCount: 0,
    isProcessing: false,
  });

  // Load records from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const records = parsed.map((r: WeighingRecord) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          lastSyncAttempt: r.lastSyncAttempt ? new Date(r.lastSyncAttempt) : undefined,
        }));
        setRecords(records);
        
        // Update sync queue count
        const pendingCount = records.filter(
          (r: WeighingRecord) => r.syncStatus === 'pending' || r.syncStatus === 'error'
        ).length;
        setSyncQueue(prev => ({ ...prev, pendingCount }));
      }
    } catch (error) {
      console.error('Error loading records from localStorage:', error);
    }
  }, []);

  // Save records to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (error) {
      console.error('Error saving records to localStorage:', error);
    }
  }, [records]);

  const addRecord = useCallback((record: Omit<WeighingRecord, 'id' | 'timestamp' | 'syncStatus' | 'syncAttempts' | 'createdOffline'>, isOffline: boolean) => {
    const newRecord: WeighingRecord = {
      ...record,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      syncStatus: isOffline ? 'pending' : 'synced',
      syncAttempts: 0,
      createdOffline: isOffline,
    };

    setRecords(prev => [newRecord, ...prev]);
    
    if (isOffline) {
      setSyncQueue(prev => ({
        ...prev,
        pendingCount: prev.pendingCount + 1,
      }));
    }

    return newRecord;
  }, []);

  const updateRecordSyncStatus = useCallback((id: string, syncStatus: WeighingRecord['syncStatus']) => {
    setRecords(prev => 
      prev.map(record => 
        record.id === id 
          ? { 
              ...record, 
              syncStatus,
              syncAttempts: record.syncAttempts + 1,
              lastSyncAttempt: new Date(),
            } 
          : record
      )
    );

    // Update pending count
    setSyncQueue(prev => {
      const newCount = syncStatus === 'synced' || syncStatus === 'syncing'
        ? Math.max(0, prev.pendingCount - 1)
        : prev.pendingCount;
      return { ...prev, pendingCount: newCount };
    });
  }, []);

  const getPendingRecords = useCallback(() => {
    return records.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'error');
  }, [records]);

  const getTodayRecords = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return records.filter(r => new Date(r.timestamp) >= today);
  }, [records]);

  const clearSyncedRecords = useCallback((olderThanDays: number = 30) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - olderThanDays);
    
    setRecords(prev => 
      prev.filter(r => 
        r.syncStatus !== 'synced' || new Date(r.timestamp) > cutoff
      )
    );
  }, []);

  return {
    records,
    syncQueue,
    addRecord,
    updateRecordSyncStatus,
    getPendingRecords,
    getTodayRecords,
    clearSyncedRecords,
    setSyncQueue,
  };
}
