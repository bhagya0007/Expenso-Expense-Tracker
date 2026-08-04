import type { StrictExtractedTransaction, ParsingError } from "../transaction-extraction-engine";

export interface BankLayoutParseResult {
  bankId: string;
  bankName: string;
  confidence: number;
  transactions: StrictExtractedTransaction[];
  errors: ParsingError[];
}

export interface IBankLayoutParser {
  readonly bankId: string;
  readonly bankName: string;

  /**
   * Evaluates text lines to check if this document matches this bank layout.
   * Returns confidence score between 0.0 (no match) and 1.0 (exact match).
   */
  detectMatch(lines: string[]): number;

  /**
   * Executes bank-specific parsing rules tailored to this bank layout.
   */
  parseLayout(lines: string[]): BankLayoutParseResult;
}
