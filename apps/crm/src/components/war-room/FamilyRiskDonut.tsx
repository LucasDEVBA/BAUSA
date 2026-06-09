"use client";

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";
import { type Family } from "@/types/family";

const RISK_COLORS: Record<string, string> = {
  Baixo: "var(--sys-green)",
  Médio: "var(--sys-yellow)",
  Alto: "var(--sys-orange)",
  Crítico: "var(--sys-red)",
};

function CustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: PieLabelRenderProps) {
  const safeCx = typeof cx === "number" ? cx : 0;
  const safeCy = typeof cy === "number" ? cy : 0;
  const safeMidAngle = typeof midAngle === "number" ? midAngle : 0;
  const safeInnerRadius = typeof innerRadius === "number" ? innerRadius : 0;
  const safeOuterRadius = typeof outerRadius === "number" ? outerRadius : 0;
  const safePercent = typeof percent === "number" ? percent : 0;

  if (safePercent < 0.08) return null;
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
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="text-muted-foreground">{item.value} {item.value === 1 ? "família" : "famílias"}</p>
    </div>
  );
}

interface FamilyRiskDonutProps {
  families: Family[];
}

export function FamilyRiskDonut({ families }: FamilyRiskDonutProps) {
  const LABEL_MAP: Record<string, string> = {
    baixo: "Baixo",
    medio: "Médio",
    alto: "Alto",
    critico: "Crítico",
  };

  const grouped = families.reduce<Record<string, number>>((acc, f) => {
    const label = f.risk_level ? LABEL_MAP[f.risk_level] : "Baixo";
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {});

  const data = Object.entries(grouped).map(([name, value]) => ({ name, value }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Distribuição de Risco</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Famílias por nível de risco</p>

      <div className="mt-4 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={75}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={CustomLabel}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={RISK_COLORS[entry.name]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {data.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: RISK_COLORS[item.name] }}
            />
            <span className="text-xs text-muted-foreground">{item.name}</span>
            <span className="text-xs font-semibold text-foreground">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
