import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, LineChart, Zap, ArrowRight } from "lucide-react";

import { PropzLogo } from "@/components/propz-logo";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Propz — El centro de control de tu patrimonio inmobiliario" },
      {
        name: "description",
        content:
          "Propz es la plataforma inteligente para inversionistas inmobiliarios: controla, automatiza y haz crecer tu patrimonio desde un solo lugar.",
      },
      { property: "og:title", content: "Propz — El centro de control de tu patrimonio inmobiliario" },
      {
        property: "og:description",
        content:
          "Controla, automatiza y haz crecer tu patrimonio inmobiliario con una plataforma diseñada para inversionistas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const signals = [
  { tone: "bg-destructive", label: "3 arriendos vencidos", meta: "Requiere acción" },
  { tone: "bg-warning", label: "2 contratos por vencer", meta: "Próximos 30 días" },
  { tone: "bg-info", label: "1 cotización por autorizar", meta: "En espera" },
  { tone: "bg-success", label: "12 propiedades al día", meta: "Sin novedades" },
];

const pillars = [
  {
    icon: ShieldCheck,
    title: "Control total",
    body: "Cada peso pasa por tu autorización. Trazabilidad completa de ingresos, gastos y decisiones.",
  },
  {
    icon: Zap,
    title: "Automatización",
    body: "Conciliación de arriendos, alertas y vencimientos en piloto automático. Solo intervienes cuando importa.",
  },
  {
    icon: LineChart,
    title: "Patrimonio medible",
    body: "Cada propiedad es una unidad económica con rentabilidad, flujo y desempeño consolidado.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-6">
          <PropzLogo wordmarkClassName="text-[1.75rem]" />
          <div className="flex items-center gap-2">
            <Link to="/auth" className="hidden sm:block">
              <Button variant="ghost" size="sm">Iniciar sesión</Button>
            </Link>
            <Link to="/auth" hash="signup">
              <Button size="sm">Crear cuenta</Button>
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 md:py-24">
        <div className="grid gap-12 md:grid-cols-[1.05fr_1fr] md:items-center md:gap-16">
          <div>
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5">
              Todo tu patrimonio inmobiliario en un solo lugar
            </span>
            <h1 className="mt-6 text-[2.15rem] leading-[1.08] sm:text-5xl md:text-[3.4rem]">
              El centro de control de tu patrimonio inmobiliario.
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground sm:text-lg">
              Propz reúne tus propiedades, contratos y flujos en una sola plataforma. Automatiza lo
              repetitivo y te avisa solo cuando una decisión tuya es realmente necesaria.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link to="/auth" hash="signup" className="sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto">
                  Comenzar gratis <ArrowRight />
                </Button>
              </Link>
              <Link to="/auth" className="sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
              <span className="eyebrow">Hoy requiere tu atención</span>
              <span className="text-xs text-muted-foreground tabular">4 señales</span>
            </div>
            <ul className="mt-4 space-y-2">
              {signals.map((item) => (
                <li
                  key={item.label}
                  className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3.5 py-3 transition-propz hover:border-border-strong"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.tone}`} />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{item.label}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{item.meta}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-24 sm:px-6">
        <div className="grid gap-4 md:grid-cols-3">
          {pillars.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-card p-6">
              <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent-brand-soft">
                <Icon className="h-5 w-5 text-accent-brand-foreground" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 text-base">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border bg-surface py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-5 text-center sm:px-6">
          <PropzLogo markClassName="h-7 w-7" wordmarkClassName="text-[1.5rem]" />
          <p className="text-[0.6875rem] leading-tight text-muted-foreground">
            Todo tu patrimonio inmobiliario en un solo lugar
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            © {new Date().getFullYear()} Propz · Tecnología para inversionistas inmobiliarios
          </p>
        </div>
      </footer>

    </div>
  );
}
