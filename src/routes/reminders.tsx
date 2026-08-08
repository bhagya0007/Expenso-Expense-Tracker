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
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Reminders</h1>
          <p className="text-sm text-muted-foreground">Bills, cards, rent, subscriptions — all in one place.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary shadow-glow"><Plus className="mr-1.5 h-4 w-4" />New reminder</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New reminder</DialogTitle></DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2"><Label>Title</Label>
                <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Broadband bill" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2"><Label>Amount (₹)</Label>
                  <Input type="number" step="any" value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) })} /></div>
                <div className="grid gap-2"><Label>Due date</Label>
                  <Input type="date" value={draft.dueDate.slice(0, 10)} onChange={(e) => setDraft({ ...draft, dueDate: new Date(e.target.value).toISOString() })} /></div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div><div className="text-sm font-medium">Auto-pay</div><div className="text-xs text-muted-foreground">Pay automatically on due date</div></div>
                <Switch checked={draft.autoPay} onCheckedChange={(v) => setDraft({ ...draft, autoPay: v })} />
              </div>
            </div>
            <DialogFooter><Button onClick={add} className="gradient-primary">Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-3">
        {isLoading && items.length === 0 ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[76px] w-full rounded-xl" />
          ))
        ) : (
          <>
            {items.map((r) => {
              const Icon = iconFor(r.category);
              const days = Math.ceil((+new Date(r.dueDate) - Date.now()) / 86400000);
              const urgent = days <= 3;
              return (
                <Card key={r.id} className="glass flex items-center gap-4 p-4">
                  <div className={`grid h-11 w-11 place-items-center rounded-xl ${urgent ? "bg-rose-500/15 text-rose-300" : "bg-primary/15 text-primary"}`}><Icon className="h-5 w-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="font-medium">{r.title}</div>
                      <Badge variant="secondary" className="text-[10px]">{r.category}</Badge>
                      {r.autoPay && <Badge className="bg-emerald-500/15 text-[10px] text-emerald-300">Auto-pay</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>Due {new Date(r.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} &bull; {days <= 0 ? "today" : `in ${days} day${days === 1 ? "" : "s"}`}</div>
                      <div className="text-[10px] text-muted-foreground/75 font-medium">{new Date(r.dueDate).toLocaleDateString("en-IN", { weekday: "long" })}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-display text-lg font-bold">{inr(r.amount)}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => deleteM.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>
                </Card>
              );
            })}
            {items.length === 0 && (
              <Card className="glass grid place-items-center gap-2 py-16 text-center text-muted-foreground">
                <Bell className="h-8 w-8" /><div>No reminders yet — add your first one to get started.</div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}
