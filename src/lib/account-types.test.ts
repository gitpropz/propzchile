import { describe, test } from "node:test";
import { strictEqual, deepStrictEqual } from "node:assert";
import { CLIENT_TYPES, isClientType, accountDestination } from "./account-types";
describe("Propz account rules", () => {
  test("public registration offers exactly the two subscribing customer types", () => {
    deepStrictEqual(CLIENT_TYPES, ["property_admin", "independent_owner"]);
  });
  test("general administration cannot be selected as a public customer type", () => {
    strictEqual(isClientType("general_admin"), false);
    strictEqual(isClientType("superadmin"), false);
  });
  test("property administrators retain the existing dashboard", () => {
    strictEqual(accountDestination("property_admin"), "/dashboard");
  });
  test("independent owners retain the existing dashboard", () => {
    strictEqual(accountDestination("independent_owner"), "/dashboard");
  });
  test("general administrators enter global administration instead of a client portfolio", () => {
    strictEqual(accountDestination("general_admin"), "/admin");
  });
  test("accounts without a customer type must complete identification", () => {
    strictEqual(accountDestination(null), "/account-setup");
  });
});