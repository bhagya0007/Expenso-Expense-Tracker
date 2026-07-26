import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { confirmPasswordReset, verifyPasswordResetCode } from "firebase/auth";
import { auth } from "@/integrations/firebase/client";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, KeyRound, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const [ready, setReady] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [oobCode, setOobCode] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get("oobCode");
      if (code) {
        setOobCode(code);
        verifyPasswordResetCode(auth, code)
          .then(() => setReady(true))
          .catch(() => setInvalid(true));
      } else {
        setInvalid(true);
      }
    }
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      if (oobCode) {
        await confirmPasswordReset(auth, oobCode, password);
      }
      setDone(true);
      toast.success("Password updated successfully!");
      setTimeout(() => navigate({ to: "/auth" }), 1500);
    } catch (err: any) {
      toast.error(err?.message || "Failed to update password");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen w-full grid place-items-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl gradient-primary shadow-glow">
            <KeyRound className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-semibold">Set a new password</h1>
            <p className="text-sm text-muted-foreground">Choose something you'll remember.</p>
          </div>
        </div>

        {done ? (
          <div className="rounded-xl border border-border/60 bg-muted/40 p-6 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-primary" />
            <p className="font-medium">Password updated</p>
            <p className="text-sm text-muted-foreground">Redirecting you to sign in…</p>
          </div>
        ) : invalid && !ready ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a fresh one from the sign-in page.
            </p>
            <Button className="w-full" onClick={() => navigate({ to: "/auth" })}>
              Back to sign in
            </Button>
          </div>
        ) : !ready ? (
          <div className="grid place-items-center py-12 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="pw">New password</Label>
              <PasswordInput id="pw" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cpw">Confirm password</Label>
              <PasswordInput id="cpw" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full h-11" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Update password
            </Button>
          </form>
        )}
      </motion.div>
    </div>
  );
}
