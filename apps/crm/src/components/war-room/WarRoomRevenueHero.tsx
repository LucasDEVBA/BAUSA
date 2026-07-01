"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ChartTooltip, DeltaBadge, chartAxisTick, CHART_GRID } from "@/components/ui";
import type { RevenueMonth } from "@/types/revenue";
import { cn } from "@/lib/utils";

interface WarRoomRevenueHeroProps {
  mrrBrl: number;
  trendPct: number;
  months: RevenueMonth[];
  monthlyTargetBrl: number;
  netRevenueMonthBrl: number;
}

function fmtCompact(v: number): string {
  if (Math.abs(v) >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `R$ ${Math.round(v / 1_000)}k`;
  return `R$ ${Math.round(v)}`;
}

/**
 * Hero de receita do War Room (estética premium Brisk/Mesh): número grande +
 * delta ▲/▼ + progresso de meta + gráfico de área com gradiente (12 meses).
 * É o foco visual da Visão Geral ("ler primeiro"). Só apresentação.
 */
export function WarRoomRevenueHero({
  mrrBrl,
  trendPct,
  months,
  monthlyTargetBrl,
  netRevenueMonthBrl,
}: WarRoomRevenueHeroProps) {
  const metaPct =
    monthlyTargetBrl > 0 ? Math.round((netRevenueMonthBrl / monthlyTargetBrl) * 100) : 0;
  const metaColor =
    metaPct >= 80 ? "bg-sys-green" : metaPct >= 50 ? "bg-sys-orange" : "bg-sys-red";
  const data = months.slice(-12);

  return (
    <div className="glass-card relative rounded-2xl p-5">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-4 h-4 w-[3px] rounded-full bg-primary"
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-eyebrow text-muted-foreground">Receita do mês</p>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-3xl font-bold leading-none tracking-tight tabular-nums text-foreground">
              {fmtCompact(mrrBrl)}
            </span>
            <DeltaBadge value={trendPct} className="mb-1" />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">vs. mês anterior</p>
        </div>

        <div className="text-right">
          <p className="text-eyebrow text-muted-foreground">Meta do mês</p>
          <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
            {metaPct}
            <span className="text-sm font-semibold text-muted-foreground">%</span>
          </p>
          <p className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
            {fmtCompact(netRevenueMonthBrl)} / {fmtCompact(monthlyTargetBrl)}
          </p>
        </div>
      </div>

      {/* Progresso de meta */}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", metaColor)}
          style={{ width: `${Math.min(100, metaPct)}%` }}
        />
      </div>

      {/* Gráfico de área — receita recebida (12 meses) */}
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="wrRevenueFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--bau-blue)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--bau-blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} vertical={false} />
            <XAxis dataKey="month_label" tick={chartAxisTick} axisLine={false} tickLine={false} />
            <YAxis
              tick={chartAxisTick}
              axisLine={false}
              tickLine={false}
              width={48}
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip
              content={
                <ChartTooltip
                  valueFormatter={(v) => (typeof v === "number" ? fmtCompact(v) : String(v))}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="received_brl"
              name="Recebido"
              stroke="var(--bau-blue)"
              strokeWidth={2}
              fill="url(#wrRevenueFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
