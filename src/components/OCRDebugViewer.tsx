import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { OCRDebugImages } from '@/hooks/useOfflineOCR';

interface OCRDebugViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  debugImages: OCRDebugImages | null;
  ocrResult?: string | null;
}

export function OCRDebugViewer({ open, onOpenChange, debugImages, ocrResult }: OCRDebugViewerProps) {
  if (!debugImages) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Debug OCR - Imagens Processadas</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="h-[70vh]">
          <div className="space-y-6 p-4">
            {/* OCR Result */}
            {ocrResult !== undefined && (
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold mb-2">Resultado do OCR:</h3>
                <p className="text-2xl font-mono">
                  {ocrResult || <span className="text-muted-foreground">Nenhuma placa detectada</span>}
                </p>
              </div>
            )}

            {/* Original Image */}
            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">1. Imagem Original</h3>
              <div className="border rounded-lg overflow-hidden bg-muted/50">
                <img 
                  src={debugImages.original} 
                  alt="Original" 
                  className="max-w-full h-auto max-h-48 object-contain mx-auto"
                />
              </div>
            </div>

            {/* Cropped (ROI) */}
            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">2. Região Detectada (ROI)</h3>
              <p className="text-xs text-muted-foreground mb-2">
                Área recortada baseada em contraste e pixels claros
              </p>
              <div className="border rounded-lg overflow-hidden bg-muted/50">
                <img 
                  src={debugImages.cropped} 
                  alt="Cropped ROI" 
                  className="max-w-full h-auto max-h-32 object-contain mx-auto"
                />
              </div>
            </div>

            {/* Preprocessed Images */}
            <div>
              <h3 className="font-semibold mb-2 text-sm text-muted-foreground">3. Imagens Preprocessadas (enviadas ao Tesseract)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {debugImages.preprocessed.map((img, index) => (
                  <div key={index} className="border rounded-lg overflow-hidden bg-white">
                    <div className="p-2 bg-muted text-xs font-medium">
                      {index === 0 ? 'Otsu Threshold' : 'Contrast Stretch'}
                    </div>
                    <img 
                      src={img} 
                      alt={`Preprocessed ${index + 1}`} 
                      className="max-w-full h-auto max-h-40 object-contain mx-auto p-2"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Tips */}
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm">
              <h4 className="font-semibold mb-2">Dicas de diagnóstico:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li>Se a ROI não incluir a placa, o problema é na detecção de região</li>
                <li>Se as imagens preprocessadas estiverem muito ruidosas, ajustar threshold</li>
                <li>Caracteres devem aparecer pretos em fundo branco</li>
                <li>Se a placa estiver muito pequena, aproxime a câmera</li>
              </ul>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
