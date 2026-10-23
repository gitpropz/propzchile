import { describe, test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { groupDashboardUnits } from "./dashboard-unit-groups";

function row(id: string, changes = {}) {
  return {
    unit: { id, property_id: "property-a", label: id, unit_type: "parking", rent_active: true, base_rent_amount: 0, tenant_name: "Ilan", tenant_rut: "12.345.678-9", ...changes },
    status: "paid",
    payment: null as { amount: number; amount_paid: number; needs_review?: boolean } | null,
  };
}

describe("Dashboard included units", () => {
  test("includes two zero-rent parking units alongside apartment 2002 without mutating rows", () => {
    const rows = [row("2002", { unit_type: "apartment", base_rent_amount: 500000 }), row("E1010"), row("E1020")];
    const groups = groupDashboardUnits(rows);
    deepStrictEqual(groups.map((g) => [g.row.unit.label, ...g.includedUnits.map((u) => u.label)].join(", ")), ["2002, E1010, E1020"]);
    strictEqual(rows.length, 3);
    strictEqual(rows.reduce((sum, r) => sum + r.unit.base_rent_amount, 0), 500000);
  });
  test("also includes a zero-rent unit in a house", () => {
    deepStrictEqual(groupDashboardUnits([row("Casa", { unit_type: "house" }), row("E1010")])[0]?.includedUnits.map((u) => u.id), ["E1010"]);
  });
  test("keeps paid-rent, vacant, other-property and different-tenant units separate", () => {
    const rows = [row("2002", { unit_type: "apartment" }), row("paid", { base_rent_amount: 10000 }), row("vacant", { rent_active: false }), row("other", { property_id: "property-b" }), row("tenant", { tenant_rut: "99.999.999-9" })];
    strictEqual(groupDashboardUnits(rows).length, 5);
  });
  test("matches formatted RUT or a nonempty normalized name when RUT is unavailable", () => {
    const groups = groupDashboardUnits([row("2002", { unit_type: "apartment" }), row("rut", { tenant_rut: "123456789" }), row("name", { tenant_rut: null, tenant_name: "  ILAN  " })]);
    deepStrictEqual(groups[0]?.includedUnits.map((u) => u.id), ["rut", "name"]);
  });
  test("does not group unidentified tenants or guess between multiple homes", () => {
    strictEqual(groupDashboardUnits([row("home", { unit_type: "house", tenant_name: null, tenant_rut: null }), row("unknown", { tenant_name: null, tenant_rut: null })]).length, 2);
    strictEqual(groupDashboardUnits([row("a", { unit_type: "apartment" }), row("b", { unit_type: "house" }), row("parking")]).length, 3);
  });
  test("keeps historical charges, payments and review flags visible", () => {
    const charge = row("charge"); charge.payment = { amount: 1000, amount_paid: 0 };
    const paid = row("paid"); paid.payment = { amount: 0, amount_paid: 1000 };
    const review = row("review"); review.payment = { amount: 0, amount_paid: 0, needs_review: true };
    strictEqual(groupDashboardUnits([row("home", { unit_type: "house" }), charge, paid, review]).length, 4);
  });
});