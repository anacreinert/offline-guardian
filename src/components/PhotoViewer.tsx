import { useState } from 'react';
import { X, Image, ZoomIn, ZoomOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface PhotoUrls {
  vehiclePlate?: string;
  tare?: string;
  product?: string;
}

interface PhotoViewerProps {
  photoUrls: PhotoUrls | null;
  vehiclePlate: string;
}

const categoryLabels: Record<string, string> = {
  vehiclePlate: 'Placa do Veículo',
  tare: 'Tara / PBT',
  product: 'Produto',
};

export function PhotoViewer({ photoUrls, vehiclePlate }: PhotoViewerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<{ url: string; category: string } | null>(null);
  const [zoom, setZoom] = useState(1);

  if (!photoUrls || Object.keys(photoUrls).length === 0) {
    return null;
  }

  const photos = Object.entries(photoUrls).filter(([_, url]) => url);

  if (photos.length === 0) {
    return null;
  }

  const handlePhotoClick = (url: string, category: string) => {
    setSelectedPhoto({ url, category });
    setZoom(1);
  };

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.5, 3));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.5, 0.5));

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Image className="h-4 w-4" />
        Fotos ({photos.length})
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Fotos - {vehiclePlate}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Thumbnails */}
            <div className="grid grid-cols-3 gap-4">
              {photos.map(([category, url]) => (
                <div
                  key={category}
                  className={cn(
                    'relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all',
                    selectedPhoto?.category === category 
                      ? 'border-primary ring-2 ring-primary/20' 
                      : 'border-border hover:border-primary/50'
                  )}
                  onClick={() => handlePhotoClick(url, category)}
                >
                  <div className="aspect-square">
                    <img
                      src={url}
                      alt={categoryLabels[category] || category}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-background/90 px-2 py-1 text-xs font-medium text-center">
                    {categoryLabels[category] || category}
                  </div>
                </div>
              ))}
            </div>

            {/* Selected Photo Preview */}
            {selectedPhoto && (
              <div className="relative border rounded-lg overflow-hidden bg-muted/50">
                <div className="absolute top-2 right-2 z-10 flex gap-2">
                  <Button variant="secondary" size="icon" onClick={handleZoomOut}>
                    <ZoomOut className="h-4 w-4" />
                  </Button>
                  <Button variant="secondary" size="icon" onClick={handleZoomIn}>
                    <ZoomIn className="h-4 w-4" />
                  </Button>
                </div>
                <div className="overflow-auto max-h-[50vh] p-4">
                  <img
                    src={selectedPhoto.url}
                    alt={categoryLabels[selectedPhoto.category] || selectedPhoto.category}
                    className="mx-auto transition-transform"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
                <div className="bg-muted px-4 py-2 text-sm text-center font-medium">
                  {categoryLabels[selectedPhoto.category] || selectedPhoto.category}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}