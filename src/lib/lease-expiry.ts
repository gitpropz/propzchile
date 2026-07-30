/**
 * Seguimiento de vencimiento de contratos de arriendo.
 *
 * Las cartolas concilian pagos por período; aquí calculamos el estado de
 * vigencia del contrato a partir de `rent_end_date` (fecha de término).
 */

export type LeaseStatus = "expired" | "expiring" | "active" | "open-ended" | "vacant";

/** Días que definen "por vencer" (ventana de aviso anticipado). */
export const EXPIRY_WARNING_DAYS = 30;

export const LEASE_STATUS_META: Record<
  LeaseStatus,
  { label: string; className: string; rank: number }
> = {
  expired: {
    label: "Vencido",
    className: "bg-destructive/15 text-destructive border-destructive/30",
    rank: 3,
  },
  expiring: {
    label: "Por vencer",
    className: "bg-warning/15 text-warning border-warning/30",
    rank: 2,
  },
  active: {
    label: "Vigente",
    className: "bg-success/15 text-success border-success/30",
    rank: 0,
  },
  open-ended: {
    label: "Indefinido",
    className: "bg-info/15 text-info border-info/30",
    rank: 1,
  },
  vacant: {
    label: "Vacante",
    className: "bg-muted text-muted-foreground border-border",
    rank: 0,
  },
};

/** Días faltantes hasta la fecha de término (negativos = ya vencido). */
export function daysUntilExpiry(
  rentEndDate: string | null | undefined,
  today = new Date(),
): number | null {
  if (!rentEndDate) return null;
  // rent_end_date es un date (sin zona horaria). Lo leemos como piezas para no
  // depender del huso horario, igual que formatDate.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(rentEndDate);
  if (!m) return null;
  const end = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((end.getTime() - todayMid.getTime()) / 86_400_000);
}

export type LeaseEvaluation = {
  status: LeaseStatus;
  /** Días restantes (positivos) o vencido hace N días (negativos). null = N/A. */
  daysLeft: number | null;
  /** Fecha de término en formato dd-mm-yyyy, o null. */
  endLabel: string | null;
};

/**
 * Evalúa la vigencia de un contrato.
 * - `rentActive=false` → vacant
 * - sin `rent_end_date` → open-ended (arriendo indefinido)
 * - vencido → expired
 * - vence dentro de EXPIRY_WARNING_DAYS → expiring
 * - resto → active
 */
export function evaluateLease(
  rentActive: boolean | null | undefined,
  rentEndDate: string | null | undefined,
  today = new Date(),
): LeaseEvaluation {
  if (!rentActive) {
    return { status: "vacant", daysLeft: null, endLabel: null };
  }
  if (!rentEndDate) {
    return { status: "open-ended", daysLeft: null, endLabel: null };
  }
  const days = daysUntilExpiry(rentEndDate, today);
  const status: LeaseStatus =
    days == null ? "open-ended" : days < 0 ? "expired" : days <= EXPIRY_WARNING_DAYS ? "expiring" : "active";
  return { status, daysLeft: days, endLabel: rentEndDate };
}

/** Formatea una fecha ISO (YYYY-MM-DD) a dd-mm-yyyy sin desplazamiento de huso. */
export function formatLeaseDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** Descripción corta del estado para tarjetas/listados. */
export function leaseDaysLabel(daysLeft: number | null): string {
  if (daysLeft == null) return "";
  if (daysLeft === 0) return "Vence hoy";
  if (daysLeft > 0) {
    if (daysLeft === 1) return "Vence mañana";
    if (daysLeft < 30) return `Vence en ${daysLeft} días`;
    return `Vence en ${Math.round(daysLeft / 30)} meses`;
  }
  const abs = Math.abs(daysLeft);
  if (abs === 1) return "Vencido hace 1 día";
  if (abs < 30) return `Vencido hace ${abs} días`;
  return `Vencido hace ${Math.round(abs / 30)} meses`;
}
