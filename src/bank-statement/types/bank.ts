export type SupportedBankId =
  | "sbi"
  | "hdfc"
  | "icici"
  | "axis"
  | "kotak"
  | "generic";

export interface BankColumnMapping {
  dateColumn: number;
  descriptionColumn: number;
  debitColumn?: number;
  creditColumn?: number;
  amountColumn?: number;
  balanceColumn?: number;
}

export interface BankLayoutConfig {
  id: SupportedBankId;
  name: string;
  logoUrl?: string;
  detectionKeywords: string[];
  headerSignatures: string[];
  columnMapping: BankColumnMapping;
  dateFormatPatterns: string[];
}
