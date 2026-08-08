import type { Transaction, Budget, Category } from "@/lib/types";
import type { CalculatedResult } from "../types/ai.types";
import { getCurrentMonthRange, filterTransactionsByDateRange } from "./retrieval-tools";

export function calculateCategorySummary(
  txs: Transaction[],
  categoryTarget?: string
): CalculatedResult {
  const currentMonth = getCurrentMonthRange();
  const monthTxs = filterTransactionsByDateRange(txs, currentMonth);

  if (categoryTarget) {
    const matched = monthTxs.filter(
      (t) => (t.category || "").toLowerCase().includes(categoryTarget.toLowerCase()) && t.type === "expense"
    );
    const totalSpent = matched.reduce((s, t) => s + t.amount, 0);
    const count = matched.length;

    return {
      toolName: "calculateCategorySummary",
      headline: `Spent ₹${totalSpent.toLocaleString("en-IN")} on ${categoryTarget} this month`,
      numericValues: {
        category: categoryTarget,
        totalSpent: Math.round(totalSpent * 100) / 100,
        transactionCount: count,
      },
      dataPoints: matched.map((t) => ({ date: t.date, merchant: t.merchant, amount: t.amount })),
    };
  }

  // Breakdown for all categories this month
  const categoryMap = new Map<string, number>();
  monthTxs
    .filter((t) => t.type === "expense")
    .forEach((t) => {
      const cat = t.category || "Other";
      categoryMap.set(cat, (categoryMap.get(cat) || 0) + t.amount);
    });

  const sortedCategories = Array.from(categoryMap.entries())
    .map(([category, amount]) => ({ category, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);

  const totalExpense = sortedCategories.reduce((s, c) => s + c.amount, 0);

  return {
    toolName: "calculateCategorySummary",
    headline: `Total monthly expense is ₹${totalExpense.toLocaleString("en-IN")} across ${sortedCategories.length} categories`,
    numericValues: {
      totalExpense: Math.round(totalExpense * 100) / 100,
      topCategory: sortedCategories[0]?.category || "None",
      topCategoryAmount: sortedCategories[0]?.amount || 0,
    },
    dataPoints: sortedCategories,
  };
}

export function calculateMerchantSummary(
  txs: Transaction[],
  merchantQuery: string
): CalculatedResult {
  const queryLower = merchantQuery.toLowerCase().trim();
  const matched = txs.filter((t) => (t.merchant || "").toLowerCase().includes(queryLower));

  const totalSpent = matched.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const totalReceived = matched.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const netAmount = totalSpent - totalReceived;

  return {
    toolName: "calculateMerchantSummary",
    headline: `Found ${matched.length} transactions for '${merchantQuery}' totaling ₹${totalSpent.toLocaleString("en-IN")}`,
    numericValues: {
      merchant: merchantQuery,
      totalSpent: Math.round(totalSpent * 100) / 100,
      totalReceived: Math.round(totalReceived * 100) / 100,
      netAmount: Math.round(netAmount * 100) / 100,
      transactionCount: matched.length,
    },
    dataPoints: matched.map((t) => ({
      date: t.date,
      merchant: t.merchant,
      amount: t.amount,
      type: t.type,
    })),
  };
}

export function calculateMonthlySummary(txs: Transaction[]): CalculatedResult {
  const currentMonth = getCurrentMonthRange();
  const monthTxs = filterTransactionsByDateRange(txs, currentMonth);

  const income = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const netSavings = income - expense;
  const savingsRate = income > 0 ? Math.round((netSavings / income) * 100) : 0;

  return {
    toolName: "calculateMonthlySummary",
    headline: `This month: Income ₹${income.toLocaleString("en-IN")}, Expenses ₹${expense.toLocaleString("en-IN")}`,
    numericValues: {
      income: Math.round(income * 100) / 100,
      expense: Math.round(expense * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      savingsRate: savingsRate,
      transactionCount: monthTxs.length,
    },
  };
}

export function calculateBudgetAdherence(
  txs: Transaction[],
  budgets: Budget[]
): CalculatedResult {
  const currentMonth = getCurrentMonthRange();
  const monthTxs = filterTransactionsByDateRange(txs, currentMonth).filter((t) => t.type === "expense");

  const budgetStatuses = budgets.map((b) => {
    const spent = monthTxs
      .filter((t) => (t.category || "").toLowerCase() === (b.category || "").toLowerCase())
      .reduce((s, t) => s + t.amount, 0);
    const percentage = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
    const isOver = spent > b.limit;

    return {
      category: b.category,
      limit: b.limit,
      spent: Math.round(spent * 100) / 100,
      remaining: Math.round((b.limit - spent) * 100) / 100,
      percentage,
      isOver,
    };
  });

  const totalLimit = budgets.reduce((s, b) => s + b.limit, 0);
  const totalSpent = budgetStatuses.reduce((s, b) => s + b.spent, 0);
  const overCount = budgetStatuses.filter((b) => b.isOver).length;

  return {
    toolName: "calculateBudgetAdherence",
    headline: `${overCount > 0 ? `${overCount} budgets exceeded` : "All budgets on track"} (${Math.round((totalSpent / (totalLimit || 1)) * 100)}% total limit used)`,
    numericValues: {
      totalLimit,
      totalSpent: Math.round(totalSpent * 100) / 100,
      overCount,
      budgetCount: budgets.length,
    },
    dataPoints: budgetStatuses,
  };
}
