import { supabase } from "@/integrations/supabase/client";

/**
 * Ensures the signed-in user has a profile row and belongs to an organization.
 * Safe to call repeatedly: it only creates what is missing.
 */
export async function ensureAccountSetup(): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return;

  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const fullName =
    (meta.full_name as string) ||
    (meta.name as string) ||
    (user.email ? user.email.split("@")[0] : "");
  const phone = (meta.phone as string) || user.phone || null;

  // 1. Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, phone")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    await supabase.from("profiles").insert({
      id: user.id,
      full_name: fullName,
      email: user.email,
      phone,
    });
  } else if ((!profile.full_name && fullName) || (!profile.phone && phone)) {
    await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name || fullName,
        phone: profile.phone || phone,
      })
      .eq("id", user.id);
  }

  // 2. Organization membership
  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (membership) return;

  const orgName = (meta.organization_name as string) || "Mi patrimonio";
  await supabase.rpc("create_org_for_current_user", { _name: orgName });
}
