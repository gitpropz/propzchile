import { TrendingDown, TrendingUp } from "lucide-react";

import { formatCLP } from "@/lib/format";
import { shortPeriodLabel } from "@/lib/rent-status";
import { Panel, ProgressLine, Stat } from "@/components/dashboard-v2/primitives";

/**
 * Nivel 1 — el bloque financiero protagonista.
 * El monto cobrado es el elemento más grande de toda la pantalla.
 */
export function FlowCard({
  periodLabel,
  expected,
  confirmed,
  pending,
  overdue,
  pct,
  prev,
  deltaConfirmed,
  deltaPct,
}: {
  periodLabel: string;
  expected: number;
  confirmed: number;
  pending: number;
  overdue: number;
  pct: number;
  prev: { year: number; month: number } | null;
  deltaConfirmed: number;
  deltaPct: number | null;
}) {
  const up = deltaConfirmed >= 0;
  return (
    <Panel className="px-5 py-6 md:px-7 md:py-7">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:justify-between">
        <div className="min-w-0">
          <div className="eyebrow">Cobrado en {periodLabel}</div>
          <div className="mt-1.5 font-display text-[2.25rem] font-bold leading-none tracking-tight tabular text-foreground md:text-[3rem]">
            {formatCLP(confirmed)}
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            de <span className="tabular font-medium text-foreground">{formatCLP(expected)}</span> esperados
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="font-display text-2xl font-bold tabular text-foreground md:text-3xl">{pct}%</div>
          <div className="eyebrow mt-1">Cumplimiento</div>
          {prev ? (
            <div
              className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] tabular ${
                up ? "border-success/25 bg-success/10 text-success" : "border-destructive/25 bg-destructive/10 text-destructive"
              }`}
              title={`Variación vs ${shortPeriodLabel(prev.year, prev.month)}`}
            >
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? "+" : ""}
              {formatCLP(deltaConfirmed)}
              {deltaPct != null ? ` (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)` : ""}
            </div>
          ) : null}
        </div>
      </div>

      <ProgressLine
        pct={pct}
        tone={overdue > 0 && pct < 100 ? "warning" : "success"}
        className="mt-6"
      />

      <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
        <Stat label="Esperado" value={formatCLP(expected)} />
        <Stat label="Confirmado" value={formatCLP(confirmed)} tone="success" />
        <Stat label="Pendiente" value={formatCLP(pending)} tone="muted" />
        <Stat label="Atrasado" value={formatCLP(overdue)} tone={overdue > 0 ? "danger" : "muted"} />
      </div>
    </Panel>
  );
}
