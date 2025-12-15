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

// Character corrections for common OCR mistakes in plates
const PLATE_CHAR_CORRECTIONS: Record<string, string> = {
  '0': 'O', 'O': 'O',
  '1': 'I', 'I': 'I', 'L': 'I', 'l': 'I',
  '5': 'S', 'S': 'S',
  '8': 'B', 'B': 'B',
  '2': 'Z', 'Z': 'Z',
  '6': 'G', 'G': 'G',
  '4': 'A', 'A': 'A',
};

const NUM_CHAR_CORRECTIONS: Record<string, string> = {
  'O': '0', 'o': '0', 'Q': '0', 'D': '0',
  'I': '1', 'i': '1', 'l': '1', 'L': '1', '|': '1',
  'Z': '2', 'z': '2',
  'E': '3',
  'A': '4', 'h': '4',
  'S': '5', 's': '5',
  'G': '6', 'b': '6',
  'T': '7',
  'B': '8',
  'g': '9', 'q': '9',
};

// Preprocess image for better OCR - creates high contrast black/white image
async function preprocessImage(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      // Scale up small images for better recognition
      const scale = Math.max(1, Math.min(3, 1500 / Math.max(img.width, img.height)));
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      // Draw and scale
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Get image data for processing
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and apply adaptive thresholding
      const grayscale: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        // Weighted grayscale (luminosity method)
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        grayscale.push(gray);
      }

      // Calculate Otsu's threshold for optimal binarization
      const histogram = new Array(256).fill(0);
      for (const g of grayscale) {
        histogram[g]++;
      }

      const total = grayscale.length;
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
      }

      let sumB = 0;
      let wB = 0;
      let wF = 0;
      let maxVariance = 0;
      let threshold = 128;

      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        wF = total - wB;
        if (wF === 0) break;

        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const variance = wB * wF * (mB - mF) * (mB - mF);

        if (variance > maxVariance) {
          maxVariance = variance;
          threshold = t;
        }
      }

      // Apply threshold with slight adjustment for better text contrast
      const adjustedThreshold = threshold * 0.9;

      for (let i = 0; i < grayscale.length; i++) {
        const value = grayscale[i] < adjustedThreshold ? 0 : 255;
        const idx = i * 4;
        data[idx] = value;
        data[idx + 1] = value;
        data[idx + 2] = value;
        data[idx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);

      // Apply sharpening
      const sharpenedCanvas = document.createElement('canvas');
      sharpenedCanvas.width = canvas.width;
      sharpenedCanvas.height = canvas.height;
      const sharpenCtx = sharpenedCanvas.getContext('2d');
      
      if (sharpenCtx) {
        sharpenCtx.filter = 'contrast(1.2)';
        sharpenCtx.drawImage(canvas, 0, 0);
        resolve(sharpenedCanvas.toDataURL('image/png'));
      } else {
        resolve(canvas.toDataURL('image/png'));
      }
    };
    
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

function applyPlateCorrections(text: string): string {
  // Brazilian Mercosul format: ABC1D23 (letters-number-letter-numbers)
  // Old format: ABC1234 (letters-numbers)
  
  const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  
  if (cleaned.length !== 7) return cleaned;
  
  let result = '';
  
  // Positions 0,1,2 should be letters
  for (let i = 0; i < 3; i++) {
    const char = cleaned[i];
    result += NUM_CHAR_CORRECTIONS[char] ? 
      Object.entries(PLATE_CHAR_CORRECTIONS).find(([_, v]) => v === char)?.[1] || char : 
      char;
  }
  
  // Position 3 should be number
  const pos3 = cleaned[3];
  result += NUM_CHAR_CORRECTIONS[pos3] || pos3;
  
  // Position 4 could be letter (Mercosul) or number (old)
  const pos4 = cleaned[4];
  const asNum = NUM_CHAR_CORRECTIONS[pos4] || pos4;
  const isDigit = /[0-9]/.test(asNum);
  
  if (isDigit) {
    // Old format - rest are numbers
    result += asNum;
    for (let i = 5; i < 7; i++) {
      const char = cleaned[i];
      result += NUM_CHAR_CORRECTIONS[char] || char;
    }
  } else {
    // Mercosul format - position 4 is letter, 5-6 are numbers
    result += pos4;
    for (let i = 5; i < 7; i++) {
      const char = cleaned[i];
      result += NUM_CHAR_CORRECTIONS[char] || char;
    }
  }
  
  return result;
}

function cleanPlateText(text: string): string | null {
  // Try multiple variations of the text
  const variations = [
    text,
    text.replace(/[^A-Za-z0-9\s]/g, ''),
    text.replace(/\s+/g, ''),
  ];
  
  for (const variation of variations) {
    // Apply corrections and check patterns
    const corrected = applyPlateCorrections(variation);
    
    if (MERCOSUL_PLATE_REGEX.test(corrected) || OLD_PLATE_REGEX.test(corrected)) {
      return corrected;
    }
  }
  
  // Try to find plate pattern anywhere in text
  const allText = text.replace(/\s+/g, '').toUpperCase();
  
  // Look for 7-character sequences that might be plates
  for (let i = 0; i <= allText.length - 7; i++) {
    const segment = allText.substring(i, i + 7);
    const corrected = applyPlateCorrections(segment);
    
    if (MERCOSUL_PLATE_REGEX.test(corrected) || OLD_PLATE_REGEX.test(corrected)) {
      return corrected;
    }
  }
  
  // Last resort: find any pattern close to plate format
  const mercosulMatch = allText.match(/[A-Z0-9]{3}[0-9A-Z][A-Z0-9][0-9A-Z]{2}/);
  if (mercosulMatch) {
    const corrected = applyPlateCorrections(mercosulMatch[0]);
    if (MERCOSUL_PLATE_REGEX.test(corrected) || OLD_PLATE_REGEX.test(corrected)) {
      return corrected;
    }
  }
  
  return null;
}

function extractWeight(text: string): number | null {
  // Aggressive cleaning for weight displays
  let cleaned = text
    .replace(/[oO]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2')
    .replace(/[Gg]/g, '9')
    .replace(/\s+/g, ' ')
    .trim();

  // Common weight display patterns
  const patterns = [
    // "12.345 kg" or "12,345 kg"
    /(\d{1,3})[.,](\d{3})\s*(?:kg|KG)?/,
    // "12345 kg" or just "12345"
    /(\d{4,6})\s*(?:kg|KG)?/,
    // "1.234.567" (millions)
    /(\d{1,3})[.,](\d{3})[.,](\d{3})/,
    // With labels like "PBT: 12345" or "TARA: 12345"
    /(?:PBT|PESO|BRUTO|TARA|NET|LIQUIDO)[:\s]*(\d{1,3}[.,]?\d{0,3})\s*(?:kg|KG)?/i,
    // Simple number at start/end of line
    /^(\d{3,6})$/m,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      // Join capture groups and remove separators
      const numParts = match.slice(1).filter(Boolean);
      const numStr = numParts.join('').replace(/[.,]/g, '');
      const weight = parseInt(numStr, 10);
      
      // Reasonable weight range (500kg to 80000kg)
      if (weight >= 500 && weight <= 80000) {
        return weight;
      }
      // Maybe it's in tons? (0.5 to 80)
      if (weight >= 1 && weight <= 80) {
        return weight * 1000;
      }
    }
  }

  // Try to find any reasonable number
  const numbers = cleaned.match(/\d+/g);
  if (numbers) {
    for (const num of numbers) {
      const weight = parseInt(num, 10);
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
  const labeledWeights: { tare?: number; gross?: number } = {};

  // First try to find labeled weights
  const tareMatch = text.match(/(?:TARA|T)[:\s]*(\d{1,3}[.,]?\d{0,3})\s*(?:kg|KG)?/i);
  const grossMatch = text.match(/(?:PBT|BRUTO|PESO\s*BRUTO|GROSS)[:\s]*(\d{1,3}[.,]?\d{0,3})\s*(?:kg|KG)?/i);

  if (tareMatch) {
    const numStr = tareMatch[1].replace(/[.,]/g, '');
    const weight = parseInt(numStr, 10);
    if (weight >= 500 && weight <= 30000) {
      labeledWeights.tare = weight;
    }
  }

  if (grossMatch) {
    const numStr = grossMatch[1].replace(/[.,]/g, '');
    const weight = parseInt(numStr, 10);
    if (weight >= 500 && weight <= 80000) {
      labeledWeights.gross = weight;
    }
  }

  if (labeledWeights.tare || labeledWeights.gross) {
    return { tare: labeledWeights.tare || null, gross: labeledWeights.gross || null };
  }

  // Fall back to extracting all weights
  for (const line of lines) {
    const weight = extractWeight(line);
    if (weight) {
      weights.push(weight);
    }
  }

  // If we found two distinct weights, smaller is tare, larger is gross
  if (weights.length >= 2) {
    const sorted = [...new Set(weights)].sort((a, b) => a - b);
    return { tare: sorted[0], gross: sorted[sorted.length - 1] };
  }

  if (weights.length === 1) {
    return { tare: null, gross: weights[0] };
  }

  return { tare: null, gross: null };
}

// Simple product detection
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

// Tesseract configuration optimized for different use cases
const TESSERACT_CONFIG_PLATE = {
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  tessedit_pageseg_mode: '7', // Single line
  tessedit_ocr_engine_mode: '3', // Default + LSTM
  preserve_interword_spaces: '0',
};

const TESSERACT_CONFIG_WEIGHT = {
  tessedit_char_whitelist: '0123456789.,KGkgPBTARANETLIQUIDO: ',
  tessedit_pageseg_mode: '6', // Single block
  tessedit_ocr_engine_mode: '3',
  preserve_interword_spaces: '1',
};

export function useOfflineOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const recognizePlate = useCallback(async (imageDataUrl: string): Promise<PlateOCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);

    try {
      console.log('[Offline OCR] Preprocessing image for plate recognition...');
      const processedImage = await preprocessImage(imageDataUrl);
      setProgress(20);

      console.log('[Offline OCR] Running Tesseract with plate-optimized config...');
      const result = await Tesseract.recognize(processedImage, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + Math.round(m.progress * 70));
          }
        },
        ...TESSERACT_CONFIG_PLATE,
      });

      const raw = result.data.text;
      console.log('[Offline OCR] Raw plate text:', raw);
      
      const plate = cleanPlateText(raw);
      console.log('[Offline OCR] Cleaned plate:', plate);

      setProgress(100);
      return {
        plate,
        raw,
        success: plate !== null,
        source: 'offline',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR offline falhou';
      setError(message);
      console.error('[Offline OCR] Error:', err);
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
      console.log('[Offline OCR] Preprocessing image for weight recognition...');
      const processedImage = await preprocessImage(imageDataUrl);
      setProgress(20);

      console.log('[Offline OCR] Running Tesseract with weight-optimized config...');
      const result = await Tesseract.recognize(processedImage, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + Math.round(m.progress * 70));
          }
        },
        ...TESSERACT_CONFIG_WEIGHT,
      });

      const raw = result.data.text;
      console.log('[Offline OCR] Raw weight text:', raw);
      
      const weight = extractWeight(raw);
      console.log('[Offline OCR] Extracted weight:', weight);

      setProgress(100);
      return {
        weight,
        raw,
        success: weight !== null,
        source: 'offline',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OCR offline falhou';
      setError(message);
      console.error('[Offline OCR] Error:', err);
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
      console.log('[Offline OCR] Preprocessing image for dual weight recognition...');
      const processedImage = await preprocessImage(imageDataUrl);
      setProgress(20);

      console.log('[Offline OCR] Running Tesseract with weight-optimized config...');
      const result = await Tesseract.recognize(processedImage, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(20 + Math.round(m.progress * 70));
          }
        },
        ...TESSERACT_CONFIG_WEIGHT,
      });

      const raw = result.data.text;
      console.log('[Offline OCR] Raw weights text:', raw);
      
      const { tare, gross } = extractBothWeights(raw);
      console.log('[Offline OCR] Extracted weights - Tare:', tare, 'Gross:', gross);

      setProgress(100);
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
      console.error('[Offline OCR] Error:', err);
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
      console.error('[Offline OCR] Error:', err);
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
