/**
 * Classificador de Leads v2 — helpers de EXIBIÇÃO dos campos gravados pela
 * CF qualify-lead em form_submissions (migration 20260825120000).
 *
 * Todos os campos podem ser NULL (leads pré-v2) — toda exibição degrada
 * graciosamente. Nada aqui participa de elegibilidade/outreach.
 */

/** Subconjunto v2 de form_submissions exibido nos detalhes de lead/deal. */
export interface ClassificadorV2Dados {
  score_financeiro?: number | null;
  tier_profissao?: string | null;
  sinais_reforco?: string[] | null;
  sinais_alerta?: string[] | null;
  prioridade_estrategica?: string | null;
  acao_recomendada?: string | null;
}

/** jsonb → string[] defensivo (a coluna é livre no banco). */
export function parseSinaisV2(valor: unknown): string[] | null {
  if (!Array.isArray(valor)) return null;
  const sinais = valor.filter((s): s is string => typeof s === "string" && s.trim() !== "");
  return sinais.length > 0 ? sinais : null;
}

/** Algum campo v2 presente? (lead pré-v2 = seção inteira omitida). */
export function temDadosClassificadorV2(dados: ClassificadorV2Dados): boolean {
  return (
    dados.score_financeiro != null ||
    Boolean(dados.tier_profissao) ||
    Boolean(dados.acao_recomendada) ||
    (dados.sinais_reforco?.length ?? 0) > 0 ||
    (dados.sinais_alerta?.length ?? 0) > 0 ||
    dados.prioridade_estrategica === "ALTA" ||
    dados.prioridade_estrategica === "MEDIA"
  );
}

export const TIER_PROFISSAO_LABEL: Record<string, string> = {
  A: "Tier A — sustenta com folga",
  B: "Tier B — plausível com ressalvas",
  C: "Tier C — dificilmente sustenta",
  INDEFINIDO: "Tier indefinido",
};
