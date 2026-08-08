import { simulateScenario } from "../what-if-simulator";

export function runWhatIfSimulatorTests(): boolean {
  let passed = true;

  const baseInput = {
    currentBalance: 50000,
    monthlyIncome: 60000,
    monthlyExpenses: 30000,
    upcomingCommitments: 10000,
  };

  // 1. One-time purchase scenario ("What if I spend ₹5,000?")
  const s1 = simulateScenario({ ...baseInput, prompt: "What if I spend ₹5,000?" });
  if (s1.scenarioType !== "ONE_TIME_PURCHASE" || s1.scenarioDetail.value !== 5000 || !s1.isSimulationOnly) {
    console.error("FAILED: What-If One-Time Purchase", s1);
    passed = false;
  }

  // 2. Recurring savings scenario ("What if I save ₹2,000 every month?")
  const s2 = simulateScenario({ ...baseInput, prompt: "What if I save ₹2,000 every month?" });
  if (s2.scenarioType !== "RECURRING_SAVINGS" || s2.difference.value !== 24000) {
    console.error("FAILED: What-If Recurring Savings", s2);
    passed = false;
  }

  // 3. Expense increase scenario ("What if my expenses increase by 10%?")
  const s3 = simulateScenario({ ...baseInput, prompt: "What if my expenses increase by 10%?" });
  if (s3.scenarioType !== "EXPENSE_INCREASE" || s3.scenarioDetail.value !== 3000 || s3.projectedResult.value !== 27000) {
    console.error("FAILED: What-If Expense Increase", s3);
    passed = false;
  }

  // 4. Income decrease scenario ("What if my income decreases by 10%?")
  const s4 = simulateScenario({ ...baseInput, prompt: "What if my income decreases by 10%?" });
  if (s4.scenarioType !== "INCOME_DECREASE" || s4.difference.value !== -6000 || s4.projectedResult.value !== 24000) {
    console.error("FAILED: What-If Income Decrease", s4);
    passed = false;
  }

  return passed;
}
