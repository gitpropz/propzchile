import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  FileUp,
  MoreHorizontal,
  Plus,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCLP, formatMoney } from "@/lib/format";
import { addManualAllocation, clearAllocations, ensureRentPayment } from "@/lib/rent-allocations";
import {
  STATUS_META,
  addMonths,
  computeStatus,
  daysSinceDue,
  periodLabel,
  toISODate,
  type PaymentStatus,
  type RentPayment,
} from "@/lib/rent-status";
import { useServicesMonitor } from "@/hooks/use-services-monitor";
import { ServicesSummaryStrip } from "@/components/services-summary-strip";
import { UnitServicesIndicator } from "@/components/unit-services-indicator";
import { Panel, PanelHeader, ProgressLine } from "@/components/dashboard-v2/primitives";
import { FlowCard } from "@/components/dashboard-v2/flow-card";
import { AttentionCard, type AttentionItem } from "@/components/dashboard-v2/attention-card";
import { TrendLine } from "@/components/dashboard-v2/trend-line";
import type { PropertyMonitoring } from "@/lib/monitored-services";
import type { Database } from "@/integrations/supabase/types";
import { evaluateLease } from "@/lib/lease-expiry";


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

export const Route = createFileRoute("/_authenticated/dashboard-v3")({
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

  // Monitoreo de servicios (misma lógica, nueva presentación).
  const servicesMonitor = useServicesMonitor(orgId);

  /** Unidad principal (depto/casa) de cada propiedad: ahí vive el indicador de servicios. */
  const mainUnitIdByProperty = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of allUnits) {
      const pid = u.properties?.id;
      if (!pid || map.has(pid)) continue;
      if (u.unit_type === "apartment" || u.unit_type === "house") map.set(pid, u.id);
    }
    return map;
  }, [allUnits]);
  const unrentedUnits = useMemo(() => allUnits.filter((u) => !u.rent_active), [allUnits]);
  const propertyCount = useMemo(
    () => new Set(allUnits.map((u) => u.properties?.id).filter(Boolean)).size,
    [allUnits],
  );

  // Contratos próximos a vencer o ya vencidos (sobre unidades arrendadas).
  const expiringContracts = useMemo(
    () =>
      activeUnits
        .map((u) => ({ unit: u, lease: evaluateLease(true, (u as any).rent_end_date) }))
        .filter((c) => c.lease.status === "expiring" || c.lease.status === "expired"),
    [activeUnits],
  );
  const expiredCount = expiringContracts.filter((c) => c.lease.status === "expired").length;
  const expiringSoonCount = expiringContracts.length - expiredCount;

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
    ? Math.round((totals.confirmed / totals.expected) * 100)
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

  // Excepciones del mes: solo lo que requiere acción.
  const lateCount = useMemo(
    () => rows.filter((r) => r.status === "late" || r.status === "warn").length,
    [rows],
  );
  const attentionItems = useMemo(() => {
    const items: {
      key: string;
      count: number;
      label: string;
      to: string;
      hash?: string;
      tone: "destructive" | "warning" | "muted";
    }[] = [];
    if (lateCount > 0)
      items.push({ key: "late", count: lateCount, label: "arriendos atrasados", to: "/dashboard", hash: "unidades", tone: "destructive" });
    if (servicesMonitor.counts.critical > 0)
      items.push({ key: "svc-crit", count: servicesMonitor.counts.critical, label: "servicios críticos", to: "/services/update", tone: "destructive" });
    if (servicesMonitor.counts.unknown > 0)
      items.push({ key: "svc-unk", count: servicesMonitor.counts.unknown, label: "servicios sin información", to: "/services/update", tone: "muted" });
    if (unrentedUnits.length > 0)
      items.push({ key: "vacant", count: unrentedUnits.length, label: "propiedades vacantes", to: "/properties", tone: "warning" });
    if (expiredCount > 0)
      items.push({ key: "expired", count: expiredCount, label: "contratos vencidos", to: "/contracts", tone: "destructive" });
    if (expiringSoonCount > 0)
      items.push({ key: "expiring", count: expiringSoonCount, label: "contratos por vencer", to: "/contracts", tone: "warning" });
    return items;
  }, [lateCount, servicesMonitor.counts, unrentedUnits.length, expiredCount, expiringSoonCount]);

  // Agrupación por propiedad, respetando el orden global ya calculado.
  const groups: { property: Property | null; rows: typeof filteredRows }[] = [];
  for (const r of filteredRows) {
    const p = (r.unit.properties as Property | null) ?? null;
    const last = groups[groups.length - 1];
    if (last && (last.property?.id ?? "—") === (p?.id ?? "—")) last.rows.push(r);
    else groups.push({ property: p, rows: [r] });
  }

  const attentionCards: AttentionItem[] = attentionItems.map((it) => ({
    key: it.key,
    count: it.count,
    label: it.label,
    to: it.to === "/dashboard" ? "/dashboard-v3" : it.to,
    hash: it.hash,
    tone: it.tone === "destructive" ? "danger" : it.tone,
  }));

  const rowActions = {
    onConfirm: (unit: Unit) => void confirmPayment(unit),
    onPartial: (unit: Unit, payment: RentPayment | null) => void partialPayment(unit, payment),
    onUndo: (paymentId: string) => void undoConfirm(paymentId),
    onEditAmount: (unit: Unit, payment: RentPayment | null) => void editExpectedAmount(unit, payment),
    onClearReview: (paymentId: string) => void clearReview(paymentId),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-5 md:px-6 md:py-8">
      {/* Encabezado */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-display truncate text-xl font-bold tracking-tight md:text-2xl">
            Estado del Patrimonio
          </h1>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {propertyCount} {propertyCount === 1 ? "propiedad" : "propiedades"} · {allUnits.length}{" "}
            {allUnits.length === 1 ? "unidad" : "unidades"} · {activeUnits.length} arrendadas ·{" "}
            {unrentedUnits.length} vacantes
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/rent/import" className="hidden sm:block">
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <FileUp className="h-4 w-4" /> Importar cartola
            </Button>
          </Link>
          <div className="flex items-center rounded-full border border-border/70 bg-card p-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => setPeriod(addMonths(year, month, -1))}
              aria-label="Mes anterior"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[10ch] text-center text-xs font-medium">{periodLabel(year, month)}</div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full"
              onClick={() => setPeriod(addMonths(year, month, 1))}
              aria-label="Mes siguiente"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* 1. Resumen del mes */}
      <FlowCard
        periodLabel={periodLabel(year, month)}
        expected={totals.expected}
        confirmed={totals.confirmed}
        pending={totals.pending}
        overdue={totals.overdue}
        pct={collectedPct}
        prev={prev ? { year: prev.year, month: prev.month } : null}
        deltaConfirmed={deltaConfirmed}
        deltaPct={deltaPct}
      />

      {/* 2. Requiere atención */}
      <AttentionCard items={attentionCards} />

      {/* 3. Tendencia */}
      <TrendLine data={trend} />

      {/* Resumen ejecutivo de servicios */}
      <ServicesSummaryStrip
        period={servicesMonitor.period}
        counts={servicesMonitor.counts}
        coverage={servicesMonitor.coverage}
      />

      <BillsSection bills={billsQuery.data ?? []} unitsById={new Map((unitsQuery.data ?? []).map((u) => [u.id, u]))} />

      {/* 4. Estado por propiedad */}
      <section id="unidades" className="scroll-mt-4 space-y-3">
        <Panel className="pb-4">
          <PanelHeader
            title={`Estado por propiedad — ${periodLabel(year, month)}`}
            hint={`${filteredRows.length} de ${rows.length} unidades`}
            right={
              <Link to="/properties" className="text-xs text-muted-foreground hover:text-foreground">
                Configurar arriendos →
              </Link>
            }
          />
          <div className="mt-3 flex items-center gap-2 px-5">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar por propiedad, unidad, arrendatario, monto…"
              className="h-9"
              aria-label="Filtrar unidades"
            />
            {filter ? (
              <Button variant="ghost" size="sm" className="h-9 shrink-0 px-2 text-xs" onClick={() => setFilter("")}>
                Limpiar
              </Button>
            ) : null}
          </div>
        </Panel>

        {unitsQuery.isLoading ? (
          <Panel className="p-6 text-sm text-muted-foreground">Cargando…</Panel>
        ) : rows.length === 0 ? (
          <EmptyState />
        ) : filteredRows.length === 0 ? (
          <Panel className="p-6 text-center text-sm text-muted-foreground">
            No hay unidades que coincidan con “{filter}”.
          </Panel>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {groups.map((g) => (
              <PropertyGroup
                key={g.property?.id ?? "sin-propiedad"}
                property={g.property}
                rows={g.rows}
                year={year}
                month={month}
                orgId={orgId}
                servicesPeriod={servicesMonitor.period}
                monitoring={g.property ? servicesMonitor.byProperty.get(g.property.id) ?? null : null}
                onServicesSaved={() => void servicesMonitor.refetch()}
                actions={rowActions}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}




/** Grupo por propiedad: cabecera + unidades + servicios de la propiedad. */
function PropertyGroup({
  property,
  rows,
  year,
  month,
  orgId,
  servicesPeriod,
  monitoring,
  onServicesSaved,
  actions,
}: {
  property: Property | null;
  rows: { unit: Unit; payment: RentPayment | null; status: PaymentStatus }[];
  year: number;
  month: number;
  orgId?: string;
  servicesPeriod: string;
  monitoring: PropertyMonitoring | null;
  onServicesSaved: () => void;
  actions: {
    onConfirm: (unit: Unit) => void;
    onPartial: (unit: Unit, payment: RentPayment | null) => void;
    onUndo: (paymentId: string) => void;
    onEditAmount: (unit: Unit, payment: RentPayment | null) => void;
    onClearReview: (paymentId: string) => void;
  };
}) {
  const expected = rows.reduce((s, r) => s + expectedAmount(r.unit, r.payment, year, month), 0);
  const paid = rows.reduce((s, r) => s + Number(r.payment?.amount_paid ?? 0), 0);
  const pct = expected > 0 ? Math.min(100, (paid / expected) * 100) : paid > 0 ? 100 : 0;
  const late = rows.filter((r) => r.status === "late" || r.status === "warn").length;

  return (
    <Panel className="overflow-hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 pt-4 sm:px-5">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-foreground">{property?.name ?? "Sin propiedad"}</div>
          <div className="truncate text-xs text-muted-foreground">
            {[property?.address, property?.comuna].filter(Boolean).join(" · ") || "—"}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular text-foreground">{formatCLP(paid)}</div>
          <div className="text-[11px] text-muted-foreground tabular">de {formatCLP(expected)}</div>
        </div>
      </div>

      <div className="px-4 pt-3 sm:px-5">
        <ProgressLine pct={pct} tone={late > 0 ? "danger" : pct >= 100 ? "success" : "warning"} className="h-1" />
      </div>

      <ul className="mt-1 divide-y divide-border/50 px-2 sm:px-3">
        {rows.map((r) => (
          <li key={r.unit.id}>
            <UnitRow
              unit={r.unit}
              property={property}
              payment={r.payment}
              status={r.status}
              year={year}
              month={month}
              onConfirm={() => actions.onConfirm(r.unit)}
              onPartial={() => actions.onPartial(r.unit, r.payment)}
              onUndo={r.payment ? () => actions.onUndo(r.payment!.id) : undefined}
              onEditAmount={() => actions.onEditAmount(r.unit, r.payment)}
              onClearReview={r.payment ? () => actions.onClearReview(r.payment!.id) : undefined}
            />
          </li>
        ))}
      </ul>

      {monitoring && orgId ? (
        <div className="border-t border-border/50 px-3 py-2 sm:px-4">
          <UnitServicesIndicator
            organizationId={orgId}
            monitoring={monitoring}
            period={servicesPeriod}
            onSaved={onServicesSaved}
          />
        </div>
      ) : null}
    </Panel>
  );
}

function UnitRow({
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
  const tenant = status === "inactive" ? "Sin arrendatario" : unit.tenant_name || "Sin arrendatario";

  return (
    <div className="rounded-xl px-2 py-2.5 transition-propz hover:bg-muted/40">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium text-foreground">{unit.label ?? "Unidad"}</div>
            <div className="truncate text-xs text-muted-foreground">{tenant}</div>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold tabular text-foreground">{formatMoney(paid, currency)}</div>
          <div className="text-[11px] text-muted-foreground tabular">de {formatMoney(total, currency)}</div>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`shrink-0 rounded-full border px-1.5 py-0 text-[10px] font-medium ${meta.badge}`}>
          {meta.label}
        </span>
        {needsReview ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/15 px-1.5 text-[10px] font-semibold uppercase text-warning">
            <AlertTriangle className="h-3 w-3" /> Rev.
          </span>
        ) : null}

        {status === "inactive" ? (
          <Link
            to="/properties/$id"
            params={{ id: property?.id ?? unit.property_id }}
            search={{ tab: "units", unit: unit.id }}
          >
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
              Asignar
            </Button>
          </Link>
        ) : (
          <>
            {status === "paid" ? (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onPartial}>
                <Wallet className="mr-1 h-3 w-3" /> Abonar
              </Button>
            ) : (
              <Button size="sm" className="h-7 px-2 text-xs" onClick={onConfirm}>
                <Check className="mr-1 h-3 w-3" /> Confirmar
              </Button>
            )}
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Ver detalles">
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
                <dl className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
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

          {status !== "inactive" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Más acciones">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-xs">Acciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onEditAmount}>Editar monto abonado</DropdownMenuItem>
                <DropdownMenuItem onClick={onPartial}>Registrar abono parcial</DropdownMenuItem>
                {onUndo ? (
                  <DropdownMenuItem onClick={onUndo} className="text-destructive">
                    Revertir abonos
                  </DropdownMenuItem>
                ) : null}
                {needsReview && onClearReview ? (
                  <DropdownMenuItem onClick={onClearReview}>Marcar como revisado</DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link
                    to="/properties/$id"
                    params={{ id: property?.id ?? unit.property_id }}
                    search={{ tab: "units", unit: unit.id }}
                  >
                    Configurar unidad
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
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

  if (sorted.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">Cuentas registradas anteriormente</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Historial de cuentas cargadas manualmente. Semáforo: verde al día, amarillo 1–5 días, rojo +5 días.
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
