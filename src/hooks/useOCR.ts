import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface OCRResult {
  plate: string | null;
  raw: string;
  success: boolean;
}

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognizePlate = async (imageDataUrl: string): Promise<OCRResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ocr-plate', {
        body: { imageBase64: imageDataUrl },
      });

      if (fnError) {
        console.error('OCR function error:', fnError);
        setError(fnError.message);
        return null;
      }

      if (data.error) {
        setError(data.error);
        return null;
      }

      return {
        plate: data.plate,
        raw: data.raw,
        success: data.success,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR failed';
      setError(message);
      console.error('OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    error,
    recognizePlate,
  };
}
