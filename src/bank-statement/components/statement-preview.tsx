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
    };
  }, [transactions]);

  // Edit Handlers
  const handleStartEdit = (tx: BankTransaction) => {
    setEditingId(tx.id);
    setEditForm({
      description: tx.description,
      amount: tx.amount,
      type: tx.type,
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
    toast.info("Transaction removed");
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: statement.metadata?.currency || "INR",
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-2 border-b border-border/40">
        <div>
          <h2 className="text-xl font-bold font-display text-foreground flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" /> Statement Draft Review
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review and edit extracted transactions before finalizing import.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="rounded-lg text-xs"
          >
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Discard Draft
          </Button>

          <Button
            type="button"
            onClick={() => onConfirmImport(transactions)}
            disabled={transactions.length === 0}
            className="rounded-lg text-xs font-semibold px-5 py-2"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm & Import ({transactions.length})
          </Button>
        </div>
      </div>

      {/* Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Debits */}
        <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Debits</span>
            <ArrowDownRight className="h-4 w-4 text-destructive" />
          </div>
          <div className="text-xl font-bold font-display text-destructive">
            {formatCurrency(metrics.totalDebits)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {transactions.filter((t) => t.type === "debit").length} debit rows
          </div>
        </Card>

        {/* Total Credits */}
        <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Total Credits</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold font-display text-emerald-500">
            {formatCurrency(metrics.totalCredits)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {transactions.filter((t) => t.type === "credit").length} credit rows
          </div>
        </Card>

        {/* Net Change */}
        <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Net Balance Change</span>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className={`text-xl font-bold font-display ${metrics.netChange >= 0 ? "text-emerald-500" : "text-destructive"}`}>
            {formatCurrency(metrics.netChange)}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Net statement flow
          </div>
        </Card>

        {/* Statement Bank Info */}
        <Card className="p-4 border border-border/50 bg-card/60 backdrop-blur rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-medium">
            <span>Detected Bank</span>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-base font-bold font-display text-foreground truncate">
            {statement.bankName}
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            {statement.accountNumberMask || "Account *****"}
          </div>
        </Card>
      </div>

      {/* Main Transactions Table */}
      <Card className="overflow-hidden border border-border/50 bg-card/40 backdrop-blur rounded-xl shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border/40 bg-muted/20">
          <div className="font-semibold text-sm text-foreground">
            Extracted Transactions ({metrics.totalRows})
          </div>
          <div className="text-xs text-muted-foreground font-mono">
            Source: PDF Statement
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/40">
              <TableRow className="border-border/40 hover:bg-transparent">
                <TableHead className="w-[60px] text-center font-semibold text-xs">Sr. No.</TableHead>
                <TableHead className="w-[120px] font-semibold text-xs">Date</TableHead>
                <TableHead className="min-w-[240px] font-semibold text-xs">Description</TableHead>
                <TableHead className="w-[100px] text-center font-semibold text-xs">Type</TableHead>
                <TableHead className="w-[130px] text-right font-semibold text-xs">Amount</TableHead>
                <TableHead className="w-[130px] text-right font-semibold text-xs">Balance</TableHead>
                <TableHead className="w-[90px] text-center font-semibold text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {transactions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                    No transactions remaining in draft.
                  </TableCell>
                </TableRow>
              ) : (
                transactions.map((tx, index) => {
                  const isEditing = editingId === tx.id;
                  const isCredit = tx.type === "credit";

                  return (
                    <TableRow key={tx.id} className="border-border/30 hover:bg-muted/20 transition-colors">
                      {/* Sr. No. */}
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </TableCell>

                      {/* Date */}
                      <TableCell className="font-mono text-xs text-foreground whitespace-nowrap">
                        {tx.rawDate || (tx.date ? new Date(tx.date).toLocaleDateString("en-IN") : "—")}
                      </TableCell>

                      {/* Description */}
                      <TableCell className="max-w-[340px]">
                        {isEditing ? (
                          <Input
                            value={editForm.description || ""}
                            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                            className="h-8 text-xs bg-background"
                          />
                        ) : (
                          <div className="font-medium text-xs text-foreground truncate" title={tx.description}>
                            {tx.description}
                          </div>
                        )}
                      </TableCell>

                      {/* Type Badge */}
                      <TableCell className="text-center">
                        {isEditing ? (
                          <Select
                            value={editForm.type || "debit"}
                            onValueChange={(val) => setEditForm({ ...editForm, type: val as "debit" | "credit" })}
                          >
                            <SelectTrigger className="h-8 text-xs bg-background">
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
                            className={`text-[10px] font-medium uppercase px-2 py-0.5 ${
                              isCredit
                                ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                                : "border-destructive/30 text-destructive bg-destructive/5"
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
                            className="h-8 text-xs text-right bg-background"
                          />
                        ) : (
                          <span className={isCredit ? "text-emerald-500" : "text-foreground"}>
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
                                className="h-7 w-7 text-emerald-500 hover:bg-emerald-500/10"
                                title="Save Row"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={handleCancelEdit}
                                className="h-7 w-7 text-muted-foreground hover:bg-muted"
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
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                title="Edit Row"
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDeleteRow(tx.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
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

        {/* Footer Bar */}
        <div className="flex items-center justify-between p-4 border-t border-border/40 bg-muted/10">
          <div className="text-xs text-muted-foreground">
            {transactions.length} rows staged for import
          </div>
          <Button
            type="button"
            onClick={() => onConfirmImport(transactions)}
            disabled={transactions.length === 0}
            className="rounded-lg text-xs font-semibold px-6 py-2"
          >
            <CheckCircle2 className="mr-1.5 h-4 w-4" /> Confirm & Import Transactions
          </Button>
        </div>
      </Card>
    </div>
  );
}
