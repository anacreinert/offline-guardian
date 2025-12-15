export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'error';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export type PhotoCategory = 'vehiclePlate' | 'tare' | 'product';

export interface PhotoData {
  dataUrl: string;
  format: string;
  timestamp: Date;
  category: PhotoCategory;
}

export interface PhotoUrls {
  vehiclePlate?: string;
  tare?: string;
  product?: string;
}

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
  photos?: PhotoData[];
  photoUrls?: PhotoUrls;
  syncStatus: SyncStatus;
  syncAttempts: number;
  lastSyncAttempt?: Date;
  createdOffline: boolean;
  approvedAt?: Date;
  approvedBy?: string;
  rejectedAt?: Date;
  rejectedBy?: string;
  rejectionReason?: string;
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
