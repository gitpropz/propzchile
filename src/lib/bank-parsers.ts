import * as XLSX from "xlsx";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { cleanRut, extractRuts } from "@/lib/rut";

export type ParsedTx = {
  tx_date: string; // YYYY-MM-DD (local, no TZ conversion)
  description: string;
  counterparty_name: string | null;
  counterparty_rut: string | null; // cleaned (no dots/dash)
  amount: number; // positive = credit (ingreso). We only keep credits.
  raw: unknown;
};

export type BankMeta = {
  bank_name: string | null;
  account_number: string | null;
  /** Período de la cartola detectado en el encabezado (si viene). */
  period_year?: number | null;
  period_month?: number | null;
};

// ---------- helpers ----------

const DATE_RE_1 = /\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/;
const DATE_RE_ISO = /\b(\d{4})-(\d{2})-(\d{2})\b/;

function pad2(n: number | string): string {
  return String(n).padStart(2, "0");
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

/**
 * Parse a date string/serial/Date. Returns YYYY-MM-DD or null.
 * IMPORTANT: never applies timezone conversion. For Date inputs, reads UTC
 * pieces (Excel stores dates as calendar dates, not timestamps, so cellDates
 * returns a Date at UTC midnight of that day).
 */
export function parseDate(input: string | number | Date | null | undefined): string | null {
  if (input == null) return null;
  if (input instanceof Date && !isNaN(input.getTime())) {
    // Excel returns dates as UTC midnight of the calendar day. Read the UTC
    // pieces so the day is not shifted by the local timezone.
    return toISO(input.getUTCFullYear(), input.getUTCMonth() + 1, input.getUTCDate());
  }
  if (typeof input === "number") {
    const d = XLSX.SSF.parse_date_code(input);
    if (d) return toISO(d.y, d.m, d.d);
    return null;
  }
  const s = String(input).trim();
  let m = DATE_RE_ISO.exec(s);
  if (m) return toISO(Number(m[1]), Number(m[2]), Number(m[3]));
  m = DATE_RE_1.exec(s);
  if (m) {
    let y = Number(m[3]);
    if (y < 100) y += 2000;
    return toISO(y, Number(m[2]), Number(m[1]));
  }
  return null;
}

/** Parse a Chilean-style amount ("1.234.567,89" or "1,234,567.89"). Returns null if not numeric. */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isFinite(input) ? input : null;
  let s = String(input).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || /-\s*$/.test(s) || /^\s*-/.test(s);
  s = s.replace(/[()\s]/g, "").replace(/^-+|-+$/g, "");
  if (s.includes(".") && s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",") && !s.includes(".")) {
    const parts = s.split(",");
    if (parts[parts.length - 1].length <= 2) s = parts.join(".");
    else s = parts.join("");
  } else {
    const parts = s.split(".");
    if (parts.length > 1 && parts[parts.length - 1].length === 3) s = parts.join("");
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

// ---------- XLSX / CSV ----------

const HEADER_ALIASES: Record<keyof HeaderMap, string[]> = {
  date: ["fecha", "date", "fec", "f. mov", "f.mov", "fecha mov"],
  description: ["descripcion", "descripción", "detalle", "glosa", "concepto", "description", "referencia"],
  amount: ["abono", "abonos", "monto", "importe", "credit", "crédito", "credito", "haber", "amount"],
  debit: ["cargo", "cargos", "debito", "débito", "debit", "debe"],
  counterparty: ["origen", "cliente", "nombre", "beneficiario", "ordenante", "quien", "transferencia de", "counterparty"],
  rut: ["rut", "rut origen", "rut ordenante", "id cliente"],
};

type HeaderMap = {
  date: number;
  description: number;
  amount: number;
  debit: number;
  counterparty: number;
  rut: number;
};

function findHeader(row: string[]): HeaderMap | null {
  const lowered = row.map((c) => (c ?? "").toString().trim().toLocaleLowerCase("es"));
  const map: HeaderMap = { date: -1, description: -1, amount: -1, debit: -1, counterparty: -1, rut: -1 };
  for (const key of Object.keys(HEADER_ALIASES) as (keyof HeaderMap)[]) {
    const aliases = HEADER_ALIASES[key];
    for (let i = 0; i < lowered.length; i++) {
      if (aliases.some((a) => lowered[i] === a || lowered[i].includes(a))) {
        if (map[key] === -1) map[key] = i;
      }
    }
  }
  if (map.date >= 0 && (map.amount >= 0 || map.debit >= 0)) return map;
  return null;
}

/** Try to extract bank + account number from the top rows / text. */
function sniffBankMeta(lines: string[]): BankMeta {
  const joined = lines.slice(0, 40).join(" \n ");
  let bank: string | null = null;
  // Ojo: usar expresiones con límites de palabra. "Estado de Cuenta" (Banco de
  // Chile) no debe confundirse con BancoEstado.
  const banks: [RegExp, string][] = [
    [/scotia/i, "Scotiabank"],
    [/banco\s*de\s*chile|bancochile|bco\.?\s*chile/i, "Banco de Chile"],
    [/edwards/i, "Banco Edwards"],
    [/santander/i, "Santander"],
    [/banco\s*estado|bancoestado|banco\s*del\s*estado/i, "BancoEstado"],
    [/\bbci\b|cr[ée]dito\s+e\s+inversiones/i, "BCI"],
    [/\bita[uú]\b/i, "Itaú"],
    [/banco\s*security/i, "Banco Security"],
    [/falabella/i, "Banco Falabella"],
    [/ripley/i, "Banco Ripley"],
    [/consorcio/i, "Banco Consorcio"],
    [/\bbice\b/i, "BICE"],
  ];
  for (const [re, label] of banks) {
    if (re.test(joined)) { bank = label; break; }
  }
  // account number: look for "cuenta" or "n° cuenta" followed by digits
  let account: string | null = null;
  const accRe =
    /(?:n[°º]?\s*(?:de\s*)?cuenta|cuenta\s*(?:corriente|vista|n[°º]?)?)[^\d]{0,20}(\d[\d\-\s]{5,})/i;
  const m = accRe.exec(joined);
  if (m) account = m[1].replace(/[\s-]/g, "");
  const period = sniffPeriod(joined);
  return {
    bank_name: bank,
    account_number: account,
    period_year: period?.to.y ?? null,
    period_month: period?.to.m ?? null,
  };
}

type PeriodRange = { from: { y: number; m: number }; to: { y: number; m: number } };

/** Detecta el rango "DESDE dd/mm/aaaa ... HASTA dd/mm/aaaa" del encabezado. */
function sniffPeriod(text: string): PeriodRange | null {
  const flat = text.replace(/\s+/g, " ");
  const from = /desde\s*:?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/i.exec(flat);
  const to = /hasta\s*:?\s*(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/i.exec(flat);
  if (from && to) {
    return {
      from: { y: Number(from[3]), m: Number(from[2]) },
      to: { y: Number(to[3]), m: Number(to[2]) },
    };
  }
  const one = from ?? to;
  if (one) {
    const p = { y: Number(one[3]), m: Number(one[2]) };
    return { from: p, to: p };
  }
  return null;
}

const DAY_MONTH_RE = /(?:^|\s)(\d{1,2})[\/\-.](\d{1,2})(?![\/\-.]?\d)/;

/**
 * Fecha de una línea de cartola. Acepta dd/mm/aaaa y también dd/mm (Banco de
 * Chile), completando el año con el período del encabezado.
 */
function lineDate(text: string, period: PeriodRange | null): string | null {
  const full = parseDate(text);
  if (full) return full;
  if (!period) return null;
  const m = DAY_MONTH_RE.exec(text);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  if (!d || d > 31 || !mo || mo > 12) return null;
  const y = mo === period.to.m ? period.to.y : mo === period.from.m ? period.from.y : period.to.y;
  return toISO(y, mo, d);
}

export async function parseSpreadsheet(file: File): Promise<{ txs: ParsedTx[]; meta: BankMeta }> {
  const buf = await file.arrayBuffer();
  // cellDates:false ensures we get raw serial numbers (parsed via SSF, TZ-safe).
  const wb = XLSX.read(buf, { type: "array", cellDates: false });
  const out: ParsedTx[] = [];
  const topText: string[] = [];
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: true }) as unknown[][];
    // Capture top rows as text for bank/account sniffing
    for (let i = 0; i < Math.min(rows.length, 20); i++) {
      topText.push(rows[i].map((c) => String(c ?? "")).join(" "));
    }
    let header: HeaderMap | null = null;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i].map((c) => (c == null ? "" : c));
      if (!header) {
        header = findHeader(row as string[]);
        continue;
      }
      const dateRaw = row[header.date];
      const date = parseDate(dateRaw as any);
      if (!date) continue;
      let amount = header.amount >= 0 ? parseAmount(row[header.amount] as any) : null;
      const debit = header.debit >= 0 ? parseAmount(row[header.debit] as any) : null;
      if ((amount == null || amount === 0) && debit != null && debit !== 0) {
        amount = -Math.abs(debit);
      }
      if (amount == null || amount === 0) continue;
      const description = String(row[header.description] ?? "").trim();
      const counterparty = header.counterparty >= 0 ? String(row[header.counterparty] ?? "").trim() : "";
      const rutCell = header.rut >= 0 ? String(row[header.rut] ?? "").trim() : "";
      const rutFromCell = rutCell ? cleanRut(rutCell) : "";
      const rutFromText = rutFromCell || extractRuts(`${description} ${counterparty}`)[0] || "";
      out.push({
        tx_date: date,
        description,
        counterparty_name: counterparty || null,
        counterparty_rut: rutFromText || null,
        amount,
        raw: row,
      });
    }
  }
  return { txs: out.filter((t) => t.amount > 0), meta: sniffBankMeta(topText) };
}

// ---------- PDF ----------

type PdfItem = { x: number; right: number; y: number; str: string };
type PdfLine = { y: number; items: PdfItem[]; text: string };

const HEADER_ABONOS = ["abono", "abonos", "credito", "crédito", "haber", "deposito", "depositos", "depósitos"];
const HEADER_CARGOS = ["cargo", "cargos", "debito", "débito", "debe", "cheque", "cheques", "giro", "giros"];
const HEADER_SALDO = ["saldo"];
const HEADER_FECHA = ["fecha"];

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

/** Parse a PDF cartola. Uses column x-coords when a Fecha/Abonos header is detected. */
export async function parsePdf(file: File): Promise<{ txs: ParsedTx[]; meta: BankMeta }> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  // Tolerancia vertical: en varias cartolas (Banco de Chile) la glosa y los
  // montos de una misma fila quedan 1-2 pt desalineados. Sin tolerancia, la
  // fila se parte en dos y no se detecta ningún abono.
  const Y_TOL = 3;
  const allLines: PdfLine[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items: PdfItem[] = [];
    for (const item of content.items as any[]) {
      const str = String(item.str ?? "");
      if (!str.trim()) continue;
      const x = item.transform[4];
      items.push({ x, right: x + (item.width ?? 0), y: item.transform[5], str });
    }
    items.sort((a, b) => b.y - a.y);
    const groups: PdfItem[][] = [];
    for (const it of items) {
      const last = groups[groups.length - 1];
      if (last && Math.abs(last[0].y - it.y) <= Y_TOL) last.push(it);
      else groups.push([it]);
    }
    for (const g of groups) {
      g.sort((a, b) => a.x - b.x);
      const text = g.map((i) => i.str).join(" ").replace(/\s+/g, " ").trim();
      if (text) allLines.push({ y: g[0].y, items: g, text });
    }
  }

  const meta = sniffBankMeta(allLines.map((l) => l.text));
  const period = sniffPeriod(allLines.slice(0, 40).map((l) => l.text).join(" "));

  // ---- Detect column x-positions from a header row ----
  type Cols = { fecha?: number; cargos?: number; abonos?: number; saldo?: number };
  let cols: Cols | null = null;
  for (const line of allLines) {
    const lower = line.text.toLocaleLowerCase("es");
    if (
      HEADER_ABONOS.some((h) => lower.includes(h)) &&
      (HEADER_SALDO.some((h) => lower.includes(h)) || HEADER_CARGOS.some((h) => lower.includes(h)))
    ) {
      const c: Cols = {};
      for (const it of line.items) {
        const t = it.str.trim().toLocaleLowerCase("es");
        if (!t) continue;
        // Los importes van alineados a la derecha: usamos el borde derecho del
        // encabezado como ancla de cada columna.
        // pdf.js suele entregar el encabezado agrupado ("MONTO DEPOSITOS"),
        // por eso comparamos por inclusión y no solo por prefijo.
        if (c.fecha == null && HEADER_FECHA.some((h) => t.includes(h))) c.fecha = it.right;
        if (c.cargos == null && HEADER_CARGOS.some((h) => t.includes(h))) c.cargos = it.right;
        if (c.abonos == null && HEADER_ABONOS.some((h) => t.includes(h))) c.abonos = it.right;
        if (c.saldo == null && HEADER_SALDO.some((h) => t.includes(h))) c.saldo = it.right;
      }
      if (c.abonos != null) { cols = c; break; }
    }
  }

  const out: ParsedTx[] = [];

  if (cols && cols.abonos != null) {
    // Extracción por columnas: cada importe se asigna a la columna cuyo ancla
    // (borde derecho del encabezado) está más cerca de su borde derecho.
    const anchors: { key: "cargos" | "abonos" | "saldo"; x: number }[] = [];
    if (cols.cargos != null) anchors.push({ key: "cargos", x: cols.cargos });
    anchors.push({ key: "abonos", x: cols.abonos });
    if (cols.saldo != null) anchors.push({ key: "saldo", x: cols.saldo });

    const numRe = /^-?\(?\$?\s*\d[\d.\s]*(?:,\d{1,2})?\)?$/;
    for (const line of allLines) {
      const date = lineDate(line.text, period);
      if (!date) continue;
      let amount: number | null = null;
      for (const it of line.items) {
        const raw = it.str.trim();
        if (!raw || !numRe.test(raw)) continue;
        const n = parseAmount(raw);
        if (n == null || n <= 0) continue;
        let nearest = anchors[0];
        for (const a of anchors) {
          if (Math.abs(a.x - it.right) < Math.abs(nearest.x - it.right)) nearest = a;
        }
        if (nearest.key !== "abonos") continue;
        amount = n;
        break;
      }
      if (amount == null || amount === 0) continue;
      const ruts = extractRuts(line.text);
      out.push({
        tx_date: date,
        description: line.text,
        counterparty_name: null,
        counterparty_rut: ruts[0] ?? null,
        amount,
        raw: { line: line.text },
      });
    }
  } else {
    // Heuristic fallback: last numeric token in the line.
    const amountRe = /(?:\$\s*)?(-?\(?\d{1,3}(?:[.\s]\d{3})+(?:,\d{2})?\)?|-?\d+(?:,\d{2}))/g;
    for (const line of allLines) {
      const date = lineDate(line.text, period);
      if (!date) continue;
      const ruts = extractRuts(line.text);
      const amounts: number[] = [];
      let m: RegExpExecArray | null;
      amountRe.lastIndex = 0;
      while ((m = amountRe.exec(line.text)) != null) {
        const n = parseAmount(m[1]);
        if (n != null) amounts.push(n);
      }
      if (amounts.length === 0) continue;
      const amount = amounts[amounts.length - 1];
      if (!Number.isFinite(amount) || amount === 0) continue;
      out.push({
        tx_date: date,
        description: line.text,
        counterparty_name: null,
        counterparty_rut: ruts[0] ?? null,
        amount,
        raw: { line: line.text },
      });
    }
  }

  return { txs: out.filter((t) => t.amount > 0), meta };
}

export async function parseBankFile(file: File): Promise<{ txs: ParsedTx[]; meta: BankMeta }> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return parsePdf(file);
  return parseSpreadsheet(file);
}

/** Best-effort human-readable string for a thrown value (Supabase errors, plain objs, etc.). */
export function errorToString(err: unknown): string {
  if (err == null) return "Error desconocido";
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const anyErr = err as any;
    return (
      anyErr.message ||
      anyErr.error_description ||
      anyErr.error ||
      anyErr.details ||
      anyErr.hint ||
      (() => { try { return JSON.stringify(err); } catch { return String(err); } })()
    );
  }
  return String(err);
}
// median helper kept for potential future column detection tweaks
void median;
