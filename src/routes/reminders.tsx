import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient, queryOptions } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/api";
import { Bell, Plus, Zap, CreditCard, Home, Wifi, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { inr } from "@/lib/format";
import { api } from "@/lib/api";
import type { Reminder, ReminderCategory } from "@/lib/types";
import { toast } from "sonner";

const remindersQO = queryOptions({ queryKey: ["reminders"], queryFn: () => api.listReminders() });

function dueIn(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString();
}

const iconFor = (c: ReminderCategory) =>
  c === "Bills" ? Zap : c === "Card" ? CreditCard : c === "Rent" ? Home : Wifi;

export const Route = createFileRoute("/reminders")({
  head: () => ({ meta: [{ title: "Reminders — Expenso" }, { name: "description", content: "Never miss a bill: reminders for bills, cards, rent and subscriptions." }] }),
  loader: ({ context }) => { context.queryClient.ensureQueryData(remindersQO); },
  component: RemindersPage,
});

function RemindersPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery(remindersQO);
  const [open, setOpen] = useState(false);
  const emptyDraft = (): Omit<Reminder, "id"> => ({ title: "", amount: 0, dueDate: dueIn(7), category: "Bills", autoPay: false });
  const [draft, setDraft] = useState<Omit<Reminder, "id">>(emptyDraft());

  const createM = useMutation({
    mutationFn: (r: Omit<Reminder, "id">) => api.createReminder(r),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["reminders"] }); toast.success("Reminder set"); },
  });
  const deleteM = useMutation({
    mutationFn: (id: string) => api.deleteReminder(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reminders"] }),
  });

  function add() {
    if (!draft.title) return toast.error("Add a title");
    createM.mutate(draft);
    setOpen(false);
    setDraft(emptyDraft());
  }

  return (
    <div className="space-y-4 p-4 sm:p-5 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-foreground">Reminders</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Never miss a recurring bill or subscription payment.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="h-8 rounded-xl px-4 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Plus className="mr-1.5 h-3.5 w-3.5" />Add reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="rounded-2xl border-border/60">
            <DialogHeader><DialogTitle className="font-display">Add a bill reminder</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label className="text-xs font-bold">Title</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="JioFiber Fiber Broadband" className="rounded-xl h-9 text-xs" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label className="text-xs font-bold">Category</Label>
                  <Select value={draft.category} onValueChange={(v) => setDraft({ ...draft, category: v as ReminderCategory })}>
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2"><Label className="text-xs font-bold">Frequency</Label>
                  <Select value={draft.frequency} onValueChange={(v) => setDraft({ ...draft, frequency: v })}>
                    <SelectTrigger className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {["monthly", "yearly", "weekly", "one-time"].map((f) => <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label className="text-xs font-bold">Amount (₹)</Label>
                  <Input type="number" step="any" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} className="rounded-xl h-9 text-xs" /></div>
                <div className="grid gap-2"><Label className="text-xs font-bold">Due date</Label>
                  <Input type="date" value={draft.dueDate.slice(0, 10)} onChange={(e) => setDraft({ ...draft, dueDate: new Date(e.target.value).toISOString() })} className="rounded-xl h-9 text-xs" /></div>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border/60 p-3 bg-muted/20">
                <div><div className="text-xs font-bold">Auto-pay</div><div className="text-[11px] text-muted-foreground">Pay automatically on due date</div></div>
                <Switch checked={draft.autoPay} onCheckedChange={(v) => setDraft({ ...draft, autoPay: v })} />
              </div>
            </div>
            <DialogFooter><Button onClick={add} className="h-8 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">Save Reminder</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading && items.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-2xl" />
          ))
        ) : (
          <>
            {items.map((r) => {
              const Icon = iconFor(r.category);
              const days = Math.ceil((+new Date(r.dueDate) - Date.now()) / 86400000);
              const urgent = days <= 3;
              return (
                <Card key={r.id} className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md flex items-center gap-4 p-4 rounded-2xl shadow-sm transition-all hover:border-indigo-500/40">
                  <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${urgent ? "bg-rose-500/15 text-rose-500" : "bg-indigo-500/15 text-indigo-400"}`}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-bold text-xs sm:text-sm text-foreground truncate">{r.title}</div>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded">{r.category}</Badge>
                      {r.autoPay && <Badge className="bg-emerald-500/15 text-[10px] font-bold text-emerald-500 border-none">Auto-pay</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      Due {new Date(r.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} &bull; {days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-numeric text-base sm:text-lg font-extrabold text-foreground">{inr(r.amount)}</div>
                  </div>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" onClick={() => deleteM.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </Card>
              );
            })}
            {items.length === 0 && (
              <Card className="border border-border/60 bg-card/70 backdrop-blur grid place-items-center gap-2 py-12 text-center text-xs text-muted-foreground rounded-2xl">
                <Bell className="h-7 w-7 text-muted-foreground/60" /><div>No reminders yet — click "+ Add reminder" to set your first reminder!</div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
