import type { IBankLayoutParser, BankLayoutParseResult } from "./types";
import { runTransactionExtractionEngine } from "../transaction-extraction-engine";

export class GenericLayoutParser implements IBankLayoutParser {
  readonly bankId = "generic";
  readonly bankName = "Standard Bank Statement";

  detectMatch(_lines: string[]): number {
    return 0.1; // Baseline fallback match
  }

  parseLayout(lines: string[]): BankLayoutParseResult {
    const result = runTransactionExtractionEngine(lines);

    return {
      bankId: this.bankId,
      bankName: this.bankName,
      confidence: 0.5,
      transactions: result.transactions,
      errors: result.errors,
    };
  }
}
