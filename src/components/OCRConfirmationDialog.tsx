import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, X, AlertCircle } from 'lucide-react';

interface OCRConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageUrl: string;
  type: 'plate' | 'weights' | 'product';
  plateValue?: string | null;
  tareValue?: number | null;
  grossValue?: number | null;
  productValue?: string | null;
  onConfirm: () => void;
  onReject: () => void;
}

export function OCRConfirmationDialog({
  open,
  onOpenChange,
  imageUrl,
  type,
  plateValue,
  tareValue,
  grossValue,
  productValue,
  onConfirm,
  onReject,
}: OCRConfirmationDialogProps) {
  const hasValidData = type === 'plate' 
    ? !!plateValue 
    : type === 'product'
    ? !!productValue
    : (tareValue !== null || grossValue !== null);

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  const handleReject = () => {
    onReject();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasValidData ? (
              <>
                <Check className="h-5 w-5 text-green-500" />
                Confirmar Dados do OCR
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                OCR Não Identificou Dados
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {hasValidData 
              ? 'Verifique se os dados identificados estão corretos antes de preencher o formulário.'
              : 'O sistema não conseguiu identificar os dados automaticamente. Você precisará digitar manualmente.'
            }
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Preview */}
          <div className="relative aspect-video w-full overflow-hidden rounded-lg border border-border bg-muted">
            <img
              src={imageUrl}
              alt="Foto capturada"
              className="h-full w-full object-contain"
            />
          </div>

          {/* Recognized Values */}
          {hasValidData && (
            <div className="space-y-3 rounded-lg bg-muted/50 p-4">
              <h4 className="text-sm font-medium text-muted-foreground">Valores Identificados:</h4>
              
              {type === 'plate' && plateValue && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Placa:</span>
                  <span className="font-mono text-lg font-bold text-primary">{plateValue}</span>
                </div>
              )}

              {type === 'weights' && (
                <>
                  {tareValue !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Tara (T):</span>
                      <span className="font-mono text-lg font-bold text-primary">
                        {tareValue.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg
                      </span>
                    </div>
                  )}
                  {grossValue !== null && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Peso Bruto (PBT):</span>
                      <span className="font-mono text-lg font-bold text-primary">
                        {grossValue.toLocaleString('pt-BR', { minimumFractionDigits: 3 })} kg
                      </span>
                    </div>
                  )}
                </>
              )}

              {type === 'product' && productValue && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Produto:</span>
                  <span className="font-mono text-lg font-bold text-primary">{productValue}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="flex-row gap-2 sm:justify-end">
          <Button
            variant="outline"
            onClick={handleReject}
            className="flex-1 sm:flex-none gap-2"
          >
            <X className="h-4 w-4" />
            {hasValidData ? 'Digitar Manualmente' : 'Fechar'}
          </Button>
          {hasValidData && (
            <Button
              onClick={handleConfirm}
              className="flex-1 sm:flex-none gap-2"
            >
              <Check className="h-4 w-4" />
              Confirmar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
