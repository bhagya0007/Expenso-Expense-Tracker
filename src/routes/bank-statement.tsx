import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useRef, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Upload, FileText, CheckCircle2, X, Building2, Plus, TrendingUp, TrendingDown, ListChecks } from "lucide-react";
import { toast } from "sonner";
import { parseBankStatement, cleanDescriptionAndRef, type ParseResult, type ParsedTxn } from "@/lib/bank-parser";
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
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [parseRunId, setParseRunId] = useState(0);
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
      setProgress(50);
      console.log("[bank-statement] Parse result:", {
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
        setStatus("No readable text found in this PDF — it may be a scanned image or password-protected.");
      } else if (res.transactions.length === 0) {
        setStatus(`Found ${res.rawLines} text lines but no transaction rows matched.`);
      }
      setStatus("Finalizing…");
      setProgress(95);
      setResult(res);
      setProgress(100);
      setStatus("Done");
      if (res.transactions.length === 0 && res.rawLines === 0) {
        toast.warning("No text detected — this statement may be a scanned image or password-protected PDF");
      } else if (res.transactions.length === 0) {
        toast.warning(`Found ${res.rawLines} text lines but could not match any transaction rows. The statement format may not be supported yet.`);
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


  function reset() {
    activeParseRef.current += 1;
    if (inputRef.current) inputRef.current.value = "";
    clearParsingState(null);
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
          Bank Statement Analyzer
        </h1>
        <p className="text-sm text-muted-foreground">
          Upload a PDF statement. We extract every real transaction — never guessed, never invented.
        </p>
      </motion.div>

      {/* Upload zone */}
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
              // Reset so selecting the same file again re-triggers onChange.
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
            ⚠️ Only upload <strong>password-free, text-based</strong> PDFs. Scanned images and password-protected files cannot be parsed.
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

      {/* File status */}
      <AnimatePresence>
        {file && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className="gradient-card border-border/60 p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15 text-primary">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{file.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {(file.size / 1024).toFixed(1)} KB
                    {result && ` · ${result.scannedPages ?? result.totalPages}/${result.totalPages} pages · ${result.rawLines} lines scanned`}
                  </div>
                </div>
                <Button size="icon" variant="ghost" onClick={reset} className="rounded-xl">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {busy && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-primary" />
                      {status || "Please wait — parsing your statement…"}
                    </span>
                    <span className="font-semibold tabular-nums text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5" />
                </div>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary + transactions */}
      <AnimatePresence>
        {result && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="space-y-6"
          >
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard icon={Building2} label="Bank" value={result.bank} tone="primary" />
              <StatCard
                icon={ListChecks}
                label="Transactions"
                value={String(result.transactions.length)}
                tone="accent"
              />
              <StatCard
                icon={TrendingUp}
                label="Total credits"
                value={inr(result.transactions.reduce((s, t) => s + (t.credit ?? 0), 0))}
                tone="success"
              />
              <StatCard
                icon={TrendingDown}
                label="Total debits"
                value={inr(result.transactions.reduce((s, t) => s + (t.debit ?? 0), 0))}
                tone="warning"
              />
            </div>

            <TransactionsTable key={parseRunId} rows={result.transactions} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function inferCategory(desc: string): Category {
  const d = desc.toLowerCase();
  if (/salary|payroll|stipend/.test(d)) return "Salary";
  if (/swiggy|zomato|restaurant|food|cafe|dining/.test(d)) return "Food & Dining";
  if (/uber|ola|rapido|metro|fuel|petrol|diesel/.test(d)) return "Transport";
  if (/amazon|flipkart|myntra|shopping|mall/.test(d)) return "Shopping";
  if (/netflix|prime|spotify|hotstar|entertainment/.test(d)) return "Entertainment";
  if (/electricity|water|gas|broadband|mobile|recharge|bill/.test(d)) return "Bills & Utilities";
  if (/hospital|pharmacy|medic|health/.test(d)) return "Health";
  if (/mutual|sip|invest|stock|zerodha|groww/.test(d)) return "Investments";
  if (/neft|imps|upi|transfer/.test(d)) return "Transfer";
  return "Other";
}


function StatCard({
  icon: Icon, label, value, tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string;
  tone: "primary" | "success" | "warning" | "accent" | "muted";
}) {
  const toneMap = {
    primary: "bg-primary/15 text-primary",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    accent: "bg-accent/15 text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
  } as const;
  return (
    <Card className="gradient-card border-border/60 p-4">
      <div className={cn("grid h-9 w-9 place-items-center rounded-xl", toneMap[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="mt-3 text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-display text-xl font-semibold">{value}</div>
    </Card>
  );
}

function TransactionsTable({ rows }: { rows: ParsedTxn[] }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<Set<string>>(new Set());

  const importable = useMemo(
    () => rows.filter((r) => (r.debit ?? 0) > 0 || (r.credit ?? 0) > 0),
    [rows],
  );

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  const toggleAll = () =>
    setSelected((s) =>
      s.size === importable.length ? new Set() : new Set(importable.map((r) => r.id)),
    );

  async function importRows(list: ParsedTxn[]) {
    const accs = await api.listAccounts();
    const accountId = accs[0]?.id ?? "unassigned";
    const payloads = list
      .map((r) => {
        const isCredit = (r.credit ?? 0) > 0;
        const amount = isCredit ? r.credit! : r.debit!;
        if (!amount || amount <= 0) return null;
        const { cleanMerchant, reference } = cleanDescriptionAndRef(r.description, r.reference);
        return {
          type: isCredit ? ("income" as const) : ("expense" as const),
          amount,
          category: isCredit ? "Salary" : inferCategory(cleanMerchant),
          merchant: cleanMerchant,
          date: r.date ?? new Date().toISOString(),
          notes: reference ? `Ref: ${reference}` : undefined,
          paymentMethod: "Bank" as PaymentMethod,
          accountId,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    // Chunked write to keep the main thread responsive for very large statements.
    const CHUNK = 500;
    const created: Transaction[] = [];
    for (let i = 0; i < payloads.length; i += CHUNK) {
      const slice = payloads.slice(i, i + CHUNK);
      const batch = await api.createTransactionsBulk(slice);
      created.push(...batch);
      if (i + CHUNK < payloads.length) {
        // yield to the event loop between chunks so the UI stays smooth
        await new Promise((r) => setTimeout(r, 0));
      }
    }
    return { count: created.length, created };
  }

  const importMut = useMutation({
    mutationFn: async (list: ParsedTxn[]) => importRows(list),
    onMutate: (list) => {
      // Optimistic UI: mark rows as added instantly.
      setAdded((s) => {
        const n = new Set(s);
        list.forEach((r) => n.add(r.id));
        return n;
      });
      setSelected(new Set());
    },
    onSuccess: ({ count, created }) => {
      // Prepend new transactions to the cache instantly — no refetch needed.
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
      // Roll back optimistic "added" marks on failure.
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
              Please make sure your PDF is <strong>not password-protected</strong> and contains <strong>selectable text</strong> (not a scanned image).<br />
              Tip: Try opening the PDF and selecting text with your mouse. If you can't select any text, the file is a scanned image and cannot be parsed.
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
                    <div className="line-clamp-2">{r.description}</div>
                    {r.issues.length > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground">{r.issues[0]}</div>
                    )}
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
                    {isAdded ? (
                      <Badge variant="outline" className="gap-1 text-[10px] text-success">
                        <CheckCircle2 className="h-3 w-3" /> Added
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!canImport || importMut.isPending}
                        onClick={() => importMut.mutate([r])}
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Add
                      </Button>
                    )}
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
