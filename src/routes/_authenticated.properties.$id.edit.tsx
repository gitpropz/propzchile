import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { UNIT_TYPE_OPTIONS, type UnitType } from "@/lib/property-types";

export const Route = createFileRoute("/_authenticated/properties/$id/edit")({
  head: () => ({ meta: [{ title: "Editar propiedad — Cartera" }] }),
  component: EditProperty,
});

function EditProperty() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [comuna, setComuna] = useState("");
  const [region, setRegion] = useState("");
  const [type, setType] = useState<UnitType>("apartment");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (query.data) {
      setName(query.data.name);
      setAddress(query.data.address);
      setComuna(query.data.comuna ?? "");
      setRegion(query.data.region ?? "");
      setType(query.data.property_type);
      setNotes(query.data.notes ?? "");
    }
  }, [query.data]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { error } = await supabase
      .from("properties")
      .update({
        name,
        address,
        comuna: comuna || null,
        region: region || null,
        property_type: type,
        notes: notes || null,
      })
      .eq("id", id);
    setSaving(false);
    if (error) {
      toast.error("No pudimos guardar los cambios", { description: error.message });
      return;
    }
    toast.success("Cambios guardados");
    navigate({ to: "/properties/$id", params: { id } });
  }

  if (query.isLoading) {
    return <div className="mx-auto max-w-3xl p-8 text-sm text-muted-foreground">Cargando…</div>;
  }
  if (!query.data) {
    return <div className="mx-auto max-w-3xl p-8 text-sm text-muted-foreground">Propiedad no encontrada.</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <Link
        to="/properties/$id"
        params={{ id }}
        className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a la propiedad
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Editar propiedad</h1>

      <form onSubmit={submit} className="mt-8 space-y-8">
        <section className="rounded-xl border border-border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="name">Nombre corto</Label>
              <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <Label htmlFor="addr">Dirección</Label>
              <Input id="addr" required value={address} onChange={(e) => setAddress(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comuna">Comuna</Label>
              <Input id="comuna" value={comuna} onChange={(e) => setComuna(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="region">Región</Label>
              <Input id="region" value={region} onChange={(e) => setRegion(e.target.value)} />
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
              <Label htmlFor="notes">Notas internas</Label>
              <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Link to="/properties/$id" params={{ id }}>
            <Button type="button" variant="ghost">Cancelar</Button>
          </Link>
          <Button type="submit" disabled={saving}>
            {saving ? "Guardando…" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}