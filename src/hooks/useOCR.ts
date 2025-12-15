import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlateOCRResult {
  plate: string | null;
  raw: string;
  success: boolean;
}

interface WeightOCRResult {
  weight: number | null;
  raw: string;
  success: boolean;
}

interface BothWeightsOCRResult {
  tare: number | null;
  gross: number | null;
  raw: string;
  success: boolean;
}

interface ProductOCRResult {
  product: string | null;
  raw: string;
  success: boolean;
}

export function useOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognizePlate = async (imageDataUrl: string): Promise<PlateOCRResult | null> => {
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

  const recognizeWeight = async (imageDataUrl: string, weightType: 'tare' | 'gross'): Promise<WeightOCRResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ocr-weight', {
        body: { imageBase64: imageDataUrl, weightType },
      });

      if (fnError) {
        console.error('OCR weight function error:', fnError);
        setError(fnError.message);
        return null;
      }

      if (data.error) {
        setError(data.error);
        return null;
      }

      return {
        weight: data.weight,
        raw: data.raw,
        success: data.success,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Weight OCR failed';
      setError(message);
      console.error('Weight OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const recognizeBothWeights = async (imageDataUrl: string): Promise<BothWeightsOCRResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ocr-weight', {
        body: { imageBase64: imageDataUrl, extractBoth: true },
      });

      if (fnError) {
        console.error('OCR both weights function error:', fnError);
        setError(fnError.message);
        return null;
      }

      if (data.error) {
        setError(data.error);
        return null;
      }

      return {
        tare: data.tare,
        gross: data.gross,
        raw: data.raw,
        success: data.success,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Weight OCR failed';
      setError(message);
      console.error('Weight OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  const recognizeProduct = async (imageDataUrl: string): Promise<ProductOCRResult | null> => {
    setIsProcessing(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ocr-product', {
        body: { imageBase64: imageDataUrl },
      });

      if (fnError) {
        console.error('OCR product function error:', fnError);
        setError(fnError.message);
        return null;
      }

      if (data.error) {
        setError(data.error);
        return null;
      }

      return {
        product: data.product,
        raw: data.raw,
        success: data.success,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Product OCR failed';
      setError(message);
      console.error('Product OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    isProcessing,
    error,
    recognizePlate,
    recognizeWeight,
    recognizeBothWeights,
    recognizeProduct,
  };
}
