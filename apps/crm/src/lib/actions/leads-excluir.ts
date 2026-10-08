"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";

/**
 * Exclusão de lead = SOFT DELETE em cascata, ATÔMICA e IDEMPOTENTE, feita
 * inteira pela função SQL public.excluir_lead (SECURITY DEFINER com gate
 * CEO/CTO interno — migration *_excluir_lead_atomico.sql).
 *
 * Por que no banco (bug 2026-08-24 → 2026-10-08): a cascata rodava aqui com
 * o client do usuário e a RLS de atletas/deals (SELECT USING deleted_at IS
 * NULL) barrava o próprio UPDATE que preenche deleted_at (42501). O erro era
 * engolido, a tela dizia "excluído" e a 2ª tentativa morria no CAS da
 * form_submission ("Lead já estava excluído") — caso Vicente.
 *
 * Continua sendo soft delete: nada é apagado. O lead sai das listas, do
 * pipeline e de TODOS os schedulers (deleted_at IS NULL — guard
 * tests/scheduler-eligibility.test.js). Grupos de WhatsApp são
 * desvinculados (nunca apagados) e tarefas abertas, canceladas.
 */

const idSchema = z.string().uuid();

/** Contrato da função SQL (jsonb) — validado, nunca confiado às cegas. */
const respostaExclusaoSchema = z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    ja_excluido: z.boolean(),
    form_submission_id: z.string().uuid().nullable(),
    atletas_excluidos: z.number().int().nonnegative(),
    deals_excluidos: z.number().int().nonnegative(),
    grupos_desvinculados: z.number().int().nonnegative(),
    tarefas_canceladas: z.number().int().nonnegative(),
    deal_alvo_excluido: z.boolean().nullable(),
    aviso: z.string().nullable(),
  }),
  z.object({
    success: z.literal(false),
    code: z.string(),
    error: z.string(),
  }),
]);

export type ExcluirLeadResult =
  | {
      success: true;
      /** O lead já estava excluído antes desta chamada (outra aba / reparo). */
      jaExcluido: boolean;
      atletasExcluidos: number;
      dealsExcluidos: number;
      gruposDesvinculados: number;
      tarefasCanceladas: number;
      /** Exclusão pelo CARD: true = o deal clicado está confirmadamente fora. */
      dealAlvoExcluido: boolean | null;
      aviso: string | null;
    }
  | { success: false; error: string };

const MSG_SEM_PERMISSAO = "Apenas CEO/CTO podem excluir leads.";
/** SQLSTATE do RAISE da função (gate de papel) e do REVOKE (anon). */
const SQLSTATE_PERMISSAO = "42501";
/** PostgREST: função não encontrada (janela entre deploy do app e da migration). */
const POSTGREST_FUNCAO_AUSENTE = "PGRST202";

type AlvoExclusao = { p_form_submission_id: string } | { p_deal_id: string };

async function executarExclusao(alvo: AlvoExclusao): Promise<ExcluirLeadResult> {
  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase.rpc("excluir_lead", alvo);

    if (error) {
      console.error({ level: "error", action: "excluir_lead", alvo, code: error.code, message: error.message });
      if (error.code === SQLSTATE_PERMISSAO) return { success: false, error: MSG_SEM_PERMISSAO };
      if (error.code === POSTGREST_FUNCAO_AUSENTE) {
        return {
          success: false,
          error: "Exclusão indisponível no momento (atualização do banco pendente). Tente de novo em alguns minutos.",
        };
      }
      return { success: false, error: `Erro ao excluir — nada foi alterado: ${error.message}` };
    }

    const parsed = respostaExclusaoSchema.safeParse(data as unknown);
    if (!parsed.success) {
      console.error({ level: "error", action: "excluir_lead_resposta_invalida", alvo });
      return {
        success: false,
        error: "Resposta inesperada da exclusão — recarregue a página e confira o lead antes de tentar de novo.",
      };
    }
    const r = parsed.data;
    if (!r.success) return { success: false, error: r.error };

    console.log({
      level: "info",
      action: "excluir_lead",
      alvo,
      jaExcluido: r.ja_excluido,
      atletas: r.atletas_excluidos,
      deals: r.deals_excluidos,
      grupos: r.grupos_desvinculados,
      tarefas: r.tarefas_canceladas,
    });
    revalidatePath("/leads");
    revalidatePath("/pipeline");
    revalidatePath("/war-room");
    return {
      success: true,
      jaExcluido: r.ja_excluido,
      atletasExcluidos: r.atletas_excluidos,
      dealsExcluidos: r.deals_excluidos,
      gruposDesvinculados: r.grupos_desvinculados,
      tarefasCanceladas: r.tarefas_canceladas,
      dealAlvoExcluido: r.deal_alvo_excluido,
      aviso: r.aviso,
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "excluir_lead_inesperado",
      alvo,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { success: false, error: "Erro inesperado ao excluir — nada foi alterado. Tente de novo." };
  }
}

/** Exclusão pela tabela de /leads (id da form_submission). */
export async function excluirLead(formSubmissionId: string): Promise<ExcluirLeadResult> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: MSG_SEM_PERMISSAO };
  if (!idSchema.safeParse(formSubmissionId).success) return { success: false, error: "Id inválido." };
  return executarExclusao({ p_form_submission_id: formSubmissionId });
}

/**
 * Exclusão pelo CARD do pipeline (id do deal). A função resolve deal →
 * atleta → form_submission no banco; lead sem form_submission (cadastro
 * manual) exclui atleta + deals do mesmo jeito — antes esse caminho falhava
 * em silêncio e devolvia sucesso.
 */
export async function excluirLeadPorDeal(dealId: string): Promise<ExcluirLeadResult> {
  if ((await getUserPapel()) !== "ceo") return { success: false, error: MSG_SEM_PERMISSAO };
  if (!idSchema.safeParse(dealId).success) return { success: false, error: "Id inválido." };
  return executarExclusao({ p_deal_id: dealId });
}
