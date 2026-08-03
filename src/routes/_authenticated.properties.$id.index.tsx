import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, Copy, FileUp, Loader2, MapPin, Pencil, Plus, Trash2, WandSparkles, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { supabase } from "@/integrations/supabase/client";
import { MonitoredServicesPanel } from "@/components/monitored-services-panel";
import { UNIT_TYPE_LABELS, UNIT_TYPE_OPTIONS, CURRENCY_OPTIONS, type UnitType, type Currency } from "@/lib/property-types";
import { formatMoney } from "@/lib/format";
import { evaluateLease, leaseDaysLabel, LEASE_STATUS_META, addOneYear } from "@/lib/lease-expiry";
import { extractLeaseFromDocumentFn } from "@/lib/contract-extraction.functions";
import type { Database } from "@/integrations/supabase/types";

type Property = Database["public"]["Tables"]["properties"]["Row"];
type Unit = Database["public"]["Tables"]["rentable_units"]["Row"];

export const Route = createFileRoute("/_authenticated/properties/$id/")({
  head: () => ({ meta: [{ title: "Propiedad — Propz" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    unit: typeof search.unit === "string" ? search.unit : undefined,
  }),
  component: PropertyDetail,
});

function PropertyDetail() {
  const { id } = Route.useParams();
  const { tab, unit: focusUnitId } = Route.useSearch();
  const navigate = useNavigate();


  const propertyQuery = useQuery({
    queryKey: ["property", id],
    queryFn: async (): Promise<Property> => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const unitsQuery = useQuery({
    queryKey: ["units", id],
    queryFn: async (): Promise<Unit[]> => {
      const { data, error } = await supabase
        .from("rentable_units")
        .select("*")
        .eq("property_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  if (propertyQuery.isLoading) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!propertyQuery.data) {
    return <div className="mx-auto max-w-5xl p-8 text-sm text-muted-foreground">Propiedad no encontrada.</div>;
  }

  const p = propertyQuery.data;

  async function deleteProperty() {
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) {
      toast.error("No pudimos eliminar la propiedad", { description: error.message });
      return;
    }
    toast.success("Propiedad eliminada");
    navigate({ to: "/properties" });
  }

  async function duplicateProperty() {
    const { data: userData } = await supabase.auth.getUser();
    const { data: newProp, error } = await supabase
      .from("properties")
      .insert({
        organization_id: p.organization_id,
        name: `${p.name} (copia)`,
        address: p.address,
        comuna: p.comuna,
        region: p.region,
        property_type: p.property_type,
        notes: p.notes,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single();
    if (error || !newProp) {
      toast.error("No pudimos duplicar la propiedad", { description: error?.message });
      return;
    }
    const currentUnits = unitsQuery.data ?? [];
    if (currentUnits.length > 0) {
      const unitsToInsert = currentUnits.map((u) => ({
        property_id: newProp.id,
        organization_id: p.organization_id,
        label: u.label,
        unit_type: u.unit_type,
        identifier: u.identifier,
        base_rent_amount: u.base_rent_amount,
        base_rent_currency: u.base_rent_currency,
      }));
      const { error: unitsError } = await supabase.from("rentable_units").insert(unitsToInsert);
      if (unitsError) {
        toast.error("Copia creada, pero fallaron las unidades", { description: unitsError.message });
        navigate({ to: "/properties/$id", params: { id: newProp.id } });
        return;
      }
    }
    toast.success("Propiedad duplicada");
    navigate({ to: "/properties/$id", params: { id: newProp.id } });
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">
      <Link to="/properties" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a propiedades
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{p.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{p.address}{p.comuna ? `, ${p.comuna}` : ""}{p.region ? `, ${p.region}` : ""}</span>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Tipo: {UNIT_TYPE_LABELS[p.property_type]}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/properties/$id/edit" params={{ id }}>
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" /> Editar
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={duplicateProperty}>
            <Copy className="mr-2 h-4 w-4" /> Duplicar
          </Button>
          <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Eliminar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar esta propiedad?</AlertDialogTitle>
              <AlertDialogDescription>
                Se eliminarán también sus unidades, fotos y documentos. Esta acción no se puede deshacer.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={deleteProperty}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <Tabs defaultValue={tab === "units" || tab === "bills" ? tab : "general"} className="mt-8">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="units">Unidades ({unitsQuery.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="bills">Servicios monitoreados</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="pt-4">
          <div className="rounded-xl border border-border bg-card p-5">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Nombre" value={p.name} />
              <Field label="Tipo" value={UNIT_TYPE_LABELS[p.property_type]} />
              <Field label="Dirección" value={p.address} />
              <Field label="Comuna" value={p.comuna ?? "—"} />
              <Field label="Región" value={p.region ?? "—"} />
              <Field label="Notas" value={p.notes ?? "—"} />
            </dl>
          </div>
        </TabsContent>

        <TabsContent value="units" className="pt-4">
          <UnitsTab propertyId={id} organizationId={p.organization_id} units={unitsQuery.data ?? []} focusUnitId={focusUnitId} onChange={() => unitsQuery.refetch()} />
        </TabsContent>

        <TabsContent value="bills" className="pt-4">
          <MonitoredServicesPanel organizationId={p.organization_id} propertyId={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}

/** Badge de vencimiento para una unidad arrendada con fecha de término. */
function UnitExpiryBadge({ rentEndDate }: { rentEndDate: string }) {
  const ev = evaluateLease(true, rentEndDate);
  if (ev.status === "active") return null;
  const meta = LEASE_STATUS_META[ev.status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}>
      {meta.label}{ev.daysLeft != null ? ` · ${leaseDaysLabel(ev.daysLeft)}` : ""}
    </span>
  );
}

function UnitsTab({
  propertyId,
  organizationId,
  units,
  focusUnitId,
  onChange,
}: {
  propertyId: string;
  organizationId: string;
  units: Unit[];
  focusUnitId?: string;
  onChange: () => void;
}) {

  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [unitType, setUnitType] = useState<UnitType>("apartment");
  const [identifier, setIdentifier] = useState("");
  const [rent, setRent] = useState("");
  const [currency, setCurrency] = useState<Currency>("CLP");
  const [paymentDay, setPaymentDay] = useState("5");
  const [tenantName, setTenantName] = useState("");
  const [tenantContact, setTenantContact] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantRut, setTenantRut] = useState("");
  const [rentActive, setRentActive] = useState(false);
  const [rentStart, setRentStart] = useState("");
  const [rentEnd, setRentEnd] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const splitList = (s: string) =>
    s
      .split(/[\n,;]+/)
      .map((v) => v.trim())
      .filter(Boolean);
  const [editDraft, setEditDraft] = useState<{
    label: string;
    unit_type: UnitType;
    identifier: string;
    base_rent_amount: string;
    base_rent_currency: Currency;
    payment_day: string;
    tenant_name: string;
    tenant_contact: string;
    tenant_email: string;
    tenant_rut: string;
    tenant_ruts: string;
    tenant_aliases: string;
    tenant_account_numbers: string;
    rent_active: boolean;
    rent_start_date: string;
    rent_end_date: string;
  } | null>(null);
  const [leaseReading, setLeaseReading] = useState(false);

  function fileToDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("No pudimos leer el archivo"));
      reader.readAsDataURL(file);
    });
  }

  async function handleLeaseUpload(file: File) {
    if (!editDraft) return;
    setLeaseReading(true);
    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await extractLeaseFromDocumentFn({
        data: { name: file.name, mimeType: file.type || "application/octet-stream", dataUrl },
      });
      const lease = result.lease;
      setEditDraft((d) => d ? {
        ...d,
        tenant_name: lease.tenantName ?? d.tenant_name,
        tenant_rut: lease.tenantRut ?? d.tenant_rut,
        tenant_email: lease.tenantEmail ?? d.tenant_email,
        tenant_contact: lease.tenantContact ?? d.tenant_contact,
        base_rent_amount: lease.baseRentAmount != null ? String(lease.baseRentAmount) : d.base_rent_amount,
        rent_start_date: lease.rentStartDate ?? d.rent_start_date,
        rent_end_date: lease.rentEndDate ?? d.rent_end_date,
        payment_day: lease.paymentDay != null ? String(lease.paymentDay) : d.payment_day,
        rent_active: lease.tenantName != null ? true : d.rent_active,
      } : null);
      toast.success("Contrato leído", {
        description: "Revisa los datos extraídos antes de guardar",
      });
    } catch (e) {
      toast.error("No pudimos leer el contrato", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setLeaseReading(false);
    }
  }

  function startEdit(u: Unit) {
    setEditingId(u.id);
    setEditDraft({
      label: u.label,
      unit_type: u.unit_type,
      identifier: u.identifier ?? "",
      base_rent_amount: u.base_rent_amount != null ? String(u.base_rent_amount) : "",
      base_rent_currency: u.base_rent_currency ?? "CLP",
      payment_day: u.payment_day != null ? String(u.payment_day) : "5",
      tenant_name: u.tenant_name ?? "",
      tenant_contact: u.tenant_contact ?? "",
      tenant_email: (u as any).tenant_email ?? "",
      tenant_rut: (u as any).tenant_rut ?? "",
      tenant_ruts: (((u as any).tenant_ruts ?? []) as string[]).join("\n"),
      tenant_aliases: (((u as any).tenant_aliases ?? []) as string[]).join("\n"),
      tenant_account_numbers: (((u as any).tenant_account_numbers ?? []) as string[]).join("\n"),
      rent_active: !!u.rent_active,
      rent_start_date: u.rent_start_date ?? "",
      rent_end_date: (u as any).rent_end_date ?? "",
    });
  }

  const focusedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!focusUnitId || focusedRef.current === focusUnitId) return;
    const target = units.find((u) => u.id === focusUnitId);
    if (!target) return;
    focusedRef.current = focusUnitId;
    startEdit(target);
    requestAnimationFrame(() => {
      document.getElementById(`unit-${focusUnitId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusUnitId, units]);



  async function saveEdit(unitId: string) {
    if (!editDraft) return;
    const day = editDraft.payment_day ? Number(editDraft.payment_day) : null;
    if (day != null && (day < 1 || day > 28)) {
      toast.error("El día de pago debe estar entre 1 y 28");
      return;
    }
    const { error } = await supabase
      .from("rentable_units")
      .update({
        label: editDraft.label,
        unit_type: editDraft.unit_type,
        identifier: editDraft.identifier || null,
        base_rent_amount: editDraft.base_rent_amount ? Number(editDraft.base_rent_amount) : null,
        base_rent_currency: editDraft.base_rent_currency,
        payment_day: day,
        tenant_name: editDraft.tenant_name || null,
        tenant_contact: editDraft.tenant_contact || null,
        tenant_email: editDraft.tenant_email || null,
        tenant_rut: editDraft.tenant_rut || null,
        tenant_ruts: splitList(editDraft.tenant_ruts),
        tenant_aliases: splitList(editDraft.tenant_aliases),
        tenant_account_numbers: splitList(editDraft.tenant_account_numbers),
        rent_active: editDraft.rent_active,
        rent_start_date: editDraft.rent_start_date || null,
        rent_end_date: editDraft.rent_end_date || null,
      } as any)
      .eq("id", unitId);
    if (error) {
      toast.error("No pudimos guardar la unidad", { description: error.message });
      return;
    }
    toast.success("Unidad actualizada");
    setEditingId(null);
    setEditDraft(null);
    onChange();
  }

  async function addUnit(e: React.FormEvent) {
    e.preventDefault();
    const day = paymentDay ? Number(paymentDay) : null;
    if (day != null && (day < 1 || day > 28)) {
      toast.error("El día de pago debe estar entre 1 y 28");
      return;
    }
    const { error } = await supabase.from("rentable_units").insert({
      property_id: propertyId,
      organization_id: organizationId,
      label,
      unit_type: unitType,
      identifier: identifier || null,
      base_rent_amount: rent ? Number(rent) : null,
      base_rent_currency: currency,
      payment_day: day,
      tenant_name: tenantName || null,
      tenant_contact: tenantContact || null,
      tenant_email: tenantEmail || null,
      tenant_rut: tenantRut || null,
      rent_active: rentActive,
      rent_start_date: rentStart || null,
      rent_end_date: rentEnd || null,
    } as any);
    if (error) {
      toast.error("No pudimos agregar la unidad", { description: error.message });
      return;
    }
    toast.success("Unidad agregada");
    setLabel(""); setIdentifier(""); setRent(""); setUnitType("apartment"); setCurrency("CLP");
    setPaymentDay("5"); setTenantName(""); setTenantContact(""); setTenantEmail(""); setRentActive(false); setRentStart(""); setRentEnd("");
    setTenantRut("");
    setAdding(false);
    onChange();
  }

  function openAddForm() {
    const base = units[0];
    if (base) {
      setUnitType(base.unit_type);
      setCurrency((base.base_rent_currency ?? "CLP") as Currency);
      setRent(base.base_rent_amount != null ? String(base.base_rent_amount) : "");
      setPaymentDay(base.payment_day != null ? String(base.payment_day) : "5");
      setTenantName(base.tenant_name ?? "");
      setTenantContact(base.tenant_contact ?? "");
      setTenantEmail((base as any).tenant_email ?? "");
      setTenantRut((base as any).tenant_rut ?? "");
      setRentActive(!!base.rent_active);
      setRentStart(base.rent_start_date ?? "");
      setRentEnd((base as any).rent_end_date ?? addOneYear(base.rent_start_date));
    }
    setAdding(true);
  }

  async function removeUnit(unitId: string) {
    const { error } = await supabase.from("rentable_units").delete().eq("id", unitId);
    if (error) {
      toast.error("No pudimos eliminar", { description: error.message });
      return;
    }
    onChange();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card">
        {units.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Aún no hay unidades. Agrega la primera abajo.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {units.map((u) =>
              editingId === u.id && editDraft ? (
                <li key={u.id} id={`unit-${u.id}`} className="px-5 py-4">
                  <div className="grid gap-3 md:grid-cols-6">
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>Nombre</Label>
                      <Input value={editDraft.label} onChange={(e) => setEditDraft({ ...editDraft, label: e.target.value })} />
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>Tipo</Label>
                      <Select value={editDraft.unit_type} onValueChange={(v) => setEditDraft({ ...editDraft, unit_type: v as UnitType })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {UNIT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="md:col-span-2 space-y-1.5">
                      <Label>N°/identificador</Label>
                      <Input value={editDraft.identifier} onChange={(e) => setEditDraft({ ...editDraft, identifier: e.target.value })} />
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                      <Label>Arriendo base</Label>
                      <Input type="number" value={editDraft.base_rent_amount} onChange={(e) => setEditDraft({ ...editDraft, base_rent_amount: e.target.value })} />
                    </div>
                    <div className="md:col-span-3 space-y-1.5">
                      <Label>Moneda</Label>
                      <Select value={editDraft.base_rent_currency} onValueChange={(v) => setEditDraft({ ...editDraft, base_rent_currency: v as Currency })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CURRENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-border bg-muted/30 p-3">
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold">Condiciones del arriendo</h4>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-accent-brand/30 bg-accent-brand/5 px-2.5 py-1 text-xs font-medium text-accent-brand hover:bg-accent-brand/10">
                          {leaseReading ? (
                            <>
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              Leyendo contrato…
                            </>
                          ) : (
                            <>
                              <WandSparkles className="h-3.5 w-3.5" />
                              Leer contrato con IA
                            </>
                          )}
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            disabled={leaseReading}
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              e.target.value = "";
                              if (f) handleLeaseUpload(f);
                            }}
                          />
                        </label>
                        <label className="flex items-center gap-2 text-xs">
                          <Checkbox
                            checked={editDraft.rent_active}
                            onCheckedChange={(v) => setEditDraft({ ...editDraft, rent_active: v === true })}
                          />
                          Arrendada actualmente
                        </label>
                      </div>
                    </div>
                    <div className="grid gap-2 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Día de pago (1–28)</Label>
                        <Input
                          className="h-9"
                          type="number"
                          min={1}
                          max={28}
                          value={editDraft.payment_day}
                          onChange={(e) => setEditDraft({ ...editDraft, payment_day: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Arrendatario</Label>
                        <Input
                          className="h-9"
                          value={editDraft.tenant_name}
                          onChange={(e) => setEditDraft({ ...editDraft, tenant_name: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Inicio del contrato</Label>
                        <Input
                          className="h-9"
                          type="date"
                          value={editDraft.rent_start_date}
                          onChange={(e) => {
                            const nextStart = e.target.value;
                            const auto = addOneYear(editDraft.rent_start_date);
                            const keepEnd =
                              editDraft.rent_end_date && editDraft.rent_end_date !== auto
                                ? editDraft.rent_end_date
                                : addOneYear(nextStart);
                            setEditDraft({ ...editDraft, rent_start_date: nextStart, rent_end_date: keepEnd });
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Término del contrato</Label>
                        <Input
                          className="h-9"
                          type="date"
                          value={editDraft.rent_end_date}
                          onChange={(e) => setEditDraft({ ...editDraft, rent_end_date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Contacto</Label>
                        <Input
                          className="h-9"
                          value={editDraft.tenant_contact}
                          onChange={(e) => setEditDraft({ ...editDraft, tenant_contact: e.target.value })}
                          placeholder="Teléfono / WhatsApp"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Email del arrendatario</Label>
                        <Input
                          className="h-9"
                          type="email"
                          value={editDraft.tenant_email}
                          onChange={(e) => setEditDraft({ ...editDraft, tenant_email: e.target.value })}
                          placeholder="nombre@correo.cl"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">RUT del arrendatario</Label>
                        <Input
                          className="h-9"
                          value={editDraft.tenant_rut}
                          onChange={(e) => setEditDraft({ ...editDraft, tenant_rut: e.target.value })}
                          placeholder="12.345.678-9"
                        />
                      </div>
                    </div>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      Término vacío = arriendo indefinido. Por defecto se propone 1 año desde el inicio.
                    </p>

                    <details className="mt-3 rounded-md border border-border bg-background/60 p-2.5">
                      <summary className="cursor-pointer text-xs font-medium">
                        Datos para conciliar cartolas (RUT, alias y cuentas)
                      </summary>
                      <div className="mt-2 grid gap-2 md:grid-cols-3">
                        <div className="space-y-1">
                          <Label className="text-xs">RUT adicionales (uno por línea)</Label>
                          <textarea
                            className="min-h-[60px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                            value={editDraft.tenant_ruts}
                            onChange={(e) => setEditDraft({ ...editDraft, tenant_ruts: e.target.value })}
                            placeholder={"12.345.678-9\n9.876.543-2"}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Nombres y alias del pagador</Label>
                          <textarea
                            className="min-h-[60px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                            value={editDraft.tenant_aliases}
                            onChange={(e) => setEditDraft({ ...editDraft, tenant_aliases: e.target.value })}
                            placeholder={"Juan Pérez\nJ. Pérez Soto"}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Cuentas de origen del pagador</Label>
                          <textarea
                            className="min-h-[60px] w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs"
                            value={editDraft.tenant_account_numbers}
                            onChange={(e) =>
                              setEditDraft({ ...editDraft, tenant_account_numbers: e.target.value })
                            }
                            placeholder={"000123456789\n987654321"}
                          />
                        </div>
                      </div>
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        Se usan para identificar depósitos sin RUT ni nombre reconocible.
                      </p>
                    </details>
                  </div>

                  <div className="mt-3 flex justify-end gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={() => { setEditingId(null); setEditDraft(null); }}>
                      <X className="mr-1 h-4 w-4" /> Cancelar
                    </Button>
                    <Button type="button" size="sm" onClick={() => saveEdit(u.id)}>
                      <Check className="mr-1 h-4 w-4" /> Guardar
                    </Button>
                  </div>
                </li>
              ) : (
                <li key={u.id} id={`unit-${u.id}`} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div>
                    <div className="font-medium">{u.label} {u.identifier ? <span className="text-muted-foreground">· {u.identifier}</span> : null}</div>
                    <div className="text-xs text-muted-foreground">
                      {UNIT_TYPE_LABELS[u.unit_type]}
                      {u.base_rent_amount != null ? ` · ${formatMoney(Number(u.base_rent_amount), u.base_rent_currency)}` : ""}
                      {u.rent_active ? ` · Día ${u.payment_day ?? 5}` : ""}
                      {u.tenant_name ? ` · ${u.tenant_name}` : ""}
                    </div>
                    {u.rent_active ? (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] text-success">
                          Arrendada
                        </span>
                        {u.rent_end_date ? (
                          <UnitExpiryBadge rentEndDate={u.rent_end_date} />
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => startEdit(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => removeUnit(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              )
            )}
          </ul>
        )}
      </div>

      {adding ? (
        <form onSubmit={addUnit} className="rounded-xl border border-border bg-card p-5">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2 space-y-1.5">
              <Label>Nombre</Label>
              <Input required value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej: Estacionamiento" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>Tipo</Label>
              <Select value={unitType} onValueChange={(v) => setUnitType(v as UnitType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_TYPE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label>N°/identificador</Label>
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <Label>Arriendo base</Label>
              <Input type="number" value={rent} onChange={(e) => setRent(e.target.value)} />
            </div>
            <div className="md:col-span-3 space-y-1.5">
              <Label>Moneda</Label>
              <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Condiciones del arriendo</h4>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={rentActive}
                  onCheckedChange={(v) => setRentActive(v === true)}
                />
                Arrendada actualmente
              </label>
            </div>
            <div className="grid gap-2 md:grid-cols-4">
              <div className="space-y-1">
                <Label className="text-xs">Día de pago (1–28)</Label>
                <Input className="h-9" type="number" min={1} max={28} value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Arrendatario</Label>
                <Input className="h-9" value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Inicio del contrato</Label>
                <Input
                  className="h-9"
                  type="date"
                  value={rentStart}
                  onChange={(e) => {
                    const next = e.target.value;
                    const auto = addOneYear(rentStart);
                    setRentStart(next);
                    setRentEnd(rentEnd && rentEnd !== auto ? rentEnd : addOneYear(next));
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Término del contrato</Label>
                <Input className="h-9" type="date" value={rentEnd} onChange={(e) => setRentEnd(e.target.value)} />
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs">Contacto</Label>
                <Input className="h-9" value={tenantContact} onChange={(e) => setTenantContact(e.target.value)} placeholder="Teléfono / WhatsApp" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email del arrendatario</Label>
                <Input className="h-9" type="email" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} placeholder="nombre@correo.cl" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">RUT del arrendatario</Label>
                <Input className="h-9" value={tenantRut} onChange={(e) => setTenantRut(e.target.value)} placeholder="12.345.678-9" />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Término vacío = arriendo indefinido. Por defecto se propone 1 año desde el inicio.
            </p>

          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Cancelar</Button>
            <Button type="submit">Guardar unidad</Button>
          </div>
        </form>
      ) : (
        <Button variant="outline" onClick={openAddForm}>
          <Plus className="mr-2 h-4 w-4" /> Agregar unidad
        </Button>
      )}
    </div>
  );
}
