import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, Palette, CreditCard, Bell, Download, Sun, Moon, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import { api } from "@/lib/api";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Settings — Expenso" }, { name: "description", content: "Manage security, appearance, notifications and data preferences." }] }),
  component: SettingsPage,
});


function SettingsPage() {
  const [notif, setNotif] = useState({ bills: true, budgets: true, weekly: false, anomalies: true });
  const [deleting, setDeleting] = useState(false);
  const [resetting, setResetting] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, deleteAccount } = useAuth();

  async function handlePasswordReset() {
    const email = user?.email;
    if (!email) {
      toast.error("No email found for current user account.");
      return;
    }
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(`Password reset email sent to ${email}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send password reset email.");
    } finally {
      setResetting(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteAccount();
      await api.clearAllData();
      await qc.cancelQueries();
      qc.clear();
      try { localStorage.clear(); } catch {}
      toast.success("Your account and data have been deleted");
      navigate({ to: "/auth", replace: true });
    } catch (e) {
      toast.error((e as Error).message || "Failed to delete account");
    } finally {
      setDeleting(false);
    }
  }

  async function exportCSV() {
    try {
      const txs = await api.listTransactions();
      if (txs.length === 0) {
        toast.info("No transactions to export");
        return;
      }
      const headers = ["Date", "Description", "Type", "Category", "Amount (INR)", "Payment Method", "Notes"];
      const rows = txs.map((t) => [
        `"${new Date(t.date).toLocaleDateString("en-IN")}"`,
        `"${(t.description || "").replace(/"/g, '""')}"`,
        `"${t.type}"`,
        `"${t.category}"`,
        t.amount,
        `"${t.paymentMethod || ""}"`,
        `"${(t.notes || "").replace(/"/g, '""')}"`,
      ]);
      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `expenso_transactions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("CSV file downloaded successfully!");
    } catch {
      toast.error("Failed to generate CSV export");
    }
  }

  async function exportPDF() {
    try {
      const txs = await api.listTransactions();
      const accounts = await api.listAccounts();
      const income = txs.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
      const expense = txs.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);

      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Expenso Financial Report</title>
          <style>
            body { font-family: system-ui, sans-serif; padding: 40px; color: #111; }
            h1 { font-size: 24px; margin-bottom: 4px; color: #047857; }
            p { color: #666; font-size: 14px; margin-top: 0; }
            .summary { display: flex; gap: 16px; margin: 24px 0; }
            .card { flex: 1; padding: 16px; border: 1px solid #e5e7eb; border-radius: 8px; background: #f9fafb; }
            .card h3 { font-size: 11px; text-transform: uppercase; color: #6b7280; margin: 0 0 4px 0; }
            .card p { font-size: 18px; font-weight: bold; margin: 0; color: #111827; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th { text-align: left; padding: 8px; background: #f3f4f6; border-bottom: 2px solid #e5e7eb; }
            td { padding: 8px; border-bottom: 1px solid #e5e7eb; }
            .expense { color: #dc2626; }
            .income { color: #16a34a; }
          </style>
        </head>
        <body>
          <h1>Expenso — Financial Report</h1>
          <p>Generated on ${new Date().toLocaleDateString("en-IN", { dateStyle: "full" })}</p>
          <div class="summary">
            <div class="card"><h3>Total Income</h3><p class="income">₹${income.toLocaleString("en-IN")}</p></div>
            <div class="card"><h3>Total Expenses</h3><p class="expense">₹${expense.toLocaleString("en-IN")}</p></div>
            <div class="card"><h3>Net Savings</h3><p>₹${(income - expense).toLocaleString("en-IN")}</p></div>
            <div class="card"><h3>Accounts Count</h3><p>${accounts.length}</p></div>
          </div>
          <h2>Transactions (${txs.length})</h2>
          <table>
            <thead>
              <tr><th>Date</th><th>Description</th><th>Category</th><th>Type</th><th>Amount</th></tr>
            </thead>
            <tbody>
              ${txs.length === 0 ? `<tr><td colspan="5" style="text-align:center;">No transactions logged</td></tr>` : txs.slice(0, 100).map((t) => `
                <tr>
                  <td>${new Date(t.date).toLocaleDateString("en-IN")}</td>
                  <td>${t.description}</td>
                  <td>${t.category}</td>
                  <td>${t.type}</td>
                  <td class="${t.type}">₹${t.amount.toLocaleString("en-IN")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);

      const doc = iframe.contentWindow?.document || iframe.contentDocument;
      if (doc) {
        doc.open();
        doc.write(html);
        doc.close();
        setTimeout(() => {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
          setTimeout(() => {
            try { document.body.removeChild(iframe); } catch {}
          }, 1000);
        }, 250);
        toast.success("PDF Report generated!");
      }
    } catch {
      toast.error("Failed to generate PDF report");
    }
  }

  return (
    <div className="space-y-4 p-4 sm:p-5 max-w-7xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold font-display tracking-tight text-foreground">Settings</h1>
        <p className="text-xs text-muted-foreground mt-0.5">Manage security, appearance, notifications and data preferences.</p>
      </div>

      <Section icon={Shield} title="Security" desc="Protect your account">
        <Row title="Two-factor authentication" desc="Require a code on new devices">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[10px]"><Sparkles className="h-3 w-3 text-indigo-500" />Coming soon</Badge>
            <Switch checked={false} disabled aria-label="Two-factor authentication (coming soon)" />
          </div>
        </Row>
        <Separator className="my-3 opacity-50" />
        <Row title="Biometric unlock" desc="Face ID / fingerprint on mobile">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-[10px]"><Sparkles className="h-3 w-3 text-indigo-500" />Coming soon</Badge>
            <Switch checked={false} disabled aria-label="Biometric unlock (coming soon)" />
          </div>
        </Row>
        <Separator className="my-3 opacity-50" />
        <Row title="Change password" desc="Update your account password">
          <Button variant="outline" onClick={handlePasswordReset} disabled={resetting} className="h-8 rounded-xl px-3 text-xs font-semibold bg-background/50 border-border/60 hover:bg-muted text-foreground">
            {resetting ? "Sending…" : "Change Password"}
          </Button>
        </Row>
      </Section>

      <Section icon={Bell} title="Notifications" desc="What you hear from Expenso">
        <Row title="Bill reminders"><Switch checked={notif.bills} onCheckedChange={(v) => setNotif({ ...notif, bills: v })} /></Row>
        <Separator className="my-3 opacity-50" />
        <Row title="Budget alerts"><Switch checked={notif.budgets} onCheckedChange={(v) => setNotif({ ...notif, budgets: v })} /></Row>
        <Separator className="my-3 opacity-50" />
        <Row title="Weekly digest"><Switch checked={notif.weekly} onCheckedChange={(v) => setNotif({ ...notif, weekly: v })} /></Row>
        <Separator className="my-3 opacity-50" />
        <Row title="Anomaly detection"><Switch checked={notif.anomalies} onCheckedChange={(v) => setNotif({ ...notif, anomalies: v })} /></Row>
      </Section>

      <Section icon={Palette} title="Appearance" desc="Look & feel">
        <ThemeRow />
      </Section>

      <Section icon={CreditCard} title="Plan" desc="Your Expenso plan">
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background/50 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="font-bold text-sm text-foreground">Expenso — Free</div>
                <Badge className="bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 text-[10px] font-bold border-none">Free forever</Badge>
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                All features included — AI insights, bank statement analyzer, forecasts and more.
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Sparkles className="h-3 w-3 text-indigo-500" /> Pro · Coming soon
              </Badge>
              <span className="mt-1 text-[11px] text-muted-foreground">No billing today</span>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-dashed border-border/70 bg-muted/20 p-3 text-[11px] text-muted-foreground">
            We're cooking up an Expenso Pro tier with advanced automations and family sharing.
            You'll be the first to know when it launches — no charges until then.
          </div>
        </div>
      </Section>

      <Section icon={Download} title="Data" desc="Export or delete your data">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCSV} className="h-8 rounded-xl px-3 text-xs font-semibold bg-background/50 border-border/60 hover:bg-muted text-foreground">Export CSV</Button>
          <Button variant="outline" onClick={exportPDF} className="h-8 rounded-xl px-3 text-xs font-semibold bg-background/50 border-border/60 hover:bg-muted text-foreground">Export PDF report</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={deleting} className="h-8 rounded-xl px-3 text-xs font-semibold">{deleting ? "Deleting…" : "Delete account"}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-border/60">
              <AlertDialogHeader>
                <AlertDialogTitle className="font-display">Delete your Expenso account?</AlertDialogTitle>
                <AlertDialogDescription className="text-xs">
                  This permanently deletes your profile and sign-in. You can create a new account with the same email afterwards. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="h-8 rounded-xl text-xs">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="h-8 rounded-xl text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Yes, delete my account
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon: Icon, title, desc, children }: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; children: React.ReactNode }) {
  return (
    <Card className="border border-border/60 bg-card/80 dark:bg-slate-900/80 backdrop-blur-md p-4 sm:p-5 rounded-2xl shadow-sm space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500/15 text-indigo-400"><Icon className="h-5 w-5" /></div>
        <div>
          <div className="font-bold text-sm text-foreground">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>
      </div>
      {children}
    </Card>
  );
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-xs font-bold text-foreground">{title}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      {children}
    </div>
  );
}

function ThemeRow() {
  const { theme, toggle } = useTheme();
  return (
    <Row title="Theme" desc={theme === "dark" ? "Dark — easy on the eyes at night" : "Light — bright and airy"}>
      <Button variant="outline" onClick={toggle} className="h-8 rounded-xl px-3 text-xs font-semibold bg-background/50 border-border/60 hover:bg-muted text-foreground gap-2">
        {theme === "dark" ? <><Sun className="h-3.5 w-3.5" />Switch to light</> : <><Moon className="h-3.5 w-3.5" />Switch to dark</>}
      </Button>
    </Row>
  );
}

