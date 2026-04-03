"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { ETAPA_ORDEM, type StatusDeal } from "@/types/crm";

const PROBABILIDADE_POR_ETAPA: Record<string, number> = {
  lead: 10,
  reuniao_marcada: 20,
  reuniao_realizada: 30,
  diagnostico_fit: 40,
  alinhamento_estrategico: 50,
  proposta_enviada: 60,
  followup_proposta: 65,
  negociacao: 70,
  contrato_enviado: 80,
  contrato_assinado: 90,
  sinal_pago: 95,
  admission_process: 98,
};

export interface StructuredLossData {
  motivo_perda: string;
  detalhe_perda: string;
  pode_reativar?: boolean;
  data_reativacao?: string;
}

export async function moverDeal(
  dealId: string,
  novaEtapa: StatusDeal,
  motivo?: string,
  lossData?: StructuredLossData,
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

  // Validacao: avancar de reuniao_realizada exige notas_reuniao preenchidas
  if (
    deal.etapa === "reuniao_realizada" &&
    ordemNova > ordemAtual &&
    !deal.notas_reuniao?.trim()
  ) {
    return {
      success: false,
      error: "Preencha as notas da reuniao antes de avancar para Diagnostico/Fit.",
    };
  }

  // Validacao: contrato_assinado requer contrato financeiro
  if (novaEtapa === "contrato_assinado") {
    const { data: contrato } = await supabase
      .from("contratos_financeiros")
      .select("id")
      .eq("deal_id", dealId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!contrato) {
      return {
        success: false,
        error: "Crie um contrato financeiro antes de marcar como Contrato Assinado.",
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

  // Perdido: exige motivo ou lossData
  if (novaEtapa === "perdido" && !motivo && !lossData) {
    return {
      success: false,
      error: "Marcar como perdido exige motivo.",
    };
  }

  const updateData: Record<string, unknown> = {
    etapa: novaEtapa,
    etapa_anterior: deal.etapa,
  };

  // Auto-sugerir probabilidade de fechamento pela etapa
  if (PROBABILIDADE_POR_ETAPA[novaEtapa] !== undefined) {
    updateData.probabilidade_fechamento = PROBABILIDADE_POR_ETAPA[novaEtapa];
  }

  if (isRetrocesso) {
    updateData.flag_retrocedido = true;
    updateData.motivo_retrocesso = motivo;
  }

  if (novaEtapa === "perdido") {
    if (lossData) {
      updateData.motivo_perda = lossData.motivo_perda;
      updateData.detalhe_perda = lossData.detalhe_perda;
      updateData.pode_reativar = lossData.pode_reativar ?? false;
      updateData.data_reativacao = lossData.data_reativacao ?? null;
    } else {
      updateData.motivo_perda = "outro";
      updateData.detalhe_perda = motivo;
    }
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

export async function customizarValorDeal(
  dealId: string,
  novoValor: number,
  justificativa: string,
) {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode customizar valores." };
  }

  if (!justificativa.trim()) {
    return { success: false, error: "Justificativa obrigatoria." };
  }

  if (novoValor <= 0) {
    return { success: false, error: "Valor deve ser maior que zero." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("deals")
    .update({
      valor_estimado: novoValor,
      flag_valores_customizados: true,
      justificativa_customizacao: justificativa,
    })
    .eq("id", dealId);

  if (error) {
    return { success: false, error: error.message };
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
