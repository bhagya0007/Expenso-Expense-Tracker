import type { StructuredContextPayload } from "../types/ai.types";

export interface AIResponseOptions {
  prompt: string;
  structuredPayload?: StructuredContextPayload;
  userContext?: {
    name?: string;
    currency?: string;
  };
}

/**
 * Conversational Money Coach Explanation Engine.
 * Synthesizes 100% factual numeric results from structuredPayload into clear, concise, personalized financial coaching responses.
 * NEVER invents or alters any numbers.
 */
export async function generateAIExplanation(options: AIResponseOptions): Promise<string> {
  const { prompt, structuredPayload, userContext } = options;
  const greetingName = userContext?.name ? `Hi ${userContext.name}` : "Hello";

  // 1. Handle insufficient or missing data explicitly
  if (structuredPayload && !structuredPayload.hasData) {
    return `ℹ️ **Insufficient Data**\n\n${
      structuredPayload.unavailableReason || "I don't have enough recorded transaction data in your account yet to answer this query. Try adding transactions or importing a bank statement!"
    }`;
  }

  // 2. Synthesize factual deterministic calculations into Money Coach responses
  if (structuredPayload && structuredPayload.data) {
    const { intent, dateRangeLabel, data } = structuredPayload;

    switch (intent) {
      // 1. "How much did I spend this month?" / "Total spending"
      case "SPENDING_QUERY": {
        const exp = Number((data.expenses as any)?.totalExpenses?.value ?? 0);
        const inc = Number((data.income as any)?.totalIncome?.value ?? 0);
        const net = Number((data.netSavings as any)?.netSavings?.value ?? 0);
        const count = (data.expenses as any)?.transactionCount?.value ?? 0;

        return `👋 ${greetingName}!\n\n` +
          `📊 **Spending Overview (${dateRangeLabel})**\n\n` +
          `Based on your recorded ledger in Expenso, you have spent **₹${exp.toLocaleString("en-IN")}** across **${count} transactions**.\n\n` +
          `| Metric | Metadata Tag | Amount |\n` +
          `| :--- | :--- | :--- |\n` +
          `| 🔴 **Total Expenses** | Actual | ₹${exp.toLocaleString("en-IN")} |\n` +
          `| 🟢 **Total Income** | Actual | ₹${inc.toLocaleString("en-IN")} |\n` +
          `| 💰 **Net Savings** | Calculated | ₹${net.toLocaleString("en-IN")} |\n\n` +
          `${net >= 0 ? "✅ **Healthy Cash Flow**: You saved money this period. Great job staying within your means!" : "⚠️ **Overspending Warning**: Your expenses exceeded income for this period. Review your top categories to rebalance."}`;
      }

      // 2. "Where did most of my money go?" / "Top categories" / "Food spending"
      case "CATEGORY_QUERY": {
        const list = (data.categoryData as any[]) || [];
        const target = data.targetCategory as string | undefined;

        if (target && list.length > 0) {
          const cat = list[0];
          return `🍕 **${cat.category} Spending (${dateRangeLabel})**\n\n` +
            `You spent **₹${Number(cat.totalSpent).toLocaleString("en-IN")}** on **${cat.category}** across **${cat.transactionCount} transactions** (${cat.percentageOfTotal}% of total expenses).\n\n` +
            `- **Category Share**: ${cat.percentageOfTotal}%\n` +
            `- **Transactions**: ${cat.transactionCount}\n\n` +
            `${cat.percentageOfTotal > 30 ? "💡 *Coach Tip: This category accounts for a major chunk of your budget. Consider setting a monthly limit.*" : "✅ *Your spending in this category is well balanced.*"}`;
        }

        if (list.length === 0) {
          return `ℹ️ **Insufficient Data**: No category spending records found for ${dateRangeLabel}.`;
        }

        const top = list[0];
        const tableRows = list
          .slice(0, 5)
          .map((c, i) => `| ${i + 1}. ${c.category} | ₹${Number(c.totalSpent).toLocaleString("en-IN")} | ${c.percentageOfTotal}% |`)
          .join("\n");

        return `🏆 **Where Your Money Went (${dateRangeLabel})**\n\n` +
          `Most of your money went to **${top.category}** (**₹${Number(top.totalSpent).toLocaleString("en-IN")}**).\n\n` +
          `| Category | Total Spent | % of Total |\n` +
          `| :--- | :--- | :--- |\n` +
          `${tableRows}\n\n` +
          `💡 *Top 3 categories account for ${list.slice(0, 3).reduce((s, c) => s + c.percentageOfTotal, 0)}% of your overall monthly spending.*`;
      }

      // 3. "How much did I spend on Amazon?" / Merchant Query
      case "MERCHANT_QUERY": {
        const list = (data.merchantData as any[]) || [];
        if (list.length === 0) {
          return `ℹ️ **Insufficient Data**: No transactions matching '${data.merchantQuery || prompt}' were found in your ledger.`;
        }

        const top = list[0];
        return `🛍️ **Merchant Summary: ${top.merchant}**\n\n` +
          `You spent **₹${Number(top.totalSpent).toLocaleString("en-IN")}** at **${top.merchant}** across **${top.transactionCount} transactions**.\n\n` +
          `- **Total Spent**: ₹${Number(top.totalSpent).toLocaleString("en-IN")}\n` +
          `- **Total Income/Refunds**: ₹${Number(top.totalIncome).toLocaleString("en-IN")}\n` +
          `- **Net Amount**: ₹${Number(top.netAmount).toLocaleString("en-IN")}`;
      }

      // 4. "Compare this month with last month" / "Why did I spend more?" (Spending Detective)
      case "COMPARISON_QUERY": {
        const sd = data.spendingDetective as any;
        if (!sd) {
          return "ℹ️ **Insufficient Data**: Not enough historical data to compare periods.";
        }

        const incText = sd.categoryIncreases && sd.categoryIncreases.length > 0
          ? sd.categoryIncreases.slice(0, 5).map((c: any) => `- **${c.category}**: +₹${c.differenceAmount.toLocaleString("en-IN")} (${c.percentageChange}%)`).join("\n")
          : "- *No significant category increases.*";

        const decText = sd.categoryDecreases && sd.categoryDecreases.length > 0
          ? sd.categoryDecreases.slice(0, 5).map((c: any) => `- **${c.category}**: -₹${Math.abs(c.differenceAmount).toLocaleString("en-IN")} (${c.percentageChange}%)`).join("\n")
          : "- *No significant category decreases.*";

        return `🕵️ **Spending Detective Analysis**\n\n` +
          `${sd.summaryText}\n\n` +
          `| Period | Total Expenses |\n` +
          `| :--- | :--- |\n` +
          `| ${sd.periodLabel} | ₹${Number(sd.currentTotalSpent).toLocaleString("en-IN")} |\n` +
          `| ${sd.previousPeriodLabel} | ₹${Number(sd.previousTotalSpent).toLocaleString("en-IN")} |\n` +
          `| **Net Difference** | **${sd.totalDifferenceAmount >= 0 ? "+" : "-"}₹${Math.abs(sd.totalDifferenceAmount).toLocaleString("en-IN")} (${sd.percentageChange}%)** |\n\n` +
          `📈 **Primary Category Increases**:\n${incText}\n\n` +
          `📉 **Primary Category Reductions**:\n${decText}`;
      }

      // 5. "What are my budgets?" / "Am I over budget?"
      case "BUDGET_QUERY": {
        const bgt = data.budgetStatus as any;
        if (!bgt || !bgt.budgets || bgt.budgets.length === 0) {
          return "ℹ️ **No Active Budgets**: You have not set up any category budgets yet. Ask me to set a category budget!";
        }

        const over = bgt.overBudgetCount || 0;
        const totalLimit = Number(bgt.totalLimit || 0);
        const totalSpent = Number(bgt.totalSpent || 0);

        const rows = bgt.budgets
          .map((b: any) => `| ${b.category} | ₹${b.spent.toLocaleString("en-IN")} | ₹${b.limit.toLocaleString("en-IN")} | ${b.isOverBudget ? "⚠️ Over" : "✅ OK"} |`)
          .join("\n");

        return `🎯 **Budget Adherence Summary**\n\n` +
          `${over > 0 ? `⚠️ **Warning**: ${over} category budget is over limit!` : "✅ **All category budgets are currently on track!**"}\n\n` +
          `| Category | Spent | Limit | Status |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          `${rows}\n\n` +
          `Total Spent: **₹${totalSpent.toLocaleString("en-IN")}** / **₹${totalLimit.toLocaleString("en-IN")}** (${bgt.overallUsagePercentage}% used).`;
      }

      // 6. SAFE-TO-SPEND & WHAT-IF SIMULATOR
      case "SAFE_TO_SPEND_QUERY": {
        if (data.simulation) {
          const sim = data.simulation as any;
          const diffSign = sim.difference.value >= 0 ? "+" : "";

          return `🧪 **${sim.title}**\n\n` +
            `${sim.projectedResult.explanation}\n\n` +
            `| Parameter | Value |\n` +
            `| :--- | :--- |\n` +
            `| **Current Situation** (${sim.currentSituation.label}) | ₹${Number(sim.currentSituation.value).toLocaleString("en-IN")} |\n` +
            `| **Scenario Adjustment** (${sim.scenarioDetail.label}) | ₹${Number(sim.scenarioDetail.value).toLocaleString("en-IN")} |\n` +
            `| **Net Difference** (${sim.difference.label}) | **${diffSign}₹${Number(sim.difference.value).toLocaleString("en-IN")}** |\n` +
            `| **Projected Result** (${sim.projectedResult.label}) | **₹${Number(sim.projectedResult.value).toLocaleString("en-IN")}** |\n\n` +
            `💡 *Note: This is a simulation calculation only. No actual transactions or budgets have been modified in your account.*`;
        }

        const safeEst = (data.safeEst as any) || {};
        const finCtx = (data.financialContext as any) || {};
        const balance = Number(safeEst.currentBalance?.value ?? 0);
        const commitments = Number(safeEst.upcomingCommitments?.value ?? 0);
        const savings = Number(safeEst.plannedSavings?.value ?? 0);
        const remainingEssential = Number(safeEst.remainingEssentialExpenses?.value ?? 0);
        const safe = Number(safeEst.estimatedSafeToSpend?.value ?? 0);
        const budgetCap = Number(finCtx.monthlyBudgetLimit ?? 0);
        const savingsGoal = Number(finCtx.savingsGoalAmount ?? 20000);

        return `🛡️ **Safe-to-Spend & Affordability Assessment**\n\n` +
          `Your estimated discretionary safe-to-spend allowance is **₹${safe.toLocaleString("en-IN")}**.\n\n` +
          `📊 **Financial Context Factors Analyzed**:\n` +
          `- **Current Net Balance**: ₹${balance.toLocaleString("en-IN")} (Actual ledger balance)\n` +
          `- **Monthly Budget Cap**: ₹${budgetCap > 0 ? budgetCap.toLocaleString("en-IN") : "Not set"}\n` +
          `- **Upcoming Commitments**: ₹${commitments.toLocaleString("en-IN")} (Scheduled bills & reminders)\n` +
          `- **Monthly Savings Target**: ₹${savingsGoal.toLocaleString("en-IN")} (Planned savings goal)\n` +
          `- **Remaining Essential Expenses**: ₹${remainingEssential.toLocaleString("en-IN")} (Estimated essential burn)\n\n` +
          `| Financial Component | Metadata Tag | Amount |\n` +
          `| :--- | :--- | :--- |\n` +
          `| 🟢 **Current Balance** | Actual | ₹${balance.toLocaleString("en-IN")} |\n` +
          `| 🔴 **Expected Commitments** | Actual | ₹${commitments.toLocaleString("en-IN")} |\n` +
          `| 💰 **Planned Savings Target** | Estimate | ₹${savingsGoal.toLocaleString("en-IN")} |\n` +
          `| 🛡️ **Estimated Discretionary Amount** | **Estimate** | **₹${safe.toLocaleString("en-IN")}** |\n\n` +
          `💡 *Decision Note: Expenso AI does not make purchasing decisions on your behalf. Review the factors above to make an informed choice for your budget.*`;
      }

      // 7. "What subscriptions am I paying for?" (Subscription Detection)
      case "SUBSCRIPTION_QUERY": {
        const report = (data.subscriptionReport as any) || {};
        const subs = (report.subscriptions as any[]) || [];

        if (subs.length === 0) {
          return "ℹ️ **No Subscriptions Detected**: No recurring monthly charges were detected in your recorded transactions.";
        }

        const rows = subs
          .map(
            (s) =>
              `| ${s.merchant} | ₹${Number(s.typicalAmount).toLocaleString("en-IN")} | ${s.frequency} | ₹${Number(s.estimatedMonthlyCost).toLocaleString("en-IN")} | ₹${Number(s.estimatedAnnualCost).toLocaleString("en-IN")} | ${s.confidence === "Confirmed subscription" ? "✅ Confirmed" : "🔍 Possible"} |`
          )
          .join("\n");

        return `💳 **Subscription Detection Report**\n\n` +
          `We identified **${report.totalConfirmedCount} Confirmed subscriptions** and **${report.totalPossibleCount} Possible subscriptions** totaling **₹${Number(report.totalMonthlyCost).toLocaleString("en-IN")}/month** (₹${Number(report.totalAnnualCost).toLocaleString("en-IN")}/year):\n\n` +
          `| Merchant | Typical Amount | Frequency | Est. Monthly | Est. Annual | Status |\n` +
          `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
          `${rows}\n\n` +
          `💡 *Note: Subscriptions are detected based on recurring transaction history. Expenso AI will never automatically cancel or modify any services.*`;
      }

      // 8. "Unusual Spending Detection" / Anomaly Query
      case "ANOMALY_QUERY": {
        const report = data.unusualReport as any;
        if (!report || !report.flags || report.flags.length === 0) {
          return "✅ **No Unusual Activity**: All transactions and category spending patterns align within your normal historical behavior.";
        }

        const flagItems = report.flags
          .map((f: any) => `- 🔍 **${f.title}** (${f.reasonLabel})\n  *${f.description}*`)
          .join("\n\n");

        return `⚡ **Unusual Spending Detection (${dateRangeLabel})**\n\n` +
          `We identified **${report.totalFlags} items worth reviewing** relative to your normal historical behavior:\n\n` +
          `${flagItems}\n\n` +
          `💡 *Coach Note: These spending patterns are higher than your normal pattern or worth reviewing to stay within your budget.*`;
      }

      // 9. "How much did I save?" / Savings Advice
      case "SAVING_ADVICE": {
        const sav = (data.savingsResult as any) || {};
        const rate = sav.savingsRatePercentage ?? 0;
        const net = Number(sav.netSavings ?? 0);
        const inc = Number(sav.monthlyIncome ?? 0);
        const exp = Number(sav.monthlyExpenses ?? 0);

        return `💰 **Savings Analysis (${dateRangeLabel})**\n\n` +
          `You saved **₹${net.toLocaleString("en-IN")}** for this period (**${rate}% savings rate**).\n\n` +
          `- **Total Income**: ₹${inc.toLocaleString("en-IN")}\n` +
          `- **Total Expenses**: ₹${exp.toLocaleString("en-IN")}\n` +
          `- **Net Savings**: ₹${net.toLocaleString("en-IN")}\n` +
          `- **Savings Rate**: ${rate}%\n\n` +
          `${rate >= 20 ? "🎉 **Excellent financial discipline!** You are meeting the recommended 20%+ savings rule." : "💡 *Coach Advice: Aim to increase your savings rate to 20% by cutting non-essential subscriptions and discretionary shopping.*"}`;
      }

      // 10. "Show my recent transactions" / "How many transactions do I have?"
      case "TRANSACTION_QUERY": {
        const txs = (data.recentTransactions as any[]) || [];
        const totalCount = Number(data.totalTransactionCount ?? txs.length);

        if (txs.length === 0) {
          return `👋 ${greetingName}!\n\nℹ️ **No Transactions Recorded Yet**\n\nYou currently have **0 transactions** in your account. Add a transaction or upload a bank statement to get started!`;
        }

        const rows = txs
          .slice(0, 10)
          .map((t) => {
            const dateObj = new Date(t.date);
            const formattedDate = isNaN(+dateObj) ? t.date : dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
            const dayOfWeek = isNaN(+dateObj) ? "" : ` (${dateObj.toLocaleDateString("en-IN", { weekday: "short" })})`;
            return `| ${formattedDate}${dayOfWeek} | ${t.merchant || "Transaction"} | ${t.type === "income" ? "+" : "-"}₹${Number(t.amount).toLocaleString("en-IN")} | ${t.category || "Other"} |`;
          })
          .join("\n");

        return `👋 ${greetingName}!\n\n` +
          `📋 **Transaction Ledger Summary**\n\n` +
          `You currently have **${totalCount} transaction${totalCount === 1 ? "" : "s"}** recorded in your account.\n\n` +
          `| Date & Day | Merchant / Description | Amount | Category |\n` +
          `| :--- | :--- | :--- | :--- |\n` +
          `${rows}`;
      }

      // 12. "Month-End Forecast"
      case "FORECAST_QUERY": {
        const fc = (data.monthEndForecast as any) || {};
        const currBal = Number(fc.currentBalance?.value ?? 0);
        const burn = Number(fc.dailyBurnRate?.value ?? 0);
        const remExp = Number(fc.projectedRemainingExpenses?.value ?? 0);
        const comm = Number(fc.upcomingCommitments?.value ?? 0);
        const inc = Number(fc.expectedRemainingIncome?.value ?? 0);
        const monthEnd = Number(fc.forecastedMonthEndBalance?.value ?? 0);
        const rangeText = fc.forecastRange?.label || `₹${monthEnd.toLocaleString("en-IN")}`;

        return `📈 **Month-End Balance Forecast**\n\n` +
          `Projected Month-End Range: **${rangeText}**\n\n` +
          `| Parameter | Metadata Tag | Amount |\n` +
          `| :--- | :--- | :--- |\n` +
          `| 🟢 **Current Account Balance** | **Actual** | ₹${currBal.toLocaleString("en-IN")} |\n` +
          `| 🔥 **Average Daily Burn Rate** | **Actual** | ₹${burn.toLocaleString("en-IN")}/day (${fc.daysElapsed} days elapsed) |\n` +
          `| 🔴 **Upcoming Commitments** | **Actual** | ₹${comm.toLocaleString("en-IN")} |\n` +
          `| 🛒 **Projected Remaining Expenses** | **Estimated** | ₹${remExp.toLocaleString("en-IN")} (${fc.daysRemainingInMonth} days remaining) |\n` +
          `| 💰 **Expected Remaining Income** | **Estimated** | ₹${inc.toLocaleString("en-IN")} |\n` +
          `| 🎯 **Estimated Month-End Balance** | **Forecast** | **₹${monthEnd.toLocaleString("en-IN")}** |\n\n` +
          `⚠️ *Disclaimer: ${fc.explanation || "This is a projected forecast based on historical burn rate and is not an exact guarantee."}*`;
      }

      // Action Proposal explanation
      case "ACTION_REQUEST": {
        const p = data.proposal as any;
        return `✨ **Action Proposal Generated**\n\n` +
          `I have created a proposal for **${p?.title || "Action Request"}**.\n\n` +
          `Review the action card below and click **Review & Confirm** to apply it to your ledger.`;
      }
    }
  }

  return `💡 **Expenso Financial Intelligence Assistant**\n\n` +
    `I am specialized strictly in personal finance, cash flow intelligence, budgets, transactions, and purchasing feasibility.\n\n` +
    `I didn't detect a financial calculation or action request in your query. Here are examples of questions you can ask me:\n\n` +
    `- 📊 *"How much did I spend on Food this month?"*\n` +
    `- 🛒 *"Can I afford a ₹5,000 purchase?"*\n` +
    `- 💳 *"What subscriptions am I paying for?"*\n` +
    `- 🎯 *"Create a ₹5,000 Food & Dining budget"*\n` +
    `- ➕ *"Add a Wallet transaction of ₹150 for Maggie on 07-08-2026"*\n` +
    `- 🔮 *"What if I save ₹2,000 every month?"*`;
}
