import { useState, useMemo } from "react";
import {
  Check, Trash2, AlertCircle, ArrowUpRight, ArrowDownRight,
  Building2, ShieldAlert, Sparkles, Filter, CheckSquare, Square,
  Info, Save, RefreshCw, FileText
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { inr } from "@/lib/format";
import { CATEGORIES, PAYMENT_METHODS } from "@/lib/api";
import type { ParseResult, ParsedTxn } from "@/lib/bank-parser";
import type { Account, Category, PaymentMethod, Transaction } from "@/lib/types";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface StatementReviewTableProps {
  parseResult: ParseResult;
  fileName: string;
  accounts: Account[];
  onImportSuccess: () => void;
  onReset: () => void;
  onImportBulk: (txs: Omit<Transaction, "id">[]) => Promise<void>;
}

export function StatementReviewTable({
  parseResult,
  fileName,
  accounts,
  onImportSuccess,
  onReset,
  onImportBulk,
}: StatementReviewTableProps) {
  const [transactions, setTransactions] = useState<ParsedTxn[]>(parseResult.transactions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(parseResult.transactions.map((t) => t.id))
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    accounts.length > 0 ? accounts[0].id : ""
  );
  const [filterFlagged, setFilterFlagged] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Category auto-assignment helper based on transaction description
  const autoCategorize = (desc: string, isCredit: boolean): Category => {
    if (isCredit) return "Salary";
    const d = desc.toLowerCase();
    if (d.includes("swiggy") || d.includes("zomato") || d.includes("restaurant") || d.includes("food") || d.includes("cafe"))
      return "Food & Dining";
    if (d.includes("uber") || d.includes("ola") || d.includes("fuel") || d.includes("petrol") || d.includes("metro"))
      return "Transport";
    if (d.includes("amazon") || d.includes("flipkart") || d.includes("myntra") || d.includes("shopping") || d.includes("mart"))
      return "Shopping";
    if (d.includes("netflix") || d.includes("spotify") || d.includes("movie") || d.includes("pvr") || d.includes("bookmyshow"))
      return "Entertainment";
    if (d.includes("electricity") || d.includes("water") || d.includes("recharge") || d.includes("bill") || d.includes("airtel") || d.includes("jio"))
      return "Bills & Utilities";
    if (d.includes("pharmacy") || d.includes("apollo") || d.includes("hospital") || d.includes("doctor") || d.includes("health"))
      return "Health";
    if (d.includes("sip") || d.includes("mutual") || d.includes("zerodha") || d.includes("groww") || d.includes("stock"))
      return "Investments";
    if (d.includes("rent"))
      return "Rent";
    return "Other";
  };

  // Mutable row mappings for custom overrides (Category & PaymentMethod)
  const [rowOverrides, setRowOverrides] = useState<
    Record<string, { category?: Category; paymentMethod?: PaymentMethod; description?: string; amount?: number }>
  >({});

  const displayRows = useMemo(() => {
    if (!filterFlagged) return transactions;
    return transactions.filter((t) => t.needsReview || t.confidence < 0.85);
  }, [transactions, filterFlagged]);

  const stats = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;
    let selectedCount = 0;

    for (const t of transactions) {
      if (selectedIds.has(t.id)) {
        selectedCount++;
        if (t.debit) totalDebit += t.debit;
        if (t.credit) totalCredit += t.credit;
      }
    }
    return { totalDebit, totalCredit, selectedCount, totalCount: transactions.length };
  }, [transactions, selectedIds]);

  const toggleSelectAll = () => {
    if (selectedIds.size === displayRows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayRows.map((t) => t.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleDeleteRow = (id: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.info("Transaction row removed.");
  };

  const handleUpdateOverride = (
    id: string,
    key: "category" | "paymentMethod" | "description" | "amount",
    val: any
  ) => {
    setRowOverrides((prev) => ({
      ...prev,
      [id]: { ...prev[id], [key]: val },
    }));
  };

  const handleImportSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error("Please select at least one transaction to import.");
      return;
    }

    if (!selectedAccountId && accounts.length > 0) {
      toast.error("Please select a target account for the transactions.");
      return;
    }

    setIsSubmitting(true);

    try {
      const toImport: Omit<Transaction, "id">[] = [];

      for (const t of transactions) {
        if (!selectedIds.has(t.id)) continue;

        const override = rowOverrides[t.id] || {};
        const isIncome = t.credit !== null && (t.debit === null || t.credit > 0);
        const amount = override.amount ?? (isIncome ? t.credit ?? 0 : t.debit ?? 0);
        const category = override.category ?? autoCategorize(t.description, isIncome);
        const paymentMethod = override.paymentMethod ?? "Bank";
        const merchant = override.description || t.description || "Bank Transaction";
        const txDate = t.date || new Date().toISOString();

        toImport.push({
          type: isIncome ? "income" : "expense",
          amount: Math.abs(amount),
          category,
          merchant,
          date: txDate,
          paymentMethod,
          accountId: selectedAccountId || accounts[0]?.id || "bank-acc",
          notes: t.reference ? `Ref: ${t.reference} · Parsed from ${parseResult.bank}` : `Parsed from ${parseResult.bank}`,
        });
      }

      await onImportBulk(toImport);
      toast.success(`Successfully imported ${toImport.length} transactions into Expenso!`);
      onImportSuccess();
    } catch (err: any) {
      console.error("[StatementReviewTable] Bulk import error:", err);
      toast.error("Failed to import statement transactions.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Info & Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-4 border-border/60 gradient-card flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Detected Bank</p>
            <h4 className="font-display font-semibold text-sm truncate">{parseResult.bank}</h4>
            <span className="text-[10px] text-muted-foreground">{parseResult.documentType}</span>
          </div>
        </Card>

        <Card className="p-4 border-border/60 gradient-card flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-rose-500/10 text-rose-500">
            <ArrowDownRight className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Selected Debits</p>
            <h4 className="font-display font-semibold text-sm text-rose-500">{inr(stats.totalDebit)}</h4>
          </div>
        </Card>

        <Card className="p-4 border-border/60 gradient-card flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-emerald-500/10 text-emerald-500">
            <ArrowUpRight className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Selected Credits</p>
            <h4 className="font-display font-semibold text-sm text-emerald-500">{inr(stats.totalCredit)}</h4>
          </div>
        </Card>

        <Card className="p-4 border-border/60 gradient-card flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-amber-500/10 text-amber-500">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Review Status</p>
            <h4 className="font-display font-semibold text-sm">
              {parseResult.flagged > 0 ? (
                <span className="text-amber-500">{parseResult.flagged} Flagged Entries</span>
              ) : (
                <span className="text-emerald-500">100% High Confidence</span>
              )}
            </h4>
          </div>
        </Card>
      </div>

      {/* Control & Account Selection Toolbar */}
      <Card className="p-4 border-border/60 bg-card/60 backdrop-blur flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Target Account:</label>
            <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
              <SelectTrigger className="h-9 w-44 rounded-xl text-xs bg-background">
                <SelectValue placeholder="Select account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id} className="text-xs">
                    {acc.name} ({acc.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {parseResult.flagged > 0 && (
            <Button
              variant={filterFlagged ? "default" : "outline"}
              size="sm"
              className="h-9 rounded-xl text-xs"
              onClick={() => setFilterFlagged(!filterFlagged)}
            >
              <Filter className="mr-1.5 h-3.5 w-3.5" />
              {filterFlagged ? "Showing Flagged Only" : `Filter Flagged (${parseResult.flagged})`}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 justify-end">
          <Button variant="outline" size="sm" className="h-9 rounded-xl text-xs" onClick={onReset}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Reset File
          </Button>

          <Button
            size="sm"
            disabled={isSubmitting || stats.selectedCount === 0}
            className="h-9 rounded-xl gradient-primary font-semibold px-5 shadow-glow text-xs"
            onClick={handleImportSelected}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Import {stats.selectedCount} Transactions
          </Button>
        </div>
      </Card>

      {/* Transactions Review Table */}
      <Card className="border-border/60 overflow-hidden shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/50 border-b border-border/60 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
              <tr>
                <th className="p-3.5 text-center w-10">
                  <Checkbox
                    checked={selectedIds.size === displayRows.length && displayRows.length > 0}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="p-3.5">Date</th>
                <th className="p-3.5">Description / Merchant</th>
                <th className="p-3.5">Category</th>
                <th className="p-3.5 text-right">Debit (Expense)</th>
                <th className="p-3.5 text-right">Credit (Income)</th>
                <th className="p-3.5">Method</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5 text-center w-12">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {displayRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground text-xs">
                    No transactions match the selected filter.
                  </td>
                </tr>
              ) : (
                displayRows.map((t) => {
                  const isChecked = selectedIds.has(t.id);
                  const isCredit = t.credit !== null && (t.debit === null || t.credit > 0);
                  const override = rowOverrides[t.id] || {};
                  const activeCategory = override.category ?? autoCategorize(t.description, isCredit);
                  const activePaymentMethod = override.paymentMethod ?? "Bank";

                  return (
                    <tr
                      key={t.id}
                      className={`transition-colors hover:bg-muted/30 ${
                        !isChecked ? "opacity-60 bg-muted/10" : ""
                      } ${t.needsReview ? "bg-amber-500/5" : ""}`}
                    >
                      {/* Checkbox */}
                      <td className="p-3.5 text-center">
                        <Checkbox checked={isChecked} onCheckedChange={() => toggleSelectRow(t.id)} />
                      </td>

                      {/* Date */}
                      <td className="p-3.5 whitespace-nowrap font-mono text-[11px]">
                        {t.date ? new Date(t.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : t.rawDate}
                      </td>

                      {/* Merchant / Description */}
                      <td className="p-3.5 max-w-xs">
                        <Input
                          value={override.description ?? t.description}
                          onChange={(e) => handleUpdateOverride(t.id, "description", e.target.value)}
                          className="h-8 rounded-lg text-xs bg-background/80 border-border/60"
                        />
                        {t.reference && (
                          <span className="block text-[10px] text-muted-foreground mt-0.5 font-mono">
                            Ref: {t.reference}
                          </span>
                        )}
                      </td>

                      {/* Category */}
                      <td className="p-3.5">
                        <Select
                          value={activeCategory}
                          onValueChange={(val) => handleUpdateOverride(t.id, "category", val as Category)}
                        >
                          <SelectTrigger className="h-8 w-36 rounded-lg text-xs bg-background/80 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((cat) => (
                              <SelectItem key={cat} value={cat} className="text-xs">
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Debit */}
                      <td className="p-3.5 text-right font-mono font-medium text-rose-500 whitespace-nowrap">
                        {t.debit ? inr(t.debit) : "—"}
                      </td>

                      {/* Credit */}
                      <td className="p-3.5 text-right font-mono font-medium text-emerald-500 whitespace-nowrap">
                        {t.credit ? inr(t.credit) : "—"}
                      </td>

                      {/* Payment Method */}
                      <td className="p-3.5">
                        <Select
                          value={activePaymentMethod}
                          onValueChange={(val) => handleUpdateOverride(t.id, "paymentMethod", val as PaymentMethod)}
                        >
                          <SelectTrigger className="h-8 w-28 rounded-lg text-xs bg-background/80 border-border/60">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PAYMENT_METHODS.map((pm) => (
                              <SelectItem key={pm} value={pm} className="text-xs">
                                {pm}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Confidence Status */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {t.confidence >= 0.95 ? (
                          <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-500 bg-emerald-500/5">
                            High
                          </Badge>
                        ) : t.confidence >= 0.8 ? (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-500 bg-amber-500/5">
                            Review
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-500 bg-rose-500/5">
                            Low
                          </Badge>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-3.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-rose-500 rounded-lg"
                          onClick={() => handleDeleteRow(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
