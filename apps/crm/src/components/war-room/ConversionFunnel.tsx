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
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-lg">
      <p className="font-medium text-foreground">{item.name}</p>
      <p className="text-muted-foreground">{item.value} leads</p>
    </div>
  );
}

interface ConversionFunnelProps {
  data: ConversionFunnelStep[];
}

export function ConversionFunnel({ data }: ConversionFunnelProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-foreground">Funil de Conversão</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Leads → Contratos</p>

      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart>
            <Tooltip content={<CustomTooltip />} />
            <Funnel dataKey="value" data={data} isAnimationActive>
              <LabelList
                position="right"
                fill="var(--chart-grid)"
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
