import type { BankTransaction } from "../types/transaction";

export interface MonthlySummaryReport {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRatePercentage: number;
  categoryBreakdown: Record<string, number>;
}

export interface StatementAnalyticsReport {
  monthlySummary: MonthlySummaryReport;
  budgetAdvice: string[];
  savingsSuggestions: string[];
}

export class StatementAnalyticsService {
  /**
   * Generates Monthly Summary, Budget Advice, and Savings Suggestions.
   * Analyzes structured transaction objects ONLY — NEVER analyzes raw PDF files.
   */
  generateAnalytics(transactions: BankTransaction[]): StatementAnalyticsReport {
    if (!transactions || transactions.length === 0) {
      return {
        monthlySummary: {
          totalIncome: 0,
          totalExpenses: 0,
          netSavings: 0,
          savingsRatePercentage: 0,
          categoryBreakdown: {},
        },
        budgetAdvice: ["No transactions available to analyze."],
        savingsSuggestions: ["Import statement transactions to receive personalized savings recommendations."],
      };
    }

    // 1. Monthly Summary Computations
    const totalIncome = transactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpenses = transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);

    const netSavings = totalIncome - totalExpenses;
    const savingsRatePercentage = totalIncome > 0 ? Number(((netSavings / totalIncome) * 100).toFixed(1)) : 0;

    // Category Breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.type === "debit") {
        const cat = tx.category || "Uncategorized";
        categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + tx.amount;
      }
    }

    // 2. Budget Advice Generation
    const budgetAdvice: string[] = [];
    const foodSpend = categoryBreakdown["Food"] || 0;
    const shoppingSpend = categoryBreakdown["Shopping"] || 0;
    const entertainmentSpend = categoryBreakdown["Entertainment"] || 0;

    if (totalIncome > 0 && foodSpend / totalIncome > 0.25) {
      budgetAdvice.append
        ? budgetAdvice.push(`Food expenses (₹${foodSpend.toFixed(2)}) exceed 25% of monthly income. Consider setting a strict dining cap.`)
        : null;
    }

    if (totalIncome > 0 && shoppingSpend / totalIncome > 0.2) {
      budgetAdvice.push(`Shopping expenses (₹${shoppingSpend.toFixed(2)}) exceed 20% of monthly income. Limit non-essential e-commerce purchases.`);
    }

    if (totalExpenses > totalIncome && totalIncome > 0) {
      budgetAdvice.push(`Monthly expenditure exceeds income by ₹${Math.abs(netSavings).toFixed(2)}. Adjust discretionary budgets to prevent deficit.`);
    } else if (budgetAdvice.length === 0) {
      budgetAdvice.push("Your category spending is well-balanced across essential and discretionary buckets.");
    }

    // 3. Savings Suggestions
    const savingsSuggestions: string[] = [];

    if (foodSpend > 2000) {
      const foodSave = (foodSpend * 0.2).toFixed(2);
      savingsSuggestions.push(`Reducing food delivery orders by 20% can save approximately ₹${foodSave} every month.`);
    }

    if (shoppingSpend > 3000) {
      const shopSave = (shoppingSpend * 0.15).toFixed(2);
      savingsSuggestions.push(`Deferring non-urgent shopping orders could build ₹${shopSave} in emergency savings.`);
    }

    if (entertainmentSpend > 1000) {
      savingsSuggestions.push("Review recurring digital subscriptions and cancel inactive streaming platforms to increase savings.");
    }

    if (savingsSuggestions.length === 0) {
      savingsSuggestions.push("Maintain current spending discipline and redirect monthly surplus into automated investment funds.");
    }

    return {
      monthlySummary: {
        totalIncome,
        totalExpenses,
        netSavings,
        savingsRatePercentage,
        categoryBreakdown,
      },
      budgetAdvice,
      savingsSuggestions,
    };
  }
}

export const statementAnalyticsService = new StatementAnalyticsService();
