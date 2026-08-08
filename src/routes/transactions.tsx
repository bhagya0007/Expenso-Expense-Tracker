import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { api, CATEGORIES, PAYMENT_METHODS } from "@/lib/api";
import { inr } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Suspense, useMemo, useState } from "react";
import {
  ArrowDownRight, ArrowUpRight, Plus, Search, Trash2, Download,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, CalendarDays,
  ArrowDownWideNarrow, ArrowUpWideNarrow, Pencil,
} from "lucide-react";

import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import type { Category, PaymentMethod, Transaction, TransactionType } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const txQO = queryOptions({ queryKey: ["transactions"], queryFn: () => api.listTransactions() });
const acQO = queryOptions({ queryKey: ["accounts"], queryFn: () => api.listAccounts() });

export const Route = createFileRoute("/transactions")({
  loader: ({ context }) => {
    context.queryClient.fetchQuery(txQO);
    context.queryClient.fetchQuery(acQO);
  },
  component: () => (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-96 w-full rounded-2xl" /></div>}>
      <TransactionsPage />
    </Suspense>
  ),
});

const PAGE_SIZE = 15;
type RangeKey = "all" | "7d" | "30d" | "90d" | "ytd";

function TransactionsPage() {
  const { data: txs } = useSuspenseQuery(txQO);
  const { data: accounts } = useSuspenseQuery(acQO);
  const qc = useQueryClient();

  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"all" | "income" | "expense">("all");
  const [range, setRange] = useState<RangeKey>("all");
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [sort, setSort] = useState<"desc" | "asc">("desc");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);

  const availableMonths = useMemo(() => {
    const map = new Map<string, { label: string; key: string }>();
    txs.forEach((t) => {
      const d = new Date(t.date);
      if (isNaN(+d)) return;
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth();
      const key = `${y}-${String(m + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
      if (!map.has(key)) {
        map.set(key, { label, key });
      }
    });
    return Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));
  }, [txs]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const cutoff: Record<RangeKey, number | null> = {
      all: null,
      "7d": now - 7 * 864e5,
      "30d": now - 30 * 864e5,
      "90d": now - 90 * 864e5,
      ytd: +new Date(new Date().getFullYear(), 0, 1),
    };
    const c = cutoff[range];
    const rows = txs.filter((t) => {
      if (tab !== "all" && t.type !== tab) return false;
      if (selectedMonth !== "all") {
        const d = new Date(t.date);
        const mKey = isNaN(+d) ? "" : `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        if (mKey !== selectedMonth) return false;
      }
      if (c && +new Date(t.date) < c) return false;
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        t.merchant.toLowerCase().includes(s) ||
        t.category.toLowerCase().includes(s) ||
        t.paymentMethod.toLowerCase().includes(s)
      );
    });
    rows.sort((a, b) => {
      const da = +new Date(a.date);
      const db = +new Date(b.date);
      return sort === "asc" ? da - db : db - da;
    });
    return rows;
  }, [txs, q, tab, range, selectedMonth, sort]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const income = filtered.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = filtered.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

  const del = useMutation({
    mutationFn: (id: string) => api.deleteTransaction(id),
    onMutate: (id) => {
      qc.setQueryData(["transactions"], (old: Transaction[] = []) => old.filter((t) => t.id !== id));
    },
    onSuccess: () => {
      qc.resetQueries({ queryKey: ["transactions"] });
      qc.resetQueries({ queryKey: ["accounts"] });
      qc.resetQueries({ queryKey: ["insights"] });
      toast.success("Transaction deleted");
    },
  });

  const bulkDel = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api.deleteTransaction(id)));
      return ids.length;
    },
    onMutate: (ids) => {
      const idSet = new Set(ids);
      qc.setQueryData(["transactions"], (old: Transaction[] = []) => old.filter((t) => !idSet.has(t.id)));
    },
    onSuccess: (count) => {
      setSelected(new Set());
      qc.resetQueries({ queryKey: ["transactions"] });
      qc.resetQueries({ queryKey: ["accounts"] });
      qc.resetQueries({ queryKey: ["insights"] });
      toast.success(`Deleted ${count} transaction${count === 1 ? "" : "s"}`);
    },
    onError: () => toast.error("Could not delete selected transactions"),
  });

  const deleteAllMut = useMutation({
    mutationFn: async () => {
      const count = txs.length;
      await api.deleteAllTransactions();
      return count;
    },
    onMutate: () => {
      qc.setQueryData(["transactions"], []);
    },
    onSuccess: (count) => {
      setSelected(new Set());
      qc.setQueryData(["transactions"], []);
      qc.resetQueries({ queryKey: ["transactions"] });
      qc.resetQueries({ queryKey: ["accounts"] });
      qc.resetQueries({ queryKey: ["insights"] });
      toast.success(`Deleted all ${count} transactions`);
    },
    onError: () => toast.error("Could not delete transactions"),
  });

  function toggleAllOnPage(checked: boolean) {
    const next = new Set(selected);
    for (const r of pageRows) checked ? next.add(r.id) : next.delete(r.id);
    setSelected(next);
  }

  function selectAllFiltered() {
    setSelected(new Set(filtered.map((r) => r.id)));
  }


  function exportCSV() {
    const rows = filtered.length ? filtered : txs;
    const header = ["Date", "Name", "Category", "Type", "Amount (INR)", "Payment", "Account"];
    const body = rows.map((t) => [
      new Date(t.date).toLocaleDateString("en-IN"),
      t.merchant, t.category, t.type, t.amount, t.paymentMethod,
      accounts.find((a) => a.id === t.accountId)?.name ?? "",
    ]);
    const csv = [header, ...body].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = `expenso-transactions-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows`);
  }

  const allChecked = pageRows.length > 0 && pageRows.every((r) => selected.has(r.id));

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:flex-wrap sm:justify-between"
      >
        <div className="min-w-0">
          <h1 className="truncate font-display text-2xl font-bold tracking-tight md:text-3xl">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            {filtered.length} of {txs.length} · every rupee, in one place
          </p>
        </div>
        <div className="flex items-center gap-2">
          {txs.length > 0 && (
            <Button
              variant="outline"
              className="rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10"
              disabled={deleteAllMut.isPending}
              onClick={() => {
                if (confirm(`Are you sure you want to delete ALL ${txs.length} transactions? This action cannot be undone.`)) {
                  deleteAllMut.mutate();
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete all
            </Button>
          )}
          <Button variant="outline" onClick={exportCSV} className="rounded-xl">
            <Download className="h-4 w-4" /> Export
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground shadow-glow rounded-xl">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>
            <AddTransactionDialog accounts={accounts} onClose={() => setOpen(false)} />
          </Dialog>
          <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
            {editing && (
              <EditTransactionDialog
                transaction={editing}
                accounts={accounts}
                onClose={() => setEditing(null)}
              />
            )}
          </Dialog>

        </div>
      </motion.div>

      {/* Summary cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-3"
      >
        <MiniCard label="Total inflow" value={inr(income)} tone="success" icon={ArrowDownRight} />
        <MiniCard label="Total outflow" value={inr(expense)} tone="destructive" icon={ArrowUpRight} />
        <MiniCard label="Net" value={inr(income - expense)} tone={income - expense >= 0 ? "success" : "destructive"} icon={CalendarDays} />
      </motion.div>

      {/* Filters bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border-border/60 gradient-card p-3 shadow-card md:p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Tabs value={tab} onValueChange={(v) => { setTab(v as typeof tab); setPage(1); }}>
              <TabsList className="bg-background/40">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
                <TabsTrigger value="expense">Expense</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
                placeholder="Search names, categories, payment methods…"
                className="h-10 border-border/60 bg-background/40 pl-9"
              />
            </div>

            <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(1); }}>
              <SelectTrigger className="h-10 w-full md:w-[170px] rounded-xl border-border/60 bg-background/40">
                <CalendarDays className="h-4 w-4 opacity-70" />
                <SelectValue placeholder="All Months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Months</SelectItem>
                {availableMonths.map((m) => (
                  <SelectItem key={m.key} value={m.key}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={range} onValueChange={(v) => { setRange(v as RangeKey); setPage(1); }}>
              <SelectTrigger className="h-10 w-full md:w-[150px] rounded-xl border-border/60 bg-background/40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="h-10 w-full justify-start gap-2 rounded-xl border-border/60 bg-background/40 px-3 md:w-[140px]"
              onClick={() => { setSort((s) => (s === "desc" ? "asc" : "desc")); setPage(1); }}
            >
              {sort === "desc" ? (
                <><ArrowDownWideNarrow className="h-4 w-4 opacity-70" /> Newest first</>
              ) : (
                <><ArrowUpWideNarrow className="h-4 w-4 opacity-70" /> Oldest first</>
              )}
            </Button>
          </div>
        </Card>
      </motion.div>

      {/* Detailed table */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card className="overflow-hidden border-border/60 gradient-card p-0 shadow-card">
          {selected.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-muted/30 px-4 py-2.5">
              <div className="text-sm">
                <span className="font-semibold">{selected.size}</span>{" "}
                <span className="text-muted-foreground">selected</span>
                {selected.size < filtered.length && (
                  <Button variant="link" size="sm" className="h-auto px-2 py-0" onClick={selectAllFiltered}>
                    Select all {filtered.length}
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={bulkDel.isPending}
                  onClick={() => {
                    if (confirm(`Delete ${selected.size} transaction${selected.size === 1 ? "" : "s"}?`)) {
                      bulkDel.mutate(Array.from(selected));
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete selected
                </Button>
              </div>
            </div>
          )}
          {pageRows.length === 0 ? (

            <div className="grid h-72 place-items-center text-sm text-muted-foreground">
              No transactions match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-background/80 backdrop-blur-xl">
                  <tr className="border-b border-border/60 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-3 w-10">
                      <Checkbox checked={allChecked} onCheckedChange={(v) => toggleAllOnPage(!!v)} />
                    </th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Name</th>
                    <th className="hidden px-4 py-3 md:table-cell">Type</th>
                    <th className="hidden px-4 py-3 md:table-cell">Payment</th>
                    <th className="hidden px-4 py-3 sm:table-cell">Ref / Txn No.</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                    <th className="hidden px-4 py-3 lg:table-cell">Account</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((t) => (
                      <tr
                        key={t.id}
                        className="group border-b border-border/40 transition-colors hover:bg-muted/30"
                      >

                        <td className="px-4 py-3">
                          <Checkbox
                            checked={selected.has(t.id)}
                            onCheckedChange={(v) => {
                              const next = new Set(selected);
                              v ? next.add(t.id) : next.delete(t.id);
                              setSelected(next);
                            }}
                          />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          <div className="font-medium text-foreground">{new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}</div>
                          <div className="text-[11px] text-muted-foreground/80 font-normal">{new Date(t.date).toLocaleDateString("en-IN", { weekday: "long" })}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold">{t.merchant || t.category || "Transaction"}</div>
                          <div className="mt-0.5 text-xs text-muted-foreground">{t.category}</div>
                        </td>
                        <td className="hidden px-4 py-3 md:table-cell">
                          <TypePill type={t.type} />
                        </td>
                        <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{t.paymentMethod}</td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">
                          {t.notes ? (
                            <span className="inline-flex items-center rounded-md bg-muted/60 px-2 py-0.5 font-medium text-foreground/90">
                              {t.notes}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">—</span>
                          )}
                        </td>
                        <td className={`whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums ${t.type === "income" ? "text-success" : ""}`}>
                          {t.type === "income" ? "+" : "−"}{inr(t.amount)}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                          {accounts.find((a) => a.id === t.accountId)?.name ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <Button
                              size="icon" variant="ghost"
                              className="rounded-xl text-muted-foreground hover:text-primary"
                              onClick={() => setEditing(t)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="rounded-xl text-muted-foreground hover:text-destructive"
                              onClick={() => del.mutate(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>

                      </tr>
                    ))}

                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {filtered.length > 0 && (
            <div className="flex flex-col items-center justify-between gap-3 border-t border-border/60 bg-background/40 px-4 py-3 md:flex-row">
              <div className="text-xs text-muted-foreground">
                {selected.size > 0 ? `${selected.size} selected · ` : ""}
                Showing {Math.min(filtered.length, (currentPage - 1) * PAGE_SIZE + 1)}–{Math.min(filtered.length, currentPage * PAGE_SIZE)} of {filtered.length} transactions
              </div>
              <div className="flex items-center gap-1">
                <PagerBtn onClick={() => setPage(1)} disabled={currentPage === 1}><ChevronsLeft className="h-4 w-4" /></PagerBtn>
                <PagerBtn onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></PagerBtn>
                {(() => {
                  const delta = 2;
                  const start = Math.max(1, currentPage - delta);
                  const end = Math.min(totalPages, currentPage + delta);
                  const pages = [];
                  for (let i = start; i <= end; i++) pages.push(i);
                  return pages;
                })().map((p) => (
                  <button
                    key={p} onClick={() => setPage(p)}
                    className={`h-8 min-w-8 rounded-lg px-2.5 text-xs font-medium transition-colors ${p === currentPage ? "gradient-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-muted"}`}
                  >
                    {p}
                  </button>
                ))}
                <PagerBtn onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></PagerBtn>
                <PagerBtn onClick={() => setPage(totalPages)} disabled={currentPage === totalPages}><ChevronsRight className="h-4 w-4" /></PagerBtn>
              </div>
            </div>
          )}
        </Card>
      </motion.div>
    </div>
  );
}

function MiniCard({
  label, value, tone, icon: Icon,
}: { label: string; value: string; tone: "success" | "destructive"; icon: React.ComponentType<{ className?: string }> }) {
  const t = tone === "success" ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive";
  return (
    <Card className="gradient-card flex items-center gap-3 border-border/60 p-4 shadow-card">
      <div className={`grid h-10 w-10 place-items-center rounded-xl ${t}`}><Icon className="h-4 w-4" /></div>
      <div className="min-w-0">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-numeric text-xl font-semibold">{value}</div>
      </div>
    </Card>
  );
}

function TypePill({ type }: { type: Transaction["type"] }) {
  const cls = type === "income"
    ? "border-success/30 bg-success/10 text-success"
    : "border-destructive/30 bg-destructive/10 text-destructive";
  return <Badge variant="outline" className={`rounded-md font-medium capitalize ${cls}`}>{type}</Badge>;
}

function PagerBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <Button size="icon" variant="ghost" onClick={onClick} disabled={disabled} className="h-8 w-8 rounded-lg">
      {children}
    </Button>
  );
}

function AddTransactionDialog({ accounts, onClose }: { accounts: { id: string; name: string }[]; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<TransactionType>("expense");
  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [category, setCategory] = useState<Category>("Food & Dining");
  const [customCategory, setCustomCategory] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "__none__");
  const [dateTime, setDateTime] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  const isOther = category === "Other";
  const finalCategory: Category = (isOther && customCategory.trim() ? customCategory.trim() : category) as Category;
  const canSave = !!amount && !!merchant && !!dateTime && (!isOther || !!customCategory.trim());

  const create = useMutation({
    mutationFn: () =>
      api.createTransaction({
        type, amount: Number(amount),
        merchant: merchant.trim() || finalCategory,
        category: finalCategory,
        notes: notes.trim() || undefined,
        paymentMethod: method,
        accountId: accountId === "__none__" ? "" : accountId,
        date: new Date(dateTime).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
      toast.success("Transaction added");
      onClose();
      setAmount(""); setMerchant(""); setNotes(""); setCustomCategory("");
    },
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Add Transaction</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-2">
          <Label>Amount (₹)</Label>
          <Input type="number" step="any" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Date & time</Label>
          <Input type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Merchant Name</Label>
          <Input placeholder="e.g. Swiggy" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Reference / Txn No. (optional)</Label>
          <Input placeholder="e.g. TXN100098 or UPI/123456" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Payment</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isOther && (
          <div className="grid gap-2">
            <Label>Custom category</Label>
            <Input
              placeholder="e.g. Pet care"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label>Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No account</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          className="gradient-primary text-primary-foreground"
          disabled={!canSave || create.isPending}
          onClick={() => create.mutate()}
        >
          {create.isPending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditTransactionDialog({
  transaction,
  accounts,
  onClose,
}: {
  transaction: Transaction;
  accounts: { id: string; name: string }[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [amount, setAmount] = useState(String(transaction.amount));
  const [merchant, setMerchant] = useState(transaction.merchant);
  const [notes, setNotes] = useState(transaction.notes || "");
  const knownCategory = (CATEGORIES as readonly string[]).includes(transaction.category);
  const [category, setCategory] = useState<Category>(
    (knownCategory ? transaction.category : "Other") as Category,
  );
  const [customCategory, setCustomCategory] = useState(knownCategory ? "" : transaction.category);
  const [method, setMethod] = useState<PaymentMethod>(transaction.paymentMethod);
  const [accountId, setAccountId] = useState<string>(transaction.accountId || "__none__");
  const [date, setDate] = useState<string>(() => {
    const d = new Date(transaction.date);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });

  const isOther = category === "Other";
  const finalCategory: Category = (isOther && customCategory.trim()
    ? customCategory.trim()
    : category) as Category;
  const canSave = !!amount && !!merchant && (!isOther || !!customCategory.trim());

  const update = useMutation({
    mutationFn: () =>
      api.updateTransaction(transaction.id, {
        type,
        amount: Number(amount),
        merchant: merchant.trim() || finalCategory,
        category: finalCategory,
        notes: notes.trim() || undefined,
        paymentMethod: method,
        accountId: accountId === "__none__" ? "" : accountId,
        date: new Date(date).toISOString(),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transactions"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["insights"] });
      toast.success("Transaction updated");
      onClose();
    },
    onError: () => toast.error("Could not update transaction"),
  });

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Edit Transaction</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="expense">Expense</TabsTrigger>
            <TabsTrigger value="income">Income</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid gap-2">
          <Label>Amount (₹)</Label>
          <Input type="number" step="any" placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Merchant Name</Label>
          <Input placeholder="e.g. Swiggy" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Reference / Txn No.</Label>
          <Input placeholder="e.g. TXN100098 or UPI/123456" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label>Date & time</Label>
          <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Payment</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {isOther && (
          <div className="grid gap-2">
            <Label>Custom category</Label>
            <Input
              placeholder="e.g. Pet care"
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              autoFocus
            />
          </div>
        )}
        <div className="grid gap-2">
          <Label>Account</Label>
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">No account</SelectItem>
              {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button
          className="gradient-primary text-primary-foreground"
          disabled={!canSave || update.isPending}
          onClick={() => update.mutate()}
        >
          {update.isPending ? "Saving…" : "Save changes"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
