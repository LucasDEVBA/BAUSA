import { Suspense } from "react";
import { DollarSign, TrendingUp, Layers, Ticket } from "lucide-react";
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
} from "@/lib/war-room-queries";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { GoalProgressCard } from "@/components/war-room/GoalProgressCard";
import { CommercialFunnelSection } from "@/components/war-room/CommercialFunnelSection";
import { ConversionFunnel } from "@/components/war-room/ConversionFunnel";
import { CashFlowSection } from "@/components/war-room/CashFlowSection";
import { RevenueBarChart } from "@/components/war-room/RevenueBarChart";
import { RiskRevenueSection } from "@/components/war-room/RiskRevenueSection";
import { PositioningSection } from "@/components/war-room/PositioningSection";
import { FamilyExperienceSection } from "@/components/war-room/FamilyExperienceSection";
import { FamilyRiskDonut } from "@/components/war-room/FamilyRiskDonut";
import { FamilyStageChart } from "@/components/war-room/FamilyStageChart";
import { AlertsPanel } from "@/components/war-room/AlertsPanel";
import { SafraFilter } from "@/components/war-room/SafraFilter";
import { PriorityLeadsSection } from "@/components/war-room/PriorityLeadsSection";
import { UpcomingActionsSection } from "@/components/war-room/UpcomingActionsSection";
import { WarRoomFinancialSection } from "@/components/war-room/WarRoomFinancialSection";
import { CriticalAlertsBanner } from "@/components/war-room/CriticalAlertsBanner";
import { WarRoomExportButtons } from "@/components/war-room/WarRoomExportButtons";

interface PageProps {
  searchParams: Promise<{ safra?: string }>;
}

export default async function WarRoomDashboardPage({ searchParams }: PageProps) {
  await requirePapel("ceo");

  const params = await searchParams;
  const safra = params.safra || undefined;

  const [
    m,
    metaRevenue,
    commercialFunnel,
    conversionFunnel,
    cashFlow,
    revenueMonths,
    revenueAtRisk,
    positioning,
    familyExperience,
    families,
    alerts,
    bottlenecks,
    priorityLeads,
    upcomingActions,
    financialSummary,
    safras,
    criticalCounts,
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
  ]);

  return (
    <div className="flex flex-col gap-6">
      {/* Critical alerts banner */}
      <CriticalAlertsBanner counts={criticalCounts} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-2 text-foreground">War Room — Dashboard</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Visao executiva completa — metricas, graficos e alertas em uma tela.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <WarRoomExportButtons />
          <Suspense fallback={null}>
            <SafraFilter safras={safras} />
          </Suspense>
        </div>
      </div>

      {/* Secao 1: Meta e Receita */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Meta e Receita
        </p>
        <div className="grid grid-cols-3 gap-4">
          <div className="col-span-2">
            <GoalProgressCard data={metaRevenue} />
          </div>
          <div className="grid grid-rows-2 gap-4">
            <MetricCard
              title="MRR"
              value={`R$ ${(m.mrr_brl / 1000).toFixed(1)}k`}
              subtitle="Receita mensal recorrente"
              icon={DollarSign}
              trend={{ value: m.mrr_trend_pct, label: "% vs mes anterior" }}
              variant="hot"
            />
            <MetricCard
              title="ARR"
              value={`R$ ${(m.arr_brl / 1000).toFixed(0)}k`}
              subtitle="Receita anual recorrente"
              icon={TrendingUp}
              variant="default"
            />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <MetricCard
            title="Pipeline Total"
            value={`R$ ${(m.pipeline_total_brl / 1000).toFixed(0)}k`}
            subtitle="Em negociacao ativa"
            icon={Layers}
            variant="cold"
          />
          <MetricCard
            title="Ticket Medio"
            value={`R$ ${(m.avg_ticket_brl / 1000).toFixed(0)}k`}
            subtitle="Por contrato fechado"
            icon={Ticket}
            variant="purple"
          />
        </div>
      </section>

      {/* Secao 2: Leads Prioritarios + Proximas Acoes */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Operacional
        </p>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <PriorityLeadsSection leads={priorityLeads} />
          <UpcomingActionsSection actions={upcomingActions} />
        </div>
      </section>

      {/* Secao 3: Funil Comercial */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Funil Comercial
        </p>
        <CommercialFunnelSection data={commercialFunnel} />
        <div className="mt-4">
          <ConversionFunnel data={conversionFunnel} />
        </div>
      </section>

      {/* Secao 4: Caixa */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Caixa
        </p>
        <div className="grid grid-cols-2 gap-4">
          <CashFlowSection data={cashFlow} />
          <RevenueBarChart data={revenueMonths} />
        </div>
      </section>

      {/* Secao 5: Financeiro Resumido */}
      <section>
        <WarRoomFinancialSection data={financialSummary} />
      </section>

      {/* Secao 6: Receita em Risco */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Receita em Risco
        </p>
        <RiskRevenueSection data={revenueAtRisk} />
      </section>

      {/* Secao 7: Posicionamento */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Posicionamento
        </p>
        <PositioningSection data={positioning} />
      </section>

      {/* Secao 8: Experiencia das Familias */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Experiencia das Familias
        </p>
        <FamilyExperienceSection data={familyExperience} />
        <div className="mt-4 grid grid-cols-2 gap-4">
          <FamilyRiskDonut families={families} />
          <FamilyStageChart families={families} />
        </div>
      </section>

      {/* Secao 9: Alertas e Gargalos */}
      <section>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
          Alertas e Gargalos
        </p>
        <AlertsPanel alerts={alerts} bottlenecks={bottlenecks} />
      </section>
    </div>
  );
}
