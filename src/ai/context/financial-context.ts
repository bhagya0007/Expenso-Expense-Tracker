import { api } from "@/lib/api";
import { auth } from "@/integrations/firebase/client";

export interface UserFinancialContext {
  uid: string;
  monthlyBudgetLimit: number;
  savingsGoalAmount: number;
  recurringCommitmentsTotal: number;
  primarySpendingCategory: string;
  financialTargets: string[];
  activeBudgetCount: number;
  lastUpdatedISO: string;
}

/**
 * Lightweight Financial Context System for Expenso AI.
 * Fetches and aggregates current user financial targets, budgets, and commitments.
 * Strictly avoids storing sensitive chat transcripts unnecessarily.
 */
export async function getUserFinancialContext(): Promise<UserFinancialContext> {
  const uid = auth?.currentUser?.uid || "guest";

  const [budgets, reminders, transactions] = await Promise.all([
    api.listBudgets(),
    api.listReminders(),
    api.listTransactions({ limit: 100 }),
  ]);

  const monthlyBudgetLimit = budgets.reduce((sum, b) => sum + (b.limit || 0), 0);

  const savingsBudget = budgets.find(
    (b) => b.category === "Investments" || b.category === "Other"
  );
  const savingsGoalAmount = savingsBudget?.limit || 20000;

  const recurringCommitmentsTotal = reminders
    .filter((r) => !r.isCompleted)
    .reduce((sum) => sum + 1500, 0); // Active commitment allocation

  // Calculate primary spending category
  const catMap = new Map<string, number>();
  transactions
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const c = t.category || "Other";
      catMap.set(c, (catMap.get(c) || 0) + t.amount);
    });

  let primarySpendingCategory = "Food & Dining";
  let maxSpent = 0;
  catMap.forEach((amt, cat) => {
    if (amt > maxSpent) {
      maxSpent = amt;
      primarySpendingCategory = cat;
    }
  });

  const financialTargets: string[] = [];
  if (monthlyBudgetLimit > 0) {
    financialTargets.push(`Monthly Spending Cap: ₹${monthlyBudgetLimit.toLocaleString("en-IN")}`);
  }
  if (savingsGoalAmount > 0) {
    financialTargets.push(`Monthly Savings Target: ₹${savingsGoalAmount.toLocaleString("en-IN")}`);
  }

  return {
    uid,
    monthlyBudgetLimit,
    savingsGoalAmount,
    recurringCommitmentsTotal,
    primarySpendingCategory,
    financialTargets,
    activeBudgetCount: budgets.length,
    lastUpdatedISO: new Date().toISOString(),
  };
}

/**
 * Formats a concise financial context summary string for inclusion in LLM prompt context payloads.
 */
export function formatFinancialContextSummary(context: UserFinancialContext): string {
  return (
    `• Monthly Budget Cap: ₹${context.monthlyBudgetLimit.toLocaleString("en-IN")}\n` +
    `• Savings Goal: ₹${context.savingsGoalAmount.toLocaleString("en-IN")}/mo\n` +
    `• Primary Category: ${context.primarySpendingCategory}\n` +
    `• Active Commitments: ₹${context.recurringCommitmentsTotal.toLocaleString("en-IN")}`
  );
}
