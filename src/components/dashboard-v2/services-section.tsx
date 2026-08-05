import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/dashboard-v2/primitives";
import { ServiceRows } from "@/components/dashboard-v2/service-rows";
import {
  SERVICE_STATUS_META,
  periodLabelEs,
  type Coverage,
  type PropertyMonitoring,
  type ServiceStatus,
} from "@/lib/monitored-services";
import { cn } from "@/lib/utils";

const ORDER: ServiceStatus[] = ["normal", "over", "critical", "unknown"];

const LEGEND: Record<ServiceStatus, { label: string; detail: string }> = {
  normal: { label: "Normal", detail: "al día o deuda menor a 1,5 meses" },
  over: { label: "Revisar", detail: "deuda entre 1,5 y 2,5 meses" },
  critical: { label: "Crítico", detail: "deuda de 2,5 meses o más" },
  unknown: { label: "Sin información", detail: "sin datos del período" },
};

/**
 * Servicios colapsados: resumen ejecutivo siempre visible y detalle por
 * propiedad bajo demanda. Ningún dato se elimina, solo se oculta.
 */
export function ServicesSection({
  organizationId,
  period,
  counts,
  coverage,
  properties,
  onSaved,
}: {
  organizationId?: string;
  period: string;
  counts: Record<ServiceStatus, number>;
  coverage: Coverage;
  properties: { id: string; name: string; monitoring: PropertyMonitoring }[];
  onSaved: () => void;
}) {
  const [legend, setLegend] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  return (
    <Panel className="pb-4">
      <PanelHeader
        title="Servicios"
        hint={`Cobertura ${coverage.pct}% · ${periodLabelEs(period)}`}
        right={
          <Link to="/services/update">
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
              <FileUp className="h-3.5 w-3.5" /> Actualizar
            </Button>
          </Link>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 px-5">
        {ORDER.map((s) => (
          <span key={s} className="flex items-center gap-2 text-sm">
            <span className={`h-2 w-2 rounded-full ${SERVICE_STATUS_META[s].dot}`} aria-hidden />
            <span className="font-semibold tabular text-foreground">{counts[s]}</span>
            <span className="text-xs text-muted-foreground">{LEGEND[s].label}</span>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setLegend((v) => !v)}
          aria-expanded={legend}
          className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground transition-propz hover:text-foreground"
        >
          Simbología
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", legend && "rotate-180")} />
        </button>
      </div>

      {legend ? (
        <ul className="mt-3 space-y-1 px-5 text-[11px] text-muted-foreground animate-in fade-in slide-in-from-top-1">
          {ORDER.map((s) => (
            <li key={s} className="flex items-center gap-2">
              <span className={`h-2 w-2 shrink-0 rounded-full ${SERVICE_STATUS_META[s].dot}`} aria-hidden />
              <span>
                <span className="font-medium text-foreground">{LEGEND[s].label}</span>: {LEGEND[s].detail}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {properties.length > 0 && organizationId ? (
        <div className="mt-4 px-2">
          {properties.map((p) => {
            const meta = SERVICE_STATUS_META[p.monitoring.status];
            const isOpen = open === p.id;
            return (
              <div key={p.id}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : p.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-propz hover:bg-muted/60"
                >
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-label={meta.label} />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {p.monitoring.services.length} {p.monitoring.services.length === 1 ? "cuenta" : "cuentas"}
                  </span>
                  <ChevronDown
                    className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-180")}
                  />
                </button>
                {isOpen ? (
                  <div className="px-2 pb-3 animate-in fade-in slide-in-from-top-1">
                    <ServiceRows
                      organizationId={organizationId}
                      monitoring={p.monitoring}
                      period={period}
                      onSaved={onSaved}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </Panel>
  );
}
