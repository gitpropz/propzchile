import { describe, test } from "node:test";
import { deepStrictEqual, strictEqual } from "node:assert";
import { dashboardFilterScope } from "./dashboard-filter-scope";

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