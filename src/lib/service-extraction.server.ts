/**
 * Lectura automática de documentos de servicios (Servipag, boletas, avisos).
 *
 * Arquitectura preparada para nuevas fuentes: hoy `upload` (imágenes y PDF),
 * mañana Gmail, Outlook o una casilla dedicada. Todas deben producir el mismo
 * contrato `ExtractedService[]`, que luego se asocia con `matchDetectedService`.
 */

export type ExtractedService = {
  provider: string | null;
  serviceType: "agua" | "luz" | "gas" | "gastos_comunes" | "otro" | null;
  identifier: string | null;
  meterNumber: string | null;
  contractNumber: string | null;
  amountDue: number | null;
  /** true cuando el documento indica explícitamente que no hay deuda. */
  noDebt?: boolean;
  date: string | null;
  status: string | null;
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELS = ["google/gemini-3-flash", "google/gemini-2.5-flash"];

const SYSTEM_PROMPT = `Eres un asistente que lee documentos chilenos de pago de servicios
(pantallazos de Servipag, boletas de agua/luz/gas, avisos de gastos comunes).
Extrae TODOS los servicios listados en el documento, una entrada por cada tarjeta/fila.
Responde SOLO un JSON con la forma:
{"services":[{"provider":string|null,"serviceType":"agua"|"luz"|"gas"|"gastos_comunes"|"otro"|null,"identifier":string|null,"meterNumber":string|null,"contractNumber":string|null,"amountDue":number|null,"noDebt":boolean,"date":"YYYY-MM-DD"|null,"status":string|null}]}
Reglas:
- identifier es EL DATO MÁS IMPORTANTE: el número identificador de la cuenta
  (número de cliente/servicio/medidor/contrato/rol). En los pantallazos de Servipag
  normalmente aparece en la TERCERA línea de cada tarjeta, bajo el nombre de la
  compañía y el alias/dirección. Cópialo tal cual aparece, completo, sin recortar
  dígitos ni agregar texto. Si no aparece, usa null (no lo inventes ni lo deduzcas).
- amountDue es el monto adeudado o total a pagar en pesos chilenos, como número sin puntos ni símbolos.
- Si la tarjeta indica que NO hay deuda ("sin deuda", "sin cuentas pendientes",
  "al día", "no registra deuda", "$0"), devuelve amountDue: 0 y noDebt: true.
- Si hay deuda, noDebt: false.
- provider (compañía), alias/dirección y fecha de vencimiento son información de apoyo.
- Si un dato no aparece, usa null. No inventes datos.`;


function contentBlock(file: { name: string; mimeType: string; dataUrl: string }) {
  if (file.mimeType.startsWith("image/")) {
    return { type: "image_url", image_url: { url: file.dataUrl } };
  }
  return { type: "file", file: { filename: file.name, file_data: file.dataUrl } };
}

function parseServices(text: string): ExtractedService[] {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) return [];
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as { services?: unknown };
  const list = Array.isArray(parsed.services) ? parsed.services : [];
  return list.map((raw) => {
    const s = raw as Record<string, unknown>;
    const amount = typeof s.amountDue === "number"
      ? s.amountDue
      : typeof s.amountDue === "string"
        ? Number(String(s.amountDue).replace(/[^\d-]/g, ""))
        : null;
    return {
      provider: (s.provider as string) ?? null,
      serviceType: (s.serviceType as ExtractedService["serviceType"]) ?? null,
      identifier: (s.identifier as string) ?? null,
      meterNumber: (s.meterNumber as string) ?? null,
      contractNumber: (s.contractNumber as string) ?? null,
      amountDue: amount != null && Number.isFinite(amount) ? amount : null,
      date: (s.date as string) ?? null,
      status: (s.status as string) ?? null,
    };
  });
}

export async function extractServicesFromDocument(
  file: { name: string; mimeType: string; dataUrl: string },
  apiKey: string,
): Promise<ExtractedService[]> {
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
              { type: "text", text: "Extrae los servicios y montos adeudados de este documento." },
              contentBlock(file),
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
    const text = json.choices?.[0]?.message?.content ?? "";
    try {
      return parseServices(text);
    } catch {
      lastError = "Respuesta no interpretable";
    }
  }
  throw new Error(lastError || "No pudimos leer el documento");
}
