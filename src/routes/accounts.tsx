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
    <div className="space-y-4 p-4 sm:p-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-foreground">Accounts</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Every rupee, gathered in one place.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreate} className="h-8 rounded-xl px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />Add account
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl border-border/60">
            <DialogHeader><DialogTitle className="font-display">{editing ? "Edit account" : "Link a new account"}</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label className="text-xs font-bold">Name</Label>
                <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="HDFC Salary Account" className="rounded-xl h-9 text-xs" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label className="text-xs font-bold">Type</Label>
                  <Select value={draft.type} onValueChange={(v) => setDraft({ ...draft, type: v as AccountType })}>
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {(["Bank", "Credit Card", "Debit Card", "Wallet", "UPI", "Cash"] as AccountType[]).map((t) => (
                        <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label className="text-xs font-bold">Balance</Label>
                  <CurrencyInput value={draft.balance} onChange={(v) => setDraft({ ...draft, balance: v })} step={500} allowNegative className="rounded-xl h-9 text-xs" /></div>
              </div>
              <div className="grid gap-2"><Label className="text-xs font-bold">Mask (optional)</Label>
                <Input value={draft.mask} onChange={(e) => setDraft({ ...draft, mask: e.target.value })} placeholder="•• 1234" className="rounded-xl h-9 text-xs" /></div>
            </div>
            <DialogFooter><Button onClick={save} className="h-8 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">{editing ? "Save Changes" : "Add Account"}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3.5 sm:grid-cols-3">
        <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-xl shadow-sm">
          <div className="text-[11px] font-semibold text-muted-foreground tracking-wider uppercase">Net worth</div>
          <div className="mt-2 font-numeric text-xl sm:text-2xl font-extrabold tracking-tight text-foreground">{inr(total)}</div>
        </Card>
        <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase"><TrendingUp className="h-3.5 w-3.5 text-emerald-500" />Assets</div>
          <div className="mt-2 font-numeric text-xl sm:text-2xl font-extrabold tracking-tight text-emerald-500">{inr(assets)}</div>
        </Card>
        <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 rounded-xl shadow-sm">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground tracking-wider uppercase"><TrendingDown className="h-3.5 w-3.5 text-rose-500" />Liabilities</div>
          <div className="mt-2 font-numeric text-xl sm:text-2xl font-extrabold tracking-tight text-rose-500">{inr(liabilities)}</div>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {local.map((a) => {
          const Icon = iconFor(a.type);
          const negative = a.balance < 0;
          return (
            <Card key={a.id} className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm transition-all hover:border-indigo-500/40">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400"><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0">
                    <div className="font-bold text-xs sm:text-sm text-foreground truncate">{a.name}</div>
                    <div className="text-[11px] text-muted-foreground">{a.type}{a.mask ? ` · ${a.mask}` : ""}</div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded">Active</Badge>
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground" onClick={() => openEdit(a)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => del(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">Balance</span>
                <div className={`font-numeric text-lg sm:text-xl font-extrabold ${negative ? "text-rose-500" : "text-foreground"}`}>{inr(a.balance)}</div>
              </div>
            </Card>
          );
        })}
        {local.length === 0 && (
          <Card className="border border-border/60 bg-card/70 backdrop-blur col-span-full grid place-items-center gap-2 py-12 text-center text-xs text-muted-foreground rounded-2xl">
            No accounts yet — click "+ Add account" to create your first account!
          </Card>
        )}
      </div>
    </div>
  );
}
