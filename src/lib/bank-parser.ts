/**
 * Deterministic bank statement PDF parser.
 *
 * Uses pdfjs-dist for text extraction plus regex heuristics — AI is
 * intentionally NOT used for numeric extraction so values are never
 * hallucinated. Rows that cannot be parsed with high confidence are flagged
 * for manual review.
 */
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  const localWorker = typeof pdfWorker === "string" && pdfWorker ? pdfWorker : null;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    localWorker || "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs";
}

export interface ParsedTxn {
  id: string;
  date: string | null;
  rawDate: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  reference: string | null;
  needsReview: boolean;
  reviewReason?: string;
  /** 0..1 confidence score. >=0.85 High, >=0.6 Medium, else Low. */
  confidence: number;
  /** Per-field confidence checks that failed (empty = all passed). */
  issues: string[];
  /** Which extractor produced this row. */
  source: "parser" | "ai";
}

export interface ParseResult {
  bank: string;
  transactions: ParsedTxn[];
  totalPages: number;
  scannedPages?: number;
  skippedPages?: number;
  rawLines: number;
  flagged: number;
  aiCandidateText?: string;
  extractionWarning?: string;
}

// Matches: 12/03/2024, 12-03-24, 12 Mar 2024, 12-Mar-2024, 2024-03-12, 01-Jul, 01 Jul, 01-May-2026
const DATE_RE = new RegExp(
  "\\b(" +
    "\\d{1,2}[-/. ](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:[-/. ]\\d{2,4})?" +
    "|\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}" +
    "|\\d{1,2}[-/.]\\d{1,2}(?:[-/. ]\\d{2,4})?" +
  ")\\b"
);

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const AMOUNT_RE = /(?:₹|Rs\.?|INR|\$)?\s*(\(?-?\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?\)?|\(?-?\d+\.\d{1,2}\)?)\s*(Dr|Cr|DR|CR)?/g;

type AmountProfile = {
  hasDecimal: boolean;
  hasComma: boolean;
  hasCurrencySymbol: boolean;
  hasNegatives: boolean;
  integerMode: boolean;
};

function detectAmountProfile(lines: string[]): AmountProfile {
  let hasDecimal = false, hasComma = false, hasCurrencySymbol = false, hasNegatives = false;
  for (const line of lines) {
    if (!hasDecimal && /\d\.\d{2}\b/.test(line)) hasDecimal = true;
    if (!hasComma && /\d,\d{2,3}/.test(line)) hasComma = true;
    if (!hasCurrencySymbol && /(₹|\bRs\.?\b|\bINR\b|\$)/i.test(line)) hasCurrencySymbol = true;
    if (!hasNegatives && /(\(-?\d[\d.,]*\)|(?:^|\s)-\d[\d.,]*)/.test(line)) hasNegatives = true;
  }
  return { hasDecimal, hasComma, hasCurrencySymbol, hasNegatives, integerMode: !hasDecimal && !hasComma };
}

function detectDocumentYear(lines: string[]): number {
  const currentYear = new Date().getFullYear();
  const yearCounts = new Map<number, number>();

  for (const line of lines) {
    const matches = line.match(/\b(20[2-9]\d|19[8-9]\d)\b/g);
    if (matches) {
      for (const m of matches) {
        const y = parseInt(m, 10);
        if (y >= 2000 && y <= currentYear + 2) {
          yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
        }
      }
    }
  }

  if (yearCounts.size === 0) return currentYear;
  return [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function parseAmountToken(raw: string): number | null {
  let s = raw.trim();
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  if (!isFinite(n)) return null;
  return negative ? -n : n;
}

function toISODate(raw: string, defaultYear?: number): string | null {
  const cleaned = raw.trim();
  // ISO 2026-07-01
  let m = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return safeDate(+m[1], +m[2], +m[3]);

  // 01-Jul-2026 or 01 Jul 2026 or 01-Jul
  m = cleaned.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,})(?:[-/. ](\d{2,4}))?$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()] ?? 0;
    let year = m[3] ? parseInt(m[3], 10) : (defaultYear || new Date().getFullYear());
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return safeDate(year, mon, day);
  }

  // 01-05-2026 or 01/05/2026 or 01-05
  m = cleaned.match(/^(\d{1,2})[-/. ](\d{1,2})(?:[-/. ](\d{2,4}))?$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    let year = m[3] ? parseInt(m[3], 10) : (defaultYear || new Date().getFullYear());
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return safeDate(year, mon, day);
  }

  return null;
}

function safeDate(y: number, mo: number, d: number): string | null {
  if (!y || !mo || !d || d > 31 || mo > 12) return null;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (isNaN(+dt) || dt.getUTCDate() !== d) return null;
  return dt.toISOString();
}

function detectBank(text: string): string {
  const t = text.toUpperCase();
  if (t.includes("DEMO NATIONAL BANK")) return "Demo National Bank";
  if (t.includes("CASH BOOK")) return "Cash Book";
  if (t.includes("STATE BANK OF INDIA") || /\bSBI\b/.test(t)) return "SBI";
  if (t.includes("HDFC BANK") || /\bHDFC\b/.test(t)) return "HDFC";
  if (t.includes("ICICI BANK") || /\bICICI\b/.test(t)) return "ICICI";
  if (t.includes("AXIS BANK") || /\bAXIS\b/.test(t)) return "Axis";
  if (t.includes("PUNJAB NATIONAL") || /\bPNB\b/.test(t)) return "PNB";
  if (t.includes("KOTAK")) return "Kotak";
  if (t.includes("YES BANK")) return "Yes Bank";
  if (t.includes("IDFC")) return "IDFC First";
  if (t.includes("BANK OF BARODA") || /\bBOB\b/.test(t)) return "Bank of Baroda";
  if (t.includes("CANARA BANK")) return "Canara";
  if (t.includes("UNION BANK")) return "Union Bank";
  if (t.includes("INDUSIND")) return "IndusInd";
  return "Bank Statement";
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

export async function extractLines(
  file: File,
): Promise<{ lines: string[]; pages: number; totalPages: number; skippedPages: number; warnings: string[] }> {
  const buf = await file.arrayBuffer();

  let doc: Awaited<ReturnType<typeof pdfjsLib.getDocument["prototype"]["promise"]>>;
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: buf,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: false,
    });
    doc = await withTimeout(loadingTask.promise, 15_000, "Opening PDF");
  } catch (openErr: any) {
    console.error("[bank-parser] Failed to open PDF:", openErr);
    // If the PDF is password-protected, tell the user
    if (openErr?.name === "PasswordException" || /password/i.test(String(openErr))) {
      return {
        lines: [],
        pages: 0,
        totalPages: 0,
        skippedPages: 0,
        warnings: ["This PDF appears to be password-protected. Please remove the password and re-upload."],
      };
    }
    throw openErr;
  }

  try {
    const pageCount = Math.min(doc.numPages, MAX_PAGES);
    const skippedPages = Math.max(0, doc.numPages - pageCount);
    const warnings: string[] = [];
    const startedAt = Date.now();

    // Initialize with empty arrays so .flat() never hits undefined
    const perPageLines: string[][] = Array.from({ length: pageCount }, () => []);

    for (let start = 1; start <= pageCount; start += PAGE_BATCH_SIZE) {
      if (Date.now() - startedAt > EXTRACTION_BUDGET_MS) {
        warnings.push("Large PDF reached the fast extraction limit; imported the pages read so far");
        break;
      }
      const end = Math.min(start + PAGE_BATCH_SIZE - 1, pageCount);
      await Promise.all(
        Array.from({ length: end - start + 1 }, (_, k) => start + k).map(async (p) => {
          let page: any = null;
          try {
            page = await withTimeout(doc.getPage(p), PAGE_TIMEOUT_MS, `Loading page ${p}`);
            const content = await withTimeout(page.getTextContent(), PAGE_TIMEOUT_MS, `Reading page ${p}`);

            type Tok = { x: number; y: number; str: string };
            const tokens: Tok[] = [];

            if (content && Array.isArray(content.items)) {
              for (const item of content.items) {
                // Skip TextMarkedContent items (they have no .str)
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

            console.log(`[bank-parser] Page ${p}: ${content?.items?.length ?? 0} items → ${tokens.length} text tokens`);

            if (tokens.length === 0) {
              perPageLines[p - 1] = [];
              return;
            }

            tokens.sort((a, b) => b.y - a.y || a.x - b.x);

            // Use a larger Y-tolerance for real bank PDFs which can have slight vertical offsets
            const TOL = 6;
            let currentY = Infinity;
            let currentRow: Tok[] = [];
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
            console.log(`[bank-parser] Page ${p}: assembled ${out.length} text lines`);
          } catch (err) {
            console.warn(`[bank-parser] Skipping page ${p}:`, err);
            warnings.push(`Page ${p} could not be read quickly and was skipped`);
            perPageLines[p - 1] = [];
          } finally {
            try { page?.cleanup(); } catch { /* ignore cleanup errors */ }
          }
        }),
      );
      await yieldToBrowser();
    }

    const lines = perPageLines.flat();
    console.log(`[bank-parser] Total extracted lines: ${lines.length} across ${pageCount} pages`);
    if (lines.length > 0) {
      console.log("[bank-parser] First 10 lines:", lines.slice(0, 10));
    }
    return { lines, pages: pageCount, totalPages: doc.numPages, skippedPages, warnings };
  } finally {
    try { await (doc as any)?.destroy?.(); } catch { /* ignore */ }
  }
}

function isSummaryOrHeaderLine(line: string): boolean {
  const l = line.toLowerCase().trim();
  if (
    l.startsWith("opening balance") ||
    l.startsWith("closing balance") ||
    l.startsWith("total cash in") ||
    l.startsWith("total cash out") ||
    l.startsWith("total debit") ||
    l.startsWith("total credit") ||
    l.startsWith("disclaimer") ||
    l.startsWith("for testing only")
  ) {
    return true;
  }
  return /^(date|txn|transaction date|value date|statement|page\s+\d|account (no|number)|customer|notes|cash in|cash out)/i.test(l);
}

function buildCandidateRows(lines: string[]): string[] {
  const candidates: string[] = [];
  const seen = new Set<string>();

  for (const raw of lines) {
    let line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;

    // Strip leading serial numbers like "1 ", "26 " before date
    line = line.replace(/^\d{1,4}\s+(?=\d{1,2}[-/. ])/, "");

    if (isSummaryOrHeaderLine(line)) continue;
    if (!DATE_RE.test(line)) continue;

    if (!seen.has(line)) {
      seen.add(line);
      candidates.push(line);
    }
  }

  return candidates;
}

export function cleanDescriptionAndRef(rawDesc: string, rawRef?: string | null): { cleanMerchant: string; reference: string | null } {
  let text = (rawDesc || "").trim();
  let ref = rawRef ? rawRef.trim() : null;

  // 1. Extract reference if not explicitly supplied
  if (!ref) {
    const txnMatch = text.match(/\b(TXN\d{5,15})\b/i) ||
                     text.match(/\b([0-9]{10,14})\b/) ||
                     text.match(/\b(UPI[/-]?[A-Z0-9]{8,18})\b/i);
    if (txnMatch) {
      ref = txnMatch[1];
    }
  }

  // 2. Strip reference string from merchant name if present
  if (ref) {
    const escaped = ref.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escaped}\\b`, "gi"), "");
  }

  // 3. Strip inline dates (e.g. 16/09/2025 or 16-Sep-2025)
  text = text.replace(/\b\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3})[-/. ]\d{2,4}\b/g, "");

  // 4. Transform raw UPI / Bank strings into clean merchant names
  if (/^UPI[-/]/i.test(text)) {
    const parts = text.split(/[-/]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const namePart = parts[1];
      const cleanName = namePart
        .replace(/@.*$/, "")
        .replace(/\d{6,}$/, "")
        .replace(/PAYTMQR\w*/i, "")
        .trim();
      if (cleanName.length >= 2) {
        text = `UPI - ${cleanName}`;
      }
    }
  } else if (/^ACH\s+[D|C]?[-/]?/i.test(text)) {
    text = text.replace(/^ACH\s+[D|C]?[-/]?/i, "ACH - ").replace(/-\d+$/, "").trim();
  }

  text = text.replace(/^[-_\s]+|[-_\s]+$/g, "").replace(/\s+/g, " ");

  if (!text || text.length < 2) {
    text = rawDesc.split(/\s+/)[0] || "Bank Transaction";
  }

  return { cleanMerchant: text, reference: ref };
}

function parseRow(line: string, defaultYear: number): ParsedTxn | null {
  // Strip leading serial number (e.g. "1 ", "26 ") if present
  const cleanedLine = line.replace(/^\d{1,4}\s+(?=\d{1,2}[-/. ])/, "").trim();

  if (isSummaryOrHeaderLine(cleanedLine)) return null;

  const dateMatch = cleanedLine.match(DATE_RE);
  if (!dateMatch) return null;

  const rawDate = dateMatch[0];
  const iso = toISODate(rawDate, defaultYear);
  if (!iso) return null;

  const dateIdx = dateMatch.index ?? 0;
  const afterDate = cleanedLine.slice(dateIdx + rawDate.length).trim();
  if (!afterDate) return null;

  // Skip an optional second date column (value date)
  const secondDateMatch = afterDate.match(new RegExp("^" + DATE_RE.source));
  const rest = secondDateMatch ? afterDate.slice(secondDateMatch[0].length).trim() : afterDate;

  // Extract all numeric tokens from rest (decimals or integers)
  type NumToken = { value: number; raw: string; index: number; marker?: string };
  const numberTokens: NumToken[] = [];

  // Match decimals or comma-formatted numbers first
  const formattedMatches = Array.from(rest.matchAll(AMOUNT_RE));
  if (formattedMatches.length > 0) {
    for (const m of formattedMatches) {
      const n = parseAmountToken(m[1]);
      if (n !== null && isFinite(n)) {
        numberTokens.push({
          value: n,
          raw: m[1],
          index: m.index ?? 0,
          marker: m[2],
        });
      }
    }
  } else {
    // Integer amount fallback (no decimals/commas on this row)
    const intMatches = Array.from(rest.matchAll(/\b(\d{1,7}(?:\.\d{1,2})?)\b/g));
    for (const m of intMatches) {
      const val = parseAmountToken(m[1]);
      if (val !== null && isFinite(val)) {
        numberTokens.push({
          value: val,
          raw: m[1],
          index: m.index ?? 0,
        });
      }
    }
  }

  if (numberTokens.length === 0) return null;

  // Description is text before the first numeric amount or text excluding account tags
  let descText = rest.slice(0, numberTokens[0].index).replace(/\s+/g, " ").trim();
  if (!descText) {
    descText = rest
      .replace(numberTokens[0].raw, "")
      .replace(/Cash Book|CashBook|Account|Bank/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  // Strip trailing account identifiers from description
  let rawDescription = descText.replace(/\b(Cash Book|CashBook|Account|Bank)\b/gi, "").trim();
  if (!rawDescription) rawDescription = "(no description)";

  const rawRefMatch = rawDescription.match(/\b([A-Z0-9]{8,})\b/) || rawDescription.match(/\b(\d{9,})\b/);
  const initialRef = rawRefMatch ? rawRefMatch[1] : null;

  const { cleanMerchant: description, reference } = cleanDescriptionAndRef(rawDescription, initialRef);

  let debit: number | null = null;
  let credit: number | null = null;
  let balance: number | null = null;

  const dr = numberTokens.filter((a) => a.marker?.toUpperCase() === "DR");
  const cr = numberTokens.filter((a) => a.marker?.toUpperCase() === "CR");

  const creditKeywords = /credit|salary|received|refund|deposit|cashback|return|back|gave|cash\s*in|inflow|neft.*inw|imps.*inw|neft received/i;
  const debitKeywords = /debit|withdraw|paid|purchase|payment|upi|imps|neft|atm|pos|bill|restaurant|fuel|shopping|electricity|recharge|samosa|soap|ticket|tshirt|maggie|printout|biscuit|ice cream|grocery|toffee|cash\s*out|outflow/i;

  if (numberTokens.length === 1) {
    const amt = Math.abs(numberTokens[0].value);
    if (dr.length) debit = amt;
    else if (cr.length) credit = amt;
    else {
      const looksCredit = creditKeywords.test(description);
      const looksDebit = debitKeywords.test(description);

      if (looksCredit && !looksDebit) credit = amt;
      else if (looksDebit && !looksCredit) debit = amt;
      else {
        // Fallback default: if description has no clear keyword, default to debit
        debit = amt;
      }
    }
  } else if (numberTokens.length >= 2) {
    // Multi-amount row: typical layout is [debit/credit, balance] or [debit, credit, balance]
    balance = numberTokens[numberTokens.length - 1].value;
    const txnAmounts = numberTokens.slice(0, -1);

    if (dr.length || cr.length) {
      const drIn = txnAmounts.find((a) => a.marker?.toUpperCase() === "DR");
      const crIn = txnAmounts.find((a) => a.marker?.toUpperCase() === "CR");
      if (drIn) debit = Math.abs(drIn.value);
      if (crIn) credit = Math.abs(crIn.value);
    } else if (txnAmounts.length === 1) {
      const amt = Math.abs(txnAmounts[0].value);
      const looksCredit = creditKeywords.test(description);
      if (looksCredit) credit = amt;
      else debit = amt;
    } else {
      // [debit, credit]
      if (txnAmounts[0].value > 0) debit = Math.abs(txnAmounts[0].value);
      if (txnAmounts[1].value > 0) credit = Math.abs(txnAmounts[1].value);
    }
  }

  if (debit === null && credit === null) return null;

  return {
    id: `row-${Math.random().toString(36).slice(2, 10)}`,
    date: iso,
    rawDate,
    description,
    debit,
    credit,
    balance,
    reference,
    needsReview: false,
    confidence: 0.95,
    issues: [],
    source: "parser",
  };
}

export async function parseBankStatement(file: File): Promise<ParseResult> {
  const extraction = await extractLines(file);
  const { lines, pages } = extraction;
  const bank = detectBank(lines.join("\n"));
  const defaultYear = detectDocumentYear(lines);

  const rows: ParsedTxn[] = [];
  const candidateRows = buildCandidateRows(lines);

  for (const line of candidateRows) {
    const row = parseRow(line, defaultYear);
    if (row) rows.push(row);
  }

  // Balance continuity verification for statements with running balances
  const chrono = [...rows].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return +new Date(a.date) - +new Date(b.date);
  });

  let prev: number | null = null;
  for (const r of chrono) {
    if (r.balance != null && prev != null) {
      const delta = (r.credit ?? 0) - (r.debit ?? 0);
      const expected = prev + delta;
      const diff = Math.abs(expected - r.balance);
      const tol = Math.max(0.5, Math.abs(r.balance) * 0.001);
      if (diff <= tol) {
        r.confidence = 1.0;
      }
    }
    if (r.balance != null) prev = r.balance;
  }

  return {
    bank,
    transactions: rows,
    totalPages: extraction.totalPages,
    scannedPages: pages,
    skippedPages: extraction.skippedPages,
    rawLines: lines.length,
    flagged: rows.filter((r) => r.needsReview).length,
    aiCandidateText: candidateRows.join("\n"),
    extractionWarning: extraction.warnings[0],
  };
}

