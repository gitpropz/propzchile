import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, MapPin, User, Calendar, AlertTriangle, Plus, ArrowRight, CalendarClock, CalendarX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatMoney, formatDate } from "@/lib/format";
import { UNIT_TYPE_LABELS } from "@/lib/property-types";
import { evaluateLease, leaseDaysLabel, LEASE_STATUS_META, formatLeaseDate, EXPIRY_WARNING_DAYS } from "@/lib/lease-expiry";
import type { Database } from "@/integrations/supabase/types";

type Unit = Database["public"]["Tables"]["rentable_units"]["Row"] & {
  properties: { id: string; name: string; address: string } | null;
};

export const Route = createFileRoute("/_authenticated/contracts/")({
  head: () => ({ meta: [{ title: "Contratos — Propz" }] }),
  component: ContractsIndex,
});

function ContractsIndex() {
  const org = useCurrentOrg();
  const orgId = org.data?.organization_id;

  const query = useQuery({
    queryKey: ["contracts", orgId],
    queryFn: async (): Promise<Unit[]> => {
      const { data, error } = await supabase
        .from("rentable_units")
        .select("*, properties:property_id(id, name, address)")
        .eq("organization_id", orgId!)
        .eq("rent_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Unit[];
    },
    enabled: !!orgId,
  });

  const units = query.data ?? [];
  const withMissingTenant = units.filter((u) => !u.tenant_name || !u.tenant_email);
  const today = new Date();

  // Vigencia de cada contrato, para ordenar por urgencia de vencimiento.
  const withLease = units.map((u) => ({ unit: u, lease: evaluateLease(u.rent_active, (u as any).rent_end_date, today) }));
  const expiringSoon = withLease.filter((c) => c.lease.status === "expiring").length;
  const expired = withLease.filter((c) => c.lease.status === "expired").length;

  // Orden: vencidos → por vencer → indefinidos → vigentes (cada grupo por fecha de término ascendente).
  const ranked = [...withLease].sort((a, b) => {
    const ra = LEASE_STATUS_META[a.lease.status].rank;
    const rb = LEASE_STATUS_META[b.lease.status].rank;
    if (ra !== rb) return rb - ra;
    // Dentro del mismo estado, el que vence antes (más negativo) primero.
    const da = a.lease.daysLeft ?? Number.POSITIVE_INFINITY;
    const db = b.lease.daysLeft ?? Number.POSITIVE_INFINITY;
    return da - db;
  });

  const currentMonthLabel = today.toLocaleDateString("es-CL", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Contratos activos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Todos los arriendos en curso y sus datos de contacto.
          </p>
        </div>
        <Link to="/properties">
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" /> Gestionar unidades
          </Button>
        </Link>
      </div>

      {expired > 0 && (
        <div className="mt-5 rounded-xl border border-destructive/40 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <CalendarX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {expired === 1 ? "1 contrato vencido" : `${expired} contratos vencidos`}
              </p>
              <p className="text-xs text-muted-foreground">
                Renueva o marca la unidad como vacante según corresponda.
              </p>
            </div>
          </div>
        </div>
      )}

      {expiringSoon > 0 && (
        <div className="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {expiringSoon === 1 ? "1 contrato" : `${expiringSoon} contratos`} vencen en los próximos {EXPIRY_WARNING_DAYS} días
              </p>
              <p className="text-xs text-muted-foreground">
                Anticípate a la renovación para evitar vacantes.
              </p>
            </div>
          </div>
        </div>
      )}

      {withMissingTenant.length > 0 && (
        <div className="mt-5 rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-sm font-medium text-foreground">
                {withMissingTenant.length === 1
                  ? "1 contrato"
                  : `${withMissingTenant.length} contratos`}{" "}
                sin datos completos del arrendatario
              </p>
              <p className="text-xs text-muted-foreground">
                Completa el nombre y email para tener un registro legal sólido.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6">
        {query.isLoading ? (
          <div className="text-sm text-muted-foreground">Cargando contratos…</div>
        ) : units.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {ranked.map(({ unit }) => (
              <ContractCard key={unit.id} unit={unit} />
            ))}
          </div>
        )}
      </div>

      {units.length > 0 && (
        <div className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold">Resumen — {currentMonthLabel}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Contratos activos</div>
              <div className="text-lg font-semibold tabular-nums">{units.length}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Arriendo base total</div>
              <div className="text-lg font-semibold tabular-nums">
                {formatMoney(
                  units.reduce((sum, u) => sum + Number(u.base_rent_amount ?? 0), 0),
                  org.data?.organizations?.default_currency ?? "CLP",
                )}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Por vencer</div>
              <div className="text-lg font-semibold tabular-nums text-warning">{expiringSoon}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Vencidos</div>
              <div className="text-lg font-semibold tabular-nums text-destructive">{expired}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContractCard({ unit }: { unit: Unit }) {
  const missingInfo = !unit.tenant_name || !unit.tenant_email;
  const rentStart = unit.rent_start_date ? new Date(unit.rent_start_date) : null;
  const nextPaymentDay = unit.payment_day ?? 5;
  const today = new Date();
  const lease = evaluateLease(unit.rent_active, (unit as any).rent_end_date, today);
  const nextPayment = new Date(today.getFullYear(), today.getMonth(), nextPaymentDay);
  if (nextPayment < today) {
    nextPayment.setMonth(nextPayment.getMonth() + 1);
  }
  const daysToPayment = Math.round((nextPayment.getTime() - today.getTime()) / 86_400_000);

  const expiryMeta =
    lease.status === "expiring" || lease.status === "expired" ? LEASE_STATUS_META[lease.status] : null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:border-brand/50">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <h3 className="truncate font-semibold">{unit.label}</h3>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {UNIT_TYPE_LABELS[unit.unit_type]} · {unit.properties?.name ?? "Propiedad"}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {expiryMeta ? (
            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${expiryMeta.className}`}>
              {expiryMeta.label}
            </span>
          ) : missingInfo ? (
            <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning">
              Incompleto
            </span>
          ) : (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
              Activo
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="line-clamp-2">{unit.properties?.address ?? "Sin dirección"}</span>
      </div>

      <div className="mt-4 grid gap-3 rounded-lg border border-border bg-muted/30 p-3 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{unit.tenant_name || "Sin arrendatario"}</div>
            {unit.tenant_email && (
              <div className="truncate text-xs text-muted-foreground">{unit.tenant_email}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="text-sm font-medium">{formatMoney(unit.base_rent_amount, unit.base_rent_currency)}</div>
            <div className="text-xs text-muted-foreground">
              Pago día {unit.payment_day ?? 5} · {daysToPayment} días
            </div>
          </div>
        </div>
      </div>

      {rentStart && (
        <div className="mt-3 text-xs text-muted-foreground">
          Inicio de arriendo: {formatDate(rentStart.toISOString())}
        </div>
      )}

      {(unit as any).rent_end_date ? (
        <div className={`mt-1.5 text-xs ${lease.status === "expired" ? "text-destructive" : lease.status === "expiring" ? "text-warning" : "text-muted-foreground"}`}>
          Término: {formatLeaseDate((unit as any).rent_end_date)}
          {lease.daysLeft != null ? ` · ${leaseDaysLabel(lease.daysLeft)}` : ""}
        </div>
      ) : unit.rent_active ? (
        <div className="mt-1.5 text-xs text-muted-foreground">Término: no definido (indefinido)</div>
      ) : null}

      <Link
        to="/properties/$id"
        params={{ id: unit.property_id }}
        className="mt-4 inline-flex items-center gap-1 text-sm text-brand hover:underline"
      >
        Ver propiedad <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-card/50 p-10 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-secondary text-secondary-foreground">
        <FileText className="h-6 w-6" />
      </div>
      <h3 className="mt-4 font-semibold">No hay contratos activos</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
        Marca una unidad como "arrendada" dentro de una propiedad para verla aquí.
      </p>
      <Link to="/properties" className="mt-5 inline-block">
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Ir a propiedades
        </Button>
      </Link>
    </div>
  );
}
