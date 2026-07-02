import { DollarSign, ArrowRight, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui";
import { type CashFlowMetrics } from "@/types/revenue";

interface CashFlowSectionProps {
  data: CashFlowMetrics;
}

const fmt = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;

export function CashFlowSection({ data }: CashFlowSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StatCard
        label="Receita líquida recebida"
        value={fmt(data.net_received_brl)}
        context="Março 2026"
        icon={DollarSign}
        accent="green"
      />
      <StatCard
        label="Prevista — 30 dias"
        value={fmt(data.projected_30d_brl)}
        context="Abril 2026"
        icon={ArrowRight}
        accent="blue"
      />
      <StatCard
        label="Prevista — 90 dias"
        value={fmt(data.projected_90d_brl)}
        context="Mai–Jun 2026"
        icon={TrendingUp}
        accent="purple"
      />
    </div>
  );
}
