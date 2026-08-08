import type { ChatMessage, ActionProposal, ActionType, StructuredContextPayload } from "../types/ai.types";
import { detectIntent } from "./intent-detector";
import { interpretDateExpression } from "./date-interpreter";
import { runSpendingDetective, detectUnusualSpending } from "./spending-detective";
import { simulateScenario } from "./what-if-simulator";
import { calculateMonthEndForecast, detectSubscriptions } from "./forecast-and-subscriptions";
import { getUserFinancialContext } from "../context/financial-context";
import {
  getTransactions,
  getCurrentBalance,
  getMonthlyIncome,
  getMonthlyExpenses,
  getCategorySpending,
  getMerchantSpending,
  getRecurringTransactions,
  getUpcomingCommitments,
  getBudgetStatus,
  getSavingsRate,
} from "../tools/financial-data-tools";
import {
  calculateTotalIncome,
  calculateTotalExpenses,
  calculateNetSavings,
  calculateSavingsRate,
  calculateCategoryPercentages,
  calculateMonthToMonthComparison,
  calculateSpendingChange,
  calculateBudgetRemaining,
  calculateSafeToSpendEstimate,
  calculateWhatIfScenario,
} from "./financial-calculator";
import { createActionProposal } from "../tools/action-tools";
import { generateAIExplanation } from "../services/llm-provider";
import type { Category } from "@/lib/types";

/**
 * Expenso AI Orchestration Layer.
 * Pipeline: User Question -> Date & Intent Detection -> Data Retrieval -> Deterministic Calculations -> LLM Explanation
 */
export async function processUserQuery(
  userQuery: string,
  userContext?: { name?: string; currency?: string }
): Promise<ChatMessage> {
  const dateResult = interpretDateExpression(userQuery);
  const parsedIntent = detectIntent(userQuery);

  const finContext = await getUserFinancialContext();

  let structuredPayload: StructuredContextPayload = {
    intent: parsedIntent.intent,
    dateRangeLabel: dateResult.label,
    hasData: true,
    data: {
      financialContext: finContext,
    },
  };

  let actionProposal: ActionProposal | undefined = undefined;

  try {
    switch (parsedIntent.intent) {
      // 1. SPENDING_QUERY
      case "SPENDING_QUERY": {
        const txs = await getTransactions({
          startDate: dateResult.startDateISO,
          endDate: dateResult.endDateISO,
        });

        if (!txs || txs.length === 0) {
          structuredPayload.hasData = false;
          structuredPayload.unavailableReason = `No transactions found for ${dateResult.label}.`;
          break;
        }

        const expResult = calculateTotalExpenses(txs);
        const incResult = calculateTotalIncome(txs);
        const netResult = calculateNetSavings(incResult.totalIncome.value, expResult.totalExpenses.value);

        structuredPayload.data = {
          expenses: expResult,
          income: incResult,
          netSavings: netResult,
        };
        break;
      }

      // 2. CATEGORY_QUERY
      case "CATEGORY_QUERY": {
        const targetCategory = parsedIntent.targetCategory as Category | undefined;
        const categoryData = await getCategorySpending(
          targetCategory,
          dateResult.startDate.getFullYear(),
          dateResult.startDate.getMonth() + 1
        );

        if (!categoryData || categoryData.length === 0) {
          structuredPayload.hasData = false;
          structuredPayload.unavailableReason = `No category spending records available for ${dateResult.label}.`;
          break;
        }

        structuredPayload.data = { categoryData, targetCategory };
        break;
      }

      // 3. MERCHANT_QUERY
      case "MERCHANT_QUERY": {
        const merchantData = await getMerchantSpending(parsedIntent.targetMerchant);
        if (!merchantData || merchantData.length === 0) {
          structuredPayload.hasData = false;
          structuredPayload.unavailableReason = `No transactions found for merchant '${parsedIntent.targetMerchant || userQuery}'.`;
          break;
        }

        structuredPayload.data = { merchantData };
        break;
      }

      // 4. COMPARISON_QUERY (Spending Detective)
      case "COMPARISON_QUERY": {
        const currTxs = await getTransactions({
          startDate: dateResult.startDateISO,
          endDate: dateResult.endDateISO,
        });

        const compStartDate = dateResult.isComparison && dateResult.comparisonRange
          ? dateResult.comparisonRange.startDateISO
          : new Date(dateResult.startDate.getFullYear(), dateResult.startDate.getMonth() - 1, 1).toISOString();

        const compEndDate = dateResult.isComparison && dateResult.comparisonRange
          ? dateResult.comparisonRange.endDateISO
          : new Date(dateResult.startDate.getFullYear(), dateResult.startDate.getMonth(), 0).toISOString();

        const compTxs = await getTransactions({
          startDate: compStartDate,
          endDate: compEndDate,
        });

        const detectiveResult = runSpendingDetective(
          currTxs,
          compTxs,
          dateResult.label,
          dateResult.isComparison && dateResult.comparisonRange ? dateResult.comparisonRange.label : "Previous Period"
        );

        structuredPayload.data = { spendingDetective: detectiveResult };
        break;
      }

      // 5. BUDGET_QUERY
      case "BUDGET_QUERY": {
        const budgetStatus = await getBudgetStatus(
          dateResult.startDate.getFullYear(),
          dateResult.startDate.getMonth() + 1
        );

        if (!budgetStatus || budgetStatus.budgets.length === 0) {
          structuredPayload.hasData = false;
          structuredPayload.unavailableReason = "No active budget targets found. You can ask me to set a new category budget!";
          break;
        }

        structuredPayload.data = { budgetStatus };
        break;
      }

      // 6. SAFE_TO_SPEND_QUERY & WHAT-IF SIMULATOR
      case "SAFE_TO_SPEND_QUERY": {
        const balanceRes = await getCurrentBalance();
        const incRes = await getMonthlyIncome();
        const expRes = await getMonthlyExpenses();
        const commitments = await getUpcomingCommitments();
        const totalCommitments = commitments.reduce((s, c) => s + c.amount, 0);

        const isWhatIf = userQuery.toLowerCase().includes("what if") || userQuery.toLowerCase().includes("if i");

        if (isWhatIf || parsedIntent.targetAmount) {
          const simulation = simulateScenario({
            prompt: userQuery,
            currentBalance: balanceRes.totalBalance,
            monthlyIncome: incRes,
            monthlyExpenses: expRes,
            upcomingCommitments: totalCommitments,
          });
          structuredPayload.data = { simulation };
        } else {
          const safeEst = calculateSafeToSpendEstimate(
            balanceRes.totalBalance,
            totalCommitments,
            balanceRes.totalBalance * 0.15, // planned savings
            expRes * 0.2 // remaining essential expenses
          );
          structuredPayload.data = { safeEst };
        }
        break;
      }

      // 7. SUBSCRIPTION_QUERY (Subscription Detection)
      case "SUBSCRIPTION_QUERY": {
        const allTxs = await getTransactions({ limit: 200 });
        const report = detectSubscriptions(allTxs);

        if (!report || report.subscriptions.length === 0) {
          structuredPayload.hasData = false;
          structuredPayload.unavailableReason = "No recurring monthly subscriptions detected in your transactions.";
          break;
        }

        structuredPayload.data = { subscriptionReport: report };
        break;
      }

      // 8. ANOMALY_QUERY (Unusual Spending Detection)
      case "ANOMALY_QUERY": {
        const currTxs = await getTransactions({
          startDate: dateResult.startDateISO,
          endDate: dateResult.endDateISO,
          type: "expense",
        });

        const histTxs = await getTransactions({
          startDate: new Date(dateResult.startDate.getFullYear(), dateResult.startDate.getMonth() - 3, 1).toISOString(),
          type: "expense",
        });

        const unusualReport = detectUnusualSpending(currTxs, histTxs);
        structuredPayload.data = { unusualReport };
        break;
      }

      // 9. SAVING_ADVICE
      case "SAVING_ADVICE": {
        const savingsResult = await getSavingsRate(
          dateResult.startDate.getFullYear(),
          dateResult.startDate.getMonth() + 1
        );
        structuredPayload.data = { savingsResult };
        break;
      }

      // 10. TRANSACTION_QUERY
      case "TRANSACTION_QUERY": {
        const allTxs = await getTransactions();
        if (!allTxs || allTxs.length === 0) {
          structuredPayload.hasData = false;
          structuredPayload.unavailableReason = "No transactions recorded yet in your account.";
          break;
        }

        structuredPayload.data = {
          recentTransactions: allTxs.slice(0, 10),
          totalTransactionCount: allTxs.length,
        };
        break;
      }

      // 11. ACTION_REQUEST (returns proposal card, does NOT execute write yet)
      case "ACTION_REQUEST": {
        const pLower = userQuery.toLowerCase();
        let actionType: ActionType = "CREATE_TRANSACTION";

        if (pLower.includes("budget") || pLower.includes("limit")) {
          actionType = (pLower.includes("change") || pLower.includes("update")) ? "UPDATE_BUDGET" : "CREATE_BUDGET";
        } else if (pLower.includes("savings goal") || pLower.includes("target savings")) {
          actionType = "CREATE_SAVINGS_GOAL";
        } else if (pLower.includes("reminder") || pLower.includes("review")) {
          actionType = "CREATE_REMINDER";
        } else if (pLower.includes("categorize") || pLower.includes("reassign")) {
          actionType = "CATEGORIZE_TRANSACTIONS";
        } else {
          actionType = "CREATE_TRANSACTION";
        }

        const category = (parsedIntent.targetCategory as Category) || "Food & Dining";
        const amount = parsedIntent.targetAmount || 100;
        const merchant = parsedIntent.targetMerchant || (parsedIntent.targetCategory ? parsedIntent.targetCategory : "Transaction");
        const date = parsedIntent.targetDate || new Date().toISOString().slice(0, 10);
        const paymentMethod = parsedIntent.targetPaymentMethod || "Bank";
        const accountName = parsedIntent.targetAccountName;

        actionProposal = createActionProposal(actionType, {
          category,
          targetCategory: category,
          merchant,
          amount,
          limit: amount,
          date,
          paymentMethod,
          accountName,
          period: "monthly",
          type: pLower.includes("income") || pLower.includes("salary") || pLower.includes("deposit") ? "income" : "expense",
          reminderTitle: "Review subscriptions and recurring expenses",
        });

        structuredPayload.data = { proposal: actionProposal };
        break;
      }

      // 12. FORECAST_QUERY
      case "FORECAST_QUERY": {
        const balanceRes = await getCurrentBalance();
        const commitments = await getUpcomingCommitments();
        const totalCommitments = commitments.reduce((s, c) => s + c.amount, 0);
        const allTxs = await getTransactions({ limit: 100 });

        const forecastResult = calculateMonthEndForecast(
          allTxs,
          balanceRes.totalBalance,
          totalCommitments
        );
        structuredPayload.data = { monthEndForecast: forecastResult };
        break;
      }

      // 13. GENERAL_FINANCIAL_QUERY
      case "GENERAL_FINANCIAL_QUERY":
      default: {
        const balanceRes = await getCurrentBalance();
        const savingsResult = await getSavingsRate();
        structuredPayload.data = { balanceRes, savingsResult };
        break;
      }
    }
  } catch (err) {
    console.error("Orchestrator pipeline error:", err);
    structuredPayload.hasData = false;
    structuredPayload.unavailableReason = "An error occurred while analyzing your financial data.";
  }

  // Pass ONLY structured factual calculations to LLM provider for natural language explanation
  const aiExplanationText = await generateAIExplanation({
    prompt: userQuery,
    structuredPayload,
    userContext,
  });

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sender: "assistant",
    text: aiExplanationText,
    timestamp: new Date(),
    intent: parsedIntent.intent,
    structuredPayload,
    actionProposal,
  };
}
