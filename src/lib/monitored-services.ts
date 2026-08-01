import type { Database } from "@/integrations/supabase/types";

export type MonitoredService = Database["public"]["Tables"]["monitored_services"]["Row"];
export type ServiceReading = Database["public"]["Tables"]["service_readings"]["Row"];

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

/** Compañías frecuentes en Chile, como sugerencia (el campo es libre). */
export const PROVIDER_SUGGESTIONS: Record<ServiceType, string[]> = {
  agua: ["Aguas Andinas", "Esval", "Essbio", "Aguas del Valle", "Nuevosur"],
  luz: ["Enel", "CGE", "Chilquinta", "Saesa", "Frontel"],
  gas: ["Metrogas", "Lipigas", "Abastible", "Gasco", "GasValpo"],
  gastos_comunes: ["Comunidad Edificio", "Administración externa"],
  otro: ["Servipag", "Otro proveedor"],
};

export function serviceTypeLabel(value: string): string {
  return SERVICE_TYPE_LABELS[value as ServiceType] ?? value;
}

/** Normaliza un identificador de servicio para comparaciones. */
export function normalizeServiceIdentifier(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/[^a-zA-Z0-9]/g, "").replace(/^0+/, "").toLowerCase();
}

/* ------------------------------------------------------------------ */
/* Períodos                                                            */
/* ------------------------------------------------------------------ */

/** Período estándar del monitoreo: "YYYY-MM". */
export function periodKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

const MONTHS_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function periodLabelEs(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return `${MONTHS_ES[m - 1]} ${y}`;
}

export function shiftPeriod(period: string, delta: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return periodKey(d);
}

/** Últimos N períodos, del más reciente al más antiguo. */
export function recentPeriods(count = 12, from = periodKey()): string[] {
  return Array.from({ length: count }, (_, i) => shiftPeriod(from, -i));
}

/* ------------------------------------------------------------------ */
/* Estados estándar de la plataforma (no configurables)                */
/* ------------------------------------------------------------------ */

export type ServiceStatus = "normal" | "over" | "critical" | "unknown";

/** Umbrales fijos en meses de deuda. */
export const MONTHS_DUE_OVER_THRESHOLD = 1.5;
export const MONTHS_DUE_CRITICAL_THRESHOLD = 2.5;

export const SERVICE_STATUS_META: Record<
  ServiceStatus,
  { label: string; dot: string; className: string; rank: number }
> = {
  critical: {
    label: "Crítico",
    dot: "bg-destructive",
    className: "bg-destructive/15 text-destructive border-destructive/30",
    rank: 3,
  },
  over: {
    label: "Sobre umbral",
    dot: "bg-warning",
    className: "bg-warning/15 text-warning border-warning/30",
    rank: 2,
  },
  unknown: {
    label: "Sin información",
    dot: "bg-muted-foreground/50",
    className: "bg-muted text-muted-foreground border-border",
    rank: 1,
  },
  normal: {
    label: "Normal",
    dot: "bg-success",
    className: "bg-success/15 text-success border-success/30",
    rank: 0,
  },
};

/** Meses de deuda = monto adeudado ÷ valor mensual esperado. */
export function monthsDue(
  amountDue: number | null | undefined,
  expectedAmount: number | null | undefined,
): number | null {
  if (amountDue == null) return null;
  const expected = expectedAmount == null ? null : Number(expectedAmount);
  if (!expected || expected <= 0) return null;
  return Number(amountDue) / expected;
}

export function statusFromMonthsDue(months: number | null | undefined): ServiceStatus {
  if (months == null || !Number.isFinite(months)) return "unknown";
  if (months >= MONTHS_DUE_CRITICAL_THRESHOLD) return "critical";
  if (months >= MONTHS_DUE_OVER_THRESHOLD) return "over";
  return "normal";
}

export function formatMonthsDue(months: number | null | undefined): string {
  if (months == null || !Number.isFinite(months)) return "Sin información";
  return `${months.toFixed(1).replace(".", ",")} meses`;
}

/* ------------------------------------------------------------------ */
/* Origen del dato                                                     */
/* ------------------------------------------------------------------ */

export type ReadingSource = "servipag" | "manual" | "correo" | "otro";

export const READING_SOURCE_LABELS: Record<ReadingSource, string> = {
  servipag: "Servipag",
  manual: "Manual",
  correo: "Correo",
  otro: "Otro",
};

export const READING_SOURCE_OPTIONS: { value: ReadingSource; label: string }[] = (
  Object.keys(READING_SOURCE_LABELS) as ReadingSource[]
).map((v) => ({ value: v, label: READING_SOURCE_LABELS[v] }));

export function readingSourceLabel(v: string | null | undefined): string {
  return READING_SOURCE_LABELS[(v ?? "otro") as ReadingSource] ?? v ?? "Otro";
}

/** Canales de actualización. Preparado para Gmail/Outlook/casilla dedicada. */
export type UpdateChannel = "upload" | "gmail" | "outlook" | "mailbox" | "manual";

export const UPDATE_CHANNEL_LABELS: Record<UpdateChannel, string> = {
  upload: "Carga de documentos",
  gmail: "Gmail",
  outlook: "Outlook",
  mailbox: "Casilla dedicada",
  manual: "Ingreso manual",
};

/* ------------------------------------------------------------------ */
/* Evaluación por servicio y por propiedad                             */
/* ------------------------------------------------------------------ */

export type ServiceEvaluation = {
  service: MonitoredService;
  reading: ServiceReading | null;
  amountDue: number | null;
  monthsDue: number | null;
  status: ServiceStatus;
  source: string | null;
};

export function evaluateService(
  service: MonitoredService,
  reading: ServiceReading | null | undefined,
): ServiceEvaluation {
  const amountDue = reading ? Number(reading.amount_due) : null;
  const months = monthsDue(amountDue, service.expected_amount);
  return {
    service,
    reading: reading ?? null,
    amountDue,
    monthsDue: months,
    status: reading ? statusFromMonthsDue(months) : "unknown",
    source: reading?.source ?? null,
  };
}

/** Índice de lecturas por servicio para un período dado. */
export function readingsByService(readings: ServiceReading[], period: string): Map<string, ServiceReading> {
  const map = new Map<string, ServiceReading>();
  for (const r of readings) {
    if (r.period !== period) continue;
    map.set(r.service_id, r);
  }
  return map;
}

export type PropertyMonitoring = {
  propertyId: string;
  services: ServiceEvaluation[];
  status: ServiceStatus;
  totalDue: number;
  missing: number;
};

/** El estado de la propiedad es el peor estado de cualquiera de sus servicios activos. */
export function evaluateProperty(
  propertyId: string,
  services: MonitoredService[],
  readingIndex: Map<string, ServiceReading>,
): PropertyMonitoring {
  const evals = services
    .filter((s) => s.active && s.property_id === propertyId)
    .map((s) => evaluateService(s, readingIndex.get(s.id)));
  let status: ServiceStatus = "normal";
  for (const e of evals) {
    if (SERVICE_STATUS_META[e.status].rank > SERVICE_STATUS_META[status].rank) status = e.status;
  }
  return {
    propertyId,
    services: evals,
    status: evals.length === 0 ? "unknown" : status,
    totalDue: evals.reduce((sum, e) => sum + (e.amountDue ?? 0), 0),
    missing: evals.filter((e) => e.status === "unknown").length,
  };
}

export type Coverage = {
  expected: number;
  automatic: number;
  manual: number;
  pending: number;
  pct: number;
};

/** Cobertura del monitoreo del mes sobre los servicios activos. */
export function computeCoverage(
  services: MonitoredService[],
  readingIndex: Map<string, ServiceReading>,
): Coverage {
  const active = services.filter((s) => s.active);
  let automatic = 0;
  let manual = 0;
  for (const s of active) {
    const r = readingIndex.get(s.id);
    if (!r) continue;
    if (r.source === "manual" || r.source === "correo" || r.source === "otro") manual += 1;
    else automatic += 1;
  }
  const expected = active.length;
  const pending = expected - automatic - manual;
  return {
    expected,
    automatic,
    manual,
    pending,
    pct: expected > 0 ? Math.round(((automatic + manual) / expected) * 100) : 0,
  };
}

/* ------------------------------------------------------------------ */
/* Identificación automática (Servipag / OCR / correo)                 */
/* ------------------------------------------------------------------ */

export type DetectedService = {
  identifier?: string | null;
  /** Otros números leídos del documento (medidor, contrato, rol). */
  identifiers?: (string | null | undefined)[];
  serviceType?: string | null;
  provider?: string | null;
  amount: number;
  period?: string | null;
  documentRef?: string | null;
  raw?: unknown;
};

export type DetectedMatch = {
  detected: DetectedService;
  service: MonitoredService | null;
  reason: "identifier" | "none";
};

/** Mínimo de dígitos para aceptar una coincidencia parcial (sufijo). */
const MIN_PARTIAL_IDENTIFIER_LENGTH = 5;

function identifierMatches(configured: string, candidate: string): boolean {
  if (!configured || !candidate) return false;
  if (configured === candidate) return true;
  const shortest = Math.min(configured.length, candidate.length);
  if (shortest < MIN_PARTIAL_IDENTIFIER_LENGTH) return false;
  return configured.endsWith(candidate) || candidate.endsWith(configured);
}

/**
 * Asocia un servicio detectado con la configuración de la propiedad usando
 * ESTRICTAMENTE el número identificador (cliente/medidor/contrato/rol).
 * El proveedor, el alias y el vencimiento son solo información de apoyo: no
 * generan asociación por sí solos.
 */
export function matchDetectedService(
  detected: DetectedService,
  services: MonitoredService[],
): DetectedMatch {
  const active = services.filter((s) => s.active);
  const candidates = [detected.identifier, ...(detected.identifiers ?? [])]
    .map((v) => normalizeServiceIdentifier(v))
    .filter((v) => v.length > 0);
  if (candidates.length === 0) return { detected, service: null, reason: "none" };

  const hits = active.filter((s) => {
    const conf = normalizeServiceIdentifier(s.service_identifier);
    return conf.length > 0 && candidates.some((c) => identifierMatches(conf, c));
  });
  // Exigimos una única coincidencia: si hay ambigüedad, se revisa a mano.
  if (hits.length === 1) return { detected, service: hits[0], reason: "identifier" };
  return { detected, service: null, reason: "none" };
}

