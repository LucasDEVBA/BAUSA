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
import {
  ChartCard,
  chartAxisTick,
  CHART_GRID,
  CHART_CURSOR_FILL,
} from "@/components/ui";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

// Tooltip local tokenizado (§6.6): conteúdo especial (pluralização de "famílias").
function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-foreground">{label}</p>
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
    <ChartCard
      title="Famílias por Estágio"
      subtitle="Distribuição na jornada pós-contrato"
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" barSize={16}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} horizontal={false} />
            <XAxis
              type="number"
              tick={chartAxisTick}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <YAxis
              dataKey="label"
              type="category"
              tick={chartAxisTick}
              axisLine={false}
              tickLine={false}
              width={85}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: CHART_CURSOR_FILL }} />
            <Bar dataKey="count" radius={[0, 3, 3, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
