import type { Database } from "@/integrations/supabase/types";

export type RentPayment = Database["public"]["Tables"]["rent_payments"]["Row"];
export type PaymentStatus = "paid" | "partial" | "upcoming" | "warn" | "late" | "inactive";

export const MONTHS_ES = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export const MONTHS_ES_LONG = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export function periodLabel(year: number, month: number): string {
  return `${MONTHS_ES_LONG[month - 1]} ${year}`;
}

export function shortPeriodLabel(year: number, month: number): string {
  return `${MONTHS_ES[month - 1]} ${String(year).slice(2)}`;
}

/** Add months to a {year,month} tuple (1-indexed month). */
export function addMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const idx = (year * 12 + (month - 1)) + delta;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

/** Local YYYY-MM-DD for a Date. */
export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Difference in whole days: today - dueDate. Positive means overdue. */
export function daysSinceDue(dueDate: string, today = new Date()): number {
  const [y, m, d] = dueDate.split("-").map(Number);
  const due = new Date(y, (m ?? 1) - 1, d ?? 1);
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((t.getTime() - due.getTime()) / 86_400_000);
}

export function computeStatus(
  payment: Pick<RentPayment, "status" | "due_date"> | null,
  opts: { rentActive: boolean; today?: Date } = { rentActive: true },
): PaymentStatus {
  if (!opts.rentActive) return "inactive";
  if (payment?.status === "confirmed") return "paid";
  if (payment?.status === "partial") return "partial";
  if (!payment) return "upcoming";
  const overdue = daysSinceDue(payment.due_date, opts.today);
  if (overdue < 0) return "upcoming";
  if (overdue === 0) return "warn"; // due today but unpaid → amber
  if (overdue <= 5) return "warn";
  return "late";
}

export const STATUS_META: Record<PaymentStatus, { label: string; dot: string; badge: string }> = {
  paid: {
    label: "Al día",
    dot: "bg-success",
    badge: "bg-success/15 text-success border-success/30",
  },
  partial: {
    label: "Pago parcial",
    dot: "bg-info",
    badge: "bg-info/15 text-info border-info/30",
  },
  upcoming: {
    label: "Por vencer",
    dot: "bg-muted-foreground/60",
    badge: "bg-muted text-muted-foreground border-border",
  },
  warn: {
    label: "Atrasado 1–5 días",
    dot: "bg-warning",
    badge: "bg-warning/15 text-warning border-warning/30",
  },
  late: {
    label: "Atrasado +5 días",
    dot: "bg-destructive",
    badge: "bg-destructive/15 text-destructive border-destructive/30",
  },
  inactive: {
    label: "Sin arriendo activo",
    dot: "bg-muted",
    badge: "bg-muted text-muted-foreground border-border",
  },
};
