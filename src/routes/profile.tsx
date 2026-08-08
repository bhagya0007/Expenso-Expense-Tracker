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
import { updateProfile, updateEmail } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "@/integrations/firebase/client";
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
    const uid = user.uid || user.id;
    setEmail(user.email ?? "");
    (async () => {
      try {
        const uRef = doc(db, "users", uid);
        const snap = await getDoc(uRef);
        if (snap.exists()) {
          const data = snap.data();
          setRow({
            id: uid,
            full_name: data.full_name || data.displayName || user.displayName || "",
            avatar_url: data.avatar_url || "",
            phone: data.phone || "",
            currency: data.currency || "INR",
            monthly_income: data.monthly_income ?? 0,
            savings_goal_pct: data.savings_goal_pct ?? 20,
            budget_period: data.budget_period || "monthly",
            notify_bills: data.notify_bills ?? true,
            notify_budgets: data.notify_budgets ?? true,
            notify_weekly: data.notify_weekly ?? false,
            notify_anomalies: data.notify_anomalies ?? true,
          });
        } else {
          setRow({
            id: uid,
            full_name: user.displayName || "",
            avatar_url: "",
            phone: "",
            currency: "INR",
            monthly_income: 0,
            savings_goal_pct: 20,
            budget_period: "monthly",
            notify_bills: true,
            notify_budgets: true,
            notify_weekly: false,
            notify_anomalies: true,
          });
        }
      } catch {
        setRow({
          id: uid,
          full_name: user.displayName || "",
          avatar_url: "",
          phone: "",
          currency: "INR",
          monthly_income: 0,
          savings_goal_pct: 20,
          budget_period: "monthly",
          notify_bills: true,
          notify_budgets: true,
          notify_weekly: false,
          notify_anomalies: true,
        });
      } finally {
        setLoading(false);
      }
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
    if (!p) return true;
    const digits = p.replace(/\D/g, "");
    return digits.length >= 10 && digits.length <= 15;
  }

  async function save() {
    if (!user || !row) return;
    if (row.phone && !isValidPhone(row.phone)) {
      toast.error("Please enter a valid mobile number (10–15 digits)");
      return;
    }
    setSaving(true);
    const uid = user.uid || user.id;
    try {
      const uRef = doc(db, "users", uid);
      await setDoc(uRef, {
        id: uid,
        uid: uid,
        full_name: row.full_name,
        displayName: row.full_name,
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
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (auth.currentUser && row.full_name) {
        try {
          await updateProfile(auth.currentUser, { displayName: row.full_name });
        } catch {}
      }

      await refreshProfile();
      toast.success("Profile saved successfully");
      router.invalidate();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-foreground">Your Profile</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage your personal details and financial defaults.</p>
      </div>

      <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
          <UserIcon className="h-4 w-4 text-indigo-500" /> Personal Details
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-5">
          <Avatar className="h-16 w-16 border-2 border-indigo-500/30">
            <AvatarImage src={row.avatar_url ?? undefined} />
            <AvatarFallback className="text-lg font-bold bg-indigo-500/15 text-indigo-400">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-0.5 text-center sm:text-left">
            <div className="font-bold text-base text-foreground">{row.full_name || "Expenso User"}</div>
            <div className="text-xs text-muted-foreground">{email}</div>
          </div>
        </div>
        <Separator className="opacity-50" />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="fn" className="text-xs font-bold">Full Name</Label>
            <Input id="fn" value={row.full_name ?? ""} onChange={(e) => setRow({ ...row, full_name: e.target.value })} placeholder="Your full name" className="rounded-xl h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ph" className="text-xs font-bold">Phone Number</Label>
            <Input id="ph" value={row.phone ?? ""} onChange={(e) => setRow({ ...row, phone: e.target.value })} placeholder="+91 98765 43210" className="rounded-xl h-9 text-xs" />
          </div>
        </div>
      </Card>

      <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm space-y-5">
        <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
          <Wallet className="h-4 w-4 text-indigo-500" /> Finance Defaults
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="curr" className="text-xs font-bold">Preferred Currency</Label>
            <Select value={row.currency} onValueChange={(v) => setRow({ ...row, currency: v })}>
              <SelectTrigger id="curr" className="rounded-xl h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="INR" className="text-xs">₹ INR (Indian Rupee)</SelectItem>
                <SelectItem value="USD" className="text-xs">$ USD (US Dollar)</SelectItem>
                <SelectItem value="EUR" className="text-xs">€ EUR (Euro)</SelectItem>
                <SelectItem value="GBP" className="text-xs">£ GBP (British Pound)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inc" className="text-xs font-bold">Expected Monthly Income (₹)</Label>
            <Input id="inc" type="number" value={row.monthly_income ?? ""} onChange={(e) => setRow({ ...row, monthly_income: Number(e.target.value) })} placeholder="50000" className="rounded-xl h-9 text-xs" />
          </div>
        </div>
      </Card>

      <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
        <div className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
          <Bell className="h-4 w-4 text-indigo-500" /> Notifications
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-foreground">Bill Reminders</div>
            <div className="text-[11px] text-muted-foreground">Alerts for upcoming recurring payments</div>
          </div>
          <Switch checked={row.notify_bills} onCheckedChange={(v) => setRow({ ...row, notify_bills: v })} />
        </div>
        <Separator className="opacity-50" />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs font-bold text-foreground">Budget Alerts</div>
            <div className="text-[11px] text-muted-foreground">Alerts when spending approaches limit</div>
          </div>
          <Switch checked={row.notify_budgets} onCheckedChange={(v) => setRow({ ...row, notify_budgets: v })} />
        </div>
      </Card>

      <div className="flex justify-end pt-2">
        <Button onClick={save} disabled={saving} className="h-9 px-5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-sm">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
