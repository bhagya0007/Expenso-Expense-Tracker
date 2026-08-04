import { useState, useCallback } from "react";
import { Upload, FileText, Loader2, AlertTriangle, ShieldCheck, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { isPDFFile, processPDFDocument, type PDFProcessProgress } from "@/lib/pdf-processor";
import { bankLayoutEngine } from "@/lib/bank-layout-engine";
import { validateExtractedTransactions } from "@/lib/transaction-validation-engine";
import type { ParseResult, ParsedTxn } from "@/lib/bank-parser";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface StatementUploaderProps {
  onParsed: (result: ParseResult, file: File) => void;
  isProcessing: boolean;
}

export function StatementUploader({ onParsed, isProcessing }: StatementUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [statusText, setStatusText] = useState<string>("");
  const [progressPct, setProgressPct] = useState<number>(0);
  const [warningMsg, setWarningMsg] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState<boolean>(false);

  const processFile = async (file: File) => {
    if (!isPDFFile(file)) {
      toast.error("Invalid file format. Please upload a PDF bank statement.");
      return;
    }

    setWarningMsg(null);
    setIsBusy(true);

    try {
      // Step 1 & 2: Processing (PDF.js / OCR)
      setStatusText("Processing: Reading PDF structure & pages...");
      setProgressPct(15);

      const pdfDoc = await processPDFDocument(file, (progress: PDFProcessProgress) => {
        setStatusText(`Processing: ${progress.message}`);
        setProgressPct(Math.min(65, progress.percent));
      });

      // Step 3: Parsing (Bank Layout Engine: SBI, HDFC, ICICI, Generic)
      setStatusText("Parsing: Detecting bank layout & extracting transaction rows...");
      setProgressPct(75);

      const layoutResult = bankLayoutEngine.detectAndParse(pdfDoc.lines);

      // Step 4: Validation (Transaction Validation Engine)
      setStatusText("Validation: Verifying dates, amounts, and deduplicating rows...");
      setProgressPct(90);

      const validationResult = validateExtractedTransactions(
        layoutResult.transactions,
        layoutResult.errors
      );

      // Convert to UI ParsedTxn format
      const uiTransactions: ParsedTxn[] = validationResult.transactions.map((t, idx) => ({
        id: `txn-${Date.now()}-${idx}`,
        date: t.date,
        rawDate: t.date ? new Date(t.date).toLocaleDateString("en-IN") : "N/A",
        description: t.description,
        debit: t.debit,
        credit: t.credit,
        balance: t.balance,
        reference: null,
        needsReview: false,
        confidence: 0.95,
        issues: [],
        source: pdfDoc.pdfType === "scanned" ? "ocr" : "parser",
      }));

      const finalResult: ParseResult = {
        bank: layoutResult.bankName,
        documentType: pdfDoc.pdfType === "scanned" ? "Scanned PDF (OCR)" : "Digital PDF",
        transactions: uiTransactions,
        totalPages: pdfDoc.totalPages,
        scannedPages: pdfDoc.extractedPages,
        skippedPages: pdfDoc.skippedPages,
        rawLines: pdfDoc.lines.length,
        flagged: validationResult.errors.length,
        extractionWarning: pdfDoc.warnings[0],
      };

      setProgressPct(100);
      setStatusText("Validation Complete!");

      if (uiTransactions.length === 0) {
        toast.warning("No valid transactions could be extracted from this PDF.");
      } else {
        toast.success(`Extracted & Validated ${uiTransactions.length} transactions from ${layoutResult.bankName}!`);
      }

      // Step 5: Preview Transactions
      onParsed(finalResult, file);
    } catch (err: any) {
      console.error("[StatementUploader] Pipeline error:", err);
      const msg = err?.message || "Failed to process PDF statement.";
      setWarningMsg(msg);
      toast.error(msg);
    } finally {
      setIsBusy(false);
      setProgressPct(0);
    }
  };

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        processFile(files[0]);
      }
    },
    [isProcessing, isBusy]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const busy = isProcessing || isBusy;

  return (
    <Card
      className={`relative overflow-hidden border-2 border-dashed transition-all duration-300 p-8 sm:p-12 text-center rounded-3xl ${
        isDragging
          ? "border-primary bg-primary/10 scale-[1.01]"
          : "border-border/80 hover:border-primary/50 bg-card/60 backdrop-blur"
      }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <input
        type="file"
        id="bank-pdf-input"
        accept=".pdf,application/pdf"
        className="hidden"
        disabled={busy}
        onChange={handleFileChange}
      />

      <AnimatePresence mode="wait">
        {busy ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6 max-w-md mx-auto py-4"
          >
            <div className="relative inline-flex items-center justify-center">
              <div className="h-20 w-20 rounded-3xl gradient-primary flex items-center justify-center shadow-glow animate-pulse">
                <FileText className="h-10 w-10 text-primary-foreground" />
              </div>
              <div className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full bg-background border border-primary text-primary">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-lg font-semibold tracking-tight text-foreground">
                Processing & Validating Statement...
              </h3>
              <p className="text-xs text-muted-foreground animate-pulse">{statusText}</p>
            </div>

            {/* Custom Progress Bar */}
            <div className="w-full bg-muted/60 h-2.5 rounded-full overflow-hidden p-0.5 border border-border/50">
              <div
                className="gradient-primary h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>

            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground bg-muted/30 py-1.5 px-3 rounded-full w-fit mx-auto border border-border/40">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
              Upload → Processing → Parsing → Validation
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6 max-w-lg mx-auto"
          >
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-3xl gradient-primary/10 border border-primary/20 text-primary shadow-glow transition-transform duration-300 hover:scale-105">
              <Upload className="h-9 w-9 text-primary" />
            </div>

            <div className="space-y-2">
              <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                Upload Bank Statement PDF
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
                Drag and drop your PDF bank statement, or browse files from your device.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] border-primary/30 bg-primary/5">
                <Sparkles className="mr-1 h-3 w-3 text-primary" /> Auto Layout Engine
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="mr-1 h-3 w-3 text-emerald-500" /> Validation Engine
              </Badge>
              <Badge variant="outline" className="rounded-full px-3 py-1 text-[11px] border-accent/30 bg-accent/5">
                <ShieldCheck className="mr-1 h-3 w-3 text-accent" /> 100% Private
              </Badge>
            </div>

            {warningMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400 text-left">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{warningMsg}</span>
              </div>
            )}

            <div className="pt-2">
              <Button
                size="lg"
                className="rounded-2xl gradient-primary font-semibold px-8 shadow-glow text-xs"
                onClick={() => document.getElementById("bank-pdf-input")?.click()}
              >
                <FileText className="mr-2 h-4 w-4" /> Select PDF File
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
