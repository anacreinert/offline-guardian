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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  deletion_requested?: boolean;
  deletion_reason?: string;
}

interface SyncErrorManagerProps {
  records: SyncErrorRecord[];
  onRetrySync: (id: string) => Promise<void>;
  onRequestDeletion: (id: string, reason: string) => Promise<void>;
  isLoading?: boolean;
}

export function SyncErrorManager({ 
  records, 
  onRetrySync, 
  onRequestDeletion,
  isLoading 
}: SyncErrorManagerProps) {
  const [selectedRecord, setSelectedRecord] = useState<SyncErrorRecord | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletionReason, setDeletionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleRetrySync = async (record: SyncErrorRecord) => {
    setIsProcessing(true);
    try {
      await onRetrySync(record.id);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!selectedRecord || !deletionReason.trim()) return;
    
    setIsProcessing(true);
    try {
      await onRequestDeletion(selectedRecord.id, deletionReason.trim());
      setShowDeleteDialog(false);
      setSelectedRecord(null);
      setDeletionReason('');
    } finally {
      setIsProcessing(false);
    }
  };

  const openDeleteDialog = (record: SyncErrorRecord) => {
    setSelectedRecord(record);
    setDeletionReason('');
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
          <div className="space-y-4">
            {records.map((record) => (
              <div
                key={record.id}
                className={cn(
                  "p-4 rounded-lg border bg-card",
                  record.deletion_requested && "border-destructive/50 bg-destructive/5"
                )}
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
                      {record.deletion_requested && (
                        <Badge variant="destructive">Exclusão Solicitada</Badge>
                      )}
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

                    {record.deletion_requested && record.deletion_reason && (
                      <div className="mt-2 p-2 rounded bg-muted text-sm">
                        <span className="font-medium">Motivo da exclusão:</span> {record.deletion_reason}
                      </div>
                    )}

                    {record.photo_urls && (
                      <div className="mt-3">
                        <PhotoViewer photoUrls={record.photo_urls} vehiclePlate={record.vehicle_plate} />
                      </div>
                    )}
                  </div>

                  {!record.deletion_requested && (
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
                          Solicitar Exclusão
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Solicitar Exclusão do Registro</DialogTitle>
            <DialogDescription>
              Informe o motivo da exclusão. Esta solicitação será enviada para aprovação do gestor.
            </DialogDescription>
          </DialogHeader>
          
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

          <div className="space-y-2">
            <Label htmlFor="deletion-reason">Motivo da exclusão *</Label>
            <Textarea
              id="deletion-reason"
              placeholder="Ex: Registro duplicado, dados incorretos, teste..."
              value={deletionReason}
              onChange={(e) => setDeletionReason(e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteDialog(false)}
              disabled={isProcessing}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleRequestDeletion}
              disabled={!deletionReason.trim() || isProcessing}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                'Solicitar Exclusão'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
