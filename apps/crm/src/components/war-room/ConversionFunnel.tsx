"use client";

import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type ConversionFunnelStep } from "@/types/revenue";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-[#1e2130] bg-[#141720] px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-zinc-100">{item.name}</p>
      <p className="text-zinc-400">{item.value} leads</p>
    </div>
  );
}

interface ConversionFunnelProps {
  data: ConversionFunnelStep[];
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <h3 className="text-sm font-semibold text-zinc-100">Funil de Conversão</h3>
      <p className="mt-0.5 text-xs text-zinc-500">Leads → Contratos</p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart>
            <Tooltip content={<CustomTooltip />} />
            <Funnel dataKey="value" data={data} isAnimationActive>
              <LabelList
                position="right"
                fill="#a1a1aa"
                stroke="none"
                dataKey="label"
                style={{ fontSize: 11 }}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
