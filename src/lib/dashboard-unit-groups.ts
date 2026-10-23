type GroupableUnit = {
  id: string;
  property_id: string;
  label: string;
  unit_type: string;
  rent_active: boolean;
  base_rent_amount: number | null;
  tenant_name: string | null;
  tenant_rut: string | null;
  tenant_ruts?: string[];
};

type GroupableRow = {
  unit: GroupableUnit;
  status: string;
  payment: { amount: number | null; amount_paid: number | null; needs_review?: boolean | null } | null;
};

function tenantRuts(unit: GroupableUnit) {
  return [...(unit.tenant_ruts ?? []), unit.tenant_rut ?? ""]
    .map((rut) => rut.replace(/[^0-9k]/gi, "").toUpperCase())
    .filter(Boolean);
}

function sameTenant(a: GroupableUnit, b: GroupableUnit) {
  const ar = tenantRuts(a);
  const br = tenantRuts(b);
  if (ar.length && br.length) return ar.some((rut) => br.includes(rut));
  const normalize = (name: string | null) => (name ?? "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
  const name = normalize(a.tenant_name);
  return Boolean(name) && name === normalize(b.tenant_name);
}

const isHome = (unit: GroupableUnit) => unit.unit_type === "apartment" || unit.unit_type === "house";

/** Presentation only: original rows remain untouched for totals and payment actions. */
export function groupDashboardUnits<T extends GroupableRow>(rows: T[]): { row: T; includedUnits: T["unit"][] }[] {
  const included = new Map<string, T["unit"][]>();
  const hidden = new Set<string>();
  for (const row of rows) {
    const u = row.unit;
    if (isHome(u) || !u.rent_active || row.status === "inactive" || u.base_rent_amount !== 0) continue;
    // A historical charge, payment or pending review must remain individually visible.
    if (Number(row.payment?.amount ?? 0) !== 0 || Number(row.payment?.amount_paid ?? 0) !== 0 || row.payment?.needs_review) continue;
    const homes = rows.filter((candidate) =>
      isHome(candidate.unit) && candidate.unit.rent_active && candidate.status !== "inactive" &&
      candidate.unit.property_id === u.property_id && sameTenant(candidate.unit, u),
    );
    // Do not guess an association when several homes share this tenant.
    if (homes.length !== 1) continue;
    const home = homes[0];
    if (!home) continue;
    included.set(home.unit.id, [...(included.get(home.unit.id) ?? []), u]);
    hidden.add(u.id);
  }
  return rows.filter((row) => !hidden.has(row.unit.id)).map((row) => ({ row, includedUnits: included.get(row.unit.id) ?? [] }));
}