import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { inr, compact } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownRight, ArrowUpRight, Sparkles, Wallet, PiggyBank,
  ShieldCheck, AlertTriangle, Info, CheckCircle2, ChevronLeft, ChevronRight,
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, Pie, PieChart as RPieChart,
} from "recharts";
import { Suspense, useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const txQO = queryOptions({ queryKey: ["transactions"], queryFn: () => api.listTransactions() });
const acQO = queryOptions({ queryKey: ["accounts"], queryFn: () => api.listAccounts() });
const bdQO = queryOptions({ queryKey: ["budgets"], queryFn: () => api.listBudgets() });
const inQO = queryOptions({ queryKey: ["insights"], queryFn: () => api.listInsights() });

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(txQO);
    context.queryClient.ensureQueryData(acQO);
    context.queryClient.ensureQueryData(bdQO);
    context.queryClient.ensureQueryData(inQO);
  },
  component: () => (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  ),
});

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-6">
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
      <Skeleton className="h-96 rounded-2xl" />
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const { data: txs } = useSuspenseQuery(txQO);
  const { data: accounts } = useSuspenseQuery(acQO);
  const { data: budgets } = useSuspenseQuery(bdQO);
  const { data: insights } = useSuspenseQuery(inQO);

  const [trendMode, setTrendMode] = useState<"30d" | "month">("30d");
  const [trendType, setTrendType] = useState<"expense" | "income" | "all">("expense");
  const [monthOffset, setMonthOffset] = useState(0);

  // Listen to bank statement import events and refresh dashboard data
  useEffect(() => {
    const handleTransactionsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["budgets"] });
      queryClient.invalidateQueries({ queryKey: ["insights"] });
    };

    window.addEventListener("expenso:transactions-updated", handleTransactionsUpdated);
    return () => {
      window.removeEventListener("expenso:transactions-updated", handleTransactionsUpdated);
    };
  }, [queryClient]);

  const getTxDateKey = (dateStr: string) => {
    if (!dateStr) return "";
    const dt = new Date(dateStr);
    if (isNaN(+dt)) return dateStr.slice(0, 10);
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = txs.filter((t) => getTxDateKey(t.date).startsWith(currentMonthKey));
  const income = thisMonth.filter((t) => t.type?.toLowerCase() === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = thisMonth.filter((t) => t.type?.toLowerCase() === "expense").reduce((s, t) => s + t.amount, 0);
  const savings = income - expenses;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  const accountsBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const netCashflow = txs.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
  const balance = accounts.length > 0 ? accountsBalance : netCashflow;

  const viewedMonth = useMemo(() => {
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return d;
  }, [monthOffset, now]);

  const trend = useMemo(() => {
    const filterTx = (t: (typeof txs)[0], key: string) => {
      if (getTxDateKey(t.date) !== key) return false;
      const tType = (t.type || "expense").toLowerCase();
      if (trendType === "expense") return tType === "expense";
      if (trendType === "income") return tType === "income";
      return true;
    };

    if (trendMode === "month") {
      const y = viewedMonth.getFullYear();
      const m = viewedMonth.getMonth();
      const daysIn = new Date(y, m + 1, 0).getDate();
      return Array.from({ length: daysIn }).map((_, i) => {
        const dayNum = i + 1;
        const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const total = txs
          .filter((t) => filterTx(t, key))
          .reduce((s, t) => s + t.amount, 0);
        return { day: String(dayNum), amount: total };
      });
    }
    return Array.from({ length: 30 }).map((_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const dayNum = d.getDate();
      const key = `${y}-${String(m).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const total = txs
        .filter((t) => filterTx(t, key))
        .reduce((s, t) => s + t.amount, 0);
      return { day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }), amount: total };
    });
  }, [txs, trendMode, trendType, viewedMonth, now]);

  const catMap = new Map<string, number>();
  thisMonth.filter((t) => t.type === "expense").forEach((t) => {
    catMap.set(t.category, (catMap.get(t.category) ?? 0) + t.amount);
  });
  const catData = Array.from(catMap.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  const chartColors = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];
  const hasActivity = txs.length > 0;
  const healthScore = hasActivity ? Math.min(100, Math.max(0, 50 + savingsRate)) : null;
  const healthLabel = healthScore === null
    ? "Add data"
    : healthScore >= 80 ? "Excellent" : healthScore >= 60 ? "Good" : healthScore >= 40 ? "Fair" : "Needs work";

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = txs.filter((t) =>
    new Date(t.date).getMonth() === prevMonthDate.getMonth() &&
    new Date(t.date).getFullYear() === prevMonthDate.getFullYear()
  );
  const prevIncome = prevMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const prevExpenses = prevMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  let incomeTrend = "";
  if (income > 0 && prevIncome > 0) {
    const diff = Math.round(((income - prevIncome) / prevIncome) * 100);
    incomeTrend = `${diff >= 0 ? "+" : ""}${diff}%`;
  } else if (income > 0) {
    incomeTrend = "Active";
  }

  let expenseTrend = "";
  if (expenses > 0 && prevExpenses > 0) {
    const diff = Math.round(((expenses - prevExpenses) / prevExpenses) * 100);
    expenseTrend = `${diff >= 0 ? "+" : ""}${diff}%`;
  } else if (expenses > 0) {
    expenseTrend = "Active";
  }

  let balanceTrendBadge: { text: string; positive: boolean } | null = null;
  if (prevIncome > 0 || prevExpenses > 0) {
    const prevNet = prevIncome - prevExpenses;
    const currentNet = income - expenses;
    if (prevNet !== 0) {
      const diff = Math.round(((currentNet - prevNet) / Math.abs(prevNet)) * 100);
      balanceTrendBadge = {
        text: `${diff >= 0 ? "+" : ""}${diff}%`,
        positive: diff >= 0,
      };
    }
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Hero balance card */}
      <Card className="relative overflow-hidden border-border/60 gradient-card p-6 md:p-8 shadow-elegant">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full gradient-primary opacity-20 blur-3xl" />
        <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full gradient-accent opacity-20 blur-3xl" />
        <div className="relative grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
              <Wallet className="h-3.5 w-3.5" /> Total Balance
            </div>
            <div className="mt-2 font-numeric text-4xl font-semibold tracking-tight md:text-5xl">
              {inr(balance)}
            </div>
            {balanceTrendBadge ? (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <Badge className={balanceTrendBadge.positive ? "bg-success/15 text-success hover:bg-success/20" : "bg-destructive/15 text-destructive hover:bg-destructive/20"}>
                  {balanceTrendBadge.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {balanceTrendBadge.text}
                </Badge>
                <span className="text-muted-foreground">vs last month</span>
              </div>
            ) : (
              <div className="mt-2 text-xs text-muted-foreground">
                {accounts.length > 0 ? "Live balance across linked accounts" : "No transaction activity recorded yet"}
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {accounts.slice(0, 3).map((a) => (
              <div key={a.id} className="glass rounded-2xl px-4 py-3">
                <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{a.type}</div>
                <div className="mt-0.5 text-sm font-semibold">{a.name}</div>
                <div className={`mt-1 text-xs ${a.balance < 0 ? "text-destructive" : "text-foreground"}`}>
                  {inr(a.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Monthly Income" value={inr(income)} icon={<ArrowDownRight className="h-4 w-4" />} tone="success" trend={incomeTrend} />
        <StatCard label="Monthly Expenses" value={inr(expenses)} icon={<ArrowUpRight className="h-4 w-4" />} tone="danger" trend={expenseTrend} />
        <StatCard label="Total Savings" value={inr(savings)} icon={<PiggyBank className="h-4 w-4" />} tone="primary" trend={income > 0 ? `${savingsRate}% rate` : ""} />
        <StatCard label="Health Score" value={healthScore === null ? "—" : `${healthScore}/100`} icon={<ShieldCheck className="h-4 w-4" />} tone="accent" trend={healthLabel} />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 gradient-card p-5 lg:col-span-2 shadow-card">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-semibold">Spending Trend</h3>
              <p className="text-xs text-muted-foreground">
                {trendMode === "30d"
                  ? "Last 30 days"
                  : viewedMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {trendMode === "month" && (
                <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/40 p-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full"
                    onClick={() => setMonthOffset((o) => o - 1)}
                    aria-label="Previous month"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="min-w-[92px] text-center text-[11px] font-medium tabular-nums">
                    {viewedMonth.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-full"
                    onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
                    disabled={monthOffset >= 0}
                    aria-label="Next month"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/40 p-0.5">
                <Button
                  size="sm"
                  variant={trendType === "expense" ? "default" : "ghost"}
                  className={`h-7 rounded-full px-2.5 text-xs ${trendType === "expense" ? "gradient-primary" : ""}`}
                  onClick={() => setTrendType("expense")}
                >Expenses</Button>
                <Button
                  size="sm"
                  variant={trendType === "income" ? "default" : "ghost"}
                  className={`h-7 rounded-full px-2.5 text-xs ${trendType === "income" ? "gradient-primary" : ""}`}
                  onClick={() => setTrendType("income")}
                >Income</Button>
                <Button
                  size="sm"
                  variant={trendType === "all" ? "default" : "ghost"}
                  className={`h-7 rounded-full px-2.5 text-xs ${trendType === "all" ? "gradient-primary" : ""}`}
                  onClick={() => setTrendType("all")}
                >All</Button>
              </div>
              <div className="flex items-center gap-1 rounded-full border border-border/60 bg-background/40 p-0.5">
                <Button
                  size="sm"
                  variant={trendMode === "30d" ? "default" : "ghost"}
                  className={`h-7 rounded-full px-3 text-xs ${trendMode === "30d" ? "gradient-primary" : ""}`}
                  onClick={() => { setTrendMode("30d"); setMonthOffset(0); }}
                >30 days</Button>
                <Button
                  size="sm"
                  variant={trendMode === "month" ? "default" : "ghost"}
                  className={`h-7 rounded-full px-3 text-xs ${trendMode === "month" ? "gradient-primary" : ""}`}
                  onClick={() => setTrendMode("month")}
                >Monthly</Button>
              </div>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={trend} margin={{ left: -20, right: 8, top: 8 }}>
              <defs>
                <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => compact(v as number)} />
              <Tooltip
                contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                formatter={(v) => inr(v as number)}
              />
              <Area type="monotone" dataKey="amount" stroke="var(--chart-1)" strokeWidth={2} fill="url(#areaFill)" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="border-border/60 gradient-card p-5 shadow-card">
          <div className="mb-4">
            <h3 className="font-display text-base font-semibold">Top Categories</h3>
            <p className="text-xs text-muted-foreground">This month</p>
          </div>
          {catData.length === 0 ? (
            <EmptyState label="No expenses yet this month" />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <RPieChart>
                  <Pie data={catData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {catData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12, fontSize: 12 }}
                    formatter={(v) => inr(v as number)}
                  />
                </RPieChart>
              </ResponsiveContainer>
              <div className="mt-3 space-y-2">
                {catData.map((c, i) => (
                  <div key={c.name} className="flex items-center gap-2 text-xs">
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    <span className="font-medium tabular-nums">{inr(c.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* Budgets + Insights */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/60 gradient-card p-5 lg:col-span-2 shadow-card">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-semibold">Budget Progress</h3>
              <p className="text-xs text-muted-foreground">Monthly limits</p>
            </div>
          </div>
          <div className="space-y-4">
            {budgets.map((b) => {
              const pct = Math.min(100, Math.round((b.spent / b.limit) * 100));
              const over = b.spent > b.limit;
              return (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{b.category}</span>
                    <span className={`tabular-nums ${over ? "text-destructive" : "text-muted-foreground"}`}>
                      {inr(b.spent)} / {inr(b.limit)}
                    </span>
                  </div>
                  <Progress value={pct} className="h-2" />
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="border-border/60 gradient-card p-5 shadow-card">
          <div className="mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-base font-semibold">AI Insights</h3>
          </div>
          <div className="space-y-3">
            {insights.map((i) => (
              <div key={i.id} className="rounded-xl border border-border/50 bg-background/40 p-3">
                <div className="flex items-start gap-2">
                  {i.severity === "warning" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />}
                  {i.severity === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
                  {i.severity === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{i.title}</div>
                    <p className="mt-0.5 text-xs text-muted-foreground">{i.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Recent transactions */}
      <Card className="border-border/60 gradient-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold">Recent Transactions</h3>
            <p className="text-xs text-muted-foreground">Latest activity across accounts</p>
          </div>
        </div>
        <div className="divide-y divide-border/50">
          {txs.slice(0, 8).map((t) => (
            <div key={t.id} className="flex items-center gap-3 py-3">
              <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.type === "income" ? "bg-success/15 text-success" : "bg-muted text-foreground"}`}>
                {t.type === "income" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.merchant}</div>
                <div className="text-xs text-muted-foreground">
                  {t.category} · {new Date(t.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </div>
              </div>
              <div className={`shrink-0 text-sm font-semibold tabular-nums ${t.type === "income" ? "text-success" : ""}`}>
                {t.type === "income" ? "+" : "−"}{inr(t.amount)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({
  label, value, icon, tone, trend,
}: { label: string; value: string; icon: React.ReactNode; tone: "success" | "danger" | "primary" | "accent"; trend: string }) {
  const toneClass = {
    success: "bg-success/15 text-success",
    danger: "bg-destructive/15 text-destructive",
    primary: "bg-primary/15 text-primary",
    accent: "bg-accent/15 text-accent",
  }[tone];
  return (
    <Card className="relative overflow-hidden border-border/60 gradient-card p-5 shadow-card">
      <div className="flex items-start justify-between">
        <div className={`grid h-9 w-9 place-items-center rounded-xl ${toneClass}`}>{icon}</div>
        <span className="text-[11px] font-medium text-muted-foreground">{trend}</span>
      </div>
      <div className="mt-4 text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-numeric text-2xl font-semibold tracking-tight">{value}</div>
    </Card>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border/60 text-xs text-muted-foreground">
      {label}
    </div>
  );
}
