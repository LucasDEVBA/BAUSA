"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";

/**
 * Handoff do ganho: ao fechar o contrato (Sinal pago), o CEO escolhe a
 * shortlist de escolas que a Head vai trabalhar.
 *
 * A jornada pós-venda começa exatamente em "Envio de opções" — a shortlist
 * É o primeiro entregável da família. Antes, o deal virava ganho e a Head
 * recebia a família sem nenhuma escola indicada.
 *
 * O move NÃO depende disto: o deal já avançou quando este modal abre. Se o
 * CEO fechar sem escolher, ele escolhe depois em /matching — travar o funil
 * atrás de uma decisão de escola seria pior que adiá-la.
 */

export interface EscolaSugerida {
  escolaId: string;
  nome: string;
  estado: string | null;
  tipo: string | null;
  score: number;
  classificacao: string;
  /** Já está na estratégia deste atleta (evita duplicar). */
  jaEscolhida: boolean;
}

type Result<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

const PRIORIDADES = ["primeira", "segunda", "terceira", "safety"] as const;

const selecaoSchema = z.object({
  escolaId: z.string().uuid(),
  prioridade: z.enum(PRIORIDADES),
});

const salvarSchema = z.object({
  atletaId: z.string().uuid(),
  selecoes: z.array(selecaoSchema).min(1, "Escolha ao menos uma escola.").max(20),
});

/** Top escolas por match + o que já foi escolhido para este atleta. */
export async function getEscolasSugeridas(atletaId: string): Promise<Result<EscolaSugerida[]>> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode montar a shortlist." };
  }
  if (!z.string().uuid().safeParse(atletaId).success) {
    return { success: false, error: "Atleta inválido." };
  }

  const supabase = await createServerSupabaseClient();

  const [sugestoes, jaNaEstrategia] = await Promise.all([
    supabase.rpc("sugerir_escolas", { p_atleta_id: atletaId, p_limite: 12 }),
    supabase.from("estrategia_escolas").select("escola_id").eq("atleta_id", atletaId),
  ]);

  if (sugestoes.error) {
    console.error({
      level: "error",
      action: "get_escolas_sugeridas",
      atletaId,
      erro: sugestoes.error.message,
    });
    return { success: false, error: "Não foi possível calcular as sugestões agora." };
  }

  const escolhidas = new Set(
    ((jaNaEstrategia.data ?? []) as { escola_id: string }[]).map((e) => e.escola_id),
  );

  const linhas = (sugestoes.data ?? []) as Array<{
    escola_id: string;
    escola_nome: string;
    estado: string | null;
    tipo: string | null;
    score: number;
    classificacao: string;
  }>;

  return {
    success: true,
    data: linhas.map((l) => ({
      escolaId: l.escola_id,
      nome: l.escola_nome,
      estado: l.estado,
      tipo: l.tipo,
      score: l.score,
      classificacao: l.classificacao,
      jaEscolhida: escolhidas.has(l.escola_id),
    })),
  };
}

/**
 * Grava a shortlist escolhida.
 *
 * Upsert por (atleta, escola): reabrir o modal e confirmar de novo ajusta a
 * prioridade em vez de duplicar a linha na estratégia.
 */
export async function salvarShortlistEscolas(input: unknown): Promise<Result<number>> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode montar a shortlist." };
  }
  const parsed = salvarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { atletaId, selecoes } = parsed.data;

  try {
    const supabase = await createAuditedSupabaseClient();

    // O score é recalculado no servidor: o número que chega do cliente é
    // apresentação, não pode virar dado de negócio.
    const comScore = await Promise.all(
      selecoes.map(async (s) => {
        const { data } = await supabase.rpc("calcular_match_score", {
          p_atleta_id: atletaId,
          p_escola_id: s.escolaId,
        });
        return {
          atleta_id: atletaId,
          escola_id: s.escolaId,
          prioridade: s.prioridade,
          match_score: typeof data === "number" ? data : null,
          status: "planejamento",
        };
      }),
    );

    const { error } = await supabase
      .from("estrategia_escolas")
      .upsert(comScore, { onConflict: "atleta_id,escola_id" });

    if (error) {
      return { success: false, error: `Não foi possível salvar: ${error.message}` };
    }

    revalidatePath("/matching");
    revalidatePath("/pipeline");
    revalidatePath("/familias-crm");
    return { success: true, data: comScore.length };
  } catch (e) {
    console.error({ level: "error", action: "salvar_shortlist", atletaId, erro: String(e) });
    return { success: false, error: "Falha ao salvar a shortlist. Tente de novo." };
  }
}
