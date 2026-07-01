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
    <div className="rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-xs">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">{payload[0].value} {payload[0].value === 1 ? "família" : "famílias"}</p>
    </div>
  );
}

const STAGE_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--sys-orange)", "var(--plan-legacy)",
];

interface FamilyStageChartProps {
  families: Family[];
}

export function FamilyStageChart({ families }: FamilyStageChartProps) {
  const STAGES_ORDER = [
    "admissao",
    "aprovado",
    "pre_embarque",
    "embarcado_inicial",
    "acompanhamento",
    "encerrado",
  ] as const;

  const data = STAGES_ORDER.map((stage, idx) => ({
    label: JOURNEY_STAGE_CONFIG[stage].label,
    count: families.filter((f) => f.journey_stage === stage).length,
    color: STAGE_COLORS[idx],
  })).filter((d) => d.count > 0);

  return (
    <div className="rounded-2xl glass-card p-4">
      <h3 className="text-sm font-semibold text-foreground">Famílias por Estágio</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Distribuição na jornada pós-contrato</p>

      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={85}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--fill-4)" }} />
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
