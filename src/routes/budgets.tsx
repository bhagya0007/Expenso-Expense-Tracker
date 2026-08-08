import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { Suspense, useMemo, useState } from "react";
import { api, CATEGORIES } from "@/lib/api";
import { inr } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, AlertTriangle, Sparkles, Pencil, Trash2 } from "lucide-react";
import type { Budget, Category } from "@/lib/types";
import { toast } from "sonner";

const bQO = queryOptions({ queryKey: ["budgets"], queryFn: () => api.listBudgets() });

export const Route = createFileRoute("/budgets")({
  head: () => ({ meta: [{ title: "Budgets — Expenso" }, { name: "description", content: "Set monthly budgets by category and track spend live." }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(bQO); },
  component: () => (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-96 w-full rounded-2xl" /></div>}>
      <BudgetsPage />
    </Suspense>
  ),
});

type Draft = { category: Category; limit: number; spent: number };

function BudgetsPage() {
  const { data: local } = useSuspenseQuery(bQO);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["budgets"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [draft, setDraft] = useState<Draft>({ category: "Food & Dining", limit: 5000, spent: 0 });

  const totalLimit = useMemo(() => local.reduce((s, b) => s + (Number(b.limit) || Number((b as any).amount) || 0), 0), [local]);
  const totalSpent = useMemo(() => local.reduce((s, b) => s + (Number(b.spent) || 0), 0), [local]);
  const overall = totalLimit > 0 ? Math.min(100, (totalSpent / totalLimit) * 100) : 0;

  const createM = useMutation({ mutationFn: (b: Omit<Budget, "id">) => api.createBudget(b), onSuccess: invalidate });
  const updateM = useMutation({ mutationFn: (v: { id: string; patch: Partial<Omit<Budget, "id">> }) => api.updateBudget(v.id, v.patch), onSuccess: invalidate });
  const deleteM = useMutation({ mutationFn: (id: string) => api.deleteBudget(id), onSuccess: invalidate });

  function openCreate() {
    setEditing(null);
    setDraft({ category: "Food & Dining", limit: 5000, spent: 0 });
    setOpen(true);
  }
  function openEdit(b: Budget) {
    const bLimit = Number(b.limit) || Number((b as any).amount) || 5000;
    const bSpent = Number(b.spent) || 0;
    setEditing(b);
    setDraft({ category: b.category, limit: bLimit, spent: bSpent });
    setOpen(true);
  }
  async function save() {
    if (editing) {
      await updateM.mutateAsync({ id: editing.id, patch: draft });
      toast.success("Budget updated");
    } else {
      if (local.some((b) => b.category === draft.category)) return toast.error("Budget for this category already exists");
      await createM.mutateAsync({ category: draft.category, limit: draft.limit, spent: draft.spent, period: "monthly" });
      toast.success("Budget created");
    }
    setOpen(false);
  }
  async function del(id: string) {
    await deleteM.mutateAsync(id);
    toast.success("Budget deleted");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Budgets</h1>
          <p className="text-sm text-muted-foreground">Plan what you spend — gently, category by category.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gradient-primary shadow-glow"><Plus className="mr-1.5 h-4 w-4" />New budget</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit budget" : "Create budget"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label>Category</Label>
                <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as Category })} disabled={!!editing}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Monthly limit (₹)</Label>
                  <CurrencyInput value={draft.limit} onChange={(v) => setDraft({ ...draft, limit: v })} step={500} /></div>
                <div className="grid gap-2"><Label>Spent so far (₹)</Label>
                  <CurrencyInput value={draft.spent} onChange={(v) => setDraft({ ...draft, spent: v })} step={100} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={save} className="gradient-primary">{editing ? "Save" : "Create"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="glass p-5">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Total this month</div>
            <div className="mt-1 font-numeric text-3xl font-semibold">{inr(totalSpent)} <span className="text-base font-normal text-muted-foreground">/ {inr(totalLimit)}</span></div>
          </div>
          <div className="text-right">
            <div className="text-xs uppercase tracking-widest text-muted-foreground">Utilised</div>
            <div className="font-numeric text-2xl font-semibold">{overall.toFixed(0)}%</div>
          </div>
        </div>
        <Progress value={overall} className="mt-4 h-2" />
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {local.map((b) => {
          const limitVal = Number(b.limit) || Number((b as any).amount) || 0;
          const spentVal = Number(b.spent) || 0;
          const pct = limitVal > 0 ? Math.min(100, (spentVal / limitVal) * 100) : 0;
          const over = spentVal > limitVal;
          const warn = pct > 80 && !over;
          return (
            <Card key={b.id} className="glass p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium">{b.category}</div>
                  <div className="text-xs capitalize text-muted-foreground">{b.period}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {over ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-xs text-rose-500 dark:text-rose-300"><AlertTriangle className="h-3 w-3" />Over</span>
                  ) : warn ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-300"><Sparkles className="h-3 w-3" />Watch</span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-300">On track</span>
                  )}
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(b)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => del(b.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-4 flex items-baseline justify-between">
                <div className="font-numeric text-2xl font-semibold">{inr(spentVal)}</div>
                <div className="text-sm text-muted-foreground">of {inr(limitVal)}</div>
              </div>
              <Progress value={pct} className="mt-3 h-2" />
              <div className="mt-2 text-xs text-muted-foreground">{over ? `${inr(spentVal - limitVal)} over budget` : `${inr(limitVal - spentVal)} left`}</div>
            </Card>
          );
        })}
        {local.length === 0 && (
          <Card className="glass col-span-full grid place-items-center gap-2 py-16 text-center text-muted-foreground">
            No budgets yet — create your first one above.
          </Card>
        )}
      </div>
    </div>
  );
}
