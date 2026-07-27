import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Upload, FileText, CheckCircle2, X, Building2, Plus, TrendingUp, TrendingDown, ListChecks, Trash2, Pencil, Clipboard, ShieldCheck, Eye, LayoutGrid, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { parseBankStatement, ocrExtractLines, parseFromExtraction, cleanDescriptionAndRef, type ParseResult, type ParsedTxn } from "@/lib/bank-parser";
import { api } from "@/lib/api";
import type { Category, PaymentMethod, Transaction } from "@/lib/types";
import { inr } from "@/lib/format";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/bank-statement")({
  head: () => ({
    meta: [
      { title: "Bank Statement Analyzer — Expenso" },
      { name: "description", content: "Upload a bank statement PDF and extract real transactions into Expenso." },
      { property: "og:title", content: "Bank Statement Analyzer — Expenso" },
      { property: "og:description", content: "Extract bank statement PDF transactions accurately and add them to Expenso." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BankStatementPage,
});

function BankStatementPage() {
  const [tabMode, setTabMode] = useState<"pdf" | "paste">("pdf");
  const [pastedText, setPastedText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [parseRunId, setParseRunId] = useState(0);
  const [editingRow, setEditingRow] = useState<ParsedTxn | null>(null);
  const [splitView, setSplitView] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeParseRef = useRef(0);

  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);

  function clearParsingState(nextFile: File | null = null) {
    toast.dismiss();
    setFile(nextFile);
    setResult(null);
    setBusy(false);
    setProgress(0);
    setStatus("");
    setParseRunId((id) => id + 1);
  }

  async function handleFile(f: File) {
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      activeParseRef.current += 1;
      clearParsingState(null);
      toast.error("Please upload a PDF bank statement");
      return;
    }

    const runId = activeParseRef.current + 1;
    activeParseRef.current = runId;
    clearParsingState(f);

    setBusy(true);
    setProgress(5);
    setStatus("Uploading PDF…");
    const isCurrentRun = () => activeParseRef.current === runId;
    const tick = setInterval(() => {
      if (!isCurrentRun()) return;
      setProgress((p) => (p < 90 ? p + 1 : p));
    }, 300);
    try {
      let res: ParseResult;
      setStatus("Detecting document type & extracting tables…");
      setProgress(25);
      try {
        res = await parseBankStatement(f);
      } catch (parseErr) {
        console.error("Deterministic parse failed", parseErr);
        res = { bank: "Bank", documentType: "Digital PDF", transactions: [], totalPages: 0, rawLines: 0, flagged: 0 };
      }
      if (!isCurrentRun()) return;

      // If no text was extracted, try OCR
      if (res.rawLines === 0) {
        console.log("[bank-statement] No digital text layer found — starting OCR pipeline…");
        setStatus("Scanned PDF detected — starting OCR processing…");
        setProgress(35);
        try {
          const ocrExtraction = await ocrExtractLines(f, (statusMsg, pct) => {
            if (!isCurrentRun()) return;
            setStatus(statusMsg);
            setProgress(pct);
          });
          if (!isCurrentRun()) return;
          console.log("[bank-statement] OCR extraction result:", {
            lines: ocrExtraction.lines.length,
            pages: ocrExtraction.pages,
          });
          if (ocrExtraction.lines.length > 0) {
            res = parseFromExtraction(ocrExtraction, "Scanned PDF (OCR)");
            toast.info("Extracted via OCR — please review highlighted rows.");
          }
        } catch (ocrErr) {
          console.error("OCR extraction failed:", ocrErr);
          toast.error("OCR extraction failed — please try pasting statement text.");
        }
      }
      if (!isCurrentRun()) return;

      setProgress(75);
      setStatus("Parsing rows into structured transactions…");
      console.log("[bank-statement] Final parse result:", {
        bank: res.bank,
        docType: res.documentType,
        transactions: res.transactions.length,
        rawLines: res.rawLines,
        totalPages: res.totalPages,
        extractionWarning: res.extractionWarning,
      });

      if (res.extractionWarning) {
        toast.info(res.extractionWarning);
      }
      setStatus("Generating insights & completing extraction…");
      setProgress(95);
      setResult(res);
      setProgress(100);
      setStatus("Completed");

      if (res.transactions.length === 0 && res.rawLines === 0) {
        toast.warning("No text detected even with OCR — try pasting statement text below.");
      } else if (res.transactions.length === 0) {
        toast.warning(`Found ${res.rawLines} lines but no valid transaction rows matched. You can paste statement text directly.`);
      } else {
        toast.success(`Extracted ${res.transactions.length} real transactions from ${res.bank}`);
      }
    } catch (err) {
      if (!isCurrentRun()) return;
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Could not parse this PDF: ${msg.slice(0, 120)}`);
    } finally {
      clearInterval(tick);
      if (isCurrentRun()) setBusy(false);
    }
  }

  function handleParsePastedText() {
    if (!pastedText.trim()) {
      toast.error("Please paste statement text or CSV rows first");
      return;
    }
    const lines = pastedText.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      toast.error("No text lines found in pasted content");
      return;
    }
    const res = parseFromExtraction(
      {
        lines,
        pages: 1,
        totalPages: 1,
        skippedPages: 0,
        warnings: [],
      },
      "Pasted Text",
    );
    setResult(res);
    if (res.transactions.length === 0) {
      toast.warning("Could not detect structured transactions in pasted text. Make sure it contains dates and amounts.");
    } else {
      toast.success(`Extracted ${res.transactions.length} transactions from pasted text!`);
    }
  }

  function handleDeleteRow(id: string) {
    if (!result) return;
    setResult({
      ...result,
      transactions: result.transactions.filter((t) => t.id !== id),
    });
    toast.info("Row removed");
  }

  function handleSaveRow(updated: ParsedTxn) {
    if (!result) return;
    setResult({
      ...result,
      transactions: result.transactions.map((t) => (t.id === updated.id ? updated : t)),
    });
    setEditingRow(null);
    toast.success("Row updated");
  }

  function reset() {
    activeParseRef.current += 1;
    if (inputRef.current) inputRef.current.value = "";
    setPastedText("");
    clearParsingState(null);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
            Bank Statement Analyzer
          </h1>
          <p className="text-sm text-muted-foreground">
            Deterministic extraction from PDF & OCR statements — AI never fabricates missing transactions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {result && fileUrl && (
            <Button
              size="sm"
              variant={splitView ? "secondary" : "outline"}
              onClick={() => setSplitView(!splitView)}
              className="text-xs"
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              {splitView ? "Split View (On)" : "Split View (Off)"}
            </Button>
          )}
          <div className="flex rounded-xl border border-border/60 bg-muted/40 p-1">
            <Button
              size="sm"
              variant={tabMode === "pdf" ? "secondary" : "ghost"}
              onClick={() => setTabMode("pdf")}
              className="rounded-lg text-xs"
            >
              <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload PDF
            </Button>
            <Button
              size="sm"
              variant={tabMode === "paste" ? "secondary" : "ghost"}
              onClick={() => setTabMode("paste")}
              className="rounded-lg text-xs"
            >
              <Clipboard className="mr-1.5 h-3.5 w-3.5" /> Paste Text / CSV
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Security Privacy Notice */}
      <Card className="gradient-card border-border/60 bg-primary/5 p-3 text-xs text-muted-foreground flex items-center gap-2.5">
        <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
        <div>
          <strong>Deterministic & Private Processing:</strong> Extracted directly on your device. Account numbers, IFSC codes, and PAN numbers are automatically masked. AI models never invent or hallucinate entries.
        </div>
      </Card>

      {/* Mode 1: PDF Upload zone */}
      {tabMode === "pdf" && !result && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <Card
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
            className={cn(
              "gradient-card border-dashed border-2 p-8 text-center transition-all",
              dragOver ? "border-primary shadow-glow" : "border-border/60",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleFile(f);
              }}
            />
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl gradient-primary shadow-glow">
              <Upload className="h-7 w-7 text-primary-foreground" />
            </div>
            <h3 className="mt-4 font-display text-lg font-semibold">Drop your Bank Statement PDF here</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              SBI · HDFC · ICICI · Axis · PNB · Kotak · Yes Bank · IDFC
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              📄 Supports both Digital PDFs and Scanned Image Statements (OCR).
            </p>
            <Button
              className="mt-5 gradient-primary text-primary-foreground"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                inputRef.current?.click();
              }}
            >
              Choose PDF File
            </Button>
          </Card>
        </motion.div>
      )}

      {/* Mode 2: Paste Statement Text */}
      {tabMode === "paste" && !result && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <Card className="gradient-card p-6 border-border/60">
            <h3 className="font-display text-base font-semibold">Paste Statement Text or CSV</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Copy transaction rows directly from your bank portal, PDF viewer, or CSV file and paste below.
            </p>
            <Textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder="e.g.&#10;15/06/2024 Swiggy UPI/416592 450.00 Dr 12500.00&#10;16/06/2024 Salary Credit 45000.00 Cr 57500.00"
              className="mt-3 min-h-[160px] font-mono text-xs"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPastedText("")} disabled={!pastedText}>
                Clear
              </Button>
              <Button size="sm" className="gradient-primary text-primary-foreground" onClick={handleParsePastedText}>
                <Plus className="mr-1.5 h-3.5 w-3.5" /> Parse Pasted Text
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* File status / progress */}
      <AnimatePresence>
        {busy && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Card className="gradient-card border-border/60 p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                <span>{status}</span>
                <span className="font-semibold text-primary">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview metrics */}
      {result && <OverviewCards result={result} onReset={reset} />}

      {/* Main Content Area: Split View vs Full Table View */}
      {result && (
        <div className={cn("grid gap-6", splitView && fileUrl ? "grid-cols-1 lg:grid-cols-12" : "grid-cols-1")}>
          {/* Left Panel: Original Document Preview */}
          {splitView && fileUrl && (
            <div className="lg:col-span-5 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                <span className="font-medium">Original Document</span>
                <span>{file?.name}</span>
              </div>
              <Card className="gradient-card overflow-hidden border-border/60 p-0 h-[650px]">
                <iframe
                  src={fileUrl}
                  className="w-full h-full border-none rounded-xl"
                  title="PDF Preview"
                />
              </Card>
            </div>
          )}

          {/* Right Panel: Extracted Transactions Table */}
          <div className={cn(splitView && fileUrl ? "lg:col-span-7" : "w-full")}>
            <ResultTable
              key={parseRunId}
              result={result}
              onDeleteRow={handleDeleteRow}
              onEditRow={(row) => setEditingRow(row)}
            />
          </div>
        </div>
      )}

      {/* Edit Row Dialog */}
      {editingRow && (
        <EditRowModal
          row={editingRow}
          onClose={() => setEditingRow(null)}
          onSave={handleSaveRow}
        />
      )}
    </div>
  );
}

function OverviewCards({ result, onReset }: { result: ParseResult; onReset: () => void }) {
  const totalDebits = useMemo(
    () => result.transactions.reduce((acc, t) => acc + (t.debit ?? 0), 0),
    [result],
  );
  const totalCredits = useMemo(
    () => result.transactions.reduce((acc, t) => acc + (t.credit ?? 0), 0),
    [result],
  );

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Card className="gradient-card border-border/60 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Bank / Type</div>
            <div className="font-display text-base font-bold truncate">{result.bank}</div>
            <div className="text-[11px] text-muted-foreground">{result.documentType}</div>
          </div>
        </div>
      </Card>

      <Card className="gradient-card border-border/60 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent/10 text-accent shrink-0">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Extracted Rows</div>
            <div className="font-display text-lg font-bold">{result.transactions.length}</div>
            <div className="text-[11px] text-muted-foreground">{result.flagged} flagged</div>
          </div>
        </div>
      </Card>

      <Card className="gradient-card border-border/60 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-success/10 text-success shrink-0">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Credits</div>
            <div className="font-display text-lg font-bold text-success">{inr(totalCredits)}</div>
          </div>
        </div>
      </Card>

      <Card className="gradient-card border-border/60 p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive shrink-0">
            <TrendingDown className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Total Debits</div>
            <div className="font-display text-lg font-bold text-destructive">{inr(totalDebits)}</div>
          </div>
        </div>
      </Card>

      <Card className="gradient-card border-border/60 p-4 flex items-center justify-center">
        <Button variant="outline" size="sm" onClick={onReset} className="w-full">
          <X className="mr-1.5 h-3.5 w-3.5" /> Upload Another
        </Button>
      </Card>
    </div>
  );
}

function EditRowModal({
  row,
  onClose,
  onSave,
}: {
  row: ParsedTxn;
  onClose: () => void;
  onSave: (updated: ParsedTxn) => void;
}) {
  const [description, setDescription] = useState(row.description);
  const [rawDate, setRawDate] = useState(row.rawDate);
  const [debit, setDebit] = useState(row.debit != null ? String(row.debit) : "");
  const [credit, setCredit] = useState(row.credit != null ? String(row.credit) : "");
  const [reference, setReference] = useState(row.reference || "");

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave({
      ...row,
      description: description.trim() || "Transaction",
      rawDate: rawDate.trim(),
      debit: debit.trim() ? Number(debit) : null,
      credit: credit.trim() ? Number(credit) : null,
      reference: reference.trim() || null,
      confidence: 1.0,
      needsReview: false,
    });
  }

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Extracted Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleFormSubmit} className="space-y-4 py-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground">Merchant / Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
              placeholder="e.g. Swiggy, Amazon, Salary"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Debit (₹)</label>
              <Input
                type="number"
                step="0.01"
                value={debit}
                onChange={(e) => { setDebit(e.target.value); if (e.target.value) setCredit(""); }}
                className="mt-1"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Credit (₹)</label>
              <Input
                type="number"
                step="0.01"
                value={credit}
                onChange={(e) => { setCredit(e.target.value); if (e.target.value) setDebit(""); }}
                className="mt-1"
                placeholder="0.00"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Raw Date</label>
              <Input
                value={rawDate}
                onChange={(e) => setRawDate(e.target.value)}
                className="mt-1"
                placeholder="15/06/2024"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Reference / Txn No.</label>
              <Input
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1"
                placeholder="e.g. UPI/123456"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="gradient-primary text-primary-foreground">
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResultTable({
  result,
  onDeleteRow,
  onEditRow,
}: {
  result: ParseResult;
  onDeleteRow: (id: string) => void;
  onEditRow: (row: ParsedTxn) => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [filterMode, setFilterMode] = useState<"all" | "review" | "high">("all");

  const allRows = result.transactions;
  const filteredRows = useMemo(() => {
    if (filterMode === "review") return allRows.filter((r) => r.needsReview || r.confidence < 0.80);
    if (filterMode === "high") return allRows.filter((r) => r.confidence >= 0.95);
    return allRows;
  }, [allRows, filterMode]);

  const importable = useMemo(() => filteredRows.filter((r) => (r.debit ?? 0) > 0 || (r.credit ?? 0) > 0), [filteredRows]);

  const [selected, setSelected] = useState<Set<string>>(() => new Set(importable.map((r) => r.id)));
  const [added, setAdded] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === importable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importable.map((r) => r.id)));
    }
  }

  const importMut = useMutation({
    mutationFn: async (list: ParsedTxn[]) => {
      const createdList: Transaction[] = [];
      for (const r of list) {
        const isCredit = (r.credit ?? 0) > 0;
        const amount = isCredit ? r.credit! : r.debit!;
        if (!amount || amount <= 0) continue;
        const { cleanMerchant, reference } = cleanDescriptionAndRef(r.description, r.reference);
        const created = await api.createTransaction({
          type: isCredit ? "income" : "expense",
          amount,
          merchant: cleanMerchant || "Bank Statement Import",
          category: isCredit ? "Income" : "Shopping",
          paymentMethod: "Bank Transfer" as PaymentMethod,
          date: r.date ?? new Date().toISOString(),
          notes: reference ? `Ref: ${reference}` : undefined,
        });
        createdList.push(created);
      }
      return { count: createdList.length, created: createdList };
    },
    onMutate: (list) => {
      setAdded((s) => {
        const n = new Set(s);
        list.forEach((r) => n.add(r.id));
        return n;
      });
    },
    onSuccess: ({ count, created }) => {
      qc.setQueryData<Transaction[]>(["transactions"], (prev) =>
        prev ? [...created, ...prev] : created,
      );
      qc.invalidateQueries({ queryKey: ["insights"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      toast.success(`Added ${count} transaction${count === 1 ? "" : "s"}`, {
        action: { label: "View", onClick: () => navigate({ to: "/transactions" }) },
      });
    },
    onError: (_e, list) => {
      setAdded((s) => {
        const n = new Set(s);
        list.forEach((r) => n.delete(r.id));
        return n;
      });
      toast.error("Could not add transactions");
    },
  });

  if (allRows.length === 0) {
    return (
      <Card className="gradient-card border-border/60 p-6">
        <div className="grid h-48 place-items-center text-center">
          <div>
            <p className="text-sm text-muted-foreground">No transactions detected.</p>
            <p className="mt-2 text-xs text-muted-foreground/70">
              Try switching to the <strong>Paste Text / CSV</strong> tab above and paste statement text directly.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  const allSelected = selected.size > 0 && selected.size === importable.length;
  const selectedRows = importable.filter((r) => selected.has(r.id));

  return (
    <Card className="gradient-card overflow-hidden border-border/60 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border/60 bg-muted/40 p-0.5 text-xs">
            <button
              onClick={() => setFilterMode("all")}
              className={cn("rounded-md px-2.5 py-1 transition-colors", filterMode === "all" ? "bg-background font-semibold shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              All ({allRows.length})
            </button>
            <button
              onClick={() => setFilterMode("high")}
              className={cn("rounded-md px-2.5 py-1 transition-colors", filterMode === "high" ? "bg-background font-semibold shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              High &gt;95% ({allRows.filter((r) => r.confidence >= 0.95).length})
            </button>
            <button
              onClick={() => setFilterMode("review")}
              className={cn("rounded-md px-2.5 py-1 transition-colors", filterMode === "review" ? "bg-background font-semibold shadow-sm text-destructive font-medium" : "text-muted-foreground hover:text-foreground")}
            >
              Needs Review ({allRows.filter((r) => r.needsReview || r.confidence < 0.80).length})
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={selected.size === 0 || importMut.isPending}
            onClick={() => importMut.mutate(selectedRows)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add selected ({selected.size})
          </Button>
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground"
            disabled={importMut.isPending || importable.every((r) => added.has(r.id))}
            onClick={() => importMut.mutate(importable.filter((r) => !added.has(r.id)))}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Approve & Add All
          </Button>
        </div>
      </div>
      <div className="max-h-[560px] overflow-y-auto scroll-smooth">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl">
            <tr className="border-b border-border/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="w-10 px-4 py-3">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
              </th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3 text-right">Debit</th>
              <th className="px-4 py-3 text-right">Credit</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">Ref</th>
              <th className="px-4 py-3 text-center">Confidence</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r, i) => {
              const canImport = (r.debit ?? 0) > 0 || (r.credit ?? 0) > 0;
              const isAdded = added.has(r.id);
              const confPct = Math.round(r.confidence * 100);
              const isHigh = r.confidence >= 0.95;
              const isMed = r.confidence >= 0.80 && r.confidence < 0.95;

              return (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.4), duration: 0.25 }}
                  className={cn(
                    "border-b border-border/40 transition-colors hover:bg-muted/30",
                    isAdded && "opacity-60",
                    r.needsReview && "bg-destructive/5",
                  )}
                >
                  <td className="px-4 py-3">
                    <Checkbox
                      checked={selected.has(r.id)}
                      onCheckedChange={() => toggle(r.id)}
                      disabled={!canImport || isAdded}
                      aria-label="Select row"
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="text-sm font-medium">
                      {r.date ? new Date(r.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">{r.rawDate}</div>
                  </td>
                  <td className="max-w-md px-4 py-3">
                    <div className="line-clamp-2 font-medium">{r.description}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-destructive">
                    {r.debit != null ? inr(r.debit) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-success">
                    {r.credit != null ? inr(r.credit) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-medium">
                    {r.balance != null ? inr(r.balance) : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                    {r.reference ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-center">
                    {isHigh ? (
                      <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] font-semibold">
                        &gt;95% High
                      </Badge>
                    ) : isMed ? (
                      <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] font-semibold">
                        80–95%
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] font-semibold">
                        &lt;80% Review
                      </Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit row"
                        onClick={() => onEditRow(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        title="Delete row"
                        onClick={() => onDeleteRow(r.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                      {isAdded ? (
                        <Badge variant="outline" className="gap-1 text-[10px] text-success ml-1">
                          <CheckCircle2 className="h-3 w-3" /> Added
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-1"
                          disabled={!canImport || importMut.isPending}
                          onClick={() => importMut.mutate([r])}
                        >
                          <Plus className="mr-1 h-3.5 w-3.5" /> Add
                        </Button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
