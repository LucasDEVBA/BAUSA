// ─────────────────────────────────────────────────────────────────────────────
// Fases da jornada da FAMÍLIA configuráveis pelo CEO.
//
// As fases canônicas (enum PG `fase_experiencia`) NUNCA mudam — o CEO edita
// apenas rótulo, descrição, ordem de exibição e dias de alerta de inatividade
// via a chave `fases_familia_config` de configuracoes_sistema (+ a chave seed
// `inatividade_por_fase` para os dias de alerta, lida também pela função SQL
// familias_em_alerta_inatividade()).
//
// Módulo puro (sem "use server"/"server-only") — importável de server
// components, client components e do PipelinesTab. Fail-open: qualquer valor
// inválido é ignorado silenciosamente e o default estático prevalece.
// ─────────────────────────────────────────────────────────────────────────────

import {
  FAMILY_JOURNEY_STAGES,
  JOURNEY_STAGE_CONFIG,
  type FamilyJourneyStage,
  type FamilyJourneyStageConfig,
} from "@/types/family";

export interface FaseFamiliaOverride {
  label?: string;
  description?: string;
  order?: number;
  alertDays?: number;
}

export type FasesFamiliaConfig = Partial<
  Record<FamilyJourneyStage, FaseFamiliaOverride>
>;

export type JourneyConfigMap = Record<
  FamilyJourneyStage,
  FamilyJourneyStageConfig
>;

export const FASE_LABEL_MAX = 60;
export const FASE_DESCRIPTION_MAX = 200;
export const ALERT_DAYS_MIN = 1;
export const ALERT_DAYS_MAX = 365;

/** Fases que nunca geram alerta de inatividade (espelha a função SQL). */
export const FASES_SEM_ALERTA: ReadonlyArray<FamilyJourneyStage> = [
  "aprovado",
  "encerrado",
];

export function isFamilyJourneyStage(
  value: string,
): value is FamilyJourneyStage {
  return (FAMILY_JOURNEY_STAGES as readonly string[]).includes(value);
}

function isValidLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= FASE_LABEL_MAX
  );
}

function isValidDescription(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= FASE_DESCRIPTION_MAX
  );
}

function isValidOrder(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function isValidAlertDays(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= ALERT_DAYS_MIN &&
    value <= ALERT_DAYS_MAX
  );
}

/**
 * Sanitiza o JSONB arbitrário de `fases_familia_config` (fail-open):
 * só chaves de fase conhecidas e só campos com valor válido sobrevivem.
 */
export function parseFasesFamiliaConfig(raw: unknown): FasesFamiliaConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

  const out: FasesFamiliaConfig = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!isFamilyJourneyStage(key)) continue;
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      continue;
    }
    const entry = value as Record<string, unknown>;
    const override: FaseFamiliaOverride = {};
    if (isValidLabel(entry.label)) override.label = entry.label.trim();
    if (isValidDescription(entry.description)) {
      override.description = entry.description.trim();
    }
    if (isValidOrder(entry.order)) override.order = entry.order;
    if (isValidAlertDays(entry.alertDays)) override.alertDays = entry.alertDays;
    if (Object.keys(override).length > 0) out[key] = override;
  }
  return out;
}

/**
 * Combina os dias de `inatividade_por_fase` ({fase: dias}) nos overrides.
 * `alertDays` explícito em `fases_familia_config` vence; a chave de
 * inatividade só preenche o que faltar. Valores inválidos são ignorados.
 */
export function combineAlertDaysFromInatividade(
  overrides: FasesFamiliaConfig,
  inatividadeRaw: unknown,
): FasesFamiliaConfig {
  if (
    typeof inatividadeRaw !== "object" ||
    inatividadeRaw === null ||
    Array.isArray(inatividadeRaw)
  ) {
    return overrides;
  }

  const out: FasesFamiliaConfig = { ...overrides };
  for (const [key, value] of Object.entries(
    inatividadeRaw as Record<string, unknown>,
  )) {
    if (!isFamilyJourneyStage(key)) continue;
    const dias = typeof value === "number" ? value : Number(value);
    if (!isValidAlertDays(dias)) continue;
    if (out[key]?.alertDays !== undefined) continue;
    out[key] = { ...out[key], alertDays: dias };
  }
  return out;
}

/**
 * Retorna o mapa completo de configuração das fases: parte do estático
 * JOURNEY_STAGE_CONFIG e aplica overrides VALIDADOS (fail-open — valor
 * inválido é ignorado em silêncio, nunca quebra a página).
 */
export function mergeJourneyConfig(
  overrides: FasesFamiliaConfig | null | undefined,
): JourneyConfigMap {
  const merged = {} as JourneyConfigMap;
  for (const stage of FAMILY_JOURNEY_STAGES) {
    const base = JOURNEY_STAGE_CONFIG[stage];
    const override = overrides?.[stage];
    merged[stage] = {
      ...base,
      ...(override && isValidLabel(override.label)
        ? { label: override.label.trim() }
        : {}),
      ...(override && isValidDescription(override.description)
        ? { description: override.description.trim() }
        : {}),
      ...(override && isValidOrder(override.order)
        ? { order: override.order }
        : {}),
      ...(override && isValidAlertDays(override.alertDays)
        ? { alertDays: override.alertDays }
        : {}),
    };
  }
  return merged;
}

/**
 * Fases na ordem de exibição configurada (empate resolvido pela ordem
 * estática, mantendo o sort estável e previsível).
 */
export function orderedStages(config: JourneyConfigMap): FamilyJourneyStage[] {
  return [...FAMILY_JOURNEY_STAGES].sort((a, b) => {
    const diff = config[a].order - config[b].order;
    if (diff !== 0) return diff;
    return JOURNEY_STAGE_CONFIG[a].order - JOURNEY_STAGE_CONFIG[b].order;
  });
}

/**
 * Normaliza a fase vinda do banco para o union FamilyJourneyStage.
 * Mantém o alias legado `embarcado` → `embarcado_inicial`; valor
 * desconhecido cai em `admissao` (comportamento histórico das páginas).
 */
export function normalizarFase(fase: string): FamilyJourneyStage {
  if (isFamilyJourneyStage(fase)) return fase;
  if (fase === "embarcado") return "embarcado_inicial";
  return "admissao";
}
