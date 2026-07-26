import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, PieChart,
  Sparkles, Bell, Settings, FileSearch, User, LogOut, ChevronsUpDown,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const main = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: ArrowLeftRight },
  { title: "Accounts", url: "/accounts", icon: Wallet },
  { title: "Budgets", url: "/budgets", icon: PieChart },
];

const smart = [
  { title: "AI Insights", url: "/insights", icon: Sparkles },
  { title: "Bank Statement", url: "/bank-statement", icon: FileSearch },
  
  { title: "Reminders", url: "/reminders", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

type Props = { name: string; email: string; initials: string; onSignOut: () => void | Promise<void> };

export function AppSidebar({ name, email, initials, onSignOut }: Props) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (u: string) => (u === "/" ? pathname === "/" : pathname.startsWith(u));

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-3 py-4">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl shadow-elegant ring-1 ring-black/10 overflow-hidden gradient-primary transition-transform group-hover:scale-[1.04]">
            <svg viewBox="0 0 44 44" className="h-11 w-11" aria-hidden="true">
              <defs>
                <linearGradient id="expenso-shine" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.35)" />
                  <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                </linearGradient>
              </defs>
              <rect x="0" y="0" width="44" height="44" fill="url(#expenso-shine)" />
              {/* mini bar chart */}
              <rect x="9"  y="26" width="3" height="8"  rx="1.2" fill="rgba(255,255,255,0.55)" />
              <rect x="14" y="22" width="3" height="12" rx="1.2" fill="rgba(255,255,255,0.7)" />
              <rect x="19" y="18" width="3" height="16" rx="1.2" fill="rgba(255,255,255,0.85)" />
              {/* rupee glyph */}
              <text x="27" y="30" fontFamily="Space Grotesk, sans-serif" fontWeight="700" fontSize="20" fill="#ffffff">₹</text>
            </svg>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-[1.35rem] font-semibold leading-none tracking-[-0.03em] text-foreground">
                Expenso
              </div>
              <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Smart finance
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>


      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel>Main</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {main.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} preload="viewport">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Smart</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {smart.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} preload="viewport">
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton size="lg" tooltip="Account" className="data-[state=open]:bg-sidebar-accent">
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full gradient-accent text-xs font-semibold text-accent-foreground">
                    {initials}
                  </div>
                  {!collapsed && (
                    <>
                      <div className="flex min-w-0 flex-1 flex-col text-left">
                        <span className="truncate font-display text-sm font-semibold">{name}</span>
                        <span className="truncate text-[11px] text-muted-foreground">{email}</span>
                      </div>
                      <ChevronsUpDown className="ml-auto h-4 w-4 text-muted-foreground" />
                    </>
                  )}
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56">
                <DropdownMenuLabel>
                  <div className="font-display text-sm">{name}</div>
                  <div className="text-xs font-normal text-muted-foreground truncate">{email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile"><User className="mr-2 h-4 w-4" />View profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/settings"><Settings className="mr-2 h-4 w-4" />Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSignOut()}>
                  <LogOut className="mr-2 h-4 w-4" />Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
