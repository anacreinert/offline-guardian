import { useState } from 'react';
import { CheckCircle, Clock, Truck, Package, MapPin, XCircle, Image, Camera, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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

interface PhotoUrls {
  vehiclePlate?: string;
  tare?: string;
  product?: string;
}

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
  rejected_at?: string | null;
  rejected_by?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  user_id: string;
  photo_urls?: PhotoUrls | null;
  weight_method?: string | null;
  is_estimated?: boolean | null;
}

interface ApprovalListProps {
  records: WeighingRecord[];
  onApprove: (id: string) => void;
  onReject: (id: string, reason: string) => void;
  onApproveAll: () => void;
  onRejectAll: (reason: string) => void;
  onApproveSelected?: (ids: string[]) => void;
  onRejectSelected?: (ids: string[], reason: string) => void;
  isLoading: boolean;
}

export function ApprovalList({ 
  records, 
  onApprove, 
  onReject, 
  onApproveAll, 
  onRejectAll, 
  onApproveSelected,
  onRejectSelected,
  isLoading 
}: ApprovalListProps) {
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectAllDialogOpen, setRejectAllDialogOpen] = useState(false);
  const [rejectSelectedDialogOpen, setRejectSelectedDialogOpen] = useState(false);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  const toggleRecordSelection = (recordId: string) => {
    setSelectedRecordIds(prev => 
      prev.includes(recordId) 
        ? prev.filter(id => id !== recordId)
        : [...prev, recordId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedRecordIds.length === records.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(records.map(r => r.id));
    }
  };

  const handleApproveSelected = async () => {
    if (onApproveSelected && selectedRecordIds.length > 0) {
      await onApproveSelected(selectedRecordIds);
      setSelectedRecordIds([]);
    }
  };

  const handleConfirmRejectSelected = async () => {
    if (onRejectSelected && selectedRecordIds.length > 0) {
      setIsRejecting(true);
      await onRejectSelected(selectedRecordIds, rejectionReason);
      setIsRejecting(false);
      setRejectSelectedDialogOpen(false);
      setSelectedRecordIds([]);
      setRejectionReason('');
    }
  };

  const handleOpenRejectDialog = (recordId: string) => {
    setSelectedRecordId(recordId);
    setRejectionReason('');
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedRecordId) return;
    
    setIsRejecting(true);
    await onReject(selectedRecordId, rejectionReason);
    setIsRejecting(false);
    setRejectDialogOpen(false);
    setSelectedRecordId(null);
    setRejectionReason('');
  };

  const handleConfirmRejectAll = async () => {
    setIsRejecting(true);
    await onRejectAll(rejectionReason);
    setIsRejecting(false);
    setRejectAllDialogOpen(false);
    setRejectionReason('');
  };

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
      <CardHeader className="flex flex-col space-y-4 pb-4">
        <div className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Pesagens Offline Pendentes
          </CardTitle>
          {records.length > 0 && (
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={() => setRejectAllDialogOpen(true)}
              >
                <XCircle className="w-4 h-4" />
                Rejeitar Todos
              </Button>
              <Button onClick={onApproveAll} size="sm" className="gap-2">
                <CheckCircle className="w-4 h-4" />
                Aprovar Todos ({records.length})
              </Button>
            </div>
          )}
        </div>
        
        {/* Selection controls */}
        {records.length > 0 && (
          <div className="flex items-center justify-between border-t pt-4">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="select-all"
                checked={selectedRecordIds.length === records.length && records.length > 0}
                onCheckedChange={toggleSelectAll}
              />
              <Label htmlFor="select-all" className="text-sm text-muted-foreground cursor-pointer">
                {selectedRecordIds.length === records.length 
                  ? 'Desmarcar todos' 
                  : `Selecionar todos (${records.length})`}
              </Label>
              {selectedRecordIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedRecordIds.length} selecionado(s)
                </Badge>
              )}
            </div>
            {selectedRecordIds.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setRejectSelectedDialogOpen(true)}
                >
                  <XCircle className="w-4 h-4" />
                  Rejeitar ({selectedRecordIds.length})
                </Button>
                <Button onClick={handleApproveSelected} size="sm" className="gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Aprovar ({selectedRecordIds.length})
                </Button>
              </div>
            )}
          </div>
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
                className={`p-4 rounded-lg border transition-colors ${
                  selectedRecordIds.includes(record.id) 
                    ? 'border-primary bg-primary/5' 
                    : 'border-status-syncing/30 bg-status-syncing/5 hover:bg-status-syncing/10'
                }`}
              >
                <div className="flex items-start gap-4">
                  <Checkbox 
                    checked={selectedRecordIds.includes(record.id)}
                    onCheckedChange={() => toggleRecordSelection(record.id)}
                    className="mt-1"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck className="w-4 h-4 text-muted-foreground" />
                      <span className="font-bold text-lg">{record.vehicle_plate}</span>
                      <Badge variant="secondary" className="bg-status-offline/20 text-status-offline text-xs">
                        Offline
                      </Badge>
                      {record.is_estimated && (
                        <Badge variant="secondary" className="bg-status-syncing/20 text-status-syncing text-xs flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Estimado
                        </Badge>
                      )}
                      {record.weight_method === 'display_ocr' && !record.is_estimated && (
                        <Badge variant="secondary" className="bg-blue-500/20 text-blue-500 text-xs flex items-center gap-1">
                          <Camera className="w-3 h-3" />
                          OCR
                        </Badge>
                      )}
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
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleOpenRejectDialog(record.id)}
                        className="gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <XCircle className="w-4 h-4" />
                        Rejeitar
                      </Button>
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
                </div>
                
                {/* Photo Viewer */}
                {record.photo_urls && Object.keys(record.photo_urls).length > 0 && (
                  <div className="mt-3 pt-3 border-t">
                    <PhotoViewer 
                      photoUrls={record.photo_urls} 
                      vehiclePlate={record.vehicle_plate} 
                    />
                  </div>
                )}
                
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

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Pesagem</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição desta pesagem offline.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Motivo da Rejeição</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmReject}
              disabled={isRejecting}
            >
              {isRejecting ? 'Rejeitando...' : 'Confirmar Rejeição'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject All Dialog */}
      <Dialog open={rejectAllDialogOpen} onOpenChange={setRejectAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Todas as Pesagens</DialogTitle>
            <DialogDescription>
              Você está prestes a rejeitar {records.length} pesagem(ns) pendente(s). 
              Informe o motivo da rejeição em massa.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-all-reason">Motivo da Rejeição</Label>
              <Textarea
                id="rejection-all-reason"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectAllDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmRejectAll}
              disabled={isRejecting}
            >
              {isRejecting ? 'Rejeitando...' : `Rejeitar Todos (${records.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Selected Dialog */}
      <Dialog open={rejectSelectedDialogOpen} onOpenChange={setRejectSelectedDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Pesagens Selecionadas</DialogTitle>
            <DialogDescription>
              Você está prestes a rejeitar {selectedRecordIds.length} pesagem(ns) selecionada(s). 
              Informe o motivo da rejeição.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="rejection-selected-reason">Motivo da Rejeição</Label>
              <Textarea
                id="rejection-selected-reason"
                placeholder="Descreva o motivo da rejeição..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectSelectedDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmRejectSelected}
              disabled={isRejecting}
            >
              {isRejecting ? 'Rejeitando...' : `Rejeitar (${selectedRecordIds.length})`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
