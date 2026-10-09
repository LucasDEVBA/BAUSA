"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { chamarRpcFinanceira } from "@/lib/financeiro/rpc";

/**
 * Ações financeiras LEGADAS que continuam valendo (NF, cancelamento, descarte).
 *
 * ⚠️ 2026-10 (T5/T6/T9/T10/T11): criarContrato, confirmarPagamento,
 * confirmarSinalPago e getContratoByDeal SAÍRAM daqui. Toda escrita de
 * dinheiro agora passa por `lib/actions/financeiro-contrato.ts` → RPCs fin_*
 * (atômicas, autor no audit, soma validada no banco). Motivos: o
 * confirmarSinalPago forçava etapa='sinal_pago' (puxava deal de "Valor total
 * pago" para trás) e a baixa nunca gravava entrada_paga; o criarContrato fazia
 * N requests sem transação. Guard: tests/financeiro-contrato-invariants.test.js.
 */

const nfSchema = z.object({
  contractId: z.uuid(),
  nfNumero: z.string().trim().max(60).nullable(),
  nfEmitidaAt: z.iso.date().nullable(),
  nfValor: z.number().min(0).max(99_999_999.99).nullable(),
  nfStatus: z.enum(["pendente", "emitida", "nao_aplicavel"]),
});

export async function updateNfData(dados: {
  contractId: string;
  nfNumero: string | null;
  nfEmitidaAt: string | null;
  nfValor: number | null;
  nfStatus: "pendente" | "emitida" | "nao_aplicavel";
}) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode editar dados de NF." };
  }
  const parsed = nfSchema.safeParse(dados);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados da NF inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("contratos_financeiros")
    .update({
      nf_numero: parsed.data.nfNumero,
      nf_emitida_at: parsed.data.nfEmitidaAt,
      nf_valor: parsed.data.nfValor,
      nf_status: parsed.data.nfStatus,
    })
    .eq("id", parsed.data.contractId)
    .is("deleted_at", null);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/financeiro");
  revalidatePath("/contratos");
  revalidatePath(`/contratos/${parsed.data.contractId}`);

  return { success: true };
}

// Corpo de origin/develop com 2 mudanças: cancela previsto E atrasado, e as
// parcelas são canceladas ANTES de mover o deal, com erro checado — falha no
// meio não pode deixar o deal "perdido" com parcelas abertas que a régua cobra.
export async function solicitarCancelamento(dealId: string, dados: {
  motivo_cancelamento: string;
  valor_reembolso: number;
  justificativa_reembolso: string;
  comprovante_url?: string;
}) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode processar cancelamentos." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Buscar deal
  const { data: deal, error: fetchErr } = await supabase
    .from("deals")
    .select("id, etapa, atleta:atletas(nome_completo, responsavel_id)")
    .eq("id", dealId)
    .single();

  if (fetchErr || !deal) {
    return { success: false, error: "Deal nao encontrado." };
  }

  // 1º as parcelas pendentes do contrato (repetir é seguro: as já canceladas
  // não casam o filtro de status).
  const { data: contrato, error: contratoErr } = await supabase
    .from("contratos_financeiros")
    .select("id")
    .eq("deal_id", dealId)
    .is("deleted_at", null)
    .maybeSingle();
  if (contratoErr) {
    console.error({ level: "error", action: "cancelamento_ler_contrato", dealId, error: contratoErr.message });
    return { success: false, error: "Não foi possível ler o contrato — nada foi alterado. Tente de novo." };
  }

  if (contrato) {
    // previsto E atrasado (antes só previsto: a parcela já vencida continuava
    // em aberto e a régua de cobrança seguiria cobrando quem cancelou).
    const { error: parcErr } = await supabase
      .from("parcelas")
      .update({ status: "cancelado" })
      .eq("contrato_id", contrato.id)
      .in("status", ["previsto", "atrasado"])
      .is("deleted_at", null);
    if (parcErr) {
      console.error({ level: "error", action: "cancelamento_parcelas", dealId, contratoId: contrato.id, error: parcErr.message });
      return { success: false, error: "Não foi possível cancelar as parcelas — nada foi alterado. Tente de novo." };
    }
  }

  // Atualizar deal com dados de cancelamento
  const { error: updateErr } = await supabase
    .from("deals")
    .update({
      etapa: "perdido",
      etapa_anterior: deal.etapa,
      motivo_perda: "cancelamento_processado",
      detalhe_perda: dados.motivo_cancelamento,
    })
    .eq("id", dealId);

  if (updateErr) {
    console.error({ level: "error", action: "cancelamento_mover_deal", dealId, error: updateErr.message });
    return {
      success: false,
      error: "As parcelas foram canceladas, mas o negócio não mudou de etapa. Tente de novo.",
    };
  }

  // Criar notificacao para CEO
  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (currentUser?.id) {
    const rawAtleta = deal.atleta as unknown;
    const atletaData = (Array.isArray(rawAtleta) ? rawAtleta[0] : rawAtleta) as Record<string, unknown> | null;
    const atletaNome = (atletaData?.nome_completo as string) ?? "Atleta";

    await supabase.from("notificacoes").insert({
      destinatario_id: currentUser.id,
      titulo: "Cancelamento processado",
      mensagem: `Cancelamento de ${atletaNome} processado. Reembolso: R$ ${dados.valor_reembolso.toLocaleString("pt-BR")}. Motivo: ${dados.motivo_cancelamento}`,
      tipo: "cancelamento",
      severidade: "alta",
      deal_id: dealId,
      link: "/financeiro?tab=cancelamentos",
    });
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath("/financeiro");

  return { success: true };
}

/**
 * Descartar contrato SEM NENHUM pagamento (ex.: criado no deal errado ou de
 * teste). Wrapper da RPC atômica `fin_descartar_contrato` (lock no contrato +
 * checagem de pagamento + soft delete de parcelas/itens/contrato + evento na
 * MESMA transação). A versão anterior apagava as parcelas ANTES do CAS: uma
 * baixa entre os dois passos deixava a parcela recebida com soft delete.
 * Como fin_criar_contrato/fin_registrar_sinal REUTILIZAM a linha descartada
 * (UNIQUE(deal_id) completa), criar de novo não estoura 23505.
 */
export async function excluirContratoSemPagamento(contratoId: string, justificativa?: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode descartar contratos." };
  }
  if (!z.uuid().safeParse(contratoId).success) {
    return { success: false, error: "Contrato inválido." };
  }
  const r = await chamarRpcFinanceira<{ contrato_id: string; deal_id: string }>(
    "fin_descartar_contrato",
    { p_contrato_id: contratoId, p_justificativa: justificativa?.trim().slice(0, 1000) || null },
    { contratoId },
  );
  if (!r.success) return { success: false, error: r.error };

  revalidatePath("/pipeline");
  revalidatePath("/financeiro");
  revalidatePath("/contratos");
  return { success: true };
}
