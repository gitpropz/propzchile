import { useState } from "react";

import { formatCLP } from "@/lib/format";
import { MONTHS_ES } from "@/lib/rent-status";
import { Panel, PanelHeader } from "@/components/dashboard-v2/primitives";

type Point = { year: number; month: number; expected: number; confirmed: number };

/**
 * Nivel 3 — tendencia. Línea limpia, sin grilla pesada, sin competir con el
 * flujo del mes. Mantiene ambos datos (esperado y confirmado).
 */
export function TrendLine({ data }: { data: Point[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => Math.max(d.expected, d.confirmed)));
  const W = 600;
  const H = 120;
  const padX = 8;
  const step = data.length > 1 ? (W - padX * 2) / (data.length - 1) : 0;
  const x = (i: number) => padX + i * step;
  const y = (v: number) => H - (v / max) * (H - 12) - 6;

  const line = (key: "expected" | "confirmed") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const area = `${line("confirmed")} L${x(data.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`;

  const active = hover != null ? data[hover] : data[data.length - 1];

  return (
    <Panel className="px-5 pb-5 pt-0">
      <PanelHeader
        title="Tendencia"
        hint="Evolución de la recaudación · últimos 6 meses"
        className="px-0"
        right={
          active ? (
            <div className="text-right">
              <div className="text-sm font-semibold tabular text-foreground">{formatCLP(active.confirmed)}</div>
              <div className="text-[11px] text-muted-foreground">
                {MONTHS_ES[active.month - 1]} · esperado {formatCLP(active.expected)}
              </div>
            </div>
          ) : null
        }
      />

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 h-28 w-full overflow-visible"
        preserveAspectRatio="none"
        role="img"
        aria-label="Evolución de la recaudación de los últimos 6 meses"
      >
        <defs>
          <linearGradient id="v2-trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--success)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--success)" stopOpacity="0" />
          </linearGradient>
        </defs>

        <path d={area} fill="url(#v2-trend-fill)" />
        <path
          d={line("expected")}
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="1.5"
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={line("confirmed")}
          fill="none"
          stroke="var(--success)"
          strokeWidth="2"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => (
          <g key={`${d.year}-${d.month}`}>
            <circle
              cx={x(i)}
              cy={y(d.confirmed)}
              r={hover === i ? 4.5 : 3}
              fill="var(--card)"
              stroke="var(--success)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
            <rect
              x={x(i) - step / 2}
              y={0}
              width={Math.max(step, 12)}
              height={H}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          </g>
        ))}
      </svg>

      <div className="mt-2 grid grid-cols-6 text-center text-[11px] text-muted-foreground">
        {data.map((d) => (
          <span key={`${d.year}-${d.month}-l`}>{MONTHS_ES[d.month - 1]}</span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-success" /> Confirmado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-4 rounded bg-border-strong" /> Esperado
        </span>
      </div>
    </Panel>
  );
}
