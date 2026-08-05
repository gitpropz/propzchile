import { Link } from "@tanstack/react-router";
import { AlertTriangle, Check, Eye, MoreHorizontal, Pencil, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatMoney } from "@/lib/format";
import { STATUS_META, type PaymentStatus, type RentPayment } from "@/lib/rent-status";
import { cn } from "@/lib/utils";
import { ProgressLine } from "@/components/dashboard-v2/primitives";

type MinimalUnit = {
  id: string;
  label: string | null;
  property_id: string;
  tenant_name: string | null;
  tenant_contact: string | null;
  rent_start_date: string | null;
  base_rent_amount: number | null;
  base_rent_currency: string | null;
  notes: string | null;
};

const TONE: Record<PaymentStatus, { ring: string; text: string; chip: string }> = {
  paid: { ring: "bg-success", text: "text-success", chip: "bg-success/10 text-success" },
  partial: { ring: "bg-warning", text: "text-warning", chip: "bg-warning/15 text-warning" },
  upcoming: { ring: "bg-muted-foreground/40", text: "text-muted-foreground", chip: "bg-muted text-muted-foreground" },
  warn: { ring: "bg-warning", text: "text-warning", chip: "bg-warning/15 text-warning" },
  late: { ring: "bg-destructive", text: "text-destructive", chip: "bg-destructive/10 text-destructive" },
  inactive: { ring: "bg-muted-foreground/30", text: "text-muted-foreground", chip: "bg-muted text-muted-foreground" },
};

/** Tarjeta de unidad estilo tarjeta bancaria: poco texto, mucho contraste. */
export function UnitCard({
  unit,
  propertyName,
  propertyId,
  payment,
  status,
  dueDate,
  needsReview,
  onConfirm,
  onPartial,
  onUndo,
  onEditAmount,
  onClearReview,
}: {
  unit: MinimalUnit;
  propertyName: string;
  propertyId: string;
  payment: RentPayment | null;
  status: PaymentStatus;
  dueDate: string;
  needsReview: boolean;
  onConfirm: () => void;
  onPartial: () => void;
  onUndo?: () => void;
  onEditAmount: () => void;
  onClearReview?: () => void;
}) {
  const meta = STATUS_META[status];
  const tone = TONE[status];
  const total = payment?.amount != null ? Number(payment.amount) : Number(unit.base_rent_amount ?? 0);
  const paid = Number(payment?.amount_paid ?? 0);
  const remaining = Math.max(0, total - paid);
  const currency = payment?.currency ?? unit.base_rent_currency ?? "CLP";
  const progress = total > 0 ? Math.min(100, (paid / total) * 100) : status === "paid" ? 100 : 0;
  const tenant = status === "inactive" ? "Sin arrendatario" : unit.tenant_name || "Sin arrendatario";

  return (
    <div className="group rounded-2xl border border-border/60 bg-card p-5 shadow-xs transition-propz hover:border-border hover:shadow-md">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium text-foreground">{propertyName}</div>
          <div className="truncate text-xs text-muted-foreground">
            {unit.label ?? "Unidad"} · {tenant}
          </div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium",
            tone.chip,
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", tone.ring)} aria-hidden />
          {meta.label}
        </span>
      </div>

      <div className="mt-4">
        <div className="font-display text-xl font-bold tabular text-foreground">{formatMoney(paid, currency)}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground">
          de {formatMoney(total, currency)}
          {remaining > 0 && status !== "inactive" ? ` · saldo ${formatMoney(remaining, currency)}` : ""}
        </div>
        <ProgressLine
          pct={progress}
          tone={status === "late" ? "danger" : status === "paid" ? "success" : "warning"}
          className="mt-3 h-1"
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        {needsReview ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-warning">
            <AlertTriangle className="h-3 w-3" /> Revisar
          </span>
        ) : null}

        {status === "inactive" ? (
          <Link
            to="/properties/$id"
            params={{ id: propertyId }}
            search={{ tab: "units", unit: unit.id }}
            className="flex-1"
          >
            <Button variant="outline" size="sm" className="h-8 w-full text-xs">
              Asignar arrendatario
            </Button>
          </Link>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onEditAmount}>
              <Pencil className="mr-1 h-3.5 w-3.5" /> Editar
            </Button>
            {status === "paid" ? (
              <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={onPartial}>
                <Wallet className="mr-1 h-3.5 w-3.5" /> Abonar
              </Button>
            ) : (
              <Button size="sm" className="h-8 px-2 text-xs" onClick={onConfirm}>
                <Check className="mr-1 h-3.5 w-3.5" /> Registrar pago
              </Button>
            )}
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Ver detalle">
                <Eye className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-auto max-h-[85vh] rounded-t-3xl">
              <SheetHeader className="pb-2">
                <SheetTitle className="text-base">
                  {propertyName} · {unit.label ?? "Unidad"}
                </SheetTitle>
              </SheetHeader>
              <dl className="grid gap-4 px-4 pb-6 text-sm sm:grid-cols-2">
                <Info label="Estado" value={meta.label} />
                <Info label="Vencimiento" value={status === "inactive" ? "—" : dueDate} />
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
            </SheetContent>
          </Sheet>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Más acciones">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel className="text-xs">Acciones avanzadas</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {status !== "inactive" ? (
                <>
                  <DropdownMenuItem onClick={onPartial}>Registrar abono parcial</DropdownMenuItem>
                  <DropdownMenuItem onClick={onEditAmount}>Editar monto abonado</DropdownMenuItem>
                  {onUndo ? (
                    <DropdownMenuItem onClick={onUndo} className="text-destructive">
                      Revertir abonos
                    </DropdownMenuItem>
                  ) : null}
                  {needsReview && onClearReview ? (
                    <DropdownMenuItem onClick={onClearReview}>Marcar como revisado</DropdownMenuItem>
                  ) : null}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuItem asChild>
                <Link to="/properties/$id" params={{ id: propertyId }} search={{ tab: "units", unit: unit.id }}>
                  Configurar unidad
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-0.5 text-foreground">{value}</dd>
    </div>
  );
}
