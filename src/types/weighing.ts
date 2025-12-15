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

export type VehicleType = 'truck' | 'carreta' | 'bitrem' | 'rodotrem' | 'outros';

export type WeighingStatus = 'entry' | 'processing' | 'exit' | 'completed';

export const VEHICLE_TYPES: { value: VehicleType; label: string }[] = [
  { value: 'truck', label: 'Truck' },
  { value: 'carreta', label: 'Carreta' },
  { value: 'bitrem', label: 'Bitrem' },
  { value: 'rodotrem', label: 'Rodotrem' },
  { value: 'outros', label: 'Outros' },
];

export const HARVESTS = [
  '2024/2025',
  '2025/2026',
];

export interface WeighingRecord {
  id: string;
  timestamp: Date;
  // Identification
  ticketNumber?: string;
  vehiclePlate: string;
  vehicleType?: VehicleType;
  driverName: string;
  supplier?: string;
  origin: string;
  // Product
  product: string;
  harvest?: string;
  destination: string;
  // Weighing
  grossWeight: number;
  tareWeight: number;
  netWeight: number;
  scaleNumber?: string;
  entryTime?: Date;
  exitTime?: Date;
  status?: WeighingStatus;
  // Additional
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
