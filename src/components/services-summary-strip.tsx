import { Link } from "@tanstack/react-router";
import { FileUp } from "lucide-react";

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

  return (
    <section className="mt-4 rounded-xl border border-border bg-card px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="text-sm font-semibold">Servicios</div>
        <div className="flex items-center gap-3">
          {order.map((s) => {
            const meta = SERVICE_STATUS_META[s];
            return (
              <span key={s} className="flex items-center gap-1.5 text-sm tabular-nums" title={meta.label}>
                <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden />
                <span className="font-medium">{counts[s]}</span>
                <span className="sr-only">{meta.label}</span>
              </span>
            );
          })}
        </div>
        <div className="text-xs text-muted-foreground">
          Cobertura <span className="font-medium text-foreground">{coverage.pct}%</span>
          <span className="hidden sm:inline"> · {periodLabelEs(period)}</span>
        </div>
        <Link to="/services/update" className="ml-auto">
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
            <FileUp className="mr-1 h-3 w-3" /> Actualizar
          </Button>
        </Link>
      </div>

      {/* Leyenda de colores */}
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
        {order.map((s) => (
          <li key={s} className="flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${SERVICE_STATUS_META[s].dot}`} aria-hidden />
            <span>
              <span className="font-medium text-foreground">{SERVICE_STATUS_META[s].label}</span>
              {": "}
              {LEGEND[s]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const LEGEND: Record<ServiceStatus, string> = {
  normal: "al día o deuda menor a 1,5 meses",
  over: "deuda entre 1,5 y 2,5 meses",
  critical: "deuda de 2,5 meses o más",
  unknown: "sin información del período",
};
