"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { type StatusDeal } from "@/types/crm";
import {
  failMove,
  okMove,
  type MoveDealResult,
} from "@/lib/move-deal-result";
import { getConfigEtapasDeal } from "@/lib/actions/configuracoes";
import { registrarEventoGamificacao } from "@/lib/gamificacao";
import { JUSTIFICATIVA_VALOR_MAX, VALOR_DEAL_MAXIMO } from "@/lib/valor-deal";
import { mergeDealStageConfig } from "@/lib/etapas-deal";
import { isAvancoReal, isRetrocessoEtapa } from "@/lib/etapas-ordem";

// Ordem/retrocesso/XP: regra ÚNICA em @/lib/etapas-ordem (espelho do trigger
// SQL trg_deals_check_etapa → public.etapa_e_retrocesso). Probabilidade por
// etapa, rótulos e regras por coluna (ganho/pede plano/ação padrão) vêm de
// configuracoes_sistema numa leitura só (getConfigEtapasDeal); os mapas
// hardcoded são só FALLBACK — ver @/lib/etapas-deal.

// Campos que o editor do deal pode gravar (atualizarDeal é chamável do client:
// whitelist contra mass assignment).
const CAMPOS_EDITAVEIS_DEAL = [
  "next_action",
  "data_proxima_acao",
  "notas_reuniao",
  "probabilidade_fechamento",
  "status_decisao_familia",
] as const;

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

  // Config das etapas (ordem do board, regras por coluna, probabilidade)
  // numa leitura só. Falha → ordem FIXA (mesmo fallback do trigger SQL).
  const cfgEtapas = await getConfigEtapasDeal();
  if (!cfgEtapas.lida) {
    console.error({
      level: "error",
      action: "mover_deal_config_fallback",
      dealId,
      detalhe: "etapas_deal_config ilegível — retrocesso pela ordem fixa",
    });
  }
  const etapaAtual = String(deal.etapa);
  // Config mesclada (ordem/visibilidade do board + regras por coluna) — a
  // mesma que o board usa para desenhar as colunas.
  const stageMap = mergeDealStageConfig(cfgEtapas.overrides, cfgEtapas.regras);
  // Regra ÚNICA (espelho do trigger trg_deals_check_etapa): isenções de
  // sempre (perdido/cancelamento/projeto_futuro/aguardando_timing/custom_*) e
  // ordem do BOARD quando as duas etapas estão visíveis — "Sinal pago →
  // Plano escolhido" é avanço porque é assim que o CEO ordenou as colunas.
  const isRetrocesso = isRetrocessoEtapa(etapaAtual, novaEtapa, stageMap);

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
      de: etapaAtual,
      para: novaEtapa,
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

  if (cfgEtapas.probabilidade[novaEtapa] !== undefined) {
    updateData.probabilidade_fechamento = cfgEtapas.probabilidade[novaEtapa];
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

  // ─── Próxima ação padrão da coluna de destino (T21) ─────────────────────
  // Aplicada pelo TRIGGER trg_deals_next_action_meta (migration
  // *_deals_next_action_meta) — fonte ÚNICA para o Engine e para as CFs que mudam a
  // etapa sozinhas (meeting-transcripts → Reunião realizada, sinal, automações).
  // NUNCA sobrescreve ação escrita à mão e NUNCA esvazia (Regra 2). Aqui o
  // moverDeal NÃO toca em next_action: só lê o resultado para o toast.

  // CAS na etapa LIDA: retrocesso foi decidido sobre ela — se outra aba moveu
  // o deal no meio, não grava em cima.
  const { data: movidos, error: updateError } = await supabase
    .from("deals")
    .update(updateData)
    .eq("id", dealId)
    .eq("etapa", deal.etapa)
    .is("deleted_at", null)
    .select("id, next_action");

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
  if (!movidos || movidos.length === 0) {
    console.error("[moverDeal] CAS perdeu — deal mudou de etapa", {
      dealId,
      de: etapaAtual,
      para: novaEtapa,
    });
    return failMove("DEAL_CHANGED", { action: { type: "reload" } });
  }
  const acaoDepois = (movidos[0] as { next_action?: string | null }).next_action ?? null;
  const proximaAcao =
    acaoDepois && acaoDepois !== (deal.next_action as string | null) ? acaoDepois : null;

  // ─── Loop de aprendizado do classificador v2 (spec §10, best-effort) ─────
  // desfecho_real permite cruzar previsto × realizado a cada ciclo de 90d.
  // fechou = qualquer etapa de GANHO (contrato assinado em diante, Plano
  // escolhido e colunas personalizadas marcadas como ganho); perdeu = perdido.
  // Nunca bloqueia.
  const desfechoReal =
    novaEtapa === "perdido"
      ? "perdeu"
      : stageMap[novaEtapa]?.ganho
        ? "fechou"
        : undefined;
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

  // Gamificação: XP SOMENTE em avanço real (mesma escala da regra de
  // retrocesso; destino que não é perda/estacionamento). Voltar nunca pontua.
  const gamificacao = isAvancoReal(etapaAtual, novaEtapa, stageMap)
    ? await registrarEventoGamificacao("deal_avancado", { tipo: "deal", id: dealId })
    : null;

  return okMove(dealId, novaEtapa, gamificacao, proximaAcao);
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

  // Whitelist (mass assignment): só os campos do editor passam.
  const payload: Record<string, unknown> = {};
  for (const campo of CAMPOS_EDITAVEIS_DEAL) {
    if (data[campo] !== undefined) payload[campo] = data[campo];
  }
  if (Object.keys(payload).length === 0) return { success: true };

  // T21: ação escrita à mão (texto ou data diferente do atual) ganha a marca
  // manual — a ação padrão da coluna nunca a sobrescreve ao mover o deal.
  // Re-salvar o mesmo texto (ex.: salvar só as notas) NÃO marca.
  if (payload.next_action !== undefined || payload.data_proxima_acao !== undefined) {
    const { data: atual, error: lerErr } = await supabase
      .from("deals")
      .select("next_action, data_proxima_acao")
      .eq("id", dealId)
      .maybeSingle();
    if (lerErr) return { success: false, error: lerErr.message };
    const textoAtual = ((atual?.next_action as string | null) ?? "").trim();
    const dataAtual = (atual?.data_proxima_acao as string | null) ?? "";
    const mudouTexto =
      typeof payload.next_action === "string" && payload.next_action.trim() !== textoAtual;
    const mudouData =
      typeof payload.data_proxima_acao === "string" && payload.data_proxima_acao !== dataAtual;
    if (mudouTexto || mudouData) payload.next_action_manual_em = new Date().toISOString();
  }

  const { error } = await supabase
    .from("deals")
    .update(payload)
    .eq("id", dealId);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true };
}
