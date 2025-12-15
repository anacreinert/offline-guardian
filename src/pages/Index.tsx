import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Database } from 'lucide-react';
import { StatusBanner } from '@/components/StatusBanner';
import { WeighingForm } from '@/components/WeighingForm';
import { RecordsList } from '@/components/RecordsList';
import { MetricsCards } from '@/components/MetricsCards';
import { UserMenu } from '@/components/UserMenu';
import { useConnectionStatus } from '@/hooks/useConnectionStatus';
import { useWeighingRecords } from '@/hooks/useWeighingRecords';
import { useSyncManager } from '@/hooks/useSyncManager';
import { useAuth } from '@/hooks/useAuth';

const Index = () => {
  const navigate = useNavigate();
  const { isAuthenticated, loading, profile } = useAuth();
  
  const { 
    status, 
    isOffline, 
    setStatus,
    isSimulatedOffline,
    toggleSimulatedOffline,
  } = useConnectionStatus();
  
  const {
    records,
    syncQueue,
    addRecord,
    updateRecordSyncStatus,
    getPendingRecords,
    getTodayRecords,
    setSyncQueue,
    refreshRecords,
  } = useWeighingRecords();

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

  // Redirect to auth if not authenticated
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/auth');
    }
  }, [isAuthenticated, loading, navigate]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (!isOffline && syncQueue.pendingCount > 0 && !syncQueue.isProcessing) {
      // Small delay to ensure stable connection
      const timer = setTimeout(async () => {
        await syncAll();
        // Refresh records from database after sync
        refreshRecords();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOffline, syncQueue.pendingCount, syncQueue.isProcessing, syncAll, refreshRecords]);

  const handleSubmit = async (data: Parameters<typeof addRecord>[0]) => {
    const newRecord = addRecord(data, isOffline);
    
    // If online, immediately sync the new record
    if (!isOffline) {
      // Small delay to ensure record is in state
      setTimeout(async () => {
        await syncSingle(newRecord.id);
        // Refresh to get updated records
        refreshRecords();
      }, 100);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <StatusBanner
        status={status}
        pendingCount={syncQueue.pendingCount}
        lastSyncTime={syncQueue.lastSyncTime}
        onManualSync={syncAll}
        isSyncing={syncQueue.isProcessing}
        isSimulatedOffline={isSimulatedOffline}
        onToggleSimulatedOffline={toggleSimulatedOffline}
      />

      <main className="container mx-auto px-4 pt-24 pb-8">
        {/* Header */}
        <div className="mb-8 animate-fade-in">
          <div className="flex items-center justify-between">
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
            <UserMenu />
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
