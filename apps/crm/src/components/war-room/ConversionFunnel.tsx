"use client";

import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { type ConversionFunnelStep } from "@/types/revenue";
import { ChartCard } from "@/components/ui";

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border border-border bg-popover shadow-lg px-3 py-2 text-sm">
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
    <ChartCard title="Funil de Conversão" subtitle="Leads → Contratos">
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <FunnelChart>
            <Tooltip content={<CustomTooltip />} />
            <Funnel dataKey="value" data={data} isAnimationActive>
              <LabelList
                position="right"
                fill="var(--muted-foreground)"
                stroke="none"
                dataKey="label"
                style={{ fontSize: 11 }}
              />
            </Funnel>
          </FunnelChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
