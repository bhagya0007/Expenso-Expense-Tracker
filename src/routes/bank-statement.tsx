import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, ShieldCheck, FileText, CheckCircle2, Lock,
  Building2, ArrowRight, Table, Layers, Check, RefreshCcw,
} from "lucide-react";
import { StatementDropzone } from "@/bank-statement/components/statement-dropzone";
import { StatementPreview } from "@/bank-statement/components/statement-preview";
import { statementImportService } from "@/bank-statement/services/statement-import.service";
import type { StatementUploadResponse } from "@/bank-statement/services/statement-upload.service";
import type { BankStatement } from "@/bank-statement/types/statement";
import type { BankTransaction } from "@/bank-statement/types/transaction";
import { toast } from "sonner";

export const Route = createFileRoute("/bank-statement")({
  head: () => ({
    meta: [
      { title: "Bank Statement Parser | Expenso" },
      { name: "description", content: "Parse digital & scanned bank statements with 100% privacy and zero-error transaction extraction." },
    ],
  }),
  component: BankStatementPage,
});

function BankStatementPage() {
  const [activeStep, setActiveStep] = useState<"upload" | "preview" | "completed">("upload");
  const [uploadResult, setUploadResult] = useState<StatementUploadResponse | null>(null);
  const [draftStatement, setDraftStatement] = useState<BankStatement | null>(null);
  const [draftTransactions, setDraftTransactions] = useState<BankTransaction[]>([]);

  // Triggered when PDF is uploaded & parsed
  const handleUploadSuccess = (response: StatementUploadResponse) => {
    setUploadResult(response);

    if (response.parsedResult && response.parsedResult.transactions) {
      const parsedStmt = response.parsedResult.statement;
      const parsedTxs = response.parsedResult.transactions;

      setDraftStatement(parsedStmt);
      setDraftTransactions(parsedTxs);
      setActiveStep("preview");
      toast.success(`Successfully extracted ${parsedTxs.length} transactions from ${parsedStmt.bankName}!`);
    } else {
      toast.error("Failed to extract statement data. Please try again.");
    }
  };

  // Triggered when user confirms import on Preview Page
  const handleConfirmImport = async (finalTransactions: BankTransaction[]) => {
    if (!draftStatement) return;

    await statementImportService.importStatementTransactions(draftStatement, finalTransactions);
    setActiveStep("completed");
  };

  // Reset back to upload
  const handleReset = () => {
    setActiveStep("upload");
    setUploadResult(null);
    setDraftStatement(null);
    setDraftTransactions([]);
  };

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden p-6 md:p-10 space-y-8">
      {/* Background Decorative Glow */}
      <div className="pointer-events-none absolute -top-32 left-1/2 -translate-x-1/2 h-96 w-[600px] rounded-full gradient-primary opacity-20 blur-3xl" />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 max-w-6xl mx-auto">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-primary mb-2">
            <Sparkles className="h-3.5 w-3.5" /> Bank Statement Intelligence
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
            Bank Statement Parser
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload PDF bank statements. Transactions are extracted, categorized, and imported into your ledger.
          </p>
        </div>

        {/* Step Indicator Badges */}
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`rounded-xl px-3 py-1 text-xs font-semibold ${
              activeStep === "upload" ? "border-primary text-primary bg-primary/10" : "border-border/60 text-muted-foreground"
            }`}
          >
            1. Upload PDF
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant="outline"
            className={`rounded-xl px-3 py-1 text-xs font-semibold ${
              activeStep === "preview" ? "border-primary text-primary bg-primary/10" : "border-border/60 text-muted-foreground"
            }`}
          >
            2. Draft Preview
          </Badge>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          <Badge
            variant="outline"
            className={`rounded-xl px-3 py-1 text-xs font-semibold ${
              activeStep === "completed" ? "border-emerald-500 text-emerald-400 bg-emerald-500/10" : "border-border/60 text-muted-foreground"
            }`}
          >
            3. Imported
          </Badge>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto">
        <AnimatePresence mode="wait">
          {activeStep === "upload" && (
            <motion.div
              key="step-upload"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <StatementDropzone onUploadSuccess={handleUploadSuccess} />
            </motion.div>
          )}

          {activeStep === "preview" && draftStatement && (
            <motion.div
              key="step-preview"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
            >
              <StatementPreview
                statement={draftStatement}
                initialTransactions={draftTransactions}
                onConfirmImport={handleConfirmImport}
                onCancel={handleReset}
              />
            </motion.div>
          )}

          {activeStep === "completed" && (
            <motion.div
              key="step-completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center py-12 max-w-xl mx-auto space-y-6"
            >
              <Card className="p-8 border-emerald-500/30 gradient-card shadow-glow space-y-6">
                <div className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-400 mx-auto border border-emerald-500/30">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                  <h2 className="font-display text-2xl font-bold text-foreground">
                    Bank Statement Successfully Imported!
                  </h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Transactions have been saved with source <code className="text-primary font-mono font-semibold">bank_statement</code>. Your dashboard charts and budget metrics have been updated.
                  </p>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Button
                    type="button"
                    onClick={handleReset}
                    className="w-full sm:w-auto rounded-xl gradient-primary text-primary-foreground font-semibold shadow-glow px-6"
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" /> Upload Another Statement
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
