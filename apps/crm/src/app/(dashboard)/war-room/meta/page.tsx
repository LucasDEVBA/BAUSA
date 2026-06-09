import { DollarSign, TrendingUp, Layers, Ticket } from "lucide-react";
import { requirePapel } from "@/lib/auth";
import { fetchWarRoomMetrics, fetchMetaRevenue } from "@/lib/war-room-queries";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { GoalProgressCard } from "@/components/war-room/GoalProgressCard";

export default async function WarRoomMetaPage() {
  await requirePapel("ceo");

  const [m, metaRevenue] = await Promise.all([
    fetchWarRoomMetrics(),
    fetchMetaRevenue(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-title-2 text-foreground">Meta e Receita</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Acompanhamento da meta mensal, receita recorrente e pipeline financeiro.
        </p>
      </div>

      <GoalProgressCard data={metaRevenue} />

      <div className="grid grid-cols-2 gap-4">
        <MetricCard
          title="MRR"
          value={`R$ ${(m.mrr_usd / 1000).toFixed(1)}k`}
          subtitle="Receita mensal recorrente"
          icon={DollarSign}
          trend={{ value: m.mrr_trend_pct, label: "% vs mes anterior" }}
          variant="hot"
        />
        <MetricCard
          title="ARR"
          value={`R$ ${(m.arr_usd / 1000).toFixed(0)}k`}
          subtitle="Receita anual recorrente"
          icon={TrendingUp}
          variant="default"
        />
        <MetricCard
          title="Pipeline Total"
          value={`R$ ${(m.pipeline_total_usd / 1000).toFixed(0)}k`}
          subtitle="Em negociacao ativa"
          icon={Layers}
          variant="cold"
        />
        <MetricCard
          title="Ticket Medio"
          value={`R$ ${(m.avg_ticket_usd / 1000).toFixed(0)}k`}
          subtitle="Por contrato fechado"
          icon={Ticket}
          variant="purple"
        />
      </div>
    </div>
  );
}
