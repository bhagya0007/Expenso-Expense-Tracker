import { api } from "@/lib/api";
import type { Transaction, Account, Budget, Reminder, Category, TransactionType } from "@/lib/types";

export interface TransactionFilterParams {
  startDate?: string;
  endDate?: string;
  category?: Category;
  type?: TransactionType;
  merchant?: string;
  limit?: number;
}

export interface CurrentBalanceResult {
  totalBalance: number;
  accountBalances: { id: string; name: string; balance: number; type: string }[];
}

export interface MonthlyTotalsResult {
  year: number;
  month: number;
  totalAmount: number;
  transactionCount: number;
}

export interface CategorySpending {
  category: Category;
  totalSpent: number;
  transactionCount: number;
  percentageOfTotal: number;
}

export interface MerchantSpending {
  merchant: string;
  totalSpent: number;
  totalIncome: number;
  netAmount: number;
  transactionCount: number;
}

export interface RecurringTransaction {
  merchant: string;
  amount: number;
  category: Category;
  frequency: string;
  occurrences: number;
}

export interface UpcomingCommitment {
  id: string;
  title: string;
  amount: number;
  dueDate: string;
  category: string;
  autoPay: boolean;
}

export interface CategoryBudgetStatus {
  category: Category;
  limit: number;
  spent: number;
  remaining: number;
  usagePercentage: number;
  isOverBudget: boolean;
}

export interface BudgetStatusSummary {
  budgets: CategoryBudgetStatus[];
  totalLimit: number;
  totalSpent: number;
  overallUsagePercentage: number;
  overBudgetCount: number;
}

export interface SavingsRateResult {
  monthlyIncome: number;
  monthlyExpenses: number;
  netSavings: number;
  savingsRatePercentage: number;
  isPositive: boolean;
}

function parseMonthYear(year?: number, month?: number): { start: Date; end: Date; y: number; m: number } {
  const now = new Date();
  const y = year ?? now.getFullYear();
  const m = month ?? now.getMonth() + 1; // 1-indexed
  const start = new Date(y, m - 1, 1, 0, 0, 0, 0);
  const end = new Date(y, m, 0, 23, 59, 59, 999);
  return { start, end, y, m };
}

/**
 * 1. Safely retrieve authenticated user's transactions with optional filters.
 */
export async function getTransactions(params?: TransactionFilterParams): Promise<Transaction[]> {
  try {
    const txs = await api.listTransactions();
    if (!txs || txs.length === 0) return [];

    let filtered = [...txs];

    if (params?.startDate) {
      const startStr = params.startDate.slice(0, 10);
      filtered = filtered.filter((t) => t.date.slice(0, 10) >= startStr);
    }

    if (params?.endDate) {
      const endStr = params.endDate.slice(0, 10);
      filtered = filtered.filter((t) => t.date.slice(0, 10) <= endStr);
    }

    if (params?.category) {
      const cLower = params.category.toLowerCase();
      filtered = filtered.filter((t) => (t.category || "").toLowerCase() === cLower);
    }

    if (params?.type) {
      filtered = filtered.filter((t) => t.type === params.type);
    }

    if (params?.merchant) {
      const mLower = params.merchant.toLowerCase().trim();
      filtered = filtered.filter((t) => (t.merchant || "").toLowerCase().includes(mLower));
    }

    if (params?.limit && params.limit > 0) {
      filtered = filtered.slice(0, params.limit);
    }

    return filtered;
  } catch (err) {
    console.error("getTransactions error:", err);
    return [];
  }
}

/**
 * 2. Calculate current total net balance across user's accounts.
 */
export async function getCurrentBalance(): Promise<CurrentBalanceResult> {
  try {
    const accounts = await api.listAccounts();
    if (accounts && accounts.length > 0) {
      const totalBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);
      const accountBalances = accounts.map((a) => ({
        id: a.id,
        name: a.name,
        balance: Math.round((a.balance || 0) * 100) / 100,
        type: a.type,
      }));
      return { totalBalance: Math.round(totalBalance * 100) / 100, accountBalances };
    }

    // Fallback: Compute net cashflow from all transactions
    const txs = await getTransactions();
    const netCashflow = txs.reduce((sum, t) => sum + (t.type === "income" ? t.amount : -t.amount), 0);
    return {
      totalBalance: Math.round(netCashflow * 100) / 100,
      accountBalances: [],
    };
  } catch (err) {
    console.error("getCurrentBalance error:", err);
    return { totalBalance: 0, accountBalances: [] };
  }
}

/**
 * 3. Calculate total monthly income for specified or current month.
 */
export async function getMonthlyIncome(year?: number, month?: number): Promise<MonthlyTotalsResult> {
  const { start, end, y, m } = parseMonthYear(year, month);
  const txs = await getTransactions({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    type: "income",
  });

  const totalIncome = txs.reduce((sum, t) => sum + t.amount, 0);
  return {
    year: y,
    month: m,
    totalAmount: Math.round(totalIncome * 100) / 100,
    transactionCount: txs.length,
  };
}

/**
 * 4. Calculate total monthly expenses for specified or current month.
 */
export async function getMonthlyExpenses(year?: number, month?: number): Promise<MonthlyTotalsResult> {
  const { start, end, y, m } = parseMonthYear(year, month);
  const txs = await getTransactions({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    type: "expense",
  });

  const totalExpenses = txs.reduce((sum, t) => sum + t.amount, 0);
  return {
    year: y,
    month: m,
    totalAmount: Math.round(totalExpenses * 100) / 100,
    transactionCount: txs.length,
  };
}

/**
 * 5. Calculate category spending breakdown for specified or current month.
 */
export async function getCategorySpending(
  categoryQuery?: string,
  year?: number,
  month?: number
): Promise<CategorySpending[]> {
  const { start, end } = parseMonthYear(year, month);
  const txs = await getTransactions({
    startDate: start.toISOString(),
    endDate: end.toISOString(),
    type: "expense",
  });

  if (!txs || txs.length === 0) return [];

  const totalExpense = txs.reduce((sum, t) => sum + t.amount, 0) || 1;
  const categoryMap = new Map<Category, { total: number; count: number }>();

  txs.forEach((t) => {
    const cat = (t.category || "Other") as Category;
    const current = categoryMap.get(cat) || { total: 0, count: 0 };
    categoryMap.set(cat, {
      total: current.total + t.amount,
      count: current.count + 1,
    });
  });

  let result: CategorySpending[] = Array.from(categoryMap.entries()).map(([category, data]) => ({
    category,
    totalSpent: Math.round(data.total * 100) / 100,
    transactionCount: data.count,
    percentageOfTotal: Math.round((data.total / totalExpense) * 100),
  }));

  if (categoryQuery) {
    const queryLower = categoryQuery.toLowerCase().trim();
    result = result.filter((c) => c.category.toLowerCase().includes(queryLower));
  }

  return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * 6. Calculate merchant spending totals.
 */
export async function getMerchantSpending(merchantQuery?: string): Promise<MerchantSpending[]> {
  const txs = await getTransactions({ merchant: merchantQuery });
  if (!txs || txs.length === 0) return [];

  const merchantMap = new Map<string, { spent: number; income: number; count: number }>();

  txs.forEach((t) => {
    const m = (t.merchant || "Unknown").trim();
    const current = merchantMap.get(m) || { spent: 0, income: 0, count: 0 };
    if (t.type === "expense") {
      current.spent += t.amount;
    } else {
      current.income += t.amount;
    }
    current.count += 1;
    merchantMap.set(m, current);
  });

  const result: MerchantSpending[] = Array.from(merchantMap.entries()).map(([merchant, data]) => ({
    merchant,
    totalSpent: Math.round(data.spent * 100) / 100,
    totalIncome: Math.round(data.income * 100) / 100,
    netAmount: Math.round((data.spent - data.income) * 100) / 100,
    transactionCount: data.count,
  }));

  return result.sort((a, b) => b.totalSpent - a.totalSpent);
}

/**
 * 7. Detect recurring transactions (charges occurring across multiple months).
 */
export async function getRecurringTransactions(): Promise<RecurringTransaction[]> {
  const txs = await getTransactions({ type: "expense" });
  if (!txs || txs.length === 0) return [];

  const merchantGroups = new Map<string, { amounts: number[]; dates: Date[]; category: Category }>();

  txs.forEach((t) => {
    const m = (t.merchant || "Unknown").trim();
    const current = merchantGroups.get(m) || { amounts: [], dates: [], category: t.category || "Other" };
    current.amounts.push(t.amount);
    const dt = new Date(t.date);
    if (!isNaN(dt.getTime())) {
      current.dates.push(dt);
    }
    merchantGroups.set(m, current);
  });

  const recurring: RecurringTransaction[] = [];

  merchantGroups.forEach((data, merchant) => {
    if (data.amounts.length >= 2) {
      const avgAmount = data.amounts.reduce((sum, a) => sum + a, 0) / data.amounts.length;
      recurring.push({
        merchant,
        amount: Math.round(avgAmount * 100) / 100,
        category: data.category,
        frequency: "Monthly",
        occurrences: data.amounts.length,
      });
    }
  });

  return recurring.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * 8. Retrieve upcoming financial commitments / reminders.
 */
export async function getUpcomingCommitments(): Promise<UpcomingCommitment[]> {
  try {
    const reminders = await api.listReminders();
    if (!reminders || reminders.length === 0) return [];

    const now = new Date();
    return reminders
      .map((r) => ({
        id: r.id,
        title: r.title,
        amount: Math.round((r.amount || 0) * 100) / 100,
        dueDate: r.dueDate,
        category: r.category,
        autoPay: Boolean(r.autoPay),
      }))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  } catch (err) {
    console.error("getUpcomingCommitments error:", err);
    return [];
  }
}

/**
 * 9. Calculate category budget adherence and status.
 */
export async function getBudgetStatus(year?: number, month?: number): Promise<BudgetStatusSummary> {
  try {
    const budgets = await api.listBudgets();
    const categorySpending = await getCategorySpending(undefined, year, month);

    if (!budgets || budgets.length === 0) {
      return {
        budgets: [],
        totalLimit: 0,
        totalSpent: 0,
        overallUsagePercentage: 0,
        overBudgetCount: 0,
      };
    }

    let overBudgetCount = 0;
    const categoryStatuses: CategoryBudgetStatus[] = budgets.map((b) => {
      const found = categorySpending.find((c) => c.category.toLowerCase() === b.category.toLowerCase());
      const spent = found ? found.totalSpent : 0;
      const limit = b.limit || 0;
      const remaining = Math.round((limit - spent) * 100) / 100;
      const usagePercentage = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const isOverBudget = spent > limit;

      if (isOverBudget) overBudgetCount++;

      return {
        category: b.category,
        limit,
        spent,
        remaining,
        usagePercentage,
        isOverBudget,
      };
    });

    const totalLimit = budgets.reduce((sum, b) => sum + (b.limit || 0), 0);
    const totalSpent = categoryStatuses.reduce((sum, b) => sum + b.spent, 0);
    const overallUsagePercentage = totalLimit > 0 ? Math.round((totalSpent / totalLimit) * 100) : 0;

    return {
      budgets: categoryStatuses,
      totalLimit: Math.round(totalLimit * 100) / 100,
      totalSpent: Math.round(totalSpent * 100) / 100,
      overallUsagePercentage,
      overBudgetCount,
    };
  } catch (err) {
    console.error("getBudgetStatus error:", err);
    return {
      budgets: [],
      totalLimit: 0,
      totalSpent: 0,
      overallUsagePercentage: 0,
      overBudgetCount: 0,
    };
  }
}

/**
 * 10. Calculate savings rate for specified or current month.
 */
export async function getSavingsRate(year?: number, month?: number): Promise<SavingsRateResult> {
  const [incResult, expResult] = await Promise.all([
    getMonthlyIncome(year, month),
    getMonthlyExpenses(year, month),
  ]);

  const monthlyIncome = incResult.totalAmount;
  const monthlyExpenses = expResult.totalAmount;
  const netSavings = Math.round((monthlyIncome - monthlyExpenses) * 100) / 100;
  const savingsRatePercentage = monthlyIncome > 0 ? Math.round((netSavings / monthlyIncome) * 100) : 0;

  return {
    monthlyIncome,
    monthlyExpenses,
    netSavings,
    savingsRatePercentage,
    isPositive: netSavings >= 0,
  };
}
