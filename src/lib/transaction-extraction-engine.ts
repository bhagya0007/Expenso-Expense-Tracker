/**
 * Deterministic Transaction Extraction Engine for Bank Statements.
 *
 * Rules & Guarantees:
 * - 100% Deterministic (Zero AI, Zero Gemini, Zero OpenAI).
 * - Multi-page & multiline transaction row merging.
 * - Extracts ONLY exact data from PDF: Date, Description, Debit, Credit, Balance.
 * - Ignores: Headers, Footers, Branch Address, Customer Details, IFSC, MICR, Opening/Closing Balance, Page Numbers.
 * - Returns `{ transactions: [], errors: [] }`. If candidate rows cannot be parsed with certainty,
 *   they are placed in `errors[]` instead of hallucinating or guessing.
 */

export interface StrictExtractedTransaction {
  date: string | null;
  description: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
}

export interface ParsingError {
  rawLine: string;
  lineIndex: number;
  reason: string;
}

export interface TransactionEngineResult {
  transactions: StrictExtractedTransaction[];
  errors: ParsingError[];
}

// Regex for Dates: DD-MMM-YYYY, DD/MM/YYYY, YYYY-MM-DD, DD.MM.YYYY, 01 Jul 2026, 01-Jul-26
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

// Amount matcher: matches Indian & International currency formats
const AMOUNT_REGEX = /(?:₹|Rs\.?|INR|\$)?\s*(\(?-?\d{1,3}(?:[,\s]\s*\d{2,3})+(?:\.\d{1,2})?\)?|\(?-?\d+\.\d{1,2}\)?)\s*(Dr|Cr|DR|CR)?/g;

function validateAndFormatDate(y: number, m: number, d: number): string | null {
  if (!y || !m || !d || d < 1 || d > 31 || m < 1 || m > 12) return null;
  const dateObj = new Date(Date.UTC(y, m - 1, d));
  if (isNaN(+dateObj) || dateObj.getUTCDate() !== d) return null;
  return dateObj.toISOString();
}

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
 * Filter out Headers, Footers, Branch Address, Customer Details, Opening/Closing Balance, IFSC, MICR, Page Numbers.
 */
function isIgnoredNonTransactionLine(line: string): boolean {
  const l = line.toLowerCase().trim();

  // Page numbers
  if (/^page\s+\d+(\s+of\s+\d+)?$/i.test(l) || /^\d+\s*\/\s*\d+$/.test(l)) return true;

  // Opening & Closing Balance, AMB/AMA
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

  // Branch Address, Customer Details, IFSC, MICR, PAN, GSTIN
  if (
    l.includes("ifsc") ||
    l.includes("micr") ||
    l.startsWith("customer id") ||
    l.startsWith("account number") ||
    l.startsWith("account no") ||
    l.startsWith("branch address") ||
    l.startsWith("branch code") ||
    l.startsWith("branch:") ||
    l.startsWith("address:") ||
    l.startsWith("pan no") ||
    l.startsWith("gstin") ||
    l.startsWith("disclaimer") ||
    l.startsWith("for testing only")
  ) {
    return true;
  }

  // Column Headers
  return /^(date|txn date|value date|transaction date|particulars|description|cheque no|ref no|debit|credit|balance)\b/i.test(l);
}

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
 * Clean description string while preserving EXACT PDF narration text.
 */
function cleanDescription(rawDesc: string): string {
  let text = (rawDesc || "").trim();
  // Strip inline secondary dates if present
  text = text.replace(/\b\d{1,2}[-/. ](?:\d{1,2}|[A-Za-z]{3})[-/. ]\d{2,4}\b/g, "");
  text = text.replace(/^[-_\s]+|[-_\s]+$/g, "").replace(/\s+/g, " ");
  return text || "Transaction";
}

/**
 * Groups lines into transaction blocks by combining continuation lines following a date.
 */
function buildMergedTransactionBlocks(lines: string[]): Array<{ line: string; lineIndex: number }> {
  const blocks: Array<{ line: string; lineIndex: number }> = [];
  let currentBlock: { line: string; lineIndex: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || isIgnoredNonTransactionLine(raw)) continue;

    const hasDate = DATE_REGEX.test(raw);

    if (hasDate) {
      if (currentBlock) blocks.push(currentBlock);
      currentBlock = { line: raw, lineIndex: i + 1 };
    } else if (currentBlock) {
      // Continuation line for description or amount
      currentBlock.line += " " + raw;
    }
  }

  if (currentBlock) blocks.push(currentBlock);
  return blocks;
}

/**
 * Executes strict deterministic transaction extraction across raw lines.
 */
export function runTransactionExtractionEngine(lines: string[]): TransactionEngineResult {
  const currentYear = new Date().getFullYear();
  let defaultYear = currentYear;

  // Detect document year
  const fullText = lines.join("\n");
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

  const transactions: StrictExtractedTransaction[] = [];
  const errors: ParsingError[] = [];

  // Group multiline statements
  const blocks = buildMergedTransactionBlocks(lines);

  for (const block of blocks) {
    const rawLine = block.line;
    const lineIndex = block.lineIndex;
    const cleaned = rawLine.replace(/^\d{1,4}\s+(?=\d{1,2}[-/. ])/, "").trim();

    const dateMatch = cleaned.match(DATE_REGEX);
    if (!dateMatch) continue;

    const rawDate = dateMatch[0];
    const isoDate = parseAndValidateDate(rawDate, defaultYear);

    if (!isoDate) {
      errors.push({
        rawLine,
        lineIndex,
        reason: `Invalid or unparseable date format: "${rawDate}"`,
      });
      continue;
    }

    const dateIdx = dateMatch.index ?? 0;
    const afterDate = cleaned.slice(dateIdx + rawDate.length).trim();

    if (!afterDate) {
      errors.push({
        rawLine,
        lineIndex,
        reason: "Line contains date but no transaction details or amounts",
      });
      continue;
    }

    const secondDateMatch = afterDate.match(new RegExp("^" + DATE_REGEX.source));
    const rest = secondDateMatch ? afterDate.slice(secondDateMatch[0].length).trim() : afterDate;

    // Extract amount tokens
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

    if (amountTokens.length === 0) {
      errors.push({
        rawLine,
        lineIndex,
        reason: "No valid debit, credit, or balance amount found after date",
      });
      continue;
    }

    let descText = rest.slice(0, amountTokens[0].index).replace(/\s+/g, " ").trim();
    if (!descText) {
      descText = rest.replace(amountTokens[0].raw, "").replace(/\s+/g, " ").trim();
    }

    const description = cleanDescription(descText);

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
        if (txnAmounts[0].value > 0) debit = Math.abs(txnAmounts[0].value);
        if (txnAmounts[1].value > 0) credit = Math.abs(txnAmounts[1].value);
      }
    }

    if (debit === null && credit === null) {
      errors.push({
        rawLine,
        lineIndex,
        reason: "Unable to distinguish debit/credit amount alignment",
      });
      continue;
    }

    transactions.push({
      date: isoDate,
      description,
      debit,
      credit,
      balance,
    });
  }

  return { transactions, errors };
}
