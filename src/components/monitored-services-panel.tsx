import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import {
  DEFAULT_ALERT_THRESHOLD_PCT,
  SERVICE_ALERT_CLASS,
  SERVICE_IDENTIFIER_HINT,
  SERVICE_TYPE_OPTIONS,
  evaluateServiceAmount,
  serviceTypeLabel,
  type MonitoredService,
  type ServiceType,
} from "@/lib/monitored-services";

type UnitLike = { id: string; label: string };

type FormState = {
  unit_id: string;
  service_type: ServiceType;
  service_identifier: string;
  provider: string;
  expected_amount: string;
  alert_threshold_pct: string;
  active: boolean;
  notes: string;
};

function emptyForm(unitId: string): FormState {
  return {
    unit_id: unitId,
    service_type: "agua",
    service_identifier: "",
    provider: "",
    expected_amount: "",
    alert_threshold_pct: String(DEFAULT_ALERT_THRESHOLD_PCT),
    active: true,
    notes: "",
  };
}

export function MonitoredServicesPanel({
  organizationId,
  units,
}: {
  organizationId: string;
  units: UnitLike[];
}) {
  const unitIds = units.map((u) => u.id);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const query = useQuery({
    queryKey: ["monitored-services", organizationId, unitIds.join(",")],
    queryFn: async (): Promise<MonitoredService[]> => {
      if (unitIds.length === 0) return [];
      const { data, error } = await supabase
        .from("monitored_services")
        .select("*")
        .in("unit_id", unitIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: unitIds.length > 0,
  });

  const services = query.data ?? [];
  const unitById = new Map(units.map((u) => [u.id, u]));

  function startCreate() {
    setEditingId("new");
    setForm(emptyForm(units[0]?.id ?? ""));
  }

  function startEdit(s: MonitoredService) {
    setEditingId(s.id);
    setForm({
      unit_id: s.unit_id,
      service_type: s.service_type as ServiceType,
      service_identifier: s.service_identifier ?? "",
      provider: s.provider ?? "",
      expected_amount: s.expected_amount == null ? "" : String(Number(s.expected_amount)),
      alert_threshold_pct: String(Number(s.alert_threshold_pct ?? DEFAULT_ALERT_THRESHOLD_PCT)),
      active: s.active,
      notes: s.notes ?? "",
    });
  }

  function cancel() {
    setEditingId(null);
    setForm(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.unit_id) {
      toast.error("Selecciona una unidad");
      return;
    }
    const payload = {
      organization_id: organizationId,
      unit_id: form.unit_id,
      service_type: form.service_type,
      service_identifier: form.service_identifier.trim() || null,
      provider: form.provider.trim() || null,
      expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
      alert_threshold_pct: form.alert_threshold_pct
        ? Number(form.alert_threshold_pct)
        : DEFAULT_ALERT_THRESHOLD_PCT,
      active: form.active,
      notes: form.notes.trim() || null,
    };

    if (editingId && editingId !== "new") {
      const { error } = await supabase.from("monitored_services").update(payload).eq("id", editingId);
      if (error) {
        toast.error("No pudimos guardar el servicio", { description: error.message });
        return;
      }
      toast.success("Servicio actualizado");
    } else {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("monitored_services")
        .insert({ ...payload, created_by: userData.user?.id ?? null });
      if (error) {
        toast.error("No pudimos guardar el servicio", { description: error.message });
        return;
      }
      toast.success("Servicio configurado");
    }
    cancel();
    query.refetch();
  }

  async function toggleActive(s: MonitoredService) {
    const { error } = await supabase
      .from("monitored_services")
      .update({ active: !s.active })
      .eq("id", s.id);
    if (error) {
      toast.error("No pudimos actualizar", { description: error.message });
      return;
    }
    query.refetch();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("monitored_services").delete().eq("id", id);
    if (error) {
      toast.error("No pudimos eliminar", { description: error.message });
      return;
    }
    toast.success("Servicio eliminado");
    query.refetch();
  }

  if (units.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Primero agrega unidades para poder configurar sus servicios monitoreados.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="text-sm font-medium text-foreground">
            Esta configuración se realiza una sola vez por unidad.
          </p>
          <p>
            Propz usará el número de cliente y el valor esperado para{" "}
            <span className="font-medium text-foreground">identificar automáticamente</span> las cuentas
            cuando cargues un pantallazo o PDF de Servipag: asociará cada servicio a su unidad, comparará el
            monto con el valor esperado y generará una alerta si supera el umbral definido.
          </p>
          <p>No necesitas registrar aquí montos mensuales ni fechas de vencimiento.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <Upload className="h-4 w-4 shrink-0" />
        <span>
          Carga de resúmenes de Servipag: <span className="font-medium text-foreground">próxima etapa</span>. La
          configuración que dejes aquí quedará lista para ese momento.
        </span>
      </div>

      <div className="rounded-xl border border-border bg-card">
        {services.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Aún no hay servicios monitoreados configurados.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {services.map((s) => {
              const ev = evaluateServiceAmount(s, s.last_detected_amount == null ? null : Number(s.last_detected_amount));
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-medium">
                      {serviceTypeLabel(s.service_type)}
                      {!s.active && (
                        <span className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
                          Inactivo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {unitById.get(s.unit_id)?.label ?? "Unidad"}
                      {s.service_identifier ? ` · N° ${s.service_identifier}` : " · sin identificador"}
                      {s.provider ? ` · ${s.provider}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {s.expected_amount != null ? formatMoney(Number(s.expected_amount), "CLP") : "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Alerta sobre {Number(s.alert_threshold_pct)}%
                        {ev.thresholdAmount != null ? ` · ${formatMoney(ev.thresholdAmount, "CLP")}` : ""}
                      </div>
                    </div>
                    {s.last_detected_amount != null && (
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${SERVICE_ALERT_CLASS[ev.level]}`}
                      >
                        {ev.label}
                      </span>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(s)}>
                      {s.active ? "Desactivar" : "Activar"}
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => startEdit(s)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label="Eliminar" onClick={() => remove(s.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {form ? (
        <form onSubmit={save} className="rounded-xl border border-border bg-card p-4">
          <div className="grid gap-3 md:grid-cols-12">
            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Unidad</Label>
              <Select value={form.unit_id} onValueChange={(v) => setForm({ ...form, unit_id: v })}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {units.map((u) => <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Tipo de servicio</Label>
              <Select
                value={form.service_type}
                onValueChange={(v) => setForm({ ...form, service_type: v as ServiceType })}
              >
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Identificador del servicio</Label>
              <Input
                className="h-9"
                value={form.service_identifier}
                onChange={(e) => setForm({ ...form, service_identifier: e.target.value })}
                placeholder={SERVICE_IDENTIFIER_HINT[form.service_type]}
              />
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Valor mensual esperado (CLP)</Label>
              <Input
                className="h-9"
                type="number"
                min="0"
                value={form.expected_amount}
                onChange={(e) => setForm({ ...form, expected_amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Umbral de alerta (%)</Label>
              <Input
                className="h-9"
                type="number"
                min="100"
                value={form.alert_threshold_pct}
                onChange={(e) => setForm({ ...form, alert_threshold_pct: e.target.value })}
                placeholder={String(DEFAULT_ALERT_THRESHOLD_PCT)}
              />
            </div>
            <div className="md:col-span-4 space-y-1">
              <Label className="text-xs">Proveedor (opcional)</Label>
              <Input
                className="h-9"
                value={form.provider}
                onChange={(e) => setForm({ ...form, provider: e.target.value })}
                placeholder="Aguas Andinas, Enel, Metrogas…"
              />
            </div>
            <div className="md:col-span-12 space-y-1">
              <Label className="text-xs">Notas (opcional)</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
              <span className="text-muted-foreground">{form.active ? "Activo" : "Inactivo"}</span>
            </label>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={cancel}>Cancelar</Button>
              <Button type="submit" size="sm">Guardar configuración</Button>
            </div>
          </div>
        </form>
      ) : (
        <Button variant="outline" size="sm" onClick={startCreate}>
          <Plus className="mr-2 h-4 w-4" /> Agregar servicio monitoreado
        </Button>
      )}
    </div>
  );
}
