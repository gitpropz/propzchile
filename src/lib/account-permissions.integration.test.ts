import { describe, test } from "node:test";
import { strictEqual } from "node:assert";
import { createClient } from "@supabase/supabase-js";

const token = process.env.PROPZ_TEST_ACCESS_TOKEN;
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
describe("Authenticated Propz client permissions", { skip: !token || !url || !key }, () => {
  function client() {
    if (!token || !url || !key) throw new Error("Test session missing");
    return createClient(url, key, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
  }
  test("propzchile has property administrator identification", async () => {
    const { data, error } = await client().rpc("get_account_context");
    strictEqual(error, null);
    strictEqual(data.account_type, "property_admin");
    strictEqual(data.organization_id, "17701fe0-575d-471d-aaa6-c72af3b05d1b");
  });
  test("clients cannot read the global administration endpoint", async () => {
    const { error } = await client().rpc("general_admin_overview");
    strictEqual(Boolean(error), true);
  });
  test("public account setup rejects general administrator assignment", async () => {
    const { error } = await client().rpc("complete_client_setup", { _account_type: "general_admin" });
    strictEqual(Boolean(error), true);
  });
  test("clients cannot read another customer's portfolio", async () => {
    const { data, error } = await client().from("properties").select("id").eq("organization_id", "b7e3056f-8b48-422b-bff4-63c01f815109");
    strictEqual(error, null); strictEqual(data?.length, 0);
  });
  test("legacy client portfolio retains all fourteen properties", async () => {
    const { data, error } = await client().from("properties").select("id").eq("organization_id", "17701fe0-575d-471d-aaa6-c72af3b05d1b");
    strictEqual(error, null); strictEqual(data?.length, 14);
  });
  test("client cannot join another organization through the former self-insert policy", async () => {
    const { error } = await client().from("organization_members").insert({ user_id: "50c00219-973c-42b4-8bfb-fb923786da3d", organization_id: "b7e3056f-8b48-422b-bff4-63c01f815109", role: "admin" });
    strictEqual(error?.code, "42501");
  });
});