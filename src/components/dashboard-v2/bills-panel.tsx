import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, FileUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/dashboard-v2/primitives";
import { formatCLP, formatMoney } from "@/lib/format";
import { daysSinceDue } from "@/lib/rent-status";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Bill = Database["public"]["Tables"]["unit_bills"]["Row"];

const BILL_LABELS: Record<string, string> = {
  gastos_comunes: "Gastos comunes",
  agua: "Agua",
  luz: "Luz",
  gas: "Gas",
  internet: "Internet",
  otro: "Otro",
};

function billStatus(b: Bill) {
  const overdue = daysSinceDue(b.due_date);
  if (overdue < 0) return { label: "Por vencer", cls: "bg-muted text-muted-foreground", overdue };
  if (overdue <= 5)
    return { label: `Atrasado ${overdue === 0 ? "hoy" : `${overdue}d`}`, cls: "bg-warning/15 text-warning", overdue };
  return { label: `Atrasado ${overdue}d`, cls: "bg-destructive/10 text-destructive", overdue };
}

/** Historial de cuentas cargadas manualmente — colapsado por defecto. */
export function BillsPanel({
  bills,
  labelFor,
}: {
  bills: Bill[];
  labelFor: (unitId: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(() => [...bills].sort((a, b) => a.due_date.localeCompare(b.due_date)), [bills]);
  if (sorted.length === 0) return null;

  const overdue = sorted.filter((b) => daysSinceDue(b.due_date) > 0).length;
  const total = sorted.reduce((sum, b) => sum + Number(b.amount ?? 0), 0);

  return (
    <Panel className="pb-4">
      <PanelHeader
        title="Cuentas registradas"
        hint={`${sorted.length} pendientes · ${overdue} atrasadas · Total ${formatCLP(total)}`}
        right={
          <div className="flex items-center gap-1">
            <Link to="/services/update">
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
                <FileUp className="h-3.5 w-3.5" /> Cargar
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
            >
              {open ? "Ocultar" : "Ver más"}
              <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
            </Button>
          </div>
        }
      />
      {open ? (
        <ul className="mt-3 px-2 animate-in fade-in slide-in-from-top-1">
          {sorted.map((b) => {
            const meta = billStatus(b);
            return (
              <li
                key={b.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl px-3 py-2.5 transition-propz hover:bg-muted/50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm text-foreground">{labelFor(b.unit_id)}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {BILL_LABELS[b.category] ?? b.category}
                    {b.period ? ` · ${b.period}` : ""} · Vence {b.due_date}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm font-semibold tabular text-foreground">
                    {formatMoney(Number(b.amount), b.currency)}
                  </span>
                  <span className={cn("rounded-full px-2 py-0.5 text-[11px]", meta.cls)}>{meta.label}</span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Panel>
  );
}
