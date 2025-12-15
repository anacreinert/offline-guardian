import { useState, useEffect } from 'react';
import { Scale, Database } from 'lucide-react';
import { StatusBanner } from '@/components/StatusBanner';
import { WeighingForm } from '@/components/WeighingForm';
import { RecordsList } from '@/components/RecordsList';
import { MetricsCards } from '@/components/MetricsCards';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useSyncManager } from '@/hooks/useSyncManager';

const Index = () => {
  const { 
    status, 
    isOffline, 
    setStatus 
  } = useConnectionStatus();
  
  const {
    records,
    syncQueue,
    addRecord,
    updateRecordSyncStatus,
    getPendingRecords,
    getTodayRecords,
    setSyncQueue,
  } = useLocalStorage();

  const { syncAll, syncSingle } = useSyncManager({
    getPendingRecords,
    updateRecordSyncStatus,
    setSyncQueue,
    setConnectionStatus: setStatus,
    isOnline: !isOffline,
  });

  const [recordsFilter, setRecordsFilter] = useState<'all' | 'pending' | 'synced' | 'error'>('all');

  const todayRecords = getTodayRecords();
  const offlineRecordsToday = todayRecords.filter(r => r.createdOffline).length;

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOffline && syncQueue.pendingCount > 0 && !syncQueue.isProcessing) {
      // Small delay to ensure stable connection
      const timer = setTimeout(() => {
        syncAll();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, syncQueue.pendingCount, syncQueue.isProcessing, syncAll]);

  const handleSubmit = (data: Parameters<typeof addRecord>[0]) => {
    addRecord(data, isOffline);
  };

  return (
    <div className="min-h-screen bg-background">
      <StatusBanner
        status={status}
        pendingCount={syncQueue.pendingCount}
        lastSyncTime={syncQueue.lastSyncTime}
        onManualSync={syncAll}
        isSyncing={syncQueue.isProcessing}
      />

      <main className="container mx-auto px-4 pt-24 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 rounded-2xl bg-primary/10">
              <Scale className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                Módulo de Pesagem
              </h1>
              <p className="text-muted-foreground flex items-center gap-2">
                <Database className="w-4 h-4" />
                Continuidade Operacional com Sincronização Offline
              </p>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="mb-8">
          <MetricsCards
            totalRecordsToday={todayRecords.length}
            offlineRecordsToday={offlineRecordsToday}
            pendingSyncCount={syncQueue.pendingCount}
            lastSyncTime={syncQueue.lastSyncTime}
          />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Form */}
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <WeighingForm isOffline={isOffline} onSubmit={handleSubmit} />
          </div>

          {/* Records List */}
          <div className="animate-fade-in" style={{ animationDelay: '300ms' }}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-semibold">Registros Recentes</h2>
            </div>
            <RecordsList
              records={records}
              onRetrySingle={syncSingle}
              filter={recordsFilter}
              onFilterChange={setRecordsFilter}
            />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;
