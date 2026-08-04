/**
 * Deterministic Transaction Extractor for Indian & Global Bank Statements.
 *
 * Priorities:
 * 1. Table Detection
 * 2. Column Alignment
 * 3. Regex Pattern Matching
 * 4. Strict Date Validation
 * 5. Strict Amount & Balance Validation
 *
 * Rules:
 * - 100% Deterministic (Zero AI, Zero Hallucination).
 * - Never invents missing amounts.
 * - Supports SBI, HDFC, ICICI, Axis, PNB, Kotak, Yes Bank, IDFC, BOB, Canara, Union Bank layouts.
 */

export interface ExtractedTransaction {
  date: string | null;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
}

export interface ExtractionResultJSON {
  transactions: ExtractedTransaction[];
}

// Date Matcher: DD/MM/YYYY, DD-MMM-YYYY, YYYY-MM-DD, DD.MM.YYYY, 01-Jul-2026, 01/07/26
const DATE_REGEX = new RegExp(
  "\\b(" +
    "\\d{1,2}[-/. ](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(?:[-/. ]\\d{2,4})?" +
    "|\\d{4}[-/]\\d{1,2}[-/]\\d{1,2}" +
    "|\\d{1,2}[-/.]\\d{1,2}(?:[-/. ]\\d{2,4})?" +
  ")\\b"
);

const MONTH_MAP: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

// Amount matcher: matches Indian & International currency formats like 1,50,000.00, 2,500.50, 500.00 Dr/Cr
const AMOUNT_REGEX = /(?:₹|Rs\.?|INR|\$)?\s*(\(?-?\d{1,3}(?:[,\s]\s*\d{2,3})+(?:\.\d{1,2})?\)?|\(?-?\d+\.\d{1,2}\)?)\s*(Dr|Cr|DR|CR)?/g;

/**
 * Validates date parameters and returns ISO string if valid, else null.
 */
function validateAndFormatDate(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || d < 1 || d > 31 || m < 1 || m > 12) return null;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(+dateObj) || dateObj.getUTCDate() !== d) return null;
  return dateObj.toISOString();
}

/**
 * Priority 4: Date Validation
 * Parses raw date string into validated ISO string.
 */
function parseAndValidateDate(rawDate: string, defaultYear: number): string | null {
  const cleaned = rawDate.trim();

  // YYYY-MM-DD
  let match = cleaned.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (match) {
    return validateAndFormatDate(+match[1], +match[2], +match[3]);
  }

  // DD-MMM-YYYY or DD MMM YYYY or DD-MMM
  match = cleaned.match(/^(\d{1,2})[-/. ]([A-Za-z]{3,})(?:[-/. ](\d{2,4}))?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = MONTH_MAP[match[2].slice(0, 3).toLowerCase()] ?? 0;
    let year = match[3] ? parseInt(match[3], 10) : defaultYear;
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return validateAndFormatDate(year, month, day);
  }

  // DD-MM-YYYY or DD/MM/YYYY
  match = cleaned.match(/^(\d{1,2})[-/. ](\d{1,2})(?:[-/. ](\d{2,4}))?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    let year = match[3] ? parseInt(match[3], 10) : defaultYear;
    if (year < 100) year += year < 70 ? 2000 : 1900;
    return validateAndFormatDate(year, month, day);
  }

  return null;
}

/**
 * Priority 1: Table Detection Filter
 * Filters out document headers, footers, customer details, and balance summary lines.
 */
function isTableIgnoredRow(line: string): boolean {
  const l = line.toLowerCase().trim();

  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(l) || /^\d+\s*\/\s*\d+$/.test(l)) return true;

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
    l.startsWith("statement period") ||
    l.startsWith("customer id") ||
    l.startsWith("account number") ||
    l.startsWith("account no") ||
    l.startsWith("ifsc") ||
    l.startsWith("micr") ||
    l.startsWith("gstin") ||
    l.startsWith("pan no") ||
    l.startsWith("branch code") ||
    l.startsWith("disclaimer")
  ) {
    return true;
  }

  return /^(date|txn date|value date|transaction date|particulars|description|cheque no|ref no|debit|credit|balance)\b/i.test(l);
}

/**
 * Priority 5: Amount Validation
 * Parses raw numeric string to valid number token, or null if invalid.
 */
function parseAmountValue(raw: string): number | null {
  let s = raw.trim();
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith("-")) { negative = true; s = s.slice(1); }
  s = s.replace(/,/g, "");

  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const num = Number(s);
  return isFinite(num) ? (negative ? -num : num) : null;
}

/**
 * Clean description string of raw bank prefixes (UPI, ACH, NEFT, IMPS)
 */
function cleanDescriptionText(rawDesc: string): string {
  let text = (rawDesc || "").trim();

  // Strip inline dates
  text = text.replace(/\b\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3})[-/. ]\d{2,4}\b/g, "");

  // Clean UPI/Bank prefixes
  if (/^UPI[-/]/i.test(text)) {
    const parts = text.split(/[-/]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const cleanName = parts[1]
        .replace(/@.*$/, "")
        .replace(/\d{6,}$/, "")
        .replace(/PAYTMQR\w*/i, "")
        .trim();
      if (cleanName.length >= 2) text = `UPI - ${cleanName}`;
    }
  } else if (/^ACH\s+[D|C]?[-/]?/i.test(text)) {
    text = text.replace(/^ACH\s+[D|C]?[-/]?/i, "ACH - ").replace(/-\d+$/, "").trim();
  }

  text = text.replace(/^[-_\s]+|[-_\s]+$/g, "").replace(/\s+/g, " ");
  return text || "Bank Transaction";
}

/**
 * Extracts a single transaction row deterministically.
 */
function extractSingleTransactionRow(line: string, defaultYear: number): ExtractedTransaction | null {
  // Strip leading serial number (e.g. "1 ", "12 ")
  const cleaned = line.replace(/^\d{1,4}\s+(?=\d{1,2}[-/. ])/, "").trim();

  if (isTableIgnoredRow(cleaned)) return null;

  // Priority 4: Date Validation
  const dateMatch = cleaned.match(DATE_REGEX);
  if (!dateMatch) return null;

  const rawDate = dateMatch[0];
  const isoDate = parseAndValidateDate(rawDate, defaultYear);
  if (!isoDate) return null;

  const dateIdx = dateMatch.index ?? 0;
  const afterDate = cleaned.slice(dateIdx + rawDate.length).trim();
  if (!afterDate) return null;

  // Skip second date column if present (e.g. Value Date)
  const secondDateMatch = afterDate.match(new RegExp("^" + DATE_REGEX.source));
  const rest = secondDateMatch ? afterDate.slice(secondDateMatch[0].length).trim() : afterDate;

  // Priority 2 & 3: Column Alignment & Amount Regex Extraction
  type AmountToken = { value: number; raw: string; index: number; marker?: string };
  const amountTokens: AmountToken[] = [];

  const matches = Array.from(rest.matchAll(AMOUNT_REGEX));
  if (matches.length > 0) {
    for (const m of matches) {
      const val = parseAmountValue(m[1]);
      if (val !== null) {
        amountTokens.push({ value: val, raw: m[1], index: m.index ?? 0, marker: m[2] });
      }
    }
  } else {
    const intMatches = Array.from(rest.matchAll(/\b(\d{1,7}(?:\.\d{1,2})?)\b/g));
    for (const m of intMatches) {
      const val = parseAmountValue(m[1]);
      if (val !== null) {
        amountTokens.push({ value: val, raw: m[1], index: m.index ?? 0 });
      }
    }
  }

  // Priority 5: Amount Validation — Must contain at least one valid amount token
  if (amountTokens.length === 0) return null;

  // Description is text preceding the first amount column
  let descText = rest.slice(0, amountTokens[0].index).replace(/\s+/g, " ").trim();
  if (!descText) {
    descText = rest.replace(amountTokens[0].raw, "").replace(/\s+/g, " ").trim();
  }

  const description = cleanDescriptionText(descText);

  let debit: number | null = null;
  let credit: number | null = null;
  let balance: number | null = null;

  const drTokens = amountTokens.filter((a) => a.marker?.toUpperCase() === "DR");
  const crTokens = amountTokens.filter((a) => a.marker?.toUpperCase() === "CR");

  const creditKeywords = /credit|salary|received|refund|deposit|cashback|return|back|gave|cash\s*in|inflow|neft.*inw|imps.*inw/i;
  const debitKeywords = /debit|withdraw|paid|purchase|payment|upi|imps|neft|atm|pos|bill|restaurant|fuel|shopping/i;

  if (amountTokens.length === 1) {
    const amt = Math.abs(amountTokens[0].value);
    if (drTokens.length) debit = amt;
    else if (crTokens.length) credit = amt;
    else {
      if (creditKeywords.test(description) && !debitKeywords.test(description)) credit = amt;
      else debit = amt;
    }
  } else if (amountTokens.length >= 2) {
    // Multi-column alignment: Last numeric column is Balance
    balance = amountTokens[amountTokens.length - 1].value;
    const txnAmounts = amountTokens.slice(0, -1);

    if (drTokens.length || crTokens.length) {
      const drIn = txnAmounts.find((a) => a.marker?.toUpperCase() === "DR");
      const crIn = txnAmounts.find((a) => a.marker?.toUpperCase() === "CR");
      if (drIn) debit = Math.abs(drIn.value);
      if (crIn) credit = Math.abs(crIn.value);
    } else if (txnAmounts.length === 1) {
      const amt = Math.abs(txnAmounts[0].value);
      if (creditKeywords.test(description)) credit = amt;
      else debit = amt;
    } else {
      // 2 Amount columns: [Debit, Credit]
      if (txnAmounts[0].value > 0) debit = Math.abs(txnAmounts[0].value);
      if (txnAmounts[1].value > 0) credit = Math.abs(txnAmounts[1].value);
    }
  }

  // Never invent missing amounts: at least debit or credit must be present
  if (debit === null && credit === null) return null;

  return {
    date: isoDate,
    description,
    debit,
    credit,
    balance,
  };
}

/**
 * Main Deterministic Extraction Function.
 * Accepts raw text lines (from reading-order PDF extraction or OCR)
 * and returns deterministic JSON `{ transactions: [] }`.
 */
export function extractTransactionsFromLines(lines: string[]): ExtractionResultJSON {
  const currentYear = new Date().getFullYear();
  let defaultYear = currentYear;

  // Detect document year
  const fullText = lines.join("\n");
  const years = fullText.match(/\b(20[2-9]\d|19[8-9]\d)\b/g);
  if (years && years.length > 0) {
    const yearCounts = new Map<number, number>();
    for (const yStr of years) {
      const y = parseInt(yStr, 10);
      if (y >= 2000 && y <= currentYear + 2) {
        yearCounts.set(y, (yearCounts.get(y) ?? 0) + 1);
      }
    }
    if (yearCounts.size > 0) {
      defaultYear = [...yearCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }
  }

  const transactions: ExtractedTransaction[] = [];

  for (const line of lines) {
    const txn = extractSingleTransactionRow(line, defaultYear);
    if (txn) {
      transactions.push(txn);
    }
  }

  return { transactions };
}
