"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { ETAPA_ORDEM, type StatusDeal } from "@/types/crm";
import {
  failMove,
  okMove,
  type MoveDealResult,
} from "@/lib/move-deal-result";
import { getProbabilidadePorEtapa } from "@/lib/actions/configuracoes";
import { registrarEventoGamificacao } from "@/lib/gamificacao";
import { JUSTIFICATIVA_VALOR_MAX, VALOR_DEAL_MAXIMO } from "@/lib/valor-deal";

// Destinos que nunca pontuam XP mesmo com ordem maior: perdas e
// estacionamentos têm ordem alta em ETAPA_ORDEM mas não são progresso.
const ETAPAS_SEM_XP: StatusDeal[] = [
  "perdido",
  "cancelamento_solicitado",
  "projeto_futuro",
  "aguardando_timing",
];

// Probabilidade por etapa: configurável pelo CEO via chave
// `probabilidade_por_etapa` de configuracoes_sistema (lida em
// getProbabilidadePorEtapa). O mapa hardcoded histórico virou o FALLBACK —
// ver PROBABILIDADE_ETAPA_FALLBACK em @/lib/etapas-deal.

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
    deal.etapa !== "aguardando_timing" &&
    // Colunas personalizadas são raias livres do CEO — entrar/sair delas
    // nunca é retrocesso (mesma isenção do trigger SQL, 20260904120000)
    !novaEtapa.startsWith("custom_") &&
    !String(deal.etapa).startsWith("custom_");

  // Decisão do CEO (2026-08-19): o pipeline é LIVRE — nenhum gate rígido de
  // avanço. Os antigos bloqueios (próxima ação preenchida, notas da reunião
  // antes de Diagnóstico/Fit, contrato antes de Contrato Assinado) travavam o
  // uso real ("Quero poder mover para onde eu quiser"). Os sinais continuam
  // visíveis (pontinho vermelho no card, aba Contrato); só não barram mais o
  // drag. Retrocesso e Perdido seguem pedindo MOTIVO — é coleta de contexto
  // em modal, não bloqueio.

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

  const probabilidadePorEtapa = await getProbabilidadePorEtapa();
  if (probabilidadePorEtapa[novaEtapa] !== undefined) {
    updateData.probabilidade_fechamento = probabilidadePorEtapa[novaEtapa];
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

  // ─── Loop de aprendizado do classificador v2 (spec §10, best-effort) ─────
  // desfecho_real permite cruzar previsto × realizado a cada ciclo de 90d.
  // fechou = contrato assinado em diante; perdeu = perdido. Nunca bloqueia.
  const DESFECHO_POR_ETAPA: Partial<Record<StatusDeal, string>> = {
    contrato_assinado: "fechou",
    sinal_pago: "fechou",
    admission_process: "fechou",
    concluido: "fechou",
    perdido: "perdeu",
  };
  const desfechoReal = DESFECHO_POR_ETAPA[novaEtapa];
  if (desfechoReal && deal.atleta_id) {
    try {
      const { data: atletaFs } = await supabase
        .from("atletas")
        .select("form_submission_id")
        .eq("id", deal.atleta_id)
        .maybeSingle();
      if (atletaFs?.form_submission_id) {
        const { error: desfechoErr } = await supabase
          .from("form_submissions")
          .update({ desfecho_real: desfechoReal })
          .eq("id", atletaFs.form_submission_id);
        if (desfechoErr) {
          console.warn("[moverDeal] desfecho_real update failed", desfechoErr.message);
        }
      }
    } catch (err) {
      console.warn("[moverDeal] desfecho_real update failed", err);
    }
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

  // Gamificação: XP SOMENTE em avanço real (ordemNova > ordemAtual e destino
  // que não é perda/estacionamento). Retrocesso/perdido nunca pontuam.
  const isAvancoReal = ordemNova > ordemAtual && !ETAPAS_SEM_XP.includes(novaEtapa);
  const gamificacao = isAvancoReal
    ? await registrarEventoGamificacao("deal_avancado", { tipo: "deal", id: dealId })
    : null;

  return okMove(dealId, novaEtapa, gamificacao);
}

const customizarValorSchema = z.object({
  dealId: z.string().trim().min(1, "Deal inválido."),
  // Zod 4: z.number() já rejeita NaN/Infinity
  novoValor: z
    .number({ error: "Valor inválido." })
    .positive("Valor deve ser maior que zero.")
    .max(VALOR_DEAL_MAXIMO, "Valor acima do limite (R$ 1.000.000) — confira os dígitos."),
  justificativa: z
    .string()
    .trim()
    .min(1, "Justificativa obrigatória.")
    .max(JUSTIFICATIVA_VALOR_MAX, `Justificativa com no máximo ${JUSTIFICATIVA_VALOR_MAX} caracteres.`),
});

export type CustomizarValorErro =
  | "PERMISSAO"
  | "VALIDACAO"
  | "NAO_ENCONTRADO"
  | "TEM_CONTRATO"
  | "ERRO";

export interface CustomizarValorResult {
  success: boolean;
  error?: string;
  code?: CustomizarValorErro;
}

/**
 * Valor NEGOCIADO do deal (sem contrato). Regra 3: justificativa obrigatória,
 * gravada no deal + audit trail. Com contrato vigente o valor exibido É o do
 * contrato (lib/valor-deal): customizar aqui criaria deal ≠ contrato, então
 * recusa com TEM_CONTRATO e a UI leva à aba do contrato (T3/T9).
 */
export async function customizarValorDeal(
  dealId: string,
  novoValor: number,
  justificativa: string,
): Promise<CustomizarValorResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, code: "PERMISSAO", error: "Apenas o CEO pode customizar valores." };
  }

  const parsed = customizarValorSchema.safeParse({ dealId, novoValor, justificativa });
  if (!parsed.success) {
    return { success: false, code: "VALIDACAO", error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const dados = parsed.data;

  const supabase = await createAuditedSupabaseClient();

  // Contrato vigente com plano e valor ⇒ o valor é do contrato. "Aguardando
  // plano" (plano nulo / valor 0 — T11) não bloqueia: ainda é negociação.
  const { data: contrato, error: contratoErr } = await supabase
    .from("contratos_financeiros")
    .select("id, plano, valor_total")
    .eq("deal_id", dados.dealId)
    .is("deleted_at", null)
    .maybeSingle();
  if (contratoErr) {
    console.error(JSON.stringify({
      level: "error",
      action: "customizar_valor_deal_contrato_falhou",
      dealId: dados.dealId,
      message: contratoErr.message,
    }));
    return { success: false, code: "ERRO", error: "Não foi possível conferir o contrato. Tente de novo." };
  }
  const contratoRow = contrato as { plano: string | null; valor_total: number | string | null } | null;
  if (contratoRow?.plano && Number(contratoRow.valor_total) > 0) {
    return {
      success: false,
      code: "TEM_CONTRATO",
      error: "Este deal tem contrato: o valor vem do contrato (veja a aba do contrato).",
    };
  }

  const { data: atualizados, error } = await supabase
    .from("deals")
    .update({
      valor_estimado: dados.novoValor,
      flag_valores_customizados: true,
      justificativa_customizacao: dados.justificativa,
    })
    .eq("id", dados.dealId)
    .is("deleted_at", null)
    .select("id");

  if (error) {
    console.error(JSON.stringify({
      level: "error",
      action: "customizar_valor_deal_update_falhou",
      dealId: dados.dealId,
      message: error.message,
    }));
    return { success: false, code: "ERRO", error: "Não foi possível salvar o valor. Tente de novo." };
  }
  if (!atualizados || atualizados.length === 0) {
    return { success: false, code: "NAO_ENCONTRADO", error: "Deal não encontrado (excluído?)." };
  }

  revalidatePath("/pipeline");
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
