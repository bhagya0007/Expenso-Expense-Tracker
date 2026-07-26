import { QueryClient, QueryClientProvider, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, useRouterState, useNavigate, Navigate,
  HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Bell, Sun, Moon, User, LogOut, Loader2 } from "lucide-react";
import { useTheme } from "@/hooks/use-theme";
import { ThemeProvider } from "@/hooks/use-theme";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { api } from "@/lib/api";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-gradient">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist yet.
        </p>
        <div className="mt-6">
          <Button asChild><Link to="/">Back to dashboard</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">Something went wrong. Try again.</p>
        <div className="mt-6 flex justify-center gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Try again</Button>
          <Button variant="outline" asChild><a href="/">Go home</a></Button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Expenso — Smart Expense Tracker & Money Companion" },
      { name: "description", content: "Expenso helps you track expenses, analyze bank statements and plan budgets — all with a warm, human touch." },
      { name: "author", content: "Expenso" },
      { property: "og:title", content: "Expenso — Smart Expense Tracker & Money Companion" },
      { property: "og:description", content: "Expenso helps you track expenses, analyze bank statements and plan budgets — all with a warm, human touch." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Expenso — Smart Expense Tracker & Money Companion" },
      { name: "twitter:description", content: "Expenso helps you track expenses, analyze bank statements and plan budgets — all with a warm, human touch." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/77c59d1a-f67a-4cbd-b41f-4250feb000ae" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/attachments/og-images/77c59d1a-f67a-4cbd-b41f-4250feb000ae" },
      { httpEquiv: "X-Content-Type-Options", content: "nosniff" },
      { httpEquiv: "X-Frame-Options", content: "DENY" },
      { httpEquiv: "Referrer-Policy", content: "strict-origin-when-cross-origin" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head><HeadContent /></head>
      <body suppressHydrationWarning>{children}<Scripts /></body>
    </html>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <Button size="icon" variant="ghost" onClick={toggle} className="rounded-xl" aria-label="Toggle theme">
      {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

function initials(name?: string | null, email?: string | null) {
  const src = (name?.trim() || email?.split("@")[0] || "U").split(/\s+/);
  return (src[0]?.[0] ?? "U").toUpperCase() + (src[1]?.[0] ?? "").toUpperCase();
}

function inr(n: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function RemindersBell() {
  const { data: items = [] } = useQuery({ queryKey: ["reminders"], queryFn: () => api.listReminders() });
  const now = Date.now();
  const upcoming = items
    .filter((r) => +new Date(r.dueDate) >= now - 24 * 60 * 60 * 1000)
    .slice(0, 6);
  const count = upcoming.length;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon" variant="ghost" className="relative rounded-xl" aria-label="Reminders">
          <Bell className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full gradient-primary px-1 text-[10px] font-bold text-primary-foreground shadow-glow">
              {count}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span className="font-display">Reminders</span>
          <Link to="/reminders" className="text-[11px] font-normal text-primary hover:underline">View all</Link>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {upcoming.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            No upcoming reminders.
            <div className="mt-2">
              <Link to="/reminders" className="text-primary hover:underline">Add one →</Link>
            </div>
          </div>
        ) : (
          upcoming.map((r) => {
            const due = new Date(r.dueDate);
            const days = Math.ceil((+due - now) / (24 * 60 * 60 * 1000));
            const label = days < 0 ? `Overdue ${-days}d` : days === 0 ? "Due today" : days === 1 ? "Tomorrow" : `In ${days}d`;
            const tone = days < 0 ? "text-destructive" : days <= 2 ? "text-warning" : "text-muted-foreground";
            return (
              <DropdownMenuItem key={r.id} asChild className="cursor-pointer">
                <Link to="/reminders" className="flex items-start gap-3">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{r.title}</div>
                    <div className={`text-[11px] ${tone}`}>{label} · {due.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</div>
                  </div>
                  <div className="text-xs font-semibold">{inr(r.amount)}</div>
                </Link>
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AppShell() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "You";
  const email = user?.email ?? "";
  const handleSignOut = async () => {
    await signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  };
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar name={name} email={email} initials={initials(name, email)} onSignOut={handleSignOut} />
        <div className="flex flex-1 flex-col min-w-0">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/50 bg-background/60 px-4 backdrop-blur-xl">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
              <RemindersBell />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="grid h-8 w-8 place-items-center rounded-full gradient-accent text-xs font-semibold text-accent-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring">
                    {initials(name, email)}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="font-display text-sm">{name}</div>
                    <div className="text-xs font-normal text-muted-foreground truncate">{email}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/profile"><User className="mr-2 h-4 w-4" />View profile</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main className="flex-1"><Outlet /></main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Gate() {
  const { session, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const isAuthRoute = pathname === "/auth" || pathname === "/reset-password";
  const uid = session?.user?.uid ?? session?.user?.id ?? null;

  useEffect(() => {
    if (loading) return;
    if (!session && !isAuthRoute) navigate({ to: "/auth" });
  }, [loading, session, isAuthRoute, navigate]);

  // When the signed-in user changes, drop cached data so the new user's
  // own (possibly empty) store is fetched instead of the previous user's.
  useEffect(() => {
    qc.clear();
  }, [uid, qc]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isAuthRoute) return <Outlet />;
  if (!session) return <Navigate to="/auth" replace />;
  return <AppShell />;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Gate />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

