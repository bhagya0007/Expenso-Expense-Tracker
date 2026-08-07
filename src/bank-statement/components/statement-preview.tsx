import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2, ArrowDownRight, ArrowUpRight, Wallet, Trash2, Edit2, Check, X,
  AlertTriangle, FileText, Sparkles, Building2, RotateCcw,
} from "lucide-react";
import type { BankTransaction } from "../types/transaction";
import type { BankStatement } from "../types/statement";
import type { ImportSummary } from "../types/parser";
import { DEFAULT_STATEMENT_CATEGORIES } from "../constants/categories";
import { toast } from "sonner";

export interface StatementPreviewProps {
  statement: BankStatement;
  initialTransactions: BankTransaction[];
  initialSummary?: ImportSummary;
  onConfirmImport: (finalTransactions: BankTransaction[]) => void;
  onCancel: () => void;
}

export function StatementPreview({
  statement,
  initialTransactions,
  initialSummary: _initialSummary,
  onConfirmImport,
  onCancel,
}: StatementPreviewProps) {
  const [transactions, setTransactions] = useState<BankTransaction[]>(initialTransactions);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<BankTransaction>>({});

  // Summary Computations
  const metrics = useMemo(() => {
    const totalDebits = transactions
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);
    const totalCredits = transactions
      .filter((t) => t.type === "credit")
      .reduce((sum, t) => sum + t.amount, 0);
    const netChange = totalCredits - totalDebits;

    return {
      totalDebits,
      totalCredits,
      netChange,
      totalRows: transactions.length,
      flaggedRows: transactions.filter((t) => t.isFlagged).length,
    };
  }, [transactions]);

  // Edit Handlers
  const handleStartEdit = (tx: BankTransaction) => {
    setEditingId(tx.id);
    setEditForm({
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
      category: tx.category || "Uncategorized",
    });
  };

  const handleSaveEdit = (txId: string) => {
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === txId
          ? {
              ...t,
              description: editForm.description || t.description,
              amount: editForm.amount !== undefined ? Number(editForm.amount) : t.amount,
              type: editForm.type || t.type,
              category: editForm.category || t.category,
              isFlagged: false,
            }
          : t
      )
    );
    setEditingId(null);
    toast.success("Transaction updated");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
  };

  // Delete Handler
  const handleDeleteRow = (txId: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== txId));
    toast.info("Transaction removed from draft preview");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: statement.metadata.currency || "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Draft State Notice Banner with Top Action Bar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200 text-xs sm:text-sm backdrop-blur"
      >
        <div className="flex items-center gap-2.5">
          <Sparkles className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <span className="font-bold">Draft Preview:</span> Review, edit, or delete transactions before importing.
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Badge variant="outline" className="border-amber-400/40 text-amber-300 font-mono text-[10px] uppercase shrink-0">
            Source: bank_statement
          </Badge>

          {/* Top Cancel & Discard Draft Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="rounded-xl border-amber-400/30 bg-amber-500/20 text-amber-200 hover:bg-destructive hover:text-destructive-foreground hover:border-destructive transition-colors text-xs font-semibold px-3 py-1.5 shrink-0"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Cancel & Discard Draft
          </Button>
        </div>
      </motion.div>

      {/* Summary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Debits */}
        <Card className="p-5 border-border/60 gradient-card backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Debits (Spent)</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-destructive/10 text-destructive border border-destructive/20">
              <ArrowDownRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-display text-destructive">
            {formatCurrency(metrics.totalDebits)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {transactions.filter((t) => t.type === "debit").length} debit transactions
          </div>
        </Card>

        {/* Total Credits */}
        <Card className="p-5 border-border/60 gradient-card backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Credits (Received)</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <ArrowUpRight className="h-4 w-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-bold font-display text-emerald-400">
            {formatCurrency(metrics.totalCredits)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {transactions.filter((t) => t.type === "credit").length} credit transactions
          </div>
        </Card>

        {/* Net Change */}
        <Card className="p-5 border-border/60 gradient-card backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Net Change</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className={`text-xl sm:text-2xl font-bold font-display ${metrics.netChange >= 0 ? "text-emerald-400" : "text-destructive"}`}>
            {formatCurrency(metrics.netChange)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Opening {formatCurrency(statement.openingBalance || 0)}
          </div>
        </Card>

        {/* Statement Info */}
        <Card className="p-5 border-border/60 gradient-card backdrop-blur space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Bank & Account</span>
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-accent text-accent-foreground border border-border">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="text-base font-semibold font-display text-foreground truncate">
            {statement.bankName}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {statement.accountNumberMask || "Account *****"}
          </div>
        </Card>
      </div>

      {/* Main Transactions Table Card */}
      <Card className="overflow-hidden border-border/60 gradient-card shadow-card backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 border-b border-border/60 gap-4">
          <div>
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" /> Extracted Statement Transactions
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Showing {metrics.totalRows} transactions ready to import. Source will be recorded as <code className="text-primary font-mono">bank_statement</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="rounded-xl border-primary/30 text-primary px-3 py-1 font-semibold text-xs">
              {metrics.totalRows} Rows
            </Badge>

            {/* Top Secondary Cancel Action */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="rounded-xl border-border/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive text-xs"
            >
              <X className="mr-1 h-3.5 w-3.5" /> Cancel Draft
            </Button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-background/40">
              <TableRow className="border-border/60 hover:bg-transparent">
                <TableHead className="w-[60px] text-center font-bold">Sr. No.</TableHead>
                <TableHead className="w-[110px]">Date</TableHead>
                <TableHead className="min-w-[220px]">Description</TableHead>
                <TableHead className="w-[140px]">Category</TableHead>
                <TableHead className="w-[100px] text-center">Type</TableHead>
                <TableHead className="w-[130px] text-right">Amount</TableHead>
                <TableHead className="w-[130px] text-right">Balance</TableHead>
                <TableHead className="w-[100px] text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    No transactions remaining in draft preview.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx, index) => {
                  const isEditing = editingId === tx.id;
                  const isCredit = tx.type === "credit";

                  return (
                    <TableRow key={tx.id} className="border-border/40 hover:bg-background/60 transition-colors">
                      {/* Sr. No. Column */}
                      <TableCell className="text-center font-mono text-xs text-muted-foreground font-semibold">
                        {index + 1}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="font-mono text-xs text-foreground whitespace-nowrap">
                        {tx.rawDate || new Date(tx.date).toLocaleDateString()}
                      </TableCell>

                      {/* Description / Edit Input */}
                      <TableCell className="max-w-[320px]">
                        {isEditing ? (
                          <Input
                            value={editForm.description || ""}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="h-8 text-xs bg-background border-primary/40 focus-visible:ring-1"
                          />
                        ) : (
                          <div className="space-y-0.5">
                            <div className="font-medium text-xs text-foreground truncate" title={tx.description}>
                              {tx.description}
                            </div>
                            {tx.isFlagged && (
                              <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400 bg-amber-500/10 px-1.5 py-0">
                                <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Flagged Row
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>

                      {/* Category Select */}
                      <TableCell>
                        {isEditing ? (
                          <Select
                            value={editForm.category || "Uncategorized"}
                            onValueChange={(val) => setEditForm({ ...editForm, category: val })}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background border-primary/40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DEFAULT_STATEMENT_CATEGORIES.map((cat) => (
                                <SelectItem key={cat} value={cat} className="text-xs">
                                  {cat}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-[11px] font-normal border-border/60 text-muted-foreground">
                            {tx.category || "Uncategorized"}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Select
                            value={editForm.type || "debit"}
                            onValueChange={(val) => setEditForm({ ...editForm, type: val as "debit" | "credit" })}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background border-primary/40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="debit" className="text-xs">Debit</SelectItem>
                              <SelectItem value="credit" className="text-xs">Credit</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            variant="outline"
                            className={`text-[10px] font-semibold uppercase px-2 py-0.5 ${
                              isCredit
                                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                : "border-destructive/40 text-destructive bg-destructive/10"
                            }`}
                          >
                            {tx.type}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Amount */}
                      <TableCell className="text-right font-mono text-xs font-semibold whitespace-nowrap">
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editForm.amount || 0}
                            onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })}
                            className="h-8 text-xs text-right bg-background border-primary/40"
                          />
                        ) : (
                          <span className={isCredit ? "text-emerald-400" : "text-foreground"}>
                            {isCredit ? "+" : "-"}{formatCurrency(tx.amount)}
                          </span>
                        )}
                      </TableCell>

                      {/* Balance */}
                      <TableCell className="text-right font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {tx.balance !== undefined && tx.balance !== null ? formatCurrency(tx.balance) : "—"}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isEditing ? (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSaveEdit(tx.id)}
                                className="h-7 w-7 text-emerald-400 hover:bg-emerald-500/20"
                                title="Save Row"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleCancelEdit}
                                className="h-7 w-7 text-muted-foreground hover:bg-secondary"
                                title="Cancel Edit"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleStartEdit(tx)}
                                className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                title="Edit Row"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRow(tx.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Delete Row"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Footer Toolbar: Confirm Import Action */}
        <div className="flex flex-col sm:flex-row items-center justify-end p-5 border-t border-border/60 bg-background/30 gap-4">
          <Button
            type="button"
            onClick={() => onConfirmImport(transactions)}
            disabled={transactions.length === 0}
            className="w-full sm:w-auto rounded-xl gradient-primary text-primary-foreground font-semibold shadow-glow hover:opacity-95 px-8 py-2.5 text-sm"
          >
            <CheckCircle2 className="mr-2 h-4.5 w-4.5" /> Confirm & Import ({transactions.length}) Statement Transactions
          </Button>
        </div>
      </Card>
    </div>
  );
}
