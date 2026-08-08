import type { Transaction, Budget, Category } from "@/lib/types";

export type DataValueType = "actual" | "calculated" | "estimate" | "forecast";

export interface ValueWithMeta<T = number> {
  value: T;
  type: DataValueType;
  label: string;
  unit?: string;
}

export interface IncomeCalculationResult {
  totalIncome: ValueWithMeta;
  transactionCount: ValueWithMeta<number>;
}

export interface ExpenseCalculationResult {
  totalExpenses: ValueWithMeta;
  transactionCount: ValueWithMeta<number>;
}

export interface NetSavingsResult {
  totalIncome: ValueWithMeta;
  totalExpenses: ValueWithMeta;
  netSavings: ValueWithMeta;
  isPositive: boolean;
}

export interface SavingsRateResult {
  savingsRatePercentage: ValueWithMeta;
  savingsTier: "Excellent" | "Good" | "Fair" | "Needs Improvement";
}

export interface CategoryPercentageItem {
  category: Category;
  amount: ValueWithMeta;
  percentage: ValueWithMeta;
  transactionCount: number;
}

export interface MonthComparisonResult {
  currentMonthExpense: ValueWithMeta;
  previousMonthExpense: ValueWithMeta;
  expenseChangeAmount: ValueWithMeta;
  expenseChangePercentage: ValueWithMeta;
  currentMonthIncome: ValueWithMeta;
  previousMonthIncome: ValueWithMeta;
  incomeChangeAmount: ValueWithMeta;
  incomeChangePercentage: ValueWithMeta;
  trendDirection: "increased" | "decreased" | "stable";
}

export interface SpendingChangeResult {
  previousPeriodAmount: ValueWithMeta;
  currentPeriodAmount: ValueWithMeta;
  differenceAmount: ValueWithMeta;
  percentageChange: ValueWithMeta;
  direction: "increase" | "decrease" | "unchanged";
}

export interface BudgetRemainingResult {
  category: Category;
  limit: ValueWithMeta;
  spent: ValueWithMeta;
  remaining: ValueWithMeta;
  usagePercentage: ValueWithMeta;
  isOverBudget: boolean;
}

export interface SafeToSpendEstimateResult {
  currentBalance: ValueWithMeta;
  upcomingCommitments: ValueWithMeta;
  plannedSavings: ValueWithMeta;
  remainingEssentialExpenses: ValueWithMeta;
  estimatedSafeToSpend: ValueWithMeta;
  canSafelySpend: boolean;
}

export interface WhatIfCalculationResult {
  currentBalance: ValueWithMeta;
  purchaseAmount: ValueWithMeta;
  upcomingCommitments: ValueWithMeta;
  plannedSavings: ValueWithMeta;
  remainingBalanceAfterPurchase: ValueWithMeta;
  isAffordable: boolean;
  explanation: string;
}

function round2(num: number): number {
  const n = Number(num);
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function clampPct(num: number): number {
  const n = Number(num);
  if (isNaN(n) || !isFinite(n)) return 0;
  return Math.min(100, Math.max(0, round2(n)));
}

/**
 * 1. Calculate Total Income from transactions (actual).
 */
export function calculateTotalIncome(transactions: Transaction[]): IncomeCalculationResult {
  const incomeTxs = transactions.filter((t) => t.type === "income");
  const sum = incomeTxs.reduce((s, t) => s + (t.amount || 0), 0);

  return {
    totalIncome: {
      value: round2(sum),
      type: "actual",
      label: "Total Income",
      unit: "INR",
    },
    transactionCount: {
      value: incomeTxs.length,
      type: "actual",
      label: "Income Transaction Count",
      unit: "count",
    },
  };
}

/**
 * 2. Calculate Total Expenses from transactions (actual).
 */
export function calculateTotalExpenses(transactions: Transaction[]): ExpenseCalculationResult {
  const expenseTxs = transactions.filter((t) => t.type === "expense");
  const sum = expenseTxs.reduce((s, t) => s + (t.amount || 0), 0);

  return {
    totalExpenses: {
      value: round2(sum),
      type: "actual",
      label: "Total Expenses",
      unit: "INR",
    },
    transactionCount: {
      value: expenseTxs.length,
      type: "actual",
      label: "Expense Transaction Count",
      unit: "count",
    },
  };
}

/**
 * 3. Calculate Net Savings = Income - Expenses (calculated).
 */
export function calculateNetSavings(totalIncome: number, totalExpenses: number): NetSavingsResult {
  const savings = round2(totalIncome - totalExpenses);

  return {
    netSavings: {
      value: savings,
      type: "calculated",
      label: "Net Savings",
      unit: "INR",
    },
    isPositiveSavings: savings >= 0,
  };
}

/**
 * 4. Calculate Savings Rate = (Net Savings / Income) * 100 (clamped between 0 and 100).
 */
export function calculateSavingsRate(totalIncome: number, netSavings: number): SavingsRateResult {
  let rate = 0;
  if (totalIncome > 0) {
    rate = clampPct((netSavings / totalIncome) * 100);
  }

  let tier: "Excellent" | "Good" | "Fair" | "Needs Improvement" = "Needs Improvement";
  if (rate >= 30) tier = "Excellent";
  else if (rate >= 20) tier = "Good";
  else if (rate >= 10) tier = "Fair";

  return {
    savingsRatePercentage: {
      value: rate,
      type: "calculated",
      label: "Savings Rate",
      unit: "%",
    },
    savingsTier: tier,
  };
}

/**
 * 5. Calculate Category Spending Percentages (clamped between 0 and 100).
 */
export function calculateCategoryPercentages(transactions: Transaction[]): CategoryPercentageItem[] {
  const expenseTxs = transactions.filter((t) => t.type === "expense");
  const totalSpent = expenseTxs.reduce((s, t) => s + (t.amount || 0), 0) || 1;

  const map = new Map<Category, { sum: number; count: number }>();
  expenseTxs.forEach((t) => {
    const cat = t.category || "Other";
    const current = map.get(cat) || { sum: 0, count: 0 };
    map.set(cat, { sum: current.sum + t.amount, count: current.count + 1 });
  });

  return Array.from(map.entries())
    .map(([category, data]) => ({
      category,
      amount: { value: round2(data.sum), type: "actual" as DataValueType, label: `${category} Spending`, unit: "INR" },
      percentage: {
        value: clampPct((data.sum / totalSpent) * 100),
        type: "calculated" as DataValueType,
        label: `${category} Percentage`,
        unit: "%",
      },
      transactionCount: data.count,
    }))
    .sort((a, b) => b.amount.value - a.amount.value);
}

/**
 * 6. Calculate Month-to-Month Comparison (calculated).
 */
export function calculateMonthToMonthComparison(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[]
): MonthComparisonResult {
  const currInc = calculateTotalIncome(currentTransactions).totalIncome.value;
  const currExp = calculateTotalExpenses(currentTransactions).totalExpenses.value;

  const prevInc = calculateTotalIncome(previousTransactions).totalIncome.value;
  const prevExp = calculateTotalExpenses(previousTransactions).totalExpenses.value;

  const expDiff = round2(currExp - prevExp);
  const expPct = prevExp > 0 ? round2((expDiff / prevExp) * 100) : currExp > 0 ? 100 : 0;

  const incDiff = round2(currInc - prevInc);
  const incPct = prevInc > 0 ? round2((incDiff / prevInc) * 100) : currInc > 0 ? 100 : 0;

  const trendDirection: "increased" | "decreased" | "stable" =
    expDiff > 0 ? "increased" : expDiff < 0 ? "decreased" : "stable";

  return {
    currentMonthExpense: { value: currExp, type: "actual", label: "Current Month Expenses", unit: "INR" },
    previousMonthExpense: { value: prevExp, type: "actual", label: "Previous Month Expenses", unit: "INR" },
    expenseChangeAmount: { value: expDiff, type: "calculated", label: "Expense Difference", unit: "INR" },
    expenseChangePercentage: { value: expPct, type: "calculated", label: "Expense Change Percentage", unit: "%" },

    currentMonthIncome: { value: currInc, type: "actual", label: "Current Month Income", unit: "INR" },
    previousMonthIncome: { value: prevInc, type: "actual", label: "Previous Month Income", unit: "INR" },
    incomeChangeAmount: { value: incDiff, type: "calculated", label: "Income Difference", unit: "INR" },
    incomeChangePercentage: { value: incPct, type: "calculated", label: "Income Change Percentage", unit: "%" },

    trendDirection,
  };
}

/**
 * 7. Calculate Spending Change between two amounts (calculated).
 */
export function calculateSpendingChange(currentAmount: number, previousAmount: number): SpendingChangeResult {
  const diff = round2(currentAmount - previousAmount);
  const pct = previousAmount > 0 ? round2((diff / previousAmount) * 100) : currentAmount > 0 ? 100 : 0;

  return {
    previousPeriodAmount: { value: round2(previousAmount), type: "actual", label: "Previous Period", unit: "INR" },
    currentPeriodAmount: { value: round2(currentAmount), type: "actual", label: "Current Period", unit: "INR" },
    differenceAmount: { value: diff, type: "calculated", label: "Difference", unit: "INR" },
    percentageChange: { value: pct, type: "calculated", label: "Percentage Change", unit: "%" },
    direction: diff > 0 ? "increase" : diff < 0 ? "decrease" : "unchanged",
  };
}

/**
 * 8. Calculate Budget Remaining = Limit - Spent (calculated).
 */
export function calculateBudgetRemaining(budgetLimit: number, totalSpent: number, category: Category): BudgetRemainingResult {
  const limit = round2(budgetLimit);
  const spent = round2(totalSpent);
  const remaining = round2(limit - spent);
  const usagePct = limit > 0 ? clampPct((spent / limit) * 100) : 0;

  return {
    category,
    limit: { value: limit, type: "actual", label: "Budget Limit", unit: "INR" },
    spent: { value: spent, type: "actual", label: "Amount Spent", unit: "INR" },
    remaining: { value: remaining, type: "calculated", label: "Remaining Budget", unit: "INR" },
    usagePercentage: { value: usagePct, type: "calculated", label: "Budget Usage Percentage", unit: "%" },
    isOverBudget: spent > limit,
  };
}

/**
 * 9. Calculate Safe-to-Spend Estimate (estimate).
 *
 * Current Balance
 * - Upcoming Commitments (bills/reminders)
 * - Planned Savings Target
 * - Remaining Essential Expenses (groceries/rent forecast)
 * = Estimated Safe-to-Spend Discretionary Amount
 */
export function calculateSafeToSpendEstimate(
  currentBalance: number,
  upcomingCommitments: number,
  plannedSavings: number,
  remainingEssentialExpenses: number
): SafeToSpendEstimateResult {
  const bal = round2(currentBalance);
  const comm = round2(upcomingCommitments);
  const sav = round2(plannedSavings);
  const ess = round2(remainingEssentialExpenses);

  const safeToSpend = round2(bal - comm - sav - ess);

  return {
    currentBalance: { value: bal, type: "actual", label: "Current Net Balance", unit: "INR" },
    upcomingCommitments: { value: comm, type: "actual", label: "Upcoming Commitments", unit: "INR" },
    plannedSavings: { value: sav, type: "estimate", label: "Planned Savings Target", unit: "INR" },
    remainingEssentialExpenses: { value: ess, type: "forecast", label: "Remaining Essential Expenses", unit: "INR" },
    estimatedSafeToSpend: { value: safeToSpend, type: "estimate", label: "Estimated Safe-to-Spend Amount", unit: "INR" },
    canSafelySpend: safeToSpend > 0,
  };
}

/**
 * 10. Calculate What-If Scenario (forecast/estimate).
 */
export function calculateWhatIfScenario(
  currentBalance: number,
  upcomingCommitments: number,
  plannedSavings: number,
  purchaseAmount: number
): WhatIfCalculationResult {
  const safeEst = calculateSafeToSpendEstimate(currentBalance, upcomingCommitments, plannedSavings, 0);
  const purch = round2(purchaseAmount);
  const remainingAfter = round2(safeEst.estimatedSafeToSpend.value - purch);
  const isAffordable = remainingAfter >= 0;

  let explanation = `With a current balance of ₹${currentBalance.toLocaleString("en-IN")}, after accounting for ₹${upcomingCommitments.toLocaleString(
    "en-IN"
  )} in commitments and ₹${plannedSavings.toLocaleString("en-IN")} in savings, `;

  if (isAffordable) {
    explanation += `you can safely afford this purchase of ₹${purch.toLocaleString(
      "en-IN"
    )}. You will have ₹${remainingAfter.toLocaleString("en-IN")} in safe discretionary funds remaining.`;
  } else {
    explanation += `a purchase of ₹${purch.toLocaleString(
      "en-IN"
    )} exceeds your safe discretionary budget by ₹${Math.abs(remainingAfter).toLocaleString("en-IN")}.`;
  }

  return {
    currentBalance: { value: round2(currentBalance), type: "actual", label: "Current Balance", unit: "INR" },
    purchaseAmount: { value: purch, type: "estimate", label: "Purchase Amount", unit: "INR" },
    upcomingCommitments: { value: round2(upcomingCommitments), type: "actual", label: "Commitments", unit: "INR" },
    plannedSavings: { value: round2(plannedSavings), type: "estimate", label: "Planned Savings", unit: "INR" },
    remainingBalanceAfterPurchase: { value: remainingAfter, type: "forecast", label: "Remaining Safe Funds", unit: "INR" },
    isAffordable,
    explanation,
  };
}
