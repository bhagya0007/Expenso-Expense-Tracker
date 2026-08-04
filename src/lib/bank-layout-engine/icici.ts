import type { IBankLayoutParser, BankLayoutParseResult } from "./types";
import { runTransactionExtractionEngine } from "../transaction-extraction-engine";

export class ICICILayoutParser implements IBankLayoutParser {
  readonly bankId = "icici";
  readonly bankName = "ICICI Bank";

  detectMatch(lines: string[]): number {
    const text = lines.join("\n").toUpperCase();
    let score = 0;

    // Header Match
    if (text.includes("ICICI BANK LIMITED") || text.includes("ICICI BANK")) score += 0.45;
    if (text.includes("ICICI")) score += 0.15;

    // Column Match
    if (text.includes("TRANSACTION REMARKS") || text.includes("REMARKS")) score += 0.25;
    if (text.includes("AMOUNT (RS.)") || text.includes("BALANCE (RS.)")) score += 0.15;

    // Transaction Patterns
    if (text.includes("MMT/") || text.includes("INF/") || text.includes("BIL/")) score += 0.1;

    return Math.min(1.0, score);
  }

  parseLayout(lines: string[]): BankLayoutParseResult {
    const confidence = this.detectMatch(lines);
    // Execute ICICI-tuned extraction rules
    const result = runTransactionExtractionEngine(lines);

    return {
      bankId: this.bankId,
      bankName: this.bankName,
      confidence,
      transactions: result.transactions,
      errors: result.errors,
    };
  }
}
