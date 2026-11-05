import { describe, test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { dashboardFilterScope, dashboardServicesScope } from "./dashboard-filter-scope";

const rows = [
  { unit: { id: "home" }, expected: 500000, confirmed: 400000, previousConfirmed: 300000 },
  { unit: { id: "included-parking" }, expected: 0, confirmed: 0, previousConfirmed: 10000 },
  { unit: { id: "other-home" }, expected: 800000, confirmed: 800000, previousConfirmed: 700000 },
];
const groups = [
  { row: rows[0], includedUnits: [rows[1].unit] },
  { row: rows[2], includedUnits: [] },
];
const sum = (scope: typeof rows, key: "expected" | "confirmed" | "previousConfirmed") =>
  scope.reduce((total, row) => total + row[key], 0);

describe("Dashboard filtered financial scope", () => {
  test("general filter limits monthly flow and comparison to visible units, including grouped history", () => {
    const scope = dashboardFilterScope(rows, groups.slice(0, 1));
    strictEqual(sum(scope, "expected"), 500000);
    strictEqual(sum(scope, "confirmed"), 400000);
    strictEqual(sum(scope, "previousConfirmed"), 310000);
    deepStrictEqual(scope.map((row) => row.unit.id), ["home", "included-parking"]);
  });
  test("attention filter uses only selected cases for current and previous amounts", () => {
    const scope = dashboardFilterScope(rows, groups.slice(1));
    strictEqual(sum(scope, "expected"), 800000);
    strictEqual(sum(scope, "confirmed"), 800000);
    strictEqual(sum(scope, "previousConfirmed"), 700000);
  });
  test("clearing filters restores all original totals without losing included units", () => {
    const scope = dashboardFilterScope(rows, groups);
    strictEqual(sum(scope, "expected"), 1300000);
    strictEqual(sum(scope, "confirmed"), 1200000);
    strictEqual(sum(scope, "previousConfirmed"), 1010000);
    deepStrictEqual(scope, rows);
  });
  test("no matches produce zero rather than reverting to global totals", () => {
    const scope = dashboardFilterScope(rows, []);
    strictEqual(sum(scope, "expected"), 0);
    strictEqual(sum(scope, "confirmed"), 0);
    strictEqual(sum(scope, "previousConfirmed"), 0);
  });
});

const svc = (id: string, propertyId: string, expected = 20000) =>
  ({ id, property_id: propertyId, active: true, expected_amount: expected }) as any;
const reading = (serviceId: string, amountDue: number, source = "servipag") =>
  ({ service_id: serviceId, amount_due: amountDue, source, period: "2026-11" }) as any;

describe("Dashboard filtered services scope", () => {
  const services = [
    svc("s1", "prop-a"), // lectura 0 → normal
    svc("s2", "prop-a"), // deuda 3 meses → critical
    svc("s3", "prop-b"), // sin lectura → unknown
  ];
  const index = new Map<string, any>([
    ["s1", reading("s1", 0)],
    ["s2", reading("s2", 60000)],
  ]);

  test("filtering to one property counts only its services and coverage", () => {
    const { counts, coverage } = dashboardServicesScope(services, index, new Set(["prop-a"]));
    deepStrictEqual(counts, { normal: 1, over: 0, critical: 1, unknown: 0 });
    strictEqual(coverage.expected, 2);
    strictEqual(coverage.pending, 0);
    strictEqual(coverage.pct, 100);
  });
  test("all properties in scope reproduces the global totals", () => {
    const { counts, coverage } = dashboardServicesScope(
      services,
      index,
      new Set(["prop-a", "prop-b"]),
    );
    deepStrictEqual(counts, { normal: 1, over: 0, critical: 1, unknown: 1 });
    strictEqual(coverage.expected, 3);
    strictEqual(coverage.pending, 1);
  });
  test("no property in scope yields zeros, not global totals", () => {
    const { counts, coverage } = dashboardServicesScope(services, index, new Set());
    deepStrictEqual(counts, { normal: 0, over: 0, critical: 0, unknown: 0 });
    strictEqual(coverage.expected, 0);
    strictEqual(coverage.pct, 0);
  });
});