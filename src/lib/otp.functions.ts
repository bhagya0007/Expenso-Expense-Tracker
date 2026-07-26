import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const FROM_ADDRESS = "Expenso <onboarding@resend.dev>";
const OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

async function hashCode(code: string, email: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(`${email.toLowerCase()}:${code}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function generateCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000;
  return n.toString().padStart(6, "0");
}

async function sendOtpEmail(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("Email service not configured");

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [email],
      subject: `Your Expenso verification code: ${code}`,
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0b1220;color:#e2e8f0;border-radius:16px">
          <div style="text-align:center;margin-bottom:28px">
            <div style="display:inline-block;padding:12px 16px;background:linear-gradient(135deg,#6366f1,#8b5cf6);border-radius:12px;font-weight:700;font-size:20px;color:#fff">Expenso</div>
          </div>
          <h1 style="font-size:22px;margin:0 0 12px;color:#f8fafc">Reset your password</h1>
          <p style="font-size:15px;line-height:1.55;color:#94a3b8;margin:0 0 24px">Enter this 6-digit code on the password reset screen. It expires in ${OTP_TTL_MINUTES} minutes.</p>
          <div style="text-align:center;padding:24px;background:#111827;border:1px solid #1f2937;border-radius:12px;margin-bottom:24px">
            <div style="font-family:'SF Mono',Menlo,monospace;font-size:36px;font-weight:700;letter-spacing:8px;color:#a5b4fc">${code}</div>
          </div>
          <p style="font-size:13px;color:#64748b;margin:0">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        </div>
      `,
      text: `Your Expenso verification code is: ${code}\n\nEnter this on the password reset screen. It expires in ${OTP_TTL_MINUTES} minutes.\n\nIf you didn't request this, ignore this email.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[Resend] Send failed [${res.status}]: ${body}`);
    throw new Error("Could not send the verification email. Please try again.");
  }
}

export const requestPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Rate limiting
    const oneMinAgo = new Date(Date.now() - 60_000).toISOString();
    const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();

    const { count: recentCount } = await supabaseAdmin
      .from("password_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneMinAgo);
    if ((recentCount ?? 0) > 0) {
      throw new Error("Please wait a minute before requesting another code.");
    }

    const { count: hourCount } = await supabaseAdmin
      .from("password_otps")
      .select("id", { count: "exact", head: true })
      .eq("email", email)
      .gte("created_at", oneHourAgo);
    if ((hourCount ?? 0) >= 5) {
      throw new Error("Too many requests. Try again in an hour.");
    }

    // Verify the account exists (so we don't send codes for non-users)
    const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      console.error("[OTP] listUsers failed", listErr);
      throw new Error("Something went wrong. Please try again.");
    }
    const userExists = userList.users.some((u) => u.email?.toLowerCase() === email);

    // Always respond success to avoid email enumeration, but only send if user exists.
    if (!userExists) {
      return { ok: true };
    }

    const code = generateCode();
    const code_hash = await hashCode(code, email);
    const expires_at = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString();

    // Invalidate previous unused codes
    await supabaseAdmin
      .from("password_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("email", email)
      .is("consumed_at", null);

    const { error: insertErr } = await supabaseAdmin
      .from("password_otps")
      .insert({ email, code_hash, expires_at });
    if (insertErr) {
      console.error("[OTP] insert failed", insertErr);
      throw new Error("Something went wrong. Please try again.");
    }

    await sendOtpEmail(email, code);
    return { ok: true };
  });

export const verifyPasswordOtp = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z
      .object({
        email: z.string().email(),
        code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
        new_password: z.string().min(6, "Password must be at least 6 characters"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("password_otps")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("email", email)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("[OTP] select failed", error);
      throw new Error("Something went wrong. Please try again.");
    }

    const row = rows?.[0];
    if (!row) throw new Error("No active code. Request a new one.");
    if (new Date(row.expires_at).getTime() < Date.now()) {
      throw new Error("Code expired. Request a new one.");
    }
    if (row.attempts >= MAX_ATTEMPTS) {
      throw new Error("Too many attempts. Request a new code.");
    }

    const submitted_hash = await hashCode(data.code, email);
    const match = submitted_hash === row.code_hash;

    if (!match) {
      await supabaseAdmin
        .from("password_otps")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      throw new Error(`Incorrect code. ${MAX_ATTEMPTS - row.attempts - 1} attempts left.`);
    }

    // Mark consumed BEFORE the password update so a duplicate-click can't reuse it.
    await supabaseAdmin
      .from("password_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    // Find the user and update their password.
    const { data: userList, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) {
      console.error("[OTP] listUsers failed", listErr);
      throw new Error("Something went wrong. Please try again.");
    }
    const user = userList.users.find((u) => u.email?.toLowerCase() === email);
    if (!user) throw new Error("Account not found.");

    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: data.new_password,
    });
    if (updateErr) {
      console.error("[OTP] password update failed", updateErr);
      throw new Error("Could not update password. Please try again.");
    }

    return { ok: true };
  });
