import type { ValidationError } from "./parser";

export type TransactionType = "debit" | "credit";

export interface TransactionConfidence {
  overall: number; // 0.0 to 1.0
  dateConfidence: number;
  amountConfidence: number;
  descriptionConfidence: number;
}

export interface BankTransaction {
  id: string;
  statementId: string;
  rawDate: string;
  date: Date;
  rawDescription: string;
  description: string;
  merchantName: string | null;
  rawAmount: string;
  amount: number;
  type: TransactionType;
  rawBalance: string | null;
  balance: number | null;
  category: string | null;
  confidence: TransactionConfidence;
  isFlagged: boolean;
  isDuplicate: boolean;
  validationErrors: ValidationError[];
  lineIndex: number;
  pageIndex: number;
}
