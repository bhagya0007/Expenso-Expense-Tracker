import type { Category } from "@/lib/types";

export type IntentType =
  | "SPENDING_QUERY"
  | "CATEGORY_QUERY"
  | "MERCHANT_QUERY"
  | "COMPARISON_QUERY"
  | "BUDGET_QUERY"
  | "SAFE_TO_SPEND_QUERY"
  | "FORECAST_QUERY"
  | "SUBSCRIPTION_QUERY"
  | "ANOMALY_QUERY"
  | "SAVING_ADVICE"
  | "TRANSACTION_QUERY"
  | "ACTION_REQUEST"
  | "GENERAL_FINANCIAL_QUERY";

export interface StructuredContextPayload {
  intent: IntentType;
  dateRangeLabel: string;
  hasData: boolean;
  unavailableReason?: string;
  data: Record<string, unknown>;
}

export type ActionType =
  | "CREATE_TRANSACTION"
  | "CREATE_BUDGET"
  | "UPDATE_BUDGET"
  | "CREATE_SAVINGS_GOAL"
  | "CREATE_REMINDER"
  | "CATEGORIZE_TRANSACTIONS";

export interface ActionProposal {
  id: string;
  type: ActionType;
  title: string;
  description: string;
  payload: {
    amount?: number;
    category?: Category;
    merchant?: string;
    type?: "income" | "expense";
    date?: string;
    limit?: number;
    period?: "monthly" | "weekly";
    reminderTitle?: string;
    reminderDueDate?: string;
    targetCategory?: Category;
    transactionIds?: string[];
    paymentMethod?: string;
    accountName?: string;
    accountId?: string;
  };
  status: "pending" | "confirmed" | "cancelled";
}

export interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: Date;
  intent?: IntentType;
  structuredPayload?: StructuredContextPayload;
  actionProposal?: ActionProposal;
  isError?: boolean;
}

export interface ExpensoAIInsight {
  id: string;
  type: "anomaly" | "budget_warning" | "savings_opportunity" | "achievement";
  title: string;
  description: string;
  impactAmount?: number;
  severity: "info" | "warning" | "success" | "danger";
  createdAt: string;
}
