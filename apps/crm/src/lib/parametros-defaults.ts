/**
 * Defaults de metas/valores/parâmetros — espelham o seed da migration
 * 20260401000300 e são o fallback quando a chave ainda não existe no banco.
 *
 * Módulo PURO de propósito: `lib/actions/parametros.ts` é `"use server"` e um
 * arquivo com essa diretiva só pode exportar funções async — constantes
 * precisam morar fora (senão o build quebra ao coletar a rota).
 */

export const METAS_DEFAULT = {
  meta_anual: 1_500_000,
  meta_mensal_padrao: 125_000,
  ticket_medio_alvo: 23_000,
  contratos_mes_alvo: 6,
  pipeline_health_min: 3,
  pipeline_health_max: 5,
};

export const VALORES_DEFAULT = {
  planos: {
    legacy: { valor: 32_000, valor_pix: 28_500, psicologa: true },
    journey: { valor: 26_000, valor_pix: 23_000, psicologa: true },
    start: { valor: 18_000, valor_pix: 16_000, psicologa: false },
  },
  entrada_padrao: 4_500,
  psicologa_custo_padrao: 1_200,
};

export const SCORE_DEFAULT = {
  pesos: {
    investimento: 25,
    timing: 20,
    ingles: 15,
    academico: 15,
    competitivo: 10,
    comprometimento: 10,
    video: 5,
  },
  faixas: { hot: 70, warm: 40 },
};

export const MATCH_DEFAULT = {
  pesos: { financeiro: 30, academico: 25, esportivo: 25, serie: 10, historico_bausa: 10 },
  faixas: { excelente: 85, forte: 70, possivel: 50 },
};

export const EXPERIENCIA_DEFAULT = { ansiedade_vermelho: 4, satisfacao_vermelho: 2 };
