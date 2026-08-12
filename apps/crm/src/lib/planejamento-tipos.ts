/**
 * Tipos e regras puras do módulo Planejamento.
 *
 * Módulo SEM "use server" de propósito: arquivos com essa diretiva só podem
 * exportar funções async, e aqui moram tipos, constantes e funções de cálculo
 * que a UI também precisa (progresso, farol, bônus).
 */

export type PeriodoTipo = "ano" | "semestre" | "mes";
export type UnidadeMeta = "moeda" | "quantidade" | "percentual";
export type DirecaoMeta = "maior_melhor" | "menor_melhor";
export type FonteMeta = "manual" | "receita" | "contratos" | "leads" | "reunioes" | "cac";
export type StatusObjetivo =
  | "nao_iniciado"
  | "em_andamento"
  | "concluido"
  | "pausado"
  | "cancelado";
export type Prioridade = "alta" | "media" | "baixa";
export type Farol = "verde" | "amarelo" | "vermelho";
export type IncentivoTipo = "nenhum" | "valor_fixo" | "percentual_meta";
export type StatusApuracao = "previsto" | "aprovado" | "pago" | "cancelado";
export type Frequencia = "semanal" | "quinzenal" | "mensal" | "trimestral";

export interface Ciclo {
  id: string;
  nome: string;
  ano_inicio: number;
  ano_fim: number;
  visao: string | null;
  status: "rascunho" | "ativo" | "encerrado";
}

export interface Objetivo {
  id: string;
  ciclo_id: string;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  ordem: number;
  accent: "blue" | "green" | "orange" | "red" | "purple" | "neutral";
  status: StatusObjetivo;
}

export interface Projeto {
  id: string;
  objetivo_id: string;
  nome: string;
  descricao: string | null;
  responsavel_id: string | null;
  status: StatusObjetivo;
  prioridade: Prioridade;
  inicio: string | null;
  fim: string | null;
  progresso: number;
  orcamento: number | null;
}

export interface Projecao {
  id: string;
  ciclo_id: string;
  ano: number;
  receita: number;
  contratos: number;
  ticket_medio: number;
  investimento_marketing: number;
  custo_fixo: number;
  premissas: string | null;
}

export interface Meta {
  id: string;
  ciclo_id: string;
  objetivo_id: string | null;
  titulo: string;
  descricao: string | null;
  responsavel_id: string | null;
  periodo_tipo: PeriodoTipo;
  ano: number;
  semestre: number | null;
  mes: number | null;
  unidade: UnidadeMeta;
  direcao: DirecaoMeta;
  alvo: number;
  minimo: number | null;
  fonte: FonteMeta;
  realizado_manual: number | null;
  peso: number;
  incentivo_tipo: IncentivoTipo;
  incentivo_valor: number | null;
  incentivo_gatilho_pct: number;
  incentivo_teto: number | null;
  status: "ativa" | "concluida" | "cancelada";
}

/** Meta já com o realizado resolvido (automático ou manual) e derivados. */
export interface MetaComProgresso extends Meta {
  realizado: number;
  pct: number;
  farol: Farol;
  bonusPrevisto: number;
  periodoLabel: string;
  /** true quando o realizado veio do banco, não de lançamento manual. */
  automatico: boolean;
}

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
] as const;

export const FONTE_LABEL: Record<FonteMeta, string> = {
  manual: "Lançamento manual",
  receita: "Receita recebida (parcelas)",
  contratos: "Contratos fechados (sinal pago)",
  leads: "Leads do formulário",
  reunioes: "Reuniões realizadas",
  cac: "Custo por lead (investimento ÷ leads)",
};

export const STATUS_LABEL: Record<StatusObjetivo, string> = {
  nao_iniciado: "Não iniciado",
  em_andamento: "Em andamento",
  concluido: "Concluído",
  pausado: "Pausado",
  cancelado: "Cancelado",
};

/** Rótulo curto do período da meta: "2026", "1º sem/2026", "Março/2026". */
export function periodoLabel(m: Pick<Meta, "periodo_tipo" | "ano" | "semestre" | "mes">): string {
  if (m.periodo_tipo === "ano") return String(m.ano);
  if (m.periodo_tipo === "semestre") return `${m.semestre}º sem/${m.ano}`;
  return `${MESES[(m.mes ?? 1) - 1]}/${m.ano}`;
}

/**
 * Intervalo [início, fim) do período da meta, em ISO.
 * Fim exclusivo para a comparação ser `< fim` e não perder o último dia.
 */
export function intervaloPeriodo(
  m: Pick<Meta, "periodo_tipo" | "ano" | "semestre" | "mes">,
): { inicio: string; fim: string } {
  const iso = (ano: number, mes: number) => `${ano}-${String(mes).padStart(2, "0")}-01`;
  if (m.periodo_tipo === "ano") return { inicio: iso(m.ano, 1), fim: iso(m.ano + 1, 1) };
  if (m.periodo_tipo === "semestre") {
    return m.semestre === 1
      ? { inicio: iso(m.ano, 1), fim: iso(m.ano, 7) }
      : { inicio: iso(m.ano, 7), fim: iso(m.ano + 1, 1) };
  }
  const mes = m.mes ?? 1;
  return mes === 12
    ? { inicio: iso(m.ano, 12), fim: iso(m.ano + 1, 1) }
    : { inicio: iso(m.ano, mes), fim: iso(m.ano, mes + 1) };
}

/**
 * Percentual de atingimento.
 *
 * `menor_melhor` (CAC, custo) inverte a conta: ficar ABAIXO do alvo é bom.
 * Sem essa inversão, um CAC ótimo apareceria como meta não batida.
 */
export function calcularPct(realizado: number, alvo: number, direcao: DirecaoMeta): number {
  if (!Number.isFinite(realizado) || !Number.isFinite(alvo) || alvo === 0) return 0;
  const bruto = direcao === "menor_melhor" ? (alvo / realizado) * 100 : (realizado / alvo) * 100;
  if (!Number.isFinite(bruto)) return realizado === 0 ? 0 : 200;
  return Math.max(0, Math.round(bruto * 10) / 10);
}

/** Verde ≥ 90% · amarelo ≥ 70% · vermelho abaixo disso. */
export function farolDe(pct: number): Farol {
  if (pct >= 90) return "verde";
  if (pct >= 70) return "amarelo";
  return "vermelho";
}

/**
 * Bônus devido pela meta.
 *
 * Só paga a partir do gatilho (padrão 100% = meta cheia). `valor_fixo` paga o
 * valor cravado; `percentual_meta` paga um % do valor REALIZADO — por isso o
 * teto existe: sem ele, um mês fora da curva viraria um bônus imprevisto.
 */
export function calcularBonus(
  m: Pick<Meta, "incentivo_tipo" | "incentivo_valor" | "incentivo_gatilho_pct" | "incentivo_teto">,
  pct: number,
  realizado: number,
): number {
  if (m.incentivo_tipo === "nenhum" || !m.incentivo_valor) return 0;
  if (pct < m.incentivo_gatilho_pct) return 0;
  const bruto =
    m.incentivo_tipo === "valor_fixo"
      ? m.incentivo_valor
      : (realizado * m.incentivo_valor) / 100;
  const comTeto = m.incentivo_teto ? Math.min(bruto, m.incentivo_teto) : bruto;
  return Math.round(comTeto * 100) / 100;
}

/** Formata o valor conforme a unidade da meta. */
export function formatarValor(valor: number, unidade: UnidadeMeta): string {
  if (!Number.isFinite(valor)) return "—";
  if (unidade === "moeda") {
    return valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    });
  }
  if (unidade === "percentual") return `${valor.toLocaleString("pt-BR")}%`;
  return valor.toLocaleString("pt-BR");
}
