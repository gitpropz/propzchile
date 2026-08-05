import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCLP } from "@/lib/format";
import { deleteReading, saveManualReading } from "@/lib/service-readings";
import {
  SERVICE_STATUS_META,
  formatMonthsDue,
  serviceTypeLabel,
  type PropertyMonitoring,
} from "@/lib/monitored-services";

/**
 * Detalle de servicios de una propiedad (agua, luz, gas, gastos comunes, otros).
 * Misma lógica existente: ingreso manual, edición y reversión a "sin información".
 */
export function ServiceRows({
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
  const [editing, setEditing] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

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

  if (monitoring.services.length === 0) {
    return <p className="px-1 py-2 text-xs text-muted-foreground">Sin servicios configurados en esta propiedad.</p>;
  }

  return (
    <ul className="space-y-1">
      {monitoring.services.map((ev) => {
        const m = SERVICE_STATUS_META[ev.status];
        const s = ev.service;
        const isEditing = editing === s.id;
        return (
          <li key={s.id} className="rounded-xl px-2 py-2 transition-propz hover:bg-muted/50">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${m.dot}`} aria-label={m.label} />
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{serviceTypeLabel(s.service_type)}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {s.provider ?? "Sin compañía"}
                    {s.expected_amount != null ? ` · esperado ${formatCLP(Number(s.expected_amount))}` : ""}
                    {s.account_identifier ? ` · N° ${s.account_identifier}` : ""}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-semibold tabular text-foreground">
                    {ev.amountDue != null ? formatCLP(ev.amountDue) : "—"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {ev.status === "unknown"
                      ? "Sin información"
                      : ev.amountDue === 0
                        ? "Sin deuda"
                        : formatMonthsDue(ev.monthsDue)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-[11px]"
                  onClick={() => {
                    setEditing(isEditing ? null : s.id);
                    setAmount(ev.amountDue != null ? String(ev.amountDue) : "");
                  }}
                >
                  {ev.reading ? "Editar" : "Ingresar"}
                </Button>
                {ev.reading ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-[11px] text-muted-foreground"
                    disabled={saving}
                    title="Revertir a sin información"
                    onClick={() => revert(s.id)}
                  >
                    Revertir
                  </Button>
                ) : null}
              </div>
            </div>

            {ev.status === "unknown" && !isEditing ? (
              <p className="mt-1 pl-4 text-[11px] text-muted-foreground">
                No se encontró esta cuenta en los documentos cargados.
              </p>
            ) : null}

            {isEditing ? (
              <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1">
                <Input
                  className="h-8 text-xs"
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Monto adeudado"
                />
                <Button size="sm" className="h-8 px-3 text-[11px]" disabled={saving} onClick={() => submit(s.id)}>
                  Guardar
                </Button>
                <Button size="sm" variant="ghost" className="h-8 px-3 text-[11px]" onClick={() => setEditing(null)}>
                  Cancelar
                </Button>
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
