/**
 * Config do Classificador de Leads v2 — chave `qualificacao_v2` em
 * configuracoes_sistema (migration 20260825120000).
 *
 * FONTE DA VERDADE em runtime: CFG_V2_DEFAULTS em
 * functions/qualify-lead/index.js (a CF usa os dela como fallback campo a
 * campo). Os defaults abaixo servem só de pré-preenchimento na UI quando a
 * config vier incompleta — o guard tests/qualificacao-v2-invariants.test.js
 * trava o comportamento da CF.
 */

export interface QualificacaoV2Cfg {
  /** Cotação USD→BRL de referência (atualizar semanalmente). */
  cotacao_usd?: number;
  /** Renda familiar líquida de referência (R$/mês). */
  renda_minima_mensal?: number;
  /** Corte de renda média IBGE do setor censitário (R$) — opcional. */
  corte_ibge?: number | null;
  /** Score mínimo para QUENTE (score ≥ corte). */
  corte_quente?: number;
  /** Score abaixo do qual é FRIO (score < corte). */
  corte_frio?: number;
  /** Override COMPLETO do system prompt (uso avançado). Vazio = prompt
   *  v1.0 versionado no código da CF. */
  system_prompt?: string;
}

export const QUALIFICACAO_V2_DEFAULTS: Required<QualificacaoV2Cfg> = {
  cotacao_usd: 5.4,
  renda_minima_mensal: 50000,
  corte_ibge: null,
  corte_quente: 70,
  corte_frio: 40,
  system_prompt: "",
};

/** Placeholders substituídos pela CF na montagem do prompt (inclusive no
 *  override) — vêm dos campos numéricos da config. */
export const QUALIFICACAO_V2_PLACEHOLDERS = [
  "{{COTACAO_USD}}",
  "{{RENDA_MINIMA_MENSAL}}",
  "{{CORTE_IBGE}}",
  "{{CORTE_QUENTE}}",
  "{{CORTE_FRIO}}",
  "{{CORTE_QUENTE_MENOS_1}}",
] as const;

/** Teto folgado do override do system prompt (o prompt v1.0 do código tem
 *  ~12k caracteres). */
export const QUALIFICACAO_V2_PROMPT_MAX = 30000;
