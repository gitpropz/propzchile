import { describe, expect, test } from "bun:test";
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
    expect(groups.map((g) => [g.row.unit.label, ...g.includedUnits.map((u) => u.label)].join(", "))).toEqual(["2002, E1010, E1020"]);
    expect(rows.length).toBe(3);
    expect(rows.reduce((sum, r) => sum + r.unit.base_rent_amount, 0)).toBe(500000);
  });
  test("also includes a zero-rent unit in a house", () => {
    expect(groupDashboardUnits([row("Casa", { unit_type: "house" }), row("E1010")])[0]?.includedUnits.map((u) => u.id)).toEqual(["E1010"]);
  });
  test("keeps paid-rent, vacant, other-property and different-tenant units separate", () => {
    const rows = [row("2002", { unit_type: "apartment" }), row("paid", { base_rent_amount: 10000 }), row("vacant", { rent_active: false }), row("other", { property_id: "property-b" }), row("tenant", { tenant_rut: "99.999.999-9" })];
    expect(groupDashboardUnits(rows).length).toBe(5);
  });
  test("matches formatted RUT or a nonempty normalized name when RUT is unavailable", () => {
    const groups = groupDashboardUnits([row("2002", { unit_type: "apartment" }), row("rut", { tenant_rut: "123456789" }), row("name", { tenant_rut: null, tenant_name: "  ILAN  " })]);
    expect(groups[0]?.includedUnits.map((u) => u.id)).toEqual(["rut", "name"]);
  });
  test("does not group unidentified tenants or guess between multiple homes", () => {
    expect(groupDashboardUnits([row("home", { unit_type: "house", tenant_name: null, tenant_rut: null }), row("unknown", { tenant_name: null, tenant_rut: null })]).length).toBe(2);
    expect(groupDashboardUnits([row("a", { unit_type: "apartment" }), row("b", { unit_type: "house" }), row("parking")]).length).toBe(3);
  });
  test("keeps historical charges, payments and review flags visible", () => {
    const charge = row("charge"); charge.payment = { amount: 1000, amount_paid: 0 };
    const paid = row("paid"); paid.payment = { amount: 0, amount_paid: 1000 };
    const review = row("review"); review.payment = { amount: 0, amount_paid: 0, needs_review: true };
    expect(groupDashboardUnits([row("home", { unit_type: "house" }), charge, paid, review]).length).toBe(4);
  });
});