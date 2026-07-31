import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SERVICE_STATUS_META,
  periodLabelEs,
  type Coverage,
  type ServiceStatus,
} from "@/lib/monitored-services";

/** Resumen ejecutivo compacto de servicios. Ocupa muy poco espacio vertical. */
export function ServicesSummaryStrip({
  period,
  counts,
  coverage,
}: {
  period: string;
  counts: Record<ServiceStatus, number>;
  coverage: Coverage;
}) {
  const order: ServiceStatus[] = ["normal", "over", "critical", "unknown"];
  const [showLegend, setShowLegend] = useState(false);

  return (
    <section className="mt-3 rounded-xl border border-border bg-card px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="text-sm font-semibold">Servicios</div>
        <div className="flex items-center gap-2.5">
          {order.map((s) => {
            const meta = SERVICE_STATUS_META[s];
            return (
              <span key={s} className="flex items-center gap-1 text-xs tabular-nums" title={meta.label}>
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
                <span className="font-medium">{counts[s]}</span>
                <span className="sr-only">{meta.label}</span>
              </span>
            );
          })}
        </div>
        <div className="text-[11px] text-muted-foreground">
          Cobertura <span className="font-medium text-foreground">{coverage.pct}%</span>
          <span className="hidden sm:inline"> · {periodLabelEs(period)}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowLegend((v) => !v)}
          aria-expanded={showLegend}
          className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          Simbología
          <ChevronDown className={`h-3 w-3 transition-transform ${showLegend ? "rotate-180" : ""}`} />
        </button>
        <Link to="/services/update" className="ml-auto">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-[11px]">
            <FileUp className="mr-1 h-3 w-3" /> Actualizar
          </Button>
        </Link>
      </div>

      {/* Leyenda de colores (desplegable) */}
      {showLegend ? (
        <ul className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-1.5 text-[10px] text-muted-foreground">
          {order.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${SERVICE_STATUS_META[s].dot}`} aria-hidden />
              <span>
                <span className="font-medium text-foreground">{LEGEND_LABEL[s]}</span>
                {": "}
                {LEGEND[s]}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

const LEGEND_LABEL: Record<ServiceStatus, string> = {
  normal: "Normal",
  over: "Revisar",
  critical: "Crítico",
  unknown: "Sin información",
};

const LEGEND: Record<ServiceStatus, string> = {
  normal: "al día o deuda menor a 1,5 meses",
  over: "deuda entre 1,5 y 2,5 meses",
  critical: "deuda de 2,5 meses o más",
  unknown: "sin información del período",
};
