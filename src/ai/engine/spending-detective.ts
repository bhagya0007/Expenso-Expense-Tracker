import type { Transaction, Category } from "@/lib/types";

export interface CategoryVariance {
  category: Category;
  currentAmount: number;
  previousAmount: number;
  differenceAmount: number;
  percentageChange: number;
  direction: "increased" | "decreased" | "unchanged";
}

export interface MerchantVariance {
  merchant: string;
  currentAmount: number;
  previousAmount: number;
  differenceAmount: number;
}

export interface SpendingDetectiveResult {
  periodLabel: string;
  previousPeriodLabel: string;
  currentTotalSpent: number;
  previousTotalSpent: number;
  totalDifferenceAmount: number;
  percentageChange: number;
  direction: "increased" | "decreased" | "unchanged";
  categoryIncreases: CategoryVariance[];
  categoryDecreases: CategoryVariance[];
  topMerchantChanges: MerchantVariance[];
  summaryText: string;
}

export interface UnusualSpendingFlag {
  id: string;
  type: "large_transaction" | "frequent_merchant" | "category_spike" | "unexpected_recurring";
  title: string;
  description: string;
  amount?: number;
  merchant?: string;
  category?: Category;
  severity: "info" | "warning";
  reasonLabel: string; // e.g. "higher than your normal pattern", "worth reviewing", "unusual"
}

export interface UnusualSpendingReport {
  totalFlags: number;
  flags: UnusualSpendingFlag[];
}

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Spending Detective Engine.
 * Compares current period against previous comparable period to explain why spending changed.
 */
export function runSpendingDetective(
  currentTransactions: Transaction[],
  previousTransactions: Transaction[],
  periodLabel = "This Month",
  previousPeriodLabel = "Last Month"
): SpendingDetectiveResult {
  const currTxs = currentTransactions.filter((t) => t.type === "expense");
  const prevTxs = previousTransactions.filter((t) => t.type === "expense");

  const currentTotal = round2(currTxs.reduce((s, t) => s + (t.amount || 0), 0));
  const previousTotal = round2(prevTxs.reduce((s, t) => s + (t.amount || 0), 0));
  const diffTotal = round2(currentTotal - previousTotal);
  const pctChange = previousTotal > 0 ? round2((diffTotal / previousTotal) * 100) : currentTotal > 0 ? 100 : 0;
  const direction = diffTotal > 0 ? "increased" : diffTotal < 0 ? "decreased" : "unchanged";

  // Category breakdown comparison
  const currCatMap = new Map<Category, number>();
  currTxs.forEach((t) => {
    const cat = t.category || "Other";
    currCatMap.set(cat, (currCatMap.get(cat) || 0) + t.amount);
  });

  const prevCatMap = new Map<Category, number>();
  prevTxs.forEach((t) => {
    const cat = t.category || "Other";
    prevCatMap.set(cat, (prevCatMap.get(cat) || 0) + t.amount);
  });

  const allCategories = Array.from(new Set([...currCatMap.keys(), ...prevCatMap.keys()]));
  const categoryVariances: CategoryVariance[] = [];

  allCategories.forEach((cat) => {
    const currAmt = round2(currCatMap.get(cat) || 0);
    const prevAmt = round2(prevCatMap.get(cat) || 0);
    const diff = round2(currAmt - prevAmt);
    const pct = prevAmt > 0 ? round2((diff / prevAmt) * 100) : currAmt > 0 ? 100 : 0;

    categoryVariances.push({
      category: cat,
      currentAmount: currAmt,
      previousAmount: prevAmt,
      differenceAmount: diff,
      percentageChange: pct,
      direction: diff > 0 ? "increased" : diff < 0 ? "decreased" : "unchanged",
    });
  });

  const categoryIncreases = categoryVariances
    .filter((v) => v.differenceAmount > 0)
    .sort((a, b) => b.differenceAmount - a.differenceAmount);

  const categoryDecreases = categoryVariances
    .filter((v) => v.differenceAmount < 0)
    .sort((a, b) => a.differenceAmount - b.differenceAmount);

  // Merchant changes
  const currMerchMap = new Map<string, number>();
  currTxs.forEach((t) => {
    const m = (t.merchant || "Unknown").trim();
    currMerchMap.set(m, (currMerchMap.get(m) || 0) + t.amount);
  });

  const prevMerchMap = new Map<string, number>();
  prevTxs.forEach((t) => {
    const m = (t.merchant || "Unknown").trim();
    prevMerchMap.set(m, (prevMerchMap.get(m) || 0) + t.amount);
  });

  const allMerchants = Array.from(new Set([...currMerchMap.keys(), ...prevMerchMap.keys()]));
  const merchantVariances: MerchantVariance[] = [];

  allMerchants.forEach((m) => {
    const currAmt = round2(currMerchMap.get(m) || 0);
    const prevAmt = round2(prevMerchMap.get(m) || 0);
    const diff = round2(currAmt - prevAmt);

    if (Math.abs(diff) > 0) {
      merchantVariances.push({
        merchant: m,
        currentAmount: currAmt,
        previousAmount: prevAmt,
        differenceAmount: diff,
      });
    }
  });

  const topMerchantChanges = merchantVariances
    .sort((a, b) => Math.abs(b.differenceAmount) - Math.abs(a.differenceAmount))
    .slice(0, 5);

  const summaryText =
    direction === "increased"
      ? `Your spending in ${periodLabel} was ₹${Math.abs(diffTotal).toLocaleString("en-IN")} higher (+${pctChange}%) than in ${previousPeriodLabel}.`
      : direction === "decreased"
      ? `Your spending in ${periodLabel} was ₹${Math.abs(diffTotal).toLocaleString("en-IN")} lower (-${Math.abs(pctChange)}%) than in ${previousPeriodLabel}.`
      : `Your spending in ${periodLabel} remained virtually unchanged compared to ${previousPeriodLabel}.`;

  return {
    periodLabel,
    previousPeriodLabel,
    currentTotalSpent: currentTotal,
    previousTotalSpent: previousTotal,
    totalDifferenceAmount: diffTotal,
    percentageChange: pctChange,
    direction,
    categoryIncreases,
    categoryDecreases,
    topMerchantChanges,
    summaryText,
  };
}

/**
 * Detects Unusual Spending & Anomalies.
 * Uses historical behavior baseline. Strictly avoids false fraud claims.
 */
export function detectUnusualSpending(
  currentTransactions: Transaction[],
  historicalTransactions: Transaction[]
): UnusualSpendingReport {
  const flags: UnusualSpendingFlag[] = [];
  const currTxs = currentTransactions.filter((t) => t.type === "expense");
  const histTxs = historicalTransactions.filter((t) => t.type === "expense");

  if (currTxs.length === 0) {
    return { totalFlags: 0, flags: [] };
  }

  // 1. Calculate Historical Average & Standard Deviation for Transaction Size
  const histAmounts = histTxs.map((t) => t.amount);
  const avgHistAmount =
    histAmounts.length > 0 ? histAmounts.reduce((s, a) => s + a, 0) / histAmounts.length : 1000;

  // Detect Unusually Large Individual Transactions (> 3x average or >= ₹5,000)
  currTxs.forEach((t) => {
    if (t.amount >= 5000 && t.amount > avgHistAmount * 2.5) {
      flags.push({
        id: `unusual-tx-${t.id}`,
        type: "large_transaction",
        title: `Unusually Large Transaction: ${t.merchant}`,
        description: `₹${t.amount.toLocaleString("en-IN")} at ${t.merchant} on ${t.date} is higher than your normal transaction pattern (average ₹${round2(avgHistAmount).toLocaleString("en-IN")}).`,
        amount: t.amount,
        merchant: t.merchant,
        category: t.category,
        severity: "warning",
        reasonLabel: "higher than your normal pattern",
      });
    }
  });

  // 2. Detect Unusually Frequent Merchant Visits
  const histMerchantCount = new Map<string, number>();
  histTxs.forEach((t) => {
    const m = (t.merchant || "Unknown").trim();
    histMerchantCount.set(m, (histMerchantCount.get(m) || 0) + 1);
  });

  const currMerchantCount = new Map<string, number>();
  currTxs.forEach((t) => {
    const m = (t.merchant || "Unknown").trim();
    currMerchantCount.set(m, (currMerchantCount.get(m) || 0) + 1);
  });

  currMerchantCount.forEach((count, merchant) => {
    const histAvgCount = (histMerchantCount.get(merchant) || 0) / 3 || 1; // Assuming 3-month baseline
    if (count >= 4 && count > histAvgCount * 2.5) {
      flags.push({
        id: `unusual-freq-${merchant.replace(/[^a-zA-Z0-9]/g, "")}`,
        type: "frequent_merchant",
        title: `Unusual Visit Frequency: ${merchant}`,
        description: `You visited ${merchant} ${count} times recently, which is worth reviewing compared to your typical frequency.`,
        merchant,
        severity: "info",
        reasonLabel: "worth reviewing",
      });
    }
  });

  // 3. Detect Category Spending Significantly Above Normal (> 1.5x historical average)
  const currCatTotals = new Map<Category, number>();
  currTxs.forEach((t) => {
    const cat = t.category || "Other";
    currCatTotals.set(cat, (currCatTotals.get(cat) || 0) + t.amount);
  });

  const histCatTotals = new Map<Category, number>();
  histTxs.forEach((t) => {
    const cat = t.category || "Other";
    histCatTotals.set(cat, (histCatTotals.get(cat) || 0) + t.amount);
  });

  currCatTotals.forEach((currAmt, cat) => {
    const histAvgCatAmt = (histCatTotals.get(cat) || 0) / 3 || 0; // 3-month average
    if (histAvgCatAmt > 0 && currAmt > histAvgCatAmt * 1.6 && currAmt - histAvgCatAmt > 1000) {
      const spikeDiff = round2(currAmt - histAvgCatAmt);
      flags.push({
        id: `unusual-cat-${cat}`,
        type: "category_spike",
        title: `Category Spike: ${cat}`,
        description: `Spending in ${cat} (₹${currAmt.toLocaleString("en-IN")}) is ₹${spikeDiff.toLocaleString("en-IN")} higher than your normal pattern (avg ₹${round2(histAvgCatAmt).toLocaleString("en-IN")}).`,
        amount: currAmt,
        category: cat,
        severity: "warning",
        reasonLabel: "unusual category surge",
      });
    }
  });

  return {
    totalFlags: flags.length,
    flags,
  };
}
