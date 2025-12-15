import { useState, useCallback } from 'react';
import { useOCR } from './useOCR';
import { useOfflineOCR } from './useOfflineOCR';
import { useConnectionStatus } from './useConnectionStatus';

interface PlateOCRResult {
  plate: string | null;
  raw: string;
  success: boolean;
  source: 'online' | 'offline';
}

interface WeightOCRResult {
  weight: number | null;
  raw: string;
  success: boolean;
  source: 'online' | 'offline';
}

interface BothWeightsOCRResult {
  tare: number | null;
  gross: number | null;
  raw: string;
  success: boolean;
  source: 'online' | 'offline';
}

interface ProductOCRResult {
  product: string | null;
  raw: string;
  success: boolean;
  source: 'online' | 'offline';
}

export function useHybridOCR() {
  const onlineOCR = useOCR();
  const offlineOCR = useOfflineOCR();
  const { isOnline } = useConnectionStatus();
  const [lastSource, setLastSource] = useState<'online' | 'offline' | null>(null);

  const isProcessing = onlineOCR.isProcessing || offlineOCR.isProcessing;
  const error = onlineOCR.error || offlineOCR.error;
  const progress = offlineOCR.progress;

  const recognizePlate = useCallback(async (imageDataUrl: string): Promise<PlateOCRResult | null> => {
    // Try online first if connected
    if (isOnline) {
      try {
        const result = await onlineOCR.recognizePlate(imageDataUrl);
        if (result) {
          setLastSource('online');
          return { ...result, source: 'online' };
        }
      } catch (err) {
        console.log('Online OCR failed, falling back to offline:', err);
      }
    }

    // Fall back to offline
    const result = await offlineOCR.recognizePlate(imageDataUrl);
    if (result) {
      setLastSource('offline');
    }
    return result;
  }, [isOnline, onlineOCR, offlineOCR]);

  const recognizeWeight = useCallback(async (imageDataUrl: string, weightType: 'tare' | 'gross'): Promise<WeightOCRResult | null> => {
    // Try online first if connected
    if (isOnline) {
      try {
        const result = await onlineOCR.recognizeWeight(imageDataUrl, weightType);
        if (result) {
          setLastSource('online');
          return { ...result, source: 'online' };
        }
      } catch (err) {
        console.log('Online OCR failed, falling back to offline:', err);
      }
    }

    // Fall back to offline
    const result = await offlineOCR.recognizeWeight(imageDataUrl);
    if (result) {
      setLastSource('offline');
    }
    return result;
  }, [isOnline, onlineOCR, offlineOCR]);

  const recognizeBothWeights = useCallback(async (imageDataUrl: string): Promise<BothWeightsOCRResult | null> => {
    // Try online first if connected
    if (isOnline) {
      try {
        const result = await onlineOCR.recognizeBothWeights(imageDataUrl);
        if (result) {
          setLastSource('online');
          return { ...result, source: 'online' };
        }
      } catch (err) {
        console.log('Online OCR failed, falling back to offline:', err);
      }
    }

    // Fall back to offline
    const result = await offlineOCR.recognizeBothWeights(imageDataUrl);
    if (result) {
      setLastSource('offline');
    }
    return result;
  }, [isOnline, onlineOCR, offlineOCR]);

  const recognizeProduct = useCallback(async (imageDataUrl: string): Promise<ProductOCRResult | null> => {
    // Try online first if connected
    if (isOnline) {
      try {
        const result = await onlineOCR.recognizeProduct(imageDataUrl);
        if (result) {
          setLastSource('online');
          return { ...result, source: 'online' };
        }
      } catch (err) {
        console.log('Online OCR failed, falling back to offline:', err);
      }
    }

    // Fall back to offline
    const result = await offlineOCR.recognizeProduct(imageDataUrl);
    if (result) {
      setLastSource('offline');
    }
    return result;
  }, [isOnline, onlineOCR, offlineOCR]);

  return {
    isProcessing,
    error,
    progress,
    lastSource,
    isOnline,
    recognizePlate,
    recognizeWeight,
    recognizeBothWeights,
    recognizeProduct,
  };
}
