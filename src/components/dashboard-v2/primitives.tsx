import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Lenguaje visual único del Dashboard V2: superficie limpia, borde discreto,
 * mucho aire y elevación mínima. Todas las tarjetas usan este contenedor.
 */
export function Panel({
  children,
  className,
  as: As = "section",
}: {
  children: ReactNode;
  className?: string;
  as?: "section" | "div";
}) {
  return (
    <As
      className={cn(
        "rounded-2xl border border-border/60 bg-card shadow-xs transition-propz",
        className,
      )}
    >
      {children}
    </As>
  );
}

export function PanelHeader({
  title,
  hint,
  right,
  className,
}: {
  title: string;
  hint?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 pt-5 sm:flex sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h2 className="section-title truncate text-[0.9375rem] text-foreground">{title}</h2>
        {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

/** Etiqueta + valor con jerarquía tipográfica clara. */
export function Stat({
  label,
  value,
  tone = "neutral",
  size = "md",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "success" | "danger" | "warning" | "muted";
  size?: "md" | "lg";
}) {
  return (
    <div className="min-w-0">
      <div className="eyebrow">{label}</div>
      <div
        className={cn(
          "mt-1 truncate font-semibold tabular",
          size === "lg" ? "text-xl md:text-2xl" : "text-base md:text-lg",
          tone === "success" && "text-success",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-warning",
          tone === "muted" && "text-muted-foreground",
          tone === "neutral" && "text-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/** Barra de progreso fina y elegante. */
export function ProgressLine({
  pct,
  tone = "success",
  className,
}: {
  pct: number;
  tone?: "success" | "warning" | "danger";
  className?: string;
}) {
  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          tone === "success" && "bg-success",
          tone === "warning" && "bg-warning",
          tone === "danger" && "bg-destructive",
        )}
        style={{ width: `${Math.max(pct > 0 ? 2 : 0, Math.min(100, pct))}%` }}
      />
    </div>
  );
}
