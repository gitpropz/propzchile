/** Resolve visible cards back to original accounting rows, including grouped units. */
export function dashboardFilterScope<T extends { unit: { id: string } }>(
  rows: T[],
  visibleGroups: { row: T; includedUnits: { id: string }[] }[],
): T[] {
  const ids = new Set(visibleGroups.flatMap(({ row, includedUnits }) => [
    row.unit.id,
    ...includedUnits.map((unit) => unit.id),
  ]));
  return rows.filter((row) => ids.has(row.unit.id));
}