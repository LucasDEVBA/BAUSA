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
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-100">Meta do Mês</p>
          <p className="mt-0.5 text-xs text-zinc-500">Março 2026</p>
        </div>
        <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${
          isOnTrack
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-red-500/30 bg-red-500/10 text-red-400"
        }`}>
          {isOnTrack ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isOnTrack ? "No target" : `Gap US$ ${Math.abs(gap_to_target_usd / 1000).toFixed(0)}k`}
        </div>
      </div>

      {/* Números principais */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[10px] text-zinc-500">Recebido</p>
          <p className="text-xl font-bold text-emerald-400">
            US$ {(net_revenue_month_usd / 1000).toFixed(0)}k
          </p>
          <p className="text-[10px] text-zinc-600">{achievedPct}% da meta</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">Projetado</p>
          <p className="text-xl font-bold text-indigo-400">
            US$ {(projected_revenue_usd / 1000).toFixed(0)}k
          </p>
          <p className="text-[10px] text-zinc-600">{projectedPct}% da meta</p>
        </div>
        <div>
          <p className="text-[10px] text-zinc-500">Meta</p>
          <p className="text-xl font-bold text-zinc-300">
            US$ {(monthly_target_usd / 1000).toFixed(0)}k
          </p>
          <div className="mt-0.5 flex items-center gap-1">
            <Target className="h-3 w-3 text-zinc-600" />
            <span className="text-[10px] text-zinc-600">mensal</span>
          </div>
        </div>
      </div>

      {/* Barra de progresso dupla */}
      <div className="mt-4 space-y-2">
        {/* Recebido */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Recebido</span>
            <span>{achievedPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${achievedPct}%` }}
            />
          </div>
        </div>

        {/* Projetado */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-zinc-500">
            <span>Projetado</span>
            <span>{projectedPct}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all ${projectedPct >= 100 ? "bg-emerald-400" : "bg-indigo-400"}`}
              style={{ width: `${projectedPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Gap */}
      <div className={`mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 ${
        isOnTrack
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}>
        <p className="text-xs">
          {isOnTrack ? (
            <span className="text-emerald-400">
              Superando a meta em US$ {(gap_to_target_usd / 1000).toFixed(0)}k
            </span>
          ) : (
            <span className="text-red-400">
              Faltam US$ {(Math.abs(gap_to_target_usd) / 1000).toFixed(0)}k para atingir a meta
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
