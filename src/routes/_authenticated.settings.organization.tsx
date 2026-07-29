import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { CURRENCY_OPTIONS, type Currency } from "@/lib/property-types";

export const Route = createFileRoute("/_authenticated/settings/organization")({
  component: OrgSettings,
});

function OrgSettings() {
  const org = useCurrentOrg();
  const [name, setName] = useState("");
  const [country, setCountry] = useState("CL");
  const [currency, setCurrency] = useState<Currency>("CLP");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (org.data?.organizations) {
      setName(org.data.organizations.name);
      setCountry(org.data.organizations.country);
      setCurrency(org.data.organizations.default_currency as Currency);
    }
  }, [org.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!org.data?.organization_id) return;
    setSaving(true);
    const { error } = await supabase
      .from("organizations")
      .update({ name, country, default_currency: currency })
      .eq("id", org.data.organization_id);
    setSaving(false);
    if (error) {
      toast.error("No pudimos guardar", { description: error.message });
      return;
    }
    toast.success("Configuración guardada");
    org.refetch();
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1.5">
        <Label htmlFor="orgname">Nombre de la organización</Label>
        <Input id="orgname" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="country">País</Label>
          <Input id="country" value={country} onChange={(e) => setCountry(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Moneda por defecto</Label>
          <Select value={currency} onValueChange={(v) => setCurrency(v as Currency)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCY_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
    </form>
  );
}