import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/settings/profile")({
  component: ProfileSettings,
});

function ProfileSettings() {
  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data, error } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      if (error) throw error;
      return { profile: data, email: u.user.email };
    },
  });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile.data?.profile) {
      setFullName(profile.data.profile.full_name ?? "");
      setPhone(profile.data.profile.phone ?? "");
    }
  }, [profile.data]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: u.user.id, full_name: fullName, phone, email: u.user.email });
    setSaving(false);
    if (error) { toast.error("Error al guardar", { description: error.message }); return; }
    toast.success("Perfil actualizado");
    profile.refetch();
  }

  return (
    <form onSubmit={save} className="max-w-xl space-y-5 rounded-xl border border-border bg-card p-5">
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={profile.data?.email ?? ""} disabled />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fn">Nombre completo</Label>
        <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ph">Teléfono</Label>
        <Input id="ph" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+56 9 ..." />
      </div>
      <Button type="submit" disabled={saving}>{saving ? "Guardando…" : "Guardar cambios"}</Button>
    </form>
  );
}