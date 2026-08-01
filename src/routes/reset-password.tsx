import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/password-input";
import { PropzLogo } from "@/components/propz-logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Restablecer contraseña — Propz" },
      { name: "description", content: "Define una nueva contraseña para tu cuenta Propz." },
      { property: "og:title", content: "Restablecer contraseña — Propz" },
      { property: "og:description", content: "Define una nueva contraseña para tu cuenta Propz." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error("No pudimos actualizar tu contraseña", { description: error.message });
      return;
    }
    toast.success("Contraseña actualizada");
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center text-foreground">
          <PropzLogo wordmarkClassName="text-[2rem]" markClassName="h-9 w-9" />
        </Link>
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <h1 className="text-lg font-semibold">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ingresa la contraseña que usarás desde ahora.
          </p>
          <form onSubmit={handle} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="rp-password">Contraseña</Label>
              <PasswordInput
                id="rp-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-confirm">Repetir contraseña</Label>
              <PasswordInput
                id="rp-confirm"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Guardando..." : "Guardar contraseña"}
            </Button>
          </form>
          <Link
            to="/auth"
            className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground transition-propz hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Volver a iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
