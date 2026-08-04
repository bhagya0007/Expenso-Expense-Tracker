import type { IBankLayoutParser, BankLayoutParseResult } from "./types";
import { runTransactionExtractionEngine } from "../transaction-extraction-engine";

export class HDFCLayoutParser implements IBankLayoutParser {
  readonly bankId = "hdfc";
  readonly bankName = "HDFC Bank";

  detectMatch(lines: string[]): number {
    const text = lines.join("\n").toUpperCase();
    let score = 0;

    // Header Match
    if (text.includes("HDFC BANK LIMITED") || text.includes("HDFC BANK")) score += 0.45;
    if (/\bHDFC\w*\b/.test(text)) score += 0.15;

    // Column Match
    if (text.includes("NARRATION") && (text.includes("CHQ/REF NO") || text.includes("CHQ/REF"))) score += 0.25;
    if (text.includes("WITHDRAWAL AMOUNT") || text.includes("DEPOSIT AMOUNT")) score += 0.15;

    // Transaction Patterns
    if (text.includes("NET BANKING") || text.includes("ATW-") || text.includes("POS-")) score += 0.1;

    return Math.min(1.0, score);
  }

  parseLayout(lines: string[]): BankLayoutParseResult {
    const confidence = this.detectMatch(lines);
    // Execute HDFC-tuned extraction rules
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
