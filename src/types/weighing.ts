export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'error';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export interface WeighingRecord {
  id: string;
  timestamp: Date;
  vehiclePlate: string;
  driverName: string;
  product: string;
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  origin: string;
  destination: string;
  notes?: string;
  syncStatus: SyncStatus;
  syncAttempts: number;
  lastSyncAttempt?: Date;
  createdOffline: boolean;
}

export interface SyncQueue {
  pendingCount: number;
  lastSyncTime?: Date;
  isProcessing: boolean;
}

export interface DashboardMetrics {
  totalRecordsToday: number;
  offlineRecordsToday: number;
  pendingSyncCount: number;
  avgSyncTime: number;
  successRate: number;
}
