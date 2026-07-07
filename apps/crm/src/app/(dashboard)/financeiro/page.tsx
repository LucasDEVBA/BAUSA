import { Suspense } from "react";
import {
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  XCircle,
  RotateCcw,
} from "lucide-react";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  PLAN_CONFIG,
  RECEIVABLE_STATUS_CONFIG,
  type Receivable,
  type FixedCost,
  type VariableCost,
  type FinancialSummary,
  type PlanType,
} from "@/types/financial";
import { fetchCancellations } from "@/lib/war-room-queries";
import { cn } from "@/lib/utils";
import { NfEditRow } from "@/components/financeiro/NfEditRow";
import { FinanceiroTabs } from "@/components/financeiro/FinanceiroTabs";
import { PageHeader, ScrollList, StatCard } from "@/components/ui";
import { CancelamentoActions } from "@/components/financeiro/CancelamentoActions";
import { SaidasView } from "@/components/financeiro/SaidasView";
import { FolhaView } from "@/components/financeiro/FolhaView";
import { PLANO_VALORES } from "@/types/crm";
import type { Despesa, Colaborador } from "@/types/financeiro";
import { ContractsExportButton, ParcelasExportButton } from "@/components/financeiro/FinanceiroExportButtons";

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// Mapeia parcela Supabase para Receivable do componente
function mapParcelaToReceivable(
  p: Record<string, unknown>,
  contratoMap: Map<string, { plano: string; atletaNome: string }>
): Receivable {
  const contrato = contratoMap.get(p.contrato_id as string);
  const status = p.status as string;
  const vencimento = p.vencimento as string;
  const hoje = new Date().toISOString().split("T")[0];

  // Se previsto e vencida, marcar como atrasado visualmente
  const effectiveStatus = (status === "previsto" && vencimento < hoje) ? "atrasado" : status;

  const planMap: Record<string, PlanType> = {
    journey: "Journey",
    legacy: "Legacy",
    start: "Start",
  };

  return {
    id: p.id as string,
    contract_id: (p.contrato_id as string) ?? "",
    client_name: contrato?.atletaNome ?? "Cliente",
    plan: planMap[contrato?.plano ?? ""] ?? "Journey",
    description: (p.numero_parcela as string) ?? "Parcela",
    installment: 0,
    total_installments: 0,
    amount: Number(p.valor) || 0,
    due_date: vencimento ?? "",
    paid_at: (p.recebido_at as string) ?? undefined,
    status: effectiveStatus as Receivable["status"],
  };
}

function ReceivableRow({ rec }: { rec: Receivable }) {
  const statusCfg = RECEIVABLE_STATUS_CONFIG[rec.status];
  const planCfg = PLAN_CONFIG[rec.plan];
  const dueDate = new Date(rec.due_date);
  const isOverdue = rec.status === "atrasado";

  return (
    <tr className={cn("border-b border-border transition-colors hover:bg-accent", isOverdue && "bg-sys-red/5")}>
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

// Custos fixos definidos pela regra de negocio (configuracoes_sistema ou hardcoded)
const FIXED_COSTS: FixedCost[] = [
  { id: "fc1", name: "Head de Sucesso e Experiencia da Familia", amount_monthly: 4500, active: true },
  { id: "fc2", name: "IA (ferramentas e licencas)", amount_monthly: 800, active: true },
  { id: "fc3", name: "Designer", amount_monthly: 2200, active: true },
  { id: "fc4", name: "Infraestrutura (sistema, dominio, cloud)", amount_monthly: 350, active: true },
  { id: "fc5", name: "Marketing e Trafego Pago", amount_monthly: 3000, active: true },
  { id: "fc6", name: "Outros custos fixos", amount_monthly: 1200, active: true },
];

const VARIABLE_COSTS: VariableCost[] = [
  { id: "vc1", plan: "Journey", name: "Psicologa Intercultural", amount: 1200 },
  { id: "vc2", plan: "Legacy", name: "Psicologa Intercultural", amount: 1200 },
  { id: "vc3", plan: "Legacy", name: "Suporte VIP Adicional", amount: 800 },
];

const MOTIVO_PERDA_LABELS: Record<string, string> = {
  financeiro: "Financeiro",
  timing: "Timing",
  desistencia_familia: "Desistencia da familia",
  atleta_nao_qualificado: "Atleta nao qualificado",
  concorrencia: "Concorrencia",
  outro: "Outro",
};

// Constantes de custo para calculo de lucro por cliente
const CUSTO_FIXO_MENSAL = 12050;
const MESES_PROCESSO = 3;
const CLIENTES_BASE = 6;
const CUSTO_FIXO_POR_CLIENTE = Math.round((CUSTO_FIXO_MENSAL * MESES_PROCESSO) / CLIENTES_BASE);
const CUSTO_VARIAVEL_JOURNEY_LEGACY = 2000;
const CUSTO_VARIAVEL_START = 1500;
const CUSTO_PSICOLOGA = 1200;

function isCustomizado(c: ContractWithNf): boolean {
  if (c.valor_customizado != null && c.valor_customizado > 0) return true;
  const planoKey = c.plano as keyof typeof PLANO_VALORES;
  const config = PLANO_VALORES[planoKey];
  if (!config) return false;
  return c.valor_total !== config.padrao && c.valor_total !== config.pix;
}

function calcularLucro(c: ContractWithNf): { lucro: number; margem: number } {
  const custoFixo = CUSTO_FIXO_POR_CLIENTE;
  const custoVariavel = c.plano === "start" ? CUSTO_VARIAVEL_START : CUSTO_VARIAVEL_JOURNEY_LEGACY;
  const custoPsicologa = c.inclui_psicologa ? CUSTO_PSICOLOGA : 0;
  const custoTotal = custoFixo + custoVariavel + custoPsicologa;
  const lucro = c.valor_total - custoTotal;
  const margem = c.valor_total > 0 ? Math.round((lucro / c.valor_total) * 100) : 0;
  return { lucro, margem };
}

interface ContractWithNf {
  id: string;
  atletaNome: string;
  plano: string;
  valor_total: number;
  valor_customizado: number | null;
  justificativa_customizacao: string | null;
  inclui_psicologa: boolean;
  nf_status: "pendente" | "emitida" | "nao_aplicavel";
  nf_numero: string | null;
  nf_emitida_at: string | null;
  nf_valor: number | null;
  entrada_paga: boolean;
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function FinanceiroPage({ searchParams }: PageProps) {
  const supabase = await createServerSupabaseClient();
  const params = await searchParams;
  const activeTab = params.tab || "geral";
  const mesAtual = new Date().toISOString().slice(0, 7);

  // Buscar contratos com deal + atleta para pegar nomes
  const { data: rawContratos } = await supabase
    .from("contratos_financeiros")
    .select("id, deal_id, plano, valor_total, valor_customizado, justificativa_customizacao, inclui_psicologa, nf_status, nf_numero, nf_emitida_at, nf_valor, entrada_paga, forma_pagamento_plano, deals:deal_id(atleta:atletas(nome_completo))")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  // Mapa contrato_id -> { plano, atletaNome }
  const contratoMap = new Map<string, { plano: string; atletaNome: string }>();
  const contractsWithNf: ContractWithNf[] = [];

  for (const c of rawContratos ?? []) {
    const rawDeal = c.deals as unknown;
    const deal = (Array.isArray(rawDeal) ? rawDeal[0] : rawDeal) as Record<string, unknown> | null;
    const rawAtleta = deal?.atleta as unknown;
    const atleta = (Array.isArray(rawAtleta) ? rawAtleta[0] : rawAtleta) as Record<string, unknown> | null;
    const atletaNome = (atleta?.nome_completo as string) ?? "Cliente";

    contratoMap.set(c.id as string, {
      plano: (c.plano as string) ?? "",
      atletaNome,
    });

    contractsWithNf.push({
      id: c.id as string,
      atletaNome,
      plano: (c.plano as string) ?? "",
      valor_total: Number(c.valor_total) || 0,
      valor_customizado: c.valor_customizado != null ? Number(c.valor_customizado) : null,
      justificativa_customizacao: (c.justificativa_customizacao as string | null) ?? null,
      inclui_psicologa: (c.inclui_psicologa as boolean) ?? false,
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
    .select("id, contrato_id, valor, vencimento, status, metodo, numero_parcela, recebido_at")
    .is("deleted_at", null)
    .order("vencimento", { ascending: true });

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

  const totalFixedCosts = FIXED_COSTS.filter((c) => c.active).reduce((s, c) => s + c.amount_monthly, 0);
  const variableCostsTotal = VARIABLE_COSTS.reduce((s, c) => s + c.amount, 0);

  const netMarginPct = receitaRecebidaMes > 0
    ? Math.round(((receitaRecebidaMes - totalFixedCosts) / receitaRecebidaMes) * 100)
    : 100;

  // Contratos por plano
  const planMap: Record<string, PlanType> = { journey: "Journey", legacy: "Legacy", start: "Start" };
  const contractsByPlan: Record<PlanType, number> = { Legacy: 0, Journey: 0, Start: 0 };
  for (const c of rawContratos ?? []) {
    const plan = planMap[c.plano as string];
    if (plan) contractsByPlan[plan]++;
  }

  const summary: FinancialSummary = {
    mrr_brl: receitaRecebidaMes,
    total_received_brl: totalReceived,
    total_receivable_brl: totalReceivable,
    overdue_brl: totalOverdue,
    fixed_costs_monthly: totalFixedCosts,
    variable_costs_monthly: variableCostsTotal,
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

  return (
    <div className="space-y-5">
      <PageHeader dense
        eyebrow="Comercial"
        title="Gestão Financeira"
        description="Contratos, recebíveis e análise de custos"
        actions={
          <Suspense fallback={null}>
            <FinanceiroTabs />
          </Suspense>
        }
      />

      {/* Tab: Saídas */}
      {activeTab === "saidas" && <SaidasView despesas={despesas} />}

      {/* Tab: Folha */}
      {activeTab === "folha" && <FolhaView colaboradores={colaboradores} />}

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
                  const planCfg = PLAN_CONFIG[planMap[c.plano] ?? "Journey"];
                  return (
                    <tr key={c.id} className="border-b border-border transition-colors hover:bg-accent">
                      <td className="py-3 pl-4 pr-3">
                        <p className="text-sm font-medium text-foreground">{c.atletaNome}</p>
                      </td>
                      <td className="px-3 py-3">
                        <span className={cn("inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold", planCfg.bg, planCfg.color)}>
                          {planMap[c.plano] ?? c.plano}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-sm font-semibold text-foreground">{formatBRL(c.valor_total)}</td>
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
                  <tr key={c.id} className="border-b border-border transition-colors hover:bg-accent">
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
              </ScrollList>
            </div>

            {/* Custos fixos */}
            <div className="rounded-lg border border-border/70 bg-card/60 p-3.5 flex flex-col h-[20rem]">
              <div className="mb-4 flex items-center justify-between shrink-0">
                <h2 className="text-sm font-semibold text-foreground">Custos Fixos Mensais</h2>
                <span className="text-sm font-bold text-sys-red">{formatBRL(totalFixedCosts)}</span>
              </div>
              <ScrollList>
                <div className="space-y-2">
                  {FIXED_COSTS.filter((c) => c.active).map((cost) => (
                    <div key={cost.id} className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{cost.name}</p>
                      <p className="text-xs font-semibold text-foreground flex-shrink-0">{formatBRL(cost.amount_monthly)}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-border pt-3">
                  <h3 className="mb-2 text-xs font-semibold text-muted-foreground">Custos Variaveis (por contrato)</h3>
                  {VARIABLE_COSTS.map((vc) => (
                    <div key={vc.id} className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-bold", PLAN_CONFIG[vc.plan].bg, PLAN_CONFIG[vc.plan].color)}>
                          {vc.plan}
                        </span>
                        <p className="text-xs text-muted-foreground truncate">{vc.name}</p>
                      </div>
                      <p className="text-xs font-semibold text-foreground flex-shrink-0">{formatBRL(vc.amount)}</p>
                    </div>
                  ))}
                </div>
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

          {/* Contratos com NF Status + Lucro */}
          <div className="border border-border/70 bg-card/60 rounded-xl overflow-hidden">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">Contratos — Controle de NF e Rentabilidade</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{contractsWithNf.length} contratos registrados</p>
                </div>
                <ContractsExportButton contracts={contractsWithNf} />
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-popover">
                    <th className="py-2.5 pl-4 pr-3 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Cliente</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Plano</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Valor Total</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Lucro Est.</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Margem</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">Entrada</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-label-tertiary">NF</th>
                  </tr>
                </thead>
                <tbody>
                  {contractsWithNf.slice(0, 20).map((c) => {
                    const pCfg = PLAN_CONFIG[planMap[c.plano] ?? "Journey"];
                    const custom = isCustomizado(c);
                    const { lucro, margem } = calcularLucro(c);
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
                            {planMap[c.plano] ?? c.plano}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-sm font-semibold text-foreground">{formatBRL(c.valor_total)}</td>
                        <td className="px-3 py-3 text-sm font-semibold text-sys-green">{formatBRL(lucro)}</td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                            margem >= 50
                              ? "border-sys-green/20 bg-sys-green/10 text-sys-green"
                              : margem >= 30
                              ? "border-sys-orange/20 bg-sys-orange/10 text-sys-orange"
                              : "border-sys-red/20 bg-sys-red/10 text-sys-red"
                          )}>
                            {margem}%
                          </span>
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
                  {/* Margem media summary row */}
                  {contractsWithNf.length > 0 && (() => {
                    const allProfits = contractsWithNf.map(calcularLucro);
                    const avgMargin = Math.round(allProfits.reduce((s, p) => s + p.margem, 0) / allProfits.length);
                    const totalLucro = allProfits.reduce((s, p) => s + p.lucro, 0);
                    return (
                      <tr className="border-t-2 border-primary/30 bg-popover">
                        <td colSpan={3} className="py-3 pl-4 pr-3 text-xs font-bold text-foreground">
                          Margem media (todos os contratos)
                        </td>
                        <td className="px-3 py-3 text-sm font-bold text-sys-green">{formatBRL(totalLucro)}</td>
                        <td className="px-3 py-3">
                          <span className={cn(
                            "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold",
                            avgMargin >= 50
                              ? "border-sys-green/20 bg-sys-green/10 text-sys-green"
                              : avgMargin >= 30
                              ? "border-sys-orange/20 bg-sys-orange/10 text-sys-orange"
                              : "border-sys-red/20 bg-sys-red/10 text-sys-red"
                          )}>
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
                      <ReceivableRow key={rec.id} rec={rec} />
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
