import { useState } from 'react';
import { Camera, X, Loader2, ScanLine, Wifi, WifiOff, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCamera } from '@/hooks/useCamera';
import { useHybridOCR } from '@/hooks/useHybridOCR';
import { PhotoData, PhotoCategory } from '@/types/weighing';
import { toast } from 'sonner';
import { OCRConfirmationDialog } from '@/components/OCRConfirmationDialog';
import { OCRDebugViewer } from '@/components/OCRDebugViewer';

interface OCRResult {
  type: 'plate' | 'weights' | 'product';
  plate?: string | null;
  tare?: number | null;
  gross?: number | null;
  product?: string | null;
  imageUrl: string;
}

interface CategoryPhotoCaptureProps {
  category: PhotoCategory;
  photo: PhotoData | null;
  onPhotoChange: (photo: PhotoData | null) => void;
  onPlateRecognized?: (plate: string) => void;
  onWeightRecognized?: (weight: number) => void;
  onBothWeightsRecognized?: (tare: number, gross: number) => void;
  onProductRecognized?: (product: string) => void;
  label: string;
  disabled?: boolean;
  isOnline: boolean;
}

export function CategoryPhotoCapture({ 
  category,
  photo, 
  onPhotoChange, 
  onPlateRecognized,
  onWeightRecognized,
  onBothWeightsRecognized,
  onProductRecognized,
  label,
  disabled = false,
  isOnline
}: CategoryPhotoCaptureProps) {
  const { isCapturing, error, takePhoto } = useCamera();
  const { isProcessing, progress, lastSource, debugImages, recognizePlate, recognizeBothWeights, recognizeProduct } = useHybridOCR({ isOnline });
  
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showDebugViewer, setShowDebugViewer] = useState(false);
  const [pendingOCR, setPendingOCR] = useState<OCRResult | null>(null);
  const [ocrSource, setOcrSource] = useState<'online' | 'offline' | null>(null);
  const [lastOCRResult, setLastOCRResult] = useState<string | null>(null);

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
        const modeText = isOnline ? 'online (IA)' : 'offline (local)';
        toast.info(`Processando OCR da placa... (modo ${modeText})`);
        const result = await recognizePlate(captured.dataUrl);
        
        setOcrSource(result?.source || null);
        setLastOCRResult(result?.plate || null);
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
        const modeText = isOnline ? 'online (IA)' : 'offline (local)';
        toast.info(`Processando OCR dos pesos... (modo ${modeText})`);
        const result = await recognizeBothWeights(captured.dataUrl);
        
        setOcrSource(result?.source || null);
        // Show confirmation dialog instead of auto-filling
        setPendingOCR({
          type: 'weights',
          tare: result?.tare ?? null,
          gross: result?.gross ?? null,
          imageUrl: captured.dataUrl,
        });
        setShowConfirmDialog(true);
      }

      // If this is a product photo, run OCR for product recognition
      if (category === 'product' && onProductRecognized) {
        const modeText = isOnline ? 'online (IA)' : 'offline (local)';
        toast.info(`Identificando produto... (modo ${modeText})`);
        const result = await recognizeProduct(captured.dataUrl);
        
        setOcrSource(result?.source || null);
        // Show confirmation dialog instead of auto-filling
        setPendingOCR({
          type: 'product',
          product: result?.product ?? null,
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

    if (pendingOCR.type === 'product' && pendingOCR.product && onProductRecognized) {
      onProductRecognized(pendingOCR.product);
      toast.success(`Produto confirmado: ${pendingOCR.product}`);
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
              <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center gap-1">
                <ScanLine className="h-4 w-4 text-primary animate-pulse" />
                {!isOnline && progress > 0 && (
                  <span className="text-[8px] text-muted-foreground">{progress}%</span>
                )}
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
            {/* OCR source indicator */}
            {ocrSource && !isProcessing && (
              <div 
                className="absolute -bottom-1 -left-1 p-0.5 rounded-full"
                title={ocrSource === 'online' ? 'OCR Online (IA)' : 'OCR Offline (local)'}
              >
                {ocrSource === 'online' ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : (
                  <WifiOff className="h-3 w-3 text-orange-500" />
                )}
              </div>
            )}
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleTakePhoto}
            disabled={disabled || isLoading}
            className="h-10 w-10 flex-shrink-0 relative"
            title={`Tirar foto de ${label}${!isOnline ? ' (modo offline)' : ''}`}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
            {!isOnline && (
              <WifiOff className="absolute -top-1 -right-1 h-3 w-3 text-orange-500" />
            )}
          </Button>
        )}
        
        {/* Debug button - only show for plate category when we have debug images */}
        {category === 'vehiclePlate' && debugImages && !isProcessing && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowDebugViewer(true)}
            className="h-8 w-8 flex-shrink-0"
            title="Ver debug do OCR"
          >
            <Bug className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Progress bar for offline OCR */}
      {isProcessing && !isOnline && progress > 0 && (
        <Progress value={progress} className="h-1 mt-1" />
      )}

      {pendingOCR && (
        <OCRConfirmationDialog
          open={showConfirmDialog}
          onOpenChange={setShowConfirmDialog}
          imageUrl={pendingOCR.imageUrl}
          type={pendingOCR.type}
          plateValue={pendingOCR.plate}
          tareValue={pendingOCR.tare}
          grossValue={pendingOCR.gross}
          productValue={pendingOCR.product}
          onConfirm={handleConfirmOCR}
          onReject={handleRejectOCR}
        />
      )}

      {/* Debug Viewer */}
      <OCRDebugViewer
        open={showDebugViewer}
        onOpenChange={setShowDebugViewer}
        debugImages={debugImages}
        ocrResult={lastOCRResult}
      />
    </>
  );
}
