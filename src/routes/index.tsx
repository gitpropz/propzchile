import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { Building2, Sparkles, ShieldCheck, LineChart } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Building2 className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight">Propz</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/auth">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link to="/auth" hash="signup">
              <Button>Crear cuenta</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-12 md:grid-cols-2 md:items-center">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
              <Sparkles className="h-3.5 w-3.5" /> Administrador inteligente
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
              Administra tus propiedades sin perder el control.
            </h1>
            <p className="mt-4 max-w-lg text-lg text-muted-foreground">
              Propz automatiza cobros, obligaciones y mantenciones. Tú decides lo importante;
              el sistema se encarga del resto y solo te avisa cuando realmente necesitas actuar.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" hash="signup">
                <Button size="lg">Comenzar gratis</Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline">Ya tengo cuenta</Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="text-sm font-medium text-muted-foreground">Hoy requiere tu atención</div>
            <ul className="mt-4 space-y-3">
              {[
                { color: "bg-destructive", label: "3 arriendos vencidos" },
                { color: "bg-warning", label: "2 contratos por vencer" },
                { color: "bg-info", label: "1 cotización esperando autorización" },
                { color: "bg-success", label: "12 propiedades al día" },
              ].map((item) => (
                <li key={item.label} className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2.5">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  <span className="text-sm">{item.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            { icon: ShieldCheck, title: "Autorizas los gastos", body: "Ninguna cotización sale a la calle sin tu OK. Trazabilidad total en cada paso." },
            { icon: Sparkles, title: "Trabaja por excepción", body: "Si todo está bien, no te molestamos. Solo verás lo que requiere tu decisión." },
            { icon: LineChart, title: "Rentabilidad clara", body: "Cada propiedad es una unidad económica: ingresos, gastos y flujo consolidados." },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-5">
              <Icon className="h-5 w-5 text-brand" />
              <h3 className="mt-3 font-semibold">{title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Propz · Diseñado para propietarios de Chile
      </footer>
    </div>
  );
}
