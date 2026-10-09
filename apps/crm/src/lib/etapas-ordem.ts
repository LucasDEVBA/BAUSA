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

import { type DealStage } from "@/types/deal";
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
 * Colunas que o editor lateral oferece, na ORDEM DO BOARD (orderedKanbanStages
 * — o mesmo cálculo que desenha o Kanban): só as VISÍVEIS (sem Perdido, que
 * tem botão próprio) + a etapa atual. A atual entra mesmo oculta porque o
 * board a desenha no lugar configurado enquanto tiver deals — é dali que se
 * avança/retrocede. Coluna oculta NUNCA é destino (slot custom sem nome,
 * etapa aposentada, plano_escolhido antes da migration de dados).
 */
function colunasDoEditor(atual: DealStage, config: DealStageConfigMap): DealStage[] {
  return orderedKanbanStages(config).filter(
    (s) => s === atual || (!config[s].oculta && s !== "perdido"),
  );
}

/**
 * "Avançar" do editor lateral: próxima coluna VISÍVEL do board depois da
 * atual. Etapa fora do Kanban (cancelamento/projeto futuro) → null.
 */
export function proximaColunaBoard(atual: DealStage, config: DealStageConfigMap): DealStage | null {
  const colunas = colunasDoEditor(atual, config);
  const idx = colunas.indexOf(atual);
  if (idx === -1) return null;
  return colunas[idx + 1] ?? null;
}

/** "Retroceder" do editor lateral: colunas VISÍVEIS antes da atual, na ordem do board. */
export function colunasAnterioresBoard(atual: DealStage, config: DealStageConfigMap): DealStage[] {
  const colunas = colunasDoEditor(atual, config);
  const idx = colunas.indexOf(atual);
  if (idx === -1) return [];
  return colunas.slice(0, idx);
}
