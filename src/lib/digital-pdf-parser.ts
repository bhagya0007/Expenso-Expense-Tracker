/**
 * Digital PDF Parser for Bank Statements.
 *
 * Uses PDF.js for text layer token extraction, preserving reading order via
 * Y/X spatial coordinate alignment. Uses regex heuristics to detect transaction tables
 * and extract structured JSON (Date, Description, Debit, Credit, Balance).
 *
 * Strictly NO AI and NO OCR.
 */
import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  const localWorker = typeof pdfWorker === "string" && pdfWorker ? pdfWorker : null;
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    localWorker || "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.1.200/build/pdf.worker.min.mjs";
}

export interface DigitalTransactionJSON {
  date: string | null;
  rawDate: string;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  reference: string | null;
}

export interface DigitalPDFParseResultJSON {
  bank: string;
  documentType: "Digital PDF";
  totalPages: number;
  extractedTransactionsCount: number;
  transactions: DigitalTransactionJSON[];
  ignoredLinesCount: number;
}

interface PDFToken {
  x: number;
  y: number;
  str: string;
}

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

const AMOUNT_RE = /(?:₹|Rs\.?|INR|\$)?\s*(\(?-?\d{1,3}(?:[,\s]\s*\d{2,3})+(?:\.\d{1,2})?\)?|\(?-?\d+\.\d{1,2}\)?)\s*(Dr|Cr|DR|CR)?/g;

/**
 * Normalizes date string to ISO date string (YYYY-MM-DDTHH:mm:ss.sssZ).
 */
function toISODate(raw: string, defaultYear?: number): string | null {
  const cleaned = raw.trim();

  // YYYY-MM-DD
  let m = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return safeDate(+m[1], +m[2], +m[3]);

  // DD-MMM-YYYY or DD MMM YYYY or DD-MMM
  m = cleaned.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,})(?:[-/. ](\d{2,4}))?$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()] ?? 0;
    let year = m[3] ? parseInt(m[3], 10) : (defaultYear || new Date().getFullYear());
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return safeDate(year, mon, day);
  }

  // DD-MM-YYYY or DD/MM/YYYY
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

/**
 * Detects bank from PDF content text.
 */
function detectBankName(text: string): string {
  const t = text.toUpperCase();
  if (t.includes("STATE BANK OF INDIA") || /\bSBI\b/.test(t)) return "State Bank of India";
  if (t.includes("HDFC BANK") || /\bHDFC\b/.test(t)) return "HDFC Bank";
  if (t.includes("ICICI BANK") || /\bICICI\b/.test(t)) return "ICICI Bank";
  if (t.includes("AXIS BANK") || /\bAXIS\b/.test(t)) return "Axis Bank";
  if (t.includes("PUNJAB NATIONAL") || /\bPNB\b/.test(t)) return "Punjab National Bank";
  if (t.includes("KOTAK")) return "Kotak Mahindra Bank";
  if (t.includes("YES BANK")) return "Yes Bank";
  if (t.includes("IDFC")) return "IDFC First Bank";
  if (t.includes("BANK OF BARODA") || /\bBOB\b/.test(t)) return "Bank of Baroda";
  if (t.includes("CANARA BANK")) return "Canara Bank";
  if (t.includes("UNION BANK")) return "Union Bank of India";
  if (t.includes("INDUSIND")) return "IndusInd Bank";
  return "Bank Statement";
}

/**
 * Checks if a line is non-transaction metadata (Header, Footer, Page Number, Customer Details, Balances).
 */
function isIgnoredLine(line: string): boolean {
  const l = line.toLowerCase().trim();

  // Page Numbers: "Page 1 of 5", "1 / 4", "Page 2"
  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(l) || /^\d+\s*\/\s*\d+$/.test(l)) return true;

  // Opening & Closing Balances, Summaries
  if (
    l.startsWith("opening balance") ||
    l.startsWith("closing balance") ||
    l.startsWith("total cash in") ||
    l.startsWith("total cash out") ||
    l.startsWith("total debit") ||
    l.startsWith("total credit") ||
    l.startsWith("expected amb") ||
    l.startsWith("expected ama") ||
    l.startsWith("average balance") ||
    l.startsWith("average monthly balance") ||
    l.startsWith("minimum balance") ||
    l.startsWith("account summary") ||
    l.startsWith("statement period")
  ) {
    return true;
  }

  // Headers & Customer Details
  if (
    l.startsWith("customer id") ||
    l.startsWith("account number") ||
    l.startsWith("account no") ||
    l.startsWith("ifsc") ||
    l.startsWith("micr") ||
    l.startsWith("gstin") ||
    l.startsWith("pan no") ||
    l.startsWith("branch code") ||
    l.startsWith("nomination registered") ||
    l.startsWith("disclaimer") ||
    l.startsWith("for testing only")
  ) {
    return true;
  }

  // Table Column Headers: Date, Txn Date, Description, Particulars, Withdrawals, Deposits, Balance
  if (/^(date|txn date|value date|transaction date|particulars|description|cheque no|ref no|debit|credit|balance)\b/i.test(l)) {
    return true;
  }

  return false;
}

function parseAmountToken(raw: string): number | null {
  let s = raw.trim();
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  s = s.replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return isFinite(n) ? (negative ? -n : n) : null;
}

/**
 * Extracts structured transaction details from a reading-order line.
 */
function parseDigitalLineToTransaction(line: string, defaultYear: number): DigitalTransactionJSON | null {
  const cleanedLine = line.replace(/^\d{1,4}\s+(?=\d{1,2}[-/. ])/, "").trim();

  if (isIgnoredLine(cleanedLine)) return null;

  const dateMatch = cleanedLine.match(DATE_RE);
  if (!dateMatch) return null;

  const rawDate = dateMatch[0];
  const isoDate = toISODate(rawDate, defaultYear);
  if (!isoDate) return null;

  const dateIdx = dateMatch.index ?? 0;
  const afterDate = cleanedLine.slice(dateIdx + rawDate.length).trim();
  if (!afterDate) return null;

  // Skip second date column (e.g. Value Date)
  const secondDateMatch = afterDate.match(new RegExp("^" + DATE_RE.source));
  const rest = secondDateMatch ? afterDate.slice(secondDateMatch[0].length).trim() : afterDate;

  // Extract all numeric tokens (debit, credit, balance)
  type NumToken = { value: number; raw: string; index: number; marker?: string };
  const numberTokens: NumToken[] = [];

  const matches = Array.from(rest.matchAll(AMOUNT_RE));
  if (matches.length > 0) {
    for (const m of matches) {
      const val = parseAmountToken(m[1]);
      if (val !== null) {
        numberTokens.push({ value: val, raw: m[1], index: m.index ?? 0, marker: m[2] });
      }
    }
  } else {
    const intMatches = Array.from(rest.matchAll(/\b(\d{1,7}(?:\.\d{1,2})?)\b/g));
    for (const m of intMatches) {
      const val = parseAmountToken(m[1]);
      if (val !== null) {
        numberTokens.push({ value: val, raw: m[1], index: m.index ?? 0 });
      }
    }
  }

  if (numberTokens.length === 0) return null;

  // Description is text preceding the amounts
  let descText = rest.slice(0, numberTokens[0].index).replace(/\s+/g, " ").trim();
  if (!descText) {
    descText = rest.replace(numberTokens[0].raw, "").replace(/\s+/g, " ").trim();
  }

  if (!descText || descText.length < 2) descText = "Bank Transaction";

  // Extract reference string if present
  const refMatch = descText.match(/\b(UPI[/-]?[A-Z0-9]{8,18}|TXN\d{5,15}|\d{9,14})\b/i);
  const reference = refMatch ? refMatch[1] : null;

  let debit: number | null = null;
  let credit: number | null = null;
  let balance: number | null = null;

  const dr = numberTokens.filter((a) => a.marker?.toUpperCase() === "DR");
  const cr = numberTokens.filter((a) => a.marker?.toUpperCase() === "CR");

  const creditKeywords = /credit|salary|received|refund|deposit|cashback|return|back|gave|cash\s*in|inflow|neft.*inw|imps.*inw/i;
  const debitKeywords = /debit|withdraw|paid|purchase|payment|upi|imps|neft|atm|pos|bill|restaurant|fuel|shopping|electricity|recharge/i;

  if (numberTokens.length === 1) {
    const amt = Math.abs(numberTokens[0].value);
    if (dr.length) debit = amt;
    else if (cr.length) credit = amt;
    else {
      if (creditKeywords.test(descText) && !debitKeywords.test(descText)) credit = amt;
      else debit = amt;
    }
  } else if (numberTokens.length >= 2) {
    balance = numberTokens[numberTokens.length - 1].value;
    const txnAmounts = numberTokens.slice(0, -1);

    if (dr.length || cr.length) {
      const drIn = txnAmounts.find((a) => a.marker?.toUpperCase() === "DR");
      const crIn = txnAmounts.find((a) => a.marker?.toUpperCase() === "CR");
      if (drIn) debit = Math.abs(drIn.value);
      if (crIn) credit = Math.abs(crIn.value);
    } else if (txnAmounts.length === 1) {
      const amt = Math.abs(txnAmounts[0].value);
      if (creditKeywords.test(descText)) credit = amt;
      else debit = amt;
    } else {
      if (txnAmounts[0].value > 0) debit = Math.abs(txnAmounts[0].value);
      if (txnAmounts[1].value > 0) credit = Math.abs(txnAmounts[1].value);
    }
  }

  if (debit === null && credit === null) return null;

  return {
    date: isoDate,
    rawDate,
    description: descText,
    debit,
    credit,
    balance,
    reference,
  };
}

/**
 * Main Pure Digital PDF Parser Entry Point using PDF.js.
 * Returns structured JSON containing extracted transactions without using AI or OCR.
 */
export async function parseDigitalPDF(file: File): Promise<DigitalPDFParseResultJSON> {
  const buf = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: buf,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: false,
  });

  const doc = await loadingTask.promise;
  const totalPages = doc.numPages;
  const rawLines: string[] = [];

  // Step 1: Extract text items and preserve reading order (Y descending, X ascending)
  for (let p = 1; p <= totalPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();

    const tokens: PDFToken[] = [];
    if (content && Array.isArray(content.items)) {
      for (const item of content.items) {
        if (!item || typeof (item as any).str !== "string") continue;
        const str = (item as any).str;
        if (!str.trim()) continue;
        const tx = Array.isArray((item as any).transform) ? (item as any).transform : [1, 0, 0, 1, 0, 0];
        tokens.push({ x: Number(tx[4]) || 0, y: Number(tx[5]) || 0, str });
      }
    }

    if (tokens.length > 0) {
      // Sort reading order: Top to bottom (Y descending), Left to right (X ascending)
      tokens.sort((a, b) => b.y - a.y || a.x - b.x);

      const TOL = 6;
      let currentY = Infinity;
      let currentRow: PDFToken[] = [];

      for (const tok of tokens) {
        if (Math.abs(tok.y - currentY) > TOL) {
          if (currentRow.length > 0) {
            currentRow.sort((a, b) => a.x - b.x);
            const line = currentRow.map((t) => t.str).join(" ").replace(/\s+/g, " ").trim();
            if (line) rawLines.push(line);
          }
          currentRow = [tok];
          currentY = tok.y;
        } else {
          currentRow.push(tok);
        }
      }

      if (currentRow.length > 0) {
        currentRow.sort((a, b) => a.x - b.x);
        const line = currentRow.map((t) => t.str).join(" ").replace(/\s+/g, " ").trim();
        if (line) rawLines.push(line);
      }
    }

    try { page.cleanup(); } catch { /* ignore */ }
  }

  const fullText = rawLines.join("\n");
  const bank = detectBankName(fullText);

  // Detect predominant year in document
  const currentYear = new Date().getFullYear();
  let defaultYear = currentYear;
  const years = fullText.match(/\b(20[2-9]\d|19[8-9]\d)\b/g);
  if (years && years.length > 0) {
    const counts = new Map<number, number>();
    for (const yStr of years) {
      const y = parseInt(yStr, 10);
      if (y >= 2000 && y <= currentYear + 2) {
        counts.set(y, (counts.get(y) ?? 0) + 1);
      }
    }
    if (counts.size > 0) {
      defaultYear = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  // Step 2: Detect transaction tables & extract JSON transactions, ignoring headers/footers/balances
  const transactions: DigitalTransactionJSON[] = [];
  let ignoredLinesCount = 0;

  for (const line of rawLines) {
    if (isIgnoredLine(line)) {
      ignoredLinesCount++;
      continue;
    }

    const txn = parseDigitalLineToTransaction(line, defaultYear);
    if (txn) {
      transactions.push(txn);
    } else {
      ignoredLinesCount++;
    }
  }

  try { await (doc as any)?.destroy?.(); } catch { /* ignore */ }

  return {
    bank,
    documentType: "Digital PDF",
    totalPages,
    extractedTransactionsCount: transactions.length,
    transactions,
    ignoredLinesCount,
  };
}
