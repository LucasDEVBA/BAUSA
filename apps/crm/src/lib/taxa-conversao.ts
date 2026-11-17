/**
 * Taxa de conversão comercial = deals GANHOS ÷ deals DECIDIDOS (ganhos + perdidos).
 *
 * Por que esta base: antes só `concluido` contava como ganho. `concluido` é o
 * fim do ciclo inteiro (meses depois do contrato), então 8 contratos assinados
 * apareciam como 0%. Ganho = qualquer etapa de ganho do Engine (`etapasGanho`:
 * contrato assinado em diante, incluindo colunas personalizadas marcadas).
 *
 * Perdido por TIMING não entra na base: é lead fora da janela de idade, não
 * derrota comercial — e já fica fora do Kanban. Quem chama exclui antes.
 *
 * Fonte única para o /pipeline e o War Room (guard em
 * tests/etapas-consistencia-telas-invariants.test.js).
 */
export interface TaxaConversao {
  /** 0–100 inteiro; null = nenhum deal decidido ainda (exibir "—", nunca 0%). */
  taxa: number | null;
  ganhos: number;
  decididos: number;
}

const inteiroNaoNegativo = (n: number): number => (Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0);

export function calcularTaxaConversao(ganhos: number, perdidos: number): TaxaConversao {
  const g = inteiroNaoNegativo(ganhos);
  const decididos = g + inteiroNaoNegativo(perdidos);
  return {
    taxa: decididos > 0 ? Math.round((g / decididos) * 100) : null,
    ganhos: g,
    decididos,
  };
}

export function formatarTaxaConversao(t: TaxaConversao): string {
  return t.taxa === null ? "—" : `${t.taxa}%`;
}

/** Contexto curto da base, para hint/legenda do card ("8 ganhos de 20 decididos"). */
export function descreverBaseConversao(t: TaxaConversao): string {
  if (t.decididos === 0) return "Nenhum deal ganho ou perdido ainda";
  const ganhos = t.ganhos === 1 ? "1 ganho" : `${t.ganhos} ganhos`;
  return `${ganhos} de ${t.decididos} decididos`;
}
