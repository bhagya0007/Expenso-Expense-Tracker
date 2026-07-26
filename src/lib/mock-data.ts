import type { Account, Budget, Category, Insight, Transaction } from "./types";

export const accounts: Account[] = [
  { id: "a1", name: "HDFC Savings", type: "Bank", balance: 184230, mask: "•• 4521" },
  { id: "a2", name: "HDFC Credit Card", type: "Credit Card", balance: -18420, mask: "•• 9902" },
  { id: "a3", name: "Paytm Wallet", type: "Wallet", balance: 2140 },
  { id: "a4", name: "Cash", type: "Cash", balance: 3500 },
];

const merchants: Array<{ name: string; category: Category; method: Transaction["paymentMethod"] }> = [
  { name: "Swiggy", category: "Food & Dining", method: "UPI" },
  { name: "Zomato", category: "Food & Dining", method: "Credit Card" },
  { name: "Uber", category: "Transport", method: "UPI" },
  { name: "Amazon", category: "Shopping", method: "Credit Card" },
  { name: "Netflix", category: "Entertainment", method: "Credit Card" },
  { name: "Spotify", category: "Entertainment", method: "UPI" },
  { name: "Airtel", category: "Bills & Utilities", method: "UPI" },
  { name: "Apollo Pharmacy", category: "Health", method: "Debit Card" },
  { name: "Zerodha", category: "Investments", method: "Bank" },
  { name: "BigBasket", category: "Food & Dining", method: "UPI" },
];



// Deterministic pseudo-random for stable demo data
let seed = 42;
function rng() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
function pick<T>(arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }

export const transactions: Transaction[] = (() => {
  const list: Transaction[] = [];
  const now = new Date();
  // Salary
  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    list.push({
      id: `sal-${i}`,
      type: "income",
      amount: 125000,
      category: "Salary",
      merchant: "Acme Corp Payroll",
      date: d.toISOString(),
      paymentMethod: "Bank",
      accountId: "a1",
    });
  }
  // 60 random expenses spread across last 60 days
  for (let i = 0; i < 60; i++) {
    const m = pick(merchants);
    const daysAgo = Math.floor(rng() * 60);
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    list.push({
      id: `tx-${i}`,
      type: "expense",
      amount: Math.round(50 + rng() * 2500),
      category: m.category,
      merchant: m.name,
      date: d.toISOString(),
      paymentMethod: m.method,
      accountId: pick(accounts).id,
    });
  }
  return list.sort((a, b) => +new Date(b.date) - +new Date(a.date));
})();

export const budgets: Budget[] = ([
  { id: "b1", category: "Food & Dining", limit: 12000, spent: 0, period: "monthly" },
  { id: "b2", category: "Transport", limit: 5000, spent: 0, period: "monthly" },
  { id: "b3", category: "Shopping", limit: 8000, spent: 0, period: "monthly" },
  { id: "b4", category: "Entertainment", limit: 3000, spent: 0, period: "monthly" },
  { id: "b5", category: "Bills & Utilities", limit: 6000, spent: 0, period: "monthly" },
] as Budget[]).map((b) => {
  const now = new Date();
  const spent = transactions
    .filter((t) =>
      t.type === "expense" &&
      t.category === b.category &&
      new Date(t.date).getMonth() === now.getMonth() &&
      new Date(t.date).getFullYear() === now.getFullYear(),
    )
    .reduce((s, t) => s + t.amount, 0);
  return { ...b, spent };
});

export const insights: Insight[] = [
  {
    id: "i1",
    title: "Food spending up 34%",
    body: "You've spent ₹4,820 more on food this month vs last. Cutting delivery by 20% would save ~₹1,500.",
    severity: "warning",
  },
  {
    id: "i2",
    title: "3 active subscriptions detected",
    body: "Netflix, Spotify and Prime cost you ₹1,247/mo. Consider a family plan to save ~₹400.",
    severity: "info",
  },
  {
    id: "i3",
    title: "Savings rate: 42%",
    body: "You're in the top 10% of savers this month. Keep going!",
    severity: "success",
  },
];
