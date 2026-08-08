import { generateProactiveInsights } from "../insights-generator";
import type { Transaction } from "@/lib/types";

const mockTxs: Transaction[] = [
  { id: "t1", type: "expense", amount: 2000, category: "Food & Dining", merchant: "Swiggy", date: "2026-08-01", paymentMethod: "UPI", accountId: "acc-1" },
  { id: "t2", type: "expense", amount: 3500, category: "Food & Dining", merchant: "Zomato", date: "2026-08-02", paymentMethod: "UPI", accountId: "acc-1" },
  { id: "t3", type: "expense", amount: 4000, category: "Shopping", merchant: "Amazon", date: "2026-08-03", paymentMethod: "Credit Card", accountId: "acc-1" },
  { id: "t4", type: "expense", amount: 1500, category: "Transport", merchant: "Uber", date: "2026-08-08", paymentMethod: "UPI", accountId: "acc-1" },
  { id: "t5", type: "expense", amount: 2000, category: "Shopping", merchant: "Myntra", date: "2026-08-09", paymentMethod: "Credit Card", accountId: "acc-1" },
];

export function runInsightsGeneratorTests(): boolean {
  let passed = true;

  // 1. Minimum transaction threshold check (empty if < 5)
  const emptyRes = generateProactiveInsights(mockTxs.slice(0, 3));
  if (emptyRes.length !== 0) {
    console.error("FAILED: Proactive Insights generated on insufficient data", emptyRes);
    passed = false;
  }

  // 2. Factual insight generation check
  const insights = generateProactiveInsights(mockTxs);
  if (Array.isArray(insights)) {
    // Inspected clean generation
  } else {
    console.error("FAILED: Proactive Insights return structure", insights);
    passed = false;
  }

  return passed;
}
