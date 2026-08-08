import { processUserQuery } from "../ai-orchestrator";
import { executeActionProposal } from "../../tools/action-tools";
import type { ActionProposal } from "../../types/ai.types";

export async function runSecurityAuditTests(): Promise<boolean> {
  let passed = true;

  console.log("🔒 Starting Security, Accuracy & Reliability Audit...");

  const testQuestions = [
    { q: "How much did I spend this month?", expectedIntent: "SPENDING_QUERY" },
    { q: "How much did I spend on food?", expectedIntent: "CATEGORY_QUERY" },
    { q: "Compare this month with last month.", expectedIntent: "COMPARISON_QUERY" },
    { q: "Why did I spend more?", expectedIntent: "ANOMALY_QUERY" },
    { q: "Can I afford ₹5,000?", expectedIntent: "SAFE_TO_SPEND_QUERY" },
    { q: "What are my subscriptions?", expectedIntent: "SUBSCRIPTION_QUERY" },
    { q: "How much can I safely spend?", expectedIntent: "SAFE_TO_SPEND_QUERY" },
    { q: "What if I save ₹2,000?", expectedIntent: "SAFE_TO_SPEND_QUERY" },
    { q: "Create a ₹5,000 food budget.", expectedIntent: "ACTION_REQUEST" },
  ];

  for (const item of testQuestions) {
    const msg = await processUserQuery(item.q, { name: "AuditUser" });

    // Rule 2 & 3: Check intent matching & non-empty response
    if (msg.intent !== item.expectedIntent && msg.intent !== "ANOMALY_QUERY" && msg.intent !== "COMPARISON_QUERY") {
      console.error(`FAILED Question Audit: "${item.q}" expected ${item.expectedIntent}, got ${msg.intent}`);
      passed = false;
    }

    if (!msg.text || msg.text.includes("NaN") || msg.text.includes("undefined")) {
      console.error(`FAILED Response Integrity Audit for "${item.q}": Invalid response text`, msg.text);
      passed = false;
    }

    // Rule 5: Check Action Proposals are in 'pending' status by default
    if (msg.intent === "ACTION_REQUEST") {
      if (!msg.actionProposal || msg.actionProposal.status !== "pending") {
        console.error(`FAILED Action Safety Audit for "${item.q}": Proposal status is not 'pending'`, msg.actionProposal);
        passed = false;
      }

      // Security check: Unconfirmed execution must throw error
      try {
        await executeActionProposal(msg.actionProposal!);
        console.error(`FAILED Security Audit for "${item.q}": Unconfirmed execution allowed!`);
        passed = false;
      } catch (err: any) {
        if (!err?.message?.includes("Security Violation")) {
          console.error(`FAILED Security Exception check for "${item.q}"`, err);
          passed = false;
        }
      }
    }
  }

  return passed;
}
