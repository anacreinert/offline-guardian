import { Scale, Wifi, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface DailySummary {
  totalRecords: number;
  totalNetWeight: number;
  offlineRecords: number;
  pendingApproval: number;
  approvedRecords: number;
  rejectedRecords: number;
}

interface DailyReportSummaryProps {
  summary: DailySummary;
  isLoading: boolean;
}

export function DailyReportSummary({ summary, isLoading }: DailyReportSummaryProps) {
  const cards = [
    {
      title: 'Total de Pesagens',
      value: summary.totalRecords,
      suffix: '',
      icon: Scale,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Peso Total Líquido',
      value: summary.totalNetWeight.toLocaleString('pt-BR'),
      suffix: 'kg',
      icon: Scale,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Pendentes',
      value: summary.pendingApproval,
      suffix: '',
      icon: Clock,
      color: 'text-status-syncing',
      bgColor: 'bg-status-syncing/10',
    },
    {
      title: 'Aprovadas',
      value: summary.approvedRecords,
      suffix: '',
      icon: CheckCircle,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'Rejeitadas',
      value: summary.rejectedRecords,
      suffix: '',
      icon: XCircle,
      color: 'text-destructive',
      bgColor: 'bg-destructive/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((card, index) => (
        <Card key={index} className="overflow-hidden">
          <CardContent className="p-4">
            {isLoading ? (
              <div className="space-y-2">
                <div className="h-8 w-8 bg-muted animate-pulse rounded-lg" />
                <div className="h-6 w-16 bg-muted animate-pulse rounded" />
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </div>
            ) : (
              <>
                <div className={`w-10 h-10 rounded-xl ${card.bgColor} flex items-center justify-center mb-3`}>
                  <card.icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <div className="text-2xl font-bold">
                  {card.value}
                  {card.suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{card.suffix}</span>}
                </div>
                <div className="text-sm text-muted-foreground">{card.title}</div>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
