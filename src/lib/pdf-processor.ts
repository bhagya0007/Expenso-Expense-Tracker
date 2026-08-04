/**
 * Modular PDF Processing Layer for Expenso.
 *
 * Uses PDF.js for digital text extraction and canvas rendering, with
 * Tesseract.js for scanned document OCR.
 */
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  const localWorker = typeof pdfWorker === "string" && pdfWorker ? pdfWorker : null;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    localWorker || "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs";
}

export type PDFType = "digital" | "scanned" | "encrypted" | "invalid";

export interface PDFToken {
  x: number;
  y: number;
  str: string;
}

export interface ProcessedPage {
  pageNumber: number;
  lines: string[];
  tokenCount: number;
}

export interface ProcessedPDFDocument {
  pdfType: "digital" | "scanned";
  totalPages: number;
  extractedPages: number;
  skippedPages: number;
  lines: string[];
  rawTokensCount: number;
  warnings: string[];
}

export interface PDFProcessProgress {
  stage: "opening" | "detecting" | "extracting_digital" | "rendering_ocr" | "complete";
  message: string;
  percent: number;
}

const MAX_PAGES = 60;
const PAGE_TIMEOUT_MS = 4500;
const PAGE_BATCH_SIZE = 3;
const EXTRACTION_BUDGET_MS = 35_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`${label} timed out`)), ms);
    }),
  ]);
}

function yieldToBrowser() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Validates that the provided file is a PDF.
 */
export function isPDFFile(file: File): boolean {
  if (!file) return false;
  const hasPdfExtension = file.name.toLowerCase().endsWith(".pdf");
  const hasPdfType = file.type === "application/pdf" || file.type === "";
  return hasPdfExtension && hasPdfType;
}

/**
 * Preprocesses a canvas context for maximum OCR accuracy.
 * Converts to grayscale and applies Otsu's adaptive binarization threshold.
 */
export function preprocessCanvasForOCR(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const d = imageData.data;

  // Convert to grayscale
  for (let i = 0; i < d.length; i += 4) {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = gray;
  }

  // Otsu's binarization threshold
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

  // Apply threshold
  for (let i = 0; i < d.length; i += 4) {
    const v = d[i] < threshold ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Clean up OCR line noise and misread characters.
 */
function ocrCleanLine(line: string): string {
  return line
    .replace(/\bl\b/g, "1")
    .replace(/\bO\b/g, "0")
    .replace(/(\d)\.(\d{3})\.(\d{2})\b/g, "$1,$2.$3")
    .replace(/(\d),\s+(\d{2,3})/g, "$1,$2")
    .replace(/(\d)\s+(\d{3})(?=\.\d{2}\b)/g, "$1,$2")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts digital PDF text using PDF.js text layer tokens (`getTextContent`).
 */
export async function extractDigitalPDFText(file: File): Promise<{
  lines: string[];
  pageCount: number;
  totalPages: number;
  skippedPages: number;
  totalTokens: number;
  warnings: string[];
}> {
  const buf = await file.arrayBuffer();
  let doc: any = null;

  try {
    const loadingTask = pdfjsLib.getDocument({
      data: buf,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false,
    });
    doc = await withTimeout(loadingTask.promise, 15_000, "Opening PDF");
  } catch (err: any) {
    if (err?.name === "PasswordException" || /password/i.test(String(err))) {
      throw new Error("This PDF appears to be password-protected. Please remove password protection and retry.");
    }
    throw err;
  }

  try {
    const pageCount = Math.min(doc.numPages, MAX_PAGES);
    const skippedPages = Math.max(0, doc.numPages - pageCount);
    const warnings: string[] = [];
    const startedAt = Date.now();
    const perPageLines: string[][] = Array.from({ length: pageCount }, () => []);
    let totalTokens = 0;

    for (let start = 1; start <= pageCount; start += PAGE_BATCH_SIZE) {
      if (Date.now() - startedAt > EXTRACTION_BUDGET_MS) {
        warnings.push("Large PDF limit reached; imported available pages.");
        break;
      }
      const end = Math.min(start + PAGE_BATCH_SIZE - 1, pageCount);
      await Promise.all(
        Array.from({ length: end - start + 1 }, (_, k) => start + k).map(async (p) => {
          let page: any = null;
          try {
            page = await withTimeout(doc.getPage(p), PAGE_TIMEOUT_MS, `Loading page ${p}`);
            const content = await withTimeout(page.getTextContent(), PAGE_TIMEOUT_MS, `Reading page ${p}`);

            const tokens: PDFToken[] = [];
            if (content && Array.isArray((content as any).items)) {
              for (const item of (content as any).items) {
                if (!item || typeof (item as any).str !== "string") continue;
                const s = (item as any).str;
                if (!s.trim()) continue;
                const tx = Array.isArray((item as any).transform) ? (item as any).transform : [1, 0, 0, 1, 0, 0];
                tokens.push({
                  x: Number(tx[4]) || 0,
                  y: Number(tx[5]) || 0,
                  str: s,
                });
              }
            }

            totalTokens += tokens.length;
            if (tokens.length === 0) {
              perPageLines[p - 1] = [];
              return;
            }

            tokens.sort((a, b) => b.y - a.y || a.x - b.x);

            const TOL = 6;
            let currentY = Infinity;
            let currentRow: PDFToken[] = [];
            const out: string[] = [];
            const flush = () => {
              if (!currentRow.length) return;
              currentRow.sort((a, b) => a.x - b.x);
              const line = currentRow.map((t) => t.str).join(" ").replace(/\s+/g, " ").trim();
              if (line) out.push(line);
              currentRow = [];
            };

            for (const tok of tokens) {
              if (Math.abs(tok.y - currentY) > TOL) {
                flush();
                currentY = tok.y;
              }
              currentRow.push(tok);
            }
            flush();

            perPageLines[p - 1] = out;
          } catch (err) {
            warnings.push(`Page ${p} could not be read quickly and was skipped.`);
            perPageLines[p - 1] = [];
          } finally {
            try { page?.cleanup(); } catch { /* ignore */ }
          }
        })
      );
      await yieldToBrowser();
    }

    const lines = perPageLines.flat();
    return {
      lines,
      pageCount,
      totalPages: doc.numPages,
      skippedPages,
      totalTokens,
      warnings,
    };
  } finally {
    try { await doc?.destroy?.(); } catch { /* ignore */ }
  }
}

/**
 * Renders PDF pages to Canvas using PDF.js and runs Tesseract OCR.
 */
export async function extractScannedPDFText(
  file: File,
  onProgress?: (progress: PDFProcessProgress) => void
): Promise<{
  lines: string[];
  pageCount: number;
  totalPages: number;
  skippedPages: number;
  warnings: string[];
}> {
  onProgress?.({ stage: "rendering_ocr", message: "Initializing OCR engine...", percent: 5 });
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");

  try {
    onProgress?.({ stage: "rendering_ocr", message: "Opening PDF for page rendering...", percent: 10 });
    const buf = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({
      data: buf,
      disableFontFace: true,
      useSystemFonts: false,
    });
    const doc = await loadingTask.promise;
    const pageCount = Math.min(doc.numPages, MAX_PAGES);
    const allLines: string[] = [];
    const warnings: string[] = ["Extracted via PDF.js Canvas + OCR rendering."];

    for (let p = 1; p <= pageCount; p++) {
      const pctBase = 10 + ((p - 1) / pageCount) * 80;
      onProgress?.({
        stage: "rendering_ocr",
        message: `Rendering page ${p}/${pageCount} to canvas...`,
        percent: pctBase,
      });

      const page = await doc.getPage(p);
      const viewport = page.getViewport({ scale: 3.0 });
      const canvas = document.createElement("canvas");
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d")!;

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Preprocess for OCR contrast
      preprocessCanvasForOCR(ctx, viewport.width, viewport.height);
      const dataUrl = canvas.toDataURL("image/png");

      onProgress?.({
        stage: "rendering_ocr",
        message: `Running OCR on page ${p}/${pageCount}...`,
        percent: pctBase + 40 / pageCount,
      });

      const { data } = await worker.recognize(dataUrl);
      type Tok = { x: number; y: number; w: number; str: string };
      const tokens: Tok[] = [];

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

      let pageLines: string[];
      if (tokens.length > 0) {
        tokens.sort((a, b) => a.y - b.y || a.x - b.x);
        const ROW_TOL = viewport.height * 0.008;
        const rows: Tok[][] = [];
        let currentY = tokens[0].y;
        let currentRow: Tok[] = [];

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
            return ocrCleanLine(line);
          })
          .filter(Boolean);
      } else {
        pageLines = (data.text || "")
          .split("\n")
          .map((l: string) => ocrCleanLine(l))
          .filter(Boolean);
      }

      allLines.push(...pageLines);
      try { page.cleanup(); } catch { /* ignore */ }
      canvas.width = 0;
      canvas.height = 0;
    }

    try { await (doc as any)?.destroy?.(); } catch { /* ignore */ }
    onProgress?.({ stage: "complete", message: "PDF OCR complete!", percent: 95 });

    return {
      lines: allLines,
      pageCount,
      totalPages: doc.numPages,
      skippedPages: Math.max(0, doc.numPages - pageCount),
      warnings,
    };
  } finally {
    await worker.terminate();
  }
}

/**
 * Main Modular Entry Point for PDF Document Processing.
 * Automatically validates, detects PDF type (digital vs scanned), and extracts text.
 */
export async function processPDFDocument(
  file: File,
  onProgress?: (progress: PDFProcessProgress) => void
): Promise<ProcessedPDFDocument> {
  if (!isPDFFile(file)) {
    throw new Error("Invalid file format. Only PDF documents are supported.");
  }

  onProgress?.({ stage: "opening", message: "Opening PDF document...", percent: 15 });

  // Try digital PDF text extraction first
  const digitalResult = await extractDigitalPDFText(file);

  // Automatic PDF type detection:
  // If digital extraction yields >= 5 structured lines or > 15 tokens, it's a Digital PDF.
  // Otherwise, it's a Scanned PDF requiring canvas rendering + OCR.
  const isDigital = digitalResult.lines.length >= 5 || digitalResult.totalTokens > 15;

  if (isDigital) {
    onProgress?.({ stage: "complete", message: "Digital PDF processing complete!", percent: 100 });
    return {
      pdfType: "digital",
      totalPages: digitalResult.totalPages,
      extractedPages: digitalResult.pageCount,
      skippedPages: digitalResult.skippedPages,
      lines: digitalResult.lines,
      rawTokensCount: digitalResult.totalTokens,
      warnings: digitalResult.warnings,
    };
  }

  // Fallback to Scanned PDF handling
  onProgress?.({ stage: "detecting", message: "Scanned PDF detected. Preparing OCR canvas...", percent: 25 });
  const scannedResult = await extractScannedPDFText(file, onProgress);

  onProgress?.({ stage: "complete", message: "Scanned PDF processing complete!", percent: 100 });
  return {
    pdfType: "scanned",
    totalPages: scannedResult.totalPages,
    extractedPages: scannedResult.pageCount,
    skippedPages: scannedResult.skippedPages,
    lines: scannedResult.lines,
    rawTokensCount: scannedResult.lines.length,
    warnings: scannedResult.warnings,
  };
}
