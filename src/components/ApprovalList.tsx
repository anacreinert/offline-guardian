import { CheckCircle, Clock, Truck, Package, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface WeighingRecord {
  id: string;
  vehicle_plate: string;
  driver_name: string | null;
  product: string | null;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  origin: string | null;
  destination: string | null;
  notes: string | null;
  created_offline: boolean;
  synced_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  user_id: string;
}

interface ApprovalListProps {
  records: WeighingRecord[];
  onApprove: (id: string) => void;
  onApproveAll: () => void;
  isLoading: boolean;
}

export function ApprovalList({ records, onApprove, onApproveAll, isLoading }: ApprovalListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pesagens Offline Pendentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Pesagens Offline Pendentes
        </CardTitle>
        {records.length > 0 && (
          <Button onClick={onApproveAll} size="sm" className="gap-2">
            <CheckCircle className="w-4 h-4" />
            Aprovar Todos ({records.length})
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {records.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-status-synced opacity-50" />
            <p className="font-medium">Nenhuma pesagem pendente</p>
            <p className="text-sm mt-1">Todas as pesagens offline foram aprovadas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {records.map(record => (
              <div
                key={record.id}
                className="p-4 rounded-lg border border-status-syncing/30 bg-status-syncing/5 hover:bg-status-syncing/10 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span className="font-bold text-lg">{record.vehicle_plate}</span>
                      <Badge variant="secondary" className="bg-status-offline/20 text-status-offline text-xs">
                        Offline
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                      {record.driver_name && (
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium">Motorista:</span>
                          {record.driver_name}
                        </div>
                      )}
                      {record.product && (
                        <div className="flex items-center gap-1.5">
                          <Package className="w-3.5 h-3.5" />
                          {record.product}
                        </div>
                      )}
                      {(record.origin || record.destination) && (
                        <div className="flex items-center gap-1.5 col-span-full">
                          <MapPin className="w-3.5 h-3.5" />
                          {record.origin && <span>{record.origin}</span>}
                          {record.origin && record.destination && <span>→</span>}
                          {record.destination && <span>{record.destination}</span>}
                        </div>
                      )}
                      <div className="col-span-full text-xs">
                        Registrado em {format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right flex flex-col items-end gap-3">
                    <div>
                      <div className="text-xl font-bold text-primary">
                        {Number(record.net_weight).toLocaleString('pt-BR')} kg
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Peso Líquido
                      </div>
                    </div>
                    <Button 
                      size="sm" 
                      onClick={() => onApprove(record.id)}
                      className="gap-1.5"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Aprovar
                    </Button>
                  </div>
                </div>
                
                {record.notes && (
                  <div className="mt-3 pt-3 border-t text-sm text-muted-foreground">
                    <span className="font-medium">Observações:</span> {record.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
