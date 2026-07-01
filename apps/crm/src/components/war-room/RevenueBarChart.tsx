"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { type RevenueMonth } from "@/types/revenue";
import {
  ChartCard,
  ChartTooltip,
  chartAxisTick,
  CHART_GRID,
  CHART_CURSOR_FILL,
} from "@/components/ui";

interface RevenueBarChartProps {
  data: RevenueMonth[];
}

const formatBRL = (v: number | string) =>
  `R$ ${typeof v === "number" ? v.toLocaleString("pt-BR") : v}`;

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  return (
    <ChartCard title="Receita por Mês" subtitle="Recebido vs Projetado (R$)">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={18} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
            <XAxis
              dataKey="month_label"
              tick={chartAxisTick}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={chartAxisTick}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip
              content={<ChartTooltip valueFormatter={formatBRL} />}
              cursor={{ fill: CHART_CURSOR_FILL }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="received_brl" name="Recebido" fill="var(--sys-green)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="projected_brl" name="Projetado" fill="var(--chart-1)" radius={[3, 3, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
