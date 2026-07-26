import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useMutation } from "@tanstack/react-query";
import { Suspense, useState } from "react";
import { api } from "@/lib/api";
import { inr } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Building2, CreditCard, Wallet, Banknote, Plus, TrendingUp, TrendingDown, Pencil, Trash2 } from "lucide-react";
import type { Account, AccountType } from "@/lib/types";
import { toast } from "sonner";

const acQO = queryOptions({ queryKey: ["accounts"], queryFn: () => api.listAccounts() });

export const Route = createFileRoute("/accounts")({
  head: () => ({ meta: [{ title: "Accounts — Expenso" }, { name: "description", content: "Manage your linked bank, card, wallet and cash accounts." }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(acQO); },
  component: () => (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-96 w-full rounded-2xl" /></div>}>
      <AccountsPage />
    </Suspense>
  ),
});

const iconFor = (t: AccountType) =>
  t === "Bank" ? Building2 : t === "Credit Card" || t === "Debit Card" ? CreditCard : t === "Cash" ? Banknote : Wallet;

const emptyDraft: Omit<Account, "id"> = { name: "", type: "Bank", balance: 0, mask: "" };

function AccountsPage() {
  const { data: local } = useSuspenseQuery(acQO);
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["accounts"] });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [draft, setDraft] = useState<Omit<Account, "id">>(emptyDraft);

  const total = local.reduce((s, a) => s + a.balance, 0);
  const assets = local.filter((a) => a.balance >= 0).reduce((s, a) => s + a.balance, 0);
  const liabilities = local.filter((a) => a.balance < 0).reduce((s, a) => s + a.balance, 0);

  const createM = useMutation({ mutationFn: (a: Omit<Account, "id">) => api.createAccount(a), onSuccess: invalidate });
  const updateM = useMutation({ mutationFn: (v: { id: string; patch: Partial<Omit<Account, "id">> }) => api.updateAccount(v.id, v.patch), onSuccess: invalidate });
  const deleteM = useMutation({ mutationFn: (id: string) => api.deleteAccount(id), onSuccess: invalidate });

  function openCreate() { setEditing(null); setDraft(emptyDraft); setOpen(true); }
  function openEdit(a: Account) {
    setEditing(a);
    setDraft({ name: a.name, type: a.type, balance: a.balance, mask: a.mask ?? "" });
    setOpen(true);
  }
  async function save() {
    if (!draft.name) return toast.error("Give the account a name");
    if (editing) {
      await updateM.mutateAsync({ id: editing.id, patch: draft });
      toast.success("Account updated");
    } else {
      await createM.mutateAsync(draft);
      toast.success("Account added");
    }
    setOpen(false);
  }
  async function del(id: string) {
    await deleteM.mutateAsync(id);
    toast.success("Account removed");
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold tracking-tight">Accounts</h1>
          <p className="text-sm text-muted-foreground">Every rupee, gathered in one warm place.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="gradient-primary shadow-glow"><Plus className="mr-1.5 h-4 w-4" />Add account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit account" : "Link a new account"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label>Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="ICICI Salary" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Type</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as AccountType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(["Bank", "Credit Card", "Debit Card", "Wallet", "UPI", "Cash"] as AccountType[]).map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label>Balance</Label>
                  <CurrencyInput value={draft.balance} onChange={(v) => setDraft({ ...draft, balance: v })} step={500} allowNegative /></div>
              </div>
              <div className="grid gap-2"><Label>Mask (optional)</Label>
                <Input value={draft.mask} onChange={(e) => setDraft({ ...draft, mask: e.target.value })} placeholder="•• 1234" /></div>
            </div>
            <DialogFooter><Button onClick={save} className="gradient-primary">{editing ? "Save" : "Add"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="glass p-5">
          <div className="text-xs uppercase tracking-widest text-muted-foreground">Net worth</div>
          <div className="mt-1 font-numeric text-3xl font-semibold">{inr(total)}</div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" />Assets</div>
          <div className="mt-1 font-numeric text-3xl font-semibold text-emerald-600 dark:text-emerald-400">{inr(assets)}</div>
        </Card>
        <Card className="glass p-5">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-muted-foreground"><TrendingDown className="h-3.5 w-3.5 text-rose-500" />Liabilities</div>
          <div className="mt-1 font-numeric text-3xl font-semibold text-rose-600 dark:text-rose-400">{inr(liabilities)}</div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {local.map((a) => {
          const Icon = iconFor(a.type);
          const negative = a.balance < 0;
          return (
            <Card key={a.id} className="glass group relative overflow-hidden p-5">
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/15 text-primary"><Icon className="h-5 w-5" /></div>
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.type}{a.mask ? ` · ${a.mask}` : ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary" className="text-[10px]">Active</Badge>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => del(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-6 text-xs uppercase tracking-widest text-muted-foreground">Balance</div>
              <div className={`font-numeric text-2xl font-semibold ${negative ? "text-rose-500 dark:text-rose-400" : ""}`}>{inr(a.balance)}</div>
            </Card>
          );
        })}
        {local.length === 0 && (
          <Card className="glass col-span-full grid place-items-center gap-2 py-16 text-center text-muted-foreground">
            No accounts yet — add one to get started.
          </Card>
        )}
      </div>
    </div>
  );
}
