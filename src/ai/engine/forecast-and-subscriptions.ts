import type { Transaction } from "@/lib/types";

export interface MonthEndForecastResult {
  currentBalance: { value: number; type: "actual"; label: string };
  daysElapsed: number;
  daysRemainingInMonth: number;
  dailyBurnRate: { value: number; type: "actual"; label: string };
  projectedRemainingExpenses: { value: number; type: "estimate"; label: string };
  upcomingCommitments: { value: number; type: "actual"; label: string };
  expectedRemainingIncome: { value: number; type: "estimate"; label: string };
  forecastedMonthEndBalance: { value: number; type: "forecast"; label: string };
  forecastRange: { min: number; max: number; label: string };
  explanation: string;
}

export interface DetectedSubscription {
  id: string;
  merchant: string;
  category: string;
  typicalAmount: number;
  frequency: "Monthly" | "Weekly" | "Annual";
  estimatedMonthlyCost: number;
  estimatedAnnualCost: number;
  confidence: "Confirmed subscription" | "Possible subscription";
  lastPaymentDate: string;
}

export interface SubscriptionDetectionReport {
  totalConfirmedCount: number;
  totalPossibleCount: number;
  totalMonthlyCost: number;
  totalAnnualCost: number;
  subscriptions: DetectedSubscription[];
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

const KNOWN_SUBSCRIPTION_KEYWORDS = [
  "netflix",
  "spotify",
  "prime",
  "amazon prime",
  "chatgpt",
  "openai",
  "youtube",
  "icloud",
  "google one",
  "swiggy one",
  "zomato gold",
  "gym",
  "fitness",
  "airtel",
  "jio",
  "broadband",
  "wifi",
  "hotstar",
  "disney",
  "apple",
];

/**
 * Calculates deterministic Month-End Balance Forecast with range and explicit metadata.
 */
export function calculateMonthEndForecast(
  transactions: Transaction[],
  currentBalance: number,
  upcomingCommitments: number,
  referenceDate: Date = new Date()
): MonthEndForecastResult {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const currentDay = referenceDate.getDate();

  // Total days in current month
  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
  const daysElapsed = Math.max(currentDay, 1);
  const daysRemainingInMonth = Math.max(totalDaysInMonth - daysElapsed, 0);

  // Filter current month expenses
  const startOfMonthISO = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const monthExpenses = transactions.filter(
    (t) => t.type === "expense" && t.date >= startOfMonthISO
  );

  const totalSpentSoFar = monthExpenses.reduce((sum, t) => sum + (t.amount || 0), 0);
  const dailyBurnRate = round2(totalSpentSoFar / daysElapsed);
  const projectedRemainingExpenses = round2(dailyBurnRate * daysRemainingInMonth);

  // Expected remaining income (if salary not credited yet this month)
  const hasIncomeThisMonth = transactions.some(
    (t) => t.type === "income" && t.date >= startOfMonthISO && (t.category === "Salary" || t.amount >= 20000)
  );
  const expectedRemainingIncome = hasIncomeThisMonth ? 0 : 45000; // estimated remaining salary credit

  const forecastedMonthEndBalance = round2(
    currentBalance - upcomingCommitments - projectedRemainingExpenses + expectedRemainingIncome
  );

  // Uncertainty range (+/- 8% of forecast)
  const rangeMargin = Math.max(round2(Math.abs(forecastedMonthEndBalance) * 0.08), 1500);
  const minForecast = round2(forecastedMonthEndBalance - rangeMargin);
  const maxForecast = round2(forecastedMonthEndBalance + rangeMargin);

  const explanation =
    `Based on your current burn rate of ₹${dailyBurnRate.toLocaleString("en-IN")}/day over the past ${daysElapsed} days, ` +
    `your estimated end-of-month balance will fall in the range of ₹${minForecast.toLocaleString("en-IN")} – ₹${maxForecast.toLocaleString("en-IN")}. ` +
    `Note: This is a projected forecast based on historical burn rate and is not an exact guarantee.`;

  return {
    currentBalance: { value: round2(currentBalance), type: "actual", label: "Current Account Balance" },
    daysElapsed,
    daysRemainingInMonth,
    dailyBurnRate: { value: dailyBurnRate, type: "actual", label: "Average Daily Burn Rate" },
    projectedRemainingExpenses: {
      value: projectedRemainingExpenses,
      type: "estimate",
      label: "Projected Remaining Essential Expenses",
    },
    upcomingCommitments: { value: round2(upcomingCommitments), type: "actual", label: "Upcoming Commitments" },
    expectedRemainingIncome: { value: expectedRemainingIncome, type: "estimate", label: "Expected Income Credit" },
    forecastedMonthEndBalance: {
      value: forecastedMonthEndBalance,
      type: "forecast",
      label: "Estimated Month-End Balance",
    },
    forecastRange: {
      min: minForecast,
      max: maxForecast,
      label: `₹${minForecast.toLocaleString("en-IN")} – ₹${maxForecast.toLocaleString("en-IN")}`,
    },
    explanation,
  };
}

/**
 * Analyzes recurring transactions to detect confirmed vs possible subscriptions.
 * Does NOT modify or cancel any ledger entries.
 */
export function detectSubscriptions(transactions: Transaction[]): SubscriptionDetectionReport {
  const expenseTxs = transactions.filter((t) => t.type === "expense");
  const merchantMap = new Map<string, Transaction[]>();

  expenseTxs.forEach((t) => {
    const rawMerch = (t.merchant || "Unknown").trim();
    const key = rawMerch.toLowerCase();
    if (!merchantMap.has(key)) {
      merchantMap.set(key, []);
    }
    merchantMap.get(key)!.push(t);
  });

  const detected: DetectedSubscription[] = [];

  merchantMap.forEach((txList, merchantKey) => {
    if (txList.length === 0) return;

    const displayMerchant = txList[0].merchant || merchantKey;
    const category = txList[0].category || "Bills & Utilities";
    const amounts = txList.map((t) => t.amount);
    const avgAmount = round2(amounts.reduce((s, a) => s + a, 0) / amounts.length);

    // Check if merchant matches known subscription brand
    const matchesKnownBrand = KNOWN_SUBSCRIPTION_KEYWORDS.some((kw) => merchantKey.includes(kw));

    // Check date interval consistency (days between consecutive transactions ~ 25-35 days)
    const sortedTxs = [...txList].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let resemblesMonthlyCadence = false;

    if (sortedTxs.length >= 2) {
      const d1 = new Date(sortedTxs[sortedTxs.length - 2].date).getTime();
      const d2 = new Date(sortedTxs[sortedTxs.length - 1].date).getTime();
      const diffDays = Math.abs(d2 - d1) / (1000 * 3600 * 24);
      if (diffDays >= 25 && diffDays <= 35) {
        resemblesMonthlyCadence = true;
      }
    }

    const isExactSameAmount = sortedTxs.length >= 2 && sortedTxs.every((t) => Math.abs(t.amount - avgAmount) <= 5);

    if (matchesKnownBrand || (resemblesMonthlyCadence && isExactSameAmount)) {
      const confidence: "Confirmed subscription" | "Possible subscription" =
        matchesKnownBrand || (sortedTxs.length >= 3 && isExactSameAmount)
          ? "Confirmed subscription"
          : "Possible subscription";

      detected.push({
        id: `sub-${merchantKey.replace(/[^a-z0-9]/g, "")}`,
        merchant: displayMerchant,
        category,
        typicalAmount: avgAmount,
        frequency: "Monthly",
        estimatedMonthlyCost: avgAmount,
        estimatedAnnualCost: round2(avgAmount * 12),
        confidence,
        lastPaymentDate: sortedTxs[sortedTxs.length - 1].date,
      });
    }
  });

  const confirmedCount = detected.filter((d) => d.confidence === "Confirmed subscription").length;
  const possibleCount = detected.filter((d) => d.confidence === "Possible subscription").length;
  const totalMonthly = round2(detected.reduce((s, d) => s + d.estimatedMonthlyCost, 0));
  const totalAnnual = round2(detected.reduce((s, d) => s + d.estimatedAnnualCost, 0));

  return {
    totalConfirmedCount: confirmedCount,
    totalPossibleCount: possibleCount,
    totalMonthlyCost: totalMonthly,
    totalAnnualCost: totalAnnual,
    subscriptions: detected,
  };
}
