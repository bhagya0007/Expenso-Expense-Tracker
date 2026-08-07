import type { BankStatement, ImportStatus } from "./statement";
import type { BankTransaction } from "./transaction";

export type ValidationErrorSeverity = "error" | "warning" | "info";

export type ParserErrorCode =
  | "UNSUPPORTED_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "PASSWORD_PROTECTED"
  | "OCR_ENGINE_FAILURE"
  | "TEXT_EXTRACTION_FAILED"
  | "UNKNOWN_BANK_LAYOUT"
  | "NO_TRANSACTIONS_FOUND"
  | "INVALID_ROW_FORMAT"
  | "BALANCE_MISMATCH"
  | "DATE_PARSE_ERROR"
  | "AMOUNT_PARSE_ERROR"
  | "CORRUPT_DOCUMENT";

export interface ValidationError {
  id: string;
  field: string;
  ruleName: string;
  message: string;
  rawValue: string | null;
  lineIndex: number | null;
  pageIndex: number | null;
  severity: ValidationErrorSeverity;
}

export interface ParserError {
  code: ParserErrorCode;
  message: string;
  stage: ImportStatus;
  lineIndex?: number;
  pageIndex?: number;
  rawSnippet?: string;
  timestamp: Date;
  isFatal: boolean;
}

export interface ImportSummary {
  statementId: string;
  totalParsedRows: number;
  totalImportedRows: number;
  totalDuplicatesSkipped: number;
  totalFailedRows: number;
  totalDebitsAmount: number;
  totalCreditsAmount: number;
  netBalanceChange: number;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number;
}

export interface ParserResult {
  statement: BankStatement;
  transactions: BankTransaction[];
  summary: ImportSummary;
  errors: ParserError[];
  validationErrors: ValidationError[];
  isSuccess: boolean;
}
