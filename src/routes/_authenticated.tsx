import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { ensureAccountSetup } from "@/lib/account-bootstrap";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
    await ensureAccountSetup();
    return { user: data.user };
  },
  component: AuthedLayout,
  // Shown while the session is checked after the browser reloads the tab
  // (e.g. returning from another app on mobile) instead of a blank screen.
  pendingComponent: AuthedPending,
  pendingMs: 0,
});

function AuthedPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-primary" />
    </div>
  );
}

function AuthedLayout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
