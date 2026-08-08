import type { ActionProposal, ActionType } from "../types/ai.types";
import type { Category } from "@/lib/types";
import { api } from "@/lib/api";

export function createActionProposal(
  type: ActionType,
  params: {
    amount?: number;
    category?: Category;
    merchant?: string;
    type?: "income" | "expense";
    date?: string;
    limit?: number;
    period?: "monthly" | "weekly";
    reminderTitle?: string;
    reminderDueDate?: string;
    targetCategory?: Category;
    transactionIds?: string[];
    paymentMethod?: string;
    accountName?: string;
    accountId?: string;
  }
): ActionProposal {
  const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // 1. CREATE_BUDGET / UPDATE_BUDGET
  if (type === "CREATE_BUDGET" || type === "UPDATE_BUDGET") {
    const category = params.category || params.targetCategory || "Food & Dining";
    const limit = Number(params.limit || params.amount || 5000);
    const actionLabel = type === "CREATE_BUDGET" ? "Create" : "Change";

    return {
      id,
      type,
      title: `${actionLabel} ${category} Budget`,
      description: `Set a ${params.period || "monthly"} budget limit of ₹${limit.toLocaleString("en-IN")} for ${category}.`,
      payload: {
        category,
        limit,
        amount: limit,
        period: params.period || "monthly",
      },
      status: "pending",
    };
  }

  // 2. CREATE_SAVINGS_GOAL
  if (type === "CREATE_SAVINGS_GOAL") {
    const targetAmount = params.amount || 20000;
    return {
      id,
      type,
      title: "Create Savings Goal Budget",
      description: `Set up a monthly target savings budget of ₹${targetAmount.toLocaleString("en-IN")}.`,
      payload: {
        amount: targetAmount,
        category: "Investments",
        limit: targetAmount,
        period: "monthly",
      },
      status: "pending",
    };
  }

  // 3. CREATE_REMINDER
  if (type === "CREATE_REMINDER") {
    const title = params.reminderTitle || "Review subscriptions and recurring charges";
    const dueDate = params.reminderDueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    return {
      id,
      type,
      title: "Create Subscription Review Reminder",
      description: `Set a reminder: "${title}" due on ${dueDate}.`,
      payload: {
        reminderTitle: title,
        reminderDueDate: dueDate,
      },
      status: "pending",
    };
  }

  // 4. CATEGORIZE_TRANSACTIONS
  if (type === "CATEGORIZE_TRANSACTIONS") {
    const targetCategory = params.targetCategory || "Food & Dining";
    const txIds = params.transactionIds || [];

    return {
      id,
      type,
      title: `Categorize Transactions as ${targetCategory}`,
      description: `Reassign ${txIds.length > 0 ? txIds.length : "recent matching"} transaction(s) to ${targetCategory}.`,
      payload: {
        targetCategory,
        transactionIds: txIds,
      },
      status: "pending",
    };
  }

  // 5. CREATE_TRANSACTION (Default)
  const category = params.category || "Food & Dining";
  const amount = params.amount || 100;
  const merchant = params.merchant || category;
  const txType = params.type || "expense";
  const paymentMethod = params.paymentMethod || "Bank";
  const date = params.date || new Date().toISOString().slice(0, 10);

  const dObj = new Date(date);
  const formattedDateStr = isNaN(+dObj)
    ? date
    : `${dObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} (${dObj.toLocaleDateString("en-IN", { weekday: "short" })})`;

  return {
    id,
    type,
    title: `Add ${txType === "expense" ? "Expense" : "Income"}`,
    description: `Add a ${paymentMethod} ${txType} transaction of ₹${amount.toLocaleString("en-IN")} for ${merchant} (${category}) on ${formattedDateStr}.`,
    payload: {
      amount,
      category,
      merchant,
      type: txType,
      date,
      paymentMethod,
    },
    status: "pending",
  };
}

/**
 * STRICT SECURITY GATEWAY: Executes an action ONLY when explicitly called after user confirmation.
 * Uses the authenticated user's UID via api.ts.
 */
export async function executeActionProposal(proposal: ActionProposal): Promise<{ success: boolean; message: string }> {
  if (proposal.status !== "confirmed") {
    throw new Error("Security Violation: Cannot execute action proposal without explicit user confirmation.");
  }

  try {
    switch (proposal.type) {
      case "CREATE_BUDGET":
      case "UPDATE_BUDGET": {
        const { category, limit: pLimit, amount: pAmount, period } = proposal.payload;
        const categoryName = category || "Food & Dining";
        const limit = Number(pLimit || pAmount || 5000);

        // Compute current spent for this category in the current month
        const now = new Date();
        const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const allTxs = await api.listTransactions();
        const spent = allTxs
          .filter((t) => t.type === "expense" && t.date >= startOfMonth && (t.category || "").toLowerCase() === categoryName.toLowerCase())
          .reduce((sum, t) => sum + t.amount, 0);

        const existingBudgets = await api.listBudgets();
        const existing = existingBudgets.find((b) => (b.category || "").toLowerCase() === categoryName.toLowerCase());

        if (existing) {
          await api.updateBudget(existing.id, { limit, spent, period: period || "monthly" });
        } else {
          await api.createBudget({
            category: categoryName,
            limit,
            spent,
            period: period || "monthly",
          });
        }

        return {
          success: true,
          message: `Successfully set ${categoryName} budget to ₹${limit.toLocaleString("en-IN")}.`,
        };
      }

      case "CREATE_SAVINGS_GOAL": {
        const { limit, amount } = proposal.payload;
        const targetLimit = limit || amount || 20000;

        await api.createBudget({
          category: "Investments",
          limit: targetLimit,
          spent: 0,
          period: "monthly",
        });

        return {
          success: true,
          message: `Successfully created Savings Goal budget of ₹${targetLimit.toLocaleString("en-IN")}.`,
        };
      }

      case "CREATE_REMINDER": {
        const { reminderTitle, reminderDueDate } = proposal.payload;
        await api.createReminder({
          title: reminderTitle || "Review subscriptions",
          dueDate: reminderDueDate || new Date().toISOString().slice(0, 10),
          isCompleted: false,
        });

        return {
          success: true,
          message: `Successfully set reminder: "${reminderTitle || "Review subscriptions"}".`,
        };
      }

      case "CATEGORIZE_TRANSACTIONS": {
        const { targetCategory, transactionIds } = proposal.payload;
        if (!targetCategory) throw new Error("Missing target category.");

        let targetIds = transactionIds || [];
        if (targetIds.length === 0) {
          // Default: Update the 3 most recent uncategorized / recent transactions
          const recent = await api.listTransactions({ limit: 3 });
          targetIds = recent.map((t) => t.id);
        }

        for (const txId of targetIds) {
          await api.updateTransaction(txId, { category: targetCategory });
        }

        return {
          success: true,
          message: `Successfully updated ${targetIds.length} transaction(s) to ${targetCategory}.`,
        };
      }

      case "CREATE_TRANSACTION": {
        const { amount, category, merchant, type, date, paymentMethod, accountName, accountId } = proposal.payload;
        const accounts = await api.listAccounts();
        const pMethod = (paymentMethod as any) || "Bank";

        let matchingAcc = accounts.find(
          (a) =>
            a.id === accountId ||
            (accountName && a.name.toLowerCase().includes(accountName.toLowerCase())) ||
            (a.type || "").toLowerCase() === pMethod.toLowerCase()
        ) || accounts[0];

        await api.createTransaction({
          amount: amount || 0,
          category: category || "Food & Dining",
          merchant: merchant || category || "Transaction",
          type: type || "expense",
          date: date || new Date().toISOString().slice(0, 10),
          paymentMethod: pMethod,
          accountId: matchingAcc?.id || "acc-1",
        });

        const dObj = new Date(date || new Date().toISOString().slice(0, 10));
        const formattedDateStr = isNaN(+dObj)
          ? date
          : `${dObj.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })} (${dObj.toLocaleDateString("en-IN", { weekday: "short" })})`;

        return {
          success: true,
          message: `Successfully recorded ${pMethod} ${type || "expense"} of ₹${amount?.toLocaleString("en-IN")} for ${merchant || "Transaction"} (${category}) under ${matchingAcc?.name || "Account"} on ${formattedDateStr}.`,
        };
      }

      default:
        throw new Error(`Unsupported action type: ${proposal.type}`);
    }
  } catch (err: any) {
    console.error("Failed to execute action proposal:", err);
    return {
      success: false,
      message: err?.message || "Failed to execute action proposal.",
    };
  }
}
