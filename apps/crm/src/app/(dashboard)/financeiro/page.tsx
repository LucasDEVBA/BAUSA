import { Suspense } from "react";
import Link from "next/link";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  PLAN_CONFIG,
  RECEIVABLE_STATUS_CONFIG,
  type Receivable,
  type FinancialSummary,
  type PlanType,
} from "@/types/financial";
import { fetchCancellations } from "@/lib/war-room-queries";
import { cn } from "@/lib/utils";
import { NfEditRow } from "@/components/financeiro/NfEditRow";
import { FinanceiroTabs } from "@/components/financeiro/FinanceiroTabs";
import { FinanceiroDeepLink } from "@/components/financeiro/FinanceiroDeepLink";
import { PageHeader, ScrollList, StatCard } from "@/components/ui";
import { CancelamentoActions } from "@/components/financeiro/CancelamentoActions";
import { SaidasView } from "@/components/financeiro/SaidasView";
import { FolhaView } from "@/components/financeiro/FolhaView";
import { ResultadoView } from "@/components/financeiro/ResultadoView";
import { getFinanceiroMetrics, type FinanceiroMetrics } from "@/lib/financeiro-metrics";
import {
  estadoContrato,
  faltaSemCronograma,
  formatarMoeda,
  margemAluno,
  type ParcelaParaCalculo,
} from "@/lib/financeiro/calculo.mjs";
import { dedupInvestimentos, type InvestimentoRow } from "@/lib/marketing-spend";
import { DESPESA_CATEGORIA_LABEL, type Despesa, type Colaborador, type EmpresaDados } from "@/types/financeiro";
import { ContractsExportButton, ParcelasExportButton } from "@/components/financeiro/FinanceiroExportButtons";

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Mapeia parcela Supabase para Receivable do componente
function mapParcelaToReceivable(
  p: Record<string, unknown>,
  contratoMap: Map<string, { plano: string | null; atletaNome: string }>
): Receivable {
  const contrato = contratoMap.get(p.contrato_id as string);
  const status = p.status as string;
  const vencimento = p.vencimento as string;
  const hoje = new Date().toISOString().split("T")[0];

  // Se previsto e vencida, marcar como atrasado visualmente
  const effectiveStatus = (status === "previsto" && vencimento < hoje) ? "atrasado" : status;

  return {
    id: p.id as string,
    contract_id: (p.contrato_id as string) ?? "",
    client_name: contrato?.atletaNome ?? "Cliente",
    plan: planoDoContrato(contrato?.plano ?? null),
    description: (p.numero_parcela as string) ?? "Parcela",
    installment: 0,
    total_installments: 0,
    amount: Number(p.valor) || 0,
    due_date: vencimento ?? "",
    paid_at: (p.recebido_at as string) ?? undefined,
    status: effectiveStatus as Receivable["status"],
  };
}

function ReceivableRow({ rec, dealId }: { rec: Receivable; dealId?: string | null }) {
  const statusCfg = RECEIVABLE_STATUS_CONFIG[rec.status];
  const planCfg = PLAN_CONFIG[rec.plan];
  const dueDate = new Date(rec.due_date);
  const isOverdue = rec.status === "atrasado";

  return (
    <tr
      data-deal-id={dealId ?? undefined}
      className={cn("border-b border-border transition-colors hover:bg-accent", isOverdue && "bg-sys-red/5")}
    >
      <td className="py-3 pl-4 pr-3">
        <p className="text-sm font-medium text-foreground">{rec.client_name}</p>
        <p className="text-xs text-muted-foreground">{rec.description}</p>
      </td>
      <td className="px-3 py-3">
        <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold", planCfg.bg, planCfg.color)}>
          {rec.plan}
        </span>
      </td>
      <td className="px-3 py-3 text-sm font-semibold text-foreground">{formatBRL(rec.amount)}</td>
      <td className="px-3 py-3 text-sm text-muted-foreground">
        {dueDate.toLocaleDateString("pt-BR")}
      </td>
      <td className="px-3 py-3">
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium", statusCfg.bg, statusCfg.color)}>
          {rec.status === "recebido" && <CheckCircle className="h-2.5 w-2.5" />}
          {rec.status === "atrasado" && <AlertTriangle className="h-2.5 w-2.5" />}
          {rec.status === "previsto" && <Clock className="h-2.5 w-2.5" />}
          {statusCfg.label}
        </span>
      </td>
    </tr>
  );
}

const MOTIVO_PERDA_LABELS: Record<string, string> = {
  financeiro: "Financeiro",
  timing: "Timing",
  desistencia_familia: "Desistencia da familia",
  atleta_nao_qualificado: "Atleta nao qualificado",
  concorrencia: "Concorrencia",
  outro: "Outro",
};

const PLANO_TIPO: Record<string, PlanType> = {
  journey: "Journey",
  legacy: "Legacy",
  start: "Start",
  personalizado: "Personalizado",
};

/** null = contrato aguardando plano (só o sinal — T11). */
function planoDoContrato(plano: string | null): PlanType {
  if (!plano) return "A definir";
  return PLANO_TIPO[plano] ?? "Personalizado";
}

// Preço de tabela = valor_base_plano (gravado pela RPC na escolha do plano);
// total diferente dele = itens/desconto/sinal à parte, todos com justificativa.
function isCustomizado(c: ContractWithNf): boolean {
  if (c.valor_customizado != null) return true;
  return c.valor_base_plano != null && c.valor_total !== c.valor_base_plano;
}

interface CustoDoAluno {
  valor: number;
  categoria: string;
  status: string;
}

/**
 * Margem DIRETA real (T18b): receita contratada − custos lançados do aluno
 * (despesas.contrato_id) − psicóloga estimada se ainda não lançada. Sem rateio
 * de custo fixo — os números inventados (custo fixo/variável por cliente)
 * saíram. Contrato aguardando plano não tem receita definida → null ("—").
 */
function margemDireta(c: ContractWithNf, custos: CustoDoAluno[]): { margem: number; margemPct: number | null } | null {
  if (c.plano === null) return null;
  const m = margemAluno({
    valorTotal: c.valor_total,
    custos,
    incluiPsicologa: c.inclui_psicologa,
    custoPsicologa: c.custo_psicologa,
  });
  return { margem: m.margem, margemPct: m.margemPct };
}

const MARGEM_DIRETA_AJUDA =
  "Receita contratada − custos lançados do aluno − psicóloga estimada (se não lançada). Sem rateio de custos fixos.";

function classeMargem(pct: number): string {
  if (pct >= 50) return "border-sys-green/20 bg-sys-green/10 text-sys-green";
  if (pct >= 30) return "border-sys-orange/20 bg-sys-orange/10 text-sys-orange";
  return "border-sys-red/20 bg-sys-red/10 text-sys-red";
}

interface ContractWithNf {
  id: string;
  atletaNome: string;
  /** null = aguardando plano. */
  plano: string | null;
  valor_total: number;
  valor_base_plano: number | null;
  valor_customizado: number | null;
  justificativa_customizacao: string | null;
  inclui_psicologa: boolean;
  custo_psicologa: number | null;
  nf_status: "pendente" | "emitida" | "nao_aplicavel";
  nf_numero: string | null;
  nf_emitida_at: string | null;
  nf_valor: number | null;
  entrada_paga: boolean;
}

interface PageProps {
  searchParams: Promise<{ tab?: string; deal?: string }>;
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  // Defense-in-depth: a nav esconde o link de quem não é CEO/CTO, mas a página
  // abria pela URL (e Saídas/Folha não dependem só da RLS de contratos).
  await requirePapel("ceo");
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const activeTab = params.tab || "geral";
  const mesAtual = new Date().toISOString().slice(0, 7);

  // Buscar contratos com deal + atleta para pegar nomes
  const { data: rawContratos } = await supabase
    .from("contratos_financeiros")
    .select("id, deal_id, plano, valor_total, valor_base_plano, custo_psicologa, valor_customizado, justificativa_customizacao, inclui_psicologa, nf_status, nf_numero, nf_emitida_at, nf_valor, entrada_paga, forma_pagamento_plano, deals:deal_id(atleta:atletas(nome_completo))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Mapa contrato_id -> { plano, atletaNome, deal_id }
  const contratoMap = new Map<
    string,
    { plano: string | null; atletaNome: string; deal_id: string | null }
  >();
  const contractsWithNf: ContractWithNf[] = [];

  for (const c of rawContratos ?? []) {
    const rawDeal = c.deals as unknown;
    const deal = (Array.isArray(rawDeal) ? rawDeal[0] : rawDeal) as Record<string, unknown> | null;
    const rawAtleta = deal?.atleta as unknown;
    const atleta = (Array.isArray(rawAtleta) ? rawAtleta[0] : rawAtleta) as Record<string, unknown> | null;
    const atletaNome = (atleta?.nome_completo as string) ?? "Cliente";

    contratoMap.set(c.id as string, {
      plano: (c.plano as string | null) ?? null,
      atletaNome,
      deal_id: (c.deal_id as string) ?? null,
    });

    contractsWithNf.push({
      id: c.id as string,
      atletaNome,
      plano: (c.plano as string | null) ?? null,
      valor_total: Number(c.valor_total) || 0,
      valor_base_plano: c.valor_base_plano != null ? Number(c.valor_base_plano) : null,
      valor_customizado: c.valor_customizado != null ? Number(c.valor_customizado) : null,
      justificativa_customizacao: (c.justificativa_customizacao as string | null) ?? null,
      inclui_psicologa: (c.inclui_psicologa as boolean) ?? false,
      custo_psicologa: c.custo_psicologa != null ? Number(c.custo_psicologa) : null,
      nf_status: (c.nf_status as ContractWithNf["nf_status"]) ?? "nao_aplicavel",
      nf_numero: c.nf_numero as string | null,
      nf_emitida_at: c.nf_emitida_at as string | null,
      nf_valor: c.nf_valor as number | null,
      entrada_paga: (c.entrada_paga as boolean) ?? false,
    });
  }

  // Buscar todas as parcelas
  const { data: rawParcelas } = await supabase
    .from("parcelas")
    .select("id, contrato_id, tipo, valor, vencimento, status, metodo, numero_parcela, recebido_at")
    .is("deleted_at", null)
    .order("vencimento", { ascending: true });

  const parcelasPorContrato = new Map<string, ParcelaParaCalculo[]>();
  for (const p of rawParcelas ?? []) {
    const lista = parcelasPorContrato.get(p.contrato_id as string) ?? [];
    lista.push({
      tipo: p.tipo === "entrada" || p.tipo === "saldo" ? p.tipo : undefined,
      valor: Number(p.valor) || 0,
      status: p.status as ParcelaParaCalculo["status"],
      vencimento: p.vencimento as string,
    });
    parcelasPorContrato.set(p.contrato_id as string, lista);
  }

  // Saldo sem parcelas que o cubram (T9): a régua não cobra o que não existe,
  // então o buraco precisa aparecer para alguém montar o cronograma.
  const condicoesPendentes = contractsWithNf
    .map((c) => {
      const parcelas = parcelasPorContrato.get(c.id) ?? [];
      const contrato = { plano: c.plano, valor_total: c.valor_total };
      if (estadoContrato(contrato, parcelas) !== "condicoes_pendentes") return null;
      // Mesma regra da aba do contrato (tolera centavos de arredondamento legado).
      return { id: c.id, atletaNome: c.atletaNome, semParcela: faltaSemCronograma(contrato, parcelas) };
    })
    .filter((c): c is { id: string; atletaNome: string; semParcela: number } => c !== null && c.semParcela > 0);
  const totalSemParcela = condicoesPendentes.reduce((s, c) => s + c.semParcela, 0);

  const receivables: Receivable[] = (rawParcelas ?? []).map((p) =>
    mapParcelaToReceivable(p as Record<string, unknown>, contratoMap)
  );

  // Receita recebida no mes
  const receitaRecebidaMes = (rawParcelas ?? [])
    .filter((p) => p.status === "recebido" && (p.recebido_at as string)?.startsWith(mesAtual))
    .reduce((s, p) => s + Number(p.valor), 0);

  // Calculos
  const overdueReceivables = receivables.filter((r) => r.status === "atrasado");
  const upcomingReceivables = receivables
    .filter((r) => r.status === "previsto")
    .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

  const totalReceivable = upcomingReceivables.reduce((s, r) => s + r.amount, 0);
  const totalOverdue = overdueReceivables.reduce((s, r) => s + r.amount, 0);
  const totalReceived = receivables.filter((r) => r.status === "recebido").reduce((s, r) => s + r.amount, 0);

  // Custos fixos REAIS (folha ativa + despesas recorrentes ativas + marketing) — Visão Geral.
  // Substitui os arrays hardcoded; fonte única. Marketing vem de
  // investimentos_marketing (mesma fonte do CAC e do DRE), NÃO de despesas.
  let folhaMensal = 0;
  let marketingMensal = 0;
  const custosRecorrentes: { nome: string; valor: number; categoria: string }[] = [];
  const custosPorContrato = new Map<string, CustoDoAluno[]>();
  if (activeTab === "geral") {
    const [colabRes, recorrRes, mktRes, custosAlunoRes] = await Promise.all([
      supabase.from("colaboradores").select("custo_mensal_brl").eq("ativo", true).is("deleted_at", null),
      supabase
        .from("despesas")
        .select("descricao, valor_brl, categoria")
        .eq("recorrente", true)
        .eq("recorrencia_ativa", true)
        .neq("categoria", "marketing")
        .is("deleted_at", null),
      supabase
        .from("investimentos_marketing")
        .select("mes, canal, valor_gasto, source")
        .eq("mes", `${mesAtual}-01`)
        .is("deleted_at", null),
      // Custos internos por aluno (T18b) — base da "Margem direta".
      supabase
        .from("despesas")
        .select("contrato_id, valor_brl, categoria, status")
        .not("contrato_id", "is", null)
        .is("deleted_at", null),
    ]);
    for (const d of custosAlunoRes.data ?? []) {
      const id = d.contrato_id as string;
      const lista = custosPorContrato.get(id) ?? [];
      lista.push({ valor: Number(d.valor_brl) || 0, categoria: d.categoria as string, status: d.status as string });
      custosPorContrato.set(id, lista);
    }
    folhaMensal = (colabRes.data ?? []).reduce((s, c) => s + Number(c.custo_mensal_brl), 0);
    marketingMensal = dedupInvestimentos((mktRes.data as InvestimentoRow[] | null) ?? [])
      .reduce((s, m) => s + Number(m.valor_gasto), 0);
    for (const r of recorrRes.data ?? []) {
      custosRecorrentes.push({ nome: r.descricao as string, valor: Number(r.valor_brl), categoria: r.categoria as string });
    }
  }
  const totalRecorrentes = custosRecorrentes.reduce((s, c) => s + c.valor, 0) + marketingMensal;
  const totalFixedCosts = folhaMensal + totalRecorrentes;

  const netMarginPct = receitaRecebidaMes > 0
    ? Math.round(((receitaRecebidaMes - totalFixedCosts) / receitaRecebidaMes) * 100)
    : 100;

  // Contratos por plano
  const contractsByPlan: Record<PlanType, number> = { Legacy: 0, Journey: 0, Start: 0, Personalizado: 0, "A definir": 0 };
  for (const c of contractsWithNf) contractsByPlan[planoDoContrato(c.plano)]++;

  const margens = new Map(contractsWithNf.map((c) => [c.id, margemDireta(c, custosPorContrato.get(c.id) ?? [])]));

  const summary: FinancialSummary = {
    mrr_brl: receitaRecebidaMes,
    total_received_brl: totalReceived,
    total_receivable_brl: totalReceivable,
    overdue_brl: totalOverdue,
    fixed_costs_monthly: totalFixedCosts,
    variable_costs_monthly: 0,
    net_margin_pct: netMarginPct,
  };

  // NFs pendentes (filtro)
  const nfPendentes = contractsWithNf.filter((c) => c.nf_status === "pendente" && c.entrada_paga);

  // Cancelamentos
  const cancellations = activeTab === "cancelamentos" ? await fetchCancellations() : [];

  // Saídas / Folha (abas novas — só busca quando a aba está ativa)
  const despesas: Despesa[] =
    activeTab === "saidas"
      ? (((
          await supabase
            .from("despesas")
            .select("*")
            .is("deleted_at", null)
            .order("competencia", { ascending: false })
            .order("created_at", { ascending: false })
        ).data as Despesa[] | null) ?? [])
      : [];

  const colaboradores: Colaborador[] =
    activeTab === "folha"
      ? (((
          await supabase
            .from("colaboradores")
            .select("*")
            .is("deleted_at", null)
            .order("ativo", { ascending: false })
            .order("nome", { ascending: true })
        ).data as Colaborador[] | null) ?? [])
      : [];

  // Resultado (DRE + fluxo de caixa) — só busca quando a aba está ativa
  const metrics: FinanceiroMetrics | null =
    activeTab === "resultado" ? await getFinanceiroMetrics() : null;

  // Dados da empresa (pagador) para recibos — usado nas abas Saídas e Folha
  const EMPRESA_FALLBACK: EmpresaDados = { razao_social: "Bolsa Atleta USA", cnpj: "", cidade: "" };
  const empresa: EmpresaDados =
    activeTab === "folha" || activeTab === "saidas"
      ? (((
          await supabase
            .from("configuracoes_sistema")
            .select("valor")
            .eq("chave", "empresa_dados")
            .maybeSingle()
        ).data?.valor as EmpresaDados | undefined) ?? EMPRESA_FALLBACK)
      : EMPRESA_FALLBACK;

  return (
    <div className="space-y-5">
      <PageHeader dense
        eyebrow="Comercial"
        title="Gestão Financeira"
        description="Entradas, saídas, folha e resultado (DRE)"
      />

      <FinanceiroDeepLink targetDeal={params.deal} />

      <Suspense fallback={null}>
        <FinanceiroTabs />
      </Suspense>

      {/* Tab: Resultado (DRE + Fluxo de caixa) */}
      {activeTab === "resultado" && metrics && <ResultadoView metrics={metrics} />}

      {/* Tab: Saídas */}
      {activeTab === "saidas" && <SaidasView despesas={despesas} empresa={empresa} />}

      {/* Tab: Folha */}
      {activeTab === "folha" && <FolhaView colaboradores={colaboradores} empresa={empresa} />}

      {/* Tab: NFs Pendentes */}
      {activeTab === "nf_pendentes" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-sys-orange" />
              <p className="text-sm font-semibold text-sys-orange">
                {nfPendentes.length} NF{nfPendentes.length !== 1 ? "s" : ""} pendente{nfPendentes.length !== 1 ? "s" : ""} com entrada paga
              </p>
            </div>
          </div>

          <div className="border border-border/70 bg-card/60 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-popover">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Cliente</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Plano</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Valor</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">NF Status</th>
                </tr>
              </thead>
              <tbody>
                {nfPendentes.map((c) => {
                  const plano = planoDoContrato(c.plano);
                  const planCfg = PLAN_CONFIG[plano];
                  return (
                    <tr key={c.id} className="border-b border-border transition-colors hover:bg-accent">
                      <td className="py-3 pl-4 pr-3">
                        <p className="text-sm font-medium text-foreground">{c.atletaNome}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold", planCfg.bg, planCfg.color)}>
                          {plano}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-foreground">
                        {c.plano === null ? `Sinal ${formatBRL(c.valor_total)}` : formatBRL(c.valor_total)}
                      </td>
                      <td className="px-3 py-3">
                        <NfEditRow
                          contractId={c.id}
                          nfStatus={c.nf_status}
                          nfNumero={c.nf_numero}
                          nfEmitidaAt={c.nf_emitida_at}
                          nfValor={c.nf_valor}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {nfPendentes.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto h-8 w-8 text-sys-green/50" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhuma NF pendente com entrada paga.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Cancelamentos */}
      {activeTab === "cancelamentos" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-sys-red/20 bg-sys-red/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-sys-red" />
              <p className="text-sm font-semibold text-sys-red">
                {cancellations.length} cancelamento{cancellations.length !== 1 ? "s" : ""} / perda{cancellations.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="border border-border/70 bg-card/60 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-popover">
                  <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Atleta</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Valor</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Motivo</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Data</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Status</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Reativacao</th>
                  <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Acoes</th>
                </tr>
              </thead>
              <tbody>
                {cancellations.map((c) => (
                  <tr
                    key={c.id}
                    data-deal-id={c.id}
                    className="border-b border-border transition-colors hover:bg-accent"
                  >
                    <td className="py-3 pl-4 pr-3">
                      <p className="text-sm font-medium text-foreground">{c.athlete_name}</p>
                    </td>
                    <td className="px-3 py-3 text-sm font-semibold text-foreground">
                      {c.valor_estimado > 0 ? formatBRL(c.valor_estimado) : "—"}
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-muted-foreground">
                        {c.motivo_perda ? MOTIVO_PERDA_LABELS[c.motivo_perda] || c.motivo_perda : "Nao informado"}
                      </p>
                      {c.detalhe_perda && (
                        <p className="text-[10px] text-label-tertiary mt-0.5 truncate max-w-[200px]">{c.detalhe_perda}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {new Date(c.updated_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        c.etapa === "cancelamento_solicitado"
                          ? "bg-sys-orange/10 border-sys-orange/20 text-sys-orange"
                          : "bg-sys-red/10 border-sys-red/20 text-sys-red"
                      )}>
                        {c.etapa === "cancelamento_solicitado" ? "Cancelamento" : "Perdido"}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      {c.pode_reativar ? (
                        <div className="flex items-center gap-1">
                          <RotateCcw className="h-3 w-3 text-sys-green" />
                          <span className="text-[10px] text-sys-green">
                            {c.data_reativacao
                              ? new Date(c.data_reativacao).toLocaleDateString("pt-BR")
                              : "Possivel"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-label-tertiary">Nao</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {c.etapa === "cancelamento_solicitado" && (
                        <CancelamentoActions dealId={c.id} atletaNome={c.athlete_name} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cancellations.length === 0 && (
              <div className="text-center py-8">
                <CheckCircle className="mx-auto h-8 w-8 text-sys-green/50" />
                <p className="mt-2 text-sm text-muted-foreground">Nenhum cancelamento ou perda registrado.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab: Visao Geral (default) */}
      {activeTab === "geral" && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Receita recebida"
              value={formatBRL(summary.total_received_brl)}
              icon={CheckCircle}
              accent="green"
              context="total acumulado"
            />
            <StatCard
              label="A receber"
              value={formatBRL(summary.total_receivable_brl)}
              icon={Clock}
              accent="blue"
              context="em aberto"
            />
            <StatCard
              label="Em atraso"
              value={formatBRL(summary.overdue_brl)}
              icon={AlertTriangle}
              accent="red"
              context={`${overdueReceivables.length} parcela${overdueReceivables.length !== 1 ? "s" : ""}`}
            />
            <StatCard
              label="Margem líquida"
              value={`${summary.net_margin_pct}%`}
              icon={TrendingUp}
              accent="burgundy"
              context="após custos fixos"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Planos contratados */}
            <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 flex flex-col h-[18rem]">
              <h2 className="mb-4 text-sm font-semibold text-foreground shrink-0">Planos Ativos</h2>
              <ScrollList className="space-y-3">
                {(["Legacy", "Journey", "Start"] as const).map((plan) => {
                  const cfg = PLAN_CONFIG[plan];
                  const count = contractsByPlan[plan];
                  return (
                    <div key={plan} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold", cfg.bg, cfg.color)}>
                            {plan}
                          </span>
                          <span className="text-xs text-muted-foreground">{count} contrato{count !== 1 ? "s" : ""}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">{formatBRL(cfg.price)}</span>
                      </div>
                      <p className="text-[10px] text-label-tertiary">{cfg.description}</p>
                      <div className="flex gap-2 text-[10px] text-label-tertiary">
                        <span>Pix: {formatBRL(cfg.pix_price)}</span>
                        <span>-</span>
                        <span>Sinal: {formatBRL(cfg.signal)}</span>
                      </div>
                    </div>
                  );
                })}
                {contractsByPlan["A definir"] > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <span className={cn("rounded-md border px-2 py-0.5 text-[10px] font-bold", PLAN_CONFIG["A definir"].bg, PLAN_CONFIG["A definir"].color)}>
                      Aguardando plano
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {contractsByPlan["A definir"]} contrato{contractsByPlan["A definir"] !== 1 ? "s" : ""} só com o sinal
                    </span>
                  </div>
                )}
              </ScrollList>
            </div>

            {/* Custos fixos mensais — dados reais (folha + despesas recorrentes) */}
            <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 flex flex-col h-[20rem]">
              <div className="mb-4 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Custos Fixos Mensais</h2>
                <span className="text-sm font-bold text-sys-red">{formatBRL(totalFixedCosts)}</span>
              </div>
              <ScrollList className="space-y-2">
                {folhaMensal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">Folha (equipe)</p>
                    <p className="flex-shrink-0 text-xs font-semibold text-foreground">{formatBRL(folhaMensal)}</p>
                  </div>
                )}
                {marketingMensal > 0 && (
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      Marketing (mídia)
                      <span className="ml-1.5 text-[10px] text-label-tertiary">de Analytics/CAC</span>
                    </p>
                    <p className="flex-shrink-0 text-xs font-semibold text-foreground">{formatBRL(marketingMensal)}</p>
                  </div>
                )}
                {custosRecorrentes.map((c) => (
                  <div key={c.nome} className="flex items-center justify-between gap-2">
                    <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                      {c.nome}
                      <span className="ml-1.5 text-[10px] text-label-tertiary">
                        {(DESPESA_CATEGORIA_LABEL as Record<string, string>)[c.categoria] ?? c.categoria}
                      </span>
                    </p>
                    <p className="flex-shrink-0 text-xs font-semibold text-foreground">{formatBRL(c.valor)}</p>
                  </div>
                ))}
                {totalFixedCosts === 0 && (
                  <p className="text-xs text-label-tertiary">
                    Nenhum custo fixo cadastrado. Adicione na aba <strong>Saídas</strong> e <strong>Folha</strong>.
                  </p>
                )}
              </ScrollList>
            </div>

            {/* Alertas de recebiveis */}
            <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 flex flex-col h-[24rem]">
              <h2 className="mb-4 text-sm font-semibold text-foreground shrink-0">Alertas de Recebimento</h2>

              <ScrollList>
                {overdueReceivables.length > 0 && (
                  <div className="mb-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-sys-red">
                      Em Atraso ({overdueReceivables.length})
                    </p>
                    <div className="space-y-2">
                      {overdueReceivables.map((r) => (
                        <div key={r.id} className="rounded-lg border border-sys-red/20 bg-sys-red/5 p-2.5">
                          <p className="text-xs font-medium text-foreground">{r.client_name}</p>
                          <p className="text-[10px] text-muted-foreground">{r.description}</p>
                          <p className="mt-1 text-xs font-semibold text-sys-red">{formatBRL(r.amount)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">
                    Proximos vencimentos
                  </p>
                  <div className="space-y-2">
                    {upcomingReceivables.slice(0, 5).map((r) => (
                      <div key={r.id} className="flex items-center justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{r.client_name}</p>
                          <p className="text-[10px] text-label-tertiary">{new Date(r.due_date).toLocaleDateString("pt-BR")}</p>
                        </div>
                        <p className="text-xs font-semibold text-foreground flex-shrink-0">{formatBRL(r.amount)}</p>
                      </div>
                    ))}
                    {upcomingReceivables.length === 0 && (
                      <p className="text-xs text-label-tertiary">Nenhum vencimento proximo.</p>
                    )}
                  </div>
                </div>
              </ScrollList>
            </div>
          </div>

          {condicoesPendentes.length > 0 && (
            <div role="status" className="rounded-xl border border-sys-orange/20 bg-sys-orange/5 px-4 py-3">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sys-orange" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-sys-orange">
                    {condicoesPendentes.length} contrato{condicoesPendentes.length !== 1 ? "s" : ""} com saldo sem parcelas (condições pendentes): {formatarMoeda(totalSemParcela)}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    A régua não cobra o que não tem parcela. Monte o cronograma em:{" "}
                    {condicoesPendentes.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && ", "}
                        <Link href={`/contratos/${c.id}`} className="font-medium text-foreground underline-offset-2 hover:underline">
                          {c.atletaNome}
                        </Link>
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Contratos com NF Status + Margem direta */}
          <div className="border border-border/70 bg-card/60 rounded-xl overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Contratos — Controle de NF e Rentabilidade</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{contractsWithNf.length} contratos registrados</p>
                </div>
                <ContractsExportButton
                  contracts={contractsWithNf.map((c) => ({ ...c, plano: planoDoContrato(c.plano) }))}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-popover">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Cliente</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Plano</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Valor Total</th>
                    <th
                      className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary"
                      title={MARGEM_DIRETA_AJUDA}
                    >
                      Margem direta
                    </th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Margem</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Entrada</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">NF</th>
                  </tr>
                </thead>
                <tbody>
                  {contractsWithNf.slice(0, 20).map((c) => {
                    const plano = planoDoContrato(c.plano);
                    const pCfg = PLAN_CONFIG[plano];
                    const custom = isCustomizado(c);
                    const margem = margens.get(c.id) ?? null;
                    return (
                      <tr key={c.id} className="border-b border-border transition-colors hover:bg-accent">
                        <td className="py-3 pl-4 pr-3">
                          <p className="text-sm font-medium text-foreground">{c.atletaNome}</p>
                          {custom && (
                            <span
                              className="mt-0.5 inline-flex items-center gap-1 rounded-md border border-sys-orange/20 bg-sys-orange/10 px-1.5 py-0.5 text-[9px] font-semibold text-sys-orange cursor-help"
                              title={c.justificativa_customizacao ?? "Valor difere do plano padrao"}
                            >
                              <AlertTriangle className="h-2.5 w-2.5" />
                              Valores customizados
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold", pCfg.bg, pCfg.color)}>
                            {c.plano === null ? "Aguardando plano" : plano}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-foreground">
                          {c.plano === null ? `Sinal ${formatBRL(c.valor_total)}` : formatBRL(c.valor_total)}
                        </td>
                        <td
                          className={cn(
                            "px-3 py-3 text-sm font-semibold",
                            margem === null ? "text-label-tertiary" : margem.margem >= 0 ? "text-sys-green" : "text-sys-red",
                          )}
                        >
                          {margem === null ? "—" : formatBRL(margem.margem)}
                        </td>
                        <td className="px-3 py-3">
                          {margem?.margemPct != null ? (
                            <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold", classeMargem(margem.margemPct))}>
                              {margem.margemPct}%
                            </span>
                          ) : (
                            <span className="text-xs text-label-tertiary">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-medium",
                            c.entrada_paga
                              ? "bg-sys-green/10 border-sys-green/20 text-sys-green"
                              : "bg-secondary border-border text-muted-foreground"
                          )}>
                            {c.entrada_paga ? "Paga" : "Pendente"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <NfEditRow
                            contractId={c.id}
                            nfStatus={c.nf_status}
                            nfNumero={c.nf_numero}
                            nfEmitidaAt={c.nf_emitida_at}
                            nfValor={c.nf_valor}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {/* Margem média: só contratos com plano (aguardando plano = "—", fora da média) */}
                  {(() => {
                    const comMargem = contractsWithNf
                      .map((c) => margens.get(c.id) ?? null)
                      .filter((m): m is { margem: number; margemPct: number } => m !== null && m.margemPct !== null);
                    if (comMargem.length === 0) return null;
                    const avgMargin = Math.round(comMargem.reduce((s, m) => s + m.margemPct, 0) / comMargem.length);
                    const totalMargem = comMargem.reduce((s, m) => s + m.margem, 0);
                    return (
                      <tr className="border-t-2 border-primary/30 bg-popover">
                        <td colSpan={3} className="py-3 pl-4 pr-3 text-xs font-bold text-foreground">
                          Margem direta média (contratos com plano)
                        </td>
                        <td className={cn("px-3 py-3 text-sm font-bold", totalMargem >= 0 ? "text-sys-green" : "text-sys-red")}>
                          {formatBRL(totalMargem)}
                        </td>
                        <td className="px-3 py-3">
                          <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold", classeMargem(avgMargin))}>
                            {avgMargin}%
                          </span>
                        </td>
                        <td colSpan={2} />
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
              {contractsWithNf.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-sm text-muted-foreground">Nenhum contrato registrado.</p>
                </div>
              )}
            </div>
          </div>

          {/* Agenda de recebiveis completa */}
          <div className="border border-border/70 bg-card/60 rounded-xl overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Agenda de Recebiveis</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{receivables.length} lancamentos no periodo</p>
                </div>
                <ParcelasExportButton
                  parcelas={receivables.map((r) => ({
                    client_name: r.client_name,
                    description: r.description,
                    amount: r.amount,
                    due_date: r.due_date,
                    status: r.status,
                    paid_at: r.paid_at,
                  }))}
                />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-popover">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Cliente</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Plano</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Valor</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Vencimento</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {receivables
                    .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime())
                    .slice(0, 30)
                    .map((rec) => (
                      <ReceivableRow
                        key={rec.id}
                        rec={rec}
                        dealId={contratoMap.get(rec.contract_id)?.deal_id ?? null}
                      />
                    ))}
                </tbody>
              </table>
            </div>
            {receivables.length === 0 && (
              <div className="text-center py-8">
                <p className="text-sm text-muted-foreground">Nenhuma parcela registrada.</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
