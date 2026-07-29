import { cleanRut } from "@/lib/rut";
import type { StandardMovement } from "./types";

/**
 * Motor de identificación de pagos — común a TODOS los bancos.
 * Solo consume `StandardMovement`, nunca formatos de banco.
 */

export type PayerIdentity = {
  unitId: string;
  ruts: string[];
  accounts: string[];
  names: string[];
};

export type MatchReason = "rut" | "account" | "name" | "alias" | "fuzzy" | "none";
export type MatchConfidence = "exact" | "suggestion" | "manual" | "none";

export type MatchResult = {
  unitId: string | null;
  reason: MatchReason;
  confidence: MatchConfidence;
  score: number;
};

const STOPWORDS = new Set([
  "de", "del", "la", "el", "los", "las", "y", "sa", "spa", "ltda", "eirl",
  "transferencia", "transf", "abono", "deposito", "pago", "tef", "desde", "banco",
]);

export function normalizeName(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(input: string): string[] {
  return normalizeName(input)
    .split(" ")
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function normalizeAccount(input: string | null | undefined): string {
  if (!input) return "";
  return input.replace(/\D/g, "").replace(/^0+/, "");
}

/** Similitud de Dice sobre tokens (0..1). */
export function nameSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  let hits = 0;
  for (const t of new Set(ta)) if (setB.has(t)) hits++;
  return (2 * hits) / (new Set(ta).size + setB.size);
}

type UnitLike = {
  id: string;
  tenant_name?: string | null;
  tenant_rut?: string | null;
  tenant_ruts?: string[] | null;
  tenant_aliases?: string[] | null;
  tenant_account_numbers?: string[] | null;
};

/** Construye los identificadores de pago de cada contrato/unidad. */
export function buildPayerIndex(units: UnitLike[]): PayerIdentity[] {
  return units.map((u) => {
    const ruts = new Set<string>();
    const c = cleanRut(u.tenant_rut ?? "");
    if (c) ruts.add(c);
    for (const r of u.tenant_ruts ?? []) {
      const cr = cleanRut(r);
      if (cr) ruts.add(cr);
    }
    const accounts = new Set<string>();
    for (const a of u.tenant_account_numbers ?? []) {
      const na = normalizeAccount(a);
      if (na) accounts.add(na);
    }
    const names = new Set<string>();
    const n = normalizeName(u.tenant_name);
    if (n) names.add(n);
    for (const a of u.tenant_aliases ?? []) {
      const na = normalizeName(a);
      if (na) names.add(na);
    }
    return {
      unitId: u.id,
      ruts: [...ruts],
      accounts: [...accounts],
      names: [...names],
    };
  });
}

const FUZZY_THRESHOLD = 0.7;

/**
 * Identifica a qué contrato pertenece un movimiento.
 * Orden: RUT → cuenta de origen → nombre exacto → alias → fuzzy.
 */
export function matchMovement(mv: StandardMovement, index: PayerIdentity[]): MatchResult {
  const rut = mv.payer_rut ? cleanRut(mv.payer_rut) : "";
  if (rut) {
    const hit = index.find((p) => p.ruts.includes(rut));
    if (hit) return { unitId: hit.unitId, reason: "rut", confidence: "exact", score: 1 };
  }

  const haystack = `${mv.description} ${mv.payer_name ?? ""}`;
  const digits = haystack.replace(/\D/g, "");

  const acc = normalizeAccount(mv.payer_account);
  if (acc) {
    const hit = index.find((p) => p.accounts.includes(acc));
    if (hit) return { unitId: hit.unitId, reason: "account", confidence: "exact", score: 1 };
  }
  // La cuenta puede venir embebida en la glosa sin etiqueta.
  const accHit = index.find((p) => p.accounts.some((a) => a.length >= 6 && digits.includes(a)));
  if (accHit) return { unitId: accHit.unitId, reason: "account", confidence: "exact", score: 0.95 };

  const payer = normalizeName(mv.payer_name);
  const glosa = normalizeName(mv.description);

  if (payer) {
    const exact = index.find((p) => p.names.includes(payer));
    if (exact) return { unitId: exact.unitId, reason: "name", confidence: "exact", score: 1 };
  }
  // Nombre o alias contenido literalmente en la glosa.
  const contained = index.find((p) =>
    p.names.some((n) => n.length >= 6 && (glosa.includes(n) || payer.includes(n))),
  );
  if (contained) return { unitId: contained.unitId, reason: "alias", confidence: "exact", score: 0.9 };

  // Fuzzy: mejor similitud sobre nombre del depositante y sobre la glosa.
  let best: { unitId: string; score: number } | null = null;
  for (const p of index) {
    for (const n of p.names) {
      const s = Math.max(nameSimilarity(n, payer), nameSimilarity(n, glosa));
      if (s > (best?.score ?? 0)) best = { unitId: p.unitId, score: s };
    }
  }
  if (best && best.score >= FUZZY_THRESHOLD) {
    return { unitId: best.unitId, reason: "fuzzy", confidence: "suggestion", score: best.score };
  }

  return { unitId: null, reason: "none", confidence: "none", score: 0 };
}

export const MATCH_REASON_LABEL: Record<MatchReason, string> = {
  rut: "RUT",
  account: "Cuenta origen",
  name: "Nombre",
  alias: "Alias",
  fuzzy: "Nombre aprox.",
  none: "Sin match",
};
