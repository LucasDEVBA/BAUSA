import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { type MetaRevenueMetrics } from "@/types/revenue";

interface GoalProgressCardProps {
  data: MetaRevenueMetrics;
}

export function GoalProgressCard({ data }: GoalProgressCardProps) {
  const { net_revenue_month_usd, monthly_target_usd, projected_revenue_usd, gap_to_target_usd } = data;

  const achievedPct = Math.min(Math.round((net_revenue_month_usd / monthly_target_usd) * 100), 100);
  const projectedPct = Math.min(Math.round((projected_revenue_usd / monthly_target_usd) * 100), 100);
  const isOnTrack = gap_to_target_usd >= 0;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Meta do Mês</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Março 2026</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
          isOnTrack
            ? "border-sys-green/30 bg-sys-green/10 text-sys-green"
            : "border-sys-red/30 bg-sys-red/10 text-sys-red"
        }`}>
          {isOnTrack ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isOnTrack ? "No target" : `Gap US$ ${Math.abs(gap_to_target_usd / 1000).toFixed(0)}k`}
        </div>
      </div>

      {/* Números principais */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] text-muted-foreground">Recebido</p>
          <p className="text-xl font-bold text-sys-green">
            US$ {(net_revenue_month_usd / 1000).toFixed(0)}k
          </p>
          <p className="text-[10px] text-label-tertiary">{achievedPct}% da meta</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Projetado</p>
          <p className="text-xl font-bold text-primary">
            US$ {(projected_revenue_usd / 1000).toFixed(0)}k
          </p>
          <p className="text-[10px] text-label-tertiary">{projectedPct}% da meta</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Meta</p>
          <p className="text-xl font-bold text-foreground">
            US$ {(monthly_target_usd / 1000).toFixed(0)}k
          </p>
          <div className="mt-0.5 flex items-center gap-1">
            <Target className="h-3 w-3 text-label-tertiary" />
            <span className="text-[10px] text-label-tertiary">mensal</span>
          </div>
        </div>
      </div>

      {/* Barra de progresso dupla */}
      <div className="mt-4 space-y-2">
        {/* Recebido */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Recebido</span>
            <span>{achievedPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-sys-green transition-all"
              style={{ width: `${achievedPct}%` }}
            />
          </div>
        </div>

        {/* Projetado */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Projetado</span>
            <span>{projectedPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full transition-all ${projectedPct >= 100 ? "bg-sys-green" : "bg-primary"}`}
              style={{ width: `${projectedPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Gap */}
      <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${
        isOnTrack
          ? "border-sys-green/20 bg-sys-green/5"
          : "border-sys-red/20 bg-sys-red/5"
      }`}>
        <p className="text-xs">
          {isOnTrack ? (
            <span className="text-sys-green">
              Superando a meta em US$ {(gap_to_target_usd / 1000).toFixed(0)}k
            </span>
          ) : (
            <span className="text-sys-red">
              Faltam US$ {(Math.abs(gap_to_target_usd) / 1000).toFixed(0)}k para atingir a meta
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
