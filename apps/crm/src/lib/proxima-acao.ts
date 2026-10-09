// ─────────────────────────────────────────────────────────────────────────────
// Próxima ação do deal (T21, 2026-10) — de QUAL etapa ela é e SE foi escrita à
// mão. Fonte dos metadados: deals.next_action_etapa / next_action_manual_em,
// mantidos pelo trigger trg_deals_next_action_meta (migration *_deals_next_action_meta)
// para TODOS os escritores (Engine e CFs).
//
// Deals anteriores à migration ("legado") e escritas do Engine sem autoria
// declarada (next_action_etapa NULL) são classificados pelo TEXTO: só os
// textos que CFs/Engine gravam sozinhos contam como ação de sistema; qualquer
// outro texto é tratado como MANUAL (conservador — nunca sobrescrever o que o
// CEO pode ter escrito). Sem backfill.
//
// Quem APLICA a ação padrão da coluna é o trigger (todos os escritores); este
// módulo só decide a EXIBIÇÃO (cartão/tabela). ⚠️ ACOES_SISTEMA_LEGADAS e
// isAcaoManual são espelho EXATO de public.next_action_e_de_sistema — o guard
// tests/etapas-plano-escolhido-invariants.test.js compara as duas listas.
//
// Módulo puro — client (DealCard/PipelineTableView/VisaoExecutivaPanel) e
// server (contador "Ações atrasadas" do /pipeline).
// ─────────────────────────────────────────────────────────────────────────────

import type { DealStage } from "@/types/deal";

/** Textos gravados por sistema (CFs/Engine/migrations) → etapa de origem. */
const ACOES_SISTEMA_LEGADAS: ReadonlyArray<{ re: RegExp; etapa: DealStage | null }> = [
  { re: /^preparar para reuni[aã]o$/i, etapa: "reuniao_marcada" },             // calendar-webhook, process-followup
  { re: /^reuni[aã]o detectada antes da aprova[cç][aã]o/i, etapa: "reuniao_marcada" }, // aprovarLead
  { re: /^reuni[aã]o no hist[oó]rico do deal/i, etapa: "reuniao_marcada" },     // aprovarLead
  { re: /^aguardar agendamento$/i, etapa: "lead" },                              // 20260401002000
  { re: /^aguardar contato programado em novembro\/\d{4}$/i, etapa: "aguardando_timing" }, // qualify-lead
  { re: /^aguardar novembro\/\d{4}$/i, etapa: "aguardando_timing" },
  { re: /^retomar contato em novembro \(lead muito cedo\)$/i, etapa: "aguardando_timing" },
  { re: /^lead re-aprovado pelo ceo/i, etapa: "lead" },
  { re: /^deal reaberto na re-aprova[cç][aã]o/i, etapa: null },
  { re: /^confirmar realiza[cç][aã]o e definir pr[oó]ximos passos$/i, etapa: "reuniao_realizada" },
];

export interface MetaProximaAcao {
  next_action?: string | null;
  next_action_etapa?: string | null;
  /** true = deals.next_action_manual_em preenchido. */
  next_action_manual?: boolean | null;
}

function acaoSistemaLegada(texto: string | null | undefined) {
  const t = (texto ?? "").trim();
  if (!t) return null;
  return ACOES_SISTEMA_LEGADAS.find((a) => a.re.test(t)) ?? null;
}

/** A ação atual foi escrita à mão pelo CEO? (legado: texto desconhecido = sim) */
export function isAcaoManual(meta: MetaProximaAcao): boolean {
  if (!meta.next_action?.trim()) return false;
  if (meta.next_action_manual) return true;
  if (meta.next_action_etapa) return false;
  return acaoSistemaLegada(meta.next_action) === null;
}

/** Etapa a que a ação pertence (null = desconhecida). */
export function etapaDaAcao(meta: MetaProximaAcao): string | null {
  if (!meta.next_action?.trim()) return null;
  if (meta.next_action_etapa) return meta.next_action_etapa;
  return acaoSistemaLegada(meta.next_action)?.etapa ?? null;
}

/**
 * Ação herdada de OUTRA etapa e não escrita à mão — o card não a pinta como
 * vencida (vermelho), só como "de etapa anterior". Ex.: "Preparar para
 * reunião" num deal em Sinal pago.
 */
export function isAcaoDeOutraEtapa(meta: MetaProximaAcao, etapaAtual: string): boolean {
  if (isAcaoManual(meta)) return false;
  const origem = etapaDaAcao(meta);
  return origem !== null && origem !== etapaAtual;
}

export interface PrazoProximaAcao extends MetaProximaAcao {
  /** deals.data_proxima_acao (YYYY-MM-DD). */
  next_action_date?: string | null;
}

/**
 * Ação ATRASADA de verdade: da etapa ATUAL (ou manual) com prazo antes de
 * `hoje` (YYYY-MM-DD). A herdada de outra etapa nunca conta (T21) — mesma
 * regra do card, da tabela, da Visão Executiva e do contador "Ações
 * atrasadas" do /pipeline.
 */
export function isAcaoAtrasadaDaEtapa(
  deal: PrazoProximaAcao,
  etapaAtual: string,
  hoje: string,
): boolean {
  const prazo = deal.next_action_date?.slice(0, 10);
  if (!prazo || prazo >= hoje) return false;
  return !isAcaoDeOutraEtapa(deal, etapaAtual);
}

/** Data de hoje (UTC, YYYY-MM-DD) — a mesma referência do card do board. */
export function hojeIsoUtc(agora: Date = new Date()): string {
  return agora.toISOString().slice(0, 10);
}
