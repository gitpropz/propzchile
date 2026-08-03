/**
 * Lectura automática de contratos de arriendo chilenos.
 *
 * El usuario sube el contrato (PDF o foto) y Gemini extrae los datos clave
 * del arrendatario y las condiciones para pre-llenar el formulario de la unidad.
 * Mismo patrón que service-extraction.server.ts.
 */

export type ExtractedLease = {
  tenantName: string | null;
  tenantRut: string | null;
  tenantEmail: string | null;
  tenantContact: string | null;
  baseRentAmount: number | null;
  rentStartDate: string | null;
  rentEndDate: string | null;
  paymentDay: number | null;
  propertyName: string | null;
  propertyAddress: string | null;
  unitLabel: string | null;
};

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODELS = ["google/gemini-3-flash", "google/gemini-2.5-flash"];

const SYSTEM_PROMPT = `Eres un asistente que lee contratos de arriendo chilenos (PDF o imágenes).
Extrae los datos clave del contrato de arriendo y devuelve SOLO un JSON con la forma:
{"tenantName":string|null,"tenantRut":string|null,"tenantEmail":string|null,"tenantContact":string|null,"baseRentAmount":number|null,"rentStartDate":"YYYY-MM-DD"|null,"rentEndDate":"YYYY-MM-DD"|null,"paymentDay":number|null,"propertyName":string|null,"propertyAddress":string|null,"unitLabel":string|null}

Reglas:
- tenantName: nombre completo del arrendatario (la persona que arrienda, no el propietario).
- tenantRut: RUT del arrendatario en formato 12.345.678-9. Si no aparece, usa null.
- tenantEmail: email del arrendatario si aparece en el contrato, sino null.
- tenantContact: teléfono o WhatsApp del arrendatario si aparece, sino null.
- baseRentAmount: monto del arriendo mensual en pesos chilenos (como número sin puntos ni símbolos).
- rentStartDate: fecha de inicio del contrato en formato YYYY-MM-DD.
- rentEndDate: fecha de término del contrato en formato YYYY-MM-DD. Si es indefinido, null.
- paymentDay: día del mes en que se paga el arriendo (número 1-31). Suele estar en la cláusula de pago.
- propertyName: nombre o identificación de la propiedad si aparece (ej: "Departamento 1202, Edificio X").
- propertyAddress: dirección completa de la propiedad arrendada.
- unitLabel: número o identificación de la unidad específica (ej: "Dpto 1202", "Estacionamiento 15").
- Si un dato no aparece en el documento, usa null. No inventes datos.
- Si hay múltiples arrendatarios, incluye solo el primero como principal.`;

function contentBlock(file: { name: string; mimeType: string; dataUrl: string }) {
  if (file.mimeType.startsWith("image/")) {
    return { type: "image_url", image_url: { url: file.dataUrl } };
  }
  return { type: "file", file: { filename: file.name, file_data: file.dataUrl } };
}

function parseLease(text: string): ExtractedLease {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return {
      tenantName: null, tenantRut: null, tenantEmail: null, tenantContact: null,
      baseRentAmount: null, rentStartDate: null, rentEndDate: null, paymentDay: null,
      propertyName: null, propertyAddress: null, unitLabel: null,
    };
  }
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  const amount = typeof parsed.baseRentAmount === "number"
    ? parsed.baseRentAmount
    : typeof parsed.baseRentAmount === "string"
      ? Number(String(parsed.baseRentAmount).replace(/[^\d-]/g, ""))
      : null;
  const day = typeof parsed.paymentDay === "number"
    ? parsed.paymentDay
    : typeof parsed.paymentDay === "string"
      ? Number(String(parsed.paymentDay).replace(/[^\d]/g, ""))
      : null;

  return {
    tenantName: (parsed.tenantName as string) ?? null,
    tenantRut: (parsed.tenantRut as string) ?? null,
    tenantEmail: (parsed.tenantEmail as string) ?? null,
    tenantContact: (parsed.tenantContact as string) ?? null,
    baseRentAmount: amount != null && Number.isFinite(amount) ? amount : null,
    rentStartDate: (parsed.rentStartDate as string) ?? null,
    rentEndDate: (parsed.rentEndDate as string) ?? null,
    paymentDay: day != null && Number.isFinite(day) ? day : null,
    propertyName: (parsed.propertyName as string) ?? null,
    propertyAddress: (parsed.propertyAddress as string) ?? null,
    unitLabel: (parsed.unitLabel as string) ?? null,
  };
}

export async function extractLeaseFromDocument(
  file: { name: string; mimeType: string; dataUrl: string },
  apiKey: string,
): Promise<ExtractedLease> {
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
              { type: "text", text: "Extrae los datos del contrato de arriendo de este documento." },
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
      return parseLease(text);
    } catch {
      lastError = "Respuesta no interpretable";
    }
  }
  throw new Error(lastError || "No pudimos leer el contrato");
}
