/**
 * API layer — Instant Optimistic Store + Async Firebase Cloud Firestore Sync.
 */
import { auth, db } from "@/integrations/firebase/client";
import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import type { Account, Budget, Insight, Reminder, Transaction } from "./types";

type Store = {
  transactions: Transaction[];
  accounts: Account[];
  budgets: Budget[];
  reminders: Reminder[];
};
const EMPTY = (): Store => ({ transactions: [], accounts: [], budgets: [], reminders: [] });

const guestStore: Store = EMPTY();

const storeKey = (uid: string) => `expenso:data:${uid}`;

function withTimeout<T>(promise: Promise<T>, ms = 8000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms)),
  ]);
}

function currentUid(): string | null {
  if (typeof window === "undefined") return null;
  return auth.currentUser?.uid ?? null;
}

function read(uid: string | null): Store {
  if (!uid) return guestStore;
  if (typeof window === "undefined") return EMPTY();
  const raw = localStorage.getItem(storeKey(uid));
  if (!raw) return EMPTY();
  try {
    const parsed = JSON.parse(raw) as Partial<Store>;
    return { ...EMPTY(), ...parsed };
  } catch {
    return EMPTY();
  }
}

function write(uid: string | null, s: Store) {
  if (!uid) {
    Object.assign(guestStore, s);
    return;
  }
  if (typeof window === "undefined") return;
  localStorage.setItem(storeKey(uid), JSON.stringify(s));
}

function mutate(fn: (s: Store) => Store): Store {
  const uid = currentUid();
  const next = fn(read(uid));
  write(uid, next);
  return next;
}

async function ensureUserDoc(uid: string) {
  try {
    const uRef = doc(db, "users", uid);
    const email = auth.currentUser?.email || "";
    const name = auth.currentUser?.displayName || email.split("@")[0] || "User";
    await setDoc(uRef, { uid, email, displayName: name, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err) {
    console.error("Firestore ensureUserDoc error:", err);
  }
}

function computeInsights(txs: Transaction[]): Insight[] {
  if (txs.length === 0) {
    return [
      {
        id: "welcome",
        title: "Welcome to Expenso",
        body: "Add your first transaction or import a bank statement to start seeing personalised insights here.",
        severity: "info",
      },
    ];
  }
  const now = new Date();
  const thisMonth = txs.filter(
    (t) =>
      new Date(t.date).getMonth() === now.getMonth() &&
      new Date(t.date).getFullYear() === now.getFullYear(),
  );
  const income = thisMonth.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expenses = thisMonth.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const savings = income - expenses;
  const rate = income > 0 ? Math.round((savings / income) * 100) : 0;

  const cat = new Map<string, number>();
  thisMonth
    .filter((t) => t.type === "expense")
    .forEach((t) => cat.set(t.category, (cat.get(t.category) ?? 0) + t.amount));
  const top = [...cat.entries()].sort((a, b) => b[1] - a[1])[0];

  const out: Insight[] = [];
  if (top) {
    out.push({
      id: "top-cat",
      title: `${top[0]} leads your spending`,
      body: `You've spent ₹${top[1].toLocaleString("en-IN")} on ${top[0]} this month.`,
      severity: "info",
    });
  }
  if (income > 0) {
    out.push({
      id: "rate",
      title: `Savings rate: ${rate}%`,
      body:
        rate >= 20
          ? "Nice work — you're saving a healthy share of what you earn."
          : "Try trimming one recurring category to lift your savings rate above 20%.",
      severity: rate >= 20 ? "success" : "warning",
    });
  }
  if (expenses > income && income > 0) {
    out.push({
      id: "overspend",
      title: "Spending above income",
      body: "You've spent more than you earned this month. Review your top categories to rebalance.",
      severity: "warning",
    });
  }
  return out.length ? out : [
    {
      id: "started",
      title: "You're off to a great start",
      body: "Keep logging transactions to unlock deeper insights and forecasts.",
      severity: "success",
    },
  ];
}

function updateStoreAccountsWithDeltas(s: Store, deltas: Map<string, number>): Store {
  if (deltas.size === 0) return s;
  const nextAccounts = s.accounts.map((a) => {
    const d = deltas.get(a.id);
    if (d) {
      return { ...a, balance: Number((a.balance + d).toFixed(2)) };
    }
    return a;
  });
  return { ...s, accounts: nextAccounts };
}

async function syncAccountsToFirestore(uid: string | null, accountIds: Set<string>) {
  if (!uid || accountIds.size === 0) return;
  const currentAccounts = read(uid).accounts;
  for (const accId of accountIds) {
    const acc = currentAccounts.find((a) => a.id === accId);
    if (acc) {
      try {
        const docRef = doc(db, "users", uid, "accounts", accId);
        await setDoc(docRef, { ...acc }, { merge: true });
      } catch (err) {
        console.error("Firestore sync account balance error:", err);
      }
    }
  }
}

export const api = {
  // --- transactions ---
  async listTransactions(): Promise<Transaction[]> {
    const uid = currentUid();
    const local = read(uid).transactions;
    if (uid) {
      try {
        const colRef = collection(db, "users", uid, "transactions");
        const snap = await withTimeout(getDocs(colRef));
        if (!snap.empty) {
          const remote: Transaction[] = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              description: data.description,
              amount: Number(data.amount),
              type: data.type,
              category: data.category,
              date: data.date,
              accountId: data.accountId,
              paymentMethod: data.paymentMethod,
              notes: data.notes,
            };
          });
          const remoteIds = new Set(remote.map((t) => t.id));
          const combined = [...remote, ...local.filter((t) => !remoteIds.has(t.id))];
          write(uid, { ...read(uid), transactions: combined });
          return combined.sort((a, b) => +new Date(b.date) - +new Date(a.date));
        }
      } catch (err) {
        console.error("Firestore listTransactions error:", err);
      }
    }
    return [...local].sort((a, b) => +new Date(b.date) - +new Date(a.date));
  },

  async createTransaction(input: Omit<Transaction, "id">): Promise<Transaction> {
    const tx: Transaction = { ...input, id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
    const uid = currentUid();

    const deltas = new Map<string, number>();
    if (tx.accountId) {
      const delta = tx.type === "income" ? tx.amount : -tx.amount;
      deltas.set(tx.accountId, delta);
    }

    mutate((s) => {
      const withTx = { ...s, transactions: [tx, ...s.transactions] };
      return updateStoreAccountsWithDeltas(withTx, deltas);
    });

    if (uid) {
      try {
        await ensureUserDoc(uid);
        const docRef = doc(db, "users", uid, "transactions", tx.id);
        await setDoc(docRef, { ...tx });
        if (tx.accountId) {
          await syncAccountsToFirestore(uid, new Set([tx.accountId]));
        }
      } catch (err) {
        console.error("Firestore setDoc tx error:", err);
      }
    }
    return tx;
  },

  async createTransactionsBulk(inputs: Omit<Transaction, "id">[]): Promise<Transaction[]> {
    if (inputs.length === 0) return [];
    const now = Date.now();
    const rand = Math.random().toString(36).slice(2, 6);
    const txs: Transaction[] = new Array(inputs.length);
    const deltas = new Map<string, number>();

    for (let i = 0; i < inputs.length; i++) {
      txs[i] = { ...inputs[i], id: `tx-${now}-${i}-${rand}` };
      if (txs[i].accountId) {
        const delta = txs[i].type === "income" ? txs[i].amount : -txs[i].amount;
        deltas.set(txs[i].accountId, (deltas.get(txs[i].accountId) ?? 0) + delta);
      }
    }

    const uid = currentUid();
    mutate((s) => {
      const withTxs = { ...s, transactions: txs.concat(s.transactions) };
      return updateStoreAccountsWithDeltas(withTxs, deltas);
    });

    if (uid) {
      try {
        await ensureUserDoc(uid);
        for (const tx of txs) {
          const docRef = doc(db, "users", uid, "transactions", tx.id);
          await setDoc(docRef, { ...tx });
        }
        await syncAccountsToFirestore(uid, new Set(deltas.keys()));
      } catch (err) {
        console.error("Firestore bulk tx error:", err);
      }
    }
    return txs;
  },

  async updateTransaction(id: string, patch: Partial<Omit<Transaction, "id">>): Promise<void> {
    const uid = currentUid();
    const oldTx = read(uid).transactions.find((t) => t.id === id);
    const deltas = new Map<string, number>();

    if (oldTx) {
      // Revert old transaction effect
      if (oldTx.accountId) {
        const oldRevert = oldTx.type === "income" ? -oldTx.amount : +oldTx.amount;
        deltas.set(oldTx.accountId, (deltas.get(oldTx.accountId) ?? 0) + oldRevert);
      }
      // Apply new transaction effect
      const newTx = { ...oldTx, ...patch };
      if (newTx.accountId) {
        const newDelta = newTx.type === "income" ? +newTx.amount : -newTx.amount;
        deltas.set(newTx.accountId, (deltas.get(newTx.accountId) ?? 0) + newDelta);
      }
    }

    mutate((s) => {
      const withPatch = {
        ...s,
        transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
      };
      return updateStoreAccountsWithDeltas(withPatch, deltas);
    });

    if (uid) {
      try {
        const docRef = doc(db, "users", uid, "transactions", id);
        await updateDoc(docRef, patch as any);
        await syncAccountsToFirestore(uid, new Set(deltas.keys()));
      } catch (err) {
        console.error("Firestore updateTx error:", err);
      }
    }
  },

  async deleteTransaction(id: string): Promise<void> {
    const uid = currentUid();
    const oldTx = read(uid).transactions.find((t) => t.id === id);
    const deltas = new Map<string, number>();

    if (oldTx && oldTx.accountId) {
      const revertDelta = oldTx.type === "income" ? -oldTx.amount : +oldTx.amount;
      deltas.set(oldTx.accountId, revertDelta);
    }

    mutate((s) => {
      const withDel = {
        ...s,
        transactions: s.transactions.filter((t) => t.id !== id),
      };
      return updateStoreAccountsWithDeltas(withDel, deltas);
    });

    if (uid) {
      try {
        const docRef = doc(db, "users", uid, "transactions", id);
        await deleteDoc(docRef);
        await syncAccountsToFirestore(uid, new Set(deltas.keys()));
      } catch (err) {
        console.error("Firestore deleteTx error:", err);
      }
    }
  },

  // --- accounts ---
  async listAccounts(): Promise<Account[]> {
    const uid = currentUid();
    const local = read(uid).accounts;
    if (uid) {
      try {
        const colRef = collection(db, "users", uid, "accounts");
        const snap = await withTimeout(getDocs(colRef));
        if (!snap.empty) {
          const remote: Account[] = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              name: data.name,
              type: data.type,
              balance: Number(data.balance),
              accountNumber: data.accountNumber,
              color: data.color,
            };
          });
          const remoteIds = new Set(remote.map((a) => a.id));
          const combined = [...remote, ...local.filter((a) => !remoteIds.has(a.id))];
          write(uid, { ...read(uid), accounts: combined });
          return combined;
        }
      } catch (err) {
        console.error("Firestore listAccounts error:", err);
      }
    }
    return local;
  },

  async createAccount(input: Omit<Account, "id">): Promise<Account> {
    const a: Account = { ...input, id: `a-${Date.now()}` };
    const uid = currentUid();
    mutate((s) => ({ ...s, accounts: [...s.accounts, a] }));
    if (uid) {
      try {
        await ensureUserDoc(uid);
        const docRef = doc(db, "users", uid, "accounts", a.id);
        await setDoc(docRef, { ...a });
      } catch (err) {
        console.error("Firestore setDoc account error:", err);
      }
    }
    return a;
  },

  async updateAccount(id: string, patch: Partial<Omit<Account, "id">>): Promise<void> {
    const uid = currentUid();
    mutate((s) => ({
      ...s,
      accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    }));
    if (uid) {
      try {
        const docRef = doc(db, "users", uid, "accounts", id);
        await updateDoc(docRef, patch as any);
      } catch (err) {
        console.error("Firestore updateAccount error:", err);
      }
    }
  },

  async deleteAccount(id: string): Promise<void> {
    const uid = currentUid();
    mutate((s) => ({ ...s, accounts: s.accounts.filter((a) => a.id !== id) }));
    if (uid) {
      try {
        const docRef = doc(db, "users", uid, "accounts", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Firestore deleteAccount error:", err);
      }
    }
  },

  // --- budgets ---
  async listBudgets(): Promise<Budget[]> {
    const uid = currentUid();
    const local = read(uid).budgets;
    if (uid) {
      try {
        const colRef = collection(db, "users", uid, "budgets");
        const snap = await withTimeout(getDocs(colRef));
        if (!snap.empty) {
          const remote: Budget[] = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              category: data.category,
              allocated: Number(data.allocated),
              spent: Number(data.spent),
              period: data.period,
            };
          });
          const remoteIds = new Set(remote.map((b) => b.id));
          const combined = [...remote, ...local.filter((b) => !remoteIds.has(b.id))];
          write(uid, { ...read(uid), budgets: combined });
          return combined;
        }
      } catch (err) {
        console.error("Firestore listBudgets error:", err);
      }
    }
    return local;
  },

  async createBudget(input: Omit<Budget, "id">): Promise<Budget> {
    const b: Budget = { ...input, id: `b-${Date.now()}` };
    const uid = currentUid();
    mutate((s) => ({ ...s, budgets: [...s.budgets, b] }));
    if (uid) {
      try {
        await ensureUserDoc(uid);
        const docRef = doc(db, "users", uid, "budgets", b.id);
        await setDoc(docRef, { ...b });
      } catch (err) {
        console.error("Firestore setDoc budget error:", err);
      }
    }
    return b;
  },

  async updateBudget(id: string, patch: Partial<Omit<Budget, "id">>): Promise<void> {
    const uid = currentUid();
    mutate((s) => ({
      ...s,
      budgets: s.budgets.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
    if (uid) {
      try {
        const docRef = doc(db, "users", uid, "budgets", id);
        await updateDoc(docRef, patch as any);
      } catch (err) {
        console.error("Firestore updateBudget error:", err);
      }
    }
  },

  async deleteBudget(id: string): Promise<void> {
    const uid = currentUid();
    mutate((s) => ({ ...s, budgets: s.budgets.filter((b) => b.id !== id) }));
    if (uid) {
      try {
        const docRef = doc(db, "users", uid, "budgets", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Firestore deleteBudget error:", err);
      }
    }
  },

  // --- reminders ---
  async listReminders(): Promise<Reminder[]> {
    const uid = currentUid();
    const local = read(uid).reminders;
    if (uid) {
      try {
        const colRef = collection(db, "users", uid, "reminders");
        const snap = await withTimeout(getDocs(colRef));
        if (!snap.empty) {
          const remote: Reminder[] = snap.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              title: data.title,
              amount: Number(data.amount),
              dueDate: data.dueDate,
              category: data.category,
              isRecurring: data.isRecurring,
              status: data.status,
            };
          });
          const remoteIds = new Set(remote.map((r) => r.id));
          const combined = [...remote, ...local.filter((r) => !remoteIds.has(r.id))];
          write(uid, { ...read(uid), reminders: combined });
          return combined.sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
        }
      } catch (err) {
        console.error("Firestore listReminders error:", err);
      }
    }
    return [...local].sort((a, b) => +new Date(a.dueDate) - +new Date(b.dueDate));
  },

  async createReminder(input: Omit<Reminder, "id">): Promise<Reminder> {
    const r: Reminder = { ...input, id: `r-${Date.now()}` };
    const uid = currentUid();
    mutate((s) => ({ ...s, reminders: [...s.reminders, r] }));
    if (uid) {
      try {
        await ensureUserDoc(uid);
        const docRef = doc(db, "users", uid, "reminders", r.id);
        await setDoc(docRef, { ...r });
      } catch (err) {
        console.error("Firestore setDoc reminder error:", err);
      }
    }
    return r;
  },

  async deleteReminder(id: string): Promise<void> {
    const uid = currentUid();
    mutate((s) => ({ ...s, reminders: s.reminders.filter((r) => r.id !== id) }));
    if (uid) {
      try {
        const docRef = doc(db, "users", uid, "reminders", id);
        await deleteDoc(docRef);
      } catch (err) {
        console.error("Firestore deleteReminder error:", err);
      }
    }
  },

  // --- insights ---
  async listInsights(): Promise<Insight[]> {
    const txs = await api.listTransactions();
    return computeInsights(txs);
  },

  // --- clear/reset data ---
  async clearAllData(): Promise<void> {
    if (typeof window === "undefined") return;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith("expenso:")) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  },
};

export const CATEGORIES = [
  "Food & Dining", "Transport", "Shopping", "Entertainment",
  "Bills & Utilities", "Health", "Investments", "Salary", "Transfer", "Rent", "Other",
] as const;

export const PAYMENT_METHODS = ["UPI", "Credit Card", "Debit Card", "Cash", "Wallet", "Bank"] as const;
