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
import { Upload, FileText, CheckCircle2, X, Building2, Plus, TrendingUp, TrendingDown, ListChecks, Trash2, Pencil, Clipboard } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);
  const activeParseRef = useRef(0);

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
    setStatus("Reading PDF…");
    const isCurrentRun = () => activeParseRef.current === runId;
    const tick = setInterval(() => {
      if (!isCurrentRun()) return;
      setProgress((p) => (p < 90 ? p + 1 : p));
    }, 300);
    try {
      let res: ParseResult;
      setStatus("Extracting text from PDF…");
      setProgress(20);
      try {
        res = await parseBankStatement(f);
      } catch (parseErr) {
        console.error("Deterministic parse failed", parseErr);
        res = { bank: "Bank", transactions: [], totalPages: 0, rawLines: 0, flagged: 0 };
      }
      if (!isCurrentRun()) return;

      // If no text was extracted, try OCR
      if (res.rawLines === 0) {
        console.log("[bank-statement] No text layer found — falling back to OCR…");
        setStatus("No text layer found — starting OCR scan…");
        setProgress(15);
        try {
          const ocrExtraction = await ocrExtractLines(f, (status, pct) => {
            if (!isCurrentRun()) return;
            setStatus(status);
            setProgress(pct);
          });
          if (!isCurrentRun()) return;
          console.log("[bank-statement] OCR extraction result:", {
            lines: ocrExtraction.lines.length,
            pages: ocrExtraction.pages,
          });
          if (ocrExtraction.lines.length > 0) {
            res = parseFromExtraction(ocrExtraction);
            toast.info("Text extracted using OCR — please verify the values.");
          }
        } catch (ocrErr) {
          console.error("OCR extraction failed:", ocrErr);
          toast.error("OCR extraction failed — please try a different file.");
        }
      }
      if (!isCurrentRun()) return;

      setProgress(50);
      console.log("[bank-statement] Final parse result:", {
        bank: res.bank,
        transactions: res.transactions.length,
        rawLines: res.rawLines,
        totalPages: res.totalPages,
        extractionWarning: res.extractionWarning,
      });
      setStatus(`Detected ${res.transactions.length} rows from ${res.rawLines} text lines — checking quality…`);
      if (res.extractionWarning) {
        toast.info(res.extractionWarning);
      }
      if (res.transactions.length === 0 && res.rawLines === 0) {
        setStatus("No readable text found in this PDF.");
      } else if (res.transactions.length === 0) {
        setStatus(`Found ${res.rawLines} text lines but no transaction rows matched.`);
      }
      setStatus("Finalizing…");
      setProgress(95);
      setResult(res);
      setProgress(100);
      setStatus("Done");
      if (res.transactions.length === 0 && res.rawLines === 0) {
        toast.warning("No text detected even with OCR — try pasting statement text below.");
      } else if (res.transactions.length === 0) {
        toast.warning(`Found ${res.rawLines} text lines but could not match any transaction rows. You can paste statement text directly.`);
      } else {
        toast.success(`Extracted ${res.transactions.length} transactions from ${res.bank}`);
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
    const res = parseFromExtraction({
      lines,
      pages: 1,
      totalPages: 1,
      skippedPages: 0,
      warnings: [],
    });
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
            Upload a PDF statement or paste statement text. We extract every real transaction accurately.
          </p>
        </div>
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
      </motion.div>

      {/* Mode 1: PDF Upload zone */}
      {tabMode === "pdf" && (
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
            <h3 className="mt-4 font-display text-lg font-semibold">Drop your PDF here</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              SBI · HDFC · ICICI · Axis · PNB · Kotak · Yes Bank · IDFC
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              📄 Upload <strong>password-free</strong> PDFs. Supports both text-based and scanned image statements.
            </p>
            <Button
              className="mt-5 gradient-primary text-primary-foreground"
              onClick={() => {
                if (inputRef.current) inputRef.current.value = "";
                inputRef.current?.click();
              }}
            >
              Choose file
            </Button>
          </Card>
        </motion.div>
      )}

      {/* Mode 2: Paste Statement Text */}
      {tabMode === "paste" && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.4 }}
        >
          <Card className="gradient-card p-6 border-border/60">
            <h3 className="font-display text-base font-semibold">Paste Statement Text or CSV</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Copy transaction rows directly from your bank website, PDF viewer, or CSV file and paste below.
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
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results grid / table */}
      {result && (
        <ResultTable
          key={parseRunId}
          result={result}
          onDeleteRow={handleDeleteRow}
          onEditRow={(row) => setEditingRow(row)}
        />
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

  const rows = result.transactions;
  const importable = useMemo(() => rows.filter((r) => (r.debit ?? 0) > 0 || (r.credit ?? 0) > 0), [rows]);

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

  if (rows.length === 0) {
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
        <div className="text-sm text-muted-foreground">
          {selected.size > 0
            ? `${selected.size} selected`
            : `${importable.length} importable · ${added.size} added`}
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={selected.size === 0 || importMut.isPending}
            onClick={() => importMut.mutate(selectedRows)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add selected
          </Button>
          <Button
            size="sm"
            className="gradient-primary text-primary-foreground"
            disabled={importMut.isPending || importable.every((r) => added.has(r.id))}
            onClick={() => importMut.mutate(importable.filter((r) => !added.has(r.id)))}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Add all to transactions
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
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const canImport = (r.debit ?? 0) > 0 || (r.credit ?? 0) > 0;
              const isAdded = added.has(r.id);
              return (
                <motion.tr
                  key={r.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.015, 0.4), duration: 0.25 }}
                  className={cn(
                    "border-b border-border/40 transition-colors hover:bg-muted/30",
                    isAdded && "opacity-60",
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
