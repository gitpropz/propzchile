import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { ExtractedLease } from "@/lib/contract-extraction.server";

export type ExtractLeaseInput = {
  name: string;
  mimeType: string;
  /** data:<mime>;base64,<...> */
  dataUrl: string;
};

export const extractLeaseFromDocumentFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExtractLeaseInput) => {
    if (!input?.dataUrl?.startsWith("data:")) throw new Error("Documento inválido");
    return input;
  })
  .handler(async ({ data }): Promise<{ lease: ExtractedLease }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Falta la configuración de IA");
    const { extractLeaseFromDocument } = await import("@/lib/contract-extraction.server");
    const lease = await extractLeaseFromDocument(data, apiKey);
    return { lease };
  });
