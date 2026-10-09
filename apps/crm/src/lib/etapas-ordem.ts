// ─────────────────────────────────────────────────────────────────────────────
// Regras de avanço/retrocesso de etapa (T2, 2026-10) — derivadas do núcleo
// compararOrdemBoard (@/lib/etapas-deal), espelho de
// public.etapa_e_retrocesso (migration *_plano_escolhido_ordem_board_retrocesso): o trigger
// trg_deals_check_etapa usa o SQL; moverDeal, editor lateral, gamificação e
// os efeitos do sinal usam este módulo. Divergir = o trigger marca
// retrocesso sem motivo. Paridade verificada em 625 pares × 4 configs; guard:
// tests/etapas-plano-escolhido-invariants.test.js.
//
// Todas recebem a config MESCLADA (mergeDealStageConfig) — a mesma que o
// board usa para desenhar as colunas.
//
// Módulo puro (sem "use server") — importável no client e no server.
// ─────────────────────────────────────────────────────────────────────────────

import { DEAL_STAGE_CONFIG, PIPELINE_STAGE_ORDER, type DealStage } from "@/types/deal";
import {
  compararOrdemBoard,
  isDealStage,
  orderedKanbanStages,
  type DealStageConfigMap,
} from "@/lib/etapas-deal";

/** Destinos que nunca são retrocesso (perda/estacionamento) — iguais ao SQL. */
export const ETAPAS_DESTINO_SEM_RETROCESSO: readonly string[] = [
  "perdido",
  "cancelamento_solicitado",
  "projeto_futuro",
  "aguardando_timing",
];

/** Destinos que nunca rendem XP, mesmo "à frente" no board. */
export const ETAPAS_SEM_XP: readonly string[] = ETAPAS_DESTINO_SEM_RETROCESSO;

/** Coluna personalizada (custom_1..6): raia livre do CEO, isenta de retrocesso. */
export function isColunaPersonalizada(etapa: string): boolean {
  return etapa.startsWith("custom_");
}

export type DirecaoEtapa = -1 | 0 | 1;

/** -1 volta · 0 mesma posição · 1 avança (de → para), numa escala só. */
export function direcaoEtapa(
  de: string,
  para: string,
  config: DealStageConfigMap | null | undefined,
): DirecaoEtapa {
  return compararOrdemBoard(para, de, config);
}

/** Retrocesso que exige motivo. Espelho de public.etapa_e_retrocesso. */
export function isRetrocessoEtapa(
  de: string,
  para: string,
  config: DealStageConfigMap | null | undefined,
): boolean {
  if (!de || !para || de === para) return false;
  if (ETAPAS_DESTINO_SEM_RETROCESSO.includes(para)) return false;
  if (de === "aguardando_timing") return false;
  if (isColunaPersonalizada(para) || isColunaPersonalizada(de)) return false;
  return direcaoEtapa(de, para, config) < 0;
}

/** Avanço que rende XP: à frente na mesma escala, destino que não é perda/estacionamento. */
export function isAvancoReal(
  de: string,
  para: string,
  config: DealStageConfigMap | null | undefined,
): boolean {
  if (ETAPAS_SEM_XP.includes(para)) return false;
  return direcaoEtapa(de, para, config) > 0;
}

/** Etapas das quais registrar/confirmar o sinal NUNCA move o card. */
const NUNCA_MOVER_PARA_SINAL: readonly string[] = [
  "sinal_pago",
  "perdido",
  "cancelamento_solicitado",
  "projeto_futuro",
  "aguardando_timing",
  "concluido",
];

/**
 * Registrar/confirmar o sinal só MOVE o deal se ele está ANTES de "Sinal pago"
 * na mesma escala — nunca puxa Plano escolhido / coluna personalizada /
 * admissão para trás (com o trigger pela ordem do board isso viraria
 * retrocesso sem motivo). Fonte única para financeiro (T5/T11).
 */
export function deveMoverParaSinalPago(
  etapaAtual: string,
  config: DealStageConfigMap | null | undefined,
): boolean {
  if (!etapaAtual || NUNCA_MOVER_PARA_SINAL.includes(etapaAtual) || isColunaPersonalizada(etapaAtual)) {
    return false;
  }
  return compararOrdemBoard(etapaAtual, "sinal_pago", config) < 0;
}

/**
 * Ganho recém-fechado → shortlist de escolas (GanhoEscolasModal). "Sinal pago"
 * abre como sempre; "Plano escolhido" só quando o deal pulou o sinal (veio de
 * etapa que não era ganho).
 */
export function deveAbrirShortlist(
  de: string,
  para: string,
  config: DealStageConfigMap,
): boolean {
  if (para === "sinal_pago") return true;
  if (para !== "plano_escolhido") return false;
  return !(isDealStage(de) && config[de].ganho);
}

/**
 * Etapa nova que ainda nasce oculta (plano_escolhido até a migration de dados
 * 124400) nunca é oferecida como destino pelo caminho de fallback: gravar um
 * deal nela antes do vai-pra-prod derruba o board/tabela do Engine antigo
 * (banco único — o UAT grava em produção).
 */
function ocultaPorPadraoAinda(s: DealStage, config: DealStageConfigMap): boolean {
  return DEAL_STAGE_CONFIG[s].ocultaPorPadrao === true && config[s].oculta;
}

/** Colunas VISÍVEIS do board, na ordem do CEO, sem Perdido. */
function colunasVisiveis(config: DealStageConfigMap): DealStage[] {
  return orderedKanbanStages(config).filter((s) => !config[s].oculta && s !== "perdido");
}

/**
 * "Avançar" do editor lateral: próxima coluna visível do board. Etapa atual
 * oculta (ex.: admission_process) → ordem estática (comportamento antigo).
 */
export function proximaColunaBoard(atual: DealStage, config: DealStageConfigMap): DealStage | null {
  const visiveis = colunasVisiveis(config);
  const idx = visiveis.indexOf(atual);
  if (idx === -1) {
    const i = PIPELINE_STAGE_ORDER.indexOf(atual);
    const proxima =
      i >= 0
        ? (PIPELINE_STAGE_ORDER.slice(i + 1).find((s) => !ocultaPorPadraoAinda(s, config)) ?? null)
        : null;
    return proxima === "perdido" ? null : proxima;
  }
  return visiveis[idx + 1] ?? null;
}

/** "Retroceder" do editor lateral: colunas visíveis antes da atual. */
export function colunasAnterioresBoard(atual: DealStage, config: DealStageConfigMap): DealStage[] {
  const visiveis = colunasVisiveis(config);
  const idx = visiveis.indexOf(atual);
  if (idx === -1) {
    const i = PIPELINE_STAGE_ORDER.indexOf(atual);
    return PIPELINE_STAGE_ORDER.slice(0, Math.max(0, i)).filter(
      (s) => s !== "perdido" && !ocultaPorPadraoAinda(s, config),
    );
  }
  return visiveis.slice(0, idx);
}
