import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetSavings,
  calculateSavingsRate,
  calculateCategoryPercentages,
  calculateMonthToMonthComparison,
  calculateSpendingChange,
  calculateBudgetRemaining,
  calculateSafeToSpendEstimate,
  calculateWhatIfScenario,
} from "../financial-calculator";
import type { Transaction } from "@/lib/types";

const mockTransactions: Transaction[] = [
  {
    id: "tx-1",
    type: "income",
    amount: 50000,
    category: "Salary",
    merchant: "Employer",
    date: "2026-08-01",
    paymentMethod: "Bank",
    accountId: "acc-1",
  },
  {
    id: "tx-2",
    type: "expense",
    amount: 12000,
    category: "Rent",
    merchant: "Landlord",
    date: "2026-08-02",
    paymentMethod: "Bank",
    accountId: "acc-1",
  },
  {
    id: "tx-3",
    type: "expense",
    amount: 8000,
    category: "Food & Dining",
    merchant: "Swiggy / Zomato",
    date: "2026-08-05",
    paymentMethod: "UPI",
    accountId: "acc-1",
  },
  {
    id: "tx-4",
    type: "expense",
    amount: 5000,
    category: "Shopping",
    merchant: "Amazon",
    date: "2026-08-10",
    paymentMethod: "Credit Card",
    accountId: "acc-1",
  },
];

export function runCalculationEngineTests(): boolean {
  let passed = true;

  // 1. Total Income
  const incRes = calculateTotalIncome(mockTransactions);
  if (incRes.totalIncome.value !== 50000 || incRes.totalIncome.type !== "actual") {
    console.error("FAILED: calculateTotalIncome", incRes);
    passed = false;
  }

  // 2. Total Expenses
  const expRes = calculateTotalExpenses(mockTransactions);
  if (expRes.totalExpenses.value !== 25000 || expRes.totalExpenses.type !== "actual") {
    console.error("FAILED: calculateTotalExpenses", expRes);
    passed = false;
  }

  // 3. Net Savings
  const netRes = calculateNetSavings(incRes.totalIncome.value, expRes.totalExpenses.value);
  if (netRes.netSavings.value !== 25000 || netRes.netSavings.type !== "calculated") {
    console.error("FAILED: calculateNetSavings", netRes);
    passed = false;
  }

  // 4. Savings Rate
  const rateRes = calculateSavingsRate(incRes.totalIncome.value, netRes.netSavings.value);
  if (rateRes.savingsRatePercentage.value !== 50 || rateRes.savingsTier !== "Excellent") {
    console.error("FAILED: calculateSavingsRate", rateRes);
    passed = false;
  }

  // 5. Category Percentages
  const catRes = calculateCategoryPercentages(mockTransactions);
  if (catRes.length !== 3 || catRes[0].category !== "Rent" || catRes[0].percentage.value !== 48) {
    console.error("FAILED: calculateCategoryPercentages", catRes);
    passed = false;
  }

  // 6. Month to Month Comparison
  const prevTxs: Transaction[] = [
    { id: "tx-p1", type: "income", amount: 45000, category: "Salary", merchant: "Employer", date: "2026-07-01", paymentMethod: "Bank", accountId: "acc-1" },
    { id: "tx-p2", type: "expense", amount: 20000, category: "Rent", merchant: "Landlord", date: "2026-07-02", paymentMethod: "Bank", accountId: "acc-1" },
  ];
  const m2mRes = calculateMonthToMonthComparison(mockTransactions, prevTxs);
  if (m2mRes.expenseChangeAmount.value !== 5000 || m2mRes.trendDirection !== "increased") {
    console.error("FAILED: calculateMonthToMonthComparison", m2mRes);
    passed = false;
  }

  // 7. Spending Change
  const changeRes = calculateSpendingChange(25000, 20000);
  if (changeRes.differenceAmount.value !== 5000 || changeRes.percentageChange.value !== 25) {
    console.error("FAILED: calculateSpendingChange", changeRes);
    passed = false;
  }

  // 8. Budget Remaining
  const bgtRes = calculateBudgetRemaining(10000, 8000, "Food & Dining");
  if (bgtRes.remaining.value !== 2000 || bgtRes.isOverBudget !== false) {
    console.error("FAILED: calculateBudgetRemaining", bgtRes);
    passed = false;
  }

  // 9. Safe to Spend Estimate
  const safeRes = calculateSafeToSpendEstimate(100000, 15000, 20000, 25000);
  if (safeRes.estimatedSafeToSpend.value !== 40000 || safeRes.estimatedSafeToSpend.type !== "estimate") {
    console.error("FAILED: calculateSafeToSpendEstimate", safeRes);
    passed = false;
  }

  // 10. What If Scenario
  const whatIfAfford = calculateWhatIfScenario(100000, 15000, 20000, 5000);
  if (whatIfAfford.isAffordable !== true || whatIfAfford.remainingBalanceAfterPurchase.value !== 60000) {
    console.error("FAILED: calculateWhatIfScenario (affordable)", whatIfAfford);
    passed = false;
  }

  const whatIfUnafford = calculateWhatIfScenario(100000, 15000, 20000, 70000);
  if (whatIfUnafford.isAffordable !== false || whatIfUnafford.remainingBalanceAfterPurchase.value !== -5000) {
    console.error("FAILED: calculateWhatIfScenario (unaffordable)", whatIfUnafford);
    passed = false;
  }

  return passed;
}
