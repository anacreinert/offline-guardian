import { useState, useEffect, useCallback, useRef } from 'react';
import { WeighingRecord, SyncQueue } from '@/types/weighing';

const STORAGE_KEY = 'weighing_records';

export function useLocalStorage() {
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

  // Load records from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Convert date strings back to Date objects
        const loadedRecords = parsed.map((r: WeighingRecord) => ({
          ...r,
          timestamp: new Date(r.timestamp),
          lastSyncAttempt: r.lastSyncAttempt ? new Date(r.lastSyncAttempt) : undefined,
        }));
        setRecords(loadedRecords);
        recordsRef.current = loadedRecords;
        
        // Update sync queue count
        const pendingCount = loadedRecords.filter(
          (r: WeighingRecord) => r.syncStatus === 'pending' || r.syncStatus === 'error'
        ).length;
        setSyncQueue(prev => ({ ...prev, pendingCount }));
      }
    } catch (error) {
      console.error('Error loading records from localStorage:', error);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save records to localStorage whenever they change (only after initial load)
  useEffect(() => {
    if (!isLoaded) return;
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
      console.log('Records saved to localStorage:', records.length);
    } catch (error) {
      console.error('Error saving records to localStorage:', error);
    }
  }, [records, isLoaded]);

  const addRecord = useCallback((record: Omit<WeighingRecord, 'id' | 'timestamp' | 'syncStatus' | 'syncAttempts' | 'createdOffline'>, isOffline: boolean) => {
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
      // Immediately update ref for sync access
      recordsRef.current = updated;
      // Force immediate save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        console.log('Record added and saved immediately:', newRecord.id);
      } catch (error) {
        console.error('Error saving new record:', error);
      }
      return updated;
    });
    
    setSyncQueue(prev => ({
      ...prev,
      pendingCount: prev.pendingCount + 1,
    }));

    return newRecord;
  }, []);

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
      // Force immediate save
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (error) {
        console.error('Error saving record status update:', error);
      }
      return updated;
    });

    // Update pending count only when synced successfully
    if (syncStatus === 'synced') {
      setSyncQueue(prev => ({
        ...prev,
        pendingCount: Math.max(0, prev.pendingCount - 1),
      }));
    }
  }, []);

  const getPendingRecords = useCallback(() => {
    // Use ref for immediate access
    return recordsRef.current.filter(r => r.syncStatus === 'pending' || r.syncStatus === 'error');
  }, []);

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
    isLoaded,
  };
}
