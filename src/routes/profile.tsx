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
    <div className="mx-auto max-w-4xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-display text-2xl font-bold md:text-3xl">Your Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your personal details and financial defaults.</p>
      </div>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <UserIcon className="h-5 w-5 text-primary" /> Personal Details
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <Avatar className="h-20 w-20 border-2 border-border">
            <AvatarImage src={row.avatar_url ?? undefined} />
            <AvatarFallback className="text-xl font-bold bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <div className="space-y-1 text-center sm:text-left">
            <div className="font-semibold text-lg">{row.full_name || "Expenso User"}</div>
            <div className="text-sm text-muted-foreground">{email}</div>
          </div>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="fn">Full Name</Label>
            <Input id="fn" value={row.full_name ?? ""} onChange={(e) => setRow({ ...row, full_name: e.target.value })} placeholder="Your full name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ph">Phone Number</Label>
            <Input id="ph" value={row.phone ?? ""} onChange={(e) => setRow({ ...row, phone: e.target.value })} placeholder="+91 98765 43210" />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <Wallet className="h-5 w-5 text-primary" /> Finance Defaults
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="curr">Preferred Currency</Label>
            <Select value={row.currency} onValueChange={(v) => setRow({ ...row, currency: v })}>
              <SelectTrigger id="curr"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="INR">₹ INR (Indian Rupee)</SelectItem>
                <SelectItem value="USD">$ USD (US Dollar)</SelectItem>
                <SelectItem value="EUR">€ EUR (Euro)</SelectItem>
                <SelectItem value="GBP">£ GBP (British Pound)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inc">Expected Monthly Income (₹)</Label>
            <Input id="inc" type="number" value={row.monthly_income ?? ""} onChange={(e) => setRow({ ...row, monthly_income: Number(e.target.value) })} placeholder="50000" />
          </div>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2 font-display text-lg font-semibold">
          <Bell className="h-5 w-5 text-primary" /> Notifications
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Bill Reminders</div>
            <div className="text-xs text-muted-foreground">Alerts for upcoming recurring payments</div>
          </div>
          <Switch checked={row.notify_bills} onCheckedChange={(v) => setRow({ ...row, notify_bills: v })} />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Budget Alerts</div>
            <div className="text-xs text-muted-foreground">Alerts when spending approaches limit</div>
          </div>
          <Switch checked={row.notify_budgets} onCheckedChange={(v) => setRow({ ...row, notify_budgets: v })} />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving} size="lg" className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Profile"}
        </Button>
      </div>
    </div>
  );
}
