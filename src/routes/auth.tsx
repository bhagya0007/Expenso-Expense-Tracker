import { createFileRoute, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Sparkles, Loader2, ArrowLeft, MailCheck, MailQuestion } from "lucide-react";

type Mode =
  | { kind: "auth" }
  | { kind: "forgot" }
  | { kind: "verify"; email: string };

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { next?: string } =>
    typeof s.next === "string" ? { next: s.next } : {},
  component: AuthPage,
});

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { next } = Route.useSearch();
  const [mode, setMode] = useState<Mode>({ kind: "auth" });

  useEffect(() => {
    if (!loading && session && pathname === "/auth") {
      const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      window.location.href = target;
    }
  }, [session, loading, pathname, navigate, next]);

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-2 bg-background">
      {/* Left brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden p-10 gradient-primary">
        <div className="flex items-center gap-2 text-primary-foreground">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <span className="font-display text-xl font-bold italic">E</span>
          </div>
          <div className="font-display text-2xl font-semibold tracking-tight">Expenso</div>
        </div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
          className="text-primary-foreground max-w-md">
          <h1 className="font-display text-5xl leading-[1.05] font-semibold tracking-tight">
            Your money,<br/>a little kinder.
          </h1>
          <p className="mt-4 text-primary-foreground/80 text-lg">
            Track spends, analyze statements and understand where every rupee goes — all in one warm little place.
          </p>
        </motion.div>
        <div className="text-xs text-primary-foreground/70">© {new Date().getFullYear()} Expenso · Made with care</div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8 flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-glow">
              <span className="font-display text-lg font-bold italic text-primary-foreground">E</span>
            </div>
            <span className="font-display text-2xl font-semibold">Expenso</span>
          </div>

          <AnimatePresence mode="wait">
            {mode.kind === "auth" && (
              <motion.div key="auth" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="signin">Sign in</TabsTrigger>
                    <TabsTrigger value="signup">Create account</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="mt-6">
                    <SignInForm
                      onForgot={() => setMode({ kind: "forgot" })}
                      onUnverified={(email) => setMode({ kind: "verify", email })}
                    />
                  </TabsContent>
                  <TabsContent value="signup" className="mt-6">
                    <SignUpForm onVerify={(email) => setMode({ kind: "verify", email })} />
                  </TabsContent>
                </Tabs>

                <p className="mt-6 text-center text-xs text-muted-foreground">
                  <Sparkles className="inline h-3 w-3 mr-1" />
                  By continuing you agree to Expenso's terms & privacy policy.
                </p>

              </motion.div>
            )}

            {mode.kind === "forgot" && (
              <motion.div key="forgot" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <ForgotPasswordForm
                  onBack={() => setMode({ kind: "auth" })}
                />
              </motion.div>
            )}

            {mode.kind === "verify" && (
              <motion.div key="verify" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
                <VerifyEmailScreen email={mode.email} onBack={() => setMode({ kind: "auth" })} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

import {
  signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, sendEmailVerification
} from "firebase/auth";
import { auth } from "@/integrations/firebase/client";

const GMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

function SignInForm({ onForgot, onUnverified }: { onForgot: () => void; onUnverified: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { signInWithMock } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!GMAIL_REGEX.test(email.trim())) {
      toast.error("Please enter a valid Gmail address ending with @gmail.com");
      return;
    }
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user && !cred.user.emailVerified) {
        toast.info("Please check your email and verify your account before logging in.");
        try { await firebaseSignOut(auth); } catch {}
        onUnverified(email.trim());
        setBusy(false);
        return;
      }
      toast.success("Welcome back!");
      navigate({ to: "/" });
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/invalid-credential" || code === "auth/user-not-found" || code === "auth/wrong-password") {
        toast.error("Account not found or password incorrect. Please click 'Create account' to register.");
      } else if (code.includes("api-key") || code.includes("invalid-api-key")) {
        toast.error("Invalid Firebase API Key. Please update your VITE_FIREBASE_API_KEY in .env");
      } else {
        toast.error(err?.message || "Sign in failed. Please verify your email first.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" placeholder="you@gmail.com" value={email}
          onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="si-pw">Password</Label>
          <button type="button" onClick={onForgot}
            className="text-xs font-medium text-primary hover:underline underline-offset-4">
            Forgot password?
          </button>
        </div>
        <PasswordInput id="si-pw" placeholder="••••••••" value={password}
          onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full h-11" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
      </Button>
    </form>
  );
}

function SignUpForm({ onVerify }: { onVerify: (email: string) => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { signInWithMock } = useAuth();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!GMAIL_REGEX.test(email.trim())) {
      toast.error("Please enter a valid Gmail address ending with @gmail.com");
      return;
    }
    setBusy(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      if (cred.user) {
        if (name.trim()) {
          await updateProfile(cred.user, { displayName: name.trim() });
        }
        try {
          await sendEmailVerification(cred.user, {
            url: `${window.location.origin}/auth`,
            handleCodeInApp: true,
          });
        } catch (vErr: any) {
          console.warn("sendEmailVerification warning:", vErr);
        }
        try {
          await firebaseSignOut(auth);
        } catch {}
      }
      toast.success("Account created! Verification email sent.");
      onVerify(email.trim());
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        toast.error("This email is already registered. Please sign in instead.");
      } else if (code.includes("api-key") || code.includes("invalid-api-key")) {
        toast.error("Invalid Firebase API Key. Please update your VITE_FIREBASE_API_KEY in .env");
      } else {
        toast.error(err?.message || "Sign up failed");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Full name</Label>
        <Input id="su-name" type="text" placeholder="Rohan Sharma" value={name}
          onChange={(e) => setName(e.target.value)} required autoComplete="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" placeholder="you@gmail.com" value={email}
          onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-pw">Password</Label>
        <PasswordInput id="su-pw" placeholder="At least 6 characters" value={password}
          onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full h-11" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create account
      </Button>
    </form>
  );
}

function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!GMAIL_REGEX.test(email.trim())) {
      toast.error("Please enter a valid Gmail address ending with @gmail.com");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSent(true);
      toast.success("Reset link sent");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send reset email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10">
          <MailQuestion className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold">Reset your password</h2>
          <p className="text-sm text-muted-foreground">We'll email you a secure reset link.</p>
        </div>
      </div>

      {sent ? (
        <div className="rounded-xl border border-border/60 bg-muted/40 p-5 text-sm">
          <p className="font-medium">Check your inbox</p>
          <p className="mt-1 text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, a password reset link is on its way. It may take a minute or two.
          </p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => setSent(false)}>
            Send another link
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="fp-email">Email</Label>
            <Input id="fp-email" type="email" placeholder="you@gmail.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <Button type="submit" className="w-full h-11" disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send reset link
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            We'll email you a secure link that opens the password reset screen.
          </p>
        </form>
      )}
    </div>
  );
}


function VerifyEmailScreen({ email, onBack }: { email: string; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function resend() {
    setBusy(true);
    try {
      if (auth.currentUser) {
        await sendEmailVerification(auth.currentUser);
        toast.success("Verification email resent");
        setCooldown(45);
      } else {
        toast.info("Please sign in to resend verification email");
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to resend verification email");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </button>
      <div className="rounded-2xl border border-border/60 bg-card p-6">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-xl gradient-primary shadow-glow">
          <MailCheck className="h-6 w-6 text-primary-foreground" />
        </div>
        <h2 className="font-display text-2xl font-semibold">Verify your email</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{email}</span>.
          Click the link in that email to activate your Expenso account.
        </p>
        <div className="mt-5 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
          Can't find it? Check your spam folder, or resend below. Emails can take a minute to arrive.
        </div>
        <Button onClick={resend} disabled={busy || cooldown > 0} className="mt-5 w-full h-11">
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
        </Button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Already verified? <Link to="/auth" className="text-primary hover:underline" onClick={onBack}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}



