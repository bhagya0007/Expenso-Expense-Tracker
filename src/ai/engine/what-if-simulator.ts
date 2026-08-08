export type ScenarioType =
  | "ONE_TIME_PURCHASE"
  | "RECURRING_SAVINGS"
  | "EXPENSE_INCREASE"
  | "INCOME_DECREASE";

export interface WhatIfScenarioInput {
  prompt: string;
  currentBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  upcomingCommitments: number;
}

export interface WhatIfScenarioResult {
  scenarioType: ScenarioType;
  title: string;
  currentSituation: {
    label: string;
    value: number;
  };
  scenarioDetail: {
    label: string;
    value: number;
    description: string;
  };
  difference: {
    label: string;
    value: number;
    direction: "positive" | "negative" | "neutral";
  };
  projectedResult: {
    label: string;
    value: number;
    explanation: string;
  };
  isSimulationOnly: true;
}

function round2(num: number): number {
  const n = Number(num);
  if (isNaN(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Deterministic What-If Scenario Simulator Engine.
 * Runs deterministic math for financial simulations. Never mutates ledger data.
 */
export function simulateScenario(input: WhatIfScenarioInput): WhatIfScenarioResult {
  const p = input.prompt.toLowerCase().trim();
  const balance = input.currentBalance;
  const income = input.monthlyIncome;
  const expenses = input.monthlyExpenses;
  const commitments = input.upcomingCommitments;

  // Extract numeric values and percentages from prompt (stripping commas like 5,000 -> 5000)
  const cleanedPrompt = p.replace(/(\d+),(\d+)/g, "$1$2");
  const numMatch = cleanedPrompt.match(/\b\d+(\.\d+)?\b/);
  const parsedNum = numMatch ? parseFloat(numMatch[0]) : 0;
  const isPercent = p.includes("%") || p.includes("percent");

  // 1. EXPENSE INCREASE SCENARIO (e.g. "What if my expenses increase by 10%?")
  if (p.includes("expense") && (p.includes("increase") || p.includes("rise") || p.includes("higher"))) {
    const pct = isPercent && parsedNum > 0 ? parsedNum : 10;
    const expenseDelta = round2(expenses * (pct / 100));
    const newExpenses = round2(expenses + expenseDelta);
    const currentNet = round2(income - expenses);
    const newNet = round2(income - newExpenses);

    return {
      scenarioType: "EXPENSE_INCREASE",
      title: `What-If: ${pct}% Expense Increase`,
      currentSituation: {
        label: "Current Monthly Expenses",
        value: expenses,
      },
      scenarioDetail: {
        label: `Expense Increase (+${pct}%)`,
        value: expenseDelta,
        description: `Monthly expenses increase from ₹${expenses.toLocaleString("en-IN")} to ₹${newExpenses.toLocaleString("en-IN")}.`,
      },
      difference: {
        label: "Monthly Net Cashflow Impact",
        value: -expenseDelta,
        direction: "negative",
      },
      projectedResult: {
        label: "Projected Monthly Net Savings",
        value: newNet,
        explanation: `With a ${pct}% expense increase, your monthly net savings would decrease from ₹${currentNet.toLocaleString("en-IN")} to ₹${newNet.toLocaleString("en-IN")}.`,
      },
      isSimulationOnly: true,
    };
  }

  // 2. INCOME DECREASE SCENARIO (e.g. "What if my income decreases by 10%?")
  if (p.includes("income") || p.includes("salary") || p.includes("pay")) {
    const pct = isPercent && parsedNum > 0 ? parsedNum : 10;
    const incomeDelta = round2(income * (pct / 100));
    const newIncome = round2(income - incomeDelta);
    const currentNet = round2(income - expenses);
    const newNet = round2(newIncome - expenses);

    return {
      scenarioType: "INCOME_DECREASE",
      title: `What-If: ${pct}% Income Reduction`,
      currentSituation: {
        label: "Current Monthly Income",
        value: income,
      },
      scenarioDetail: {
        label: `Income Reduction (-${pct}%)`,
        value: -incomeDelta,
        description: `Monthly income drops from ₹${income.toLocaleString("en-IN")} to ₹${newIncome.toLocaleString("en-IN")}.`,
      },
      difference: {
        label: "Monthly Income Difference",
        value: -incomeDelta,
        direction: "negative",
      },
      projectedResult: {
        label: "Projected Monthly Net Savings",
        value: newNet,
        explanation: `With a ${pct}% income reduction, your monthly net cashflow would drop from ₹${currentNet.toLocaleString("en-IN")} to ₹${newNet.toLocaleString("en-IN")}.`,
      },
      isSimulationOnly: true,
    };
  }

  // 3. RECURRING SAVINGS SCENARIO (e.g. "What if I save ₹2,000 every month?")
  if (p.includes("save") && (p.includes("every month") || p.includes("monthly") || p.includes("each month"))) {
    const monthlySaveAmount = parsedNum > 0 ? parsedNum : 2000;
    const annualExtraSavings = round2(monthlySaveAmount * 12);
    const currentAnnualSavings = round2((income - expenses) * 12);
    const projectedAnnualSavings = round2(currentAnnualSavings + annualExtraSavings);

    return {
      scenarioType: "RECURRING_SAVINGS",
      title: `What-If: Save ₹${monthlySaveAmount.toLocaleString("en-IN")}/month`,
      currentSituation: {
        label: "Current Projected Annual Savings",
        value: currentAnnualSavings,
      },
      scenarioDetail: {
        label: "Monthly Recurring Savings Goal",
        value: monthlySaveAmount,
        description: `Saving an additional ₹${monthlySaveAmount.toLocaleString("en-IN")} every month for 12 months.`,
      },
      difference: {
        label: "Annual Added Savings",
        value: annualExtraSavings,
        direction: "positive",
      },
      projectedResult: {
        label: "Projected 1-Year Total Savings",
        value: projectedAnnualSavings,
        explanation: `Saving ₹${monthlySaveAmount.toLocaleString("en-IN")} monthly adds ₹${annualExtraSavings.toLocaleString("en-IN")} to your yearly total, bringing projected 1-year savings to ₹${projectedAnnualSavings.toLocaleString("en-IN")}.`,
      },
      isSimulationOnly: true,
    };
  }

  // 4. ONE-TIME PURCHASE SCENARIO (Default: e.g. "What if I spend ₹5,000?")
  const purchaseAmount = parsedNum > 0 ? parsedNum : 5000;
  const safeDiscretionary = round2(balance - commitments - Math.max(expenses * 0.2, 0));
  const remainingAfterPurchase = round2(safeDiscretionary - purchaseAmount);

  return {
    scenarioType: "ONE_TIME_PURCHASE",
    title: `What-If: One-Time Purchase of ₹${purchaseAmount.toLocaleString("en-IN")}`,
    currentSituation: {
      label: "Current Safe Discretionary Allowance",
      value: safeDiscretionary,
    },
    scenarioDetail: {
      label: "One-Time Purchase Amount",
      value: purchaseAmount,
      description: `Single expense deduction of ₹${purchaseAmount.toLocaleString("en-IN")}.`,
    },
    difference: {
      label: "Balance Impact",
      value: -purchaseAmount,
      direction: "negative",
    },
    projectedResult: {
      label: "Remaining Safe Funds",
      value: remainingAfterPurchase,
      explanation:
        remainingAfterPurchase >= 0
          ? `After this purchase of ₹${purchaseAmount.toLocaleString("en-IN")}, you will have ₹${remainingAfterPurchase.toLocaleString("en-IN")} remaining in safe discretionary funds.`
          : `This purchase exceeds your safe discretionary allowance by ₹${Math.abs(remainingAfterPurchase).toLocaleString("en-IN")}.`,
    },
    isSimulationOnly: true,
  };
}
