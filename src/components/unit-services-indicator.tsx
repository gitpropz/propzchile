import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCLP } from "@/lib/format";
import { deleteReading, saveManualReading } from "@/lib/service-readings";
import {
  SERVICE_STATUS_META,
  formatMonthsDue,
  periodLabelEs,
  serviceTypeLabel,
  type PropertyMonitoring,
} from "@/lib/monitored-services";

/**
 * Indicador compacto de servicios para la unidad principal de una propiedad.
 * Un solo círculo con el peor estado; al tocarlo se despliega el detalle.
 */
export function UnitServicesIndicator({
  organizationId,
  monitoring,
  period,
  onSaved,
}: {
  organizationId: string;
  monitoring: PropertyMonitoring;
  period: string;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  const meta = SERVICE_STATUS_META[monitoring.status];

  async function submit(serviceId: string) {
    const ev = monitoring.services.find((e) => e.service.id === serviceId);
    if (!ev) return;
    const value = Number(amount);
    if (!amount || Number.isNaN(value) || value < 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    setSaving(true);
    try {
      await saveManualReading({
        organizationId,
        propertyId: monitoring.propertyId,
        service: ev.service,
        period,
        amountDue: value,
        source: "manual",
      });
      toast.success("Monto registrado");
      setEditing(null);
      setAmount("");
      onSaved();
    } catch (e) {
      toast.error("No pudimos guardar el monto", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  async function revert(serviceId: string) {
    setSaving(true);
    try {
      await deleteReading({ serviceId, period });
      toast.success("Registro revertido", { description: "El servicio quedó sin información." });
      setEditing(null);
      setAmount("");
      onSaved();
    } catch (e) {
      toast.error("No pudimos revertir el registro", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={`Servicios: ${meta.label}`}
        title={`Servicios · ${meta.label}`}
        className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-border px-1.5 text-[10px] text-muted-foreground hover:bg-muted"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} aria-hidden />
        Serv.
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open ? (
        <div className="mt-1 w-full rounded-lg border border-border bg-muted/20 p-2">
          <div className="mb-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            Servicios · {periodLabelEs(period)}
          </div>
          {monitoring.services.length === 0 ? (
            <div className="text-xs text-muted-foreground">Sin servicios configurados.</div>
          ) : (
            <ul className="divide-y divide-border">
              {monitoring.services.map((ev) => {
                const m = SERVICE_STATUS_META[ev.status];
                const s = ev.service;
                const isEditing = editing === s.id;
                return (
                  <li key={s.id} className="py-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-xs font-medium">
                          <span className={`h-2 w-2 rounded-full ${m.dot}`} aria-hidden />
                          {serviceTypeLabel(s.service_type)}
                        </div>
                        <div className="truncate text-[10px] text-muted-foreground">
                          {s.provider ?? "Sin compañía"}
                          {s.expected_amount != null
                            ? ` · esperado ${formatCLP(Number(s.expected_amount))}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs font-semibold tabular-nums">
                            {ev.amountDue != null ? formatCLP(ev.amountDue) : "—"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {ev.status === "unknown" ? "Sin información" : formatMonthsDue(ev.monthsDue)}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-[10px]"
                          onClick={() => {
                            setEditing(isEditing ? null : s.id);
                            setAmount(ev.amountDue != null ? String(ev.amountDue) : "");
                          }}
                        >
                          {ev.reading ? "Editar" : "Ingresar"}
                        </Button>
                      </div>
                    </div>

                    {ev.status === "unknown" && !isEditing ? (
                      <div className="mt-1 text-[10px] text-muted-foreground">
                        No se encontró esta cuenta en los documentos cargados.
                      </div>
                    ) : null}

                    {isEditing ? (
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <Input
                          className="h-7 text-xs"
                          type="number"
                          min="0"
                          value={amount}
                          onChange={(e) => setAmount(e.target.value)}
                          placeholder="Monto adeudado"
                        />
                        <Button
                          size="sm"
                          className="h-7 px-2 text-[10px]"
                          disabled={saving}
                          onClick={() => submit(s.id)}
                        >
                          Guardar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[10px]"
                          onClick={() => setEditing(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </>
  );
}
