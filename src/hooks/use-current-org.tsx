import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getAccountContext } from "@/lib/account-context";

export interface OrgMembership {
  organization_id: string;
  role: string;
  organizations: {
    id: string;
    name: string;
    country: string;
    default_currency: string;
  } | null;
}

export function useCurrentOrg() {
  return useQuery({
    queryKey: ["current-org"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;
      const account = await getAccountContext();
      if (account.account_type === "general_admin") {
        const selected = sessionStorage.getItem("propz-support-organization");
        if (!selected) return null;
        const { data, error } = await supabase.from("organizations")
          .select("id, name, country, default_currency").eq("id", selected).maybeSingle();
        if (error) throw error;
        return data ? { organization_id: data.id, role: "superadmin", organizations: data } : null;
      }
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, country, default_currency)")
        .eq("user_id", userData.user.id)
        .eq("organization_id", account.organization_id ?? "00000000-0000-0000-0000-000000000000")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as OrgMembership | null;
    },
  });
}