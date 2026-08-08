import type { IntentType } from "../types/ai.types";
import { CATEGORIES } from "@/lib/api";

export interface ParsedIntent {
  intent: IntentType;
  targetCategory?: string;
  targetMerchant?: string;
  targetAmount?: number;
  targetDate?: string;
  targetPaymentMethod?: string;
  targetAccountName?: string;
  extractedKeywords?: string[];
}

export function detectIntent(prompt: string): ParsedIntent {
  const p = prompt.toLowerCase().trim();

  // 0. Greetings & Small Talk ("hi", "hello", "hey", "good morning", "help", "who are you")
  if (
    p === "hi" ||
    p === "hello" ||
    p === "hey" ||
    p.startsWith("hi ") ||
    p.startsWith("hello ") ||
    p.startsWith("hey ") ||
    p.includes("good morning") ||
    p.includes("good evening") ||
    p.includes("who are you") ||
    p.includes("what can you do") ||
    p === "help"
  ) {
    return { intent: "GENERAL_FINANCIAL_QUERY" };
  }

  // 1. TRANSACTION_QUERY (e.g. "how many transactions", "how much transaction", "list transactions", "show transactions")
  if (
    p.includes("transaction") &&
    (
      p.includes("how many") ||
      p.includes("how much") ||
      p.includes("my ") ||
      p.includes("list") ||
      p.includes("show") ||
      p.includes("recent") ||
      p.includes("all") ||
      p.includes("count") ||
      p.includes("view") ||
      p.includes("total") ||
      p.includes("history")
    )
  ) {
    return { intent: "TRANSACTION_QUERY" };
  }

  // 2. ACTION_REQUEST (Explicit transaction/budget modification requests)
  if (
    p.startsWith("add") ||
    p.startsWith("create") ||
    p.startsWith("set") ||
    p.startsWith("change") ||
    p.startsWith("update") ||
    p.startsWith("record") ||
    p.startsWith("make") ||
    p.includes("add a ") ||
    p.includes("add transaction") ||
    p.includes("record transaction") ||
    p.includes("create transaction") ||
    p.includes("categorize") ||
    p.includes("make a budget") ||
    p.includes("savings goal") ||
    p.includes("reminder")
  ) {
    // 1. Amount Extraction (prioritizes rs / rupees / ₹ near number)
    const cleaned = p.replace(/(\d+),(\d+)/g, "$1$2");
    const rsMatch = cleaned.match(/(?:rs\.?|₹|rupees?|amount|of)\s*(\d+(?:\.\d+)?)/i) || cleaned.match(/\b(\d+(?:\.\d+)?)\s*(?:rs\.?|₹|rupees?)\b/i);
    const numMatch = rsMatch || cleaned.match(/\b\d+(\.\d+)?\b/);
    const amount = numMatch ? parseFloat(numMatch[1] || numMatch[0]) : undefined;

    // 2. Date Extraction (supports DD-MM-YYYY like 07-08-2026, or YYYY-MM-DD)
    let targetDate: string | undefined = undefined;
    const ddmmyyyy = p.match(/\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})\b/);
    const yyyymmdd = p.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, "0");
      const month = ddmmyyyy[2].padStart(2, "0");
      const year = ddmmyyyy[3];
      targetDate = `${year}-${month}-${day}`;
    } else if (yyyymmdd) {
      const year = yyyymmdd[1];
      const month = yyyymmdd[2].padStart(2, "0");
      const day = yyyymmdd[3].padStart(2, "0");
      targetDate = `${year}-${month}-${day}`;
    }

    // 3. Merchant / Title Extraction (e.g. "for Maggie", "for Maggie (Other)", "title maggie", "at Swiggy")
    let targetMerchant: string | undefined = undefined;
    const titleMatch = p.match(/\b(?:title|merchant|named?|called?|item)\s*[:=]?\s*([a-z0-9\s&'-]+?)(?=\s+(?:with|on|in|date|using|by|via|payment|wallet|bank|card|rs|rupees|category|transaction|\(|\))|$)/i);
    const forMatch = p.match(/\b(?:for|at|from)\s+([a-z0-9\s&'-]+?)(?=\s+(?:with|on|in|date|using|by|via|payment|wallet|bank|card|rs|rupees|category|transaction|\(|\))|$)/i);

    let candidateRaw: string | undefined = undefined;
    if (titleMatch && titleMatch[1]) {
      candidateRaw = titleMatch[1].trim();
    } else if (forMatch && forMatch[1]) {
      candidateRaw = forMatch[1].trim();
    }

    if (candidateRaw) {
      const isCat = CATEGORIES.some((c) => c.toLowerCase() === candidateRaw!.toLowerCase());
      if (!isCat && candidateRaw.length > 1) {
        candidateRaw = candidateRaw.replace(/[()]/g, "").trim();
        targetMerchant = candidateRaw.charAt(0).toUpperCase() + candidateRaw.slice(1);
      }
    }

    // 4. Payment Method Extraction (wallet, credit card, debit card, upi, cash, bank)
    let targetPaymentMethod: string | undefined = undefined;
    if (p.includes("wallet")) targetPaymentMethod = "Wallet";
    else if (p.includes("credit card")) targetPaymentMethod = "Credit Card";
    else if (p.includes("debit card")) targetPaymentMethod = "Debit Card";
    else if (p.includes("card")) targetPaymentMethod = "Credit Card";
    else if (p.includes("upi") || p.includes("gpay") || p.includes("phonepe") || p.includes("paytm")) targetPaymentMethod = "UPI";
    else if (p.includes("cash")) targetPaymentMethod = "Cash";
    else if (p.includes("bank")) targetPaymentMethod = "Bank";

    // 5. Account Name Extraction (e.g. "account HDFC", "from account SBI", "using Amazon Pay Wallet")
    let targetAccountName: string | undefined = undefined;
    const accMatch = p.match(/\b(?:account|acc|from account|in account|using account|bank account|account:?)\s*[:=]?\s*([a-z0-9\s&'-]+?)(?=\s+(?:with|on|in|date|using|by|via|payment|wallet|bank|card|rs|rupees|category|transaction|title)|$)/i);
    if (accMatch && accMatch[1]) {
      const raw = accMatch[1].trim();
      targetAccountName = raw.charAt(0).toUpperCase() + raw.slice(1);
    }

    // 6. Category Extraction
    let categoryMatch = CATEGORIES.find((c) => {
      const cLower = c.toLowerCase();
      const firstWord = cLower.split(/[\s&]+/)[0];
      return p.includes(cLower) || (firstWord.length > 2 && p.includes(firstWord));
    });

    if (!categoryMatch && targetMerchant) {
      const mLower = targetMerchant.toLowerCase();
      if (mLower.includes("maggie") || mLower.includes("food") || mLower.includes("swiggy") || mLower.includes("zomato") || mLower.includes("tea") || mLower.includes("coffee")) {
        categoryMatch = "Food & Dining";
      }
    }

    return {
      intent: "ACTION_REQUEST",
      targetCategory: categoryMatch,
      targetMerchant,
      targetAmount: amount,
      targetDate,
      targetPaymentMethod,
      targetAccountName,
    };
  }

  // 3. WHAT-IF / SAFE TO SPEND / PURCHASING FEASIBILITY QUERY (e.g. "can I buy a phone", "can I afford 5000", "what if I save 2000")
  if (
    p.includes("what if") ||
    p.includes("if i ") ||
    p.includes("safe") ||
    p.includes("afford") ||
    p.includes("can i buy") ||
    p.includes("can i purchase") ||
    p.includes("can i get") ||
    p.includes("buy a") ||
    p.includes("buy an") ||
    p.includes("discretionary") ||
    p.includes("how much can i spend")
  ) {
    const cleaned = p.replace(/(\d+),(\d+)/g, "$1$2");
    const numMatch = cleaned.match(/\b\d+(\.\d+)?\b/);
    const amount = numMatch ? parseFloat(numMatch[0]) : undefined;

    return {
      intent: "SAFE_TO_SPEND_QUERY",
      targetAmount: amount,
    };
  }

  // 4. SUBSCRIPTION_QUERY (e.g. "subscriptions", "recurring", "memberships")
  if (p.includes("subscription") || p.includes("recurring") || p.includes("membership") || p.includes("netflix") || p.includes("spotify")) {
    return { intent: "SUBSCRIPTION_QUERY" };
  }

  // 5. COMPARISON & ANOMALY QUERY (e.g. "why did I spend more", "compare June and July")
  if (
    p.includes("why did i spend") ||
    p.includes("why did my spending") ||
    p.includes("spend more") ||
    p.includes("unusual") ||
    p.includes("anomaly") ||
    p.includes("spike")
  ) {
    return { intent: "ANOMALY_QUERY" };
  }

  if (p.includes("compare") || p.includes("vs") || p.includes("versus") || p.includes("compared to")) {
    return { intent: "COMPARISON_QUERY" };
  }

  // 6. BUDGET_QUERY (e.g. "budget", "limit", "over budget", "budgets")
  if (p.includes("budget") || p.includes("limit") || p.includes("over budget")) {
    return { intent: "BUDGET_QUERY" };
  }

  // 7. SAVING_ADVICE (e.g. "savings rate", "save money", "how to save", "net savings")
  if (p.includes("saving") || p.includes("save") || p.includes("savings rate")) {
    return { intent: "SAVING_ADVICE" };
  }

  // 8. FORECAST_QUERY (e.g. "forecast", "projection", "end of month", "month end")
  if (p.includes("forecast") || p.includes("projection") || p.includes("end of month") || p.includes("month end")) {
    return { intent: "FORECAST_QUERY" };
  }

  // 9. CATEGORY_QUERY (e.g. "food", "shopping", "transport", "where did my money go", "highest spending")
  const catMatch = CATEGORIES.find((c) => {
    const cLower = c.toLowerCase();
    const firstWord = cLower.split(/[\s&]+/)[0];
    return p.includes(cLower) || (firstWord.length > 2 && p.includes(firstWord));
  });

  if (catMatch || p.includes("where did") || p.includes("most of my money") || p.includes("top category") || p.includes("highest spending")) {
    return {
      intent: "CATEGORY_QUERY",
      targetCategory: catMatch,
    };
  }

  // 10. MERCHANT_QUERY (e.g. "amazon", "swiggy", "zomato", "uber", "starbucks", "flipkart")
  if (
    /\bat\s+/i.test(p) ||
    p.includes("on amazon") ||
    p.includes("swiggy") ||
    p.includes("zomato") ||
    p.includes("uber") ||
    p.includes("starbucks") ||
    p.includes("flipkart")
  ) {
    const merchantMatch = ["amazon", "swiggy", "zomato", "uber", "starbucks", "flipkart"].find((m) => p.includes(m));
    return {
      intent: "MERCHANT_QUERY",
      targetMerchant: merchantMatch,
    };
  }

  // 11. SPENDING_QUERY (e.g. "spend", "expenses", "spending", "how much did i spend")
  if (p.includes("spend") || p.includes("expense") || p.includes("cost") || p.includes("outflow") || p.includes("paid")) {
    return { intent: "SPENDING_QUERY" };
  }

  return { intent: "GENERAL_FINANCIAL_QUERY" };
}
