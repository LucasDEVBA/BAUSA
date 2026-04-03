"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, type PieLabelRenderProps } from "recharts";
import { type PositioningMetrics } from "@/types/revenue";

const TIER_COLORS = {
  Legacy: "#a78bfa",
  Journey: "#60a5fa",
  Start: "#71717a",
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
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
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
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-zinc-100">{payload[0].name}</p>
      <p className="text-zinc-400">{payload[0].value}% do mix</p>
    </div>
  );
}

interface PositioningSectionProps {
  data: PositioningMetrics;
}

export function PositioningSection({ data }: PositioningSectionProps) {
  const pieData = [
    { name: "Legacy", value: data.pct_legacy },
    { name: "Journey", value: data.pct_journey },
    { name: "Start", value: data.pct_start },
  ];

  const tiers = [
    { name: "Legacy", pct: data.pct_legacy, color: TIER_COLORS.Legacy, description: "Premium — acesso completo" },
    { name: "Journey", pct: data.pct_journey, color: TIER_COLORS.Journey, description: "Intermediário — foco na jornada" },
    { name: "Start", pct: data.pct_start, color: TIER_COLORS.Start, description: "Entrada — início da jornada" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Donut de mix de produto */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Mix de Produto</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Distribuição de contratos por tier</p>
        <div className="mt-4 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={2}
                dataKey="value"
                labelLine={false}
                label={CustomLabel}
              >
                {pieData.map((entry) => (
                  <Cell key={entry.name} fill={TIER_COLORS[entry.name as keyof typeof TIER_COLORS]} stroke="transparent" />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 space-y-2">
          {tiers.map((tier) => (
            <div key={tier.name} className="flex items-center gap-2.5">
              <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: tier.color }} />
              <span className="text-xs font-medium text-zinc-300 w-14">{tier.name}</span>
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full" style={{ width: `${tier.pct}%`, backgroundColor: tier.color }} />
              </div>
              <span className="text-xs text-zinc-500 w-8 text-right">{tier.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabela ticket + desconto */}
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="text-sm font-semibold text-zinc-100">Indicadores Comerciais</h3>
        <p className="mt-0.5 text-xs text-zinc-500">Ticket, desconto e posicionamento</p>

        <div className="mt-5 space-y-4">
          <div className="rounded-lg border border-[#1e2130] bg-[#0f1117] p-4">
            <p className="text-xs text-zinc-500">Ticket Médio</p>
            <p className="mt-1 text-3xl font-bold text-zinc-100">
              US$ {(data.avg_ticket_usd / 1000).toFixed(1)}k
            </p>
            <p className="mt-0.5 text-[10px] text-zinc-600">Por contrato fechado</p>
          </div>

          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
            <p className="text-xs text-zinc-500">Contratos com Desconto</p>
            <p className="mt-1 text-3xl font-bold text-amber-400">{data.pct_discounted}%</p>
            <p className="mt-0.5 text-[10px] text-zinc-600">
              {data.pct_discounted > 20 ? "Acima do limite recomendado (20%)" : "Dentro do limite recomendado"}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {tiers.map((tier) => (
              <div key={tier.name} className="rounded-lg border border-[#1e2130] p-2 text-center">
                <p className="text-[10px] text-zinc-600">{tier.name}</p>
                <p className="text-base font-bold" style={{ color: tier.color }}>{tier.pct}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
