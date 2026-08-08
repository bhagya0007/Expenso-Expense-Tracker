import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { inr, compact } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownRight, ArrowUpRight, Sparkles, Wallet, PiggyBank,
  ShieldCheck, AlertTriangle, Info, CheckCircle2, ChevronLeft, ChevronRight,
  Plus, CalendarDays, TrendingUp, Layers, ArrowRight
} from "lucide-react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
  Cell, Pie, PieChart as RPieChart,
} from "recharts";
import { Suspense, useMemo, useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { ExpensoAIChat } from "@/ai/components/expenso-ai-chat";

const txQO = queryOptions({ queryKey: ["transactions"], queryFn: () => api.listTransactions() });
const acQO = queryOptions({ queryKey: ["accounts"], queryFn: () => api.listAccounts() });
const bdQO = queryOptions({ queryKey: ["budgets"], queryFn: () => api.listBudgets() });
const inQO = queryOptions({ queryKey: ["insights"], queryFn: () => api.listInsights() });

export const Route = createFileRoute("/")({
  loader: ({ context }) => {
    context.queryClient.fetchQuery(txQO);
    context.queryClient.fetchQuery(acQO);
    context.queryClient.fetchQuery(bdQO);
    context.queryClient.fetchQuery(inQO);
  },
  component: () => (
    <Suspense fallback={<DashboardSkeleton />}>
      <Dashboard />
    </Suspense>
  ),
});

function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 md:p-8">
      <Skeleton className="h-16 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-3xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-80 rounded-3xl" />
        <Skeleton className="h-80 rounded-3xl" />
      </div>
    </div>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userName = user?.displayName || user?.email?.split("@")[0] || "User";

  const { data: txs } = useSuspenseQuery(txQO);
  const { data: accounts } = useSuspenseQuery(acQO);
  const { data: budgets } = useSuspenseQuery(bdQO);
  const { data: insights } = useSuspenseQuery(inQO);

  const [trendMode, setTrendMode] = useState<"30d" | "month">("30d");
  const [trendType, setTrendType] = useState<"expense" | "income" | "all">("expense");
  const [monthOffset, setMonthOffset] = useState(0);
  const [activeTxTab, setActiveTxTab] = useState<"all" | "income" | "expense">("all");
  const [isMiniChatOpen, setIsMiniChatOpen] = useState(false);

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

  const getTxDateKey = (dateInput: any) => {
    if (!dateInput) return "";

    // Handle plain string YYYY-MM-DD or DD-MM-YYYY without timezone distortion
    if (typeof dateInput === "string") {
      const trimmed = dateInput.trim();
      const plainYmd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
      if (plainYmd) {
        return `${plainYmd[1]}-${plainYmd[2].padStart(2, "0")}-${plainYmd[3].padStart(2, "0")}`;
      }
      const plainDdmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
      if (plainDdmmyyyy) {
        return `${plainDdmmyyyy[3]}-${plainDdmmyyyy[2].padStart(2, "0")}-${plainDdmmyyyy[1].padStart(2, "0")}`;
      }
    }

    // JS Date parsing fallback (Local Timezone extraction)
    let dt: Date;
    if (dateInput instanceof Date) {
      dt = dateInput;
    } else if (dateInput && typeof dateInput === "object" && "seconds" in dateInput) {
      dt = new Date(dateInput.seconds * 1000);
    } else {
      dt = new Date(String(dateInput));
    }

    if (isNaN(+dt)) {
      return String(dateInput).slice(0, 10);
    }

    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  };

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = txs.filter((t) => getTxDateKey(t.date).startsWith(currentMonthKey));
  const income = thisMonth
    .filter((t) => {
      const r = (t.type || "expense").toString().toLowerCase().trim();
      return r === "income" || r === "credit" || r === "cr" || r === "inflow";
    })
    .reduce((s, t) => s + t.amount, 0);
  const expenses = thisMonth
    .filter((t) => {
      const r = (t.type || "expense").toString().toLowerCase().trim();
      return r !== "income" && r !== "credit" && r !== "cr" && r !== "inflow";
    })
    .reduce((s, t) => s + t.amount, 0);
  const savings = income - expenses;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;

  const accountsBalance = accounts.reduce((s, a) => s + a.balance, 0);
  const netCashflow = txs.reduce((s, t) => {
    const r = (t.type || "expense").toString().toLowerCase().trim();
    const isInc = r === "income" || r === "credit" || r === "cr" || r === "inflow";
    return s + (isInc ? t.amount : -t.amount);
  }, 0);
  const balance = accounts.length > 0 ? accountsBalance : netCashflow;

  const viewedMonth = useMemo(() => {
    return new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  }, [monthOffset, now]);

  const trend = useMemo(() => {
    const filterTx = (t: (typeof txs)[0], key: string) => {
      const txKey = getTxDateKey(t.date);
      if (txKey !== key) return false;

      const rawType = (t.type || "expense").toString().toLowerCase().trim();
      const isIncome = rawType === "income" || rawType === "credit" || rawType === "cr" || rawType === "inflow";
      const isExpense = !isIncome;

      if (trendType === "expense") return isExpense;
      if (trendType === "income") return isIncome;
      return true;
    };

    if (trendMode === "month") {
      const y = viewedMonth.getFullYear();
      const m = viewedMonth.getMonth();
      const isCurrentMonth = y === now.getFullYear() && m === now.getMonth();
      // For current month, plot days up to current day so future unelapsed days don't flatten the scale
      const totalDaysInMonth = new Date(y, m + 1, 0).getDate();
      const daysToPlot = isCurrentMonth ? Math.min(totalDaysInMonth, now.getDate()) : totalDaysInMonth;

      return Array.from({ length: daysToPlot }).map((_, i) => {
        const dayNum = i + 1;
        const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
        const total = txs
          .filter((t) => filterTx(t, key))
          .reduce((s, t) => s + t.amount, 0);
        const dObj = new Date(y, m, dayNum);
        return {
          day: dObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
          dayNum: String(dayNum),
          amount: total,
          displayAmount: total > 0 ? Math.pow(total, 0.55) : 0,
          fullDate: dObj.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
        };
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
      return {
        day: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
        dayNum: String(dayNum),
        amount: total,
        displayAmount: total > 0 ? Math.pow(total, 0.55) : 0,
        fullDate: d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }),
      };
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

  const totalCatSpending = catData.reduce((s, c) => s + c.value, 0) || 1;
  const chartColors = ["#38bdf8", "#818cf8", "#f472b6", "#fb7185", "#34d399"];

  const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonth = txs.filter((t) =>
    new Date(t.date).getMonth() === prevMonthDate.getMonth() &&
    new Date(t.date).getFullYear() === prevMonthDate.getFullYear()
  );
  const prevIncome = prevMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const prevExpenses = prevMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  let incomeTrendText = "+0%";
  if (income > 0 && prevIncome > 0) {
    const diff = Math.round(((income - prevIncome) / prevIncome) * 100);
    incomeTrendText = `${diff >= 0 ? "+" : ""}${diff}% than last month`;
  } else if (income > 0) {
    incomeTrendText = "Active this month";
  }

  let expenseTrendText = "+0%";
  if (expenses > 0 && prevExpenses > 0) {
    const diff = Math.round(((expenses - prevExpenses) / prevExpenses) * 100);
    expenseTrendText = `${diff >= 0 ? "+" : ""}${diff}% than last month`;
  } else if (expenses > 0) {
    expenseTrendText = "Active this month";
  }

  let balanceTrendText = "+0%";
  if (prevIncome > 0 || prevExpenses > 0) {
    const prevNet = prevIncome - prevExpenses;
    const currentNet = income - expenses;
    if (prevNet !== 0) {
      const diff = Math.round(((currentNet - prevNet) / Math.abs(prevNet)) * 100);
      balanceTrendText = `${diff >= 0 ? "+" : ""}${diff}% than last month`;
    }
  }

  const [insightIndex, setInsightIndex] = useState(0);

  const insightList = useMemo(() => {
    const list = [];
    if (catData.length > 0) {
      const topCat = catData[0];
      const savingsEstimate = Math.round(topCat.value * 0.2);
      list.push(`You're spending 18% more on ${topCat.name} compared to last month. Consider setting a budget of ${inr(Math.max(1000, topCat.value - savingsEstimate))} to save ${inr(savingsEstimate)}.`);
    }
    if (savingsRate > 0) {
      list.push(`Your net savings rate is ${savingsRate}% this month. You are on track to build a solid emergency buffer.`);
    }
    list.push("Review recurring bill commitments weekly to eliminate unutilized merchant subscriptions.");
    return list;
  }, [catData, savingsRate]);

  const currentInsightText = insightList[insightIndex % insightList.length];
  const topCategoryName = catData[0]?.name || "Dining Out";
  const potentialSavings = Math.round((catData[0]?.value || 15000) * 0.2);

  const filteredHistory = useMemo(() => {
    if (activeTxTab === "income") return txs.filter((t) => t.type === "income").slice(0, 6);
    if (activeTxTab === "expense") return txs.filter((t) => t.type === "expense").slice(0, 6);
    return txs.slice(0, 6);
  }, [txs, activeTxTab]);

  return (
    <div className="space-y-4 p-4 sm:p-5 max-w-7xl mx-auto">
      {/* Top Greeting Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-foreground">
          Hi {userName}, Welcome back!
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Here is your financial summary across all your linked accounts.
        </p>
      </div>

      {/* Top Total Balance Banner Card (Reference Design matching image) */}
      <Card className="border border-border/60 bg-card/90 dark:bg-slate-900/90 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left Side: Big Total Balance Display */}
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-muted-foreground uppercase">
            <Wallet className="h-3.5 w-3.5 text-indigo-400" />
            <span>Total Balance</span>
          </div>
          <div className="font-numeric text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-foreground">
            {inr(balance)}
          </div>
        </div>

        {/* Right Side: Account Badges */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none shrink-0">
          {(accounts.length > 0
            ? accounts
            : [
                { id: "1", name: "Amazon Pay Wallet", type: "WALLET", balance: 641.71 },
                { id: "2", name: "HDFC Bank", type: "BANK", balance: 14078.31 },
                { id: "3", name: "Cash", type: "CASH", balance: 1570 },
              ]
          ).map((acc) => (
            <div
              key={acc.id}
              className="rounded-xl border border-border/60 bg-background/50 dark:bg-slate-950/60 p-2.5 min-w-[125px] space-y-0.5 backdrop-blur"
            >
              <span className="text-[9px] font-extrabold tracking-wider text-muted-foreground uppercase">
                {acc.type || "ACCOUNT"}
              </span>
              <div className="text-xs font-bold text-foreground truncate">{acc.name}</div>
              <div className="text-xs font-semibold text-muted-foreground font-numeric">
                {inr(acc.balance)}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* 3 Secondary Metric Cards (No Percentage Badges) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* Card 1: Total Income */}
        <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-xl shadow-sm transition-all hover:border-emerald-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Total Income</span>
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-numeric text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            {inr(income)}
          </div>
        </Card>

        {/* Card 2: Total Expenses */}
        <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-xl shadow-sm transition-all hover:border-rose-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Total Expenses</span>
            <div className="h-8 w-8 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-numeric text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            {inr(expenses)}
          </div>
        </Card>

        {/* Card 3: Total Savings */}
        <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-xl shadow-sm transition-all hover:border-indigo-500/40">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Total Savings</span>
            <div className="h-8 w-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 font-numeric text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">
            {inr(savings)}
          </div>
        </Card>
      </div>

      {/* Middle Section (Income/Spending Flow + Top Categories Donut Activity) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left: Spending Trend Chart */}
        <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm lg:col-span-2 space-y-3">
          <div className="space-y-2 pb-2 border-b border-border/40">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold text-foreground">Spending Trend</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {trendMode === "30d"
                    ? "Daily spending pattern over the past 30 days"
                    : `Daily spending pattern for ${viewedMonth.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}`}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {trendMode === "month" && (
                  <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 backdrop-blur p-0.5">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full text-foreground hover:bg-muted"
                      onClick={() => setMonthOffset((o) => o - 1)}
                    >
                      <ChevronLeft className="h-3 w-3" />
                    </Button>
                    <span className="px-1.5 text-[11px] font-semibold tabular-nums text-foreground">
                      {viewedMonth.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 rounded-full text-foreground hover:bg-muted"
                      onClick={() => setMonthOffset((o) => Math.min(0, o + 1))}
                      disabled={monthOffset >= 0}
                    >
                      <ChevronRight className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 backdrop-blur p-0.5 text-[11px]">
                  <Button
                    size="sm"
                    variant={trendType === "expense" ? "default" : "ghost"}
                    className={`h-6 rounded-full px-2 text-[11px] font-medium ${trendType === "expense" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setTrendType("expense")}
                  >
                    Expenses
                  </Button>
                  <Button
                    size="sm"
                    variant={trendType === "income" ? "default" : "ghost"}
                    className={`h-6 rounded-full px-2 text-[11px] font-medium ${trendType === "income" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setTrendType("income")}
                  >
                    Income
                  </Button>
                  <Button
                    size="sm"
                    variant={trendType === "all" ? "default" : "ghost"}
                    className={`h-6 rounded-full px-2 text-[11px] font-medium ${trendType === "all" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setTrendType("all")}
                  >
                    All
                  </Button>
                </div>

                <div className="flex items-center gap-0.5 rounded-full border border-border/60 bg-muted/40 backdrop-blur p-0.5 text-[11px]">
                  <Button
                    size="sm"
                    variant={trendMode === "30d" ? "default" : "ghost"}
                    className={`h-6 rounded-full px-2 text-[11px] font-medium ${trendMode === "30d" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => { setTrendMode("30d"); setMonthOffset(0); }}
                  >
                    30 Days
                  </Button>
                  <Button
                    size="sm"
                    variant={trendMode === "month" ? "default" : "ghost"}
                    className={`h-6 rounded-full px-2 text-[11px] font-medium ${trendMode === "month" ? "bg-emerald-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    onClick={() => setTrendMode("month")}
                  >
                    Monthly
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={215}>
            <AreaChart data={trend} margin={{ left: 5, right: 15, top: 15, bottom: 5 }}>
              <defs>
                <linearGradient id="emeraldTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.25} vertical={false} />
              <XAxis
                dataKey="day"
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))", strokeOpacity: 0.5 }}
                tick={({ x, y, payload }) => (
                  <text
                    x={x}
                    y={y + 12}
                    fill="currentColor"
                    className="text-slate-700 dark:text-slate-300 font-semibold text-xs"
                    textAnchor="middle"
                  >
                    {payload.value}
                  </text>
                )}
                minTickGap={28}
                height={28}
              />
              <YAxis
                width={45}
                tickLine={false}
                axisLine={false}
                tick={({ x, y, payload }) => {
                  const val = payload.value as number;
                  const realVal = val > 0 ? Math.round(Math.pow(val, 1 / 0.55)) : 0;
                  return (
                    <text
                      x={x}
                      y={y + 4}
                      fill="currentColor"
                      className="text-slate-500 dark:text-slate-400 font-semibold text-xs"
                      textAnchor="end"
                    >
                      {`₹${compact(realVal)}`}
                    </text>
                  );
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-xl border border-border/80 bg-slate-900/95 backdrop-blur-md px-3 py-1.5 shadow-xl text-center">
                        <div className="font-numeric text-xs font-extrabold text-white">
                          {inr(data.amount)}
                        </div>
                        <div className="text-[10px] font-medium text-slate-400 mt-0.5">
                          {data.fullDate || data.day}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="linear"
                dataKey="displayAmount"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#emeraldTrendFill)"
                dot={({ cx, cy, payload }) => {
                  if (!cx || !cy) return null;
                  const hasValue = payload && payload.amount > 0;
                  return (
                    <circle
                      key={`${payload.day}-${cx}-${cy}`}
                      cx={cx}
                      cy={cy}
                      r={hasValue ? 4.5 : 2}
                      fill={hasValue ? "#10b981" : "#059669"}
                      stroke={hasValue ? "#ffffff" : "none"}
                      strokeWidth={hasValue ? 2 : 0}
                      className={hasValue ? "drop-shadow-md" : "opacity-40"}
                    />
                  );
                }}
                activeDot={{ r: 6.5, fill: "#10b981", stroke: "#ffffff", strokeWidth: 2.5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Right: Activity / Top Categories Donut Chart */}
        <Card className="border border-border/60 bg-card/70 backdrop-blur p-4 sm:p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">Activity Breakdown</h3>
                <p className="text-[11px] text-muted-foreground">Top spending categories this month</p>
              </div>
              <Badge variant="outline" className="text-[10px] rounded-md px-1.5 py-0">
                This Month
              </Badge>
            </div>

            {catData.length === 0 ? (
              <div className="h-36 grid place-items-center rounded-xl border border-dashed border-border/60 my-2 text-xs text-muted-foreground">
                No expense category records found
              </div>
            ) : (
              <div className="relative my-2 flex items-center justify-center">
                <ResponsiveContainer width="100%" height={140}>
                  <RPieChart>
                    <Pie data={catData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={62} paddingAngle={4}>
                      {catData.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        borderColor: "hsl(var(--border))",
                        borderRadius: "10px",
                        fontSize: "11px",
                        color: "hsl(var(--popover-foreground))",
                        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                      }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
                      labelStyle={{ color: "hsl(var(--popover-foreground))", fontWeight: 600 }}
                      formatter={(v) => inr(v as number)}
                    />
                  </RPieChart>
                </ResponsiveContainer>

                {/* Donut Center Display */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="font-numeric text-base font-extrabold text-foreground">{inr(expenses)}</span>
                  <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-medium">Spent</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5 pt-2 border-t border-border/40">
            {catData.map((c, i) => {
              const share = Math.round((c.value / totalCatSpending) * 100);
              return (
                <div key={c.name} className="flex items-center justify-between text-xs py-0.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2 w-2 rounded-full shrink-0" style={{ background: chartColors[i % chartColors.length] }} />
                    <span className="truncate text-foreground font-medium">{c.name}</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className="text-muted-foreground text-[10px] font-semibold">{share}%</span>
                    <span className="font-semibold tabular-nums text-foreground text-xs">{inr(c.value)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* AI Insight Carousel Row */}
      <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Sparkles className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-foreground">AI Insight</h3>
                <p className="text-[11px] text-muted-foreground">Personalized insight just for you</p>
              </div>
            </div>

            {/* Left / Right Arrow Buttons */}
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-full border-border/60 bg-background/50 text-foreground hover:bg-muted"
                onClick={() => setInsightIndex((i) => (i - 1 + insightList.length) % insightList.length)}
                aria-label="Previous insight"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-7 w-7 rounded-full border-border/60 bg-background/50 text-foreground hover:bg-muted"
                onClick={() => setInsightIndex((i) => (i + 1) % insightList.length)}
                aria-label="Next insight"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Carousel Banner */}
          <div className="relative overflow-hidden rounded-xl p-3 bg-emerald-500/10 dark:bg-emerald-950/40 border border-emerald-500/30 flex items-start gap-2.5 transition-all">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
              <TrendingUp className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-emerald-950 dark:text-emerald-200 leading-relaxed">
                {currentInsightText}
              </p>
            </div>
          </div>

          {/* Pagination Dots */}
          <div className="flex items-center justify-center gap-1.5 pt-0.5">
            {insightList.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setInsightIndex(idx)}
                className={`h-1.5 rounded-full transition-all ${
                  insightIndex === idx ? "w-5 bg-indigo-500" : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
                }`}
                aria-label={`Go to slide ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <div className="pt-2 border-t border-border/40 flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/insights" })}
            className="rounded-xl px-5 h-7 text-xs font-semibold bg-background/50 border-border/60 hover:bg-muted text-foreground"
          >
            View All Insights <ArrowRight className="ml-1.5 h-3 w-3" />
          </Button>
        </div>
      </Card>

      {/* Bottom Section (Transaction History + Budget Goals) */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left Column: Transaction History Table */}
        <Card className="border border-border/60 bg-card/70 backdrop-blur p-4 sm:p-5 rounded-2xl shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-base font-bold text-foreground">Transaction History</h3>
              <p className="text-[11px] text-muted-foreground">Recent ledger activity across all accounts</p>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-0.5 bg-background/50 border border-border/60 p-0.5 rounded-full text-xs">
              <Button
                size="sm"
                variant={activeTxTab === "all" ? "default" : "ghost"}
                className={`h-6 rounded-full px-2.5 text-[11px] ${activeTxTab === "all" ? "bg-indigo-600 text-white" : ""}`}
                onClick={() => setActiveTxTab("all")}
              >
                Recently
              </Button>
              <Button
                size="sm"
                variant={activeTxTab === "income" ? "default" : "ghost"}
                className={`h-6 rounded-full px-2.5 text-[11px] ${activeTxTab === "income" ? "bg-indigo-600 text-white" : ""}`}
                onClick={() => setActiveTxTab("income")}
              >
                Income
              </Button>
              <Button
                size="sm"
                variant={activeTxTab === "expense" ? "default" : "ghost"}
                className={`h-6 rounded-full px-2.5 text-[11px] ${activeTxTab === "expense" ? "bg-indigo-600 text-white" : ""}`}
                onClick={() => setActiveTxTab("expense")}
              >
                Expenses
              </Button>
            </div>
          </div>

          <div className="divide-y divide-border/40">
            {filteredHistory.slice(0, 5).map((t) => {
              const dateObj = new Date(t.date);
              const formattedDate = isNaN(+dateObj) ? t.date : dateObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
              const dayOfWeek = isNaN(+dateObj) ? "" : dateObj.toLocaleDateString("en-IN", { weekday: "long" });

              return (
                <div key={t.id} className="flex items-center justify-between py-2.5 group hover:bg-muted/20 px-1.5 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${t.type === "income" ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-foreground"}`}>
                      {t.type === "income" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-bold text-foreground">{t.merchant || t.category || "Transaction"}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 rounded">
                          {t.category}
                        </Badge>
                        <span>&bull;</span>
                        <span>{formattedDate} ({dayOfWeek})</span>
                      </div>
                    </div>
                  </div>

                  <div className={`text-xs font-bold tabular-nums shrink-0 ${t.type === "income" ? "text-emerald-500" : "text-foreground"}`}>
                    {t.type === "income" ? "+" : "-"}{inr(t.amount)}
                  </div>
                </div>
              );
            })}

            {filteredHistory.length === 0 && (
              <div className="py-8 text-center text-xs text-muted-foreground">
                No transaction history records found.
              </div>
            )}
          </div>

          <div className="pt-2 border-t border-border/40 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate({ to: "/transactions" })}
              className="text-xs font-semibold text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 h-7"
            >
              View Full Ledger <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </Card>

        {/* Right Column: Budget Goals Progress */}
        <Card className="border border-border/60 bg-card/70 backdrop-blur p-4 sm:p-5 rounded-2xl shadow-sm space-y-3 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-bold text-foreground">My Budget Goals</h3>
                <p className="text-[11px] text-muted-foreground">Track allocated monthly limits</p>
              </div>

              <Button
                size="sm"
                onClick={() => navigate({ to: "/budgets" })}
                className="h-7 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="mr-1 h-3 w-3" /> Add Budget
              </Button>
            </div>

            <div className="space-y-2.5">
              {budgets.slice(0, 3).map((b) => {
                const limitVal = Number(b.limit) || Number((b as any).amount) || 5000;
                const spentVal = Number(b.spent) || 0;
                const pct = Math.min(100, Math.max(0, Math.round((spentVal / limitVal) * 100)));
                const isOver = spentVal > limitVal;

                return (
                  <div key={b.id} className="space-y-1.5 p-2.5 rounded-xl bg-background/50 border border-border/40">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-foreground">{b.category}</span>
                        {isOver && (
                          <Badge className="bg-rose-500/15 text-rose-500 text-[9px] px-1 py-0 border-none">
                            Over Limit
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-medium text-[11px]">
                          {inr(spentVal)} / {inr(limitVal)}
                        </span>
                        <span className="font-bold text-indigo-500 dark:text-indigo-400 min-w-[28px] text-right text-[11px]">
                          {pct}%
                        </span>
                      </div>
                    </div>
                    <Progress value={pct} className="h-1.5 rounded-full" />
                  </div>
                );
              })}

              {budgets.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                  No active category budgets set. Click "+ Add Budget" to create your first limit!
                </div>
              )}
            </div>
          </div>

          {/* AI Insights Card Footer */}
          <div className="pt-2 border-t border-border/40">
            <div className="p-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-500/20 flex items-start gap-2.5">
              <div className="h-7 w-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-foreground">Expenso AI Coach Tip</h4>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                  {insights[0]?.body || "Keep your savings rate above 20% by cutting non-essential subscriptions and setting category limits."}
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Mini Floating AI Agent Popover Chat Window */}
      {isMiniChatOpen && (
        <div className="fixed bottom-20 right-4 sm:right-6 z-50 w-[92vw] sm:w-[380px] h-[480px] shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-300">
          <ExpensoAIChat
            isMini={true}
            onClose={() => setIsMiniChatOpen(false)}
            onExpand={() => navigate({ to: "/insights" })}
          />
        </div>
      )}

      {/* Floating Static AI Insights Logo Button (Bottom Right) */}
      <button
        onClick={() => setIsMiniChatOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 group flex items-center gap-2.5 p-1.5 pr-4 rounded-full bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-md border border-cyan-500/40 shadow-2xl hover:scale-105 active:scale-95 transition-all duration-300 cursor-pointer"
        title="Toggle Expenso AI Assistant"
      >
        <div className="relative">
          <div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 to-cyan-400 opacity-75 blur-sm group-hover:opacity-100 transition-opacity" />
          <img
            src="/ai-insights-logo.png"
            alt="AI Insights"
            className="relative h-11 w-11 rounded-full object-cover shadow-md bg-white"
          />
        </div>
        <span className="text-xs font-extrabold bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-300 bg-clip-text text-transparent">
          {isMiniChatOpen ? "Close AI" : "AI Insights"}
        </span>
      </button>
    </div>
  );
}
