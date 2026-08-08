import type { Transaction, Budget } from "@/lib/types";
import type { ExpensoAIInsight } from "../types/ai.types";

function round2(num: number): number {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Proactive Expenso AI Insights Generator.
 * Generates factual insights derived directly from actual calculated ledger data.
 * Zero motivational fluff; returns empty array if data is insufficient.
 */
export function generateProactiveInsights(
  transactions: Transaction[],
  budgets: Budget[] = []
): ExpensoAIInsight[] {
  const expenseTxs = transactions.filter((t) => t.type === "expense");

  // Require minimum 5 expense transactions to avoid generating false insights
  if (expenseTxs.length < 5) {
    return [];
  }

  const insights: ExpensoAIInsight[] = [];
  const now = new Date();
  const currentMonthISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthISO = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, "0")}-01`;
  const prevMonthEndISO = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);

  const currMonthTxs = expenseTxs.filter((t) => t.date >= currentMonthISO);
  const prevMonthTxs = expenseTxs.filter((t) => t.date >= prevMonthISO && t.date <= prevMonthEndISO);

  // 1. Weekend vs Weekday Spending Analysis
  if (currMonthTxs.length >= 4) {
    let weekendTotal = 0;
    let weekendDays = 0;
    let weekdayTotal = 0;
    let weekdayDays = 0;

    const daysSeen = new Set<string>();

    currMonthTxs.forEach((t) => {
      const d = new Date(t.date);
      const dayOfWeek = d.getDay(); // 0 = Sun, 6 = Sat
      daysSeen.add(t.date);

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendTotal += t.amount;
      } else {
        weekdayTotal += t.amount;
      }
    });

    daysSeen.forEach((dateStr) => {
      const dayOfWeek = new Date(dateStr).getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendDays++;
      } else {
        weekdayDays++;
      }
    });

    const avgWeekendDaily = weekendDays > 0 ? weekendTotal / weekendDays : 0;
    const avgWeekdayDaily = weekdayDays > 0 ? weekdayTotal / weekdayDays : 0;

    if (avgWeekdayDaily > 0 && avgWeekendDaily >= avgWeekdayDaily * 1.6 && weekendTotal >= 1500) {
      const pctHigher = Math.round(((avgWeekendDaily - avgWeekdayDaily) / avgWeekdayDaily) * 100);
      insights.push({
        id: "ins-weekend-spending",
        type: "anomaly",
        title: "Weekend Spending Spike",
        description: `Your average daily weekend spending (₹${round2(avgWeekendDaily).toLocaleString("en-IN")}/day) is ${pctHigher}% higher than weekday spending.`,
        impactAmount: round2(weekendTotal),
        severity: "warning",
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 2. Category MoM Spending Increase (e.g. "You spent ₹1,200 more on shopping this month.")
  if (currMonthTxs.length >= 3 && prevMonthTxs.length >= 3) {
    const currCatMap = new Map<string, number>();
    currMonthTxs.forEach((t) => {
      const c = t.category || "Other";
      currCatMap.set(c, (currCatMap.get(c) || 0) + t.amount);
    });

    const prevCatMap = new Map<string, number>();
    prevMonthTxs.forEach((t) => {
      const c = t.category || "Other";
      prevCatMap.set(c, (prevCatMap.get(c) || 0) + t.amount);
    });

    currCatMap.forEach((currAmt, cat) => {
      const prevAmt = prevCatMap.get(cat) || 0;
      const diff = round2(currAmt - prevAmt);

      if (prevAmt > 0 && diff >= 1000) {
        const pct = Math.round((diff / prevAmt) * 100);
        insights.push({
          id: `ins-cat-increase-${cat}`,
          type: "anomaly",
          title: `Higher ${cat} Spending`,
          description: `You spent ₹${diff.toLocaleString("en-IN")} more on ${cat} this month (${pct}% higher than last month).`,
          impactAmount: diff,
          severity: "info",
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  // 3. Category Spending vs Historical Baseline (e.g. "Your food spending is 24% higher than your usual average.")
  if (transactions.length >= 10) {
    const histCatTotals = new Map<string, number>();
    expenseTxs.forEach((t) => {
      const c = t.category || "Other";
      histCatTotals.set(c, (histCatTotals.get(c) || 0) + t.amount);
    });

    const currCatTotals = new Map<string, number>();
    currMonthTxs.forEach((t) => {
      const c = t.category || "Other";
      currCatTotals.set(c, (currCatTotals.get(c) || 0) + t.amount);
    });

    currCatTotals.forEach((currAmt, cat) => {
      const histTotal = histCatTotals.get(cat) || 0;
      const histAvgMonthly = histTotal / 3; // 3-month baseline

      if (histAvgMonthly > 0 && currAmt >= histAvgMonthly * 1.2 && currAmt - histAvgMonthly >= 1000) {
        const pctAbove = Math.round(((currAmt - histAvgMonthly) / histAvgMonthly) * 100);
        insights.push({
          id: `ins-cat-baseline-${cat}`,
          type: "budget_warning",
          title: `${cat} Above Normal Baseline`,
          description: `Your ${cat.toLowerCase()} spending is ${pctAbove}% higher than your usual monthly average.`,
          impactAmount: round2(currAmt - histAvgMonthly),
          severity: "warning",
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  // 4. Savings Rate Improvement (e.g. "Your savings rate improved by 8%.")
  const currInc = transactions.filter((t) => t.type === "income" && t.date >= currentMonthISO).reduce((s, t) => s + t.amount, 0);
  const currExp = currMonthTxs.reduce((s, t) => s + t.amount, 0);

  const prevInc = transactions.filter((t) => t.type === "income" && t.date >= prevMonthISO && t.date <= prevMonthEndISO).reduce((s, t) => s + t.amount, 0);
  const prevExp = prevMonthTxs.reduce((s, t) => s + t.amount, 0);

  if (currInc > 0 && prevInc > 0) {
    const currSavingsRate = Math.round(((currInc - currExp) / currInc) * 100);
    const prevSavingsRate = Math.round(((prevInc - prevExp) / prevInc) * 100);
    const rateDiff = currSavingsRate - prevSavingsRate;

    if (rateDiff >= 5) {
      insights.push({
        id: "ins-savings-improved",
        type: "savings_opportunity",
        title: "Savings Rate Improved",
        description: `Your savings rate improved by ${rateDiff}% this month (now at ${currSavingsRate}%).`,
        impactAmount: round2(currInc - currExp),
        severity: "success",
        createdAt: new Date().toISOString(),
      });
    }
  }

  // 5. Budget Warnings
  budgets.forEach((b) => {
    const spent = currMonthTxs
      .filter((t) => (t.category || "").toLowerCase() === (b.category || "").toLowerCase())
      .reduce((s, t) => s + t.amount, 0);

    const percentage = b.limit > 0 ? (spent / b.limit) * 100 : 0;
    if (percentage >= 100) {
      insights.push({
        id: `ins-bgt-${b.id}`,
        type: "budget_warning",
        title: `${b.category} Budget Exceeded`,
        description: `You have spent ₹${spent.toLocaleString("en-IN")} of your ₹${b.limit.toLocaleString("en-IN")} limit (${Math.round(percentage)}%).`,
        impactAmount: Math.round(spent - b.limit),
        severity: "danger",
        createdAt: new Date().toISOString(),
      });
    }
  });

  return insights.slice(0, 4); // Show top 4 factual insights
}
