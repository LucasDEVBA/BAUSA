"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Programa de indicações — criar, transicionar status e recompensa.
// Permissão: escrita em `indicacoes` é CEO-only pela RLS (policy
// "indicacoes_ceo" na migration 20260401001800) — as actions espelham o
// gate no app (defense-in-depth). Head tem apenas leitura (indicacoes_select).
// Ao CONVERTER, incrementa crm_experiencia.indicacoes_geradas da família
// indicadora via RPC atômica (SECURITY INVOKER — migration 20260711084108).
// ════════════════════════════════════════════════════════════════════════

export type IndicacaoStatus = "pendente" | "em_negociacao" | "convertido" | "perdido";

const STATUS_LABEL: Record<IndicacaoStatus, string> = {
  pendente: "Pendente",
  em_negociacao: "Em negociação",
  convertido: "Convertido",
  perdido: "Perdido",
};

/** Transições válidas: pendente→em_negociacao→convertido|perdido
 *  (com atalho pendente→convertido|perdido). Convertido/perdido são finais —
 *  isso também garante que o incremento de indicacoes_geradas ocorre 1x. */
const TRANSICOES_VALIDAS: Record<IndicacaoStatus, IndicacaoStatus[]> = {
  pendente: ["em_negociacao", "convertido", "perdido"],
  em_negociacao: ["convertido", "perdido"],
  convertido: [],
  perdido: [],
};

const NOME_MAX = 160;
const OBSERVACAO_MAX = 1000;
const WHATSAPP_DIGITOS_MIN = 8;
const WHATSAPP_DIGITOS_MAX = 15;

function soDigitos(raw: string): string {
  return raw.replace(/\D/g, "");
}

const criarSchema = z
  .object({
    /** crm_experiencia.id da família indicadora (opcional — pode ser avulso). */
    indicador_experiencia_id: z.string().uuid("Família indicadora inválida.").nullish(),
    /** Nome livre de quem indicou (obrigatório quando sem vínculo). */
    indicador_nome: z.string().trim().max(NOME_MAX, "Nome de quem indicou muito longo.").nullish(),
    indicado_nome: z
      .string()
      .trim()
      .min(2, "Nome do indicado é obrigatório.")
      .max(NOME_MAX, "Nome do indicado muito longo."),
    indicado_whatsapp: z.string().trim().max(30, "WhatsApp inválido.").nullish(),
    observacao: z.string().trim().max(OBSERVACAO_MAX, "Observação muito longa.").nullish(),
  })
  .superRefine((val, ctx) => {
    if (!val.indicador_experiencia_id && !val.indicador_nome?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "Informe a família indicadora ou o nome de quem indicou.",
      });
    }
    if (val.indicado_whatsapp?.trim()) {
      const digitos = soDigitos(val.indicado_whatsapp);
      if (digitos.length < WHATSAPP_DIGITOS_MIN || digitos.length > WHATSAPP_DIGITOS_MAX) {
        ctx.addIssue({ code: "custom", message: "WhatsApp do indicado inválido (use DDI+DDD+número)." });
      }
    }
  });

export type CriarIndicacaoInput = z.input<typeof criarSchema>;

export async function criarIndicacao(
  input: CriarIndicacaoInput,
): Promise<{ success: boolean; error?: string; id?: string; indicadorNome?: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode criar indicações." };
  }

  const parsed = criarSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const dados = parsed.data;

  const supabase = await createAuditedSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Resolve a família indicadora server-side (não confiar no nome do client):
  // atleta da experiência dá o nome de exibição e o responsável preenche o
  // FK legado responsavel_indicador_id (mantém o "Top Indicadores" agregando).
  let indicadorNome = dados.indicador_nome?.trim() || null;
  let responsavelIndicadorId: string | null = null;

  if (dados.indicador_experiencia_id) {
    const { data: exp, error: expError } = await supabase
      .from("crm_experiencia")
      .select("id, atleta:atletas(id, nome_completo, responsavel_id)")
      .eq("id", dados.indicador_experiencia_id)
      .is("deleted_at", null)
      .single();

    if (expError || !exp) {
      return { success: false, error: "Família indicadora não encontrada." };
    }
    const atleta = (exp as unknown as {
      atleta: { id: string; nome_completo: string | null; responsavel_id: string | null } | null;
    }).atleta;
    indicadorNome = atleta?.nome_completo ?? indicadorNome;
    responsavelIndicadorId = atleta?.responsavel_id ?? null;
  }

  const { data: criada, error } = await supabase
    .from("indicacoes")
    .insert({
      indicador_experiencia_id: dados.indicador_experiencia_id ?? null,
      responsavel_indicador_id: responsavelIndicadorId,
      indicador_nome: indicadorNome,
      indicado_nome: dados.indicado_nome,
      indicado_whatsapp: dados.indicado_whatsapp?.trim() ? soDigitos(dados.indicado_whatsapp) : null,
      observacao: dados.observacao?.trim() || null,
      status: "pendente",
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/indicacoes");
  return { success: true, id: criada.id, indicadorNome: indicadorNome ?? undefined };
}

export async function atualizarStatusIndicacao(
  indicacaoId: string,
  novoStatus: IndicacaoStatus,
): Promise<{ success: boolean; error?: string; warning?: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode alterar o status." };
  }

  const idParse = z.string().uuid().safeParse(indicacaoId);
  const statusParse = z.enum(["pendente", "em_negociacao", "convertido", "perdido"]).safeParse(novoStatus);
  if (!idParse.success || !statusParse.success) {
    return { success: false, error: "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { data: atual, error: fetchError } = await supabase
    .from("indicacoes")
    .select("id, status, indicador_experiencia_id")
    .eq("id", indicacaoId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !atual) return { success: false, error: "Indicação não encontrada." };

  const statusAtual = atual.status as IndicacaoStatus;
  if (!TRANSICOES_VALIDAS[statusAtual]?.includes(novoStatus)) {
    return {
      success: false,
      error: `Transição inválida: ${STATUS_LABEL[statusAtual]} → ${STATUS_LABEL[novoStatus]}.`,
    };
  }

  // CAS no status: se outra sessão mudou entre o fetch e o update, 0 linhas
  // são afetadas — evita converter (e incrementar o contador) em duplicidade.
  const { data: atualizadas, error: updateError } = await supabase
    .from("indicacoes")
    .update({
      status: novoStatus,
      ...(novoStatus === "convertido" ? { recompensa_devida: true } : {}),
    })
    .eq("id", indicacaoId)
    .eq("status", statusAtual)
    .select("id");

  if (updateError) return { success: false, error: updateError.message };
  if (!atualizadas || atualizadas.length === 0) {
    return { success: false, error: "A indicação foi alterada por outra sessão. Recarregue a página." };
  }

  let warning: string | undefined;
  if (novoStatus === "convertido" && atual.indicador_experiencia_id) {
    const { data: incrementadas, error: rpcError } = await supabase.rpc(
      "incrementar_indicacoes_geradas",
      { p_experiencia_id: atual.indicador_experiencia_id },
    );
    if (rpcError || !incrementadas) {
      console.error({
        level: "error",
        action: "incrementar_indicacoes_geradas",
        indicacaoId,
        erro: rpcError?.message ?? "0 linhas atualizadas",
      });
      warning = "Convertida, mas o contador de indicações da família não foi incrementado.";
    }
  }

  revalidatePath("/indicacoes");
  revalidatePath("/familias-crm");
  return { success: true, warning };
}

export async function marcarRecompensaEntregue(indicacaoId: string, descricao: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("indicacoes")
    .update({
      recompensa_entregue: true,
      recompensa_entregue_at: new Date().toISOString(),
      recompensa_descricao: descricao,
    })
    .eq("id", indicacaoId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/indicacoes");
  return { success: true };
}
