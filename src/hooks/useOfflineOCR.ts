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

// Advanced preprocessing with local adaptive thresholding
async function preprocessImageAdvanced(imageDataUrl: string, mode: 'plate' | 'weight' = 'plate'): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      // Higher scale for better recognition (3x for plates)
      const scale = mode === 'plate' ? 3 : 2.5;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Convert to grayscale
      const grayscale: number[] = [];
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        grayscale.push(gray);
      }

      // Calculate global Otsu threshold
      const histogram = new Array(256).fill(0);
      for (const g of grayscale) histogram[g]++;

      const total = grayscale.length;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];

      let sumB = 0, wB = 0, wF = 0;
      let maxVariance = 0, globalThreshold = 128;

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
          globalThreshold = t;
        }
      }

      // Apply LOCAL adaptive thresholding (better for angled/uneven lighting)
      const blockSize = mode === 'plate' ? 25 : 15;
      const C = mode === 'plate' ? 10 : 5;
      const binaryData: number[] = [];

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const halfBlock = Math.floor(blockSize / 2);

          // Calculate local mean
          let localSum = 0, count = 0;
          for (let by = -halfBlock; by <= halfBlock; by++) {
            for (let bx = -halfBlock; bx <= halfBlock; bx++) {
              const ny = y + by, nx = x + bx;
              if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                localSum += grayscale[ny * width + nx];
                count++;
              }
            }
          }

          const localMean = localSum / count;
          // Combine local and global thresholds
          const threshold = Math.min(globalThreshold * 0.95, localMean - C);
          binaryData.push(grayscale[idx] < threshold ? 0 : 255);
        }
      }

      // Morphological cleaning (remove small noise)
      const cleaned = morphologicalClean(binaryData, width, height);

      // Apply to image data
      for (let i = 0; i < cleaned.length; i++) {
        const val = cleaned[i];
        data[i * 4] = val;
        data[i * 4 + 1] = val;
        data[i * 4 + 2] = val;
        data[i * 4 + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);

      // Add padding for edge characters
      const paddedCanvas = document.createElement('canvas');
      const paddedCtx = paddedCanvas.getContext('2d')!;
      const padding = 20;
      paddedCanvas.width = canvas.width + padding * 2;
      paddedCanvas.height = canvas.height + padding * 2;
      paddedCtx.fillStyle = 'white';
      paddedCtx.fillRect(0, 0, paddedCanvas.width, paddedCanvas.height);
      paddedCtx.drawImage(canvas, padding, padding);

      resolve(paddedCanvas.toDataURL('image/png'));
    };

    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

// Morphological opening to clean noise
function morphologicalClean(data: number[], width: number, height: number): number[] {
  const kernel = 1;

  // Erosion
  const eroded: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let minVal = 255;
      for (let ky = -kernel; ky <= kernel; ky++) {
        for (let kx = -kernel; kx <= kernel; kx++) {
          const ny = y + ky, nx = x + kx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            minVal = Math.min(minVal, data[ny * width + nx]);
          }
        }
      }
      eroded.push(minVal);
    }
  }

  // Dilation
  const result: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let maxVal = 0;
      for (let ky = -kernel; ky <= kernel; ky++) {
        for (let kx = -kernel; kx <= kernel; kx++) {
          const ny = y + ky, nx = x + kx;
          if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
            maxVal = Math.max(maxVal, eroded[ny * width + nx]);
          }
        }
      }
      result.push(maxVal);
    }
  }

  return result;
}

// High contrast preprocessing variant
async function preprocessHighContrast(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(imageDataUrl); return; }

      const scale = 3;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Very aggressive threshold for high contrast
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = gray < 100 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

// Inverted preprocessing for different plate colors
async function preprocessInverted(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(imageDataUrl); return; }

      const scale = 3;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Invert: dark becomes light
        const val = gray > 128 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

// Enhanced contrast with CLAHE-like approach
async function preprocessEnhancedContrast(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(imageDataUrl); return; }

      const scale = 3;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Find min/max for contrast stretching
      let minGray = 255, maxGray = 0;
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        minGray = Math.min(minGray, gray);
        maxGray = Math.max(maxGray, gray);
      }

      const range = maxGray - minGray || 1;

      // Apply contrast stretching then threshold
      for (let i = 0; i < data.length; i += 4) {
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const stretched = ((gray - minGray) / range) * 255;
        const val = stretched < 128 ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

// Generate multiple preprocessed versions for multi-pass OCR
async function multiPassPreprocess(imageDataUrl: string): Promise<string[]> {
  const results = await Promise.all([
    preprocessImageAdvanced(imageDataUrl, 'plate'),
    preprocessHighContrast(imageDataUrl),
    preprocessInverted(imageDataUrl),
    preprocessEnhancedContrast(imageDataUrl),
  ]);
  return results;
}

function applyPlateCorrections(text: string): string {
  const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 7) return cleaned;

  let result = '';

  // Positions 0,1,2 should be letters
  for (let i = 0; i < 3; i++) {
    const char = cleaned[i];
    result += NUM_CHAR_CORRECTIONS[char]
      ? Object.entries(PLATE_CHAR_CORRECTIONS).find(([_, v]) => v === char)?.[1] || char
      : char;
  }

  // Position 3 should be number
  const pos3 = cleaned[3];
  result += NUM_CHAR_CORRECTIONS[pos3] || pos3;

  // Position 4 could be letter (Mercosul) or number (old)
  const pos4 = cleaned[4];
  const asNum = NUM_CHAR_CORRECTIONS[pos4] || pos4;
  const isDigit = /[0-9]/.test(asNum);

  if (isDigit) {
    result += asNum;
    for (let i = 5; i < 7; i++) {
      const char = cleaned[i];
      result += NUM_CHAR_CORRECTIONS[char] || char;
    }
  } else {
    result += pos4;
    for (let i = 5; i < 7; i++) {
      const char = cleaned[i];
      result += NUM_CHAR_CORRECTIONS[char] || char;
    }
  }

  return result;
}

function cleanPlateText(text: string): string | null {
  const variations = [
    text,
    text.replace(/[^A-Za-z0-9\s]/g, ''),
    text.replace(/\s+/g, ''),
  ];

  for (const variation of variations) {
    const corrected = applyPlateCorrections(variation);
    if (MERCOSUL_PLATE_REGEX.test(corrected) || OLD_PLATE_REGEX.test(corrected)) {
      return corrected;
    }
  }

  const allText = text.replace(/\s+/g, '').toUpperCase();

  for (let i = 0; i <= allText.length - 7; i++) {
    const segment = allText.substring(i, i + 7);
    const corrected = applyPlateCorrections(segment);
    if (MERCOSUL_PLATE_REGEX.test(corrected) || OLD_PLATE_REGEX.test(corrected)) {
      return corrected;
    }
  }

  const mercosulMatch = allText.match(/[A-Z0-9]{3}[0-9A-Z][A-Z0-9][0-9A-Z]{2}/);
  if (mercosulMatch) {
    const corrected = applyPlateCorrections(mercosulMatch[0]);
    if (MERCOSUL_PLATE_REGEX.test(corrected) || OLD_PLATE_REGEX.test(corrected)) {
      return corrected;
    }
  }

  return null;
}

// Find best plate from multiple OCR attempts
function findBestPlateMatch(texts: string[]): string | null {
  const candidates: { plate: string; score: number }[] = [];

  for (const text of texts) {
    // Try direct cleaning
    const cleaned = cleanPlateText(text);
    if (cleaned) {
      const isValid = MERCOSUL_PLATE_REGEX.test(cleaned) || OLD_PLATE_REGEX.test(cleaned);
      candidates.push({ plate: cleaned, score: isValid ? 100 : 50 });
    }

    // Try finding patterns in raw text
    const patterns = [
      /[A-Z]{3}[0-9][A-Z][0-9]{2}/g,
      /[A-Z]{3}[0-9]{4}/g,
      /[A-Z0-9]{7}/g,
    ];

    for (const pattern of patterns) {
      const matches = text.toUpperCase().match(pattern);
      if (matches) {
        for (const match of matches) {
          const corrected = applyPlateCorrections(match);
          const isValid = MERCOSUL_PLATE_REGEX.test(corrected) || OLD_PLATE_REGEX.test(corrected);
          if (isValid) {
            candidates.push({ plate: corrected, score: 100 });
          } else if (corrected.length === 7) {
            candidates.push({ plate: corrected, score: 40 });
          }
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  // Count occurrences - plates that appear multiple times are more reliable
  const plateCounts: Record<string, number> = {};
  for (const c of candidates) {
    plateCounts[c.plate] = (plateCounts[c.plate] || 0) + 1;
  }

  // Sort by (occurrences * score)
  candidates.sort((a, b) => {
    const scoreA = a.score * (plateCounts[a.plate] || 1);
    const scoreB = b.score * (plateCounts[b.plate] || 1);
    return scoreB - scoreA;
  });

  return candidates[0].plate;
}

function extractWeight(text: string): number | null {
  let cleaned = text
    .replace(/[oO]/g, '0')
    .replace(/[lI|]/g, '1')
    .replace(/[Ss]/g, '5')
    .replace(/[Bb]/g, '8')
    .replace(/[Zz]/g, '2')
    .replace(/[Gg]/g, '9')
    .replace(/\s+/g, ' ')
    .trim();

  const patterns = [
    /(\d{1,3})[.,](\d{3})\s*(?:kg|KG)?/,
    /(\d{4,6})\s*(?:kg|KG)?/,
    /(\d{1,3})[.,](\d{3})[.,](\d{3})/,
    /(?:PBT|PESO|BRUTO|TARA|NET|LIQUIDO)[:\s]*(\d{1,3}[.,]?\d{0,3})\s*(?:kg|KG)?/i,
    /^(\d{3,6})$/m,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match) {
      const numParts = match.slice(1).filter(Boolean);
      const numStr = numParts.join('').replace(/[.,]/g, '');
      const weight = parseInt(numStr, 10);

      if (weight >= 500 && weight <= 80000) return weight;
      if (weight >= 1 && weight <= 80) return weight * 1000;
    }
  }

  const numbers = cleaned.match(/\d+/g);
  if (numbers) {
    for (const num of numbers) {
      const weight = parseInt(num, 10);
      if (weight >= 500 && weight <= 80000) return weight;
    }
  }

  return null;
}

function extractBothWeights(text: string): { tare: number | null; gross: number | null } {
  const lines = text.split('\n').filter((l) => l.trim());
  const weights: number[] = [];
  const labeledWeights: { tare?: number; gross?: number } = {};

  const tareMatch = text.match(/(?:TARA|T)[:\s]*(\d{1,3}[.,]?\d{0,3})\s*(?:kg|KG)?/i);
  const grossMatch = text.match(/(?:PBT|BRUTO|PESO\s*BRUTO|GROSS)[:\s]*(\d{1,3}[.,]?\d{0,3})\s*(?:kg|KG)?/i);

  if (tareMatch) {
    const numStr = tareMatch[1].replace(/[.,]/g, '');
    const weight = parseInt(numStr, 10);
    if (weight >= 500 && weight <= 30000) labeledWeights.tare = weight;
  }

  if (grossMatch) {
    const numStr = grossMatch[1].replace(/[.,]/g, '');
    const weight = parseInt(numStr, 10);
    if (weight >= 500 && weight <= 80000) labeledWeights.gross = weight;
  }

  if (labeledWeights.tare || labeledWeights.gross) {
    return { tare: labeledWeights.tare || null, gross: labeledWeights.gross || null };
  }

  for (const line of lines) {
    const weight = extractWeight(line);
    if (weight) weights.push(weight);
  }

  if (weights.length >= 2) {
    const sorted = [...new Set(weights)].sort((a, b) => a - b);
    return { tare: sorted[0], gross: sorted[sorted.length - 1] };
  }

  if (weights.length === 1) return { tare: null, gross: weights[0] };
  return { tare: null, gross: null };
}

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

// Tesseract configurations
const TESSERACT_CONFIG_PLATE_LINE = {
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  tessedit_pageseg_mode: '7', // Single line
  tessedit_ocr_engine_mode: '3',
  preserve_interword_spaces: '0',
};

const TESSERACT_CONFIG_PLATE_BLOCK = {
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  tessedit_pageseg_mode: '6', // Single block
  tessedit_ocr_engine_mode: '3',
  preserve_interword_spaces: '0',
};

const TESSERACT_CONFIG_PLATE_SPARSE = {
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  tessedit_pageseg_mode: '11', // Sparse text
  tessedit_ocr_engine_mode: '3',
  preserve_interword_spaces: '0',
};

const TESSERACT_CONFIG_WEIGHT = {
  tessedit_char_whitelist: '0123456789.,KGkgPBTARANETLIQUIDO: ',
  tessedit_pageseg_mode: '6',
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
      console.log('[Offline OCR] Starting multi-pass plate recognition...');

      // Generate multiple preprocessed versions
      const processedImages = await multiPassPreprocess(imageDataUrl);
      setProgress(15);

      const configs = [TESSERACT_CONFIG_PLATE_LINE, TESSERACT_CONFIG_PLATE_BLOCK, TESSERACT_CONFIG_PLATE_SPARSE];
      const allTexts: string[] = [];

      const totalPasses = processedImages.length * configs.length;
      let currentPass = 0;

      // Run multiple OCR passes with different preprocessing and configs
      for (const processedImage of processedImages) {
        for (const config of configs) {
          try {
            const result = await Tesseract.recognize(processedImage, 'eng', {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  const baseProgress = 15 + (currentPass / totalPasses) * 75;
                  const passProgress = (m.progress / totalPasses) * 75;
                  setProgress(Math.round(baseProgress + passProgress * 0.8));
                }
              },
              ...config,
            });

            const text = result.data.text.toUpperCase().trim();
            if (text) {
              allTexts.push(text);
              console.log(`[Offline OCR] Pass ${currentPass + 1}/${totalPasses}: "${text}"`);
            }
          } catch (e) {
            console.warn(`[Offline OCR] Pass ${currentPass + 1} failed:`, e);
          }
          currentPass++;
        }
      }

      // Find best plate from all attempts
      const plate = findBestPlateMatch(allTexts);
      const raw = allTexts.join(' | ');

      console.log('[Offline OCR] All results:', allTexts);
      console.log('[Offline OCR] Best plate:', plate);

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
      const processedImage = await preprocessImageAdvanced(imageDataUrl, 'weight');
      setProgress(20);

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
      const processedImage = await preprocessImageAdvanced(imageDataUrl, 'weight');
      setProgress(20);

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
