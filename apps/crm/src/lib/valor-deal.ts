/**
 * Valor REAL do deal — FONTE ÚNICA da leitura (T3, 2026-10-08).
 *
 * Precedência (nunca gravada; derivada a cada leitura):
 *   1. contratado — contratos_financeiros.valor_total do contrato VIGENTE
 *      (deleted_at null) com plano definido e valor > 0;
 *   2. negociado  — deals.valor_estimado quando flag_valores_customizados
 *      (customizarValorDeal, justificativa obrigatória — Regra 3);
 *   3. estimado   — deals.valor_estimado automático (faixa do formulário).
 *
 * Por que na leitura e não sobrescrevendo deals.valor_estimado no
 * criarContrato: a estimativa original e a customização têm semântica própria
 * (flag + justificativa + audit); copiar o contrato para o deal criaria duas
 * verdades que divergem na primeira edição do contrato.
 *
 * Embed: contratos_financeiros.deal_id é UNIQUE ⇒ o PostgREST devolve OBJETO
 * (ou null), nunca array (incidente 05/09 derrubou /pipeline). O normalizador
 * aceita os dois formatos por defesa. As parcelas (1:N) voltam como array.
 *
 * Desconto (revisão R2 do valor, PR-07): depois do contrato flexível o
 * valor_total soma itens e, com sinal_abatido=false, a entrada — compará-lo
 * com a tabela escondia desconto (Journey negociado a 24k com sinal à parte
 * = 28,5k "sem desconto"). A base é valor_base_plano (legado: valor_total), o
 * preço vem de configuracoes_sistema.planos (a mesma chave que a RPC
 * fin_valor_tabela lê; PLANO_VALORES só como fallback) e item 'desconto'
 * também conta.
 *
 * O bloco `@guard-js` é JS puro (tipos só por alias na anotação da const):
 * tests/valor-deal-invariants.test.js o EXECUTA com casos reais.
 */

import { PLANO_VALORES } from "@/types/crm";
import { type Deal, type OrigemValorDeal, type ProductTier } from "@/types/deal";
import { formatInvestmentRange } from "@/lib/utils";

/** Parcela no embed `parcelas(tipo, status, valor, deleted_at)`. */
export interface ParcelaValorEmbed {
  tipo?: string | null;
  status?: string | null;
  valor?: number | string | null;
  deleted_at?: string | null;
}

/** Item no embed `itens:contrato_itens(tipo, valor, deleted_at)` (T18a). */
export interface ItemContratoValorEmbed {
  tipo?: string | null;
  valor?: number | string | null;
  deleted_at?: string | null;
}

/** Contrato no embed `contrato:contratos_financeiros(...)` — OBJETO ou null. */
export interface ContratoValorEmbed {
  id?: string | null;
  plano?: string | null;
  valor_total?: number | string | null;
  /** Preço do plano antes de itens e do sinal à parte; null = legado/aguardando plano. */
  valor_base_plano?: number | string | null;
  forma_pagamento_plano?: string | null;
  deleted_at?: string | null;
  parcelas?: ParcelaValorEmbed[] | ParcelaValorEmbed | null;
  /** Só no embed completo; ausente nos agregados (o desconto não é usado lá). */
  itens?: ItemContratoValorEmbed[] | ItemContratoValorEmbed | null;
}

/** Colunas do deal que a resolução precisa. */
export interface DealValorEntrada {
  valor_estimado?: number | string | null;
  flag_valores_customizados?: boolean | null;
  contrato?: ContratoValorEmbed | ContratoValorEmbed[] | null;
}

/** Tabela de preço por plano (padrão × pix à vista): configuracoes_sistema.planos
 *  convertida por tabelaPlanosDe (fallback PLANO_VALORES). */
export type TabelaPlanos = Readonly<Record<string, { readonly padrao: number; readonly pix: number }>>;

export interface ValorDealResolvido {
  /** O número exibido e somado (card, coluna, métricas, export, War Room). */
  valor: number;
  origem: OrigemValorDeal;
  /** deals.valor_estimado cru (estimativa ou negociado); null se ausente. */
  valorEstimadoDeal: number | null;
  /** Contrato vigente (mesmo sem plano definido — sinal antes do plano). */
  contratoId: string | null;
  plano: ProductTier | null;
  /** Soma das parcelas de entrada/sinal RECEBIDAS (não depende de entrada_paga). null = sem contrato. */
  sinalRecebido: number | null;
  /** valor do contrato − tudo que já foi recebido; null fora de "contratado". */
  saldoAReceber: number | null;
  /** Base abaixo do preço de tabela da forma escolhida OU item 'desconto' vivo. */
  temDesconto: boolean;
  /** (tabela − base) + Σ|itens de desconto|, sobre o preço de tabela (personalizado: sobre a base). */
  descontoPct: number | null;
}

type NumeroOuNullFn = (v: unknown) => number | null;
type ContratoVigenteFn = (
  contrato: ContratoValorEmbed | ContratoValorEmbed[] | null | undefined,
) => ContratoValorEmbed | null;
type ParcelasFn = (parcelas: ParcelaValorEmbed[] | ParcelaValorEmbed | null | undefined) => ParcelaValorEmbed[];
type SomaParcelasFn = (parcelas: ParcelaValorEmbed[]) => number;
type ItensFn = (
  itens: ItemContratoValorEmbed[] | ItemContratoValorEmbed | null | undefined,
) => ItemContratoValorEmbed[];
type SomaDescontosFn = (itens: ItemContratoValorEmbed[]) => number;
type ContratoComValorFn = (contrato: ContratoValorEmbed | null) => boolean;
type ValorTabelaFn = (tabela: TabelaPlanos, plano: string, forma: string | null | undefined) => number | null;
type ObjetoFn = (v: unknown) => Record<string, unknown>;
type PrecoPositivoFn = (v: unknown) => number | null;
type TabelaDaConfigFn = (config: unknown, fallback: TabelaPlanos) => TabelaPlanos;
type ResolverCoreFn = (deal: DealValorEntrada, tabela: TabelaPlanos) => ValorDealResolvido;
type ListaTexto = readonly string[];
type MapaTier = Readonly<Record<string, ProductTier>>;

/** Campos JÁ resolvidos do deal que a exibição do sinal antes do plano lê. */
export type DealPlanoSinal = Pick<Deal, "contrato_id" | "product_tier" | "signal_value_brl">;
type AguardandoPlanoFn = (deal: DealPlanoSinal) => boolean;
type SinalAntesDoPlanoFn = (deal: DealPlanoSinal) => number | null;

// @guard-js:inicio valor-deal
// JS puro daqui até o marcador de fim (o guard remove `: Alias` e executa).
const PLANOS_COM_VALOR: ListaTexto = ["start", "journey", "legacy", "personalizado"];
// "sinal" é aceito por defesa: o registro do sinal antes do plano (T11) pode
// usar um tipo próprio; hoje o CHECK de parcelas só tem entrada/saldo.
const TIPOS_PARCELA_SINAL: ListaTexto = ["entrada", "sinal"];
// Planos com preço de tabela (personalizado é negociado caso a caso, sem tabela).
const PLANOS_DE_TABELA: ListaTexto = ["start", "journey", "legacy"];
const TIER_POR_PLANO: MapaTier = {
  start: "Start",
  journey: "Journey",
  legacy: "Legacy",
  personalizado: "Personalizado",
};

const numeroOuNull: NumeroOuNullFn = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

const contratoVigente: ContratoVigenteFn = (contrato) => {
  const c = Array.isArray(contrato) ? (contrato[0] ?? null) : (contrato ?? null);
  if (!c || c.deleted_at) return null;
  return c;
};

const parcelasDe: ParcelasFn = (parcelas) => {
  if (Array.isArray(parcelas)) return parcelas;
  return parcelas ? [parcelas] : [];
};

const somaParcelas: SomaParcelasFn = (parcelas) =>
  parcelas.reduce((total, p) => total + (numeroOuNull(p.valor) ?? 0), 0);

const itensDe: ItensFn = (itens) => {
  if (Array.isArray(itens)) return itens;
  return itens ? [itens] : [];
};

// Item 'desconto' é gravado NEGATIVO (CHECK do contrato_itens); soma em módulo.
const somaDescontosItens: SomaDescontosFn = (itens) =>
  itens
    .filter((i) => !i.deleted_at && i.tipo === "desconto")
    .reduce((total, i) => total + Math.abs(numeroOuNull(i.valor) ?? 0), 0);

const objetoOuVazio: ObjetoFn = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v)) : {};

const precoPositivo: PrecoPositivoFn = (v) => {
  const n = numeroOuNull(v);
  return n !== null && n > 0 ? n : null;
};

// configuracoes_sistema.planos = { journey: { valor, valor_pix, psicologa }, … }.
// Mesma regra da RPC fin_valor_tabela: preço ausente, malformado ou <= 0 cai
// no fallback daquela forma de pagamento (nunca some o preço de tabela).
const tabelaPlanosDaConfig: TabelaDaConfigFn = (config, fallback) => {
  const cfg = objetoOuVazio(config);
  return Object.fromEntries(
    PLANOS_DE_TABELA.map((plano) => {
      const linha = objetoOuVazio(cfg[plano]);
      const ref = Object.prototype.hasOwnProperty.call(fallback, plano) ? fallback[plano] : null;
      return [
        plano,
        {
          padrao: precoPositivo(linha.valor) ?? ref?.padrao ?? 0,
          pix: precoPositivo(linha.valor_pix) ?? ref?.pix ?? 0,
        },
      ];
    }),
  );
};

// "Aguardando plano" (sinal registrado antes da escolha — T11) NÃO é valor
// contratado: plano nulo/fora da lista ou valor <= 0 cai para negociado/estimado.
const contratoComValorDefinido: ContratoComValorFn = (contrato) =>
  contrato !== null &&
  PLANOS_COM_VALOR.includes(String(contrato.plano ?? "")) &&
  (numeroOuNull(contrato.valor_total) ?? 0) > 0;

const valorTabelaPlano: ValorTabelaFn = (tabela, plano, forma) => {
  const linha = Object.prototype.hasOwnProperty.call(tabela, plano) ? tabela[plano] : null;
  if (!linha) return null;
  return forma === "pix_avista" ? linha.pix : linha.padrao;
};

const resolverValorDealCore: ResolverCoreFn = (deal, tabela) => {
  const contrato = contratoVigente(deal.contrato);
  const estimadoDeal = numeroOuNull(deal.valor_estimado);
  const recebidas = contrato
    ? parcelasDe(contrato.parcelas).filter((p) => !p.deleted_at && p.status === "recebido")
    : [];
  const sinalRecebido = contrato
    ? somaParcelas(recebidas.filter((p) => TIPOS_PARCELA_SINAL.includes(String(p.tipo ?? ""))))
    : null;

  if (contrato !== null && contratoComValorDefinido(contrato)) {
    const valor = numeroOuNull(contrato.valor_total) ?? 0;
    const plano = String(contrato.plano);
    // valor_total soma itens e o sinal à parte: o desconto se mede na BASE.
    const base = numeroOuNull(contrato.valor_base_plano) ?? valor;
    const precoTabela = valorTabelaPlano(tabela, plano, contrato.forma_pagamento_plano);
    const temTabela = precoTabela !== null && precoTabela > 0;
    const abaixoDaTabela = temTabela ? Math.max(0, precoTabela - base) : 0;
    const descontoTotal = abaixoDaTabela + somaDescontosItens(itensDe(contrato.itens));
    const referencia = temTabela ? precoTabela : base;
    const temDesconto = descontoTotal > 0;
    return {
      valor,
      origem: "contratado",
      valorEstimadoDeal: estimadoDeal,
      contratoId: contrato.id ?? null,
      plano: TIER_POR_PLANO[plano] ?? null,
      sinalRecebido,
      saldoAReceber: Math.max(0, valor - somaParcelas(recebidas)),
      temDesconto,
      descontoPct: temDesconto && referencia > 0 ? Math.round((descontoTotal / referencia) * 100) : null,
    };
  }

  const valor = estimadoDeal !== null && estimadoDeal > 0 ? estimadoDeal : 0;
  return {
    valor,
    origem: deal.flag_valores_customizados === true && valor > 0 ? "negociado" : "estimado",
    valorEstimadoDeal: estimadoDeal,
    contratoId: contrato ? (contrato.id ?? null) : null,
    plano: null,
    sinalRecebido,
    saldoAReceber: null,
    temDesconto: false,
    descontoPct: null,
  };
};

// Contrato vigente sem plano definido (T11): o resolver não o trata como
// "contratado", então product_tier fica vazio mas contrato_id existe.
export const contratoAguardandoPlano: AguardandoPlanoFn = (deal) =>
  Boolean(deal.contrato_id) && !deal.product_tier;

// Sinal já recebido com o plano ainda em aberto: o card mostra o SINAL como
// número principal (o total ainda não existe) e a previsão como linha
// secundária. Não depende de deal_value_brl > 0 — lead sem faixa também paga sinal.
export const sinalPagoAntesDoPlano: SinalAntesDoPlanoFn = (deal) => {
  const sinal = numeroOuNull(deal.signal_value_brl) ?? 0;
  return contratoAguardandoPlano(deal) && sinal > 0 ? sinal : null;
};
// @guard-js:fim valor-deal

// Hints de FK explícitos: sem eles o PostgREST adivinha a relação e, quando
// surge uma 2ª FK entre as mesmas tabelas (ex.: contrato_eventos do T9/T11),
// devolve PGRST201 e a tela inteira cai em silêncio (já aconteceu com
// atletas→responsaveis). O hint não muda a cardinalidade: deal_id é UNIQUE,
// então o contrato continua chegando como OBJETO.

// valor_base_plano e contrato_itens nascem na migration *_financeiro_contrato_flexivel
// (PR-07): embuti-los antes dela derrubava o /pipeline com 400.

/** Embed completo (pipeline, detalhe): contrato + parcelas p/ sinal/saldo + itens p/ desconto. */
export const EMBED_CONTRATO_VALOR =
  "contrato:contratos_financeiros!contratos_financeiros_deal_id_fkey(id, plano, valor_total, valor_base_plano, forma_pagamento_plano, deleted_at, parcelas!parcelas_contrato_id_fkey(tipo, status, valor, deleted_at), itens:contrato_itens!contrato_itens_contrato_id_fkey(tipo, valor, deleted_at))";

/** Embed leve (agregados: War Room, relatórios, agenda, famílias). */
export const EMBED_CONTRATO_VALOR_LEVE =
  "contrato:contratos_financeiros!contratos_financeiros_deal_id_fkey(id, plano, valor_total, valor_base_plano, forma_pagamento_plano, deleted_at)";

/** Chave de configuracoes_sistema com o preço de tabela (a mesma da fin_valor_tabela). */
export const CHAVE_CONFIG_PLANOS = "planos";

/** `configuracoes_sistema.planos` (valor cru da linha) → tabela do resolver.
 *  Sem linha/erro de leitura: PLANO_VALORES (mesmos números do seed). */
export function tabelaPlanosDe(config: unknown): TabelaPlanos {
  return tabelaPlanosDaConfig(config, PLANO_VALORES);
}

/** `tabela` = preço configurado (tabelaPlanosDe); só o DESCONTO depende dela —
 *  o valor exibido/somado é o mesmo com qualquer tabela. */
export function resolverValorDeal(
  deal: DealValorEntrada,
  tabela: TabelaPlanos = PLANO_VALORES,
): ValorDealResolvido {
  return resolverValorDealCore(deal, tabela);
}

/** Atalho para agregados: só o número exibido. */
export function valorExibidoDeal(deal: DealValorEntrada): number {
  return resolverValorDealCore(deal, PLANO_VALORES).valor;
}

/** Campos do type Deal derivados do valor — usado por pipeline/page.tsx e deal-fetch.ts. */
export type CamposValorDeal = Pick<
  Deal,
  | "deal_value_brl"
  | "valor_origem"
  | "valor_estimado_brl"
  | "contrato_id"
  | "product_tier"
  | "signal_value_brl"
  | "remaining_value_brl"
  | "has_discount"
  | "discount_pct"
>;

export function camposValorDeal(
  deal: DealValorEntrada,
  tabela: TabelaPlanos = PLANO_VALORES,
): CamposValorDeal {
  const r = resolverValorDeal(deal, tabela);
  return {
    deal_value_brl: r.valor,
    valor_origem: r.origem,
    valor_estimado_brl: r.valorEstimadoDeal ?? undefined,
    contrato_id: r.contratoId ?? undefined,
    product_tier: r.plano ?? undefined,
    signal_value_brl: r.sinalRecebido ?? undefined,
    remaining_value_brl: r.saldoAReceber ?? undefined,
    has_discount: r.temDesconto,
    discount_pct: r.descontoPct ?? undefined,
  };
}

// ─── Limites da customização (servidor E modal) ──────────────────
// Teto de sanidade: digitação errada (zero a mais) não vira R$ 10M no
// pipeline. Contratos reais ficam entre R$ 16k e R$ 60k. Fica aqui (e não em
// actions/deals.ts, "use server") para o modal espelhar a mesma regra.
export const VALOR_DEAL_MAXIMO = 1_000_000;
export const JUSTIFICATIVA_VALOR_MAX = 1000;

// ─── Apresentação ────────────────────────────────────────────────

export const ROTULO_ORIGEM_VALOR: Readonly<Record<OrigemValorDeal, string>> = {
  contratado: "contrato",
  negociado: "negociado",
  estimado: "estimado",
};

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;

/** "≈ R$ 22.000" quando é estimativa; "R$ 26.000" quando é contrato/negociado;
 *  "Sem valor" quando não há estimativa (deal manual sem faixa). */
export function formatarValorDeal(valor: number, origem: OrigemValorDeal | undefined): string {
  if (!(valor > 0)) return "Sem valor";
  return origem === "estimado" || origem === undefined ? `≈ ${brl(valor)}` : brl(valor);
}

/** Texto principal do card quando o sinal veio antes do plano (T11). */
export function textoSinalAntesDoPlano(sinal: number): string {
  return `Sinal ${brl(sinal)} pago · total a definir`;
}

/** Linha secundária do card no mesmo caso: a previsão que segue somada na
 *  coluna/métricas. null quando não há previsão (deal sem faixa). */
export function textoPrevisaoDoSinal(
  deal: Pick<Deal, "deal_value_brl" | "valor_origem">,
): string | null {
  if (!(deal.deal_value_brl > 0)) return null;
  const origem = deal.valor_origem ?? "estimado";
  return `previsão ${formatarValorDeal(deal.deal_value_brl, origem)} ${ROTULO_ORIGEM_VALOR[origem]}`;
}

/** Texto do tooltip/hint que explica a origem (mesma frase em todo o Engine). */
export function explicarOrigemValor(
  deal: Pick<
    Deal,
    | "valor_origem"
    | "product_tier"
    | "investment_range"
    | "justificativa_valor"
    | "deal_value_brl"
    | "contrato_id"
  >,
): string {
  // Contrato sem plano (sinal antes do plano — T11) ainda não define o total.
  const situacaoContrato = contratoAguardandoPlano({ ...deal, signal_value_brl: undefined })
    ? "Contrato aguardando a escolha do plano"
    : "Ainda sem contrato";
  switch (deal.valor_origem) {
    case "contratado":
      return `Valor do contrato${deal.product_tier ? ` (${deal.product_tier})` : ""}: vem do contrato do deal (veja a aba do contrato).`;
    case "negociado":
      return `Valor negociado${deal.justificativa_valor ? `: ${deal.justificativa_valor}` : ""}. Registrado no histórico (audit).${deal.contrato_id ? ` ${situacaoContrato}.` : ""}`;
    default: {
      if (!(deal.deal_value_brl > 0)) {
        return `Sem estimativa: o lead não tem faixa de investimento. ${situacaoContrato}. Defina o valor negociado.`;
      }
      const faixa = deal.investment_range ? formatInvestmentRange(deal.investment_range) : null;
      return `Estimativa automática pela faixa de investimento do formulário${faixa ? ` (${faixa})` : ""}. ${situacaoContrato} e sem valor negociado.`;
    }
  }
}
