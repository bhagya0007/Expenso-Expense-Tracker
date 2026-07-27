import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Sparkles, Clock, ShieldCheck, ArrowRight, FileSpreadsheet, Cpu, Bell, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/bank-statement")({
  head: () => ({
    meta: [
      { title: "Bank Statement Analyzer (Coming Soon) — Expenso" },
      { name: "description", content: "AI-Powered Bank Statement Analyzer is coming soon to Expenso." },
      { property: "og:title", content: "Bank Statement Analyzer (Coming Soon) — Expenso" },
      { property: "og:description", content: "AI-Powered Bank Statement Analyzer is coming soon to Expenso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BankStatementComingSoonPage,
});

function BankStatementComingSoonPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !email.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }
    setSubscribed(true);
    toast.success("You're on the early access list! We'll notify you as soon as this feature launches.");
  }

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-3xl space-y-8 text-center">
        {/* Animated Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary shadow-glow"
        >
          <Clock className="h-3.5 w-3.5 animate-spin-slow" />
          <span>FEATURE COMING SOON</span>
        </motion.div>

        {/* Title & Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="space-y-3"
        >
          <h1 className="font-display text-3xl font-extrabold tracking-tight md:text-5xl">
            Bank Statement <span className="gradient-text">Analyzer 2.0</span>
          </h1>
          <p className="mx-auto max-w-xl text-sm text-muted-foreground md:text-base">
            We are upgrading our statement parsing engine with next-gen multimodal AI for seamless, zero-error transaction extraction from all major Indian banks.
          </p>
        </motion.div>

        {/* Highlight Feature Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="gradient-card border-border/60 p-6 md:p-8">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-glow">
                  <Cpu className="h-6 w-6" />
                </div>
                <h3 className="font-display text-sm font-semibold">Multimodal AI Parser</h3>
                <p className="text-xs text-muted-foreground">
                  Supports Digital PDFs, Scanned Images, and Password-Protected Statements with zero hallucination.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent shadow-glow">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h3 className="font-display text-sm font-semibold">Local Privacy Guarantee</h3>
                <p className="text-xs text-muted-foreground">
                  100% on-device processing. Account numbers, IFSC codes, and PAN details are automatically masked.
                </p>
              </div>

              <div className="flex flex-col items-center text-center space-y-2.5">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-success/15 text-success shadow-glow">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <h3 className="font-display text-sm font-semibold">One-Click Expenso Sync</h3>
                <p className="text-xs text-muted-foreground">
                  Automatic category tagging, merchant detection, and balance continuity verification.
                </p>
              </div>
            </div>

            {/* Early Access Email Subscription Box */}
            <div className="mt-8 border-t border-border/60 pt-6">
              {subscribed ? (
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-success">
                  <CheckCircle2 className="h-4 w-4" /> You're on the early access list! We'll notify you on launch.
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="mx-auto flex max-w-md gap-2">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email for early access..."
                    className="rounded-xl border-border/60 text-xs"
                    required
                  />
                  <Button type="submit" size="sm" className="gradient-primary shrink-0 rounded-xl text-xs text-primary-foreground">
                    <Bell className="mr-1.5 h-3.5 w-3.5" /> Notify Me
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </motion.div>

        {/* Back to Dashboard CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="flex justify-center gap-3"
        >
          <Button variant="outline" size="sm" onClick={() => navigate({ to: "/" })} className="rounded-xl">
            Back to Dashboard
          </Button>
          <Button size="sm" onClick={() => navigate({ to: "/transactions" })} className="gradient-primary rounded-xl text-primary-foreground">
            Go to Transactions <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
