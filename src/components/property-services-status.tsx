import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { PencilLine, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCLP } from "@/lib/format";
import { saveManualReading } from "@/lib/service-readings";
import {
  READING_SOURCE_OPTIONS,
  SERVICE_STATUS_META,
  computeCoverage,
  evaluateService,
  formatMonthsDue,
  periodKey,
  periodLabelEs,
  readingSourceLabel,
  readingsByService,
  recentPeriods,
  serviceTypeLabel,
  type MonitoredService,
  type ReadingSource,
  type ServiceReading,
} from "@/lib/monitored-services";

export function PropertyServicesStatus({
  organizationId,
  propertyId,
  services,
}: {
  organizationId: string;
  propertyId: string;
  services: MonitoredService[];
}) {
  const [period, setPeriod] = useState(periodKey());
  const [entryFor, setEntryFor] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<ReadingSource>("manual");
  const [saving, setSaving] = useState(false);

  const readingsQuery = useQuery({
    queryKey: ["service-readings", propertyId, period],
    queryFn: async (): Promise<ServiceReading[]> => {
      const { data, error } = await supabase
        .from("service_readings")
        .select("*")
        .eq("property_id", propertyId)
        .eq("period", period);
      if (error) throw error;
      return data ?? [];
    },
  });

  const index = readingsByService(readingsQuery.data ?? [], period);
  const active = services.filter((s) => s.active);
  const evaluations = active.map((s) => evaluateService(s, index.get(s.id)));
  const coverage = computeCoverage(services, index);

  function openEntry(serviceId: string) {
    const existing = index.get(serviceId);
    setEntryFor(serviceId);
    setAmount(existing ? String(Number(existing.amount_due)) : "");
    setSource(((existing?.source as ReadingSource) ?? "manual"));
  }

  async function submitEntry(service: MonitoredService) {
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value < 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    setSaving(true);
    try {
      await saveManualReading({
        organizationId,
        propertyId,
        service,
        period,
        amountDue: value,
        source,
      });
      toast.success("Monto registrado");
      setEntryFor(null);
      readingsQuery.refetch();
    } catch (e) {
      toast.error("No pudimos guardar el monto", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Estado mensual de servicios</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Meses de deuda = monto adeudado ÷ valor mensual esperado.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="h-9 w-[11rem]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {recentPeriods(12).map((p) => (
                <SelectItem key={p} value={p}>{periodLabelEs(p)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link to="/services/update">
            <Button variant="outline" size="sm">
              <Upload className="mr-2 h-4 w-4" /> Actualizar servicios
            </Button>
          </Link>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <CoverageStat label="Esperados" value={coverage.expected} />
        <CoverageStat label="Automáticos" value={coverage.automatic} />
        <CoverageStat label="Manuales" value={coverage.manual} />
        <CoverageStat label="Pendientes" value={coverage.pending} />
      </div>
      <div className="mt-2 text-xs text-muted-foreground">
        Cobertura del monitoreo: <span className="font-medium text-foreground">{coverage.pct}%</span>
      </div>

      {active.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">
          Configura los servicios de esta propiedad para comenzar el monitoreo.
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {evaluations.map((ev) => {
            const meta = SERVICE_STATUS_META[ev.status];
            const s = ev.service;
            const isEntry = entryFor === s.id;
            return (
              <li key={s.id} className="py-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
                      {serviceTypeLabel(s.service_type)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.provider ?? "Sin proveedor"}
                      {s.service_identifier ? ` · N° ${s.service_identifier}` : ""}
                      {ev.reading ? ` · ${readingSourceLabel(ev.source)}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {ev.amountDue != null ? formatCLP(ev.amountDue) : "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {ev.status === "unknown" ? "Sin información" : formatMonthsDue(ev.monthsDue)}
                      </div>
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}>
                      {meta.label}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => openEntry(s.id)}>
                      <PencilLine className="mr-1.5 h-3.5 w-3.5" />
                      {ev.reading ? "Editar" : "Ingresar"}
                    </Button>
                  </div>
                </div>

                {ev.status === "unknown" && !isEntry ? (
                  <div className="mt-2 rounded-lg border border-dashed border-warning/40 bg-warning/5 px-3 py-2 text-xs text-muted-foreground">
                    No encontramos este servicio en los documentos de {periodLabelEs(period)}. Puedes ingresar el
                    monto manualmente si lo recibiste por correo, del administrador o por otra vía.
                  </div>
                ) : null}

                {isEntry ? (
                  <div className="mt-3 grid gap-3 rounded-lg border border-border bg-muted/20 p-3 sm:grid-cols-12">
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs">Monto adeudado (CLP)</Label>
                      <Input
                        className="h-9"
                        type="number"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-4">
                      <Label className="text-xs">Origen del dato</Label>
                      <Select value={source} onValueChange={(v) => setSource(v as ReadingSource)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {READING_SOURCE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2 sm:col-span-4">
                      <Button size="sm" disabled={saving} onClick={() => submitEntry(s)}>Guardar</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEntryFor(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function CoverageStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-[11px] text-muted-foreground">{label}</div>
    </div>
  );
}
