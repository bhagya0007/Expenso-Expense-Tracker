import type { Transaction, Category } from "@/lib/types";

export interface DateRange {
  start: Date;
  end: Date;
}

export function filterTransactionsByDateRange(
  txs: Transaction[],
  range: DateRange
): Transaction[] {
  const startMs = range.start.getTime();
  const endMs = range.end.getTime();
  return txs.filter((t) => {
    const dt = new Date(t.date).getTime();
    return !isNaN(dt) && dt >= startMs && dt <= endMs;
  });
}

export function filterTransactionsByCategory(
  txs: Transaction[],
  category: Category
): Transaction[] {
  const catLower = category.toLowerCase();
  return txs.filter((t) => (t.category || "").toLowerCase() === catLower);
}

export function filterTransactionsByMerchant(
  txs: Transaction[],
  merchantQuery: string
): Transaction[] {
  const queryLower = merchantQuery.toLowerCase().trim();
  return txs.filter(
    (t) =>
      (t.merchant || "").toLowerCase().includes(queryLower) ||
      (t.notes || "").toLowerCase().includes(queryLower)
  );
}

export function getCurrentMonthRange(): DateRange {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function getPastDaysRange(days: number): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - days);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}
