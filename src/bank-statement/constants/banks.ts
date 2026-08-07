import type { BankLayoutConfig } from "../types/bank";

export const SUPPORTED_BANKS: Record<string, BankLayoutConfig> = {
  sbi: {
    id: "sbi",
    name: "State Bank of India (SBI)",
    detectionKeywords: ["STATE BANK OF INDIA", "SBI", "Txn Date", "Value Date"],
    headerSignatures: ["Txn Date", "Value Date", "Description", "Ref No./Cheque No.", "Branch Code", "Debit", "Credit", "Balance"],
    columnMapping: { dateColumn: 0, descriptionColumn: 2, debitColumn: 5, creditColumn: 6, balanceColumn: 7 },
    dateFormatPatterns: ["DD/MM/YYYY", "DD-MMM-YYYY"],
  },
  hdfc: {
    id: "hdfc",
    name: "HDFC Bank",
    detectionKeywords: ["HDFC BANK", "HDFC", "Narration", "Chq/Ref Number"],
    headerSignatures: ["Date", "Narration", "Chq/Ref Number", "Value Dt", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"],
    columnMapping: { dateColumn: 0, descriptionColumn: 1, debitColumn: 4, creditColumn: 5, balanceColumn: 6 },
    dateFormatPatterns: ["DD/MM/YY", "DD/MM/YYYY"],
  },
  icici: {
    id: "icici",
    name: "ICICI Bank",
    detectionKeywords: ["ICICI BANK", "ICICI", "Transaction Remarks"],
    headerSignatures: ["Value Date", "Transaction Date", "Cheque Number", "Transaction Remarks", "Withdrawal Amount", "Deposit Amount", "Balance"],
    columnMapping: { dateColumn: 0, descriptionColumn: 3, debitColumn: 4, creditColumn: 5, balanceColumn: 6 },
    dateFormatPatterns: ["DD/MM/YYYY"],
  },
  generic: {
    id: "generic",
    name: "Generic Bank Statement",
    detectionKeywords: ["Statement", "Account", "Date", "Particulars"],
    headerSignatures: ["Date", "Particulars", "Debit", "Credit", "Balance"],
    columnMapping: { dateColumn: 0, descriptionColumn: 1, debitColumn: 2, creditColumn: 3, balanceColumn: 4 },
    dateFormatPatterns: ["DD/MM/YYYY", "YYYY-MM-DD", "DD-MM-YYYY"],
  },
};
