import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { formatCLP } from "@/lib/format";
import {
  PROVIDER_SUGGESTIONS,
  SERVICE_IDENTIFIER_HINT,
  SERVICE_TYPE_OPTIONS,
  serviceTypeLabel,
  type MonitoredService,
  type ServiceType,
} from "@/lib/monitored-services";

type FormState = {
  service_type: ServiceType;
  provider: string;
  service_identifier: string;
  expected_amount: string;
  active: boolean;
  notes: string;
};

function emptyForm(): FormState {
  return {
    service_type: "agua",
    provider: "",
    service_identifier: "",
    expected_amount: "",
    active: true,
    notes: "",
  };
}

export function MonitoredServicesPanel({
  organizationId,
  propertyId,
}: {
  organizationId: string;
  propertyId: string;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);

  const query = useQuery({
    queryKey: ["monitored-services", propertyId],
    queryFn: async (): Promise<MonitoredService[]> => {
      const { data, error } = await supabase
        .from("monitored_services")
        .select("*")
        .eq("property_id", propertyId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const services = query.data ?? [];

  function startCreate() {
    setEditingId("new");
    setForm(emptyForm());
  }

  function startEdit(s: MonitoredService) {
    setEditingId(s.id);
    setForm({
      service_type: s.service_type as ServiceType,
      provider: s.provider ?? "",
      service_identifier: s.service_identifier ?? "",
      expected_amount: s.expected_amount == null ? "" : String(Number(s.expected_amount)),
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
    const payload = {
      organization_id: organizationId,
      property_id: propertyId,
      service_type: form.service_type,
      provider: form.provider.trim() || null,
      service_identifier: form.service_identifier.trim() || null,
      expected_amount: form.expected_amount ? Number(form.expected_amount) : null,
      active: form.active,
      notes: form.notes.trim() || null,
    };

    if (editingId && editingId !== "new") {
      const { error } = await supabase.from("monitored_services").update(payload).eq("id", editingId);
      if (error) {
        toast.error("No pudimos guardar el servicio", { description: error.message });
        return;
      }
      toast.success("Servicio actualizado", {
        description: "Los cambios aplican a los próximos períodos; el historial no se modifica.",
      });
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

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">Configuración de servicios</h3>
          <p className="text-xs text-muted-foreground">
            Información permanente de esta propiedad.
          </p>
        </div>

        <div className="flex gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent-brand" />
          <p className="text-xs text-muted-foreground">
            Los servicios monitoreados corresponden a la configuración permanente de esta propiedad. Puedes
            modificarlos cuando cambien las condiciones de la propiedad. Los cambios afectarán únicamente los
            próximos períodos y no modificarán el historial.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card">
          {services.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Aún no hay servicios monitoreados configurados.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {services.map((s) => (
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
                      {s.provider ? s.provider : "Sin proveedor"}
                      {s.service_identifier ? ` · N° ${s.service_identifier}` : " · sin identificador"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-sm font-semibold tabular-nums">
                        {s.expected_amount != null ? formatCLP(Number(s.expected_amount)) : "—"}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Valor mensual esperado</div>
                    </div>
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
              ))}
            </ul>
          )}
        </div>

        {form ? (
          <form onSubmit={save} className="rounded-xl border border-border bg-card p-4">
            <div className="grid gap-3 md:grid-cols-12">
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
                <Label className="text-xs">Compañía o proveedor</Label>
                <Input
                  className="h-9"
                  list="propz-providers"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder={PROVIDER_SUGGESTIONS[form.service_type].join(", ")}
                />
                <datalist id="propz-providers">
                  {PROVIDER_SUGGESTIONS[form.service_type].map((p) => <option key={p} value={p} />)}
                </datalist>
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
              <div className="md:col-span-8 space-y-1">
                <Label className="text-xs">Observaciones (opcional)</Label>
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
    </div>
  );
}
