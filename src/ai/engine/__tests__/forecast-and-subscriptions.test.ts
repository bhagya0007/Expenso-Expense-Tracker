import { calculateMonthEndForecast, detectSubscriptions } from "../forecast-and-subscriptions";
import type { Transaction } from "@/lib/types";

const mockTxs: Transaction[] = [
  { id: "s1", type: "expense", amount: 499, category: "Entertainment", merchant: "Netflix", date: "2026-06-05", paymentMethod: "Credit Card", accountId: "acc-1" },
  { id: "s2", type: "expense", amount: 499, category: "Entertainment", merchant: "Netflix", date: "2026-07-05", paymentMethod: "Credit Card", accountId: "acc-1" },
  { id: "s3", type: "expense", amount: 499, category: "Entertainment", merchant: "Netflix", date: "2026-08-05", paymentMethod: "Credit Card", accountId: "acc-1" },
  { id: "s4", type: "expense", amount: 119, category: "Entertainment", merchant: "Spotify", date: "2026-08-01", paymentMethod: "UPI", accountId: "acc-1" },
  { id: "e1", type: "expense", amount: 2500, category: "Food & Dining", merchant: "Swiggy", date: "2026-08-02", paymentMethod: "UPI", accountId: "acc-1" },
];

export function runForecastAndSubscriptionTests(): boolean {
  let passed = true;

  // 1. Month-End Forecast Test
  const refDate = new Date(2026, 7, 15); // Aug 15, 2026
  const forecastRes = calculateMonthEndForecast(mockTxs, 50000, 5000, refDate);

  if (!forecastRes.forecastRange.label || forecastRes.currentBalance.type !== "actual" || forecastRes.projectedRemainingExpenses.type !== "estimate") {
    console.error("FAILED: Month-End Forecast metadata labels", forecastRes);
    passed = false;
  }

  // 2. Subscription Detection Test
  const subRes = detectSubscriptions(mockTxs);
  if (subRes.totalConfirmedCount < 1 || subRes.subscriptions.length < 1) {
    console.error("FAILED: Subscription Detection count", subRes);
    passed = false;
  }

  const netflixSub = subRes.subscriptions.find((s) => s.merchant.toLowerCase().includes("netflix"));
  if (!netflixSub || netflixSub.confidence !== "Confirmed subscription" || netflixSub.estimatedAnnualCost !== 499 * 12) {
    console.error("FAILED: Netflix confirmed subscription detection", netflixSub);
    passed = false;
  }

  return passed;
}
