"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Instruções editáveis dos prompts de IA (/automacoes) — mecanismo genérico
// para as chaves de configuracoes_sistema no formato { instrucoes?: string }.
// Vazio remove o override (volta ao default do código, que evolui sem
// congelar). Só CEO. O insights_conversa_prompt tem action própria histórica
// (whatsapp-insights.ts) — este cobre as demais automações de IA.
// ════════════════════════════════════════════════════════════════════════

const INSTRUCOES_MAX = 4000;

/** Whitelist: só chaves deste formato podem ser escritas por aqui. */
const CHAVES_PERMITIDAS = [
  "transcricao_resumo_prompt",
  "cac_insights_prompt",
  "memoria_extracao_prompt",
  "doc_classificacao_prompt",
] as const;
export type ChaveInstrucoesIA = (typeof CHAVES_PERMITIDAS)[number];

export type AtualizarInstrucoesIAResult = { success: boolean; error?: string };

export async function atualizarInstrucoesIA(input: {
  chave: ChaveInstrucoesIA;
  instrucoes?: string;
}): Promise<AtualizarInstrucoesIAResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode editar o prompt." };
  }
  if (!CHAVES_PERMITIDAS.includes(input.chave)) {
    return { success: false, error: "Chave de configuração inválida." };
  }
  const texto = (input.instrucoes ?? "").trim();
  if (texto.length > INSTRUCOES_MAX) {
    return { success: false, error: `Instruções muito longas (máx ${INSTRUCOES_MAX} caracteres).` };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: texto ? { instrucoes: texto } : {} })
      .eq("chave", input.chave)
      .select("chave");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: `Config ${input.chave} não encontrada (migration pendente?)` };
    }
    revalidatePath("/automacoes");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "atualizar_instrucoes_ia", chave: input.chave, error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar o prompt." };
  }
}
