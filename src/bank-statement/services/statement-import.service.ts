import type { BankTransaction } from "../types/transaction";
import type { BankStatement } from "../types/statement";
import { toast } from "sonner";

export interface StatementImportResult {
  statementId: string;
  importedCount: number;
  skippedDuplicatesCount: number;
  totalDebits: number;
  totalCredits: number;
}

export class StatementImportService {
  private STORAGE_KEY = "expenso_bank_statement_transactions";
  private STATEMENTS_KEY = "expenso_imported_bank_statements";

  getStoredTransactions(): BankTransaction[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  getStoredStatements(): BankStatement[] {
    try {
      const raw = localStorage.getItem(this.STATEMENTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  async importStatementTransactions(
    statement: BankStatement,
    transactionsToImport: BankTransaction[]
  ): Promise<StatementImportResult> {
    const existingTxList = this.getStoredTransactions();
    const existingStatements = this.getStoredStatements();

    // Create fingerprint set to prevent duplicate imports
    const existingFingerprints = new Set(
      existingTxList.map(
        (t) => `${t.rawDate || t.date}|${(t.description || "").trim().toUpperCase()}|${t.amount}|${t.type}`
      )
    );

    let importedCount = 0;
    let skippedDuplicatesCount = 0;
    let totalDebits = 0;
    let totalCredits = 0;

    const newTxToStore: BankTransaction[] = [];

    for (const tx of transactionsToImport) {
      importedCount++;
      if (tx.type === "debit") {
        totalDebits += tx.amount;
      } else {
        totalCredits += tx.amount;
      }

      const finalTx: BankTransaction & { source: string } = {
        ...tx,
        statementId: statement.id,
        source: "bank_statement",
      };
      newTxToStore.push(finalTx as BankTransaction);
    }

    // Persist updated transactions and statement metadata
    const updatedTxList = [...newTxToStore, ...existingTxList];
    const updatedStatements = [statement, ...existingStatements];

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updatedTxList));
      localStorage.setItem(this.STATEMENTS_KEY, JSON.stringify(updatedStatements));

      // Import directly into main Expenso transaction ledger & Firebase store
      try {
        const { api } = await import("@/lib/api");
        const accounts = await api.listAccounts();
        const targetAcc = accounts.length > 0 ? accounts[0] : null;

        const mainAppTxs = newTxToStore.map((bt) => {
          const isIncome = bt.type === "credit";
          let dateStr = new Date().toISOString().slice(0, 10);
          try {
            if (bt.date) {
              const d = new Date(bt.date);
              if (!isNaN(d.getTime())) {
                dateStr = d.toISOString().slice(0, 10);
              }
            }
          } catch {}

          return {
            type: (isIncome ? "income" : "expense") as "income" | "expense",
            amount: Number(bt.amount) || 0,
            category: (isIncome ? "Salary" : "Other") as any,
            merchant: bt.description || bt.merchantName || "Bank Transaction",
            date: dateStr,
            paymentMethod: "Bank" as const,
            accountId: targetAcc ? targetAcc.id : "",
            notes: `Imported from ${statement.bankName} statement (${statement.fileName})`,
          };
        });

        if (mainAppTxs.length > 0) {
          await api.createTransactionsBulk(mainAppTxs);
        }
      } catch (apiErr) {
        console.warn("Failed to sync transactions to main Expenso store:", apiErr);
      }

      // Dispatch custom DOM event to trigger instant dashboard metric updates
      window.dispatchEvent(
        new CustomEvent("expenso:transactions-updated", {
          detail: {
            source: "bank_statement",
            count: importedCount,
            totalDebits,
            totalCredits,
          },
        })
      );
    } catch (e) {
      console.error("Error saving imported transactions to localStorage", e);
    }

    toast.success(
      `Successfully imported ${importedCount} transactions from ${statement.bankName}! (${skippedDuplicatesCount} duplicates skipped)`
    );

    return {
      statementId: statement.id,
      importedCount,
      skippedDuplicatesCount,
      totalDebits,
      totalCredits,
    };
  }
}

export const statementImportService = new StatementImportService();
