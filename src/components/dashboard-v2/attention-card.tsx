import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";

import { Panel, PanelHeader } from "@/components/dashboard-v2/primitives";
import { cn } from "@/lib/utils";

export type AttentionItem = {
  key: string;
  count: number;
  label: string;
  to: string;
  hash?: string;
  tone: "danger" | "warning" | "muted";
};

/** Nivel 2 — solo lo accionable. Si no hay nada, se comunica calma. */
export function AttentionCard({
  items,
  onSelect,
  activeKey,
}: {
  items: AttentionItem[];
  /** Si se entrega, al pinchar se filtra en la misma página en vez de navegar. */
  onSelect?: (key: string) => void;
  activeKey?: string | null;
}) {
  if (items.length === 0) {
    return (
      <Panel className="flex items-center gap-3 px-5 py-5">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-success" strokeWidth={1.75} />
        <div className="min-w-0">
          <div className="section-title text-[0.9375rem]">Todo al día</div>
          <p className="text-xs text-muted-foreground">Sin pagos atrasados, servicios críticos ni contratos por vencer.</p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="pb-2">
      <PanelHeader
        title="Requiere atención"
        hint={`${items.length} ${items.length === 1 ? "asunto pendiente" : "asuntos pendientes"}`}
        right={<AlertTriangle className="h-4 w-4 text-warning" strokeWidth={1.75} />}
      />
      <ul className="mt-3 px-2 pb-2">
        {items.map((it) => {
          const inner = (
            <>
              <span
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center rounded-full text-[13px] font-semibold tabular",
                  it.tone === "danger" && "bg-destructive/10 text-destructive",
                  it.tone === "warning" && "bg-warning/15 text-warning",
                  it.tone === "muted" && "bg-muted text-muted-foreground",
                )}
              >
                {it.count}
              </span>
              <span className="min-w-0 flex-1 truncate text-left text-sm text-foreground">{it.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </>
          );
          const cls = cn(
            "group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-propz hover:bg-muted/60",
            activeKey === it.key && "bg-muted",
          );
          return (
            <li key={it.key}>
              {onSelect ? (
                <button type="button" onClick={() => onSelect(it.key)} className={cls} aria-pressed={activeKey === it.key}>
                  {inner}
                </button>
              ) : (
                <Link to={it.to} hash={it.hash} className={cls}>
                  {inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

