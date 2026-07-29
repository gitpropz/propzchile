import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, Building, FileText, Settings, LogOut, Menu, X, FileUp } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

import { PropzLogo } from "@/components/propz-logo";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/properties", label: "Propiedades", icon: Building },
  { to: "/contracts", label: "Contratos", icon: FileText },
  { to: "/rent/import", label: "Importar cartola", icon: FileUp },
  { to: "/settings/organization", label: "Configuración", icon: Settings, match: "/settings" },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    toast.success("Sesión cerrada");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SidebarInner pathname={pathname} onSignOut={signOut} onNavigate={() => {}} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-[17rem] flex-col bg-sidebar text-sidebar-foreground">
            <SidebarInner pathname={pathname} onSignOut={signOut} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-border bg-background/85 px-3 py-2.5 backdrop-blur-md md:hidden">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X /> : <Menu />}
          </Button>
          <PropzLogo markClassName="h-7 w-7" wordmarkClassName="text-[1.5rem]" />
        </header>
        <main className="flex-1 overflow-x-hidden pb-[env(safe-area-inset-bottom)]">{children}</main>
      </div>
    </div>
  );
}

function SidebarInner({
  pathname,
  onSignOut,
  onNavigate,
}: {
  pathname: string;
  onSignOut: () => void;
  onNavigate: () => void;
}) {
  return (
    <>
      <div className="px-5 py-6">
        <PropzLogo tone="inverse" wordmarkClassName="text-[1.75rem] text-sidebar-foreground" />
      </div>
      <nav className="flex-1 space-y-0.5 px-3">
        {nav.map((item) => {
          const active = "match" in item && item.match
            ? pathname.startsWith(item.match)
            : pathname === item.to || pathname.startsWith(item.to + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-propz",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon
                className={cn("h-[1.05rem] w-[1.05rem] shrink-0", active && "text-sidebar-primary")}
                strokeWidth={1.75}
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border p-3">
        <button
          onClick={onSignOut}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/70 transition-propz hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-[1.05rem] w-[1.05rem]" strokeWidth={1.75} />
          Cerrar sesión
        </button>
      </div>
    </>
  );
}
