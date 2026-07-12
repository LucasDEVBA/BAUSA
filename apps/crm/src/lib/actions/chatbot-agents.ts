"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Personas dos copilotos de conversa (hub /agents) — CEO-only, audited.
// Grava em configuracoes_sistema.chatbot_persona (JSONB { persona?, personaGrupo? }):
//   • persona       → copiloto da conversa 1:1
//   • personaGrupo  → copiloto de grupo (fallback → persona → default do código)
// Merge-safe: lê o valor atual e mescla só os campos enviados (nunca zera o
// outro). String vazia é VÁLIDA = restaurar o default (fail-open na leitura).
// Esta action NUNCA envia mensagem — só edita a persona que a IA usa p/ sugerir.
// ════════════════════════════════════════════════════════════════════════

const PERSONA_MAX = 4000;

const inputSchema = z
  .object({
    persona: z.string().max(PERSONA_MAX).optional(),
    personaGrupo: z.string().max(PERSONA_MAX).optional(),
  })
  .refine((v) => v.persona !== undefined || v.personaGrupo !== undefined, {
    message: "Informe ao menos uma persona para salvar.",
  });

export type AtualizarPersonasInput = z.input<typeof inputSchema>;

export type AtualizarPersonasResult = { success: boolean; error?: string };

/** Atualiza a(s) persona(s) do chatbot assistido (merge-safe). Só CEO. */
export async function atualizarPersonasChatbot(
  input: AtualizarPersonasInput,
): Promise<AtualizarPersonasResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode editar as personas." };
  }

  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();

    const { data: cfgRow, error: readErr } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "chatbot_persona")
      .maybeSingle();

    if (readErr) {
      return { success: false, error: "Não foi possível carregar as personas atuais." };
    }

    // Merge sobre o valor atual — preserva o campo não enviado (e qualquer chave futura).
    const atual = (cfgRow?.valor ?? {}) as Record<string, unknown>;
    const merged: Record<string, unknown> = { ...atual };
    if (parsed.data.persona !== undefined) merged.persona = parsed.data.persona;
    if (parsed.data.personaGrupo !== undefined) merged.personaGrupo = parsed.data.personaGrupo;

    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: merged })
      .eq("chave", "chatbot_persona")
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Config chatbot_persona não encontrada (migration pendente?)" };
    }

    revalidatePath("/agents");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_personas_chatbot", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar as personas." };
  }
}
