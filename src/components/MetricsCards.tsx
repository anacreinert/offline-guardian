import { useState } from 'react';
import { Scale, Wifi, Clock, TrendingUp, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { WeighingRecord } from '@/types/weighing';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface MetricsCardsProps {
  totalRecordsToday: number;
  offlineRecordsToday: number;
  pendingSyncCount: number;
  errorCount?: number;
  lastSyncTime?: Date;
  records?: WeighingRecord[];
}

export function MetricsCards({
  totalRecordsToday,
  offlineRecordsToday,
  pendingSyncCount,
  errorCount = 0,
  lastSyncTime,
  records = [],
}: MetricsCardsProps) {
  const [showErrorDialog, setShowErrorDialog] = useState(false);

  const errorRecords = records.filter(r => r.syncStatus === 'error');

  const metrics = [
    {
      label: 'Pesagens Hoje',
      value: totalRecordsToday,
      icon: Scale,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
      clickable: false,
    },
    {
      label: 'Registros Offline',
      value: offlineRecordsToday,
      icon: Wifi,
      color: 'text-status-offline',
      bgColor: 'bg-status-offline/10',
      clickable: false,
    },
    {
      label: 'Pendentes Sinc.',
      value: pendingSyncCount,
      icon: Clock,
      color: pendingSyncCount > 0 ? 'text-status-offline' : 'text-status-online',
      bgColor: pendingSyncCount > 0 ? 'bg-status-offline/10' : 'bg-status-online/10',
      clickable: errorCount > 0,
      onClick: () => errorCount > 0 && setShowErrorDialog(true),
      subLabel: errorCount > 0 ? `${errorCount} com erro` : undefined,
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
      clickable: false,
    },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              onClick={metric.onClick}
              className={cn(
                "metric-card animate-fade-in",
                metric.clickable && "cursor-pointer hover:scale-[1.02] hover:shadow-lg transition-all duration-200"
              )}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className={cn('p-2.5 rounded-xl', metric.bgColor)}>
                  <Icon className={cn('w-5 h-5', metric.color)} />
                </div>
                {metric.subLabel && (
                  <span className="text-xs text-status-error font-medium bg-status-error/10 px-2 py-1 rounded-full">
                    {metric.subLabel}
                  </span>
                )}
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

      {/* Error Details Dialog */}
      <Dialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-status-error">
              <AlertCircle className="w-5 h-5" />
              Erros de Sincronização ({errorRecords.length})
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-3">
              {errorRecords.map(record => (
                <div 
                  key={record.id} 
                  className="p-3 rounded-lg bg-destructive/5 border border-destructive/20"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono font-semibold">{record.vehiclePlate}</span>
                    {record.ticketNumber && (
                      <span className="text-xs text-muted-foreground">#{record.ticketNumber}</span>
                    )}
                  </div>
                  {record.syncError && (
                    <p className="text-sm text-destructive">{record.syncError}</p>
                  )}
                  {record.syncAttempts > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {record.syncAttempts} tentativa(s)
                    </p>
                  )}
                </div>
              ))}
              {errorRecords.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum erro de sincronização
                </p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
