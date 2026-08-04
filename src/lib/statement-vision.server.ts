/**
 * Lectura de cartolas/movimientos desde IMÁGENES (pantallazos de la app o web
 * del banco, fotos de cartolas impresas). Funciona con cualquier banco: la IA
 * lee la tabla/lista de movimientos y devuelve el formato estándar
 * `StandardMovement[]`, por lo que la conciliación posterior no cambia.
 */

import type { StandardMovement } from "@/lib/bank/types";

/** Movimiento serializable: raw viaja como JSON en texto para cruzar el RPC. */
export type VisionMovement = Omit<StandardMovement, "raw"> & { raw: string };

export type VisionStatement = {
  bank_name: string | null;
  account_number: string | null;
  period_year: number | null;
  period_month: number | null;
  movements: VisionMovement[];
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELS = ["google/gemini-3-flash", "google/gemini-2.5-flash"];

const SYSTEM_PROMPT = `Eres un asistente experto en leer cartolas y movimientos de cuentas bancarias chilenas
desde imágenes: pantallazos de apps móviles (Scotiabank, Banco de Chile, Santander, BCI, BancoEstado, Itaú,
Falabella, Security, Bice, Consorcio, Tenpo, MACH, etc.), pantallazos de banca web y fotos de cartolas impresas.

Responde SOLO un JSON con esta forma exacta:
{"bank_name":string|null,"account_number":string|null,"period_year":number|null,"period_month":number|null,
"movements":[{"date":"YYYY-MM-DD","amount":number,"type":"credit"|"debit","payer_name":string|null,
"payer_rut":string|null,"payer_account":string|null,"payer_bank":string|null,"operation_number":string|null,
"description":string}]}

Reglas estrictas:
- Extrae TODOS los movimientos visibles, en el mismo orden en que aparecen. No omitas filas ni las resumas.
- date: la fecha del movimiento tal como aparece en la imagen, normalizada a YYYY-MM-DD. Si la lista agrupa
  por encabezados de fecha ("20 de julio, 2026"), aplica ese encabezado a todos los movimientos bajo él.
  Si el año no aparece, usa el año del encabezado o período de la pantalla; si es imposible saberlo, usa null
  para ese movimiento (no lo inventes).
- amount: número POSITIVO, sin puntos, comas ni símbolos ($1.500.500 -> 1500500).
- type: "credit" para abonos/depósitos/transferencias recibidas (normalmente en verde o con signo +),
  "debit" para cargos, pagos, giros y transferencias enviadas (rojo o con signo -).
- NUNCA confundas el SALDO (saldo contable, saldo disponible, saldo final) con el monto del movimiento.
  Los saldos, totales y subtotales NO son movimientos: ignóralos.
- payer_name: nombre de la contraparte (quien deposita en un abono). Si la glosa solo trae códigos, usa null.
- payer_rut: RUT de la contraparte si aparece, limpio (sin puntos ni guion), incluyendo dígito verificador.
- payer_account: número de cuenta de origen si aparece (solo dígitos).
- payer_bank: banco de origen del depósito si aparece.
- operation_number: número de operación/documento/comprobante si aparece.
- description: la glosa completa del movimiento tal como se lee, en una sola línea.
- No inventes datos: cualquier campo que no aparezca va en null.
- Si la imagen no contiene movimientos bancarios, devuelve movements: [].`;

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^\d-]/g, ""));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function parseResponse(text: string): VisionStatement {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Respuesta no interpretable");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  const list = Array.isArray(parsed.movements) ? parsed.movements : [];

  const movements: VisionMovement[] = [];
  for (const raw of list) {
    const s = raw as Record<string, unknown>;
    const date = normalizeDate(s.date);
    const amount = toNumber(s.amount);
    if (!date || amount == null || amount === 0) continue;
    const rut = typeof s.payer_rut === "string" ? s.payer_rut.replace(/[^0-9kK]/g, "").toUpperCase() : "";
    movements.push({
      date,
      amount: Math.abs(amount),
      type: s.type === "debit" ? "debit" : "credit",
      payer_name: typeof s.payer_name === "string" && s.payer_name.trim() ? s.payer_name.trim() : null,
      payer_rut: rut.length >= 8 ? rut : null,
      payer_account:
        typeof s.payer_account === "string" && s.payer_account.replace(/\D/g, "")
          ? s.payer_account.replace(/\D/g, "")
          : null,
      payer_bank: typeof s.payer_bank === "string" && s.payer_bank.trim() ? s.payer_bank.trim() : null,
      operation_number:
        typeof s.operation_number === "string" && s.operation_number.trim()
          ? s.operation_number.trim()
          : null,
      description: typeof s.description === "string" ? s.description.trim() : "",
      raw: JSON.stringify(s),
    });
  }

  return {
    bank_name: typeof parsed.bank_name === "string" ? parsed.bank_name : null,
    account_number: typeof parsed.account_number === "string" ? parsed.account_number : null,
    period_year: toNumber(parsed.period_year),
    period_month: toNumber(parsed.period_month),
    movements,
  };
}

export async function extractStatementFromImage(
  file: { name: string; mimeType: string; dataUrl: string },
  apiKey: string,
): Promise<VisionStatement> {
  const block = file.mimeType.startsWith("image/")
    ? { type: "image_url", image_url: { url: file.dataUrl } }
    : { type: "file", file: { filename: file.name, file_data: file.dataUrl } };

  let lastError = "";
  for (const model of MODELS) {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extrae todos los movimientos bancarios visibles en esta imagen, con fecha, monto, tipo y datos del depositante.",
              },
              block,
            ],
          },
        ],
      }),
    });
    if (!res.ok) {
      lastError = `${res.status} ${await res.text()}`;
      continue;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    try {
      return parseResponse(json.choices?.[0]?.message?.content ?? "");
    } catch {
      lastError = "Respuesta no interpretable";
    }
  }
  throw new Error(lastError || "No pudimos leer la imagen de movimientos");
}
