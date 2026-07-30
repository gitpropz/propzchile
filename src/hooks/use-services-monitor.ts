import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  computeCoverage,
  evaluateProperty,
  evaluateService,
  periodKey,
  readingsByService,
  type MonitoredService,
  type PropertyMonitoring,
  type ServiceReading,
  type ServiceStatus,
} from "@/lib/monitored-services";

/**
 * Datos de monitoreo de servicios del mes en curso para toda la organización.
 * Solo lectura/agrupación: no cambia ninguna regla de cálculo existente.
 */
export function useServicesMonitor(orgId: string | undefined) {
  const period = periodKey();

  const servicesQuery = useQuery({
    queryKey: ["dash-monitored-services", orgId],
    queryFn: async (): Promise<MonitoredService[]> => {
      const { data, error } = await supabase
        .from("monitored_services")
        .select("*")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const readingsQuery = useQuery({
    queryKey: ["dash-service-readings", orgId, period],
    queryFn: async (): Promise<ServiceReading[]> => {
      const { data, error } = await supabase
        .from("service_readings")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("period", period);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  const services = servicesQuery.data ?? [];
  const index = readingsByService(readingsQuery.data ?? [], period);
  const coverage = computeCoverage(services, index);

  const byProperty = new Map<string, PropertyMonitoring>();
  for (const pid of new Set(
    services.filter((s) => s.active && s.property_id).map((s) => s.property_id as string),
  )) {
    byProperty.set(pid, evaluateProperty(pid, services, index));
  }

  // Conteo por servicio (no por propiedad), para el resumen ejecutivo.
  const counts: Record<ServiceStatus, number> = { normal: 0, over: 0, critical: 0, unknown: 0 };
  for (const s of services.filter((s) => s.active)) {
    counts[evaluateService(s, index.get(s.id)).status] += 1;
  }

  async function refetch() {
    await Promise.all([servicesQuery.refetch(), readingsQuery.refetch()]);
  }

  return {
    period,
    services,
    index,
    coverage,
    counts,
    byProperty,
    isLoading: servicesQuery.isLoading || readingsQuery.isLoading,
    refetch,
  };
}
