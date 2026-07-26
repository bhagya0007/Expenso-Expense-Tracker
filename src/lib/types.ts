// Domain types for Expenso. These mirror the future FastAPI schema
// so swapping the mock adapter for real REST calls is a one-file change.

export type TransactionType = "income" | "expense";

export type Category =
  | "Food & Dining"
  | "Transport"
  | "Shopping"
  | "Entertainment"
  | "Bills & Utilities"
  | "Health"
  | "Investments"
  | "Salary"
  | "Transfer"
  | "Rent"
  | "Other"
  | (string & {});

export type PaymentMethod = "UPI" | "Credit Card" | "Debit Card" | "Cash" | "Wallet" | "Bank";
export type AccountType = "Bank" | "Credit Card" | "Debit Card" | "Wallet" | "UPI" | "Cash";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: Category;
  merchant: string;
  date: string; // ISO
  notes?: string;
  tags?: string[];
  paymentMethod: PaymentMethod;
  accountId: string;
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  mask?: string;
}

export interface Budget {
  id: string;
  category: Category;
  limit: number;
  spent: number;
  period: "monthly" | "weekly";
}

export interface Insight {
  id: string;
  title: string;
  body: string;
  severity: "info" | "success" | "warning" | "danger";
}

export type ReminderCategory = "Bills" | "Card" | "Rent" | "Subscription";

export interface Reminder {
  id: string;
  title: string;
  amount: number;
  dueDate: string; // ISO
  category: ReminderCategory;
  autoPay: boolean;
}
