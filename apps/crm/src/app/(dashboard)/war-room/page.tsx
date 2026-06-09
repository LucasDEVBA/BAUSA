import { Suspense } from "react";
import { Target, TrendingUp, Layers, DollarSign, AlertTriangle, BarChart2, Users, Zap, CheckCircle } from "lucide-react";
import { requirePapel } from "@/lib/auth";
import {
  fetchWarRoomMetrics,
  fetchMetaRevenue,
  fetchCommercialFunnel,
  fetchCashFlow,
  fetchRevenueAtRisk,
  fetchPositioning,
  fetchFamilyV2Metrics,
  fetchAlerts,
  fetchDealsWithoutNextAction,
  fetchDistinctSafras,
  fetchPendingQualifications,
  fetchTimingAlternatives,
} from "@/lib/war-room-queries";
import { WarRoomSectionCard } from "@/components/war-room/WarRoomSectionCard";
import { SafraFilter } from "@/components/war-room/SafraFilter";
import { PendingQualificationsAlert } from "@/components/war-room/PendingQualificationsAlert";
import { TimingAlternativesCard } from "@/components/war-room/TimingAlternativesCard";
import { cn } from "@/lib/utils";

// Metas estrategicas BAUSA
const METAS_BAUSA = {
  meta_anual_brl: 1_500_000,
  meta_mensal_brl: 125_000,
  ticket_medio_brl: 23_000,
  contratos_por_mes: 6,
};

interface PageProps {
  searchParams: Promise<{ safra?: string }>;
}

export default async function WarRoomPage({ searchParams }: PageProps) {
  await requirePapel("ceo");

  const params = await searchParams;
  const _safra = params.safra || undefined;

  const [m, meta, funil, caixa, risco, pos, familyMetrics, alerts, dealsWithoutNextAction, safras, pendingQualifications, timingAlternatives] = await Promise.all([
    fetchWarRoomMetrics(),
    fetchMetaRevenue(),
    fetchCommercialFunnel(),
    fetchCashFlow(),
    fetchRevenueAtRisk(),
    fetchPositioning(),
    fetchFamilyV2Metrics(),
    fetchAlerts(),
    fetchDealsWithoutNextAction(),
    fetchDistinctSafras(),
    fetchPendingQualifications(),
    fetchTimingAlternatives(),
  ]);

  const criticalAlerts = alerts.filter((a) => a.type === "critical");
  const warningAlerts = alerts.filter((a) => a.type === "warning");

  const totalRiskBrl =
    risco.contracts_without_signature_brl +
    risco.unpaid_signals_brl +
    risco.pending_remaining_brl;

  const funnelConversionPct = funil.leads_qualified > 0
    ? Math.round((funil.contracts_signed / funil.leads_qualified) * 100)
    : 0;
  const metaPct = meta.monthly_target_brl > 0
    ? Math.round((meta.net_revenue_month_brl / meta.monthly_target_brl) * 100)
    : 0;
  const metaAnualPct = METAS_BAUSA.meta_anual_brl > 0
    ? Math.round((m.revenue_ytd_brl / METAS_BAUSA.meta_anual_brl) * 100)
    : 0;

  // Pipeline health (ideal: 3-5x meta mensal)
  const pipelineRatio = (m.pipeline_total_brl / METAS_BAUSA.meta_mensal_brl).toFixed(1);
  const isPipelineHealthy = parseFloat(pipelineRatio) >= 3;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <Zap className="h-5 w-5 text-primary" />
            <h1 className="text-title-2 text-foreground">War Room Executivo</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Painel central do CEO — clique em qualquer secao para detalhar
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={null}>
            <SafraFilter safras={safras} />
          </Suspense>
          <div className="flex items-center gap-1.5 rounded-full border border-sys-green/20 bg-sys-green/10 px-3 py-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sys-green" />
            <span className="text-[11px] font-medium text-sys-green">Ao vivo</span>
          </div>
        </div>
      </div>

      {/* Alerta de leads pendentes de qualificação (Gemini falhou) */}
      <PendingQualificationsAlert data={pendingQualifications} />

      {/* Cards de timing alternativo (cedo demais / tarde demais) */}
      <TimingAlternativesCard data={timingAlternatives} />

      {/* Metas BAUSA strip */}
      <div className="glass-card rounded-xl border-primary/20 px-5 py-4">
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-primary">Metas Estrategicas 2026</p>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {
              label: "Meta Anual",
              value: "R$ 1,5M",
              sub: `${metaAnualPct}% atingido`,
              pct: metaAnualPct,
              color: "text-primary",
              bar: "bg-primary",
            },
            {
              label: "Meta Mensal",
              value: "R$ 125k",
              sub: `${metaPct}% do mes`,
              pct: metaPct,
              color: metaPct >= 80 ? "text-sys-green" : metaPct >= 50 ? "text-sys-orange" : "text-sys-red",
              bar: metaPct >= 80 ? "bg-sys-green" : metaPct >= 50 ? "bg-sys-orange" : "bg-sys-red",
            },
            {
              label: "Ticket Medio (pix)",
              value: "R$ 23k",
              sub: `base de referencia`,
              pct: null as number | null,
              color: "text-plan-legacy",
              bar: "bg-plan-legacy",
            },
            {
              label: "Contratos/Mes",
              value: `${METAS_BAUSA.contratos_por_mes}`,
              sub: `${funil.contracts_signed} fechados`,
              pct: Math.round((funil.contracts_signed / METAS_BAUSA.contratos_por_mes) * 100),
              color: funil.contracts_signed >= METAS_BAUSA.contratos_por_mes ? "text-sys-green" : "text-sys-orange",
              bar: funil.contracts_signed >= METAS_BAUSA.contratos_por_mes ? "bg-sys-green" : "bg-sys-orange",
            },
          ].map((kpi) => (
            <div key={kpi.label}>
              <p className="text-[10px] text-label-tertiary">{kpi.label}</p>
              <p className={cn("text-lg font-bold", kpi.color)}>{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground mb-1.5">{kpi.sub}</p>
              {kpi.pct !== null && (
                <div className="h-1 rounded-full bg-secondary">
                  <div className={cn("h-full rounded-full", kpi.bar)} style={{ width: `${Math.min(100, kpi.pct)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="glass-card flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-green/10">
            <DollarSign className="h-4 w-4 text-sys-green" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Receita mes</p>
            <p className="text-sm font-bold text-sys-green">
              R$ {(m.mrr_brl / 1000).toFixed(0)}k
            </p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sys-blue/10">
            <Layers className="h-4 w-4 text-sys-blue" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Pipeline total</p>
            <p className={cn("text-sm font-bold", isPipelineHealthy ? "text-sys-blue" : "text-sys-orange")}>
              R$ {(m.pipeline_total_brl / 1000).toFixed(0)}k
            </p>
            <p className="text-[10px] text-label-tertiary">{pipelineRatio}x meta (ideal 3-5x)</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <BarChart2 className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Conversao</p>
            <p className="text-sm font-bold text-foreground">{m.conversion_rate}%</p>
          </div>
        </div>
        <div className="glass-card flex items-center gap-3 rounded-xl px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-plan-legacy/10">
            <Users className="h-4 w-4 text-plan-legacy" />
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground">Familias</p>
            <p className="text-sm font-bold text-plan-legacy">{familyMetrics.total} ativas</p>
            {familyMetrics.crise > 0 && (
              <p className="text-[10px] text-sys-red">{familyMetrics.crise} em crise!</p>
            )}
          </div>
        </div>
      </div>

      {/* Section cards */}
      <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-3">
        <WarRoomSectionCard
          href="/war-room/meta"
          title="Meta e Receita"
          icon={Target}
          variant="success"
          lines={[
            `R$ ${(meta.net_revenue_month_brl / 1000).toFixed(0)}k recebido / R$ ${(meta.monthly_target_brl / 1000).toFixed(0)}k meta (${metaPct}%)`,
            `Projecao: R$ ${(meta.projected_revenue_brl / 1000).toFixed(0)}k ate fim do mes`,
          ]}
          badge={{
            label: `Gap ${meta.gap_to_target_brl < 0 ? "-" : "+"}R$ ${Math.abs(meta.gap_to_target_brl / 1000).toFixed(0)}k`,
            variant: meta.gap_to_target_brl < 0 ? "danger" : "success",
          }}
        />

        <WarRoomSectionCard
          href="/war-room/funil"
          title="Funil Comercial"
          icon={TrendingUp}
          variant="indigo"
          lines={[
            `${funil.leads_qualified} leads -> ${funil.contracts_signed} contratos (${funnelConversionPct}% conv.)`,
            `${funil.meetings_done} reunioes . ${funil.proposals_sent} propostas . ${funil.signals_paid} sinais pagos`,
            `Proxima acao definida em ${m.next_action_compliance_pct}% dos ${m.active_deals_count} deals ativos`,
          ]}
          badge={{
            label: `${funil.auto_conversions} concluido${funil.auto_conversions !== 1 ? "s" : ""}`,
            variant: funil.auto_conversions > 0 ? "success" : "neutral",
          }}
        />

        <WarRoomSectionCard
          href="/war-room/caixa"
          title="Caixa"
          icon={DollarSign}
          variant="blue"
          lines={[
            `Recebido: R$ ${(caixa.net_received_brl / 1000).toFixed(0)}k`,
            `Proj. 30d: R$ ${(caixa.projected_30d_brl / 1000).toFixed(0)}k . 90d: R$ ${(caixa.projected_90d_brl / 1000).toFixed(0)}k`,
          ]}
        />

        <WarRoomSectionCard
          href="/war-room/risco"
          title="Receita em Risco"
          icon={AlertTriangle}
          variant={totalRiskBrl > 50000 ? "danger" : "warning"}
          lines={[
            `R$ ${(totalRiskBrl / 1000).toFixed(0)}k em risco total`,
            `${risco.contracts_without_signature_count} sem assinatura . ${risco.unpaid_signals_count} sinais . ${risco.pending_remaining_count} remanescentes`,
          ]}
          badge={{
            label: `${criticalAlerts.length} critico${criticalAlerts.length !== 1 ? "s" : ""}`,
            variant: criticalAlerts.length > 0 ? "danger" : "success",
          }}
        />

        <WarRoomSectionCard
          href="/war-room/posicionamento"
          title="Posicionamento"
          icon={BarChart2}
          variant="purple"
          lines={[
            `Legacy ${pos.pct_legacy}% . Journey ${pos.pct_journey}% . Start ${pos.pct_start}%`,
            `Ticket medio R$ ${(pos.avg_ticket_brl / 1000).toFixed(0)}k . ${pos.pct_discounted}% com desconto`,
          ]}
        />

        <WarRoomSectionCard
          href="/familias-crm"
          title="Experiencia das Familias"
          icon={Users}
          variant={familyMetrics.crise > 0 ? "danger" : familyMetrics.atencao > 0 ? "warning" : "success"}
          lines={[
            `${familyMetrics.total} ativas . ${familyMetrics.satisfeita} satisfeitas . ${familyMetrics.atencao} atencao`,
            `${familyMetrics.crise} crise${familyMetrics.crise !== 1 ? "s" : ""} . Satisfacao media ${familyMetrics.avg_satisfaction}/5`,
            m.nps_respondentes > 0
              ? `NPS ${m.nps_average} (${m.nps_respondentes} resp.)`
              : "NPS — (sem respostas ainda)",
          ]}
          badge={{
            label: familyMetrics.crise > 0 ? `${familyMetrics.crise} em crise!` : `Sat. ${familyMetrics.avg_satisfaction}/5`,
            variant: familyMetrics.crise > 0 ? "danger" : familyMetrics.avg_satisfaction >= 4 ? "success" : "warning",
          }}
        />
      </div>

      {/* Alertas + acoes */}
      <div className="grid gap-3 lg:grid-cols-2">
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="glass-card rounded-xl border-sys-red/20 px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-sys-red" />
                <p className="text-xs font-semibold text-sys-red">
                  {criticalAlerts.length} critico{criticalAlerts.length !== 1 ? "s" : ""}
                  {warningAlerts.length > 0 && ` . ${warningAlerts.length} atencao`}
                </p>
              </div>
              <a href="/war-room/risco" className="text-[11px] font-semibold text-sys-red hover:underline">
                Ver todos &rarr;
              </a>
            </div>
            <div className="space-y-1">
              {[...criticalAlerts, ...warningAlerts].slice(0, 3).map((alert) => (
                <p key={alert.id} className="text-xs text-muted-foreground">
                  <span className={cn("font-medium", alert.type === "critical" ? "text-sys-red" : "text-sys-orange")}>
                    {alert.type === "critical" ? "! " : ". "}
                  </span>
                  {alert.title}
                </p>
              ))}
            </div>
          </div>
        )}

        {dealsWithoutNextAction.length > 0 ? (
          <div className="glass-card rounded-xl border-sys-orange/20 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-sys-orange" />
              <p className="text-xs font-semibold text-sys-orange">
                {dealsWithoutNextAction.length} deal{dealsWithoutNextAction.length !== 1 ? "s" : ""} sem proxima acao definida
              </p>
            </div>
            {dealsWithoutNextAction.slice(0, 3).map((deal) => (
              <p key={deal.id} className="text-xs text-muted-foreground">. {deal.athlete_name} — {deal.stage}</p>
            ))}
          </div>
        ) : (
          <div className="glass-card rounded-xl border-sys-green/20 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-sys-green" />
              <p className="text-xs font-semibold text-sys-green">Todos os deals tem proxima acao definida</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
