import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";

export const Route = createFileRoute("/_authenticated/settings/team")({
  component: TeamSettings,
});

function TeamSettings() {
  const org = useCurrentOrg();
  const orgId = org.data?.organization_id;
  const members = useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_members")
        .select("id, role, user_id, created_at")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">Miembros del equipo</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {members.data?.length ?? 0} miembro(s) en esta organización. La invitación por email llegará en la próxima iteración.
        </p>
        <ul className="mt-4 divide-y divide-border">
          {members.data?.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-3">
              <div className="text-sm">
                <div className="font-medium">{m.user_id.slice(0, 8)}…</div>
                <div className="text-xs text-muted-foreground">Rol: {m.role}</div>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-5 text-sm text-muted-foreground">
        Invitaciones por email, roles personalizados y traspaso de administración se habilitan en la Etapa 2.
      </div>
    </div>
  );
}