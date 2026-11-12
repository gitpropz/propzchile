import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ClientTypePicker } from "@/components/client-type-picker";
import { supabase } from "@/integrations/supabase/client";
import { type ClientType, accountDestination } from "@/lib/account-types";
import { getAccountContext } from "@/lib/account-context";

export const Route = createFileRoute("/_authenticated/account-setup")({
  head: () => ({ meta: [
    { title: "Tipo de cuenta — Propz 5.0" },
    { name: "description", content: "Identifica tu cartera de propiedades en Propz." },
    { property: "og:title", content: "Tipo de cuenta — Propz 5.0" },
    { property: "og:description", content: "Identifica tu cartera de propiedades en Propz." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: AccountSetup,
});
function AccountSetup() {
  const [type, setType] = useState<ClientType>("independent_owner");
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function submit() {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("complete_client_setup", { _account_type: type });
      if (error) throw error;
      await qc.invalidateQueries();
      const account = await getAccountContext();
      await navigate({ to: accountDestination(account.account_type), replace: true });
    } catch (error) { toast.error("No pudimos guardar tu perfil", { description: error instanceof Error ? error.message : String(error) }); }
    finally { setSaving(false); }
  }
  return <div className="mx-auto max-w-xl space-y-6 px-5 py-10">
    <h1 className="text-2xl font-semibold">Tu cuenta Propz</h1>
    <ClientTypePicker value={type} onChange={setType} />
    <Button onClick={submit} disabled={saving}>{saving ? "Guardando…" : "Continuar"}</Button>
  </div>;
}