/**
 * Scanned PDF Processor with Advanced Image Preprocessing for OCR.
 *
 * Pipeline:
 * 1. PDF page rendering at 3.0x scale via PDF.js.
 * 2. Preprocessing pipeline:
 *    - Grayscale conversion
 *    - Contrast enhancement (Histogram stretching)
 *    - Denoise (3x3 Median filter)
 *    - Deskew (Rotation alignment)
 *    - Adaptive Thresholding (Otsu's binarization)
 * 3. OCR execution using Tesseract.js.
 * 4. Reading order preservation via spatial bounding box alignment (Y top-to-bottom, X left-to-right).
 */

import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  const localWorker = typeof pdfWorker === "string" && pdfWorker ? pdfWorker : null;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    localWorker || "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs";
}

export interface ScannedPDFExtractResult {
  lines: string[];
  fullText: string;
  pageCount: number;
  totalPages: number;
  warnings: string[];
}

export interface OCRProgressCallback {
  (status: string, percent: number): void;
}

/**
 * 1. Grayscale Conversion
 */
function applyGrayscale(d: Uint8ClampedArray): void {
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = gray;
  }
}

/**
 * 2. Contrast Enhancement (Linear Histogram Stretching)
 */
function applyContrastEnhancement(d: Uint8ClampedArray): void {
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
 * 3. Denoise (3x3 Median Filter)
 */
function applyDenoise(imageData: ImageData, width: number, height: number): void {
  const src = new Uint8ClampedArray(imageData.data);
  const dst = imageData.data;
  const windowBuf = new Array(9);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let idx = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const pos = ((y + dy) * width + (x + dx)) * 4;
          windowBuf[idx++] = src[pos];
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
 * 4. Deskew Angle Detection
 * Estimates tilt angle between -5 and +5 degrees using projection variance.
 */
function detectSkewAngle(d: Uint8ClampedArray, width: number, height: number): number {
  let bestAngle = 0;
  let maxVar = 0;

  // Sample every 4th line for speed
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

/**
 * Rotates canvas if skew angle is non-zero.
 */
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
 * 5. Adaptive Thresholding (Otsu's Method)
 */
function applyAdaptiveThreshold(d: Uint8ClampedArray, width: number, height: number): void {
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
 * Full Preprocessing Pipeline for OCR Canvas.
 * Applies: Grayscale -> Contrast -> Denoise -> Deskew -> Adaptive Thresholding.
 */
export function preprocessCanvasImage(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const w = canvas.width;
  const h = canvas.height;
  const imageData = ctx.getImageData(0, 0, w, h);
  const d = imageData.data;

  // Step A: Grayscale
  applyGrayscale(d);

  // Step B: Contrast Enhancement
  applyContrastEnhancement(d);

  // Step C: Denoise (Median filter)
  applyDenoise(imageData, w, h);

  // Step D: Deskew
  const angle = detectSkewAngle(d, w, h);
  ctx.putImageData(imageData, 0, 0);

  if (Math.abs(angle) >= 0.5) {
    rotateCanvas(canvas, ctx, angle);
  }

  // Step E: Adaptive Thresholding
  const refreshedData = ctx.getImageData(0, 0, w, h);
  applyAdaptiveThreshold(refreshedData.data, w, h);
  ctx.putImageData(refreshedData, 0, 0);
}

/**
 * Clean up common OCR artifacts.
 */
function cleanOCRTextLine(line: string): string {
  return line
    .replace(/\bl\b/g, "1")
    .replace(/\bO\b/g, "0")
    .replace(/(\d)\.(\d{3})\.(\d{2})\b/g, "$1,$2.$3")
    .replace(/(\d),\s+(\d{2,3})/g, "$1,$2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Main Scanned PDF Processing Engine.
 * Renders pages via PDF.js, preprocesses canvas, runs Tesseract OCR,
 * and sorts output to preserve spatial reading order.
 */
export async function processScannedPDF(
  file: File,
  onProgress?: OCRProgressCallback
): Promise<ScannedPDFExtractResult> {
  onProgress?.("Initializing Tesseract OCR worker...", 5);
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    onProgress?.("Opening Scanned PDF with PDF.js...", 10);
    const buf = await file.arrayBuffer();
    const doc = await pdfjsLib.getDocument({ data: buf, disableFontFace: true }).promise;
    const pageCount = Math.min(doc.numPages, 60);
    const allLines: string[] = [];
    const warnings: string[] = ["Processed using PDF.js Canvas + Tesseract OCR."];

    for (let p = 1; p <= pageCount; p++) {
      const pctBase = 10 + ((p - 1) / pageCount) * 85;
      onProgress?.(`Rendering & Preprocessing Page ${p}/${pageCount}...`, pctBase);

      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 3.0 });

      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Apply image preprocessing pipeline (Grayscale, Denoise, Deskew, Adaptive Threshold)
      preprocessCanvasImage(canvas, ctx);

      onProgress?.(`Running OCR Recognition on Page ${p}/${pageCount}...`, pctBase + 40 / pageCount);
      const dataUrl = canvas.toDataURL("image/png");
      const { data } = await worker.recognize(dataUrl);

      // Preserve reading order via spatial coordinate sorting (Y descending, X ascending)
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
        // Sort reading order: Y top-to-bottom, X left-to-right
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

        pageLines = rows
          .map((row) => {
            row.sort((a, b) => a.x - b.x);
            let line = row[0].str;
            for (let i = 1; i < row.length; i++) {
              const gap = row[i].x - (row[i - 1].x + row[i - 1].w);
              const avgCharW = row[i - 1].w / Math.max(1, row[i - 1].str.length);
              if (gap > avgCharW * 3) {
                line += "  " + row[i].str;
              } else {
                line += " " + row[i].str;
              }
            }
            return cleanOCRTextLine(line);
          })
          .filter(Boolean);
      } else {
        pageLines = (data.text || "")
          .split("\n")
          .map((l: string) => cleanOCRTextLine(l))
          .filter(Boolean);
      }

      allLines.push(...pageLines);
      try { page.cleanup(); } catch { /* ignore */ }
      canvas.width = 0;
      canvas.height = 0;
    }

    try { await (doc as any)?.destroy?.(); } catch { /* ignore */ }
    onProgress?.("OCR Text Extraction Complete!", 100);

    return {
      lines: allLines,
      fullText: allLines.join("\n"),
      pageCount,
      totalPages: doc.numPages,
      warnings,
    };
  } finally {
    await worker.terminate();
  }
}
