import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText, Sparkles, ShieldCheck, Zap, ArrowRight, CheckCircle2,
  Lock, Cpu, Layers, BellRing, Compass
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bank-statement")({
  head: () => ({
    meta: [
      { title: "Bank Statement Parser - Coming Soon | Expenso" },
      { name: "description", content: "Expenso AI Bank Statement Parser is coming soon. Parse digital & scanned bank statements with 100% privacy and AI accuracy." },
    ],
  }),
  component: BankStatementComingSoonPage,
});

function BankStatementComingSoonPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleNotifySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      toast.error("Please enter a valid email address.");
      return;
    }
    setIsSubmitted(true);
    toast.success("🎉 You're on the early access list! We'll notify you as soon as Bank Statement Parsing launches.");
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)] p-4 sm:p-6 md:p-10 flex flex-col justify-center items-center overflow-hidden">
      {/* Background Decorative Ambient Glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-[350px] h-[350px] bg-emerald-500/10 dark:bg-emerald-500/15 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-purple-500/10 dark:bg-purple-500/15 rounded-full blur-3xl pointer-events-none -z-10" />

      <div className="w-full max-w-4xl mx-auto space-y-8 text-center relative z-10">
        {/* Header Badge */}
        <motion.div
          initial={{ opacity: 0, y: -15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-emerald-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-semibold shadow-sm"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
          <span>Expenso AI v2.0 &bull; Next-Gen OCR Intelligence</span>
          <Badge className="bg-indigo-600 text-white text-[10px] px-2 py-0.2 rounded-full border-none ml-1">
            Coming Soon
          </Badge>
        </motion.div>

        {/* Main Headline */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold font-display tracking-tight text-foreground leading-[1.15]">
            Bank Statement Parsing <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-emerald-500 dark:from-indigo-400 dark:via-purple-400 dark:to-emerald-400 bg-clip-text text-transparent">
              Is Coming Soon
            </span>
          </h1>
          <p className="max-w-2xl mx-auto text-sm sm:text-base text-muted-foreground leading-relaxed">
            We are building an ultra-fast, zero-error AI engine to automatically extract, categorize, and reconcile digital & scanned bank statements directly into your Expenso ledger.
          </p>
        </motion.div>

        {/* Highlight Feature Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-left"
        >
          <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur hover:border-indigo-500/40 transition-all shadow-sm rounded-xl space-y-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Cpu className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">AI OCR Engine 2.0</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Extract tabular transaction data from PDFs, scanned images, and bank e-statements.
            </p>
          </Card>

          <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur hover:border-emerald-500/40 transition-all shadow-sm rounded-xl space-y-2">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">100% Privacy First</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Bank statements are parsed on your device with complete data privacy and security.
            </p>
          </Card>

          <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur hover:border-purple-500/40 transition-all shadow-sm rounded-xl space-y-2">
            <div className="h-9 w-9 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Multi-Bank Support</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Native support for HDFC, ICICI, SBI, Axis, Kotak, and international bank statements.
            </p>
          </Card>

          <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur hover:border-amber-500/40 transition-all shadow-sm rounded-xl space-y-2">
            <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <Zap className="h-5 w-5" />
            </div>
            <h3 className="font-semibold text-sm text-foreground">Auto-Reconciliation</h3>
            <p className="text-xs text-muted-foreground leading-normal">
              Automatically flag duplicate transactions and reconcile statement balances with your ledger.
            </p>
          </Card>
        </motion.div>

        {/* Early Access Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="max-w-md mx-auto"
        >
          <Card className="p-5 border border-border/60 bg-card/80 backdrop-blur rounded-2xl shadow-md">
            {!isSubmitted ? (
              <form onSubmit={handleNotifySubmit} className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-foreground mb-1">
                  <BellRing className="h-4 w-4 text-indigo-500" />
                  <span>Get Early Access & Launch Notification</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="Enter your email address..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 text-xs rounded-xl bg-background"
                  />
                  <Button
                    type="submit"
                    className="h-10 px-4 text-xs font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
                  >
                    Notify Me
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                  <Lock className="h-3 w-3 text-muted-foreground/70" /> No spam. We will only notify you when feature launches.
                </p>
              </form>
            ) : (
              <div className="py-2 space-y-2 text-center">
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-sm text-foreground">You are on the VIP Early Access List!</h4>
                <p className="text-xs text-muted-foreground">
                  Thank you! We will send you an exclusive invite as soon as Bank Statement Parsing is ready.
                </p>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Quick Navigation Footer Links */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="pt-4 flex flex-wrap items-center justify-center gap-4 text-xs"
        >
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/insights" })}
            className="rounded-xl px-4 py-2 h-auto text-xs font-medium border-border/60 hover:bg-accent"
          >
            <Sparkles className="mr-1.5 h-3.5 w-3.5 text-indigo-500" /> Ask Expenso AI Insights
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate({ to: "/transactions" })}
            className="rounded-xl px-4 py-2 h-auto text-xs font-medium border-border/60 hover:bg-accent"
          >
            <Compass className="mr-1.5 h-3.5 w-3.5 text-emerald-500" /> View Transactions Ledger
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
