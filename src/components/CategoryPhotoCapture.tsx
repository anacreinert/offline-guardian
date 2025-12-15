import { Camera, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera } from '@/hooks/useCamera';
import { PhotoData, PhotoCategory } from '@/types/weighing';
import { toast } from 'sonner';

interface CategoryPhotoCaptureProps {
  category: PhotoCategory;
  photo: PhotoData | null;
  onPhotoChange: (photo: PhotoData | null) => void;
  label: string;
  disabled?: boolean;
}

export function CategoryPhotoCapture({ 
  category,
  photo, 
  onPhotoChange, 
  label,
  disabled = false 
}: CategoryPhotoCaptureProps) {
  const { isCapturing, error, takePhoto } = useCamera();

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
    } else if (error) {
      toast.error(error);
    }
  };

  const handleRemovePhoto = () => {
    onPhotoChange(null);
  };

  return (
    <div className="flex items-center gap-2">
      {photo ? (
        <div className="relative w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0">
          <img 
            src={photo.dataUrl} 
            alt={label}
            className="w-full h-full object-cover"
          />
          <button
            type="button"
            onClick={handleRemovePhoto}
            className="absolute -top-1 -right-1 p-0.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
            disabled={disabled}
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
          disabled={disabled || isCapturing}
          className="h-10 w-10 flex-shrink-0"
          title={`Tirar foto de ${label}`}
        >
          {isCapturing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
        </Button>
      )}
    </div>
  );
}
