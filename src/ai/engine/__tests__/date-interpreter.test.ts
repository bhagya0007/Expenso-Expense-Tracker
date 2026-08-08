import { interpretDateExpression } from "../date-interpreter";

export function runDateInterpreterTests(): boolean {
  let passed = true;
  // Fixed reference date for deterministic testing: August 15, 2026
  const refDate = new Date(2026, 7, 15, 14, 30, 0, 0); // Month index 7 = August

  // 1. "today"
  const t1 = interpretDateExpression("How much did I spend today?", refDate);
  if (t1.startDateISO !== "2026-08-15" || t1.endDateISO !== "2026-08-15" || t1.label !== "Today") {
    console.error("FAILED: today", t1);
    passed = false;
  }

  // 2. "this week"
  const t2 = interpretDateExpression("How much did I spend this week?", refDate);
  if (t2.startDateISO !== "2026-08-10" || t2.endDateISO !== "2026-08-16" || t2.label !== "This Week") {
    console.error("FAILED: this week", t2);
    passed = false;
  }

  // 3. "last week"
  const t3 = interpretDateExpression("How much did I spend last week?", refDate);
  if (t3.startDateISO !== "2026-08-03" || t3.endDateISO !== "2026-08-09" || t3.label !== "Last Week") {
    console.error("FAILED: last week", t3);
    passed = false;
  }

  // 4. "this month"
  const t4 = interpretDateExpression("How much did I spend this month?", refDate);
  if (t4.startDateISO !== "2026-08-01" || t4.endDateISO !== "2026-08-31" || t4.label !== "This Month") {
    console.error("FAILED: this month", t4);
    passed = false;
  }

  // 5. "last month"
  const t5 = interpretDateExpression("How much did I spend last month?", refDate);
  if (t5.startDateISO !== "2026-07-01" || t5.endDateISO !== "2026-07-31" || t5.label !== "Last Month") {
    console.error("FAILED: last month", t5);
    passed = false;
  }

  // 6. "last 3 months"
  const t6 = interpretDateExpression("How much did I spend in the last 3 months?", refDate);
  if (t6.startDateISO !== "2026-06-01" || t6.endDateISO !== "2026-08-31" || t6.label !== "Last 3 Months") {
    console.error("FAILED: last 3 months", t6);
    passed = false;
  }

  // 7. "since July"
  const t7 = interpretDateExpression("Show my expenses since July.", refDate);
  if (t7.startDateISO !== "2026-07-01" || t7.endDateISO !== "2026-08-15") {
    console.error("FAILED: since July", t7);
    passed = false;
  }

  // 8. "Compare June and July"
  const t8 = interpretDateExpression("Compare June and July.", refDate);
  if (
    !t8.isComparison ||
    t8.startDateISO !== "2026-07-01" ||
    !t8.comparisonRange ||
    t8.comparisonRange.startDateISO !== "2026-06-01"
  ) {
    console.error("FAILED: Compare June and July", t8);
    passed = false;
  }

  return passed;
}
