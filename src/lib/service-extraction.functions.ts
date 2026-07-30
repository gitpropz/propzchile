import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedService } from "@/lib/service-extraction.server";

export type ExtractDocumentInput = {
  name: string;
  mimeType: string;
  /** data:<mime>;base64,<...> */
  dataUrl: string;
};

export const extractServicesFromDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExtractDocumentInput) => {
    if (!input?.dataUrl?.startsWith("data:")) throw new Error("Documento inválido");
    return input;
  })
  .handler(async ({ data }): Promise<{ services: ExtractedService[] }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Falta la configuración de IA");
    const { extractServicesFromDocument } = await import("@/lib/service-extraction.server");
    const services = await extractServicesFromDocument(data, apiKey);
    return { services };
  });
