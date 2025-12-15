export type ConnectionStatus = 'online' | 'offline' | 'syncing' | 'error';

export type SyncStatus = 'pending' | 'syncing' | 'synced' | 'error';

export type PhotoCategory = 'vehiclePlate' | 'tare' | 'product';

export type WeightMethod = 'scale' | 'display_ocr' | 'estimated';

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

// Vehicle load capacity in kg (loadCapacity = max cargo, avgTare = average empty weight)
export const VEHICLE_CAPACITIES: Record<VehicleType, { loadCapacity: number; avgTare: number }> = {
  truck: { loadCapacity: 14000, avgTare: 6000 },
  carreta: { loadCapacity: 28000, avgTare: 14000 },
  bitrem: { loadCapacity: 40000, avgTare: 20000 },
  rodotrem: { loadCapacity: 50000, avgTare: 25000 },
  outros: { loadCapacity: 14000, avgTare: 6000 },
};

// Product load factors (% of max capacity typically used)
export const PRODUCT_LOAD_FACTORS: Record<string, number> = {
  'Soja': 0.95,
  'Milho': 0.90,
  'Trigo': 0.92,
  'Sorgo': 0.88,
  'Café': 0.80,
  'Feijão': 0.85,
  'Arroz': 0.90,
};

export const WEIGHT_METHOD_LABELS: Record<WeightMethod, string> = {
  scale: 'Balança',
  display_ocr: 'Foto do Display',
  estimated: 'Peso Estimado',
};

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
  // Weight method
  weightMethod?: WeightMethod;
  isEstimated?: boolean;
  estimatedReason?: string;
  // Additional
  notes?: string;
  photos?: PhotoData[];
  photoUrls?: PhotoUrls;
  syncStatus: SyncStatus;
  syncError?: string;
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
