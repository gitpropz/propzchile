import { parseBankFile, type ParsedTx } from "@/lib/bank-parsers";
import { cleanRut } from "@/lib/rut";
import { extractAccount, extractBank, extractOperation, extractPayerName, extractRut } from "./extract";
import type { ParsedStatement, ParserContext, StandardMovement } from "./types";

/**
 * Motor de extracción base (el mismo que hoy funciona con Scotiabank).
 * Lee PDF/Excel/CSV, detecta la columna de abonos (nunca saldos) y entrega
 * movimientos. Aquí solo lo adaptamos al formato estándar y le agregamos
 * campos opcionales (cuenta origen, banco origen, n° operación, nombre).
 */
export async function runBaseEngine(ctx: ParserContext, parserId: string): Promise<ParsedStatement> {
  const { txs, meta } = await parseBankFile(ctx.file);
  return {
    parser: parserId,
    meta,
    movements: txs.map((t) => toStandard(t)),
  };
}

export function toStandard(t: ParsedTx): StandardMovement {
  const text = `${t.description ?? ""} ${t.counterparty_name ?? ""}`;
  const rut = t.counterparty_rut ? cleanRut(t.counterparty_rut) : extractRut(text);
  return {
    date: t.tx_date,
    amount: Math.abs(t.amount),
    type: t.amount >= 0 ? "credit" : "debit",
    payer_name: t.counterparty_name?.trim() || extractPayerName(text),
    payer_rut: rut || null,
    payer_account: extractAccount(text),
    payer_bank: extractBank(text),
    operation_number: extractOperation(text),
    description: (t.description ?? "").trim(),
    raw: t.raw,
  };
}
