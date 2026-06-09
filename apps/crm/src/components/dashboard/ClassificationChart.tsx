"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";

interface ClassificationChartProps {
  quente: number;
  morno: number;
  frio: number;
}

const COLORS = {
  QUENTE: "var(--lead-hot)",
  MORNO: "var(--lead-warm)",
  FRIO: "var(--lead-cold)",
};

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelRenderProps) {
  const safeCx = typeof cx === "number" ? cx : 0;
  const safeCy = typeof cy === "number" ? cy : 0;
  const safeMidAngle = typeof midAngle === "number" ? midAngle : 0;
  const safeInnerRadius = typeof innerRadius === "number" ? innerRadius : 0;
  const safeOuterRadius = typeof outerRadius === "number" ? outerRadius : 0;
  const safePercent = typeof percent === "number" ? percent : 0;

  if (safePercent < 0.05) return null;
  const RADIAN = Math.PI / 180;
  const radius = safeInnerRadius + (safeOuterRadius - safeInnerRadius) * 0.5;
  const x = safeCx + radius * Math.cos(-safeMidAngle * RADIAN);
  const y = safeCy + radius * Math.sin(-safeMidAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="white"
      textAnchor="middle"
      dominantBaseline="central"
      fontSize={11}
      fontWeight="bold"
    >
      {`${(safePercent * 100).toFixed(0)}%`}
    </text>
  );
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="text-muted-foreground">{item.value} leads</p>
    </div>
  );
}

export function ClassificationChart({ quente, morno, frio }: ClassificationChartProps) {
  const data = [
    { name: "Quente", value: quente, color: COLORS.QUENTE },
    { name: "Morno", value: morno, color: COLORS.MORNO },
    { name: "Frio", value: frio, color: COLORS.FRIO },
  ].filter((d) => d.value > 0);

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Distribuição por Classificação</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Qualificação via IA (Gemini)</p>

      <div className="mt-4 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={CustomLabel}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legenda manual */}
      <div className="mt-3 flex justify-center gap-5">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-xs text-muted-foreground">{item.name}</span>
            <span className="text-xs font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
