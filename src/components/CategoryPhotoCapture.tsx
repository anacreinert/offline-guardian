import { Camera, X, Loader2, ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { useOCR } from '@/hooks/useOCR';
import { PhotoData, PhotoCategory } from '@/types/weighing';
import { toast } from 'sonner';

interface CategoryPhotoCaptureProps {
  category: PhotoCategory;
  photo: PhotoData | null;
  onPhotoChange: (photo: PhotoData | null) => void;
  onPlateRecognized?: (plate: string) => void;
  label: string;
  disabled?: boolean;
}

export function CategoryPhotoCapture({ 
  category,
  photo, 
  onPhotoChange, 
  onPlateRecognized,
  label,
  disabled = false 
}: CategoryPhotoCaptureProps) {
  const { isCapturing, error, takePhoto } = useCamera();
  const { isProcessing, recognizePlate } = useOCR();

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
        
        if (result?.success && result.plate) {
          onPlateRecognized(result.plate);
          toast.success(`Placa identificada: ${result.plate}`);
        } else {
          toast.warning('Não foi possível identificar a placa automaticamente');
        }
      }
    } else if (error) {
      toast.error(error);
    }
  };

  const handleRemovePhoto = () => {
    onPhotoChange(null);
  };

  const isLoading = isCapturing || isProcessing;

  return (
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
  );
}
