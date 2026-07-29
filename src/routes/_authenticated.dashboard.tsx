import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Eye, FileUp, Plus, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCLP, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addManualAllocation, clearAllocations, ensureRentPayment } from "@/lib/rent-allocations";
import {
  MONTHS_ES,
  STATUS_META,
  addMonths,
  computeStatus,
  daysSinceDue,
  periodLabel,
  shortPeriodLabel,
  toISODate,
  type PaymentStatus,
  type RentPayment,
} from "@/lib/rent-status";
import type { Database } from "@/integrations/supabase/types";

type Unit = Database["public"]["Tables"]["rentable_units"]["Row"];
type Property = Pick<Database["public"]["Tables"]["properties"]["Row"], "id" | "name" | "address" | "comuna">;
type Bill = Database["public"]["Tables"]["unit_bills"]["Row"];

const BILL_LABELS: Record<string, string> = {
  gastos_comunes: "Gastos comunes",
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  internet: "Internet",
  otro: "Otro",
};

// Orden fijo dentro de cada propiedad: departamento → estacionamiento → bodega → resto.
const UNIT_TYPE_ORDER: Record<string, number> = {
  apartment: 0,
  house: 1,
  office: 1,
  retail: 1,
  other: 2,
  parking: 3,
  storage: 4,
};
function unitTypeRank(t: string | null | undefined): number {
  return UNIT_TYPE_ORDER[t ?? "other"] ?? 2;
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Estado del Patrimonio Inmobiliario — Propz" }] }),
  component: Dashboard,
});

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function dueDateFor(year: number, month: number, day: number | null | undefined): string {
  // Clamp to last day of month; default day 5 if not set.
  const d = day && day > 0 ? day : 5;
  const last = new Date(year, month, 0).getDate();
  return toISODate(new Date(year, month - 1, Math.min(d, last)));
}

/** ¿El período es anterior al mes de inicio del contrato vigente? */
function isBeforeContractStart(
  startDate: string | null | undefined,
  year: number,
  month: number,
): boolean {
  if (!startDate) return false;
  const [sy, sm] = startDate.split("-").map(Number);
  if (!sy || !sm) return false;
  return year * 12 + month < sy * 12 + sm;
}

/**
 * Monto esperado del período.
 * - Si hay registro del mes, manda lo histórico guardado.
 * - Meses anteriores al inicio del contrato actual no heredan el nuevo arriendo base.
 * - Desde el mes de inicio en adelante, rige el arriendo base acordado.
 */
function expectedAmount(
  unit: { base_rent_amount: number | null; rent_start_date?: string | null },
  payment: { amount: number | null } | null,
  year: number,
  month: number,
): number {
  if (payment?.amount != null) return Number(payment.amount);
  if (isBeforeContractStart(unit.rent_start_date, year, month)) return 0;
  return Number(unit.base_rent_amount ?? 0);
}

function Dashboard() {
  const org = useCurrentOrg();
  const orgId = org.data?.organization_id;
  const qc = useQueryClient();

  const [{ year, month }, setPeriod] = useState(currentPeriod);

  const unitsQuery = useQuery({
    queryKey: ["dash-units", orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentable_units")
        .select("*, properties:property_id(id,name,address,comuna)")
        .eq("organization_id", orgId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as (Unit & { properties: Property | null })[];
    },
    enabled: !!orgId,
  });

  // Payments for the last 6 months incl. current — for the trend + current view.
  const rangeStart = addMonths(year, month, -5);
  const rangeStartKey = rangeStart.year * 100 + rangeStart.month;
  const rangeEndKey = year * 100 + month;
  const paymentsQuery = useQuery({
    queryKey: ["dash-payments", orgId, rangeStartKey, rangeEndKey],
    queryFn: async () => {
      const years = Array.from(
        new Set([rangeStart.year, year, ...Array.from({ length: year - rangeStart.year + 1 }, (_, i) => rangeStart.year + i)]),
      );
      const { data, error } = await supabase
        .from("rent_payments")
        .select("*")
        .eq("organization_id", orgId!)
        .in("period_year", years);
      if (error) throw error;
      return ((data ?? []) as RentPayment[]).filter((p) => {
        const k = p.period_year * 100 + p.period_month;
        return k >= rangeStartKey && k <= rangeEndKey;
      });
    },
    enabled: !!orgId,
  });

  const billsQuery = useQuery({
    queryKey: ["dash-bills", orgId],
    queryFn: async (): Promise<Bill[]> => {
      const { data, error } = await supabase
        .from("unit_bills")
        .select("*")
        .eq("organization_id", orgId!)
        .eq("status", "pendiente")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!orgId,
  });

  // Include all units with a base rent — unrented ones show as "PENDIENTE".
  const allUnits = useMemo(
    () =>
      (unitsQuery.data ?? [])
        .filter((u) => u.base_rent_amount != null)
        .slice()
        .sort((a, b) => {
          const an = (a.properties?.name ?? "").toLocaleLowerCase("es");
          const bn = (b.properties?.name ?? "").toLocaleLowerCase("es");
          if (an !== bn) return an.localeCompare(bn, "es");
          const ar = unitTypeRank(a.unit_type);
          const br = unitTypeRank(b.unit_type);
          if (ar !== br) return ar - br;
          return (a.label ?? "").localeCompare(b.label ?? "", "es");
        }),
    [unitsQuery.data],
  );
  const activeUnits = useMemo(() => allUnits.filter((u) => u.rent_active), [allUnits]);
  const unrentedUnits = useMemo(() => allUnits.filter((u) => !u.rent_active), [allUnits]);

  const paymentsByKey = useMemo(() => {
    const map = new Map<string, RentPayment>();
    for (const p of paymentsQuery.data ?? []) {
      map.set(`${p.unit_id}:${p.period_year}:${p.period_month}`, p);
    }
    return map;
  }, [paymentsQuery.data]);

  // Rows for the currently-viewed month — active first, then unrented (PENDIENTE) at the end.
  const rows = useMemo(() => {
    // Mezcla activas e inactivas respetando el orden global:
    // propiedad (alfabético) → tipo de unidad (depto → estacionamiento → bodega) → etiqueta.
    return allUnits.map((u) => {
      if (!u.rent_active) {
        return { unit: u, payment: null as RentPayment | null, status: "inactive" as PaymentStatus };
      }
      const p = paymentsByKey.get(`${u.id}:${year}:${month}`) ?? null;
      // Meses anteriores al inicio del contrato: solo cuenta lo histórico ya registrado.
      if (p == null && isBeforeContractStart(u.rent_start_date, year, month)) {
        return { unit: u, payment: null as RentPayment | null, status: "inactive" as PaymentStatus };
      }
      // Base 0 → arriendo imputado por otra vía; se marca OK automáticamente.
      const baseZero = Number(u.base_rent_amount ?? 0) === 0
        && (p == null || Number(p.amount ?? 0) === 0);
      const status = baseZero ? ("paid" as PaymentStatus) : computeStatus(p, { rentActive: true });
      return { unit: u, payment: p, status };
    });
  }, [allUnits, paymentsByKey, year, month]);

  const [filter, setFilter] = useState("");
  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    const terms = q.split(/\s+/);
    return rows.filter((r) => {
      const p = r.unit.properties as Property | null;
      const hay = [
        p?.name,
        p?.address,
        p?.comuna,
        r.unit.label,
        r.unit.tenant_name,
        (r.unit as any).tenant_rut,
        STATUS_META[r.status].label,
        String(r.unit.base_rent_amount ?? ""),
        String(r.payment?.amount ?? ""),
        String(r.payment?.amount_paid ?? ""),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
  }, [rows, filter]);



  const totals = useMemo(() => {
    let expected = 0;
    let confirmed = 0;
    let pending = 0;
    let overdue = 0;
    for (const r of rows) {
      const total = expectedAmount(r.unit, r.payment, year, month);
      const paid = Number(r.payment?.amount_paid ?? 0);
      const remaining = Math.max(0, total - paid);
      expected += total;
      // El confirmado suma TODO lo abonado, incluso si excede el monto esperado.
      confirmed += paid;
      if (r.status === "paid") {
        // fully paid
      } else if (r.status === "warn" || r.status === "late") {
        overdue += remaining;
      } else {
        // partial (unpaid balance) or upcoming
        pending += remaining;
      }
    }
    return { expected, confirmed, pending, overdue };
  }, [rows, year, month]);

  // 6-month trend (expected & confirmed) using CLP-equivalent amounts.
  const trend = useMemo(() => {
    const months: { year: number; month: number; expected: number; confirmed: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const p = addMonths(year, month, -i);
      let expected = 0;
      let confirmed = 0;
      for (const u of activeUnits) {
        const rec = paymentsByKey.get(`${u.id}:${p.year}:${p.month}`);
        const total = expectedAmount(u, rec ?? null, p.year, p.month);
        expected += total;
        confirmed += Number(rec?.amount_paid ?? 0);
      }
      months.push({ ...p, expected, confirmed });
    }
    return months;
  }, [activeUnits, paymentsByKey, year, month]);

  const collectedPct = totals.expected > 0
    ? Math.min(100, Math.round((totals.confirmed / totals.expected) * 100))
    : 0;

  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;

  const deltaConfirmed = prev ? totals.confirmed - prev.confirmed : 0;
  const deltaPct = prev && prev.confirmed > 0 ? (deltaConfirmed / prev.confirmed) * 100 : null;

  async function confirmPayment(unit: Unit) {
    if (!orgId) return;
    const base = Number(unit.base_rent_amount ?? 0);
    const due = dueDateFor(year, month, unit.payment_day);
    try {
      const paymentId = await ensureRentPayment({
        organizationId: orgId,
        unit,
        year,
        month,
        dueDate: due,
      });
      // Confirmar SIN alterar el monto esperado (se mantiene el arriendo base).
      // El total abonado queda tal como fue registrado (cartola o edición manual).
      const { error: updErr } = await supabase
        .from("rent_payments")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          needs_review: false,
        } as any)
        .eq("id", paymentId);
      if (updErr) throw updErr;

      toast.success("Pago confirmado");
      qc.invalidateQueries({ queryKey: ["dash-payments", orgId] });
    } catch (err) {
      toast.error("No pudimos confirmar el pago", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  async function partialPayment(unit: Unit, payment: RentPayment | null) {
    if (!orgId) return;
    const total = Number(unit.base_rent_amount ?? 0);
    const alreadyPaid = Number(payment?.amount_paid ?? 0);
    const remaining = Math.max(0, total - alreadyPaid);
    const input = window.prompt(
      `Ingresa el monto abonado (saldo pendiente: ${formatCLP(remaining)})`,
      String(remaining || total),
    );
    if (input == null) return;
    const amount = Number(input.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Monto inválido");
      return;
    }
    const due = dueDateFor(year, month, unit.payment_day);
    try {
      const paymentId = await ensureRentPayment({
        organizationId: orgId,
        unit,
        year,
        month,
        dueDate: due,
      });
      await addManualAllocation({ organizationId: orgId, rentPaymentId: paymentId, amount });
      toast.success(`Abono registrado: ${formatCLP(amount)}`);
      qc.invalidateQueries({ queryKey: ["dash-payments", orgId] });
    } catch (err) {
      toast.error("No pudimos registrar el abono", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  async function undoConfirm(paymentId: string) {
    try {
      await clearAllocations(paymentId);
      qc.invalidateQueries({ queryKey: ["dash-payments", orgId] });
    } catch (err) {
      toast.error("No pudimos revertir", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  async function editExpectedAmount(unit: Unit, payment: RentPayment | null) {
    if (!orgId) return;
    const base = Number(unit.base_rent_amount ?? 0);
    const current = Number(payment?.amount_paid ?? 0);
    const input = window.prompt(
      `Monto abonado del mes (arriendo base: ${formatCLP(base)})`,
      String(current || base || 0),
    );
    if (input == null) return;
    const amount = Number(input.replace(/[^\d.-]/g, ""));
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Monto inválido");
      return;
    }
    try {
      const due = dueDateFor(year, month, unit.payment_day);
      const paymentId = await ensureRentPayment({ organizationId: orgId, unit, year, month, dueDate: due });
      // Reemplaza los abonos existentes por un único abono manual con el monto indicado.
      // El monto esperado (arriendo base) NO se altera.
      await clearAllocations(paymentId);
      if (amount > 0) {
        await addManualAllocation({ organizationId: orgId, rentPaymentId: paymentId, amount, notes: "Ajuste manual" });
      }
      const dbStatus = amount <= 0 ? "pending" : amount >= base ? "confirmed" : "partial";
      const { error } = await supabase
        .from("rent_payments")
        .update({
          status: dbStatus,
          needs_review: false,
          confirmed_at: dbStatus === "confirmed" ? new Date().toISOString() : null,
        } as any)
        .eq("id", paymentId);
      if (error) throw error;
      toast.success("Abono actualizado");
      qc.invalidateQueries({ queryKey: ["dash-payments", orgId] });
    } catch (err) {
      toast.error("No pudimos actualizar el monto", { description: err instanceof Error ? err.message : String(err) });
    }
  }


  async function clearReview(paymentId: string) {
    try {
      const { error } = await supabase.from("rent_payments").update({ needs_review: false } as any).eq("id", paymentId);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["dash-payments", orgId] });
    } catch (err) {
      toast.error("No pudimos actualizar", { description: err instanceof Error ? err.message : String(err) });
    }
  }

  const isCurrent = year === currentPeriod().year && month === currentPeriod().month;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Estado del Patrimonio Inmobiliario</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {allUnits.length} {allUnits.length === 1 ? "unidad" : "unidades"} •{" "}
            {activeUnits.length} {activeUnits.length === 1 ? "arrendada" : "arrendadas"} •{" "}
            {unrentedUnits.length} {unrentedUnits.length === 1 ? "vacante" : "vacantes"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/rent/import">
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <FileUp className="h-4 w-4" /> Importar cartola
            </Button>
          </Link>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPeriod(addMonths(year, month, -1))}
            aria-label="Mes anterior"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-[10ch] text-center text-sm font-medium">
            {periodLabel(year, month)}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setPeriod(addMonths(year, month, 1))}
            aria-label="Mes siguiente"
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
          </div>
        </div>
      </div>

      {/* Flujo del mes */}
      <section className="mt-4 rounded-xl border border-border bg-card p-3">
        <h2 className="text-sm font-semibold">Flujo del mes</h2>
        <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 lg:grid-cols-4">
          <FlowItem label="Esperado" value={formatCLP(totals.expected)} />
          <FlowItem label="Confirmado" value={formatCLP(totals.confirmed)} tone="success" />
          <FlowItem label="Pendiente" value={formatCLP(totals.pending)} />
          <FlowItem
            label="Atrasado"
            value={formatCLP(totals.overdue)}
            tone={totals.overdue > 0 ? "destructive" : undefined}
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Cobrado</span>
            <span className="font-medium tabular-nums text-foreground">{collectedPct}%</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-success transition-all"
              style={{ width: `${collectedPct}%` }}
            />
          </div>
        </div>
      </section>


      {unrentedUnits.length > 0 ? (
        <Link
          to="/properties"
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-warning/40 bg-warning/10 px-3 py-1.5 text-xs hover:bg-warning/15"
        >
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" />
          <span className="font-medium text-foreground">
            {unrentedUnits.length} {unrentedUnits.length === 1 ? "unidad" : "unidades"} PENDIENTES de arrendar
          </span>
          <span className="text-warning underline underline-offset-2">Ir a propiedades →</span>
        </Link>
      ) : null}

      {prev ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          {deltaConfirmed >= 0 ? (
            <TrendingUp className="h-4 w-4 text-success" />
          ) : (
            <TrendingDown className="h-4 w-4 text-destructive" />
          )}
          <span>
            {deltaConfirmed >= 0 ? "+" : ""}
            {formatCLP(deltaConfirmed)}
            {deltaPct != null ? ` (${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%)` : ""}
            {" vs "}
            {shortPeriodLabel(prev.year, prev.month)}
          </span>
        </div>
      ) : null}

      {/* 6-month comparison */}
      <section className="mt-4 rounded-xl border border-border bg-card p-3">
        <h2 className="text-sm font-semibold">Comparativo últimos 6 meses</h2>
        <TrendChart data={trend} />
      </section>

      {/* Bills */}
      <BillsSection bills={billsQuery.data ?? []} unitsById={new Map((unitsQuery.data ?? []).map((u) => [u.id, u]))} />

      {/* Rows */}
      <section className="mt-4">
        <div className="flex items-end justify-between">
          <h2 className="text-base font-semibold">Estado por unidad — {periodLabel(year, month)}</h2>
          <Link to="/properties" className="text-sm text-muted-foreground hover:text-foreground">
            Configurar arriendos →
          </Link>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <Input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar por dirección, propiedad, unidad, arrendatario, monto…"
            className="h-9"
            aria-label="Filtrar unidades"
          />
          {filter ? (
            <Button variant="ghost" size="sm" className="h-9 shrink-0 px-2 text-xs" onClick={() => setFilter("")}>
              Limpiar
            </Button>
          ) : null}
        </div>
        <div className="mt-2 text-xs text-muted-foreground">
          {filteredRows.length} de {rows.length} unidades
        </div>

        {unitsQuery.isLoading ? (
          <div className="mt-4 rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
            Cargando…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : filteredRows.length === 0 ? (
          <div className="mt-6 rounded-xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            No hay unidades que coincidan con “{filter}”.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredRows.map((r) => (
              <PaymentRow
                key={r.unit.id}
                unit={r.unit}
                property={r.unit.properties}
                payment={r.payment}
                status={r.status}
                year={year}
                month={month}
                onConfirm={() => confirmPayment(r.unit)}
                onPartial={() => partialPayment(r.unit, r.payment)}
                onUndo={r.payment ? () => undoConfirm(r.payment!.id) : undefined}
                onEditAmount={() => editExpectedAmount(r.unit, r.payment)}
                onClearReview={r.payment ? () => clearReview(r.payment!.id) : undefined}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function FlowItem({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "destructive";
}) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={
          "mt-0.5 text-base font-semibold tabular-nums md:text-lg " +
          (tone === "success"
            ? "text-success"
            : tone === "destructive"
              ? "text-destructive"
              : "text-foreground")
        }
      >
        {value}
      </div>
    </div>
  );
}


function TrendChart({
  data,
}: {
  data: { year: number; month: number; expected: number; confirmed: number }[];
}) {
  const max = Math.max(1, ...data.map((d) => Math.max(d.expected, d.confirmed)));
  return (
    <div className="mt-3 grid grid-cols-6 gap-2">
      {data.map((d) => {
        const expH = (d.expected / max) * 100;
        const confH = (d.confirmed / max) * 100;
        return (
          <div key={`${d.year}-${d.month}`} className="flex flex-col items-center gap-1">
            <div className="relative flex h-20 w-full items-end gap-1">
              <div
                className="w-1/2 rounded-t bg-muted"
                style={{ height: `${expH}%` }}
                title={`Esperado: ${formatCLP(d.expected)}`}
              />
              <div
                className="w-1/2 rounded-t bg-primary"
                style={{ height: `${confH}%` }}
                title={`Confirmado: ${formatCLP(d.confirmed)}`}
              />
            </div>
            <div className="text-[10px] text-muted-foreground">{MONTHS_ES[d.month - 1]}</div>
            <div className="text-[10px] tabular-nums text-muted-foreground">
              {formatCLP(d.confirmed)}
            </div>
          </div>
        );
      })}
      <div className="col-span-6 mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-muted" /> Esperado
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-sm bg-primary" /> Confirmado
        </div>
      </div>
    </div>
  );
}

function PaymentRow({
  unit,
  property,
  payment,
  status,
  year,
  month,
  onConfirm,
  onPartial,
  onUndo,
  onEditAmount,
  onClearReview,
}: {
  unit: Unit;
  property: Property | null;
  payment: RentPayment | null;
  status: PaymentStatus;
  year: number;
  month: number;
  onConfirm: () => void;
  onPartial: () => void;
  onUndo?: () => void;
  onEditAmount: () => void;
  onClearReview?: () => void;
}) {
  const needsReview = !!(payment as any)?.needs_review;
  const total = payment?.amount != null ? Number(payment.amount) : Number(unit.base_rent_amount ?? 0);
  const paid = Number(payment?.amount_paid ?? 0);
  const remaining = Math.max(0, total - paid);
  const currency = payment?.currency ?? unit.base_rent_currency ?? "CLP";
  const meta = STATUS_META[status];
  const due = dueDateFor(year, month, unit.payment_day);
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : status === "paid" ? 100 : 0;
  const tenant = status === "inactive" ? "PENDIENTE" : unit.tenant_name || "Sin arrendatario";

  return (
    <Card
      className={cn(
        "flex flex-col gap-1 overflow-hidden p-2 shadow-none",
        status === "inactive" && "bg-warning/5",
      )}
    >
      {/* Fila 1: Propiedad · Unidad + Estado */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-label={meta.label} />
          <span className="truncate text-sm font-medium leading-tight">{property?.name ?? "—"}</span>
          <span className="shrink-0 text-xs text-muted-foreground">· {unit.label}</span>
        </div>
        <span className={`shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium ${meta.badge}`}>
          {meta.label}
        </span>
      </div>

      {/* Fila 2: Arrendatario + Abonado */}
      <div className="flex items-baseline justify-between gap-2">
        <span className="truncate text-xs text-muted-foreground">{tenant}</span>
        <span className="shrink-0 tabular-nums text-sm font-semibold text-success">
          {formatMoney(paid, currency)}
          <span className="ml-1 text-[10px] font-normal text-muted-foreground">/ {formatMoney(total, currency)}</span>
        </span>
      </div>

      {/* Barra de progreso */}
      <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${status === "paid" ? "bg-success" : paid > 0 ? "bg-info" : "bg-muted-foreground/30"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Fila 3: Acciones */}
      <div className="flex items-center justify-between gap-1">
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          {needsReview ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-1.5 text-[10px] font-semibold uppercase text-warning">
              <AlertTriangle className="h-3 w-3" /> Rev.
            </span>
          ) : null}

          {status === "inactive" ? (
            <Link to="/properties">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs">Asignar</Button>
            </Link>
          ) : (
            <>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEditAmount} title="Editar monto abonado">
                Editar
              </Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onPartial}>
                <Wallet className="mr-1 h-3 w-3" /> Abonar
              </Button>
              {status === "paid" ? (
                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onUndo}>
                  Revertir
                </Button>
              ) : (
                <Button size="sm" className="h-7 px-2 text-xs" onClick={onConfirm}>
                  <Check className="mr-1 h-3 w-3" /> Confirmar
                </Button>
              )}
            </>
          )}
          {needsReview && onClearReview ? (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onClearReview} title="Marcar como revisado">
              OK
            </Button>
          ) : null}
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" aria-label="Ver detalles">
              <Eye className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-2xl">
            <SheetHeader className="pb-2">
              <SheetTitle className="text-base">
                {property?.name ?? "—"} · {unit.label}
              </SheetTitle>
            </SheetHeader>
            <div className="py-2 text-sm">
              <dl className="grid gap-3 sm:grid-cols-2">
                <Info label="Estado" value={meta.label} />
                <Info label="Vencimiento" value={status === "inactive" ? "—" : due} />
                <Info
                  label="Monto esperado"
                  value={
                    payment?.amount != null && Number(payment.amount) !== Number(unit.base_rent_amount ?? 0)
                      ? `${formatMoney(total, currency)} (base ${formatMoney(Number(unit.base_rent_amount ?? 0), currency)})`
                      : formatMoney(total, currency)
                  }
                />
                <Info label="Abonado" value={formatMoney(paid, currency)} />
                <Info label="Saldo pendiente" value={formatMoney(remaining, currency)} />
                <Info label="Pagado el" value={payment?.paid_date ?? "—"} />
                <Info label="Arrendatario" value={tenant} />
                <Info label="Contacto" value={unit.tenant_contact ?? "—"} />
                <Info label="Inicio contrato" value={unit.rent_start_date ?? "—"} />
                <Info label="Notas" value={payment?.notes ?? unit.notes ?? "—"} />
              </dl>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-border bg-card/50 p-8 text-center">
      <h3 className="font-medium">Aún no hay arriendos activos</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Marca una unidad como <em>arrendada</em> y define su día de pago para ver el semáforo y confirmar cobros.
      </p>
      <Link to="/properties" className="mt-4 inline-block">
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" /> Configurar propiedades
        </Button>
      </Link>
    </div>
  );
}
function billStatus(b: Bill): { label: string; className: string; overdue: number } {
  const overdue = daysSinceDue(b.due_date);
  if (overdue < 0) return { label: "Por vencer", className: "bg-muted text-muted-foreground border-border", overdue };
  if (overdue <= 5) return { label: `Atrasado ${overdue === 0 ? "hoy" : `${overdue}d`}`, className: "bg-warning/15 text-warning border-warning/30", overdue };
  return { label: `Atrasado ${overdue}d`, className: "bg-destructive/15 text-destructive border-destructive/30", overdue };
}

function BillsSection({ bills, unitsById }: { bills: Bill[]; unitsById: Map<string, Unit & { properties: Property | null }> }) {
  const sorted = [...bills].sort((a, b) => a.due_date.localeCompare(b.due_date));
  const overdue = sorted.filter((b) => daysSinceDue(b.due_date) > 0);
  const total = sorted.reduce((sum, b) => sum + Number(b.amount ?? 0), 0);

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Cuentas de servicios pendientes</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Semáforo con la misma lógica que los arriendos: verde al día, amarillo 1–5 días, rojo +5 días.
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          {sorted.length} pendientes · {overdue.length} atrasadas · Total {formatCLP(total)}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="mt-4 text-sm text-muted-foreground">No hay cuentas pendientes registradas.</div>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {sorted.slice(0, 12).map((b) => {
            const u = unitsById.get(b.unit_id);
            const meta = billStatus(b);
            return (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">
                    {u?.properties?.name ?? "Propiedad"} · {u?.label ?? "Unidad"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {BILL_LABELS[b.category] ?? b.category}
                    {b.period ? ` · ${b.period}` : ""} · Vence {b.due_date}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm font-semibold tabular-nums">{formatMoney(Number(b.amount), b.currency)}</div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] ${meta.className}`}>
                    {meta.label}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
