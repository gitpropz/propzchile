import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { VisionStatement } from "@/lib/statement-vision.server";

export type ExtractStatementImageInput = {
  name: string;
  mimeType: string;
  /** data:<mime>;base64,<...> */
  dataUrl: string;
};

export const extractStatementFromImageFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ExtractStatementImageInput) => {
    if (!input?.dataUrl?.startsWith("data:")) throw new Error("Imagen inválida");
    return input;
  })
  .handler(async ({ data }): Promise<{ statement: VisionStatement }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Falta la configuración de IA");
    const { extractStatementFromImage } = await import("@/lib/statement-vision.server");
    const statement = await extractStatementFromImage(data, apiKey);
    return { statement };
  });
