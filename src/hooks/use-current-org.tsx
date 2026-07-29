import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
      const { data, error } = await supabase
        .from("organization_members")
        .select("organization_id, role, organizations(id, name, country, default_currency)")
        .eq("user_id", userData.user.id)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as OrgMembership | null;
    },
  });
}