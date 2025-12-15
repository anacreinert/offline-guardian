import { Scale, Wifi, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricsCardsProps {
  totalRecordsToday: number;
  offlineRecordsToday: number;
  pendingSyncCount: number;
  lastSyncTime?: Date;
}

export function MetricsCards({
  totalRecordsToday,
  offlineRecordsToday,
  pendingSyncCount,
  lastSyncTime,
}: MetricsCardsProps) {
  const metrics = [
    {
      label: 'Pesagens Hoje',
      value: totalRecordsToday,
      icon: Scale,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      label: 'Registros Offline',
      value: offlineRecordsToday,
      icon: Wifi,
      color: 'text-status-offline',
      bgColor: 'bg-status-offline/10',
    },
    {
      label: 'Pendentes Sinc.',
      value: pendingSyncCount,
      icon: Clock,
      color: pendingSyncCount > 0 ? 'text-status-offline' : 'text-status-online',
      bgColor: pendingSyncCount > 0 ? 'bg-status-offline/10' : 'bg-status-online/10',
    },
    {
      label: 'Última Sincronização',
      value: lastSyncTime 
        ? lastSyncTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        : '--:--',
      icon: TrendingUp,
      color: 'text-accent',
      bgColor: 'bg-accent/10',
      isTime: true,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <div
            key={metric.label}
            className="metric-card animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className={cn('p-2.5 rounded-xl', metric.bgColor)}>
                <Icon className={cn('w-5 h-5', metric.color)} />
              </div>
            </div>
            <p className={cn(
              'text-3xl font-bold font-mono mb-1',
              metric.isTime ? 'text-foreground' : metric.color
            )}>
              {metric.value}
            </p>
            <p className="text-sm text-muted-foreground">{metric.label}</p>
          </div>
        );
      })}
    </div>
  );
}
