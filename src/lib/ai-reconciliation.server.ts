/**
 * Conciliación inteligente de pagos con IA.
 *
 * Cuando el motor de reglas (RUT, cuenta, nombre, alias) no logra identificar
 * a qué unidad pertenece un movimiento bancario, Gemini analiza la descripción
 * cruda de la cartola + los datos del pagador y sugiere la unidad más probable.
 *
 * Mismo patrón que service-extraction.server.ts: llama al Lovable AI Gateway
 * con un prompt estructurado y valida la respuesta antes de usarla.
 */

import type { StandardMovement } from "@/lib/bank/types";

export type UnitCandidate = {
  unitId: string;
  label: string;
  propertyName: string;
  tenantName: string | null;
  tenantRut: string | null;
  tenantAliases: string[];
  tenantAccountNumbers: string[];
  baseRentAmount: number | null;
};

export type AiMatchSuggestion = {
  unitId: string | null;
  confidence: "high" | "medium" | "low";
  reason: string;
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELS = ["google/gemini-3-flash", "google/gemini-2.5-flash"];

const SYSTEM_PROMPT = `Eres un asistente experto en conciliación bancaria para arriendos inmobiliarios en Chile.
Recibes los datos de un movimiento bancario (abono) y una lista de unidades arrendadas con sus arrendatarios.
Tu tarea es determinar a qué unidad pertenece el abono, analizando la glosa, el nombre del depositante,
el RUT y la cuenta de origen, comparándolos con los datos de cada arrendatario.

Responde SOLO un JSON con la forma:
{"unitId":string|null,"confidence":"high"|"medium"|"low","reason":string}

Reglas:
- Compara el nombre del depositante con el nombre del arrendatario y sus alias.
- Compara el RUT del depositante con el RUT del arrendatario.
- Compara la cuenta de origen con las cuentas registradas del arrendatario.
- "high" = coincidencia clara (nombre muy parecido o RUT parcial coincidente).
- "medium" = coincidencia probable pero no definitiva.
- "low" = coincidencia débil, solo por similitud vaga.
- Si no puedes identificar la unidad con razonable seguridad, devuelve unitId: null.
- El reason es una explicación breve en español de por qué elegiste esa unidad.
- No inventes datos. Si no hay suficiente información, devuelve null.`;

export async function suggestMatchWithAi(
  movement: StandardMovement,
  candidates: UnitCandidate[],
  apiKey: string,
): Promise<AiMatchSuggestion> {
  if (candidates.length === 0) {
    return { unitId: null, confidence: "low", reason: "No hay unidades configuradas" };
  }

  const unitsList = candidates.map((u, i) => ({
    index: i,
    unitId: u.unitId,
    unidad: u.label,
    propiedad: u.propertyName,
    arrendatario: u.tenantName,
    rut: u.tenantRut,
    alias: u.tenantAliases,
    cuentas: u.tenantAccountNumbers,
    arriendoBase: u.baseRentAmount,
  }));

  const userMessage = `Movimiento bancario a identificar:
- Fecha: ${movement.date}
- Monto: ${movement.amount}
- Depositante: ${movement.payer_name ?? "(no viene)"}
- RUT depositante: ${movement.payer_rut ?? "(no viene)"}
- Cuenta origen: ${movement.payer_account ?? "(no viene)"}
- Glosa/descripción: ${movement.description}

Unidades arrendadas disponibles:
${JSON.stringify(unitsList, null, 2)}`;

  let lastError = "";
  for (const model of MODELS) {
    const res = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
      }),
    });
    if (!res.ok) {
      lastError = `${res.status} ${await res.text()}`;
      continue;
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content ?? "";
    try {
      return parseSuggestion(text, candidates);
    } catch {
      lastError = "Respuesta no interpretable";
    }
  }
  throw new Error(lastError || "No pudimos analizar el movimiento con IA");
}

function parseSuggestion(text: string, candidates: UnitCandidate[]): AiMatchSuggestion {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return { unitId: null, confidence: "low", reason: "IA no devolvió respuesta válida" };
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
    unitId?: string | null;
    confidence?: string;
    reason?: string;
  };

  const unitId = parsed.unitId ?? null;
  // Validate that the suggested unitId exists in our candidate list
  const valid = unitId ? candidates.find((c) => c.unitId === unitId) : null;
  const confidence = (["high", "medium", "low"].includes(parsed.confidence ?? "")
    ? parsed.confidence
    : "low") as AiMatchSuggestion["confidence"];

  return {
    unitId: valid ? unitId : null,
    confidence,
    reason: parsed.reason ?? "Sin explicación",
  };
}
