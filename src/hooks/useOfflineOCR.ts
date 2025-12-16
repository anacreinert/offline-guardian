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

// Debug images for visualization
export interface OCRDebugImages {
  original: string;
  cropped: string;
  preprocessed: string[];
}

// Brazilian plate patterns: ABC1234 (old) or ABC1D23 (Mercosul)
const MERCOSUL_PLATE_REGEX = /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/;
const OLD_PLATE_REGEX = /^[A-Z]{3}[0-9]{4}$/;

// Words to filter out from OCR results (blue strip text)
const FILTER_WORDS = ['BRASIL', 'BRAZIL', 'MERCOSUL', 'MERCOSUR', 'BR'];

// Positional character corrections
const LETTER_CORRECTIONS: Record<string, string> = {
  '0': 'O', '1': 'I', '2': 'Z', '3': 'E', '4': 'A', '5': 'S', '6': 'G', '8': 'B', '9': 'G',
};

const NUMBER_CORRECTIONS: Record<string, string> = {
  'O': '0', 'o': '0', 'Q': '0', 'D': '0', 'C': '0',
  'I': '1', 'i': '1', 'l': '1', 'L': '1', '|': '1', 'J': '1',
  'Z': '2', 'z': '2',
  'E': '3', 'F': '3',
  'A': '4', 'h': '4', 'H': '4',
  'S': '5', 's': '5',
  'G': '6', 'b': '6',
  'T': '7', 'Y': '7',
  'B': '8',
  'g': '9', 'q': '9', 'P': '9',
};

// ============================================================================
// PLATE DETECTION - Focus on finding white rectangular region with dark text
// ============================================================================

// Detect plate by finding the white rectangular character area
async function detectPlateByContrast(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        resolve(imageDataUrl);
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Analyze each row for: brightness (white area) AND contrast (has characters)
      const rowScores: { brightness: number; contrast: number; whiteRatio: number }[] = [];
      
      for (let y = 0; y < height; y++) {
        let sumBrightness = 0;
        let minBrightness = 255, maxBrightness = 0;
        let whitePixels = 0;
        
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          const brightness = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          
          sumBrightness += brightness;
          if (brightness < minBrightness) minBrightness = brightness;
          if (brightness > maxBrightness) maxBrightness = brightness;
          
          // Count white/light pixels (plate background)
          if (brightness > 180) whitePixels++;
        }
        
        rowScores.push({
          brightness: sumBrightness / width,
          contrast: maxBrightness - minBrightness,
          whiteRatio: whitePixels / width,
        });
      }

      // Find rows that are: bright (white background) + high contrast (has characters)
      // This identifies the white character area of the plate
      let topCrop = 0, bottomCrop = height;
      let foundPlateArea = false;
      
      // Look for rows with: whiteRatio > 0.3 AND contrast > 100 (dark chars on white)
      for (let y = 0; y < height; y++) {
        const score = rowScores[y];
        if (score.whiteRatio > 0.25 && score.contrast > 80) {
          topCrop = Math.max(0, y - 5);
          foundPlateArea = true;
          break;
        }
      }
      
      if (foundPlateArea) {
        for (let y = height - 1; y > topCrop; y--) {
          const score = rowScores[y];
          if (score.whiteRatio > 0.25 && score.contrast > 80) {
            bottomCrop = Math.min(height, y + 5);
            break;
          }
        }
      }

      // Find horizontal bounds using same approach
      const colScores: { whiteRatio: number; contrast: number }[] = [];
      
      for (let x = 0; x < width; x++) {
        let whitePixels = 0;
        let minB = 255, maxB = 0;
        
        for (let y = topCrop; y < bottomCrop; y++) {
          const idx = (y * width + x) * 4;
          const brightness = Math.round(0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]);
          if (brightness > 180) whitePixels++;
          if (brightness < minB) minB = brightness;
          if (brightness > maxB) maxB = brightness;
        }
        
        const regionHeight = bottomCrop - topCrop || 1;
        colScores.push({
          whiteRatio: whitePixels / regionHeight,
          contrast: maxB - minB,
        });
      }

      let leftCrop = 0, rightCrop = width;
      
      for (let x = 0; x < width; x++) {
        if (colScores[x].whiteRatio > 0.3 && colScores[x].contrast > 60) {
          leftCrop = Math.max(0, x - 5);
          break;
        }
      }
      
      for (let x = width - 1; x > leftCrop; x--) {
        if (colScores[x].whiteRatio > 0.3 && colScores[x].contrast > 60) {
          rightCrop = Math.min(width, x + 5);
          break;
        }
      }

      const cropHeight = bottomCrop - topCrop;
      const cropWidth = rightCrop - leftCrop;
      const aspectRatio = cropWidth / Math.max(cropHeight, 1);

      // Valid plate area: decent size and reasonable aspect ratio
      if (foundPlateArea && cropHeight > height * 0.1 && cropWidth > width * 0.15 && aspectRatio >= 1.5 && aspectRatio <= 6) {
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d')!;
        
        // Add generous padding
        const padding = 20;
        croppedCanvas.width = cropWidth + padding * 2;
        croppedCanvas.height = cropHeight + padding * 2;
        
        // White background for padding (matches plate)
        croppedCtx.fillStyle = 'white';
        croppedCtx.fillRect(0, 0, croppedCanvas.width, croppedCanvas.height);
        
        croppedCtx.drawImage(
          canvas,
          leftCrop, topCrop, cropWidth, cropHeight,
          padding, padding, cropWidth, cropHeight
        );
        
        console.log(`[ROI] Found plate area: ${cropWidth}x${cropHeight}, aspect=${aspectRatio.toFixed(2)}, top=${topCrop}, bottom=${bottomCrop}`);
        resolve(croppedCanvas.toDataURL('image/png'));
      } else {
        console.log(`[ROI] No valid plate area found (h=${cropHeight}, w=${cropWidth}, ar=${aspectRatio.toFixed(2)}), using full image`);
        resolve(imageDataUrl);
      }
    };

    img.onerror = () => resolve(imageDataUrl);
    img.src = imageDataUrl;
  });
}

// ============================================================================
// SIMPLIFIED PREPROCESSING - Only 2 methods instead of 4
// ============================================================================

// Method 1: Otsu automatic thresholding - adapts to image brightness
async function preprocessOtsu(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(imageDataUrl); return; }

      const scale = 3;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert to grayscale and build histogram
      const grayscale: number[] = [];
      const histogram = new Array(256).fill(0);
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        grayscale.push(gray);
        histogram[gray]++;
      }

      // Calculate Otsu threshold
      const total = grayscale.length;
      let sum = 0;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];

      let sumB = 0, wB = 0, wF = 0;
      let maxVariance = 0, threshold = 128;

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

      console.log(`[Otsu] Calculated threshold: ${threshold}`);

      // Apply threshold
      for (let i = 0; i < grayscale.length; i++) {
        const val = grayscale[i] < threshold ? 0 : 255;
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);

      // Add padding
      const paddedCanvas = document.createElement('canvas');
      const paddedCtx = paddedCanvas.getContext('2d')!;
      const padding = 40;
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

// Method 2: Contrast stretch + adaptive threshold
async function preprocessContrastStretch(imageDataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve(imageDataUrl); return; }

      const scale = 3;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Find min/max for contrast stretching
      let minGray = 255, maxGray = 0;
      const grayscale: number[] = [];
      
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        grayscale.push(gray);
        if (gray < minGray) minGray = gray;
        if (gray > maxGray) maxGray = gray;
      }

      // Stretch histogram and apply threshold
      const range = maxGray - minGray || 1;
      const midpoint = (minGray + maxGray) / 2;

      console.log(`[ContrastStretch] Range: ${minGray}-${maxGray}, mid: ${midpoint}`);

      for (let i = 0; i < grayscale.length; i++) {
        // Stretch to 0-255
        const stretched = ((grayscale[i] - minGray) / range) * 255;
        // Apply threshold at stretched midpoint
        const val = stretched < 128 ? 0 : 255;
        data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);

      // Add padding
      const paddedCanvas = document.createElement('canvas');
      const paddedCtx = paddedCanvas.getContext('2d')!;
      const padding = 40;
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

// ============================================================================
// Generate preprocessed images for multi-pass OCR (with debug info)
// ============================================================================
interface PreprocessResult {
  images: string[];
  debug: OCRDebugImages;
}

async function multiPassPreprocess(imageDataUrl: string): Promise<PreprocessResult> {
  // First, detect and crop the plate region
  const croppedImage = await detectPlateByContrast(imageDataUrl);
  console.log('[OCR] ROI detection complete, running preprocessing...');
  
  const preprocessed = await Promise.all([
    preprocessOtsu(croppedImage),
    preprocessContrastStretch(croppedImage),
  ]);
  
  return {
    images: preprocessed,
    debug: {
      original: imageDataUrl,
      cropped: croppedImage,
      preprocessed: preprocessed,
    }
  };
}

// ============================================================================
// CHARACTER CORRECTION LOGIC (unchanged)
// ============================================================================

function applyPositionalCorrections(text: string): string {
  const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 7) return cleaned;

  let result = '';

  // Positions 0, 1, 2: ALWAYS letters
  for (let i = 0; i < 3; i++) {
    const char = cleaned[i];
    if (/[0-9]/.test(char)) {
      result += LETTER_CORRECTIONS[char] || char;
    } else {
      result += char;
    }
  }

  // Position 3: ALWAYS number
  const pos3 = cleaned[3];
  if (/[A-Z]/.test(pos3)) {
    result += NUMBER_CORRECTIONS[pos3] || pos3;
  } else {
    result += pos3;
  }

  // Position 4: Letter for Mercosul, Number for old format
  const pos4 = cleaned[4];
  const pos5 = cleaned[5];
  const pos6 = cleaned[6];

  const pos5AsNum = NUMBER_CORRECTIONS[pos5] || pos5;
  const pos6AsNum = NUMBER_CORRECTIONS[pos6] || pos6;
  const pos5IsNum = /[0-9]/.test(pos5AsNum);
  const pos6IsNum = /[0-9]/.test(pos6AsNum);

  if (pos5IsNum && pos6IsNum) {
    // Likely Mercosul format - position 4 should be a letter
    if (/[0-9]/.test(pos4)) {
      result += LETTER_CORRECTIONS[pos4] || pos4;
    } else {
      result += pos4;
    }
    result += pos5AsNum;
    result += pos6AsNum;
  } else {
    // Might be old format - position 4 should be a number
    if (/[A-Z]/.test(pos4)) {
      result += NUMBER_CORRECTIONS[pos4] || pos4;
    } else {
      result += pos4;
    }
    result += /[A-Z]/.test(pos5) ? (NUMBER_CORRECTIONS[pos5] || pos5) : pos5;
    result += /[A-Z]/.test(pos6) ? (NUMBER_CORRECTIONS[pos6] || pos6) : pos6;
  }

  return result;
}

// Generate plate variants for FE-Font misreads
function generatePlateVariants(text: string): string[] {
  const cleaned = text.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (cleaned.length !== 7) return [cleaned];

  const feReplacements: Record<string, string[]> = {
    'A': ['4', 'R', 'H', 'X', 'L'],
    'B': ['R', '8', 'D', 'P', '3', 'E', '6'],
    'C': ['G', 'O', '0', '(', 'Q'],
    'D': ['O', '0', 'B', 'P', 'Q'],
    'E': ['R', 'I', 'O', 'B', 'A', 'F', 'P', '3', 'L', 'Q'],
    'F': ['R', 'P', 'E', 'T', '7', '8'],
    'G': ['6', 'C', 'O', '9', 'Q'],
    'H': ['I', 'R', 'N', 'M', 'A', '4'],
    'I': ['1', 'L', 'T', 'J', '!', '|'],
    'J': ['1', 'I', 'U'],
    'K': ['X', 'K', 'H'],
    'L': ['1', 'I', 'J', 'P'],
    'M': ['I', 'N', 'W', 'H', 'R', 'O'],
    'N': ['M', 'H', 'W'],
    'O': ['0', 'D', 'Q', 'C', 'R', 'G'],
    'P': ['R', 'B', 'D', 'F', '9', 'L'],
    'Q': ['O', '0', 'G', '9', 'C'],
    'R': ['B', 'P', 'A', 'O'],
    'S': ['5', '8', '$'],
    'T': ['R', 'I', 'Y', '7', '1', 'F'],
    'U': ['V', 'W', 'J'],
    'V': ['U', 'W', 'Y'],
    'W': ['M', 'V', 'N'],
    'X': ['A', 'K', 'Y', '4', 'H'],
    'Y': ['V', '4', 'T'],
    'Z': ['2', '7'],
    '0': ['O', 'D', 'Q', 'C', '8'],
    '1': ['I', 'L', 'T', '7', '!', '|', '2'],
    '2': ['Z', '7', '1', '8'],
    '3': ['E', '8', 'B'],
    '4': ['A', 'H', 'Y'],
    '5': ['S', '6'],
    '6': ['G', '5', 'B'],
    '7': ['1', 'T', 'Z', '2'],
    '8': ['B', '0', '3', 'S', '2', 'F'],
    '9': ['G', 'Q', 'P', '6'],
  };

  const validVariants: string[] = [];
  const MAX_VARIANTS = 100;

  function tryGenerate(pos: number, current: string): void {
    if (validVariants.length >= MAX_VARIANTS) return;

    if (pos >= 7) {
      if (MERCOSUL_PLATE_REGEX.test(current) || OLD_PLATE_REGEX.test(current)) {
        if (!validVariants.includes(current)) {
          validVariants.push(current);
        }
      }
      return;
    }

    const char = cleaned[pos];
    const replacements = [char, ...(feReplacements[char] || [])];

    for (const rep of replacements) {
      if (validVariants.length >= MAX_VARIANTS) return;

      let validChar = rep;

      if (pos < 3) {
        if (/[0-9]/.test(rep)) {
          validChar = LETTER_CORRECTIONS[rep] || rep;
        }
        if (!/[A-Z]/.test(validChar)) continue;
      } else if (pos === 3) {
        if (/[A-Z]/.test(rep)) {
          validChar = NUMBER_CORRECTIONS[rep] || rep;
        }
        if (!/[0-9]/.test(validChar)) continue;
      } else if (pos === 4) {
        if (/[A-Z]/.test(rep)) {
          tryGenerate(pos + 1, current + rep);
          const numChar = NUMBER_CORRECTIONS[rep];
          if (numChar) tryGenerate(pos + 1, current + numChar);
          continue;
        }
      } else if (pos === 5 || pos === 6) {
        if (/[A-Z]/.test(rep)) {
          validChar = NUMBER_CORRECTIONS[rep] || rep;
        }
        if (!/[0-9]/.test(validChar)) continue;
      }

      tryGenerate(pos + 1, current + validChar);
    }
  }

  tryGenerate(0, '');
  console.log(`[OCR] Generated ${validVariants.length} valid variants from "${cleaned}"`);
  return validVariants;
}

function filterPlateText(text: string): string {
  let filtered = text.toUpperCase();
  for (const word of FILTER_WORDS) {
    filtered = filtered.replace(new RegExp(word, 'gi'), ' ');
  }
  return filtered;
}

function extractPlateCandidates(text: string): string[] {
  const candidates: string[] = [];
  const filtered = filterPlateText(text);
  const cleaned = filtered.replace(/[^A-Z0-9\s]/g, '').trim();

  const words = cleaned.split(/\s+/);

  for (const word of words) {
    if (word.length === 7) {
      candidates.push(word);
    }
    if (word.length >= 3 && word.length < 7) {
      const nextIdx = words.indexOf(word) + 1;
      if (nextIdx < words.length) {
        const combined = word + words[nextIdx];
        if (combined.length >= 7) {
          candidates.push(combined.substring(0, 7));
        }
      }
    }
  }

  const continuous = cleaned.replace(/\s+/g, '');

  const mercosulMatches = continuous.match(/[A-Z]{3}[0-9][A-Z][0-9]{2}/g);
  if (mercosulMatches) candidates.push(...mercosulMatches);

  const oldMatches = continuous.match(/[A-Z]{3}[0-9]{4}/g);
  if (oldMatches) candidates.push(...oldMatches);

  for (let i = 0; i <= continuous.length - 7; i++) {
    const segment = continuous.substring(i, i + 7);
    if (/^[A-Z0-9]{7}$/.test(segment)) {
      candidates.push(segment);
    }
  }

  return [...new Set(candidates)];
}

function findBestPlateMatch(texts: string[]): string | null {
  const candidates: { plate: string; score: number; original: string }[] = [];

  for (const text of texts) {
    const potentialPlates = extractPlateCandidates(text);

    for (const rawPlate of potentialPlates) {
      const corrected = applyPositionalCorrections(rawPlate);
      const variants = generatePlateVariants(rawPlate);
      const allPlates = [corrected, ...variants];

      for (const plate of [...new Set(allPlates)]) {
        let score = 0;

        if (MERCOSUL_PLATE_REGEX.test(plate)) {
          score = 100;
        } else if (OLD_PLATE_REGEX.test(plate)) {
          score = 95;
        } else if (plate.length === 7) {
          const letters = plate.substring(0, 3);
          const hasValidLetters = /^[A-Z]{3}$/.test(letters);
          const pos3Valid = /[0-9]/.test(plate[3]);

          if (hasValidLetters) score += 40;
          if (pos3Valid) score += 20;

          const letterCount = (plate.match(/[A-Z]/g) || []).length;
          const numberCount = (plate.match(/[0-9]/g) || []).length;
          if (letterCount >= 3 && letterCount <= 4 && numberCount >= 3) {
            score += 20;
          }
        }

        if (score > 0) {
          candidates.push({ plate, score, original: rawPlate });
        }
      }
    }
  }

  if (candidates.length === 0) return null;

  const plateCounts: Record<string, number> = {};
  for (const c of candidates) {
    plateCounts[c.plate] = (plateCounts[c.plate] || 0) + 1;
  }

  candidates.sort((a, b) => {
    const scoreA = a.score * (1 + (plateCounts[a.plate] - 1) * 0.5);
    const scoreB = b.score * (1 + (plateCounts[b.plate] - 1) * 0.5);
    return scoreB - scoreA;
  });

  const validPlates = candidates.filter(c => c.score >= 95);

  console.log('[OCR] Top candidates:', candidates.slice(0, 10).map(c =>
    `${c.plate} (score: ${c.score}, count: ${plateCounts[c.plate]}, orig: ${c.original})`
  ));

  if (validPlates.length > 0) {
    console.log('[OCR] Valid plates found:', validPlates.slice(0, 5).map(c => c.plate));
    return validPlates[0].plate;
  }

  return candidates[0]?.plate || null;
}

// ============================================================================
// TESSERACT CONFIGS - Simplified to 2 instead of 3
// ============================================================================

const TESSERACT_CONFIG_SINGLE_WORD = {
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  tessedit_pageseg_mode: '8', // Single word
  tessedit_ocr_engine_mode: '1',
  preserve_interword_spaces: '0',
};

const TESSERACT_CONFIG_SPARSE = {
  tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  tessedit_pageseg_mode: '11', // Sparse text
  tessedit_ocr_engine_mode: '1',
  preserve_interword_spaces: '0',
};

const TESSERACT_CONFIG_WEIGHT = {
  tessedit_char_whitelist: '0123456789.,KGkgPBTARANETLIQUIDO: ',
  tessedit_pageseg_mode: '6',
  tessedit_ocr_engine_mode: '3',
  preserve_interword_spaces: '1',
};

// ============================================================================
// WEIGHT EXTRACTION (unchanged)
// ============================================================================

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

      const scale = mode === 'plate' ? 3 : 2.5;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const val = gray < 128 ? 0 : 255;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
        data[i + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);

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

// ============================================================================
// HOOK IMPLEMENTATION - Reduced from 12 passes to 4
// ============================================================================

export function useOfflineOCR() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [debugImages, setDebugImages] = useState<OCRDebugImages | null>(null);

  const recognizePlate = useCallback(async (imageDataUrl: string): Promise<PlateOCRResult | null> => {
    setIsProcessing(true);
    setError(null);
    setProgress(0);
    setDebugImages(null);

    try {
      console.log('[Offline OCR] Starting simplified plate recognition (4 passes)...');

      // Generate 2 preprocessed versions (down from 4)
      const { images: processedImages, debug } = await multiPassPreprocess(imageDataUrl);
      setDebugImages(debug);
      setProgress(20);

      // Use 2 configs (down from 3)
      const configs = [TESSERACT_CONFIG_SINGLE_WORD, TESSERACT_CONFIG_SPARSE];
      const allTexts: string[] = [];

      const totalPasses = processedImages.length * configs.length; // 4 passes
      let currentPass = 0;

      for (const processedImage of processedImages) {
        for (const config of configs) {
          try {
            const result = await Tesseract.recognize(processedImage, 'eng', {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  const baseProgress = 20 + (currentPass / totalPasses) * 70;
                  setProgress(Math.round(baseProgress + (m.progress / totalPasses) * 70 * 0.8));
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
    debugImages,
    recognizePlate,
    recognizeWeight,
    recognizeBothWeights,
    recognizeProduct,
  };
}
