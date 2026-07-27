import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, FileText, ShieldCheck, Cpu, CheckCircle2,
  Lock, ArrowRight, FileSpreadsheet, Building2, ListChecks, ScanLine, Wallet, Bell,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bank-statement")({
  head: () => ({
    meta: [
      { title: "Bank Statement Analyzer — Coming Soon | Expenso" },
      { name: "description", content: "Automated, private bank statement parsing and transaction extraction is coming soon to Expenso." },
    ],
  }),
  component: BankStatementComingSoon,
});

function BankStatementComingSoon() {
  const [email, setEmail] = useState("");
  const [notified, setNotified] = useState(false);

  const handleNotify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setNotified(true);
    toast.success("You're on the early access priority list! We'll notify you first.");
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden p-6 md:p-10 flex flex-col justify-between">
      {/* Dynamic Background Glow Elements */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[600px] rounded-full gradient-primary opacity-25 blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-32 h-80 w-80 rounded-full gradient-accent opacity-20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-10 -left-32 h-80 w-80 rounded-full bg-emerald-500/15 opacity-20 blur-3xl" />

      <div className="mx-auto max-w-5xl space-y-12 relative z-10 w-full">
        {/* Top Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto space-y-4"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 backdrop-blur-md">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-xs font-semibold tracking-wide uppercase text-primary">
              Bank Statement Analyzer · Coming Soon
            </span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gradient">
            Bank Statements,<br />Parsed Instantly.
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            We are upgrading our statement parsing engine to deliver automated, zero-error transaction extraction for all major Indian banks with 100% privacy.
          </p>

          {/* Early Access Email Signup */}
          <div className="pt-4 max-w-md mx-auto">
            {notified ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center justify-center gap-2.5 rounded-2xl border border-success/30 bg-success/15 p-4 text-sm font-medium text-success"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                You're on the early access priority list!
              </motion.div>
            ) : (
              <form onSubmit={handleNotify} className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="Enter your email for early access..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 rounded-xl bg-background/60 border-border/80 backdrop-blur text-xs"
                />
                <Button type="submit" className="h-12 rounded-xl gradient-primary px-6 font-semibold shadow-glow shrink-0 text-xs text-primary-foreground">
                  <Bell className="mr-2 h-4 w-4" /> Notify Me
                </Button>
              </form>
            )}
            <p className="mt-2.5 text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Lock className="h-3 w-3" /> Private, secure, and spam-free guarantee.
            </p>
          </div>
        </motion.div>

        {/* Feature Teasers Grid */}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            icon={<Cpu className="h-6 w-6 text-primary" />}
            title="Multimodal OCR Engine"
            description="Supports Digital PDFs, Scanned Image Statements, and Password-Protected PDFs with automated layout recognition."
            badge="In Alpha"
            delay={0.1}
          />
          <FeatureCard
            icon={<ShieldCheck className="h-6 w-6 text-accent" />}
            title="Zero-Knowledge Privacy"
            description="100% on-device processing. Account numbers, IFSC codes, and PAN details are automatically masked before saving."
            badge="In Alpha"
            delay={0.2}
          />
          <FeatureCard
            icon={<Building2 className="h-6 w-6 text-emerald-400" />}
            title="All Major Banks Supported"
            description="Pre-configured formats for SBI, HDFC, ICICI, Axis, PNB, Kotak, Yes Bank, IDFC, and custom CSV statement formats."
            badge="In Testing"
            delay={0.3}
          />
          <FeatureCard
            icon={<ScanLine className="h-6 w-6 text-amber-400" />}
            title="Merchant & Ref Detection"
            description="Automatically extracts clean merchant names (Swiggy, Amazon, Uber, Salary) and separates UPI / Ref transaction IDs."
            badge="Planned"
            delay={0.4}
          />
          <FeatureCard
            icon={<ListChecks className="h-6 w-6 text-purple-400" />}
            title="Balance Continuity Check"
            description="Verifies running balances against debits and credits to ensure zero missing or duplicated transaction entries."
            badge="Planned"
            delay={0.5}
          />
          <FeatureCard
            icon={<FileSpreadsheet className="h-6 w-6 text-cyan-400" />}
            title="One-Click Expenso Sync"
            description="Review extracted transactions in split-view alongside your document and sync hundreds of entries in a single click."
            badge="Coming Soon"
            delay={0.6}
          />
        </div>

        {/* Interactive Banner Footnote */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          <Card className="relative overflow-hidden border-border/60 gradient-card p-6 md:p-8 shadow-card flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl gradient-primary shadow-glow">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold">Want to early-test bank statement parsing?</h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Our core team is actively testing features with active community members. Join our preview group!
                </p>
              </div>
            </div>
            <Button variant="outline" className="rounded-xl border-primary/40 hover:bg-primary/10 shrink-0" onClick={() => toast.info("Early access channel opening soon!")}>
              Learn More <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Card>
        </motion.div>
      </div>

      <div className="mt-12 text-center text-xs text-muted-foreground relative z-10">
        © {new Date().getFullYear()} Expenso Bank Analyzer · Private & On-Device First
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  badge,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
    >
      <Card className="h-full border-border/60 gradient-card p-6 shadow-card hover:border-primary/40 transition-all duration-300 group relative flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted/60 group-hover:scale-110 transition-transform duration-300">
              {icon}
            </div>
            <Badge variant="outline" className="text-[10px] uppercase font-semibold border-primary/30 text-primary">
              {badge}
            </Badge>
          </div>
          <div>
            <h3 className="font-display text-base font-semibold group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {description}
            </p>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
