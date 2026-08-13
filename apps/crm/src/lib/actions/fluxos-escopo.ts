"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";
import { ESCOPO_CHAVE, ESCOPO_PADRAO, escopoSchema, type FluxosEscopo } from "@/lib/fluxos-escopo-shared";

// ════════════════════════════════════════════════════════════════════════
// Escopo dos Fluxos — o gate do CEO ("funcional só quando eu quiser, num
// chat/grupo específico ou global").
//
// Só FUNÇÕES ASYNC aqui: schema, tipo e constantes moram em
// lib/fluxos-escopo-shared.ts (módulo "use server" não exporta const).
//
// Esta action apenas EDITA a configuração. Quem aplica o gate é o motor
// (fluxo-engine, fail-closed) — a decisão de disparo é sempre do servidor.
// ════════════════════════════════════════════════════════════════════════

export async function getEscopoFluxos(): Promise<FluxosEscopo> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", ESCOPO_CHAVE)
      .maybeSingle();
    if (!data?.valor) return ESCOPO_PADRAO;
    const bruto = typeof data.valor === "string" ? JSON.parse(data.valor) : data.valor;
    const parsed = escopoSchema.safeParse(bruto);
    return parsed.success ? parsed.data : ESCOPO_PADRAO;
  } catch {
    // Fail-closed também na leitura da tela: erro nunca vira "está ligado".
    return ESCOPO_PADRAO;
  }
}

export async function salvarEscopoFluxos(
  input: unknown,
): Promise<{ success: boolean; error?: string }> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO pode alterar o escopo dos fluxos." };

  const parsed = escopoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };

  // Ligar em modo lista sem nenhum alvo seria "ligado que não faz nada" —
  // pior que desligado, porque mente no painel.
  if (parsed.data.modo === "lista" && parsed.data.telefones.length + parsed.data.grupos.length === 0) {
    return { success: false, error: "Escolha ao menos um telefone ou grupo — ou use Global." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { error } = await supabase
      .from("configuracoes_sistema")
      .upsert({ chave: ESCOPO_CHAVE, valor: parsed.data }, { onConflict: "chave" });
    if (error) return { success: false, error: error.message };
    revalidatePath("/fluxos");
    return { success: true };
  } catch (err) {
    console.error({ level: "error", action: "salvar_escopo_fluxos", error: String(err) });
    return { success: false, error: "Erro inesperado ao salvar o escopo." };
  }
}
