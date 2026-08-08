import { getUserFinancialContext, formatFinancialContextSummary } from "../../context/financial-context";

export async function runFinancialContextTests(): Promise<boolean> {
  let passed = true;

  try {
    const ctx = await getUserFinancialContext();
    if (!ctx || typeof ctx.monthlyBudgetLimit !== "number" || typeof ctx.savingsGoalAmount !== "number") {
      console.error("FAILED: getUserFinancialContext structure", ctx);
      passed = false;
    }

    const summary = formatFinancialContextSummary(ctx);
    if (!summary || !summary.includes("Monthly Budget Cap")) {
      console.error("FAILED: formatFinancialContextSummary", summary);
      passed = false;
    }
  } catch (err) {
    console.error("Financial Context test error:", err);
    passed = false;
  }

  return passed;
}
