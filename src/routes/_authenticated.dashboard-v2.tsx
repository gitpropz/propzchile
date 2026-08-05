import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, FileUp, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCLP } from "@/lib/format";
import { cn } from "@/lib/utils";
import { addManualAllocation, clearAllocations, ensureRentPayment } from "@/lib/rent-allocations";
import {
  STATUS_META,
  addMonths,
  computeStatus,
  periodLabel,
  toISODate,
  type PaymentStatus,
  type RentPayment,
} from "@/lib/rent-status";
import { evaluateLease } from "@/lib/lease-expiry";
import { useServicesMonitor } from "@/hooks/use-services-monitor";
import { Panel, PanelHeader } from "@/components/dashboard-v2/primitives";
import { FlowCard } from "@/components/dashboard-v2/flow-card";
import { AttentionCard, type AttentionItem } from "@/components/dashboard-v2/attention-card";
import { TrendLine } from "@/components/dashboard-v2/trend-line";
import { ServicesSection } from "@/components/dashboard-v2/services-section";
import { UnitCard } from "@/components/dashboard-v2/unit-card";
import { BillsPanel } from "@/components/dashboard-v2/bills-panel";
import type { Database } from "@/integrations/supabase/types";

type Unit = Database["public"]["Tables"]["rentable_units"]["Row"];
type Property = Pick<Database["public"]["Tables"]["properties"]["Row"], "id" | "name" | "address" | "comuna">;
type Bill = Database["public"]["Tables"]["unit_bills"]["Row"];

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

export const Route = createFileRoute("/_authenticated/dashboard-v2")({
  head: () => ({
    meta: [
      { title: "Dashboard V2 — Control financiero inmobiliario | Propz" },
      {
        name: "description",
        content:
          "Nueva experiencia Propz: flujo del mes, alertas accionables, tendencia y estado por unidad en una vista clara y premium.",
      },
      { property: "og:title", content: "Dashboard V2 — Control financiero inmobiliario | Propz" },
      {
        property: "og:description",
        content: "Flujo del mes, lo que requiere atención y estado por unidad en una sola vista.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DashboardV2,
});

function currentPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function dueDateFor(year: number, month: number, day: number | null | undefined): string {
  const d = day && day > 0 ? day : 5;
  const last = new Date(year, month, 0).getDate();
  return toISODate(new Date(year, month - 1, Math.min(d, last)));
}

function isBeforeContractStart(startDate: string | null | undefined, year: number, month: number): boolean {
  if (!startDate) return false;
  const [sy, sm] = startDate.split("-").map(Number);
  if (!sy || !sm) return false;
  return year * 12 + month < sy * 12 + sm;
}

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

function DashboardV2() {
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

  const rangeStart = addMonths(year, month, -5);
  const rangeStartKey = rangeStart.year * 100 + rangeStart.month;
  const rangeEndKey = year * 100 + month;
  const paymentsQuery = useQuery({
    queryKey: ["dash-payments", orgId, rangeStartKey, rangeEndKey],
    queryFn: async () => {
      const years = Array.from(
        new Set([
          rangeStart.year,
          year,
          ...Array.from({ length: year - rangeStart.year + 1 }, (_, i) => rangeStart.year + i),
        ]),
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
  const propertyCount = useMemo(
    () => new Set(allUnits.map((u) => u.properties?.id).filter(Boolean)).size,
    [allUnits],
  );

  const servicesMonitor = useServicesMonitor(orgId);

  const serviceProperties = useMemo(() => {
    const names = new Map<string, string>();
    for (const u of allUnits) {
      if (u.properties?.id) names.set(u.properties.id, u.properties.name ?? "Propiedad");
    }
    return Array.from(servicesMonitor.byProperty.entries())
      .map(([id, monitoring]) => ({ id, name: names.get(id) ?? "Propiedad", monitoring }))
      .sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [allUnits, servicesMonitor.byProperty]);

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

  const rows = useMemo(() => {
    return allUnits.map((u) => {
      if (!u.rent_active) {
        return { unit: u, payment: null as RentPayment | null, status: "inactive" as PaymentStatus };
      }
      const p = paymentsByKey.get(`${u.id}:${year}:${month}`) ?? null;
      if (p == null && isBeforeContractStart(u.rent_start_date, year, month)) {
        return { unit: u, payment: null as RentPayment | null, status: "inactive" as PaymentStatus };
      }
      const baseZero = Number(u.base_rent_amount ?? 0) === 0 && (p == null || Number(p.amount ?? 0) === 0);
      const status = baseZero ? ("paid" as PaymentStatus) : computeStatus(p, { rentActive: true });
      return { unit: u, payment: p, status };
    });
  }, [allUnits, paymentsByKey, year, month]);

  const [filter, setFilter] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const filteredRows = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const base = onlyAttention
      ? rows.filter((r) => r.status === "late" || r.status === "warn" || r.status === "inactive" || r.status === "partial")
      : rows;
    if (!q) return base;
    const terms = q.split(/\s+/);
    return base.filter((r) => {
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
  }, [rows, filter, onlyAttention]);

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
      confirmed += paid;
      if (r.status === "paid") {
        // fully paid
      } else if (r.status === "warn" || r.status === "late") {
        overdue += remaining;
      } else {
        pending += remaining;
      }
    }
    return { expected, confirmed, pending, overdue };
  }, [rows, year, month]);

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

  const collectedPct = totals.expected > 0 ? Math.round((totals.confirmed / totals.expected) * 100) : 0;
  const prev = trend.length >= 2 ? trend[trend.length - 2] : null;
  const deltaConfirmed = prev ? totals.confirmed - prev.confirmed : 0;
  const deltaPct = prev && prev.confirmed > 0 ? (deltaConfirmed / prev.confirmed) * 100 : null;

  async function confirmPayment(unit: Unit) {
    if (!orgId) return;
    const due = dueDateFor(year, month, unit.payment_day);
    try {
      const paymentId = await ensureRentPayment({ organizationId: orgId, unit, year, month, dueDate: due });
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
      toast.error("No pudimos confirmar el pago", {
        description: err instanceof Error ? err.message : String(err),
      });
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
      const paymentId = await ensureRentPayment({ organizationId: orgId, unit, year, month, dueDate: due });
      await addManualAllocation({ organizationId: orgId, rentPaymentId: paymentId, amount });
      toast.success(`Abono registrado: ${formatCLP(amount)}`);
      qc.invalidateQueries({ queryKey: ["dash-payments", orgId] });
    } catch (err) {
      toast.error("No pudimos registrar el abono", {
        description: err instanceof Error ? err.message : String(err),
      });
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
      await clearAllocations(paymentId);
      if (amount > 0) {
        await addManualAllocation({
          organizationId: orgId,
          rentPaymentId: paymentId,
          amount,
          notes: "Ajuste manual",
        });
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
      toast.error("No pudimos actualizar el monto", {
        description: err instanceof Error ? err.message : String(err),
      });
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

  const lateCount = useMemo(() => rows.filter((r) => r.status === "late" || r.status === "warn").length, [rows]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    if (lateCount > 0)
      items.push({
        key: "late",
        count: lateCount,
        label: lateCount === 1 ? "arriendo atrasado" : "arriendos atrasados",
        to: "/dashboard-v2",
        hash: "unidades",
        tone: "danger",
      });
    if (servicesMonitor.counts.critical > 0)
      items.push({
        key: "svc-crit",
        count: servicesMonitor.counts.critical,
        label: "servicios en estado crítico",
        to: "/services/update",
        tone: "danger",
      });
    if (servicesMonitor.counts.over > 0)
      items.push({
        key: "svc-over",
        count: servicesMonitor.counts.over,
        label: "servicios por revisar",
        to: "/services/update",
        tone: "warning",
      });
    if (servicesMonitor.counts.unknown > 0)
      items.push({
        key: "svc-unk",
        count: servicesMonitor.counts.unknown,
        label: "servicios sin información",
        to: "/services/update",
        tone: "muted",
      });
    if (expiredCount > 0)
      items.push({
        key: "expired",
        count: expiredCount,
        label: expiredCount === 1 ? "contrato vencido" : "contratos vencidos",
        to: "/contracts",
        tone: "danger",
      });
    if (expiringSoonCount > 0)
      items.push({
        key: "expiring",
        count: expiringSoonCount,
        label: expiringSoonCount === 1 ? "contrato por vencer" : "contratos por vencer",
        to: "/contracts",
        tone: "warning",
      });
    if (unrentedUnits.length > 0)
      items.push({
        key: "vacant",
        count: unrentedUnits.length,
        label: unrentedUnits.length === 1 ? "unidad vacante" : "unidades vacantes",
        to: "/properties",
        tone: "warning",
      });
    return items;
  }, [lateCount, servicesMonitor.counts, unrentedUnits.length, expiredCount, expiringSoonCount]);

  const unitLabelFor = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of unitsQuery.data ?? []) {
      map.set(u.id, `${u.properties?.name ?? "Propiedad"} · ${u.label ?? "Unidad"}`);
    }
    return (unitId: string) => map.get(unitId) ?? "Unidad";
  }, [unitsQuery.data]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      {/* Encabezado */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate font-display text-xl font-bold tracking-tight md:text-2xl">Resumen</h1>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              V2
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            {propertyCount} {propertyCount === 1 ? "propiedad" : "propiedades"} · {allUnits.length}{" "}
            {allUnits.length === 1 ? "unidad" : "unidades"} · {activeUnits.length} arrendadas ·{" "}
            {unrentedUnits.length} vacantes
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/rent/import" className="hidden sm:block">
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <FileUp className="h-4 w-4" /> Importar cartola
            </Button>
          </Link>
          <div className="flex items-center rounded-full border border-border/60 bg-card p-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() => setPeriod(addMonths(year, month, -1))}
              aria-label="Mes anterior"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[9ch] text-center text-xs font-medium">{periodLabel(year, month)}</span>
            <Button
              variant="ghost"
              size="icon-sm"
              className="rounded-full"
              onClick={() => setPeriod(addMonths(year, month, 1))}
              aria-label="Mes siguiente"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mt-7 space-y-7">
        {/* Nivel 1 */}
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

        {/* Nivel 2 */}
        <AttentionCard items={attentionItems} />

        {/* Nivel 3 */}
        <TrendLine data={trend} />

        {/* Servicios colapsados */}
        <ServicesSection
          organizationId={orgId}
          period={servicesMonitor.period}
          counts={servicesMonitor.counts}
          coverage={servicesMonitor.coverage}
          properties={serviceProperties}
          onSaved={() => void servicesMonitor.refetch()}
        />

        {/* Historial de cuentas */}
        <BillsPanel bills={billsQuery.data ?? []} labelFor={unitLabelFor} />

        {/* Estado por unidad */}
        <section id="unidades" className="scroll-mt-6">
          <Panel className="pb-5">
            <PanelHeader
              title={`Estado por unidad · ${periodLabel(year, month)}`}
              hint={`${filteredRows.length} de ${rows.length} unidades`}
              right={
                <Link
                  to="/properties"
                  className="text-xs text-muted-foreground transition-propz hover:text-foreground"
                >
                  Configurar arriendos →
                </Link>
              }
            />

            <div className="mt-4 flex flex-wrap items-center gap-2 px-5">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Buscar propiedad, unidad, arrendatario o monto…"
                  className="h-9 rounded-full pl-9"
                  aria-label="Filtrar unidades"
                />
              </div>
              <Button
                variant={onlyAttention ? "default" : "outline"}
                size="sm"
                className="h-9 rounded-full text-xs"
                aria-pressed={onlyAttention}
                onClick={() => setOnlyAttention((v) => !v)}
              >
                Requieren acción
              </Button>
              {filter ? (
                <Button variant="ghost" size="sm" className="h-9 rounded-full text-xs" onClick={() => setFilter("")}>
                  Limpiar
                </Button>
              ) : null}
            </div>

            <div className={cn("mt-5 px-5")}>
              {unitsQuery.isLoading ? (
                <p className="py-6 text-sm text-muted-foreground">Cargando…</p>
              ) : rows.length === 0 ? (
                <EmptyState />
              ) : filteredRows.length === 0 ? (
                <p className="py-6 text-sm text-muted-foreground">No hay unidades que coincidan con la búsqueda.</p>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {filteredRows.map((r) => (
                    <UnitCard
                      key={r.unit.id}
                      unit={r.unit}
                      propertyName={r.unit.properties?.name ?? "Propiedad"}
                      propertyId={r.unit.properties?.id ?? r.unit.property_id}
                      payment={r.payment}
                      status={r.status}
                      dueDate={dueDateFor(year, month, r.unit.payment_day)}
                      needsReview={!!(r.payment as any)?.needs_review}
                      onConfirm={() => confirmPayment(r.unit)}
                      onPartial={() => partialPayment(r.unit, r.payment)}
                      onUndo={r.payment ? () => undoConfirm(r.payment!.id) : undefined}
                      onEditAmount={() => editExpectedAmount(r.unit, r.payment)}
                      onClearReview={r.payment ? () => clearReview(r.payment!.id) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>
          </Panel>
        </section>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border py-10 text-center">
      <h3 className="section-title text-sm">Aún no hay arriendos activos</h3>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        Marca una unidad como arrendada y define su día de pago para ver el estado y confirmar cobros.
      </p>
      <Link to="/properties" className="mt-4 inline-block">
        <Button variant="outline" size="sm">
          <Plus className="mr-2 h-4 w-4" /> Configurar propiedades
        </Button>
      </Link>
    </div>
  );
}
