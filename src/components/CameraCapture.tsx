import { Camera, ImagePlus, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCamera, CapturedPhoto } from '@/hooks/useCamera';
import { toast } from 'sonner';

interface CameraCaptureProps {
  photos: CapturedPhoto[];
  onPhotosChange: (photos: CapturedPhoto[]) => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export function CameraCapture({ 
  photos, 
  onPhotosChange, 
  maxPhotos = 3,
  disabled = false 
}: CameraCaptureProps) {
  const { 
    isCapturing, 
    error, 
    takePhoto, 
    pickFromGallery 
  } = useCamera();

  const handleTakePhoto = async () => {
    if (photos.length >= maxPhotos) {
      toast.error(`Máximo de ${maxPhotos} fotos permitidas`);
      return;
    }

    const photo = await takePhoto();
    if (photo) {
      onPhotosChange([...photos, photo]);
      toast.success('Foto capturada!');
    } else if (error) {
      toast.error(error);
    }
  };

  const handlePickFromGallery = async () => {
    if (photos.length >= maxPhotos) {
      toast.error(`Máximo de ${maxPhotos} fotos permitidas`);
      return;
    }

    const photo = await pickFromGallery();
    if (photo) {
      onPhotosChange([...photos, photo]);
      toast.success('Foto adicionada!');
    } else if (error) {
      toast.error(error);
    }
  };

  const handleRemovePhoto = (index: number) => {
    const newPhotos = photos.filter((_, i) => i !== index);
    onPhotosChange(newPhotos);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">
          Fotos ({photos.length}/{maxPhotos})
        </span>
      </div>

      {/* Photo Grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, index) => (
            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-border">
              <img 
                src={photo.dataUrl} 
                alt={`Foto ${index + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemovePhoto(index)}
                className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Capture Buttons */}
      {photos.length < maxPhotos && (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTakePhoto}
            disabled={disabled || isCapturing}
            className="flex-1"
          >
            {isCapturing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Camera className="h-4 w-4 mr-2" />
            )}
            Câmera
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePickFromGallery}
            disabled={disabled || isCapturing}
            className="flex-1"
          >
            {isCapturing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4 mr-2" />
            )}
            Galeria
          </Button>
        </div>
      )}
    </div>
  );
}
