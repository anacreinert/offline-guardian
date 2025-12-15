import { Wifi, WifiOff, RefreshCw, AlertTriangle, ToggleLeft, ToggleRight } from 'lucide-react';
import { ConnectionStatus } from '@/types/weighing';
import { cn } from '@/lib/utils';

interface StatusBannerProps {
  status: ConnectionStatus;
  pendingCount: number;
  lastSyncTime?: Date;
  onManualSync: () => void;
  isSyncing: boolean;
  isSimulatedOffline?: boolean;
  onToggleSimulatedOffline?: () => void;
}

const statusConfig = {
  online: {
    icon: Wifi,
    label: 'Online',
    sublabel: 'Sistema sincronizado',
    dotClass: 'status-dot-online',
    bgClass: 'bg-status-online/10 border-status-online/30',
    textClass: 'text-status-online',
  },
  offline: {
    icon: WifiOff,
    label: 'Offline',
    sublabel: 'Modo local ativo',
    dotClass: 'status-dot-offline',
    bgClass: 'bg-status-offline/10 border-status-offline/30',
    textClass: 'text-status-offline',
  },
  syncing: {
    icon: RefreshCw,
    label: 'Sincronizando',
    sublabel: 'Enviando dados...',
    dotClass: 'status-dot-syncing',
    bgClass: 'bg-status-syncing/10 border-status-syncing/30',
    textClass: 'text-status-syncing',
  },
  error: {
    icon: AlertTriangle,
    label: 'Erro na Sincronização',
    sublabel: 'Tentativas falharam',
    dotClass: 'status-dot-error',
    bgClass: 'bg-status-error/10 border-status-error/30',
    textClass: 'text-status-error',
  },
};

export function StatusBanner({ 
  status, 
  pendingCount, 
  lastSyncTime, 
  onManualSync,
  isSyncing,
  isSimulatedOffline,
  onToggleSimulatedOffline,
}: StatusBannerProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <header className={cn(
      'fixed top-0 left-0 right-0 z-50 border-b px-4 py-3 backdrop-blur-xl',
      config.bgClass
    )}>
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="status-indicator">
            <span className={cn('status-dot', config.dotClass)} />
            <Icon className={cn('w-5 h-5', config.textClass, status === 'syncing' && 'animate-spin')} />
          </div>
          
          <div className="flex flex-col">
            <span className={cn('font-semibold text-sm', config.textClass)}>
              {config.label}
              {isSimulatedOffline && status === 'offline' && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">(Simulado)</span>
              )}
            </span>
            <span className="text-xs text-muted-foreground">
              {config.sublabel}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Simulated Offline Toggle */}
          {onToggleSimulatedOffline && (
            <button
              onClick={onToggleSimulatedOffline}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium',
                'border transition-all duration-200',
                isSimulatedOffline
                  ? 'bg-status-offline/20 text-status-offline border-status-offline/30'
                  : 'bg-muted/50 text-muted-foreground border-border hover:bg-muted'
              )}
              title="Simular modo offline para testes"
            >
              {isSimulatedOffline ? (
                <ToggleRight className="w-4 h-4" />
              ) : (
                <ToggleLeft className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">
                {isSimulatedOffline ? 'Offline Ativo' : 'Testar Offline'}
              </span>
            </button>
          )}

          {pendingCount > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground hidden sm:inline">Pendentes:</span>
              <span className={cn(
                'px-2 py-0.5 rounded-full font-mono font-semibold',
                'bg-status-offline/20 text-status-offline'
              )}>
                {pendingCount}
              </span>
            </div>
          )}

          {lastSyncTime && (
            <div className="hidden lg:flex items-center gap-2 text-xs text-muted-foreground">
              <span>Última sinc.:</span>
              <span className="font-mono">
                {lastSyncTime.toLocaleTimeString('pt-BR')}
              </span>
            </div>
          )}

          <button
            onClick={onManualSync}
            disabled={isSyncing || pendingCount === 0}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium',
              'bg-primary/10 text-primary border border-primary/30',
              'hover:bg-primary/20 transition-all duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isSyncing && 'animate-pulse'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', isSyncing && 'animate-spin')} />
            <span className="hidden sm:inline">
              {isSyncing ? 'Sincronizando...' : 'Forçar Sinc.'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
