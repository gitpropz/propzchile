import type { Database } from "@/integrations/supabase/types";

export type MonitoredService = Database["public"]["Tables"]["monitored_services"]["Row"];

export type ServiceType = "agua" | "luz" | "gas" | "gastos_comunes" | "otro";

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  gastos_comunes: "Gastos comunes",
  otro: "Otros",
};

export const SERVICE_TYPE_OPTIONS: { value: ServiceType; label: string }[] = (
  Object.keys(SERVICE_TYPE_LABELS) as ServiceType[]
).map((v) => ({ value: v, label: SERVICE_TYPE_LABELS[v] }));

/** Etiqueta del identificador según el tipo de servicio. */
export const SERVICE_IDENTIFIER_HINT: Record<ServiceType, string> = {
  agua: "N° de cliente o medidor",
  luz: "N° de cliente o medidor",
  gas: "N° de cliente o contrato",
  gastos_comunes: "N° de unidad o contrato",
  otro: "N° de cliente o contrato",
};

export const DEFAULT_ALERT_THRESHOLD_PCT = 150;

export function serviceTypeLabel(value: string): string {
  return SERVICE_TYPE_LABELS[value as ServiceType] ?? value;
}

/** Normaliza un identificador de servicio para comparaciones (futura lectura de Servipag). */
export function normalizeServiceIdentifier(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[^a-zA-Z0-9]/g, "").replace(/^0+/, "").toLowerCase();
}

export type ServiceAlertLevel = "ok" | "warning" | "alert" | "unknown";

export type ServiceEvaluation = {
  level: ServiceAlertLevel;
  label: string;
  /** Monto máximo aceptado antes de generar alerta. */
  thresholdAmount: number | null;
  /** Variación porcentual del monto detectado respecto al esperado. */
  variationPct: number | null;
};

/**
 * Compara un monto detectado con el valor esperado del servicio.
 * Es la función que usará la etapa de lectura automática de Servipag.
 */
export function evaluateServiceAmount(
  service: Pick<MonitoredService, "expected_amount" | "alert_threshold_pct">,
  detectedAmount: number | null | undefined,
): ServiceEvaluation {
  const expected = service.expected_amount == null ? null : Number(service.expected_amount);
  const pct = Number(service.alert_threshold_pct ?? DEFAULT_ALERT_THRESHOLD_PCT);
  const thresholdAmount = expected != null ? (expected * pct) / 100 : null;

  if (detectedAmount == null || expected == null || expected <= 0) {
    return { level: "unknown", label: "Sin datos", thresholdAmount, variationPct: null };
  }

  const variationPct = ((detectedAmount - expected) / expected) * 100;
  if (thresholdAmount != null && detectedAmount > thresholdAmount) {
    return { level: "alert", label: "Sobre el umbral", thresholdAmount, variationPct };
  }
  if (detectedAmount > expected) {
    return { level: "warning", label: "Sobre lo esperado", thresholdAmount, variationPct };
  }
  return { level: "ok", label: "Dentro de lo esperado", thresholdAmount, variationPct };
}

export const SERVICE_ALERT_CLASS: Record<ServiceAlertLevel, string> = {
  ok: "bg-success/15 text-success border-success/30",
  warning: "bg-warning/15 text-warning border-warning/30",
  alert: "bg-destructive/15 text-destructive border-destructive/30",
  unknown: "bg-muted text-muted-foreground border-border",
};

/**
 * Etapa siguiente (Servipag): dado un servicio detectado en un pantallazo/PDF,
 * encuentra la configuración de la unidad a la que corresponde usando el
 * identificador (número de cliente/medidor) y, como respaldo, el tipo + proveedor.
 */
export type DetectedService = {
  identifier?: string | null;
  serviceType?: string | null;
  provider?: string | null;
  amount: number;
  period?: string | null;
};

export function matchDetectedService(
  detected: DetectedService,
  services: MonitoredService[],
): MonitoredService | null {
  const active = services.filter((s) => s.active);
  const id = normalizeServiceIdentifier(detected.identifier);
  if (id) {
    const hit = active.find((s) => normalizeServiceIdentifier(s.service_identifier) === id);
    if (hit) return hit;
  }
  if (detected.serviceType) {
    const sameType = active.filter((s) => s.service_type === detected.serviceType);
    if (sameType.length === 1) return sameType[0];
    if (detected.provider) {
      const p = detected.provider.toLocaleLowerCase("es");
      const hit = sameType.find((s) => (s.provider ?? "").toLocaleLowerCase("es") === p);
      if (hit) return hit;
    }
  }
  return null;
}
