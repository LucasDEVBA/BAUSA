// ─────────────────────────────────────────────────────────────────────────────
// Etapas do pipeline COMERCIAL com apresentação configurável pelo CEO.
//
// As etapas canônicas (enum PG `status_deal`) NUNCA mudam — o CEO edita
// apenas rótulo, acento de cor, ordem de exibição e ocultar coluna do Kanban
// via a chave `etapas_deal_config` de configuracoes_sistema. A chave seed
// `probabilidade_por_etapa` (20260401000300) alimenta a probabilidade de
// fechamento aplicada por moverDeal/promoverLead.
//
// Este módulo é a FONTE CANÔNICA DE EXIBIÇÃO das etapas de deal (rótulo,
// cor, ordem configurada). Cópias paralelas legadas (ETAPA_LABELS em
// types/crm.ts, ORDEM_ETAPA em conversas-queries.ts) seguem com os defaults
// estáticos nesta fase — ver comentários nelas.
//
// Módulo puro (sem "use server"/"server-only") — importável de server
// components, client components e do PipelinesTab. Fail-open: qualquer valor
// inválido é ignorado silenciosamente e o default estático prevalece.
// ─────────────────────────────────────────────────────────────────────────────

import {
  DEAL_STAGE_CONFIG,
  PIPELINE_STAGE_ORDER,
  type DealStage,
  type DealStageConfig,
} from "@/types/deal";

export type EtapaDealAccent =
  | "blue"
  | "green"
  | "orange"
  | "red"
  | "purple"
  | "neutral";

export interface EtapaDealOverride {
  label?: string;
  accent?: EtapaDealAccent;
  order?: number;
  oculta?: boolean;
}

export type EtapasDealConfig = Partial<Record<DealStage, EtapaDealOverride>>;

/** Config de exibição por etapa: estático + overrides validados. */
export interface DealStageDisplayConfig extends DealStageConfig {
  /** Coluna oculta do Kanban. Só some do board se estiver VAZIA — deals nunca são escondidos. */
  oculta: boolean;
}

export type DealStageConfigMap = Record<DealStage, DealStageDisplayConfig>;

export const ETAPA_DEAL_LABEL_MAX = 60;

/** Todas as etapas canônicas (chaves do enum status_deal espelhadas no TS). */
export const DEAL_STAGES = Object.keys(DEAL_STAGE_CONFIG) as DealStage[];

/**
 * Acento → token de cor do design system. Derivado das classes que
 * DEAL_STAGE_CONFIG já usa (`dotColor`) — NUNCA hex solto.
 */
export const ETAPA_ACCENT_DOT: Record<EtapaDealAccent, string> = {
  blue: "bg-sys-blue",
  green: "bg-sys-green",
  orange: "bg-sys-orange",
  red: "bg-sys-red",
  purple: "bg-sys-purple",
  neutral: "bg-muted-foreground",
};

export const ETAPA_ACCENTS = Object.keys(
  ETAPA_ACCENT_DOT,
) as EtapaDealAccent[];

export const ETAPA_ACCENT_LABEL: Record<EtapaDealAccent, string> = {
  blue: "Azul",
  green: "Verde",
  orange: "Laranja",
  red: "Vermelho",
  purple: "Roxo",
  neutral: "Neutro",
};

/**
 * Fallback hardcoded da probabilidade de fechamento por etapa (histórico de
 * lib/actions/deals.ts). A chave `probabilidade_por_etapa` de
 * configuracoes_sistema VENCE quando presente e válida; este mapa só cobre
 * ausência/valor inválido. Etapas terminais (concluido/perdido/...) vêm do
 * seed do banco (20260401000300) — sem entrada aqui, o comportamento
 * histórico (não tocar a probabilidade) é preservado quando o seed faltar.
 */
export const PROBABILIDADE_ETAPA_FALLBACK: Record<string, number> = {
  contato_feito: 5,
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

export function isDealStage(value: string): value is DealStage {
  return Object.prototype.hasOwnProperty.call(DEAL_STAGE_CONFIG, value);
}

export function isEtapaDealAccent(value: unknown): value is EtapaDealAccent {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(ETAPA_ACCENT_DOT, value)
  );
}

function isValidLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= ETAPA_DEAL_LABEL_MAX
  );
}

function isValidOrder(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidProbabilidade(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  );
}

/**
 * Sanitiza o JSONB arbitrário de `etapas_deal_config` (fail-open):
 * só chaves de etapa conhecidas e só campos com valor válido sobrevivem.
 */
export function parseEtapasDealConfig(raw: unknown): EtapasDealConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

  const out: EtapasDealConfig = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDealStage(key)) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    const entry = value as Record<string, unknown>;
    const override: EtapaDealOverride = {};
    if (isValidLabel(entry.label)) override.label = entry.label.trim();
    if (isEtapaDealAccent(entry.accent)) override.accent = entry.accent;
    if (isValidOrder(entry.order)) override.order = entry.order;
    if (typeof entry.oculta === "boolean") override.oculta = entry.oculta;
    if (Object.keys(override).length > 0) out[key] = override;
  }
  return out;
}

/**
 * Retorna o mapa completo de configuração de exibição das etapas: parte do
 * estático DEAL_STAGE_CONFIG e aplica overrides VALIDADOS (fail-open — valor
 * inválido é ignorado em silêncio, nunca quebra a página). Rótulo custom
 * substitui label E shortLabel (o nome do CEO é o nome de exibição). Flags de
 * negócio (isFinancial/isLost/isWaitingTiming) NUNCA são sobrescritas.
 */
export function mergeDealStageConfig(
  overrides: EtapasDealConfig | null | undefined,
): DealStageConfigMap {
  const merged = {} as DealStageConfigMap;
  for (const stage of DEAL_STAGES) {
    const base = DEAL_STAGE_CONFIG[stage];
    const override = overrides?.[stage];
    merged[stage] = {
      ...base,
      oculta: override?.oculta === true,
      ...(override && isValidLabel(override.label)
        ? { label: override.label.trim(), shortLabel: override.label.trim() }
        : {}),
      ...(override && isEtapaDealAccent(override.accent)
        ? { dotColor: ETAPA_ACCENT_DOT[override.accent] }
        : {}),
      ...(override && isValidOrder(override.order)
        ? { order: override.order }
        : {}),
    };
  }
  return merged;
}

/** Default estático já mesclado — usar como valor default de props. */
export const DEFAULT_DEAL_STAGE_DISPLAY: DealStageConfigMap =
  mergeDealStageConfig({});

/**
 * TODAS as etapas na ordem de exibição configurada (empate resolvido pela
 * ordem estática, mantendo o sort estável e previsível).
 */
export function orderedDealStages(config: DealStageConfigMap): DealStage[] {
  return [...DEAL_STAGES].sort((a, b) => {
    const diff = config[a].order - config[b].order;
    if (diff !== 0) return diff;
    return DEAL_STAGE_CONFIG[a].order - DEAL_STAGE_CONFIG[b].order;
  });
}

/**
 * Etapas do KANBAN (subset PIPELINE_STAGE_ORDER) na ordem configurada.
 * Não inclui/exclui etapas — o conjunto do board é fixo; só a ordem muda.
 */
export function orderedKanbanStages(config: DealStageConfigMap): DealStage[] {
  return [...PIPELINE_STAGE_ORDER].sort((a, b) => {
    const diff = config[a].order - config[b].order;
    if (diff !== 0) return diff;
    return PIPELINE_STAGE_ORDER.indexOf(a) - PIPELINE_STAGE_ORDER.indexOf(b);
  });
}

/**
 * Combina a chave `probabilidade_por_etapa` (JSONB {etapa: 0-100}) com o
 * fallback hardcoded. Entradas inválidas (etapa desconhecida, valor fora de
 * 0-100) são ignoradas — fail-open, o fallback prevalece.
 */
export function mergeProbabilidadePorEtapa(
  raw: unknown,
): Record<string, number> {
  const out: Record<string, number> = { ...PROBABILIDADE_ETAPA_FALLBACK };
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return out;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDealStage(key)) continue;
    if (!isValidProbabilidade(value)) continue;
    out[key] = value;
  }
  return out;
}
