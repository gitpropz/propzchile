import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, FileUp, Loader2, Sparkles, Trash2, WandSparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentOrg } from "@/hooks/use-current-org";
import { formatCLP, formatDate } from "@/lib/format";
import { errorToString } from "@/lib/bank-parsers";
import { parseStatement } from "@/lib/bank/registry";
import type { StandardMovement } from "@/lib/bank/types";
import {
  buildPayerIndex,
  matchMovement,
  MATCH_REASON_LABEL,
  type MatchConfidence,
  type MatchReason,
} from "@/lib/bank/matching";
import { formatRut } from "@/lib/rut";
import { ensureRentPayment } from "@/lib/rent-allocations";
import { toISODate } from "@/lib/rent-status";
import { suggestMatchWithAiFn } from "@/lib/ai-reconciliation.functions";
import type { UnitCandidate } from "@/lib/ai-reconciliation.server";
import type { Database } from "@/integrations/supabase/types";

type Unit = Database["public"]["Tables"]["rentable_units"]["Row"] & {
  properties: { id: string; name: string } | null;
  tenant_ruts?: string[] | null;
  tenant_aliases?: string[] | null;
  tenant_account_numbers?: string[] | null;
};

type ReviewTx = StandardMovement & {
  id: string;
  statementId: string;
  matchedUnitId: string | null;
  matchConfidence: MatchConfidence;
  matchReason: MatchReason;
  period: { year: number; month: number };
  include: boolean;
};

type StatementDraft = {
  id: string;
  file: File;
  parser: string;
  bankName: string;
  accountNumber: string;
  periodYear: number;
  periodMonth: number;
};

export const Route = createFileRoute("/_authenticated/rent/import")({
  ssr: false,
  head: () => ({ meta: [{ title: "Importar cartola bancaria — Propz" }] }),
  component: ImportPage,
});

const REVIEW_DEVIATION = 0.2;

function guessPeriod(movs: StandardMovement[]): { year: number; month: number } {
  const now = new Date();
  const counts = new Map<string, number>();
  for (const t of movs) {
    const [y, m] = t.date.split("-").map(Number);
    if (!y || !m) continue;
    const k = `${y}-${m}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  let bestK = "";
  let bestV = 0;
  for (const [k, v] of counts) if (v > bestV) { bestV = v; bestK = k; }
  if (!bestK) return { year: now.getFullYear(), month: now.getMonth() + 1 };
  const [y, m] = bestK.split("-").map(Number);
  return { year: y, month: m };
}

function ImportPage() {
  const org = useCurrentOrg();
  const orgId = org.data?.organization_id;
  const qc = useQueryClient();

  const [parsing, setParsing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [statements, setStatements] = useState<StatementDraft[]>([]);
  const [rows, setRows] = useState<ReviewTx[]>([]);
  const [aiLoading, setAiLoading] = useState<Set<string>>(new Set());

  const unitsQuery = useQuery({
    queryKey: ["import-units", orgId],
    queryFn: async (): Promise<Unit[]> => {
      const { data, error } = await supabase
        .from("rentable_units")
        .select("*, properties:property_id(id,name)")
        .eq("organization_id", orgId!);
      if (error) throw error;
      return (data ?? []) as Unit[];
    },
    enabled: !!orgId,
  });
  const units = unitsQuery.data ?? [];

  /** Identificadores de pago por contrato: RUT, cuentas, nombres y alias. */
  const payerIndex = useMemo(() => buildPayerIndex(units as any), [units]);

  async function handleFiles(files: File[]) {
    if (!files.length) return;
    setParsing(true);
    try {
      const newStatements: StatementDraft[] = [];
      const newRows: ReviewTx[] = [];
      for (const f of files) {
        const stmtId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        try {
          const { movements, meta, parser } = await parseStatement(f);
          const credits = movements.filter((m) => m.type === "credit" && m.amount > 0);
          const period = guessPeriod(credits);
          // El encabezado de la cartola manda por sobre la inferencia de fechas.
          const periodYear = meta.period_year ?? period.year;
          const periodMonth = meta.period_month ?? period.month;
          newStatements.push({
            id: stmtId,
            file: f,
            parser,
            bankName: meta.bank_name ?? "",
            accountNumber: meta.account_number ?? "",
            periodYear,
            periodMonth,
          });
          credits.forEach((mv, i) => {
            const match = matchMovement(mv, payerIndex);
            const [y, m] = mv.date.split("-").map(Number);
            newRows.push({
              ...mv,
              id: `${stmtId}-${i}`,
              statementId: stmtId,
              matchedUnitId: match.unitId,
              matchConfidence: match.confidence,
              matchReason: match.reason,
              period: { year: y || periodYear, month: m || periodMonth },
              include: true,
            });
          });
        } catch (err) {
          toast.error(`No pudimos leer ${f.name}`, { description: errorToString(err) });
        }
      }
      setStatements((s) => [...s, ...newStatements]);
      setRows((r) => [...r, ...newRows]);
      const matched = newRows.filter((r) => r.matchedUnitId).length;
      if (newRows.length > 0) {
        toast.success(`${newRows.length} abono(s) detectados en ${newStatements.length} cartola(s)`, {
          description: `${matched} identificados automáticamente`,
        });
      }
    } finally {
      setParsing(false);
    }
  }

  function updateRow(id: string, patch: Partial<ReviewTx>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  /** Construye la lista de unidades candidatas para la IA (solo arrendadas). */
  function buildCandidates(): UnitCandidate[] {
    return units
      .filter((u) => u.rent_active)
      .map((u) => ({
        unitId: u.id,
        label: u.label,
        propertyName: u.properties?.name ?? "",
        tenantName: u.tenant_name ?? null,
        tenantRut: (u as any).tenant_rut ?? null,
        tenantAliases: (u.tenant_aliases ?? []) as string[],
        tenantAccountNumbers: (u.tenant_account_numbers ?? []) as string[],
        baseRentAmount: u.base_rent_amount != null ? Number(u.base_rent_amount) : null,
      }));
  }

  async function suggestWithAi(rowId: string) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    setAiLoading((s) => new Set(s).add(rowId));
    try {
      const result = await suggestMatchWithAiFn({
        data: {
          movement: {
            date: row.date,
            amount: row.amount,
            type: row.type,
            payer_name: row.payer_name,
            payer_rut: row.payer_rut,
            payer_account: row.payer_account,
            payer_bank: row.payer_bank,
            operation_number: row.operation_number,
            description: row.description,
            raw: row.raw,
          },
          candidates: buildCandidates(),
        },
      });
      const sug = result.suggestion;
      if (sug.unitId) {
        updateRow(rowId, {
          matchedUnitId: sug.unitId,
          matchConfidence: "suggestion",
          matchReason: "fuzzy",
        });
        const unit = units.find((u) => u.id === sug.unitId);
        toast.success(`IA sugiere: ${unit?.properties?.name ?? ""} · ${unit?.label ?? ""}`, {
          description: `${sug.confidence === "high" ? "Alta" : sug.confidence === "medium" ? "Media" : "Baja"} confianza · ${sug.reason}`,
        });
      } else {
        toast.info("La IA no pudo identificar el movimiento", { description: sug.reason });
      }
    } catch (e) {
      toast.error("No pudimos analizar con IA", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setAiLoading((s) => {
        const next = new Set(s);
        next.delete(rowId);
        return next;
      });
    }
  }

  function updateStatement(id: string, patch: Partial<StatementDraft>) {
    setStatements((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  }

  function removeStatement(id: string) {
    setStatements((ss) => ss.filter((s) => s.id !== id));
    setRows((rs) => rs.filter((r) => r.statementId !== id));
  }

  async function applyAll() {
    if (!orgId) return;
    if (statements.length === 0) return;
    const incomplete = statements.find(
      (s) => !s.bankName.trim() || !s.accountNumber.trim() || !s.periodYear || !s.periodMonth,
    );
    if (incomplete) {
      toast.error("Completa banco, cuenta, mes y año en todas las cartolas");
      return;
    }
    const toApply = rows.filter((r) => r.include && r.matchedUnitId);
    if (toApply.length === 0) {
      toast.error("No hay movimientos listos para aplicar");
      return;
    }
    setApplying(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const insertedTxByRowId = new Map<string, string>();

      for (const stmt of statements) {
        const stmtRows = rows.filter((r) => r.statementId === stmt.id);
        const stmtApply = stmtRows.filter((r) => r.include && r.matchedUnitId);

        // 0. Reemplazo por clave única (banco + cuenta + mes + año):
        // se elimina la versión anterior y sus abonos para no duplicar.
        const { data: prev, error: prevErr } = await supabase
          .from("bank_statement_imports")
          .select("id")
          .eq("organization_id", orgId)
          .eq("bank_name", stmt.bankName.trim())
          .eq("account_number", stmt.accountNumber.trim())
          .eq("period_year", stmt.periodYear)
          .eq("period_month", stmt.periodMonth)
          .maybeSingle();
        if (prevErr) throw prevErr;
        if (prev?.id) {
          const { data: oldTx, error: oldTxErr } = await supabase
            .from("bank_transactions")
            .select("id")
            .eq("import_id", prev.id);
          if (oldTxErr) throw oldTxErr;
          const oldTxIds = (oldTx ?? []).map((t) => t.id);
          if (oldTxIds.length) {
            const { error: delAllocErr } = await supabase
              .from("rent_payment_allocations")
              .delete()
              .in("bank_transaction_id", oldTxIds);
            if (delAllocErr) throw delAllocErr;
            const { error: delTxErr } = await supabase
              .from("bank_transactions")
              .delete()
              .in("id", oldTxIds);
            if (delTxErr) throw delTxErr;
          }
          const { error: delImpErr } = await supabase
            .from("bank_statement_imports")
            .delete()
            .eq("id", prev.id);
          if (delImpErr) throw delImpErr;
        }

        // 1. Registro de la cartola.
        const { data: imp, error: impErr } = await supabase
          .from("bank_statement_imports")
          .insert({
            organization_id: orgId,
            file_name: stmt.file.name,
            bank_name: stmt.bankName.trim(),
            account_number: stmt.accountNumber.trim(),
            period_year: stmt.periodYear,
            period_month: stmt.periodMonth,
            transactions_count: stmtRows.length,
            matched_count: stmtApply.length,
            uploaded_by: userData.user?.id ?? null,
            raw_transactions: stmtRows as any,
            applied: true,
          } as any)
          .select("id")
          .single();
        if (impErr) throw impErr;

        // 2. Movimientos en formato estándar.
        for (const r of stmtApply) {
          const unit = units.find((u) => u.id === r.matchedUnitId);
          if (!unit) continue;
          const { data: tx, error: txErr } = await supabase
            .from("bank_transactions")
            .insert({
              organization_id: orgId,
              import_id: imp.id,
              tx_date: r.date,
              description: r.description,
              counterparty_name: r.payer_name,
              counterparty_rut: r.payer_rut,
              counterparty_account: r.payer_account,
              counterparty_bank: r.payer_bank,
              operation_number: r.operation_number,
              movement_type: r.type,
              amount: r.amount,
              currency: (unit.base_rent_currency as any) ?? "CLP",
              matched_unit_id: unit.id,
              match_status: "matched",
              match_confidence: r.matchConfidence,
            } as any)
            .select("id")
            .single();
          if (txErr) throw txErr;
          insertedTxByRowId.set(r.id, tx.id);
        }
      }

      // 3. Conciliación común: consolida por (unidad, año, mes) sumando abonos
      //    de cualquier RUT/cuenta/banco y de cualquier cartola de esta carga.
      type Group = { unit: Unit; year: number; month: number; rows: ReviewTx[] };
      const groups = new Map<string, Group>();
      for (const r of toApply) {
        const unit = units.find((u) => u.id === r.matchedUnitId);
        if (!unit) continue;
        const key = `${unit.id}:${r.period.year}:${r.period.month}`;
        const g = groups.get(key) ?? { unit, year: r.period.year, month: r.period.month, rows: [] };
        g.rows.push(r);
        groups.set(key, g);
      }

      let ok = 0;
      let flagged = 0;
      for (const g of groups.values()) {
        const day = g.unit.payment_day ?? 5;
        const last = new Date(g.year, g.month, 0).getDate();
        const due = toISODate(new Date(g.year, g.month - 1, Math.min(day, last)));
        const paymentId = await ensureRentPayment({
          organizationId: orgId,
          unit: g.unit,
          year: g.year,
          month: g.month,
          dueDate: due,
        });

        const allocRows = g.rows.map((r) => ({
          organization_id: orgId,
          rent_payment_id: paymentId,
          amount: r.amount,
          paid_date: r.date,
          source: "bank_import" as const,
          notes: r.description,
          bank_transaction_id: insertedTxByRowId.get(r.id) ?? null,
          created_by: userData.user?.id ?? null,
        }));
        const { error: allocErr } = await supabase
          .from("rent_payment_allocations")
          .insert(allocRows as any);
        if (allocErr) throw allocErr;

        // Validación de monto vs arriendo esperado.
        const total = g.rows.reduce((s, r) => s + r.amount, 0);
        const base = Number(g.unit.base_rent_amount ?? 0);
        let needsReview = false;
        if (base > 0) {
          const dev = Math.abs(total - base) / base;
          if (dev > REVIEW_DEVIATION) needsReview = true;
        }
        if (needsReview) {
          const { error: updErr } = await supabase
            .from("rent_payments")
            .update({ needs_review: true } as any)
            .eq("id", paymentId);
          if (updErr) throw updErr;
          flagged++;
        }
        ok += g.rows.length;
      }

      toast.success(`${ok} movimiento(s) aplicados en ${groups.size} período(s)`, {
        description: flagged > 0 ? `${flagged} requiere(n) revisión (>20% de diferencia)` : undefined,
      });
      qc.invalidateQueries({ queryKey: ["dash-payments", orgId] });
      setRows([]);
      setStatements([]);
    } catch (err) {
      toast.error("Error aplicando la cartola", { description: errorToString(err) });
    } finally {
      setApplying(false);
    }
  }

  const included = rows.filter((r) => r.include && r.matchedUnitId);
  const totalIncluded = included.length;
  const totalAmount = included.reduce((s, r) => s + r.amount, 0);
  const unidentified = rows.filter((r) => !r.matchedUnitId).length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-4 md:px-6 md:py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Importar cartolas bancarias</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Compatible con cualquier banco: extraemos los movimientos según el formato de cada cartola y la
            conciliación es la misma para todos (RUT, cuenta de origen, nombre o alias del depositante).
          </p>
        </div>
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-1 h-4 w-4" /> Volver al panel
          </Button>
        </Link>
      </div>

      <section className="mt-4 rounded-xl border border-dashed border-border bg-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Subir cartolas</div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              Formatos: .xlsx, .xls, .csv o .pdf · puedes seleccionar varias a la vez
            </div>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:bg-muted">
            <FileUp className="h-4 w-4" />
            Agregar cartolas
            <input
              type="file"
              multiple
              accept=".xlsx,.xls,.csv,.pdf"
              className="hidden"
              onChange={(e) => {
                const fs = Array.from(e.target.files ?? []);
                e.target.value = "";
                if (fs.length) handleFiles(fs);
              }}
            />
          </label>
        </div>
        {parsing ? (
          <div className="mt-3 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> analizando…
          </div>
        ) : null}

        {statements.length > 0 ? (
          <div className="mt-4 space-y-3">
            {statements.map((s) => (
              <div key={s.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-xs font-medium">
                    {s.file.name}
                    <span className="ml-2 rounded-full border border-border px-1.5 py-0 text-[10px] font-normal text-muted-foreground">
                      parser: {s.parser}
                    </span>
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                      {rows.filter((r) => r.statementId === s.id).length} abonos
                    </span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeStatement(s.id)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Banco</Label>
                    <Input
                      className="h-8"
                      value={s.bankName}
                      onChange={(e) => updateStatement(s.id, { bankName: e.target.value })}
                      placeholder="Ej: Banco de Chile"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">N° de cuenta</Label>
                    <Input
                      className="h-8"
                      value={s.accountNumber}
                      onChange={(e) => updateStatement(s.id, { accountNumber: e.target.value })}
                      placeholder="000123456789"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Mes</Label>
                    <Input
                      className="h-8"
                      type="number"
                      min={1}
                      max={12}
                      value={s.periodMonth}
                      onChange={(e) => updateStatement(s.id, { periodMonth: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Año</Label>
                    <Input
                      className="h-8"
                      type="number"
                      value={s.periodYear}
                      onChange={(e) => updateStatement(s.id, { periodYear: Number(e.target.value) })}
                    />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              Clave única de cada cartola: banco + cuenta + mes + año. Si vuelves a subir la misma con más
              movimientos, se reemplaza la versión anterior y no se duplican ingresos.
            </p>
          </div>
        ) : null}
      </section>

      {rows.length > 0 ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
            <div className="text-muted-foreground">
              <span className="font-medium text-foreground">{totalIncluded}</span> de {rows.length} listos para
              aplicar · Total {formatCLP(totalAmount)}
            </div>
            <Button size="sm" onClick={applyAll} disabled={applying || totalIncluded === 0}>
              {applying ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Sparkles className="mr-1 h-4 w-4" />}
              Aplicar a arriendos
            </Button>
          </div>

          {unidentified > 0 ? (
            <div className="mt-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs">
              Hay {unidentified} movimiento(s) sin identificar. Agrega el RUT, nombre/alias o cuenta de origen del
              pagador en la ficha de la unidad en{" "}
              <Link className="underline" to="/properties">Propiedades</Link>, o asigna la unidad manualmente abajo.
            </div>
          ) : null}

          <div className="mt-3 overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Depositante / glosa</th>
                  <th className="px-3 py-2 text-left">RUT / cuenta</th>
                  <th className="px-3 py-2 text-right">Abono</th>
                  <th className="px-3 py-2 text-left">Unidad</th>
                  <th className="px-3 py-2 text-left">Período</th>
                  <th className="px-3 py-2 text-right"> </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className={!r.include ? "opacity-40" : undefined}>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">{formatDate(r.date)}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.payer_name ? <div className="font-medium">{r.payer_name}</div> : null}
                      <div className="line-clamp-2 max-w-[22rem] text-muted-foreground">{r.description}</div>
                      {r.payer_bank || r.operation_number ? (
                        <div className="text-[10px] text-muted-foreground">
                          {[r.payer_bank, r.operation_number ? `op. ${r.operation_number}` : null]
                            .filter(Boolean)
                            .join(" · ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs">
                      <div>{r.payer_rut ? formatRut(r.payer_rut) : "—"}</div>
                      {r.payer_account ? (
                        <div className="text-[10px] text-muted-foreground">cta {r.payer_account}</div>
                      ) : null}
                      {r.matchedUnitId ? (
                        <div
                          className={
                            r.matchConfidence === "exact"
                              ? "text-[10px] text-success"
                              : "text-[10px] text-warning"
                          }
                        >
                          match: {MATCH_REASON_LABEL[r.matchReason]}
                        </div>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-xs">
                      {formatCLP(r.amount)}
                    </td>
                    <td className="px-3 py-2">
                      <Select
                        value={r.matchedUnitId ?? ""}
                        onValueChange={(v) =>
                          updateRow(r.id, {
                            matchedUnitId: v || null,
                            matchConfidence: v ? "manual" : "none",
                            matchReason: "none",
                          })
                        }
                      >
                        <SelectTrigger className="h-8 min-w-[14rem] text-xs">
                          <SelectValue placeholder="Sin asignar" />
                        </SelectTrigger>
                        <SelectContent>
                          {units.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.properties?.name} · {u.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Input
                          type="number"
                          className="h-8 w-16 text-xs"
                          value={r.period.month}
                          min={1}
                          max={12}
                          onChange={(e) =>
                            updateRow(r.id, { period: { ...r.period, month: Number(e.target.value) } })
                          }
                        />
                        <Input
                          type="number"
                          className="h-8 w-20 text-xs"
                          value={r.period.year}
                          onChange={(e) =>
                            updateRow(r.id, { period: { ...r.period, year: Number(e.target.value) } })
                          }
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label="Descartar"
                        onClick={() => updateRow(r.id, { include: !r.include })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-muted-foreground">
            Tip: si un contrato tiene varios pagadores, agrega todos sus RUT, nombres/alias y cuentas de origen en
            la ficha de la unidad; el sistema sumará automáticamente todos sus abonos del mes, aunque vengan de
            distintos bancos o cartolas.
          </div>
        </>
      ) : null}
    </div>
  );
}
