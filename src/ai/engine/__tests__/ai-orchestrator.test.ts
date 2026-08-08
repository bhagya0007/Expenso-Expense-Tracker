import { processUserQuery } from "../ai-orchestrator";

export async function runOrchestratorTests(): Promise<boolean> {
  let passed = true;

  try {
    // 1. SPENDING_QUERY
    const m1 = await processUserQuery("How much did I spend this month?");
    if (m1.intent !== "SPENDING_QUERY" || !m1.text || m1.text.includes("undefined")) {
      console.error("FAILED: Orchestrator SPENDING_QUERY", m1);
      passed = false;
    }

    // 2. CATEGORY_QUERY
    const m2 = await processUserQuery("How much did I spend on Food?");
    if (m2.intent !== "CATEGORY_QUERY" || !m2.text) {
      console.error("FAILED: Orchestrator CATEGORY_QUERY", m2);
      passed = false;
    }

    // 3. COMPARISON_QUERY
    const m3 = await processUserQuery("Compare June and July.");
    if (m3.intent !== "COMPARISON_QUERY" || !m3.text) {
      console.error("FAILED: Orchestrator COMPARISON_QUERY", m3);
      passed = false;
    }

    // 4. BUDGET_QUERY
    const m4 = await processUserQuery("Show my budget status");
    if (m4.intent !== "BUDGET_QUERY" || !m4.text) {
      console.error("FAILED: Orchestrator BUDGET_QUERY", m4);
      passed = false;
    }

    // 5. SAFE_TO_SPEND_QUERY
    const m5 = await processUserQuery("Can I afford a ₹5,000 purchase?");
    if (m5.intent !== "SAFE_TO_SPEND_QUERY" || !m5.text) {
      console.error("FAILED: Orchestrator SAFE_TO_SPEND_QUERY", m5);
      passed = false;
    }

    // 6. ACTION_REQUEST
    const m6 = await processUserQuery("Set a 5000 Food budget");
    if (m6.intent !== "ACTION_REQUEST" || !m6.actionProposal) {
      console.error("FAILED: Orchestrator ACTION_REQUEST", m6);
      passed = false;
    }
  } catch (err) {
    console.error("Orchestrator test execution error:", err);
    passed = false;
  }

  return passed;
}
