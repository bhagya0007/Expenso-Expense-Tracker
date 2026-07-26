import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { User as UserIcon, Bell, Wallet, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/profile")({
  head: () => ({ meta: [{ title: "Profile — Expenso" }, { name: "description", content: "Edit your Expenso profile, contact info, and finance preferences." }] }),
  component: ProfilePage,
});

type Row = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  currency: string;
  monthly_income: number | null;
  savings_goal_pct: number | null;
  budget_period: string | null;
  notify_bills: boolean;
  notify_budgets: boolean;
  notify_weekly: boolean;
  notify_anomalies: boolean;
};

function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const router = useRouter();
  const [row, setRow] = useState<Row | null>(null);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email ?? "");
    (async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      setRow((data as Row) ?? {
        id: user.id, full_name: "", avatar_url: "", phone: "", currency: "INR",
        monthly_income: 0, savings_goal_pct: 20, budget_period: "monthly",
        notify_bills: true, notify_budgets: true, notify_weekly: false, notify_anomalies: true,
      });
      setLoading(false);
    })();
  }, [user]);

  if (loading || !row) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="space-y-2">
          <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
          <div className="h-4 w-72 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-56 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
        <div className="h-48 animate-pulse rounded-2xl bg-muted" />
      </div>
    );
  }

  const initials = (row.full_name || email || "U").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

  function isValidPhone(p: string) {
    const digits = p.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  async function save() {
    if (!user || !row) return;
    if (!row.phone || !isValidPhone(row.phone)) {
      toast.error("Please enter a valid mobile number (10–15 digits)");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: row.full_name,
        avatar_url: row.avatar_url,
        phone: row.phone,
        currency: row.currency,
        monthly_income: row.monthly_income,
        savings_goal_pct: row.savings_goal_pct,
        budget_period: row.budget_period,
        notify_bills: row.notify_bills,
        notify_budgets: row.notify_budgets,
        notify_weekly: row.notify_weekly,
        notify_anomalies: row.notify_anomalies,
      });
      if (error) throw error;
      if (email && email !== user.email) {
        const { error: eErr } = await supabase.auth.updateUser({ email });
        if (eErr) toast.warning("Profile saved. Email change needs verification: " + eErr.message);
        else toast.success("Profile saved. Check your inbox to confirm the new email.");
      } else {
        toast.success("Profile saved");
      }
      await refreshProfile();
      router.invalidate();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const set = <K extends keyof Row>(k: K, v: Row[K]) => setRow({ ...row, [k]: v });

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Your profile</h1>
        <p className="text-sm text-muted-foreground">Personal details, contact and finance preferences.</p>
      </div>

      <Card className="glass p-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 ring-2 ring-primary/30">
            <AvatarImage src={row.avatar_url ?? undefined} />
            <AvatarFallback className="gradient-primary text-lg text-primary-foreground">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Label>Avatar URL</Label>
            <Input placeholder="https://…" value={row.avatar_url ?? ""} onChange={(e) => set("avatar_url", e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">Paste an image URL. Uploads coming soon.</p>
          </div>
        </div>

        <Separator className="my-6" />

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" icon={UserIcon}>
            <Input value={row.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} placeholder="Your name" />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Mobile number *">
            <Input type="tel" inputMode="tel" placeholder="+91 98765 43210" required
              value={row.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            <p className="text-[11px] text-muted-foreground">Required · used for security alerts and reminders.</p>
          </Field>
          <Field label="Currency">
            <Select value={row.currency} onValueChange={(v) => set("currency", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ Indian Rupee</SelectItem>
                <SelectItem value="USD">$ US Dollar</SelectItem>
                <SelectItem value="EUR">€ Euro</SelectItem>
                <SelectItem value="GBP">£ British Pound</SelectItem>
                <SelectItem value="AED">د.إ UAE Dirham</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="glass p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Wallet className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold">Finance preferences</div>
            <div className="text-xs text-muted-foreground">Powers budgets, forecasts and savings tips.</div>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Monthly income">
            <Input type="number" min={0} inputMode="numeric" placeholder="0"
              value={row.monthly_income ? String(row.monthly_income) : ""}
              onChange={(e) => set("monthly_income", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label="Savings goal (%)">
            <Input type="number" min={0} max={90} inputMode="numeric" placeholder="20"
              value={row.savings_goal_pct ? String(row.savings_goal_pct) : ""}
              onChange={(e) => set("savings_goal_pct", e.target.value === "" ? null : Number(e.target.value))} />
          </Field>
          <Field label="Budget period">
            <Select value={row.budget_period ?? "monthly"} onValueChange={(v) => set("budget_period", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Card>

      <Card className="glass p-6">
        <div className="mb-2 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary"><Bell className="h-5 w-5" /></div>
          <div>
            <div className="font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">Choose what Expenso pings you about.</div>
          </div>
        </div>
        <Toggle label="Bill reminders" v={row.notify_bills} onChange={(v) => set("notify_bills", v)} />
        <Separator className="my-3" />
        <Toggle label="Budget alerts" v={row.notify_budgets} onChange={(v) => set("notify_budgets", v)} />
        <Separator className="my-3" />
        <Toggle label="Weekly digest" v={row.notify_weekly} onChange={(v) => set("notify_weekly", v)} />
        <Separator className="my-3" />
        <Toggle label="Anomaly detection" v={row.notify_anomalies} onChange={(v) => set("notify_anomalies", v)} />
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} className="gradient-primary shadow-glow">
          <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, icon: Icon, children }: { label: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label className="flex items-center gap-2">{Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={v} onCheckedChange={onChange} />
    </div>
  );
}
