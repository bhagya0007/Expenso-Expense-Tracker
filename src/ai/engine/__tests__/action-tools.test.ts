import { createActionProposal, executeActionProposal } from "../../tools/action-tools";

export async function runActionToolsTests(): Promise<boolean> {
  let passed = true;

  // 1. Create budget proposal
  const p1 = createActionProposal("CREATE_BUDGET", { category: "Food & Dining", limit: 5000 });
  if (p1.status !== "pending" || p1.payload.limit !== 5000 || p1.payload.category !== "Food & Dining") {
    console.error("FAILED: Budget Proposal Creation", p1);
    passed = false;
  }

  // 2. Unconfirmed execution security check
  try {
    await executeActionProposal(p1);
    console.error("FAILED: Unconfirmed action execution was allowed!");
    passed = false;
  } catch (err: any) {
    if (!err?.message?.includes("Security Violation")) {
      console.error("FAILED: Security exception message incorrect", err);
      passed = false;
    }
  }

  // 3. Create Savings Goal proposal
  const p2 = createActionProposal("CREATE_SAVINGS_GOAL", { amount: 20000 });
  if (p2.type !== "CREATE_SAVINGS_GOAL" || p2.payload.amount !== 20000) {
    console.error("FAILED: Savings Goal Proposal Creation", p2);
    passed = false;
  }

  // 4. Create Reminder proposal
  const p3 = createActionProposal("CREATE_REMINDER", { reminderTitle: "Review subscriptions" });
  if (p3.type !== "CREATE_REMINDER" || !p3.payload.reminderTitle) {
    console.error("FAILED: Reminder Proposal Creation", p3);
    passed = false;
  }

  // 5. Categorize Transactions proposal
  const p4 = createActionProposal("CATEGORIZE_TRANSACTIONS", { targetCategory: "Food & Dining", transactionIds: ["tx-1", "tx-2"] });
  if (p4.type !== "CATEGORIZE_TRANSACTIONS" || p4.payload.transactionIds?.length !== 2) {
    console.error("FAILED: Categorize Transactions Proposal Creation", p4);
    passed = false;
  }

  return passed;
}
