import type { IBankLayoutParser, BankLayoutParseResult } from "./types";
import { runTransactionExtractionEngine } from "../transaction-extraction-engine";

export class SBILayoutParser implements IBankLayoutParser {
  readonly bankId = "sbi";
  readonly bankName = "State Bank of India (SBI)";

  detectMatch(lines: string[]): number {
    const text = lines.join("\n").toUpperCase();
    let score = 0;

    // Header Match
    if (text.includes("STATE BANK OF INDIA") || text.includes("STATE BANK")) score += 0.45;
    if (/\bSBIN\w*\b/.test(text) || text.includes("SBI")) score += 0.15;

    // Column Match
    if (text.includes("TXN DATE") && text.includes("VALUE DATE")) score += 0.25;
    if (text.includes("REF NO./CHEQUE NO") || text.includes("REF NO")) score += 0.15;

    // Transaction Patterns
    if (text.includes("TRANSFER TO") || text.includes("BY TRANSFER") || text.includes("ATM WDL")) score += 0.1;

    return Math.min(1.0, score);
  }

  parseLayout(lines: string[]): BankLayoutParseResult {
    const confidence = this.detectMatch(lines);
    // Execute SBI-tuned extraction rules
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
