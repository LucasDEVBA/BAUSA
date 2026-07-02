import { Suspense } from "react";
import {
  Target,
  TrendingUp,
  Layers,
  DollarSign,
  AlertTriangle,
  BarChart2,
  Users,
  CheckCircle,
  Ticket,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { requirePapel } from "@/lib/auth";
import {
  fetchWarRoomMetrics,
  fetchMetaRevenue,
  fetchCommercialFunnel,
  fetchConversionFunnel,
  fetchCashFlow,
  fetchRevenueMonths,
  fetchRevenueAtRisk,
  fetchPositioning,
  fetchFamilyExperience,
  fetchFamiliesFromExperiencia,
  fetchAlerts,
  fetchBottlenecks,
  fetchPriorityLeads,
  fetchUpcomingActions,
  fetchWarRoomFinancialSummary,
  fetchDistinctSafras,
  fetchCriticalAlertCounts,
  fetchFamilyV2Metrics,
  fetchDealsWithoutNextAction,
  fetchPendingQualifications,
  fetchTimingAlternatives,
} from "@/lib/war-room-queries";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui";
import { WarRoomRevenueHero } from "@/components/war-room/WarRoomRevenueHero";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { SafraFilter } from "@/components/war-room/SafraFilter";
import { WarRoomExportButtons } from "@/components/war-room/WarRoomExportButtons";
import { CriticalAlertsBanner } from "@/components/war-room/CriticalAlertsBanner";
import { PendingQualificationsAlert } from "@/components/war-room/PendingQualificationsAlert";
import { TimingAlternativesCard } from "@/components/war-room/TimingAlternativesCard";
import { PriorityLeadsSection } from "@/components/war-room/PriorityLeadsSection";
import { UpcomingActionsSection } from "@/components/war-room/UpcomingActionsSection";
import { GoalProgressCard } from "@/components/war-room/GoalProgressCard";
import { CommercialFunnelSection } from "@/components/war-room/CommercialFunnelSection";
import { ConversionFunnel } from "@/components/war-room/ConversionFunnel";
import { CashFlowSection } from "@/components/war-room/CashFlowSection";
import { RevenueBarChart } from "@/components/war-room/RevenueBarChart";
import { WarRoomFinancialSection } from "@/components/war-room/WarRoomFinancialSection";
import { RiskRevenueSection } from "@/components/war-room/RiskRevenueSection";
import { AlertsPanel } from "@/components/war-room/AlertsPanel";
import { PositioningSection } from "@/components/war-room/PositioningSection";
import { FamilyExperienceSection } from "@/components/war-room/FamilyExperienceSection";
import { FamilyRiskDonut } from "@/components/war-room/FamilyRiskDonut";
import { FamilyStageChart } from "@/components/war-room/FamilyStageChart";
import { WarRoomTabs, type WarRoomTab } from "./WarRoomTabs";

// Metas estrategicas BAUSA (referencia para os medidores da Visao Geral)
const METAS_BAUSA = {
  meta_anual_brl: 1_500_000,
  meta_mensal_brl: 125_000,
  contratos_por_mes: 6,
};

const k = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;

// ─── Card de drill da Visao Geral: ancora nativa (#aba) → troca instantanea ───
type DrillVariant = "success" | "indigo" | "blue" | "danger" | "warning" | "purple";

const DRILL_ACCENT: Record<DrillVariant, { bar: string; icon: string; ring: string }> = {
  success: { bar: "bg-sys-green", icon: "bg-sys-green/10 text-sys-green", ring: "hover:border-sys-green/40" },
  indigo: { bar: "bg-primary", icon: "bg-primary/10 text-primary", ring: "hover:border-primary/40" },
  blue: { bar: "bg-sys-blue", icon: "bg-sys-blue/10 text-sys-blue", ring: "hover:border-sys-blue/40" },
  danger: { bar: "bg-sys-red", icon: "bg-sys-red/10 text-sys-red", ring: "hover:border-sys-red/40" },
  warning: { bar: "bg-sys-orange", icon: "bg-sys-orange/10 text-sys-orange", ring: "hover:border-sys-orange/40" },
  purple: { bar: "bg-plan-legacy", icon: "bg-plan-legacy/10 text-plan-legacy", ring: "hover:border-plan-legacy/40" },
};

const BADGE_STYLES: Record<"danger" | "warning" | "success" | "neutral", string> = {
  danger: "bg-sys-red/15 text-sys-red border border-sys-red/30",
  warning: "bg-sys-orange/15 text-sys-orange border border-sys-orange/30",
  success: "bg-sys-green/15 text-sys-green border border-sys-green/30",
  neutral: "bg-secondary text-muted-foreground border border-border",
};

interface DrillCardProps {
  target: string; // id da aba (sem #)
  title: string;
  icon: LucideIcon;
  lines: string[];
  variant: DrillVariant;
  badge?: { label: string; variant: "danger" | "warning" | "success" | "neutral" };
}

function DrillCard({ target, title, icon: Icon, lines, variant, badge }: DrillCardProps) {
  const a = DRILL_ACCENT[variant];
  return (
    <a
      href={`#${target}`}
      className={cn(
        "group relative flex flex-col gap-3 rounded-lg border border-border/70 bg-card/60 p-3 transition-all hover:shadow-md",
        a.ring,
      )}
    >
      <span className={cn("absolute left-0 top-4 h-8 w-0.5 rounded-r-full", a.bar)} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex size-8 flex-shrink-0 items-center justify-center rounded-lg", a.icon)}>
            <Icon className="size-4" />
          </div>
          <p className="text-eyebrow text-muted-foreground">{title}</p>
        </div>
        <ChevronRight className="size-4 text-label-tertiary transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground" />
      </div>
      <div className="space-y-1 pl-0.5">
        {lines.map((line, i) => (
          <p key={i} className={cn("text-sm font-medium", i === 0 ? "text-foreground" : "text-muted-foreground")}>
            {line}
          </p>
        ))}
      </div>
      {badge && (
        <span className={cn("self-start rounded-full px-2 py-0.5 text-[10px] font-semibold", BADGE_STYLES[badge.variant])}>
          {badge.label}
        </span>
      )}
    </a>
  );
}

interface PageProps {
  searchParams: Promise<{ safra?: string }>;
}

export default async function WarRoomPage({ searchParams }: PageProps) {
  await requirePapel("ceo");

  const params = await searchParams;
  const safra = params.safra || undefined;

  const [
    m,
    meta,
    funil,
    conversionFunnel,
    caixa,
    revenueMonths,
    risco,
    pos,
    familyExperience,
    families,
    alerts,
    bottlenecks,
    priorityLeads,
    upcomingActions,
    financialSummary,
    safras,
    criticalCounts,
    familyMetrics,
    dealsWithoutNextAction,
    pendingQualifications,
    timingAlternatives,
  ] = await Promise.all([
    fetchWarRoomMetrics(),
    fetchMetaRevenue(),
    fetchCommercialFunnel(),
    fetchConversionFunnel(),
    fetchCashFlow(),
    fetchRevenueMonths(),
    fetchRevenueAtRisk(),
    fetchPositioning(),
    fetchFamilyExperience(),
    fetchFamiliesFromExperiencia(),
    fetchAlerts(),
    fetchBottlenecks(),
    fetchPriorityLeads(safra),
    fetchUpcomingActions(safra),
    fetchWarRoomFinancialSummary(),
    fetchDistinctSafras(),
    fetchCriticalAlertCounts(),
    fetchFamilyV2Metrics(),
    fetchDealsWithoutNextAction(),
    fetchPendingQualifications(),
    fetchTimingAlternatives(),
  ]);

  const criticalAlerts = alerts.filter((a) => a.type === "critical");
  const warningAlerts = alerts.filter((a) => a.type === "warning");
  const totalRiskBrl =
    risco.contracts_without_signature_brl + risco.unpaid_signals_brl + risco.pending_remaining_brl;
  const funnelConversionPct =
    funil.leads_qualified > 0 ? Math.round((funil.contracts_signed / funil.leads_qualified) * 100) : 0;
  const metaPct =
    meta.monthly_target_brl > 0 ? Math.round((meta.net_revenue_month_brl / meta.monthly_target_brl) * 100) : 0;
  const metaAnualPct =
    METAS_BAUSA.meta_anual_brl > 0 ? Math.round((m.revenue_ytd_brl / METAS_BAUSA.meta_anual_brl) * 100) : 0;
  const pipelineRatio = (m.pipeline_total_brl / METAS_BAUSA.meta_mensal_brl).toFixed(1);
  const isPipelineHealthy = parseFloat(pipelineRatio) >= 3;
  const contratosPct = Math.round((funil.contracts_signed / METAS_BAUSA.contratos_por_mes) * 100);

  const metas = [
    { label: "Meta Anual", value: "R$ 1,5M", sub: `${metaAnualPct}% atingido`, pct: metaAnualPct, color: "text-primary", bar: "bg-primary" },
    { label: "Meta Mensal", value: "R$ 125k", sub: `${metaPct}% do mes`, pct: metaPct, color: metaPct >= 80 ? "text-sys-green" : metaPct >= 50 ? "text-sys-orange" : "text-sys-red", bar: metaPct >= 80 ? "bg-sys-green" : metaPct >= 50 ? "bg-sys-orange" : "bg-sys-red" },
    { label: "Ticket Medio (ref)", value: "R$ 23k", sub: "base de referencia", pct: null as number | null, color: "text-plan-legacy", bar: "bg-plan-legacy" },
    { label: "Contratos/Mes", value: `${METAS_BAUSA.contratos_por_mes}`, sub: `${funil.contracts_signed} fechados`, pct: contratosPct, color: funil.contracts_signed >= METAS_BAUSA.contratos_por_mes ? "text-sys-green" : "text-sys-orange", bar: funil.contracts_signed >= METAS_BAUSA.contratos_por_mes ? "bg-sys-green" : "bg-sys-orange" },
  ];

  // ─── Aba: Visao Geral (command center) ───
  const visaoGeral = (
    <div className="flex flex-col gap-4">
      <CriticalAlertsBanner counts={criticalCounts} />
      <PendingQualificationsAlert data={pendingQualifications} />

      {/* Hero de receita + faixa de KPIs (foco visual) */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <WarRoomRevenueHero
            mrrBrl={m.mrr_brl}
            trendPct={m.mrr_trend_pct}
            months={revenueMonths}
            monthlyTargetBrl={meta.monthly_target_brl}
            netRevenueMonthBrl={meta.net_revenue_month_brl}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <StatCard
            label="Pipeline total"
            value={k(m.pipeline_total_brl)}
            icon={Layers}
            accent={isPipelineHealthy ? "blue" : "orange"}
            context={`${pipelineRatio}x a meta`}
          />
          <StatCard label="Conversão" value={`${m.conversion_rate}%`} icon={BarChart2} accent="brand" />
          <StatCard
            label="Famílias ativas"
            value={familyMetrics.total}
            icon={Users}
            accent={familyMetrics.crise > 0 ? "red" : "purple"}
            context={familyMetrics.crise > 0 ? `${familyMetrics.crise} em crise` : undefined}
          />
        </div>
      </div>

      {/* Metas estratégicas (card único, glass) */}
      <div className="glass-card relative rounded-2xl p-4">
        <p className="mb-3 text-eyebrow text-muted-foreground">Metas Estratégicas 2026</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
          {metas.map((kpi) => (
            <div key={kpi.label}>
              <p className="text-eyebrow text-label-tertiary">{kpi.label}</p>
              <p className={cn("mt-0.5 text-xl font-bold tabular-nums", kpi.color)}>{kpi.value}</p>
              <p className="mb-1.5 text-[10px] text-muted-foreground">{kpi.sub}</p>
              {kpi.pct !== null && (
                <div className="h-1 rounded-full bg-secondary">
                  <div className={cn("h-full rounded-full", kpi.bar)} style={{ width: `${Math.min(100, kpi.pct)}%` }} />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Drill cards → abas */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DrillCard
          target="meta"
          title="Meta e Receita"
          icon={Target}
          variant="success"
          lines={[`${k(meta.net_revenue_month_brl)} / ${k(meta.monthly_target_brl)} meta (${metaPct}%)`, `Projecao ${k(meta.projected_revenue_brl)} ate fim do mes`]}
          badge={{ label: `Gap ${meta.gap_to_target_brl < 0 ? "-" : "+"}${k(Math.abs(meta.gap_to_target_brl))}`, variant: meta.gap_to_target_brl < 0 ? "danger" : "success" }}
        />
        <DrillCard
          target="funil"
          title="Funil Comercial"
          icon={TrendingUp}
          variant="indigo"
          lines={[`${funil.leads_qualified} leads -> ${funil.contracts_signed} contratos (${funnelConversionPct}%)`, `${funil.meetings_done} reunioes . ${funil.proposals_sent} propostas . ${funil.signals_paid} sinais`]}
          badge={{ label: `${funil.auto_conversions} concluido${funil.auto_conversions !== 1 ? "s" : ""}`, variant: funil.auto_conversions > 0 ? "success" : "neutral" }}
        />
        <DrillCard
          target="caixa"
          title="Caixa"
          icon={DollarSign}
          variant="blue"
          lines={[`Recebido ${k(caixa.net_received_brl)}`, `Proj. 30d ${k(caixa.projected_30d_brl)} . 90d ${k(caixa.projected_90d_brl)}`]}
        />
        <DrillCard
          target="risco"
          title="Receita em Risco"
          icon={AlertTriangle}
          variant={totalRiskBrl > 50000 ? "danger" : "warning"}
          lines={[`${k(totalRiskBrl)} em risco total`, `${risco.contracts_without_signature_count} sem assinatura . ${risco.unpaid_signals_count} sinais . ${risco.pending_remaining_count} remanesc.`]}
          badge={{ label: `${criticalAlerts.length} critico${criticalAlerts.length !== 1 ? "s" : ""}`, variant: criticalAlerts.length > 0 ? "danger" : "success" }}
        />
        <DrillCard
          target="posicionamento"
          title="Posicionamento"
          icon={BarChart2}
          variant="purple"
          lines={[`Legacy ${pos.pct_legacy}% . Journey ${pos.pct_journey}% . Start ${pos.pct_start}%`, `Ticket ${k(pos.avg_ticket_brl)} . ${pos.pct_discounted}% com desconto`]}
        />
        <DrillCard
          target="familias"
          title="Experiencia das Familias"
          icon={Users}
          variant={familyMetrics.crise > 0 ? "danger" : familyMetrics.atencao > 0 ? "warning" : "success"}
          lines={[`${familyMetrics.total} ativas . ${familyMetrics.satisfeita} satisfeitas . ${familyMetrics.atencao} atencao`, `${familyMetrics.crise} crise . Satisfacao ${familyMetrics.avg_satisfaction}/5`]}
          badge={{ label: familyMetrics.crise > 0 ? `${familyMetrics.crise} em crise!` : `Sat. ${familyMetrics.avg_satisfaction}/5`, variant: familyMetrics.crise > 0 ? "danger" : familyMetrics.avg_satisfaction >= 4 ? "success" : "warning" }}
        />
      </div>

      {/* Timing alternativo (card único) — logo acima das listas operacionais */}
      <TimingAlternativesCard data={timingAlternatives} />

      {/* Operacional */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PriorityLeadsSection leads={priorityLeads} />
        <UpcomingActionsSection actions={upcomingActions} />
      </div>

      {/* Alertas + deals sem proxima acao */}
      <div className="grid gap-3 lg:grid-cols-2">
        {(criticalAlerts.length > 0 || warningAlerts.length > 0) && (
          <div className="rounded-xl border border-sys-red/20 bg-card/60 px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-sys-red" />
                <p className="text-xs font-semibold text-sys-red">
                  {criticalAlerts.length} critico{criticalAlerts.length !== 1 ? "s" : ""}
                  {warningAlerts.length > 0 && ` . ${warningAlerts.length} atencao`}
                </p>
              </div>
              <a href="#risco" className="text-[11px] font-semibold text-sys-red hover:underline">Ver todos &rarr;</a>
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
          <div className="rounded-xl border border-sys-orange/20 bg-card/60 px-4 py-3">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-sys-orange" />
              <p className="text-xs font-semibold text-sys-orange">
                {dealsWithoutNextAction.length} deal{dealsWithoutNextAction.length !== 1 ? "s" : ""} sem proxima acao
              </p>
            </div>
            {dealsWithoutNextAction.slice(0, 3).map((deal) => (
              <p key={deal.id} className="text-xs text-muted-foreground">. {deal.athlete_name} — {deal.stage}</p>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-sys-green/20 bg-card/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-sys-green" />
              <p className="text-xs font-semibold text-sys-green">Todos os deals tem proxima acao definida</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const tabs: WarRoomTab[] = [
    { id: "visao", label: "Visao Geral", content: visaoGeral },
    {
      id: "meta",
      label: "Meta & Receita",
      content: (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <GoalProgressCard data={meta} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <MetricCard title="MRR" value={`R$ ${(m.mrr_brl / 1000).toFixed(1)}k`} subtitle="Receita mensal recorrente" icon={DollarSign} trend={{ value: m.mrr_trend_pct, label: "% vs mes anterior" }} variant="hot" />
            <MetricCard title="ARR" value={`R$ ${(m.arr_brl / 1000).toFixed(0)}k`} subtitle="Receita anual recorrente" icon={TrendingUp} variant="default" />
          </div>
          <MetricCard title="Pipeline Total" value={k(m.pipeline_total_brl)} subtitle="Em negociacao ativa" icon={Layers} variant="cold" />
          <MetricCard title="Ticket Medio" value={k(m.avg_ticket_brl)} subtitle="Por contrato fechado" icon={Ticket} variant="purple" />
        </div>
      ),
    },
    {
      id: "funil",
      label: "Funil",
      content: (
        <div className="flex flex-col gap-4">
          <CommercialFunnelSection data={funil} />
          <ConversionFunnel data={conversionFunnel} />
        </div>
      ),
    },
    {
      id: "caixa",
      label: "Caixa",
      content: (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <CashFlowSection data={caixa} />
            <RevenueBarChart data={revenueMonths} />
          </div>
          <WarRoomFinancialSection data={financialSummary} />
        </div>
      ),
    },
    {
      id: "risco",
      label: "Risco",
      content: (
        <div className="flex flex-col gap-4">
          <RiskRevenueSection data={risco} />
          <AlertsPanel alerts={alerts} bottlenecks={bottlenecks} />
        </div>
      ),
    },
    { id: "posicionamento", label: "Posicionamento", content: <PositioningSection data={pos} /> },
    {
      id: "familias",
      label: "Familias",
      content: (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            <a href="/war-room/familias" className="rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              Visão gerencial completa &rarr;
            </a>
            <a href="/war-room/familias-onboarding" className="rounded-lg border border-border bg-card/60 px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
              Onboarding das famílias &rarr;
            </a>
          </div>
          <FamilyExperienceSection data={familyExperience} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FamilyRiskDonut families={families} />
            <FamilyStageChart families={families} />
          </div>
        </div>
      ),
    },
  ];

  const header = (
    <div className="flex items-center gap-3">
      <Suspense fallback={null}>
        <SafraFilter safras={safras} />
      </Suspense>
      <WarRoomExportButtons />
    </div>
  );

  return <WarRoomTabs tabs={tabs} header={header} />;
}
