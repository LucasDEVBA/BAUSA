"use server";

import { revalidatePath } from "next/cache";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { ETAPA_ORDEM, type StatusDeal } from "@/types/crm";
import {
  failMove,
  okMove,
  type MoveDealResult,
} from "@/lib/move-deal-result";

const PROBABILIDADE_POR_ETAPA: Record<string, number> = {
  lead: 10,
  aguardando_timing: 10, // estacionado = mesma chance de um lead novo
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
): Promise<MoveDealResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    console.error("[moverDeal] permission denied", { dealId, papel });
    return failMove("PERMISSION_DENIED");
  }

  const supabase = await createAuditedSupabaseClient();

  const { data: deal, error: fetchError } = await supabase
    .from("deals")
    .select("*")
    .eq("id", dealId)
    .single();

  if (fetchError || !deal) {
    console.error("[moverDeal] deal not found", {
      dealId,
      message: fetchError?.message,
    });
    return failMove("DEAL_NOT_FOUND", { action: { type: "reload" } });
  }

  const ordemAtual = ETAPA_ORDEM[deal.etapa as StatusDeal] || 0;
  const ordemNova = ETAPA_ORDEM[novaEtapa] || 0;
  // aguardando_timing é estacionamento (lead muito cedo aguardando novembro):
  // entrar ou sair dele nunca é retrocesso — mesma regra do trigger SQL
  // (migration 20260706173000)
  const isRetrocesso =
    ordemNova < ordemAtual &&
    novaEtapa !== "perdido" &&
    novaEtapa !== "cancelamento_solicitado" &&
    novaEtapa !== "projeto_futuro" &&
    novaEtapa !== "aguardando_timing" &&
    deal.etapa !== "aguardando_timing";

  // Estacionar não exige próxima ação — o deal fica dormente por design
  if (ordemNova > ordemAtual && novaEtapa !== "aguardando_timing") {
    if (!deal.next_action || !deal.data_proxima_acao) {
      console.error("[moverDeal] missing next_action", { dealId, novaEtapa });
      return failMove("MISSING_NEXT_ACTION", {
        field: !deal.next_action ? "next_action" : "data_proxima_acao",
        action: { type: "open_deal", dealId },
      });
    }
  }

  if (
    deal.etapa === "reuniao_realizada" &&
    ordemNova > ordemAtual &&
    !deal.notas_reuniao?.trim()
  ) {
    console.error("[moverDeal] missing meeting notes", { dealId });
    return failMove("MISSING_MEETING_NOTES", {
      field: "notas_reuniao",
      action: { type: "open_deal", dealId },
    });
  }

  if (novaEtapa === "contrato_assinado") {
    const { data: contrato } = await supabase
      .from("contratos_financeiros")
      .select("id")
      .eq("deal_id", dealId)
      .is("deleted_at", null)
      .maybeSingle();

    if (!contrato) {
      console.error("[moverDeal] missing contract", { dealId });
      return failMove("MISSING_CONTRACT", {
        action: { type: "create_contract", dealId },
      });
    }
  }

  if (isRetrocesso && !motivo) {
    console.error("[moverDeal] retrocesso reason required", {
      dealId,
      ordemAtual,
      ordemNova,
    });
    return failMove("REQUIRE_RETROCESSO_REASON", {
      action: {
        type: "open_retrocesso_modal",
        dealId,
        fromStage: deal.etapa as StatusDeal,
        toStage: novaEtapa,
      },
    });
  }

  if (novaEtapa === "perdido" && !motivo && !lossData) {
    console.error("[moverDeal] lost reason required", { dealId });
    return failMove("REQUIRE_LOST_REASON", {
      action: { type: "open_lost_modal", dealId, toStage: novaEtapa },
    });
  }

  const updateData: Record<string, unknown> = {
    etapa: novaEtapa,
    etapa_anterior: deal.etapa,
  };

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
    console.error("[moverDeal] update failed", {
      dealId,
      novaEtapa,
      message: updateError.message,
    });
    return failMove("DB_ERROR", {
      error: `Erro ao mover deal: ${updateError.message}`,
    });
  }

  // ─── Handoff application-level (best-effort, NUNCA bloqueia o sucesso) ───
  const FASES_FAMILIA: StatusDeal[] = ["admission_process", "concluido"];
  if (FASES_FAMILIA.includes(novaEtapa) && deal.atleta_id) {
    try {
      const { data: existing } = await supabase
        .from("crm_experiencia")
        .select("id, fase, deleted_at")
        .eq("atleta_id", deal.atleta_id)
        .maybeSingle();

      const faseDestino =
        novaEtapa === "concluido" ? "acompanhamento" : "admissao";

      let experienciaCriada = false;

      if (!existing) {
        // Enriquecer com dados do atleta para que a Head já tenha contexto
        const { data: atletaInfo } = await supabase
          .from("atletas")
          .select("whatsapp, email")
          .eq("id", deal.atleta_id)
          .maybeSingle();

        const nowIso = new Date().toISOString();
        const em7dias = new Date(Date.now() + 7 * 86400000).toISOString();

        const insertPayload: Record<string, unknown> = {
          atleta_id: deal.atleta_id,
          deal_id: dealId,
          fase: faseDestino,
          temperatura: "verde",
          ansiedade: 3,
          satisfacao: 5,
          risco_percebido: 1,
          status: "satisfeita",
          psicologa_acionada: false,
          // Pré-popula timestamps de contato (último = "agora", próximo = +7d)
          data_ultimo_contato: nowIso,
          tipo_ultimo_contato: atletaInfo?.whatsapp ? "whatsapp" : "email",
          proximo_contato: em7dias,
        };

        const { error: insertErr } = await supabase
          .from("crm_experiencia")
          .insert(insertPayload);

        if (insertErr) {
          console.error("[moverDeal][handoff] INSERT erro", {
            dealId,
            atletaId: deal.atleta_id,
            message: insertErr.message,
            code: insertErr.code,
          });
        } else {
          experienciaCriada = true;
        }
      } else if (
        novaEtapa === "concluido" &&
        existing.fase !== "acompanhamento" &&
        existing.fase !== "encerrado"
      ) {
        await supabase
          .from("crm_experiencia")
          .update({ fase: "acompanhamento" })
          .eq("id", existing.id);
      }

      if (experienciaCriada) {
        try {
          const { data: headUser } = await supabase
            .from("user_profiles")
            .select("id")
            .eq("papel", "head_sucesso")
            .eq("ativo", true)
            .limit(1)
            .maybeSingle();
          const { data: atleta } = await supabase
            .from("atletas")
            .select("nome_completo")
            .eq("id", deal.atleta_id)
            .maybeSingle();
          const nome = atleta?.nome_completo ?? "atleta";

          if (headUser) {
            const prazo = new Date(Date.now() + 48 * 60 * 60 * 1000);
            await supabase.from("tarefas").insert({
              titulo: `Onboarding ${nome}`,
              descricao:
                "Iniciar gestao da familia: confirmar dados de contato, indicadores iniciais e proximo contato.",
              responsavel_id: headUser.id,
              prazo: prazo.toISOString(),
              prioridade: "alta",
              deal_id: dealId,
              modulo_origem: "experiencia",
              criada_automaticamente: true,
            });
            await supabase.from("notificacoes").insert({
              destinatario_id: headUser.id,
              titulo: `Nova familia: ${nome}`,
              mensagem:
                "Deal avancou para admission_process. Registro de experiencia criado.",
              tipo: "handoff",
              severidade: "alta",
              deal_id: dealId,
              link: "/familias-crm",
            });
          }
        } catch (notifErr) {
          console.warn("[moverDeal] handoff notification failed", notifErr);
        }
      }
    } catch (handoffErr) {
      console.warn("[moverDeal] handoff experiencia failed", handoffErr);
    }
  }

  if (
    FASES_FAMILIA.includes(novaEtapa) ||
    FASES_FAMILIA.includes(deal.etapa as StatusDeal)
  ) {
    revalidatePath("/familias-pipeline");
    revalidatePath("/familias-crm");
    revalidatePath("/familias");
  }
  revalidatePath("/pipeline");

  return okMove(dealId, novaEtapa);
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
