"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { type Family, JOURNEY_STAGE_CONFIG } from "@/types/family";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-zinc-100">{label}</p>
      <p className="text-zinc-400">{payload[0].value} {payload[0].value === 1 ? "família" : "famílias"}</p>
    </div>
  );
}

const STAGE_COLORS = [
  "#6366f1", "#818cf8", "#38bdf8", "#34d399", "#fbbf24", "#f97316", "#a78bfa",
];

interface FamilyStageChartProps {
  families: Family[];
}

export function FamilyStageChart({ families }: FamilyStageChartProps) {
  const STAGES_ORDER = [
    "admissao",
    "aprovado",
    "pre_embarque",
    "embarcado",
    "acompanhamento",
    "encerrado",
  ] as const;

  const data = STAGES_ORDER.map((stage, idx) => ({
    label: JOURNEY_STAGE_CONFIG[stage].label,
    count: families.filter((f) => f.journey_stage === stage).length,
    color: STAGE_COLORS[idx],
  })).filter((d) => d.count > 0);

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <h3 className="text-sm font-semibold text-zinc-100">Famílias por Estágio</h3>
      <p className="mt-0.5 text-xs text-zinc-500">Distribuição na jornada pós-contrato</p>

      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e2130" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              tick={{ fill: "#71717a", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={85}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
