// ════════════════════════════════════════════════════════════════════════
// Confiança das recomendações de Ads — 100% DETERMINÍSTICA
// ════════════════════════════════════════════════════════════════════════
//
// Decisão do CEO (2026-08-11): toda informação do planejador carrega um
// badge dizendo o quanto é ASSERTIVA (sustentada por dados) ou SUGESTIVA
// (hipótese). O nível vem de REGRAS sobre a massa de dados — a IA nunca
// se autoavalia; ela recebe o nível calculado e escreve o porquê.
//
// Níveis:
//   assertiva — sustentada por conversões ATRIBUÍDAS do nosso funil
//   parcial   — sustentada por dados de mídia (CTR/custo/demografia), sem
//               atribuição de funil suficiente
//   sugestiva — hipótese/boa prática; massa de dados insuficiente
// ════════════════════════════════════════════════════════════════════════

export type NivelConfianca = "assertiva" | "parcial" | "sugestiva";

export interface EvidenciaAds {
  /** Leads com utm_id casando com campanha (funil atribuído) */
  leadsAtribuidos: number;
  /** Contratos fechados atribuídos a campanhas */
  clientesAtribuidos: number;
  /** Campanhas distintas com gasto no histórico */
  campanhasComGasto: number;
  /** Gasto total no histórico considerado (BRL) */
  gastoTotal: number;
  /** Dias distintos com dados de gasto */
  diasComDados: number;
}

export type DimensaoPlano = "objetivo" | "publico" | "criativo" | "orcamento" | "cplAlvo";

export interface ConfiancaDimensao {
  nivel: NivelConfianca;
  motivo: string;
  comoMelhorar: string;
}

export type MapaConfianca = Record<DimensaoPlano, ConfiancaDimensao>;

// Limiares (documentados — ajustar exige decisão consciente)
const LEADS_ASSERTIVA = 30;
const CLIENTES_ASSERTIVA = 3;
const CAMPANHAS_PARCIAL = 5;
const GASTO_PARCIAL_BRL = 1000;
const DIAS_PARCIAL = 30;

const MELHORAR_ATRIBUICAO =
  "Rode campanhas com o bloco de UTM do planejador — cada lead atribuído aumenta a confiança.";

export function calcularConfianca(ev: EvidenciaAds): MapaConfianca {
  const temFunil = ev.leadsAtribuidos >= LEADS_ASSERTIVA || ev.clientesAtribuidos >= CLIENTES_ASSERTIVA;
  const temMidia = ev.campanhasComGasto >= CAMPANHAS_PARCIAL && ev.gastoTotal >= GASTO_PARCIAL_BRL && ev.diasComDados >= DIAS_PARCIAL;

  const funilOuMidia = (motivoFunil: string, motivoMidia: string, motivoNada: string): ConfiancaDimensao =>
    temFunil
      ? { nivel: "assertiva", motivo: motivoFunil, comoMelhorar: "Continue alimentando com campanhas rastreadas." }
      : temMidia
        ? { nivel: "parcial", motivo: motivoMidia, comoMelhorar: MELHORAR_ATRIBUICAO }
        : { nivel: "sugestiva", motivo: motivoNada, comoMelhorar: MELHORAR_ATRIBUICAO };

  return {
    objetivo: funilOuMidia(
      `${ev.leadsAtribuidos} lead(s) e ${ev.clientesAtribuidos} cliente(s) atribuídos sustentam o objetivo.`,
      `Baseado em ${ev.campanhasComGasto} campanhas com gasto (sem atribuição de funil suficiente).`,
      "Sem massa de dados — objetivo sugerido por boa prática do negócio.",
    ),
    publico: funilOuMidia(
      "Perfil calculado sobre quem CONVERTE no funil, não só quem clica.",
      `Perfil vem da demografia de mídia (${ev.campanhasComGasto} campanhas) — mostra quem engaja, ainda não quem fecha.`,
      "Público sugerido pelo perfil do produto — sem dados de mídia suficientes.",
    ),
    criativo: temMidia
      ? {
          nivel: ev.leadsAtribuidos >= LEADS_ASSERTIVA ? "assertiva" : "parcial",
          motivo: `Ranking real de CTR/custo sobre ${ev.campanhasComGasto} campanhas históricas.`,
          comoMelhorar: temFunil ? "Continue alimentando com campanhas rastreadas." : MELHORAR_ATRIBUICAO,
        }
      : { nivel: "sugestiva", motivo: "Poucas campanhas com gasto para ranquear criativos.", comoMelhorar: MELHORAR_ATRIBUICAO },
    orcamento: temMidia
      ? { nivel: "parcial", motivo: `Faixa derivada do gasto histórico real (R$ ${Math.round(ev.gastoTotal)} em ${ev.diasComDados} dias).`, comoMelhorar: MELHORAR_ATRIBUICAO }
      : { nivel: "sugestiva", motivo: "Sem histórico de gasto suficiente — valor conservador sugerido.", comoMelhorar: MELHORAR_ATRIBUICAO },
    cplAlvo:
      ev.leadsAtribuidos >= LEADS_ASSERTIVA
        ? { nivel: "assertiva", motivo: `CPL calculado sobre ${ev.leadsAtribuidos} leads atribuídos reais.`, comoMelhorar: "Continue alimentando com campanhas rastreadas." }
        : ev.leadsAtribuidos > 0
          ? { nivel: "parcial", motivo: `Apenas ${ev.leadsAtribuidos} lead(s) atribuído(s) — CPL ainda instável.`, comoMelhorar: MELHORAR_ATRIBUICAO }
          : { nivel: "sugestiva", motivo: "ZERO leads atribuídos até hoje (campanhas antigas sem UTM) — alvo é estimativa de negócio.", comoMelhorar: MELHORAR_ATRIBUICAO },
  };
}

export const CONFIANCA_LABEL: Record<NivelConfianca, string> = {
  assertiva: "Assertiva — dados do funil",
  parcial: "Parcial — dados de mídia",
  sugestiva: "Sugestiva — hipótese",
};
