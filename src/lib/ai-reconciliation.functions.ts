import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AiMatchSuggestion, UnitCandidate } from "@/lib/ai-reconciliation.server";
import type { StandardMovement } from "@/lib/bank/types";

export type SuggestMatchInput = {
  movement: StandardMovement;
  candidates: UnitCandidate[];
};

export const suggestMatchWithAiFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: SuggestMatchInput) => {
    if (!input?.movement?.date) throw new Error("Movimiento inválido");
    if (!Array.isArray(input?.candidates)) throw new Error("Candidatos inválidos");
    return input;
  })
  .handler(async ({ data }): Promise<{ suggestion: AiMatchSuggestion }> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Falta la configuración de IA");
    const { suggestMatchWithAi } = await import("@/lib/ai-reconciliation.server");
    const suggestion = await suggestMatchWithAi(data.movement, data.candidates, apiKey);
    return { suggestion };
  });
