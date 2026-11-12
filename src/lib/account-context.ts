import { supabase } from "@/integrations/supabase/client";
import type { AccountContext } from "./account-types";
export async function getAccountContext(): Promise<AccountContext> {
  const { data, error } = await supabase.rpc("get_account_context");
  if (error) throw error;
  return data as unknown as AccountContext;
}