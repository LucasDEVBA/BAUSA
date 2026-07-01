"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type DailyLeadCount } from "@/types/lead";
import { formatDate } from "@/lib/utils";
import { ChartCard } from "@/components/ui";

interface LeadsOverTimeChartProps {
  data: DailyLeadCount[];
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length || !label) return null;

  return (
    <div className="rounded-xl border border-border bg-popover p-3 text-sm shadow-lg">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        {formatDate(label)}
      </p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-semibold text-foreground">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function LeadsOverTimeChart({ data }: LeadsOverTimeChartProps) {
  // Exibe apenas os últimos 14 dias com dados
  const visibleData = data.slice(-14);

  return (
    <ChartCard
      title="Leads por Dia"
      subtitle="Últimos 14 dias"
      action={
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-lead-hot" />
            <span className="text-xs text-muted-foreground">Quente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-lead-warm" />
            <span className="text-xs text-muted-foreground">Morno</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-lead-cold" />
            <span className="text-xs text-muted-foreground">Frio</span>
          </div>
        </div>
      }
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorQuente" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--lead-hot)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--lead-hot)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMorno" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--lead-warm)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--lead-warm)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFrio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--lead-cold)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--lead-cold)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => {
                const date = new Date(d + "T00:00:00");
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="quente"
              name="Quente"
              stroke="var(--lead-hot)"
              strokeWidth={2}
              fill="url(#colorQuente)"
            />
            <Area
              type="monotone"
              dataKey="morno"
              name="Morno"
              stroke="var(--lead-warm)"
              strokeWidth={2}
              fill="url(#colorMorno)"
            />
            <Area
              type="monotone"
              dataKey="frio"
              name="Frio"
              stroke="var(--lead-cold)"
              strokeWidth={2}
              fill="url(#colorFrio)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
