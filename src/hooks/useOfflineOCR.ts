import { useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';

interface PlateOCRResult {
  plate: string | null;
  raw: string;
  success: boolean;
  source: 'offline';
}

interface WeightOCRResult {
  weight: number | null;
  raw: string;
  success: boolean;
  source: 'offline';
}

interface BothWeightsOCRResult {
  tare: number | null;
  gross: number | null;
  raw: string;
  success: boolean;
  source: 'offline';
}

interface ProductOCRResult {
  product: string | null;
  raw: string;
  success: boolean;
  source: 'offline';
}

// Brazilian plate patterns: ABC1234 (old) or ABC1D23 (Mercosul)
const MERCOSUL_PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const OLD_PLATE_REGEX = /^[A-Z]{3}[0-9]{4}$/;

function cleanPlateText(text: string): string | null {
  // Remove spaces, special chars, normalize to uppercase
  const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  // Check for valid plate patterns
  if (MERCOSUL_PLATE_REGEX.test(cleaned) || OLD_PLATE_REGEX.test(cleaned)) {
    return cleaned;
  }
  
  // Try to find plate pattern in the text
  const allText = text.replace(/\s+/g, '').toUpperCase();
  const mercosulMatch = allText.match(/[A-Z]{3}[0-9][A-Z][0-9]{2}/);
  if (mercosulMatch) return mercosulMatch[0];
  
  const oldMatch = allText.match(/[A-Z]{3}[0-9]{4}/);
  if (oldMatch) return oldMatch[0];
  
  return null;
}

function extractWeight(text: string): number | null {
  // Remove common OCR noise and normalize
  const cleaned = text.replace(/[oO]/g, '0').replace(/[lI]/g, '1');
  
  // Look for patterns like "12345 kg" or "12.345" or "12,345"
  const patterns = [
    /(\d{1,3}[.,]\d{3})\s*(kg)?/i,
    /(\d{4,6})\s*(kg)?/i,
    /(\d{1,2}[.,]\d{3}[.,]\d{3})\s*(kg)?/i,
  ];
  
  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const numStr = match[1].replace(/[.,]/g, '');
      const weight = parseInt(numStr, 10);
      // Reasonable weight range for vehicles (500kg to 80000kg)
      if (weight >= 500 && weight <= 80000) {
        return weight;
      }
    }
  }
  
  return null;
}

function extractBothWeights(text: string): { tare: number | null; gross: number | null } {
  const lines = text.split('\n').filter(l => l.trim());
  const weights: number[] = [];
  
  for (const line of lines) {
    const weight = extractWeight(line);
    if (weight) {
      weights.push(weight);
    }
  }
  
  // If we found two distinct weights, assume smaller is tare, larger is gross
  if (weights.length >= 2) {
    const sorted = [...new Set(weights)].sort((a, b) => a - b);
    return { tare: sorted[0], gross: sorted[sorted.length - 1] };
  }
  
  // If only one weight found
  if (weights.length === 1) {
    return { tare: null, gross: weights[0] };
  }
  
  return { tare: null, gross: null };
}

// Simple product detection based on common agricultural products
const KNOWN_PRODUCTS = ['soja', 'milho', 'trigo', 'sorgo', 'café', 'feijão', 'arroz', 'algodão', 'cana'];

function detectProduct(text: string): string | null {
  const lowerText = text.toLowerCase();
  
  for (const product of KNOWN_PRODUCTS) {
    if (lowerText.includes(product)) {
      return product.charAt(0).toUpperCase() + product.slice(1);
    }
  }
  
  return null;
}

export function useOfflineOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const recognizePlate = useCallback(async (imageDataUrl: string): Promise<PlateOCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(imageDataUrl, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const raw = result.data.text;
      const plate = cleanPlateText(raw);

      return {
        plate,
        raw,
        success: plate !== null,
        source: 'offline',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR offline falhou';
      setError(message);
      console.error('Offline OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  const recognizeWeight = useCallback(async (imageDataUrl: string): Promise<WeightOCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(imageDataUrl, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const raw = result.data.text;
      const weight = extractWeight(raw);

      return {
        weight,
        raw,
        success: weight !== null,
        source: 'offline',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR offline falhou';
      setError(message);
      console.error('Offline OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  const recognizeBothWeights = useCallback(async (imageDataUrl: string): Promise<BothWeightsOCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(imageDataUrl, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const raw = result.data.text;
      const { tare, gross } = extractBothWeights(raw);

      return {
        tare,
        gross,
        raw,
        success: tare !== null || gross !== null,
        source: 'offline',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR offline falhou';
      setError(message);
      console.error('Offline OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  const recognizeProduct = useCallback(async (imageDataUrl: string): Promise<ProductOCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      const result = await Tesseract.recognize(imageDataUrl, 'por', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      const raw = result.data.text;
      const product = detectProduct(raw);

      return {
        product,
        raw,
        success: product !== null,
        source: 'offline',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR offline falhou';
      setError(message);
      console.error('Offline OCR error:', err);
      return null;
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  }, []);

  return {
    isProcessing,
    error,
    progress,
    recognizePlate,
    recognizeWeight,
    recognizeBothWeights,
    recognizeProduct,
  };
}
