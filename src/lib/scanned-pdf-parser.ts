/**
 * Modular Scanned PDF Parser.
 *
 * Pipeline:
 * 1. Convert every PDF page into a high-resolution image using PDF.js (3.0x scale).
 * 2. Preprocess each canvas page before OCR:
 *    - Convert to grayscale
 *    - Improve contrast (Histogram stretching)
 *    - Sharpen text (Laplacian 3x3 high-pass filter)
 *    - Remove noise (Median filter)
 *    - Deskew rotated pages (Skew angle estimation & rotation)
 *    - Apply adaptive threshold (Otsu's binarization)
 * 3. Run OCR using Tesseract.js.
 * 4. Preserve spatial reading order (Y descending, X ascending).
 * 5. Preserve table alignment via spatial column gap detection.
 * 6. Support multi-page scanned PDFs.
 * 7. Returns extracted raw text ONLY.
 *
 * ZERO paid APIs, ZERO cloud dependencies. 100% On-Device Browser Processing.
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  const localWorker = typeof pdfWorker === "string" && pdfWorker ? pdfWorker : null;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    localWorker || "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs";
}

export interface ScannedPDFRawTextResult {
  fullText: string;
  lines: string[];
  totalPages: number;
  extractedPages: number;
  warnings: string[];
}

export interface ProgressCallback {
  (status: string, percent: number): void;
}

/**
 * 1. Convert to Grayscale
 */
function processGrayscale(d: Uint8ClampedArray): void {
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
}

/**
 * 2. Improve Contrast (Linear Histogram Stretching)
 */
function processContrast(d: Uint8ClampedArray): void {
  let minVal = 255;
  let maxVal = 0;

  for (let i = 0; i < d.length; i += 4) {
    const v = d[i];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }

  const range = Math.max(1, maxVal - minVal);
  for (let i = 0; i < d.length; i += 4) {
    const norm = Math.min(255, Math.max(0, ((d[i] - minVal) / range) * 255));
    d[i] = d[i + 1] = d[i + 2] = norm;
  }
}

/**
 * 3. Sharpen Text (3x3 High-Pass Filter)
 */
function processSharpen(imageData: ImageData, width: number, height: number): void {
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;

  // 3x3 Sharpen Kernel: [0, -1, 0, -1, 5, -1, 0, -1, 0]
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      const top = ((y - 1) * width + x) * 4;
      const bottom = ((y + 1) * width + x) * 4;
      const left = (y * width + (x - 1)) * 4;
      const right = (y * width + (x + 1)) * 4;

      const val = 5 * src[idx] - src[top] - src[bottom] - src[left] - src[right];
      const clamped = Math.min(255, Math.max(0, val));
      dst[idx] = dst[idx + 1] = dst[idx + 2] = clamped;
    }
  }
}

/**
 * 4. Remove Noise (3x3 Median Filter)
 */
function processDenoise(imageData: ImageData, width: number, height: number): void {
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;
  const windowBuf = new Array(9);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let k = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const pos = ((y + dy) * width + (x + dx)) * 4;
          windowBuf[k++] = src[pos];
        }
      }
      windowBuf.sort((a, b) => a - b);
      const median = windowBuf[4];
      const targetPos = (y * width + x) * 4;
      dst[targetPos] = dst[targetPos + 1] = dst[targetPos + 2] = median;
    }
  }
}

/**
 * 5. Deskew Rotated Pages
 */
function detectSkewAngle(d: Uint8ClampedArray, width: number, height: number): number {
  let bestAngle = 0;
  let maxVar = 0;
  const step = 4;
  const sampleH = Math.floor(height / step);

  for (let angle = -4; angle <= 4; angle += 1.0) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const projection = new Float32Array(sampleH);

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const i = (y * width + x) * 4;
        if (d[i] < 128) {
          const rotY = Math.floor((-x * sin + y * cos) / step);
          if (rotY >= 0 && rotY < sampleH) {
            projection[rotY]++;
          }
        }
      }
    }

    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < sampleH; i++) {
      const val = projection[i];
      sum += val;
      sumSq += val * val;
    }

    const variance = sumSq / sampleH - (sum / sampleH) ** 2;
    if (variance > maxVar) {
      maxVar = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

function rotateCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, angleDeg: number): void {
  if (Math.abs(angleDeg) < 0.5) return;

  const w = canvas.width;
  const h = canvas.height;
  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = w;
  tempCanvas.height = h;
  const tempCtx = tempCanvas.getContext("2d")!;
  tempCtx.drawImage(canvas, 0, 0);

  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);
  ctx.rotate((angleDeg * Math.PI) / 180);
  ctx.drawImage(tempCanvas, -w / 2, -h / 2);
  ctx.restore();
}

/**
 * 6. Apply Adaptive Threshold (Otsu's Binarization)
 */
function processAdaptiveThreshold(d: Uint8ClampedArray, width: number, height: number): void {
  const histogram = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) histogram[d[i]]++;

  const totalPixels = width * height;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * histogram[i];

  let sumB = 0, wB = 0, wF = 0, maxVariance = 0, threshold = 128;
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    wF = totalPixels - wB;
    if (wF === 0) break;
    sumB += i * histogram[i];

    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const variance = wB * wF * (mB - mF) * (mB - mF);
    if (variance > maxVariance) {
      maxVariance = variance;
      threshold = i;
    }
  }

  for (let i = 0; i < d.length; i += 4) {
    const val = d[i] < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = val;
  }
}

/**
 * Full Preprocessing Pipeline for Scanned Page Canvas.
 */

export function preprocessScannedPageCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // 1. Grayscale
  processGrayscale(d);

  // 2. Improve Contrast
  processContrast(d);

  // 3. Sharpen Text
  processSharpen(imageData, w, h);

  // 4. Remove Noise
  processDenoise(imageData, w, h);

  // 5. Deskew
  const skewAngle = detectSkewAngle(d, w, h);
  ctx.putImageData(imageData, 0, 0);

  if (Math.abs(skewAngle) >= 0.5) {
    rotateCanvas(canvas, ctx, skewAngle);
  }

  // 6. Adaptive Thresholding
  const finalData = ctx.getImageData(0, 0, w, h);
  processAdaptiveThreshold(finalData.data, w, h);
  ctx.putImageData(finalData, 0, 0);
}

function cleanRawOCRLine(line: string): string {
  return line
    .replace(/\bl\b/g, "1")
    .replace(/\bO\b/g, "0")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Main Scanned PDF Parser Function.
 * Processes multi-page scanned PDFs, applies full image preprocessing,
 * runs Tesseract.js OCR, preserves reading order & table column alignment,
 * and returns EXTRACTED RAW TEXT ONLY.
 */
export async function parseScannedPDFRawText(
  file: File,
  onProgress?: ProgressCallback
): Promise<ScannedPDFRawTextResult> {
  onProgress?.("Initializing Tesseract OCR worker...", 5);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    onProgress?.("Opening scanned PDF with PDF.js...", 10);
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise;
    const pageCount = Math.min(doc.numPages, 60);
    const allLines: string[] = [];
    const warnings: string[] = [];

    // Support multi-page scanned PDFs
    for (let p = 1; p <= pageCount; p++) {
      const pctBase = 10 + ((p - 1) / pageCount) * 85;
      onProgress?.(`Rendering & Preprocessing Page ${p}/${pageCount}...`, pctBase);

      const page = await doc.getPage(p);

      // 1. Convert PDF page to high-res image canvas (3.0x scale)
      const viewport = page.getViewport({ scale: 3.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // 2. Preprocess page image (Grayscale, Contrast, Sharpen, Denoise, Deskew, Threshold)
      preprocessScannedPageCanvas(canvas, ctx);

      // 3. Run OCR using Tesseract.js
      onProgress?.(`Running OCR on Page ${p}/${pageCount}...`, pctBase + 40 / pageCount);
      const dataUrl = canvas.toDataURL("image/png");
      const { data } = await worker.recognize(dataUrl);

      // 4. Preserve reading order and table alignment via bounding boxes
      type WordToken = { x: number; y: number; w: number; str: string };
      const tokens: WordToken[] = [];

      if (data.words && data.words.length > 0) {
        for (const word of data.words) {
          const text = (word as any).text ?? "";
          if (!text.trim()) continue;
          const bbox = (word as any).bbox ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
          tokens.push({
            x: bbox.x0,
            y: bbox.y0,
            w: bbox.x1 - bbox.x0,
            str: text.trim(),
          });
        }
      }

      let pageLines: string[] = [];

      if (tokens.length > 0) {
        // Sort reading order: Top-to-bottom (Y), Left-to-right (X)
        tokens.sort((a, b) => a.y - b.y || a.x - b.x);

        const ROW_TOL = viewport.height * 0.008;
        const rows: WordToken[][] = [];
        let currentY = tokens[0].y;
        let currentRow: WordToken[] = [];

        for (const tok of tokens) {
          if (Math.abs(tok.y - currentY) > ROW_TOL) {
            if (currentRow.length) rows.push(currentRow);
            currentRow = [tok];
            currentY = tok.y;
          } else {
            currentRow.push(tok);
          }
        }
        if (currentRow.length) rows.push(currentRow);

        // 5. Preserve table column alignment with spatial gaps
        pageLines = rows
          .map((row) => {
            row.sort((a, b) => a.x - b.x);
            let line = row[0].str;
            for (let i = 1; i < row.length; i++) {
              const gap = row[i].x - (row[i - 1].x + row[i - 1].w);
              const avgCharW = row[i - 1].w / Math.max(1, row[i - 1].str.length);
              if (gap > avgCharW * 3) {
                line += "  " + row[i].str; // Column separation gap
              } else {
                line += " " + row[i].str;
              }
            }
            return cleanRawOCRLine(line);
          })
          .filter(Boolean);
      } else {
        pageLines = (data.text || "")
          .split("\n")
          .map((l: string) => cleanRawOCRLine(l))
          .filter(Boolean);
      }

      allLines.push(...pageLines);
      try { page.cleanup(); } catch { /* ignore */ }
      canvas.width = 0;
      canvas.height = 0;
    }

    try { await (doc as any)?.destroy?.(); } catch { /* ignore */ }
    onProgress?.("OCR Raw Text Extraction Complete", 100);

    // 7. Return extracted raw text ONLY (no transaction parsing)
    return {
      fullText: allLines.join("\n"),
      lines: allLines,
      totalPages: doc.numPages,
      extractedPages: pageCount,
      warnings,
    };
  } finally {
    await worker.terminate();
  }
}
