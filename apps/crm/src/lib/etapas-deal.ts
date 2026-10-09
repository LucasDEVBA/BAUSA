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

import { ETAPA_ORDEM } from "@/types/crm";
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

// ─── Regras de COMPORTAMENTO por coluna (chave etapas_deal_regras) ────────
// Separadas da apresentação de propósito: o código antigo reescreve
// etapas_deal_config inteira a partir do que conhece (parse descarta campos
// e chaves desconhecidos) — regra de negócio lá dentro seria apagada no
// primeiro "salvar coluna" durante o rollout. Seed: migration *_plano_escolhido_ordem_board_retrocesso.
export interface EtapaDealAcaoPadrao {
  /** Texto da próxima ação aplicada ao ENTRAR na coluna (3-120). */
  texto: string;
  /** Prazo em dias corridos a partir de hoje (BRT), 0-60. */
  dias: number;
}

export interface EtapaDealRegra {
  /** Coluna personalizada conta como negócio GANHO (só custom_*). */
  ganho?: boolean;
  /** Soltar card sem plano abre a escolha de plano (T10). */
  pede_plano?: boolean;
  /** Próxima ação padrão ao entrar (T21). */
  acao_padrao?: EtapaDealAcaoPadrao;
}

export type EtapasDealRegras = Partial<Record<DealStage, EtapaDealRegra>>;

export const ACAO_PADRAO_TEXTO_MIN = 3;
export const ACAO_PADRAO_TEXTO_MAX = 120;
export const ACAO_PADRAO_DIAS_MAX = 60;
export const ACAO_PADRAO_DIAS_DEFAULT = 2;

/** Config de exibição por etapa: estático + overrides validados + regras. */
export interface DealStageDisplayConfig extends DealStageConfig {
  /** Coluna oculta do Kanban. Só some do board se estiver VAZIA — deals nunca são escondidos. */
  oculta: boolean;
  /** Conta como negócio GANHO: etapas fixas (ETAPAS_GANHO_FIXAS) ou coluna
   *  personalizada marcada pelo CEO. Fonte única de "ganho" no Engine. */
  ganho: boolean;
  /** Soltar card sem plano nesta coluna abre a escolha de plano (T10). */
  pedePlano: boolean;
  /** Próxima ação aplicada ao entrar na coluna (T21); null = não troca. */
  acaoPadrao: EtapaDealAcaoPadrao | null;
  /** `order` veio da config do CEO (não do default/âncora) — só assim a
   *  etapa participa da ORDEM DO BOARD na regra de retrocesso. */
  ordemConfigurada: boolean;
}

export type DealStageConfigMap = Record<DealStage, DealStageDisplayConfig>;

export const ETAPA_DEAL_LABEL_MAX = 60;

/** Todas as etapas canônicas (chaves do enum status_deal espelhadas no TS). */
export const DEAL_STAGES = Object.keys(DEAL_STAGE_CONFIG) as DealStage[];

/**
 * Etapas FIXAS de GANHO (contrato assinado em diante). Flag de negócio — nunca
 * configurável. Colunas personalizadas entram via regra `ganho` (etapasGanho).
 * Consumidores: métricas do pipeline, War Room, remarketing, desfecho_real,
 * relatórios, elegíveis de família. Chatbot/automation-engine (CFs) têm cópias
 * guardadas por tests/etapas-plano-escolhido-invariants.test.js.
 */
export const ETAPAS_GANHO_FIXAS: readonly DealStage[] = [
  "contrato_assinado",
  "sinal_pago",
  "plano_escolhido",
  "admission_process",
  "concluido",
];

/** Ganho já com sinal (balde "Sinais pagos" do War Room) entre as fixas. */
export const ETAPAS_GANHO_POS_SINAL_FIXAS: readonly DealStage[] = [
  "sinal_pago",
  "plano_escolhido",
];

/** Pós-proposta ainda NÃO ganhas (forecast/funil). */
export const ETAPAS_POS_PROPOSTA: readonly DealStage[] = [
  "proposta_enviada",
  "followup_proposta",
  "negociacao",
  "contrato_enviado",
];

/** Slots de coluna personalizada (custom_1..custom_6). */
export const SLOTS_CUSTOM: readonly DealStage[] = DEAL_STAGES.filter(
  (s) => DEAL_STAGE_CONFIG[s].isCustomSlot === true,
);

/**
 * Etapa nova sem ordem configurada aparece logo DEPOIS da sua âncora — na
 * escala que a âncora estiver usando (config do CEO ou estática). Evita que
 * plano_escolhido caia no meio das colunas personalizadas se a sua entrada
 * em etapas_deal_config sumir.
 */
const ORDEM_ANCORADA: Partial<Record<DealStage, DealStage>> = {
  plano_escolhido: "sinal_pago",
};

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
  plano_escolhido: 97,
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

/** Sanitiza o texto/prazo de uma ação padrão (null = inválida/ausente). */
function parseAcaoPadrao(raw: unknown): EtapaDealAcaoPadrao | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const entry = raw as Record<string, unknown>;
  const texto = typeof entry.texto === "string" ? entry.texto.trim() : "";
  if (texto.length < ACAO_PADRAO_TEXTO_MIN || texto.length > ACAO_PADRAO_TEXTO_MAX) {
    return null;
  }
  const dias =
    typeof entry.dias === "number" && Number.isFinite(entry.dias)
      ? Math.min(ACAO_PADRAO_DIAS_MAX, Math.max(0, Math.round(entry.dias)))
      : ACAO_PADRAO_DIAS_DEFAULT;
  return { texto, dias };
}

/**
 * Sanitiza o JSONB de `etapas_deal_regras` (fail-open): só etapas conhecidas,
 * só campos válidos. `ganho` só vale para slots custom (etapas fixas têm a
 * semântica no código).
 */
export function parseEtapasDealRegras(raw: unknown): EtapasDealRegras {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

  const out: EtapasDealRegras = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isDealStage(key)) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    const entry = value as Record<string, unknown>;
    const regra: EtapaDealRegra = {};
    if (typeof entry.ganho === "boolean" && DEAL_STAGE_CONFIG[key].isCustomSlot === true) {
      regra.ganho = entry.ganho;
    }
    if (typeof entry.pede_plano === "boolean") regra.pede_plano = entry.pede_plano;
    const acao = parseAcaoPadrao(entry.acao_padrao);
    if (acao) regra.acao_padrao = acao;
    if (Object.keys(regra).length > 0) out[key] = regra;
  }
  return out;
}

/**
 * Slot custom LIVRE para "Nova coluna": nunca nomeado e não tornado visível.
 * (Ter só `order` não ocupa o slot — reordenar o board grava ordem em TODAS
 * as etapas do Kanban, inclusive slots vazios.)
 */
export function slotCustomLivre(override: EtapaDealOverride | undefined): boolean {
  return !override || (override.label === undefined && override.oculta !== false);
}

/**
 * Retorna o mapa completo de configuração de exibição das etapas: parte do
 * estático DEAL_STAGE_CONFIG e aplica overrides VALIDADOS (fail-open — valor
 * inválido é ignorado em silêncio, nunca quebra a página). Rótulo custom
 * substitui label E shortLabel (o nome do CEO é o nome de exibição). Flags de
 * negócio (isFinancial/isLost/isWaitingTiming) NUNCA são sobrescritas.
 * `regras` (opcional) acrescenta ganho/pedePlano/acaoPadrao por coluna.
 */
export function mergeDealStageConfig(
  overrides: EtapasDealConfig | null | undefined,
  regras?: EtapasDealRegras | null,
): DealStageConfigMap {
  const merged = {} as DealStageConfigMap;
  for (const stage of DEAL_STAGES) {
    const base = DEAL_STAGE_CONFIG[stage];
    const override = overrides?.[stage];
    const regra = regras?.[stage];
    merged[stage] = {
      ...base,
      // Slot custom (e etapa nova com ocultaPorPadrao) nasce OCULTO até a
      // config torná-lo visível ("Nova coluna" grava oculta:false); demais
      // etapas seguem visíveis por padrão. Espelho: ordem_etapa_board (SQL).
      oculta:
        typeof override?.oculta === "boolean"
          ? override.oculta
          : base.isCustomSlot === true || base.ocultaPorPadrao === true,
      ...(override && isValidLabel(override.label)
        ? { label: override.label.trim(), shortLabel: override.label.trim() }
        : {}),
      ...(override && isEtapaDealAccent(override.accent)
        ? { dotColor: ETAPA_ACCENT_DOT[override.accent] }
        : {}),
      ...(override && isValidOrder(override.order)
        ? { order: override.order }
        : {}),
      ganho:
        ETAPAS_GANHO_FIXAS.includes(stage) ||
        (base.isCustomSlot === true && regra?.ganho === true),
      pedePlano:
        typeof regra?.pede_plano === "boolean"
          ? regra.pede_plano
          : base.pedePlanoPorPadrao === true,
      acaoPadrao: regra?.acao_padrao ?? null,
      ordemConfigurada: Boolean(override && isValidOrder(override.order)),
    };
  }
  for (const [stage, ancora] of Object.entries(ORDEM_ANCORADA) as [DealStage, DealStage][]) {
    if (!isValidOrder(overrides?.[stage]?.order)) {
      merged[stage] = { ...merged[stage], order: merged[ancora].order + 0.5 };
    }
  }
  return merged;
}

/** Etapas que contam como GANHO (fixas + colunas personalizadas marcadas). */
export function etapasGanho(config: DealStageConfigMap): DealStage[] {
  return DEAL_STAGES.filter((s) => config[s].ganho);
}

/**
 * Config de exibição tolerante a etapa DESCONHECIDA (valor de enum mais novo
 * que o código em execução — lição do rollout de plano_escolhido): nunca
 * devolve undefined, então nenhuma tela quebra por `config[etapa].x`.
 */
export function getStageDisplay(
  config: DealStageConfigMap,
  stage: string,
): DealStageDisplayConfig {
  if (isDealStage(stage)) return config[stage];
  return {
    id: stage as DealStage,
    label: stage,
    shortLabel: stage,
    dotColor: "bg-muted-foreground",
    isFinancial: false,
    isLost: false,
    order: Number.MAX_SAFE_INTEGER,
    oculta: false,
    ganho: false,
    pedePlano: false,
    acaoPadrao: null,
    ordemConfigurada: false,
  };
}

// ─── Ordem das etapas — núcleo da REGRA ÚNICA de avanço/retrocesso ───────
// Duas escalas que NUNCA se misturam: ORDEM FIXA (negócio — ETAPA_ORDEM ⇄
// public.ordem_etapa_fixa) e ORDEM DO BOARD (order configurado pelo CEO).
// Se as DUAS etapas estão visíveis com ordem configurada (e distinta), vale o
// board; senão a fixa para AS DUAS. ⚠️ Espelho EXATO de
// public.ordem_etapa_board / public.etapa_e_retrocesso (migration
// *_plano_escolhido_ordem_board_retrocesso) — o trigger usa o SQL, o app usa isto. Regras derivadas
// (retrocesso, XP, sinal, próxima coluna) em @/lib/etapas-ordem.

/** Não são colunas do Kanban → nunca têm ordem de board. */
const ETAPAS_FORA_DO_BOARD: readonly string[] = ["cancelamento_solicitado", "projeto_futuro"];

/** Ordem FIXA de negócio (custom_* e desconhecidas = 0, como no SQL). */
export function ordemEtapaFixa(etapa: string): number {
  return (ETAPA_ORDEM as Record<string, number>)[etapa] ?? 0;
}

/** Ordem no board configurado; null = oculta, sem ordem configurada ou fora do Kanban. */
export function ordemEtapaBoard(
  etapa: string,
  config: DealStageConfigMap | null | undefined,
): number | null {
  if (!config || !isDealStage(etapa) || ETAPAS_FORA_DO_BOARD.includes(etapa)) return null;
  const c = config[etapa];
  return c.ordemConfigurada && !c.oculta ? c.order : null;
}

/**
 * Posição relativa de duas etapas: -1 = `a` vem ANTES de `b`, 0 = mesma
 * posição, 1 = `a` vem DEPOIS — sempre numa escala só (ver acima).
 */
export function compararOrdemBoard(
  a: string,
  b: string,
  config: DealStageConfigMap | null | undefined,
): -1 | 0 | 1 {
  if (a === b) return 0;
  const boardA = ordemEtapaBoard(a, config);
  const boardB = ordemEtapaBoard(b, config);
  if (boardA !== null && boardB !== null && boardA !== boardB) return boardA < boardB ? -1 : 1;
  const fixaA = ordemEtapaFixa(a);
  const fixaB = ordemEtapaFixa(b);
  if (fixaA === fixaB) return 0;
  return fixaA < fixaB ? -1 : 1;
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
