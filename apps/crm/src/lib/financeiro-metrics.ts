/**
 * Métricas financeiras reais — DRE, Fluxo de Caixa e resumo — cruzando
 * ENTRADAS (parcelas) com SAÍDAS (despesas + folha). Substitui o cálculo
 * de margem hardcoded da Visão Geral.
 *
 * Regime: receita e saídas por COMPETÊNCIA (mês). A folha usa o run-rate
 * atual (Σ colaboradores ativos) para todos os meses — não há histórico de
 * folha; é o custo corrente, sinalizado na UI.
 */

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { dedupInvestimentos, type InvestimentoRow } from "@/lib/marketing-spend";
import type { Despesa } from "@/types/financeiro";

export interface DreMes {
  mes: string; // YYYY-MM
  label: string; // "jul/26"
  receita: number;
  folha: number;
  marketing: number; // gasto de mídia (fonte única: investimentos_marketing)
  despesas: number; // não-folha, não-imposto, não-marketing
  impostos: number;
  resultado: number;
  margem: number; // %
}

export interface FluxoMes {
  mes: string;
  label: string;
  entradas: number;
  saidas: number;
  saldo: number;
  projetado: boolean;
}

export interface ResumoFinanceiro {
  receitaMes: number;
  resultadoMes: number;
  margemLiquida: number; // %
  folhaPctReceita: number; // %
  folhaMes: number;
  custosFixosMes: number; // folha + recorrentes ativas
  breakEvenContratos: number; // nº de contratos/mês p/ cobrir custos fixos
  ticketMedio: number;
}

export interface FinanceiroMetrics {
  dre: DreMes[];
  fluxo: FluxoMes[];
  resumo: ResumoFinanceiro;
}

const MESES_DRE = 6;
const MESES_PROJECAO = 3;

function mesKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function mesLabel(mes: string): string {
  const [ano, m] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1]}/${ano.slice(2)}`;
}

/** Lista de chaves YYYY-MM, do mais antigo ao mais novo, terminando no mês de `ref`. */
function ultimosMeses(ref: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    out.push(mesKey(new Date(ref.getFullYear(), ref.getMonth() - i, 1)));
  }
  return out;
}

function proximosMeses(ref: Date, n: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= n; i++) {
    out.push(mesKey(new Date(ref.getFullYear(), ref.getMonth() + i, 1)));
  }
  return out;
}

/**
 * Saídas por mês a partir do livro-razão de despesas, com dedup template×instância:
 * um template recorrente ativo conta no mês SÓ se não houver instância realizada
 * (despesa_origem_id=template, mesma competência) daquele mês.
 */
function despesasPorMes(despesas: Despesa[], meses: string[]): Map<string, Despesa[]> {
  const realizadas = despesas.filter((d) => !d.recorrente && d.status !== "cancelado");
  const templates = despesas.filter((d) => d.recorrente && d.recorrencia_ativa);

  const porMes = new Map<string, Despesa[]>();
  for (const mes of meses) {
    const doMes = realizadas.filter((d) => d.competencia.startsWith(mes));
    const idsRealizadosNoMes = new Set(
      doMes.map((d) => d.despesa_origem_id).filter((id): id is string => Boolean(id)),
    );
    // Projeta templates sem instância realizada naquele mês
    const projetados = templates.filter((t) => !idsRealizadosNoMes.has(t.id));
    porMes.set(mes, [...doMes, ...projetados]);
  }
  return porMes;
}

export async function getFinanceiroMetrics(ref = new Date()): Promise<FinanceiroMetrics> {
  const supabase = await createServerSupabaseClient();

  const [parcelasRes, despesasRes, colabRes, contratosRes, mktRes] = await Promise.all([
    supabase
      .from("parcelas")
      .select("valor, status, recebido_at, vencimento")
      .is("deleted_at", null),
    supabase.from("despesas").select("*").is("deleted_at", null),
    supabase.from("colaboradores").select("custo_mensal_brl, ativo").is("deleted_at", null),
    supabase.from("contratos_financeiros").select("valor_total").is("deleted_at", null),
    // Marketing = FONTE ÚNICA em investimentos_marketing (alimenta CAC e DRE).
    // Despesas categoria='marketing' são excluídas do DRE para não dobrar.
    supabase.from("investimentos_marketing").select("mes, canal, valor_gasto, source").is("deleted_at", null),
  ]);

  const parcelas = parcelasRes.data ?? [];
  const despesas = (despesasRes.data as Despesa[] | null) ?? [];
  const colaboradores = colabRes.data ?? [];
  const contratos = contratosRes.data ?? [];
  const investimentos = dedupInvestimentos(
    (mktRes.data as InvestimentoRow[] | null) ?? [],
  );

  const marketingPorMes = (mes: string) =>
    investimentos
      .filter((i) => String(i.mes).startsWith(mes))
      .reduce((s, i) => s + Number(i.valor_gasto), 0);
  // Run-rate de marketing (mês corrente) — usado como baseline nas projeções
  // e no break-even (futuro ainda não tem gasto registrado).
  const marketingRunRate = marketingPorMes(mesKey(ref));

  const folhaMes = colaboradores
    .filter((c) => c.ativo)
    .reduce((s, c) => s + Number(c.custo_mensal_brl), 0);

  const mesesDre = ultimosMeses(ref, MESES_DRE);
  const saidasPorMes = despesasPorMes(despesas, [...mesesDre, ...proximosMeses(ref, MESES_PROJECAO)]);

  // ── DRE (últimos 6 meses) ──
  const dre: DreMes[] = mesesDre.map((mes) => {
    const receita = parcelas
      .filter((p) => p.status === "recebido" && (p.recebido_at as string | null)?.startsWith(mes))
      .reduce((s, p) => s + Number(p.valor), 0);

    const saidasMes = saidasPorMes.get(mes) ?? [];
    const impostos = saidasMes.filter((d) => d.categoria === "impostos").reduce((s, d) => s + d.valor_brl, 0);
    // Exclui folha, impostos E marketing (marketing vem de investimentos_marketing).
    const despesasNaoFolha = saidasMes
      .filter((d) => d.categoria !== "impostos" && d.categoria !== "folha" && d.categoria !== "marketing")
      .reduce((s, d) => s + d.valor_brl, 0);
    const marketing = marketingPorMes(mes);
    // Folha = run-rate da equipe (Σ colaboradores ativos) + despesas categoria 'folha'.
    // CONVENÇÃO: a folha mensal recorrente é gerida na aba Folha (colaboradores);
    // despesas categoria 'folha' são custos AVULSOS de pessoal (bônus, 13º, rescisão)
    // — NÃO reentrar o salário aqui, senão dobra o run-rate.
    const folhaLedger = saidasMes.filter((d) => d.categoria === "folha").reduce((s, d) => s + d.valor_brl, 0);
    const folha = folhaMes + folhaLedger;

    const resultado = receita - folha - marketing - despesasNaoFolha - impostos;
    const margem = receita > 0 ? Math.round((resultado / receita) * 100) : 0;
    return { mes, label: mesLabel(mes), receita, folha, marketing, despesas: despesasNaoFolha, impostos, resultado, margem };
  });

  // ── Fluxo de Caixa: realizado (6m) + projetado (3m) ──
  const hojeStr = ref.toISOString().slice(0, 10);
  const fluxoRealizado: FluxoMes[] = mesesDre.map((mes) => {
    const entradas = parcelas
      .filter((p) => p.status === "recebido" && (p.recebido_at as string | null)?.startsWith(mes))
      .reduce((s, p) => s + Number(p.valor), 0);
    const saidasMes = saidasPorMes.get(mes) ?? [];
    // Caixa realizado: saídas efetivamente pagas + templates recorrentes (baseline)
    // + folha + marketing (fonte única investimentos_marketing). Marketing é
    // excluído do bucket de despesas para não dobrar.
    // Uma instância recorrente materializada mas ainda 'previsto' fica de fora
    // (não saiu do caixa) — o dedup já removeu o template dela, então não some duas
    // vezes; ela entra quando for marcada como paga.
    const saidas =
      saidasMes
        .filter((d) => d.categoria !== "marketing" && (d.status === "pago" || d.recorrente))
        .reduce((s, d) => s + d.valor_brl, 0) +
      folhaMes +
      marketingPorMes(mes);
    return { mes, label: mesLabel(mes), entradas, saidas, saldo: entradas - saidas, projetado: false };
  });

  const fluxoProjetado: FluxoMes[] = proximosMeses(ref, MESES_PROJECAO).map((mes) => {
    const entradas = parcelas
      .filter(
        (p) =>
          (p.status === "previsto" || p.status === "atrasado") &&
          (p.vencimento as string | null)?.startsWith(mes) &&
          (p.vencimento as string) >= hojeStr,
      )
      .reduce((s, p) => s + Number(p.valor), 0);
    const saidasMes = saidasPorMes.get(mes) ?? [];
    const saidas =
      saidasMes.filter((d) => d.categoria !== "marketing").reduce((s, d) => s + d.valor_brl, 0) +
      folhaMes +
      (marketingPorMes(mes) || marketingRunRate);
    return { mes, label: mesLabel(mes), entradas, saidas, saldo: entradas - saidas, projetado: true };
  });

  const fluxo = [...fluxoRealizado, ...fluxoProjetado];

  // ── Resumo (mês corrente) ──
  const mesAtualKey = mesKey(ref);
  const dreAtual = dre.find((d) => d.mes === mesAtualKey);
  const recorrentesAtivas = despesas
    .filter((d) => d.recorrente && d.recorrencia_ativa && d.categoria !== "marketing")
    .reduce((s, d) => s + d.valor_brl, 0);
  const custosFixosMes = folhaMes + recorrentesAtivas + marketingRunRate;
  const ticketMedio =
    contratos.length > 0
      ? Math.round(contratos.reduce((s, c) => s + Number(c.valor_total), 0) / contratos.length)
      : 0;

  const resumo: ResumoFinanceiro = {
    receitaMes: dreAtual?.receita ?? 0,
    resultadoMes: dreAtual?.resultado ?? 0,
    margemLiquida: dreAtual?.margem ?? 0,
    folhaMes,
    folhaPctReceita: dreAtual && dreAtual.receita > 0 ? Math.round((folhaMes / dreAtual.receita) * 100) : 0,
    custosFixosMes,
    breakEvenContratos: ticketMedio > 0 ? Math.ceil(custosFixosMes / ticketMedio) : 0,
    ticketMedio,
  };

  return { dre, fluxo, resumo };
}
