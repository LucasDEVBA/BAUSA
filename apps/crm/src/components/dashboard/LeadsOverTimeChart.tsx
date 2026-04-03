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
    <div className="rounded-lg border border-[#1e2130] bg-[#141720] p-3 text-sm shadow-lg">
      <p className="mb-2 text-xs font-medium text-zinc-400">
        {formatDate(label)}
      </p>
      {payload.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
          <span className="text-zinc-400">{item.name}:</span>
          <span className="font-semibold text-zinc-100">{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export function LeadsOverTimeChart({ data }: LeadsOverTimeChartProps) {
  // Exibe apenas os últimos 14 dias com dados
  const visibleData = data.slice(-14);

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Leads por Dia</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Últimos 14 dias</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-zinc-400">Quente</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="text-xs text-zinc-400">Morno</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            <span className="text-xs text-zinc-400">Frio</span>
          </div>
        </div>
      </div>

      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={visibleData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorQuente" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorMorno" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorFrio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => {
                const date = new Date(d + "T00:00:00");
                return `${date.getDate()}/${date.getMonth() + 1}`;
              }}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "#64748b", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="quente"
              name="Quente"
              stroke="#22c55e"
              strokeWidth={2}
              fill="url(#colorQuente)"
            />
            <Area
              type="monotone"
              dataKey="morno"
              name="Morno"
              stroke="#f59e0b"
              strokeWidth={2}
              fill="url(#colorMorno)"
            />
            <Area
              type="monotone"
              dataKey="frio"
              name="Frio"
              stroke="#3b82f6"
              strokeWidth={2}
              fill="url(#colorFrio)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
