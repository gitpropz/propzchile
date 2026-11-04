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

import {
  computeCoverage,
  evaluateService,
  type Coverage,
  type MonitoredService,
  type ServiceReading,
  type ServiceStatus,
} from "./monitored-services";

/**
 * Conteos y cobertura de servicios limitados a las propiedades visibles
 * según el filtro del Dashboard. Sin filtro, propertyIds contiene todas
 * las propiedades y el resultado equivale al total global.
 */
export function dashboardServicesScope(
  services: MonitoredService[],
  readingIndex: Map<string, ServiceReading>,
  propertyIds: Set<string>,
): { counts: Record<ServiceStatus, number>; coverage: Coverage } {
  const scoped = services.filter(
    (s) => s.active && s.property_id != null && propertyIds.has(s.property_id),
  );
  const counts: Record<ServiceStatus, number> = { normal: 0, over: 0, critical: 0, unknown: 0 };
  for (const s of scoped) {
    counts[evaluateService(s, readingIndex.get(s.id)).status] += 1;
  }
  return { counts, coverage: computeCoverage(scoped, readingIndex) };
}