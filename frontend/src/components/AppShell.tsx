import { useState, type ReactNode } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu, Scissors, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { endSession } from "@/lib/session";
import { useMe, homeFor } from "@/lib/useMe";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface NavItem {
  label: string;
  short?: string;
  path: string;
  icon: LucideIcon;
  testId: string;
  end?: boolean;
  mobile?: boolean; // shown in the bottom bar
}

export function Brand({ dark = true }: { dark?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5" data-testid="brand-logo">
      <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-rose-500 text-white shadow-lg shadow-indigo-500/30">
        <Scissors className="size-4.5" />
      </span>
      <span className={cn("font-heading text-lg font-extrabold tracking-tight", dark ? "text-white" : "text-slate-900")}>
        AgendaPRO<span className="text-rose-400">Hair</span>
      </span>
    </Link>
  );
}

interface ShellProps {
  scope: "admin" | "salon";
  nav: NavItem[];
  banner?: ReactNode;
}

export function AppShell({ scope, nav, banner }: ShellProps) {
  const me = useMe();
  const loc = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (me.isPending) {
    return <div className="grid min-h-screen place-items-center text-slate-500" data-testid="shell-loading">Carregando…</div>;
  }
  if (me.isError || !me.data) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  const u = me.data;
  const allowed = scope === "admin" ? u.platform_role === "superadmin" : !!u.salon_role;
  if (!allowed) return <Navigate to={homeFor(u)} replace />;

  const mobileItems = nav.filter((n) => n.mobile);
  const roleLabel = scope === "admin" ? "Super Admin" : u.salon_role === "owner" ? "Proprietário" : "Profissional";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 lg:flex" data-testid="desktop-sidebar">
        <div className="px-5 pb-4 pt-6"><Brand /></div>
        <div className="mx-4 mb-4 rounded-xl border border-slate-800 bg-slate-800/50 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wider text-slate-400">{scope === "admin" ? "Plataforma" : "Salão"}</p>
          <p className="truncate text-sm font-semibold text-white" data-testid="sidebar-tenant-name">{scope === "admin" ? "Painel Master SaaS" : u.salon_name}</p>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {nav.map((n) => (
            <NavLink
              key={n.path}
              to={n.path}
              end={n.end}
              data-testid={`nav-sidebar-${n.testId}`}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-[background-color,color] duration-150",
                  isActive ? "bg-indigo-500/15 text-white ring-1 ring-inset ring-indigo-400/30" : "text-slate-400 hover:bg-slate-800 hover:text-white",
                )
              }
            >
              <n.icon className="size-4.5" />
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 p-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-rose-400 text-sm font-bold text-white">
              {u.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white" data-testid="sidebar-user-name">{u.name}</p>
              <p className="text-xs text-slate-400">{roleLabel}</p>
            </div>
            <button
              onClick={() => endSession("/login")}
              data-testid="btn-logout"
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              aria-label="Sair"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3 lg:hidden">
        <Brand />
        <span className="max-w-[40%] truncate rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
          {scope === "admin" ? "Super Admin" : u.salon_name}
        </span>
      </header>

      <main className="pb-24 lg:pb-10 lg:pl-64">
        {banner}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        data-testid="mobile-bottom-nav"
        className="fixed inset-x-0 bottom-0 z-50 flex h-16 items-center justify-around border-t border-slate-200/80 bg-white/90 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_20px_rgba(0,0,0,0.06)] backdrop-blur-xl lg:hidden"
      >
        {mobileItems.map((n) => (
          <NavLink
            key={n.path}
            to={n.path}
            end={n.end}
            data-testid={`nav-mobile-bottom-${n.testId}`}
            className={({ isActive }) =>
              cn("flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium transition-colors", isActive ? "text-indigo-600" : "text-slate-500")
            }
          >
            <n.icon className="size-5" />
            {n.short ?? n.label}
          </NavLink>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          data-testid="nav-mobile-bottom-menu"
          className="flex flex-1 flex-col items-center gap-0.5 py-1.5 text-[11px] font-medium text-slate-500"
        >
          <Menu className="size-5" />
          Menu
        </button>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" showCloseButton={false} className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]" data-testid="mobile-menu-sheet">
          <SheetHeader className="flex-row items-center justify-between">
            <SheetTitle>Menu</SheetTitle>
            <button onClick={() => setMoreOpen(false)} className="rounded-lg p-1.5 text-slate-500" aria-label="Fechar" data-testid="mobile-menu-close">
              <X className="size-5" />
            </button>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-2 px-4">
            {nav.map((n) => (
              <NavLink
                key={n.path}
                to={n.path}
                end={n.end}
                onClick={() => setMoreOpen(false)}
                data-testid={`nav-mobile-menu-${n.testId}`}
                className={({ isActive }) =>
                  cn("flex flex-col items-center gap-2 rounded-2xl border p-3 text-center text-xs font-medium transition-colors",
                    isActive ? "border-indigo-200 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600")
                }
              >
                <n.icon className="size-5" />
                {n.label}
              </NavLink>
            ))}
            <button
              onClick={() => endSession("/login")}
              data-testid="btn-logout-mobile"
              className="flex flex-col items-center gap-2 rounded-2xl border border-rose-200 p-3 text-xs font-medium text-rose-600"
            >
              <LogOut className="size-5" />
              Sair
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
