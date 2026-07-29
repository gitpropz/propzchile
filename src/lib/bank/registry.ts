import { runBaseEngine } from "./base-engine";
import type { BankParser, ParsedStatement, ParserContext } from "./types";

/**
 * Registro de parsers por banco.
 *
 * Para soportar un banco nuevo basta con agregar aquí un parser que produzca
 * `StandardMovement[]`. La conciliación NO se modifica.
 */

const scotiabank: BankParser = {
  id: "scotiabank",
  label: "Scotiabank",
  score: (c) => (/scotia/.test(c.textSample) || /scotia/.test(c.fileName) ? 10 : 0),
  parse: (c) => runBaseEngine(c, "scotiabank"),
};

const bancoChile: BankParser = {
  id: "banco-chile",
  label: "Banco de Chile / Edwards",
  score: (c) =>
    /banco de chile|bancochile|edwards|bco\. chile/.test(c.textSample) ||
    /chile|edwards/.test(c.fileName)
      ? 9
      : 0,
  parse: (c) => runBaseEngine(c, "banco-chile"),
};

const santander: BankParser = {
  id: "santander",
  label: "Santander",
  score: (c) => (/santander/.test(c.textSample) || /santander/.test(c.fileName) ? 9 : 0),
  parse: (c) => runBaseEngine(c, "santander"),
};

const bci: BankParser = {
  id: "bci",
  label: "BCI",
  score: (c) => (/\bbci\b|credito e inversiones/.test(c.textSample) ? 9 : 0),
  parse: (c) => runBaseEngine(c, "bci"),
};

const bancoEstado: BankParser = {
  id: "banco-estado",
  label: "BancoEstado",
  score: (c) => (/bancoestado|banco estado/.test(c.textSample) ? 9 : 0),
  parse: (c) => runBaseEngine(c, "banco-estado"),
};

const itau: BankParser = {
  id: "itau",
  label: "Itaú",
  score: (c) => (/itau|itaú/.test(c.textSample) ? 9 : 0),
  parse: (c) => runBaseEngine(c, "itau"),
};

/** Fallback: cualquier banco/formato tabular o PDF con columna de abonos. */
const generic: BankParser = {
  id: "generic",
  label: "Genérico",
  score: () => 1,
  parse: (c) => runBaseEngine(c, "generic"),
};

export const BANK_PARSERS: BankParser[] = [
  scotiabank,
  bancoChile,
  santander,
  bci,
  bancoEstado,
  itau,
  generic,
];

const STRIP_ACCENTS = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

async function buildContext(file: File): Promise<ParserContext> {
  const fileName = STRIP_ACCENTS(file.name.toLocaleLowerCase("es"));
  const ext = fileName.split(".").pop() ?? "";
  let textSample = "";
  try {
    if (ext !== "pdf") {
      textSample = STRIP_ACCENTS((await file.slice(0, 20_000).text()).toLocaleLowerCase("es"));
    }
  } catch {
    textSample = "";
  }
  return { file, fileName, ext, textSample };
}

/** Elige el parser con mayor afinidad y extrae la cartola al formato estándar. */
export async function parseStatement(file: File): Promise<ParsedStatement> {
  const ctx = await buildContext(file);
  let best = BANK_PARSERS[BANK_PARSERS.length - 1];
  let bestScore = 0;
  for (const p of BANK_PARSERS) {
    const s = p.score(ctx);
    if (s > bestScore) {
      bestScore = s;
      best = p;
    }
  }
  const result = await best.parse(ctx);
  // Si el parser no detectó el banco emisor, usamos la etiqueta del parser.
  if (!result.meta.bank_name && best.id !== "generic") {
    result.meta = { ...result.meta, bank_name: best.label };
  }
  return result;
}
