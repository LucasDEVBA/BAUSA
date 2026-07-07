/**
 * Gasto de marketing — dedup de fonte.
 *
 * investimentos_marketing tem UNIQUE(mes, canal, source), então o mesmo mês+canal
 * pode ter uma linha 'manual' e uma 'meta_api'. Quando o sync do Meta roda junto
 * com input manual, somar as duas dobraria o gasto. Regra: se existe meta_api
 * para um (mês, canal), o meta_api é a verdade e o manual daquele par é ignorado.
 */

export interface InvestimentoRow {
  mes: string;
  canal: string;
  valor_gasto: number;
  source: string;
}

export function dedupInvestimentos<T extends InvestimentoRow>(rows: T[]): T[] {
  const key = (r: InvestimentoRow) => `${String(r.mes).slice(0, 7)}|${r.canal}`;
  const temMetaApi = new Set<string>();
  for (const r of rows) {
    if (r.source === "meta_api") temMetaApi.add(key(r));
  }
  return rows.filter((r) => r.source === "meta_api" || !temMetaApi.has(key(r)));
}
