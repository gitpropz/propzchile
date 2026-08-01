import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PasswordInput } from "@/components/password-input";
import { PropzLogo } from "@/components/propz-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";


export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Propz" },
      { name: "description", content: "Accede a tu panel de administración de propiedades." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">("signin");

  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#signup") {
      setTab("signup");
    }
    // Redirect if already signed in
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-surface px-4 py-10">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-propz hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Volver al inicio
        </Link>
        <Link to="/" className="mb-8 flex items-center justify-center text-foreground">
          <PropzLogo wordmarkClassName="text-[2rem]" markClassName="h-9 w-9" />
        </Link>



        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">

          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Iniciar sesión</TabsTrigger>
              <TabsTrigger value="signup">Crear cuenta</TabsTrigger>
            </TabsList>

            <TabsContent value="signin" className="pt-6">
              <SignInForm onSuccess={() => navigate({ to: "/dashboard", replace: true })} />
            </TabsContent>
            <TabsContent value="signup" className="pt-6">
              <SignUpForm onSuccess={() => navigate({ to: "/dashboard", replace: true })} />
            </TabsContent>
          </Tabs>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">o continúa con</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <GoogleButton />
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Al continuar aceptas los términos y la política de privacidad.
        </p>
      </div>
    </div>
  );
}

function SignInForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error("No pudimos iniciar sesión", { description: error.message });
      return;
    }
    onSuccess();
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error("No pudimos enviar el correo", { description: error.message });
      return;
    }
    toast.success("Te enviamos un enlace para recuperar tu contraseña");
  }

  if (forgot) {
    return (
      <form onSubmit={handleReset} className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Ingresa tu email y te enviaremos un enlace para crear una nueva contraseña.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="reset-email">Email</Label>
          <Input id="reset-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Enviando..." : "Enviar enlace"}
        </Button>
        <button
          type="button"
          onClick={() => setForgot(false)}
          className="w-full cursor-pointer text-center text-xs text-muted-foreground transition-propz hover:text-foreground"
        >
          Volver a iniciar sesión
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="signin-password">Contraseña</Label>
          <button
            type="button"
            onClick={() => setForgot(true)}
            className="cursor-pointer text-xs font-medium text-muted-foreground transition-propz hover:text-foreground"
          >
            ¿Olvidaste tu contraseña?
          </button>
        </div>
        <PasswordInput id="signin-password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Ingresando..." : "Iniciar sesión"}
      </Button>
    </form>
  );
}


function SignUpForm({ onSuccess }: { onSuccess: () => void }) {
  const [fullName, setFullName] = useState("");
  const [orgName, setOrgName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handle(e: React.FormEvent) {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (cleanPhone.length < 8) {
      toast.error("Ingresa un teléfono válido");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: fullName,
          phone: cleanPhone,
          organization_name: orgName || "Mi patrimonio",
        },
      },
    });
    setLoading(false);
    if (error) {
      toast.error("No pudimos crear tu cuenta", { description: error.message });
      return;
    }
    toast.success("Bienvenido a Propz");
    onSuccess();
  }

  return (
    <form onSubmit={handle} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="su-name">Tu nombre</Label>
        <Input id="su-name" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ej: María Pérez" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-org">Nombre de tu organización</Label>
        <Input id="su-org" value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Ej: Inversiones Familia Pérez" />
        <p className="text-xs text-muted-foreground">Puedes cambiarlo después. Si lo dejas en blanco, usaremos "Mi patrimonio".</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-phone">Teléfono</Label>
        <Input id="su-phone" type="tel" required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 1234 5678" autoComplete="tel" maxLength={20} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="su-password">Contraseña</Label>
        <Input id="su-password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Creando cuenta..." : "Crear cuenta"}
      </Button>
    </form>
  );
}

function GoogleButton() {
  const [loading, setLoading] = useState(false);
  async function handle() {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error("Google no pudo autenticarte", { description: String(result.error) });
      return;
    }
    if (result.redirected) return;
    window.location.href = "/dashboard";
  }
  return (
    <Button type="button" variant="outline" className="w-full" onClick={handle} disabled={loading}>
      <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
        <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.4-1.6 4-5.4 4-3.2 0-5.9-2.7-5.9-6s2.6-6 5.9-6c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.6 14.5 2.6 12 2.6 6.8 2.6 2.6 6.8 2.6 12S6.8 21.4 12 21.4c6.9 0 9.5-4.8 9.5-7.3 0-.5-.1-.9-.1-1.3H12z"/>
      </svg>
      {loading ? "Redirigiendo..." : "Continuar con Google"}
    </Button>
  );
}