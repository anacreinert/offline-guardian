import { useState } from 'react';
import { Camera, X, Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { useOCR } from '@/hooks/useOCR';
import { PhotoData, PhotoCategory } from '@/types/weighing';
import { toast } from 'sonner';
import { OCRConfirmationDialog } from '@/components/OCRConfirmationDialog';

interface OCRResult {
  type: 'plate' | 'weights';
  plate?: string | null;
  tare?: number | null;
  gross?: number | null;
  imageUrl: string;
}

interface CategoryPhotoCaptureProps {
  category: PhotoCategory;
  photo: PhotoData | null;
  onPhotoChange: (photo: PhotoData | null) => void;
  onPlateRecognized?: (plate: string) => void;
  onWeightRecognized?: (weight: number) => void;
  onBothWeightsRecognized?: (tare: number, gross: number) => void;
  label: string;
  disabled?: boolean;
}

export function CategoryPhotoCapture({ 
  category,
  photo, 
  onPhotoChange, 
  onPlateRecognized,
  onWeightRecognized,
  onBothWeightsRecognized,
  label,
  disabled = false 
}: CategoryPhotoCaptureProps) {
  const { isCapturing, error, takePhoto } = useCamera();
  const { isProcessing, recognizePlate, recognizeBothWeights } = useOCR();
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingOCR, setPendingOCR] = useState<OCRResult | null>(null);

  const handleTakePhoto = async () => {
    const captured = await takePhoto();
    if (captured) {
      const photoData: PhotoData = {
        dataUrl: captured.dataUrl,
        format: captured.format,
        timestamp: captured.timestamp,
        category,
      };
      onPhotoChange(photoData);
      toast.success(`Foto de ${label} capturada!`);

      // If this is a vehicle plate photo, run OCR
      if (category === 'vehiclePlate' && onPlateRecognized) {
        toast.info('Processando OCR da placa...');
        const result = await recognizePlate(captured.dataUrl);
        
        // Show confirmation dialog instead of auto-filling
        setPendingOCR({
          type: 'plate',
          plate: result?.plate || null,
          imageUrl: captured.dataUrl,
        });
        setShowConfirmDialog(true);
      }

      // If this is a tare weight photo, run OCR for both weights
      if (category === 'tare' && onBothWeightsRecognized) {
        toast.info('Processando OCR dos pesos (Tara e PBT)...');
        const result = await recognizeBothWeights(captured.dataUrl);
        
        // Show confirmation dialog instead of auto-filling
        setPendingOCR({
          type: 'weights',
          tare: result?.tare ?? null,
          gross: result?.gross ?? null,
          imageUrl: captured.dataUrl,
        });
        setShowConfirmDialog(true);
      }
    } else if (error) {
      toast.error(error);
    }
  };

  const handleConfirmOCR = () => {
    if (!pendingOCR) return;

    if (pendingOCR.type === 'plate' && pendingOCR.plate && onPlateRecognized) {
      onPlateRecognized(pendingOCR.plate);
      toast.success(`Placa confirmada: ${pendingOCR.plate}`);
    }

    if (pendingOCR.type === 'weights') {
      if (pendingOCR.tare !== null && pendingOCR.gross !== null && onBothWeightsRecognized) {
        onBothWeightsRecognized(pendingOCR.tare, pendingOCR.gross);
        toast.success(`Pesos confirmados - Tara: ${pendingOCR.tare} kg | PBT: ${pendingOCR.gross} kg`);
      } else if (pendingOCR.tare !== null && onWeightRecognized) {
        onWeightRecognized(pendingOCR.tare);
        toast.success(`Tara confirmada: ${pendingOCR.tare} kg`);
      }
    }

    setPendingOCR(null);
  };

  const handleRejectOCR = () => {
    if (pendingOCR) {
      toast.info('Valores descartados. Digite manualmente.');
    }
    setPendingOCR(null);
  };

  const handleRemovePhoto = () => {
    onPhotoChange(null);
  };

  const isLoading = isCapturing || isProcessing;

  return (
    <>
      <div className="flex items-center gap-2">
        {photo ? (
          <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0">
            <img 
              src={photo.dataUrl} 
              alt={label}
              className="w-full h-full object-cover"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                <ScanLine className="h-5 w-5 text-primary animate-pulse" />
              </div>
            )}
            <button
              type="button"
              onClick={handleRemovePhoto}
              className="absolute -top-1 -right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
              disabled={disabled || isLoading}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleTakePhoto}
            disabled={disabled || isLoading}
            className="h-10 w-10 flex-shrink-0"
            title={`Tirar foto de ${label}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </Button>
        )}
      </div>

      {pendingOCR && (
        <OCRConfirmationDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          imageUrl={pendingOCR.imageUrl}
          type={pendingOCR.type}
          plateValue={pendingOCR.plate}
          tareValue={pendingOCR.tare}
          grossValue={pendingOCR.gross}
          onConfirm={handleConfirmOCR}
          onReject={handleRejectOCR}
        />
      )}
    </>
  );
}
