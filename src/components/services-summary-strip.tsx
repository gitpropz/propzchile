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
    <section className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-2.5">
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
    </section>
  );
}
