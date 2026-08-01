import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Loader2, Sparkles, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCLP } from "@/lib/format";
import { saveReading } from "@/lib/service-readings";
import { extractServicesFromDocumentFn } from "@/lib/service-extraction.functions";
import type { ExtractedService } from "@/lib/service-extraction.server";
import {
  matchDetectedService,
  periodKey,
  periodLabelEs,
  recentPeriods,
  serviceTypeLabel,
  type MonitoredService,
} from "@/lib/monitored-services";
import type { Database } from "@/integrations/supabase/types";

type Property = Pick<Database["public"]["Tables"]["properties"]["Row"], "id" | "name" | "address">;

type ReviewRow = {
  id: string;
  fileName: string;
  detected: ExtractedService;
  serviceId: string | null;
  amount: string;
  include: boolean;
  auto: boolean;
};

export const Route = createFileRoute("/_authenticated/services/update")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Actualizar servicios — Propz" },
      {
        name: "description",
        content:
          "Carga pantallazos de Servipag, PDF o imágenes y Propz actualiza automáticamente los servicios monitoreados de tus propiedades.",
      },
    ],
  }),
  component: UpdateServicesPage,
});

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("No pudimos leer el archivo"));
    reader.readAsDataURL(file);
  });
}

function UpdateServicesPage() {
  const org = useCurrentOrg();
  const orgId = org.data?.organization_id;

  const [period, setPeriod] = useState(periodKey());
  const [processing, setProcessing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [docs, setDocs] = useState<string[]>([]);

  const propertiesQuery = useQuery({
    queryKey: ["svc-properties", orgId],
    queryFn: async (): Promise<Property[]> => {
      const { data, error } = await supabase
        .from("properties")
        .select("id,name,address")
        .eq("organization_id", orgId!)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const servicesQuery = useQuery({
    queryKey: ["svc-all-services", orgId],
    queryFn: async (): Promise<MonitoredService[]> => {
      const { data, error } = await supabase
        .from("monitored_services")
        .select("*")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const services = servicesQuery.data ?? [];
  const propertyById = useMemo(
    () => new Map((propertiesQuery.data ?? []).map((p) => [p.id, p])),
    [propertiesQuery.data],
  );
  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);

  function serviceLabel(s: MonitoredService) {
    const prop = s.property_id ? propertyById.get(s.property_id) : null;
    return `${prop?.name ?? "Propiedad"} · ${serviceTypeLabel(s.service_type)}${s.provider ? ` (${s.provider})` : ""}`;
  }

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    if (services.length === 0) {
      toast.error("Primero configura los servicios monitoreados de tus propiedades");
      return;
    }
    setProcessing(true);
    try {
      const newRows: ReviewRow[] = [];
      const names: string[] = [];
      for (const file of files) {
        names.push(file.name);
        try {
          const dataUrl = await fileToDataUrl(file);
          const result = await extractServicesFromDocumentFn({
            data: { name: file.name, mimeType: file.type || "application/octet-stream", dataUrl },
          });
          for (const detected of result.services) {
            const match = matchDetectedService(
              {
                identifier: detected.identifier,
                identifiers: [detected.meterNumber, detected.contractNumber],
                serviceType: detected.serviceType,
                provider: detected.provider,
                amount: detected.amountDue ?? 0,
              },
              services,
            );

            newRows.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              fileName: file.name,
              detected,
              serviceId: match.service?.id ?? null,
              amount: detected.amountDue != null ? String(detected.amountDue) : "",
              include: true,
              auto: !!match.service,
            });
          }
        } catch (e) {
          toast.error(`No pudimos leer ${file.name}`, {
            description: e instanceof Error ? e.message : String(e),
          });
        }
      }
      setDocs((d) => [...d, ...names]);
      setRows((r) => [...r, ...newRows]);
      if (newRows.length > 0) {
        const auto = newRows.filter((r) => r.auto).length;
        toast.success(`${newRows.length} servicio(s) detectados`, {
          description: `${auto} asociados automáticamente a una propiedad`,
        });
      } else {
        toast.info("No detectamos servicios en los documentos cargados");
      }
    } finally {
      setProcessing(false);
    }
  }

  function updateRow(id: string, patch: Partial<ReviewRow>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  async function applyAll() {
    if (!orgId) return;
    const toApply = rows.filter((r) => r.include && r.serviceId && r.amount !== "");
    if (toApply.length === 0) {
      toast.error("No hay servicios listos para actualizar");
      return;
    }
    setApplying(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: batch, error: batchError } = await supabase
        .from("service_import_batches")
        .insert({
          organization_id: orgId,
          channel: "upload",
          period,
          documents_count: docs.length,
          detected_count: rows.length,
          matched_count: toApply.length,
          created_by: userData.user?.id ?? null,
          raw: { documents: docs } as never,
        })
        .select("id")
        .single();
      if (batchError) throw batchError;

      for (const row of toApply) {
        const service = serviceById.get(row.serviceId!);
        if (!service?.property_id) continue;
        await saveReading({
          organizationId: orgId,
          propertyId: service.property_id,
          service,
          period,
          amountDue: Number(row.amount),
          source: "servipag",
          documentRef: row.fileName,
          batchId: batch.id,
          raw: row.detected,
        });
      }
      toast.success(`${toApply.length} servicio(s) actualizados en ${periodLabelEs(period)}`);
      setRows([]);
      setDocs([]);
    } catch (e) {
      toast.error("No pudimos aplicar la actualización", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setApplying(false);
    }
  }

  const matched = rows.filter((r) => r.serviceId).length;

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 md:px-8 md:py-10">
      <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al dashboard
      </Link>

      <header className="mt-4">
        <h1 className="text-2xl font-semibold tracking-tight">Actualizar servicios</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Carga pantallazos de Servipag, PDF o imágenes. Propz lee los documentos, identifica cada servicio por su
          número de cliente y actualiza el monitoreo de la propiedad correspondiente.
        </p>
      </header>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Período a actualizar</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-9 w-[12rem]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {recentPeriods(12).map((p) => (
                  <SelectItem key={p} value={p}>{periodLabelEs(p)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="text-xs text-muted-foreground">
            {services.filter((s) => s.active).length} servicios activos configurados
          </div>
        </div>

        <label className="mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center transition-propz hover:bg-muted/40">
          <input
            type="file"
            multiple
            accept="image/*,application/pdf"
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              handleFiles(files);
            }}
          />
          {processing ? (
            <Loader2 className="h-6 w-6 animate-spin text-accent-brand" />
          ) : (
            <FileUp className="h-6 w-6 text-accent-brand" />
          )}
          <span className="text-sm font-medium">
            {processing ? "Leyendo documentos…" : "Cargar pantallazos, PDF o imágenes"}
          </span>
          <span className="text-xs text-muted-foreground">
            Puedes cargar varios archivos a la vez. Propz los procesa automáticamente.
          </span>
        </label>

        {docs.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {docs.map((d, i) => (
              <span key={`${d}-${i}`} className="rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold">Servicios detectados</h2>
              <p className="text-xs text-muted-foreground">
                {rows.length} detectados · {matched} asociados automáticamente
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setRows([]); setDocs([]); }}>
                <Trash2 className="mr-1.5 h-4 w-4" /> Descartar
              </Button>
              <Button size="sm" disabled={applying} onClick={applyAll}>
                {applying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                Aplicar actualización
              </Button>
            </div>
          </div>

          <ul className="mt-4 divide-y divide-border">
            {rows.map((r) => {
              const service = r.serviceId ? serviceById.get(r.serviceId) : null;
              return (
                <li key={r.id} className="grid gap-3 py-3 md:grid-cols-12 md:items-end">
                  <div className="md:col-span-4">
                    <div className="text-sm font-medium">
                      {r.detected.provider ?? "Proveedor desconocido"}
                      {r.detected.serviceType ? ` · ${serviceTypeLabel(r.detected.serviceType)}` : ""}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.detected.identifier ? `N° ${r.detected.identifier}` : "Sin identificador"} · {r.fileName}
                    </div>
                  </div>
                  <div className="space-y-1 md:col-span-4">
                    <Label className="text-xs">Servicio de la propiedad</Label>
                    <Select
                      value={r.serviceId ?? "none"}
                      onValueChange={(v) => updateRow(r.id, { serviceId: v === "none" ? null : v, auto: false })}
                    >
                      <SelectTrigger className="h-9"><SelectValue placeholder="Sin asociar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asociar</SelectItem>
                        {services.filter((s) => s.active).map((s) => (
                          <SelectItem key={s.id} value={s.id}>{serviceLabel(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs">Monto adeudado</Label>
                    <Input
                      className="h-9"
                      type="number"
                      min="0"
                      value={r.amount}
                      onChange={(e) => updateRow(r.id, { amount: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <div className="text-xs text-muted-foreground">
                      {service?.expected_amount
                        ? `Esperado ${formatCLP(Number(service.expected_amount))}`
                        : "Sin valor esperado"}
                    </div>
                    <label className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => updateRow(r.id, { include: e.target.checked })}
                      />
                      Incluir
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-dashed border-border bg-card/50 p-5 text-xs text-muted-foreground">
        Próximas fuentes de actualización automática: Gmail, Outlook y una casilla de correo dedicada. La
        arquitectura del módulo ya está preparada para recibirlas sin cambiar el monitoreo.
      </section>
    </div>
  );
}
