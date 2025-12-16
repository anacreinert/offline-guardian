import { useState } from 'react';
import { RefreshCw, Trash2, AlertCircle, Truck, Scale, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { PhotoViewer } from '@/components/PhotoViewer';
import { cn } from '@/lib/utils';

interface PhotoUrls {
  vehiclePlate?: string;
  tare?: string;
  product?: string;
}

interface SyncErrorRecord {
  id: string;
  vehicle_plate: string;
  driver_name: string | null;
  product: string | null;
  gross_weight: number;
  tare_weight: number;
  net_weight: number;
  created_at: string;
  photo_urls: PhotoUrls | null;
  sync_error?: string;
  sync_attempts?: number;
}

interface SyncErrorManagerProps {
  records: SyncErrorRecord[];
  onRetrySync: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
  isLoading?: boolean;
}

export function SyncErrorManager({ 
  records, 
  onRetrySync, 
  onDelete,
  isLoading 
}: SyncErrorManagerProps) {
  const [selectedRecord, setSelectedRecord] = useState<SyncErrorRecord | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRetrySync = async (record: SyncErrorRecord) => {
    setIsProcessing(true);
    try {
      await onRetrySync(record.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = () => {
    if (!selectedRecord) return;
    onDelete(selectedRecord.id);
    setShowDeleteDialog(false);
    setSelectedRecord(null);
  };

  const openDeleteDialog = (record: SyncErrorRecord) => {
    setSelectedRecord(record);
    setShowDeleteDialog(true);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (records.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum registro com erro de sincronização</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Registros com Erro de Sincronização
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Estes registros existem apenas localmente e não foram sincronizados ao banco de dados.
          </p>
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className="p-4 rounded-lg border bg-card"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="font-mono font-semibold">{record.vehicle_plate}</span>
                      </div>
                      {record.product && (
                        <Badge variant="secondary">{record.product}</Badge>
                      )}
                      <Badge variant="outline" className="text-status-offline border-status-offline">
                        Local
                      </Badge>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Scale className="w-3.5 h-3.5" />
                        <span>{record.net_weight.toLocaleString('pt-BR')} kg</span>
                      </div>
                      <span>
                        {format(new Date(record.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>

                    {record.sync_error && (
                      <div className="mt-2 p-2 rounded bg-destructive/10 text-sm text-destructive">
                        <span className="font-medium">Erro:</span> {record.sync_error}
                      </div>
                    )}

                    {record.photo_urls && (
                      <div className="mt-3">
                        <PhotoViewer photoUrls={record.photo_urls} vehiclePlate={record.vehicle_plate} />
                      </div>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={isProcessing}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-popover border">
                      <DropdownMenuItem 
                        onClick={() => handleRetrySync(record)}
                        className="gap-2"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Tentar Sincronizar
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => openDeleteDialog(record)}
                        className="gap-2 text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Registro Local</AlertDialogTitle>
            <AlertDialogDescription>
              Este registro existe apenas localmente e não foi sincronizado ao banco de dados.
              Ao excluir, ele será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {selectedRecord && (
            <div className="py-2">
              <div className="p-3 rounded-lg bg-muted text-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Truck className="w-4 h-4" />
                  {selectedRecord.vehicle_plate}
                </div>
                <div className="mt-1 text-muted-foreground">
                  {selectedRecord.net_weight.toLocaleString('pt-BR')} kg • {selectedRecord.product || 'Sem produto'}
                </div>
              </div>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
