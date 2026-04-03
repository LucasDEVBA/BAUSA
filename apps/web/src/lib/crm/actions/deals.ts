"use server";

import { createAuditedSupabaseClient } from "@/lib/crm/supabase-audit";
import { getUserPapel } from "@/lib/crm/auth";
import { ETAPA_ORDEM, type StatusDeal } from "@/types/crm";

export async function moverDeal(
  dealId: string,
  novaEtapa: StatusDeal,
  motivo?: string,
) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode mover deals." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Buscar deal atual
  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .single();

  if (fetchError || !deal) {
    return { success: false, error: "Deal nao encontrado." };
  }

  const ordemAtual = ETAPA_ORDEM[deal.etapa as StatusDeal] || 0;
  const ordemNova = ETAPA_ORDEM[novaEtapa] || 0;
  const isRetrocesso = ordemNova < ordemAtual
    && novaEtapa !== "perdido"
    && novaEtapa !== "cancelamento_solicitado"
    && novaEtapa !== "projeto_futuro";

  // Avançar: exige next_action e data_proxima_acao
  if (ordemNova > ordemAtual) {
    if (!deal.next_action || !deal.data_proxima_acao) {
      return {
        success: false,
        error: "Preencha 'Next Action' e 'Data da proxima acao' antes de avancar.",
      };
    }
  }

  // Retrocesso: exige motivo
  if (isRetrocesso && !motivo) {
    return {
      success: false,
      error: "Retrocesso exige justificativa obrigatoria.",
    };
  }

  // Perdido: exige motivo
  if (novaEtapa === "perdido" && !motivo) {
    return {
      success: false,
      error: "Marcar como perdido exige motivo.",
    };
  }

  const updateData: Record<string, unknown> = {
    etapa: novaEtapa,
    etapa_anterior: deal.etapa,
  };

  if (isRetrocesso) {
    updateData.flag_retrocedido = true;
    updateData.motivo_retrocesso = motivo;
  }

  if (novaEtapa === "perdido") {
    updateData.motivo_perda = "outro";
    updateData.detalhe_perda = motivo;
  }

  const { error: updateError } = await supabase
    .from("deals")
    .update(updateData)
    .eq("id", dealId);

  if (updateError) {
    return { success: false, error: `Erro ao mover deal: ${updateError.message}` };
  }

  return { success: true };
}

export async function atualizarDeal(
  dealId: string,
  data: {
    next_action?: string;
    data_proxima_acao?: string;
    notas_reuniao?: string;
    probabilidade_fechamento?: number;
    status_decisao_familia?: string;
  },
) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode editar deals." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("deals")
    .update(data)
    .eq("id", dealId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
