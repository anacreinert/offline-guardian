import { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Truck, 
  Package, 
  Scale,
  ChevronDown,
  ChevronUp,
  Filter,
  Image,
  Hash,
  Building,
  Calendar,
  Gauge,
  Camera,
  AlertTriangle
} from 'lucide-react';
import { WeighingRecord, SyncStatus, VEHICLE_TYPES, WEIGHT_METHOD_LABELS } from '@/types/weighing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PhotoViewer } from '@/components/PhotoViewer';

interface RecordsListProps {
  records: WeighingRecord[];
  onRetrySingle: (id: string) => void;
  filter: 'all' | 'pending' | 'synced' | 'error';
  onFilterChange: (filter: 'all' | 'pending' | 'synced' | 'error') => void;
  maxRecords?: number;
}

const syncStatusConfig: Record<SyncStatus, { icon: typeof Clock; label: string; className: string }> = {
  pending: {
    icon: Clock,
    label: 'Pendente',
    className: 'text-status-offline bg-status-offline/10',
  },
  syncing: {
    icon: RefreshCw,
    label: 'Sincronizando',
    className: 'text-status-syncing bg-status-syncing/10',
  },
  synced: {
    icon: CheckCircle2,
    label: 'Sincronizado',
    className: 'text-status-online bg-status-online/10',
  },
  error: {
    icon: AlertCircle,
    label: 'Erro',
    className: 'text-status-error bg-status-error/10',
  },
};

const filters = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendentes' },
  { value: 'synced', label: 'Sincronizados' },
  { value: 'error', label: 'Com Erro' },
] as const;

export function RecordsList({ records, onRetrySingle, filter, onFilterChange, maxRecords }: RecordsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredRecords = records.filter(record => {
    if (filter === 'all') return true;
    return record.syncStatus === filter;
  });

  // Apply max records limit if specified
  const displayRecords = maxRecords ? filteredRecords.slice(0, maxRecords) : filteredRecords;

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (records.length === 0) {
    return (
      <div className="glass-panel p-8 text-center">
        <Scale className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">Nenhum registro de pesagem ainda</p>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden">
      {/* Filter Bar */}
      <div className="p-4 border-b border-border/50 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-muted-foreground" />
        {filters.map(f => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
            )}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {displayRecords.length}{maxRecords && filteredRecords.length > maxRecords ? `/${filteredRecords.length}` : ''} registro(s)
        </span>
      </div>

      {/* Records List */}
      <div className="divide-y divide-border/50">
        {displayRecords.map(record => {
          const statusConfig = syncStatusConfig[record.syncStatus];
          const StatusIcon = statusConfig.icon;
          const isExpanded = expandedId === record.id;
          const hasPhotos = record.photoUrls && Object.keys(record.photoUrls).length > 0;

          return (
            <div
              key={record.id}
              className={cn(
                'p-4 transition-all duration-200',
                'hover:bg-secondary/30',
                isExpanded && 'bg-secondary/20'
              )}
            >
              <div 
                className="flex items-center gap-4 cursor-pointer"
                onClick={() => toggleExpand(record.id)}
              >
                {/* Status Badge */}
                <div className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium',
                  statusConfig.className
                )}>
                  <StatusIcon className={cn(
                    'w-3.5 h-3.5',
                    record.syncStatus === 'syncing' && 'animate-spin'
                  )} />
                  {statusConfig.label}
                </div>

                {/* Main Info */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {record.ticketNumber && (
                    <span className="text-xs font-mono text-muted-foreground bg-secondary px-2 py-0.5 rounded">
                      {record.ticketNumber}
                    </span>
                  )}
                  {/* Weight Method Badge */}
                  {record.isEstimated && (
                    <span className="flex items-center gap-1 text-xs bg-status-syncing/20 text-status-syncing px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" />
                      EST
                    </span>
                  )}
                  {record.weightMethod === 'display_ocr' && !record.isEstimated && (
                    <span className="flex items-center gap-1 text-xs bg-blue-500/20 text-blue-500 px-2 py-0.5 rounded-full">
                      <Camera className="w-3 h-3" />
                      OCR
                    </span>
                  )}
                  <Truck className="w-5 h-5 text-muted-foreground shrink-0" />
                  <span className="font-mono font-semibold text-lg">
                    {record.vehiclePlate}
                  </span>
                  {hasPhotos && (
                    <Image className="w-4 h-4 text-primary shrink-0" />
                  )}
                  <span className="text-muted-foreground hidden sm:inline">•</span>
                  <span className="text-muted-foreground truncate hidden sm:inline">
                    {record.product || 'Sem produto'}
                  </span>
                </div>

                {/* Weight */}
                <div className="flex items-center gap-2 text-primary font-mono font-semibold">
                  <Scale className="w-4 h-4" />
                  {record.netWeight.toLocaleString('pt-BR')} kg
                </div>

                {/* Time */}
                <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                  {new Date(record.timestamp).toLocaleTimeString('pt-BR', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>

                {/* Expand Button */}
                <button className="p-1 hover:bg-secondary rounded">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </button>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="mt-4 pt-4 border-t border-border/50 animate-fade-in">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground block mb-1">Ticket</span>
                      <span className="font-mono font-medium">{record.ticketNumber || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Tipo Veículo</span>
                      <span className="font-medium">
                        {record.vehicleType 
                          ? VEHICLE_TYPES.find(t => t.value === record.vehicleType)?.label || record.vehicleType
                          : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Motorista</span>
                      <span className="font-medium">{record.driverName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Produtor/Fornecedor</span>
                      <span className="font-medium">{record.supplier || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Produto</span>
                      <span className="font-medium">{record.product || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Safra</span>
                      <span className="font-medium">{record.harvest || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Nº Balança</span>
                      <span className="font-mono">{record.scaleNumber || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Método Pesagem</span>
                      <span className={cn(
                        "font-medium",
                        record.isEstimated && "text-status-syncing",
                        record.weightMethod === 'display_ocr' && "text-blue-500"
                      )}>
                        {record.weightMethod ? WEIGHT_METHOD_LABELS[record.weightMethod] : 'Balança'}
                        {record.isEstimated && ' ⚠️'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Data</span>
                      <span className="font-mono">
                        {new Date(record.timestamp).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Peso Bruto (Entrada)</span>
                      <span className="font-mono">{record.grossWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Tara (Saída)</span>
                      <span className="font-mono">{record.tareWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Peso Líquido</span>
                      <span className="font-mono font-bold text-primary">{record.netWeight.toLocaleString('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} kg</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Origem</span>
                      <span>{record.origin || '-'}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block mb-1">Destino</span>
                      <span>{record.destination || '-'}</span>
                    </div>
                    <div className="md:col-span-3">
                      <span className="text-muted-foreground block mb-1">Observações</span>
                      <span>{record.notes || '-'}</span>
                    </div>
                  </div>

                  {/* Photo Viewer */}
                  {hasPhotos && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <PhotoViewer 
                        photoUrls={record.photoUrls} 
                        vehiclePlate={record.vehiclePlate} 
                      />
                    </div>
                  )}

                  {(record.syncStatus === 'pending' || record.syncStatus === 'error') && (
                    <div className="mt-4 flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetrySingle(record.id);
                        }}
                        className="gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Tentar Sincronizar
                      </Button>
                    </div>
                  )}

                  {/* Sync Error Message */}
                  {record.syncStatus === 'error' && record.syncError && (
                    <div className="mt-3 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                      <div className="flex items-start gap-2 text-sm text-destructive">
                        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-medium">Erro de sincronização:</span>
                          <p className="mt-0.5 text-destructive/90">{record.syncError}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {record.createdOffline && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-status-offline">
                      <AlertCircle className="w-3.5 h-3.5" />
                      Criado offline
                      {record.syncAttempts > 0 && (
                        <span>• {record.syncAttempts} tentativa(s)</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
