/**
 * Formato estándar de cartola.
 *
 * Etapa 1 (extracción): cada banco tiene su parser, que convierte el archivo
 * (PDF, Excel, CSV) a `StandardMovement[]`.
 * Etapa 2 (conciliación): común a todos los bancos, opera SOLO sobre
 * `StandardMovement`, por lo que agregar un banco nuevo no requiere tocar
 * la conciliación.
 */

export type MovementType = "credit" | "debit";

export type StandardMovement = {
  /** YYYY-MM-DD exacto como aparece en la cartola (sin conversión de zona horaria). */
  date: string;
  /** Importe individual del movimiento (siempre positivo). Nunca un saldo. */
  amount: number;
  /** Abono (credit) o cargo (debit). */
  type: MovementType;
  /** Nombre del depositante, si viene. */
  payer_name: string | null;
  /** RUT del depositante limpio (sin puntos ni guion), si viene. */
  payer_rut: string | null;
  /** Número de cuenta de origen, solo dígitos, si viene. */
  payer_account: string | null;
  /** Banco de origen del depósito, si viene. */
  payer_bank: string | null;
  /** Número de operación / documento, si viene. */
  operation_number: string | null;
  /** Glosa o descripción del movimiento. */
  description: string;
  /** Fila/línea original, para trazabilidad. */
  raw: unknown;
};

export type StatementMeta = {
  /** Banco emisor de la cartola. */
  bank_name: string | null;
  /** Cuenta del titular (la cuenta de la cartola). */
  account_number: string | null;
  /** Período declarado en el encabezado de la cartola, si viene. */
  period_year?: number | null;
  period_month?: number | null;
};

export type ParsedStatement = {
  movements: StandardMovement[];
  meta: StatementMeta;
  /** Id del parser que produjo el resultado (trazabilidad / debug). */
  parser: string;
};

/** Contexto que el registry entrega a cada parser para decidir si aplica. */
export type ParserContext = {
  file: File;
  fileName: string;
  /** Extensión sin punto: pdf | xlsx | xls | csv */
  ext: string;
  /** Muestra de texto del inicio del archivo (minúsculas, sin acentos). */
  textSample: string;
};

export type BankParser = {
  id: string;
  label: string;
  /**
   * Puntaje de afinidad con el archivo. 0 = no aplica.
   * Mayor puntaje gana. El parser genérico devuelve 1 (fallback).
   */
  score: (ctx: ParserContext) => number;
  parse: (ctx: ParserContext) => Promise<ParsedStatement>;
};

/** Columnas que NUNCA son el importe del movimiento. */
export const NON_AMOUNT_HEADERS = [
  "saldo",
  "saldo disponible",
  "saldo contable",
  "saldo final",
  "saldo inicial",
  "saldo actual",
  "total movimientos",
  "total cartola",
  "total abonos",
  "total cargos",
  "cupo",
  "linea de credito",
  "línea de crédito",
  "retenido",
];

export function isNonAmountHeader(header: string): boolean {
  const h = header.trim().toLocaleLowerCase("es");
  if (!h) return false;
  return NON_AMOUNT_HEADERS.some((n) => h === n || h.includes(n));
}
