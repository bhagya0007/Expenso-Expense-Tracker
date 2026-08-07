import type { SupportedBankId } from "./bank";

export type StatementMimeType =
  | "application/pdf"
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type ImportStatus =
  | "idle"
  | "uploading"
  | "preprocessing"
  | "detecting_bank"
  | "extracting_text"
  | "parsing_rows"
  | "validating"
  | "importing"
  | "completed"
  | "failed"
  | "cancelled";

export interface StatementPeriod {
  startDate: Date | null;
  endDate: Date | null;
}

export interface BankStatementMetadata {
  accountName?: string;
  accountType?: string;
  branchName?: string;
  ifscCode?: string;
  currency: string;
  isPasswordProtected: boolean;
  pageCount: number;
}

export interface BankStatement {
  id: string;
  userId: string;
  fileName: string;
  fileSizeBytes: number;
  mimeType: StatementMimeType;
  bankId: SupportedBankId;
  bankName: string;
  accountNumberMask: string | null;
  period: StatementPeriod;
  openingBalance: number | null;
  closingBalance: number | null;
  totalTransactionsCount: number;
  status: ImportStatus;
  uploadedAt: Date;
  processedAt: Date | null;
  metadata: BankStatementMetadata;
}
