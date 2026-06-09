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

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="liquid-glass rounded-lg px-3 py-2.5 text-xs">
      <p className="mb-1.5 font-semibold text-foreground">{label}</p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-medium text-foreground">
            R$ {item.value.toLocaleString("pt-BR")}
          </span>
        </div>
      ))}
    </div>
  );
}

interface RevenueBarChartProps {
  data: RevenueMonth[];
}

export function RevenueBarChart({ data }: RevenueBarChartProps) {
  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground">Receita por Mês</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Recebido vs Projetado (R$)</p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={18} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="month_label"
              tick={{ fill: "var(--chart-grid)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "var(--chart-grid)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--chart-grid)" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="received_usd" name="Recebido" fill="var(--sys-green)" radius={[3, 3, 0, 0]} />
            <Bar dataKey="projected_usd" name="Projetado" fill="var(--chart-1)" radius={[3, 3, 0, 0]} opacity={0.7} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
