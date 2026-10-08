/**
 * Faixa de investimento — FONTE ÚNICA do Engine (T4, 2026-10-08).
 *
 * Código do formulário (form_submissions.investment_range) → enum
 * atletas.faixa_investimento (CHECK atletas_faixa_investimento_check) →
 * estimativa do deal (deals.valor_estimado na criação).
 *
 * Por que match EXATO: a versão antiga casava substring e testava "40" antes
 * de "30"/"20", então o TETO de cada faixa caía na faixa de cima
 * ('15k-20k' → 20k_30k/R$ 22.000; '30k-40k' → 40k_mais/R$ 32.000) — 317
 * deals inflados em produção até o backfill.
 *
 * A CF qualify-lead tem uma CÓPIA JS deste bloco (deploy isolado, não importa
 * de fora da pasta) e packages/database outra (legado). Paridade de
 * COMPORTAMENTO travada por tests/faixa-investimento-invariants.test.js, que
 * executa os três blocos `@guard-js`.
 */

export const FAIXAS_INVESTIMENTO = ["ate_20k", "20k_30k", "30k_40k", "40k_mais"] as const;
export type FaixaInvestimento = (typeof FAIXAS_INVESTIMENTO)[number];

type MapaCodigoFaixa = Readonly<Record<string, FaixaInvestimento>>;
type MapaValorFaixa = Readonly<Record<FaixaInvestimento, number>>;
type NormalizarCodigoFn = (range: string | null | undefined) => string;
type CodigoConhecidoFn = (range: string | null | undefined) => boolean;
type MapearFaixaFn = (range: string | null | undefined) => FaixaInvestimento;
type MapearValorFn = (range: string | null | undefined) => number;

// @guard-js:inicio faixa-investimento
// JS puro daqui até o marcador de fim: tipos SÓ como alias na anotação da
// const (o guard remove `: Alias` e executa). Sintaxe TS aqui dentro quebra o CI.
export const FAIXA_INVESTIMENTO_PADRAO: FaixaInvestimento = "ate_20k";

export const FAIXA_POR_CODIGO: MapaCodigoFaixa = {
  // Formulário público (apps/web FormsPage — step 11)
  "15k-20k": "ate_20k",
  "20k-30k": "20k_30k",
  "30k-40k": "30k_40k",
  "40k-50k": "40k_mais",
  "50k-70k": "40k_mais",
  "over-70k": "40k_mais",
  // Cadastro manual do Engine (/leads/novo) — inclusive o legado com "_"
  // (normalizado para "-" antes do lookup)
  "abaixo-15k": "ate_20k",
  "acima-50k": "40k_mais",
};

export const VALOR_ESTIMADO_POR_FAIXA: MapaValorFaixa = {
  ate_20k: 16000,
  "20k_30k": 22000,
  "30k_40k": 28000,
  "40k_mais": 32000,
};

export const normalizarCodigoFaixa: NormalizarCodigoFn = (range) =>
  String(range ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-")
    .replace(/\s+/g, "");

export const faixaInvestimentoConhecida: CodigoConhecidoFn = (range) =>
  Object.prototype.hasOwnProperty.call(FAIXA_POR_CODIGO, normalizarCodigoFaixa(range));

export const mapInvestmentToEnum: MapearFaixaFn = (range) => {
  const codigo = normalizarCodigoFaixa(range);
  return Object.prototype.hasOwnProperty.call(FAIXA_POR_CODIGO, codigo)
    ? FAIXA_POR_CODIGO[codigo]
    : FAIXA_INVESTIMENTO_PADRAO;
};

export const mapInvestmentToValor: MapearValorFn = (range) =>
  VALOR_ESTIMADO_POR_FAIXA[mapInvestmentToEnum(range)];
// @guard-js:fim faixa-investimento

/** Rótulo humano do ENUM (fallback quando o deal não tem formulário). */
export const ROTULO_FAIXA_INVESTIMENTO: Readonly<Record<FaixaInvestimento, string>> = {
  ate_20k: "Até US$ 20k/ano",
  "20k_30k": "US$ 20k – 30k/ano",
  "30k_40k": "US$ 30k – 40k/ano",
  "40k_mais": "Acima de US$ 40k/ano",
};

export function rotuloFaixaInvestimento(faixa: string | null | undefined): string | null {
  if (!faixa) return null;
  return (FAIXAS_INVESTIMENTO as readonly string[]).includes(faixa)
    ? ROTULO_FAIXA_INVESTIMENTO[faixa as FaixaInvestimento]
    : null;
}
