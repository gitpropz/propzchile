import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { UNIT_TYPE_OPTIONS, CURRENCY_OPTIONS, type UnitType, type Currency } from "@/lib/property-types";

export const Route = createFileRoute("/_authenticated/properties/new")({
  head: () => ({ meta: [{ title: "Nueva propiedad — Propz" }] }),
  component: NewProperty,
});

interface UnitDraft {
  label: string;
  unit_type: UnitType;
  identifier: string;
  base_rent_amount: string;
  base_rent_currency: Currency;
}

function emptyUnit(): UnitDraft {
  return { label: "", unit_type: "apartment", identifier: "", base_rent_amount: "", base_rent_currency: "CLP" };
}

function NewProperty() {
  const navigate = useNavigate();
  const org = useCurrentOrg();

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [comuna, setComuna] = useState("");
  const [region, setRegion] = useState("");
  const [type, setType] = useState<UnitType>("apartment");
  const [notes, setNotes] = useState("");
  const [units, setUnits] = useState<UnitDraft[]>([{ ...emptyUnit(), label: "Unidad principal" }]);
  const [saving, setSaving] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  function updateUnit(idx: number, patch: Partial<UnitDraft>) {
    setUnits((u) => u.map((unit, i) => (i === idx ? { ...unit, ...patch } : unit)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!org.data?.organization_id) {
      toast.error("No encontramos tu organización");
      return;
    }
    const validUnits = units.filter((u) => u.label.trim().length > 0);
    if (validUnits.length === 0) {
      toast.error("Agrega al menos una unidad arrendable", {
        description: "Cada propiedad necesita al menos una unidad (depto, casa, estacionamiento, etc.).",
      });
      return;
    }
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const { data: property, error } = await supabase
      .from("properties")
      .insert({
        organization_id: org.data.organization_id,
        name,
        address,
        comuna: comuna || null,
        region: region || null,
        property_type: type,
        notes: notes || null,
        created_by: userData.user?.id ?? null,
      })
      .select()
      .single();

    if (error || !property) {
      setSaving(false);
      toast.error("No pudimos crear la propiedad", { description: error?.message });
      return;
    }

    const unitsToInsert = validUnits
      .map((u) => ({
        property_id: property.id,
        organization_id: org.data!.organization_id,
        label: u.label.trim(),
        unit_type: u.unit_type,
        identifier: u.identifier || null,
        base_rent_amount: u.base_rent_amount ? Number(u.base_rent_amount) : null,
        base_rent_currency: u.base_rent_currency,
      }));

    if (unitsToInsert.length > 0) {
      const { error: unitsError } = await supabase.from("rentable_units").insert(unitsToInsert);
      if (unitsError) {
        setSaving(false);
        toast.error("Propiedad creada, pero no pudimos guardar las unidades", { description: unitsError.message });
        return;
      }
    }

    setSaving(false);
    toast.success("Propiedad y unidades creadas");
    setCreatedId(property.id);
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <Link to="/properties" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver a propiedades
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Nueva propiedad</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Registra la propiedad y sus unidades arrendables. Puedes agregar más unidades después.
      </p>

      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="rounded-xl border border-border bg-card p-5">
          <h2 className="font-semibold">Datos de la propiedad</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="name">Nombre corto</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Depto 1204 Providencia" />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="addr">Dirección</Label>
              <Input id="addr" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Ej: Av. Providencia 1234, Depto 1204" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comuna">Comuna</Label>
              <Input id="comuna" value={comuna} onChange={(e) => setComuna(e.target.value)} placeholder="Ej: Providencia" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Región</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Ej: Metropolitana" />
            </div>
            <div className="space-y-1.5">
              <Label>Tipo principal</Label>
              <Select value={type} onValueChange={(v) => setType(v as UnitType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UNIT_TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="notes">Notas internas (opcional)</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Unidades arrendables</h2>
              <p className="text-sm text-muted-foreground">Departamento, estacionamiento, bodega, etc.</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setUnits((u) => [...u, emptyUnit()])}>
              <Plus className="mr-2 h-4 w-4" /> Agregar unidad
            </Button>
          </div>

          <div className="mt-4 space-y-4">
            {units.map((u, i) => (
              <div key={i} className="rounded-lg border border-border bg-background p-4">
                <div className="grid gap-3 md:grid-cols-6">
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>Nombre</Label>
                    <Input value={u.label} onChange={(e) => updateUnit(i, { label: e.target.value })} placeholder="Ej: Depto 1204" />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>Tipo</Label>
                    <Select value={u.unit_type} onValueChange={(v) => updateUnit(i, { unit_type: v as UnitType })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>N° o identificador</Label>
                    <Input value={u.identifier} onChange={(e) => updateUnit(i, { identifier: e.target.value })} placeholder="Ej: 34" />
                  </div>
                  <div className="md:col-span-3 space-y-1.5">
                    <Label>Arriendo base (opcional)</Label>
                    <Input
                      type="number"
                      inputMode="decimal"
                      value={u.base_rent_amount}
                      onChange={(e) => updateUnit(i, { base_rent_amount: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="md:col-span-2 space-y-1.5">
                    <Label>Moneda</Label>
                    <Select value={u.base_rent_currency} onValueChange={(v) => updateUnit(i, { base_rent_currency: v as Currency })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {CURRENCY_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end justify-end md:col-span-1">
                    {units.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setUnits((arr) => arr.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link to="/properties"><Button type="button" variant="ghost">Cancelar</Button></Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Crear propiedad"}
          </Button>
        </div>
      </form>

      <AlertDialog open={createdId != null}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Registrar cuentas para monitorear?</AlertDialogTitle>
            <AlertDialogDescription>
              Puedes configurar ahora las cuentas de servicios (luz, agua, gas, gastos comunes) de esta
              propiedad para que Propz detecte deudas automáticamente. También puedes hacerlo más tarde.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() =>
                navigate({
                  to: "/properties/$id",
                  params: { id: createdId! },
                  search: { tab: "units" },
                })
              }
            >
              Más tarde
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                navigate({
                  to: "/properties/$id",
                  params: { id: createdId! },
                  search: { tab: "bills" },
                })
              }
            >
              Sí, registrar cuentas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}