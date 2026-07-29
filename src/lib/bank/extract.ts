import { cleanRut, extractRuts } from "@/lib/rut";

/**
 * Extractores de campos desde la glosa/descripción de un movimiento.
 * Son puramente aditivos: si no encuentran nada devuelven null y el
 * comportamiento previo se mantiene igual.
 */

const BANK_NEEDLES: [RegExp, string][] = [
  [/scotia/i, "Scotiabank"],
  [/banco\s+de\s+chile|bco\.?\s*chile/i, "Banco de Chile"],
  [/edwards/i, "Banco Edwards"],
  [/santander/i, "Santander"],
  [/\bbci\b|credito e inversiones|crédito e inversiones/i, "BCI"],
  [/ita[uú]/i, "Itaú"],
  [/banco\s*estado|bancoestado/i, "BancoEstado"],
  [/security/i, "Banco Security"],
  [/falabella/i, "Banco Falabella"],
  [/ripley/i, "Banco Ripley"],
  [/consorcio/i, "Banco Consorcio"],
  [/\bbice\b/i, "BICE"],
  [/\bmach\b|tenpo|\bmercado\s*pago\b/i, "Otro"],
];

export function extractBank(text: string): string | null {
  for (const [re, label] of BANK_NEEDLES) if (re.test(text)) return label;
  return null;
}

/** N° de cuenta de origen dentro de la glosa. */
export function extractAccount(text: string): string | null {
  const re =
    /(?:cta|cuenta|c\/c|ctacte|cta\.?\s*cte|desde\s+cuenta|cuenta\s+origen)[^0-9]{0,15}(\d[\d.\- ]{5,})/i;
  const m = re.exec(text);
  if (!m) return null;
  const digits = m[1].replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

/** N° de operación / documento. */
export function extractOperation(text: string): string | null {
  const re =
    /(?:n[°º.]?\s*(?:de\s*)?(?:operaci[oó]n|oper\.?|documento|doc\.?|transacci[oó]n)|folio|id\s*transacci[oó]n)[^0-9]{0,10}(\d{4,})/i;
  const m = re.exec(text);
  return m ? m[1] : null;
}

export function extractRut(text: string): string | null {
  const r = extractRuts(text)[0];
  return r ? cleanRut(r) : null;
}

const NAME_PREFIXES = [
  /transferencia\s+(?:de|desde)\s+/i,
  /transf\.?\s+(?:de|desde)\s+/i,
  /abono\s+(?:de|desde|por)\s+/i,
  /dep[oó]sito\s+(?:de|desde)\s+/i,
  /pago\s+(?:de|desde)\s+/i,
  /recibido\s+de\s+/i,
  /traspaso\s+(?:de|desde)\s*:?\s*/i,
  /\btef\s+(?:de|desde)?\s*/i,
];

const NAME_STOP = /\b(rut|cta|cuenta|banco|bco|monto|abono|cargo|n[°º]|folio|glosa|com(?:entario)?)\b/i;

/** Intenta aislar el nombre del depositante desde la glosa. */
export function extractPayerName(text: string): string | null {
  const clean = text.replace(/\s+/g, " ").trim();
  for (const p of NAME_PREFIXES) {
    const m = p.exec(clean);
    if (!m) continue;
    let rest = clean.slice(m.index + m[0].length);
    const stop = NAME_STOP.exec(rest);
    if (stop) rest = rest.slice(0, stop.index);
    rest = rest
      .replace(/\d[\d.\-]*/g, " ")
      .replace(/[|/;,:]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (rest.length >= 4) return rest;
  }
  return null;
}
