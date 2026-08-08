import { runSpendingDetective, detectUnusualSpending } from "../spending-detective";
import type { Transaction } from "@/lib/types";

const mockCurrentTxs: Transaction[] = [
  { id: "c1", type: "expense", amount: 4500, category: "Food & Dining", merchant: "Swiggy", date: "2026-08-02", paymentMethod: "UPI", accountId: "acc-1" },
  { id: "c2", type: "expense", amount: 7000, category: "Shopping", merchant: "Amazon", date: "2026-08-05", paymentMethod: "Credit Card", accountId: "acc-1" },
  { id: "c3", type: "expense", amount: 12000, category: "Rent", merchant: "Landlord", date: "2026-08-01", paymentMethod: "Bank", accountId: "acc-1" },
];

const mockPreviousTxs: Transaction[] = [
  { id: "p1", type: "expense", amount: 3000, category: "Food & Dining", merchant: "Swiggy", date: "2026-07-02", paymentMethod: "UPI", accountId: "acc-1" },
  { id: "p2", type: "expense", amount: 2000, category: "Shopping", merchant: "Amazon", date: "2026-07-05", paymentMethod: "Credit Card", accountId: "acc-1" },
  { id: "p3", type: "expense", amount: 12000, category: "Rent", merchant: "Landlord", date: "2026-07-01", paymentMethod: "Bank", accountId: "acc-1" },
];

export function runSpendingDetectiveTests(): boolean {
  let passed = true;

  // 1. Spending Detective test
  const detectiveRes = runSpendingDetective(mockCurrentTxs, mockPreviousTxs, "August", "July");
  if (detectiveRes.currentTotalSpent !== 23500 || detectiveRes.previousTotalSpent !== 17000 || detectiveRes.totalDifferenceAmount !== 6500) {
    console.error("FAILED: Spending Detective total math", detectiveRes);
    passed = false;
  }

  if (detectiveRes.categoryIncreases.length !== 2 || detectiveRes.categoryIncreases[0].category !== "Shopping") {
    console.error("FAILED: Spending Detective category increases", detectiveRes);
    passed = false;
  }

  // 2. Anomaly / Unusual Spending Detection test
  const unusualRes = detectUnusualSpending(mockCurrentTxs, mockPreviousTxs);
  if (unusualRes.totalFlags < 1) {
    console.error("FAILED: Unusual Spending Detection flags", unusualRes);
    passed = false;
  }

  const hasFraudTerm = JSON.stringify(unusualRes).toLowerCase().includes("fraud");
  if (hasFraudTerm) {
    console.error("FAILED: Unusual Spending Detection used forbidden term 'fraud'!", unusualRes);
    passed = false;
  }

  return passed;
}
