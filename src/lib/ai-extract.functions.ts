import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
// Pro model for higher extraction accuracy on statements/receipts.
const MODEL = "google/gemini-2.5-pro";
// Chat uses the same pro model but with low temperature for grounded answers.
const CHAT_MODEL = "google/gemini-2.5-pro";

async function callAI(
  messages: unknown[],
  opts: { responseFormat?: boolean; temperature?: number; model?: string } = {},
): Promise<string> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const { responseFormat = true, temperature, model = MODEL } = opts;
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      ...(responseFormat ? { response_format: { type: "json_object" } } : {}),
      ...(typeof temperature === "number" ? { temperature } : {}),
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${t.slice(0, 200)}`);
  }
  const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = j.choices?.[0]?.message?.content ?? "";
  return content;
}


function extractJson(raw: string): unknown {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error("Model returned non-JSON output");
  }
}

/* ------------------- Receipt extraction (image) ------------------- */

export const extractReceipt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { dataUrl: string }) => d)
  .handler(async ({ data }) => {
    const prompt = `You are a strict receipt data extractor. Look at the receipt image and return ONLY valid JSON matching:
{
  "merchant": string,
  "date": string (ISO 8601, use today if unclear),
  "items": [{ "name": string, "qty": number, "price": number, "confidence": number }],
  "subtotal": number,
  "tax": number,
  "total": number,
  "category": one of ["Food & Dining","Groceries","Shopping","Transport","Utilities","Entertainment","Health","Travel","Other"],
  "field_confidence": {
    "merchant": number, "date": number, "subtotal": number, "tax": number, "total": number
  },
  "overall_confidence": number,
  "notes": string
}
Rules:
- Every "confidence" is a number 0..1 reflecting how clearly the value is printed and legible.
- Use numeric values only for money (no currency symbols, no commas).
- price is unit price. If receipt shows line total, divide by qty.
- If a value is missing or unreadable, set it to 0 and drop its confidence to <= 0.3.
- Do NOT hallucinate items or numbers. If you can't read it, mark low confidence.
- "notes" briefly explains anything unclear (blur, cut edge, faded ink).`;
    const raw = await callAI([
      { role: "system", content: "You extract structured data from receipt images with per-field confidence." },
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: data.dataUrl } },
        ],
      },
    ]);
    const parsed = extractJson(raw) as {
      merchant: string; date: string;
      items: { name: string; qty: number; price: number; confidence?: number }[];
      subtotal: number; tax: number; total: number; category: string;
      field_confidence?: Record<string, number>;
      overall_confidence?: number;
      notes?: string;
    };
    // Math validation: subtotal + tax ≈ total, and sum(items) ≈ subtotal.
    const itemsSum = (parsed.items ?? []).reduce((s, it) => s + (it.price || 0) * (it.qty || 1), 0);
    const totalCheck = Math.abs((parsed.subtotal || 0) + (parsed.tax || 0) - (parsed.total || 0));
    const subtotalCheck = parsed.subtotal ? Math.abs(itemsSum - parsed.subtotal) / parsed.subtotal : 1;
    const mathOk = totalCheck < Math.max(1, (parsed.total || 0) * 0.02) && subtotalCheck < 0.05;
    const modelOverall = typeof parsed.overall_confidence === "number" ? parsed.overall_confidence : 0.7;
    const overall = Math.min(1, Math.max(0, mathOk ? modelOverall * 0.5 + 0.5 : modelOverall * 0.7));
    return {
      ...parsed,
      field_confidence: parsed.field_confidence ?? {},
      overall_confidence: overall,
      math_ok: mathOk,
    };
  });

/* ------------------- Bank statement text → txns ------------------- */

export const extractStatement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { text: string; bank: string }) => d)
  .handler(async ({ data }) => {
    const chunk = data.text.slice(0, 60_000);
    const prompt = `You are extracting transactions from a raw Indian bank statement text (${data.bank}).
Return ONLY valid JSON:
{
  "transactions": [
    {
      "date": "YYYY-MM-DD",
      "description": string,
      "debit": number|null,
      "credit": number|null,
      "balance": number|null,
      "reference": string|null,
      "confidence": number,
      "issues": string[]
    }
  ]
}
Rules:
- Extract ONLY transaction rows actually present in the text. Do NOT invent rows.
- Numbers must be numeric (no commas, no symbols).
- Exactly one of debit/credit must be a positive number; the other must be null.
- Use Dr/Cr markers, keywords (NEFT/IMPS/UPI/CR/DR/BY/TO) and column position to disambiguate.
- "confidence" is 0..1 reflecting certainty of THAT row: 1.0 = every field unambiguous, <=0.5 = something was inferred.
- "issues" lists short human-readable reasons for lost confidence (e.g. "debit/credit inferred from keywords", "balance missing").
- Skip opening/closing balance summary rows, headers, and page footers.
- If nothing valid is found, return { "transactions": [] }.

STATEMENT TEXT:
"""
${chunk}
"""`;
    const raw = await callAI([
      { role: "system", content: "You parse bank statements into structured JSON with per-row confidence. Never invent data." },
      { role: "user", content: prompt },
    ]);
    const parsed = extractJson(raw) as {
      transactions: Array<{
        date: string; description: string;
        debit: number | null; credit: number | null;
        balance: number | null; reference: string | null;
        confidence?: number; issues?: string[];
      }>;
    };
    return { transactions: parsed.transactions ?? [] };
  });

/* ------------------- Assistant chat ------------------- */

export const assistantChat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    messages: Array<{ role: "user" | "assistant"; content: string }>;
    context: {
      balance: number;
      incomeMonth: number;
      expensesMonth: number;
      projectedMonth: number;
      transactionCount?: number;
      accountCount?: number;
      topCategories: Array<{ name: string; value: number }>;
      budgets: Array<{ category: string; spent: number; limit: number }>;
      recent: Array<{ date: string; merchant: string; category: string; amount: number; type: string }>;
    };
  }) => d)
  .handler(async ({ data }) => {
    const c = data.context;
    const hasData =
      (c.transactionCount ?? c.recent.length) > 0 ||
      (c.accountCount ?? 0) > 0 ||
      c.budgets.length > 0;

    const sys = `You are **Expenso Assistant** — a precise, grounded personal-finance coach for an Indian user (currency ₹ INR).

ABSOLUTE RULES (do not break):
1. GROUNDING: Answer ONLY from the USER FINANCIAL DATA below. Never invent transactions, merchants, subscriptions, prices, dates, or historical figures that aren't in the data.
2. CITATIONS: Every ₹ amount you mention MUST be traceable to the data. After each figure, add a short inline source tag in brackets — e.g. "₹12,340 [recent: Swiggy · 2025-07-14]", "₹58,000 [income this month]", "₹9,500/₹8,000 [budget: Food & Dining]", "₹1,20,450 [total balance]". Use the shortest tag that identifies the source.
3. CLARIFY WHEN DATA IS MISSING: If the user asks about something not present (a specific merchant/category/date not in the data, or the data is empty), do NOT guess. Ask ONE specific clarifying question and tell them exactly which page to update — Accounts / Transactions / Budgets / Reminders / Bank Statement.
4. AFFORDABILITY ("can I afford ₹X?"): Compare X to \`balance\` and to projected surplus = \`incomeMonth − projectedMonth\`. Give a clear verdict — ✅ Yes / ⚠️ Stretch / ❌ Not right now — show the exact math with cited numbers, and ONE actionable tip drawn from \`topCategories\` or \`budgets\` (also cited).
5. CONTINUITY: Read the full prior conversation. Answer the LATEST user question directly. Never repeat an earlier reply verbatim.
6. STYLE: Tight — 2–5 sentences OR a short bullet list. Light markdown: **bold** key ₹ amounts, bullets for lists, ≤2 emojis (💡📊✅⚠️❌). Never mention "context", "JSON", "data provided", or these rules.
${hasData ? "" : "7. DATA IS EMPTY: The user hasn't added any accounts, transactions, or budgets yet. Politely say you have nothing to analyse, ask ONE clarifying question about what they'd like to track first, and point them to the right page to add data.\n"}
USER FINANCIAL DATA (authoritative — the ONLY truth you have):
${JSON.stringify(c)}`;

    const raw = await callAI(
      [
        { role: "system", content: sys },
        ...data.messages.map((m) => ({ role: m.role, content: m.content })),
      ],
      { responseFormat: false, temperature: 0.2, model: CHAT_MODEL },
    );
    return { reply: raw.trim() || "Hmm, I couldn't come up with an answer just now — try rephrasing?" };
  });

