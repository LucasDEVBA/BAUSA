import { DollarSign, ArrowRight, TrendingUp } from "lucide-react";
import { type CashFlowMetrics } from "@/types/revenue";

interface CashFlowSectionProps {
  data: CashFlowMetrics;
}

export function CashFlowSection({ data }: CashFlowSectionProps) {
  const items = [
    {
      label: "Receita Líquida Recebida",
      sublabel: "Março 2026",
      value: data.net_received_brl,
      icon: DollarSign,
      color: "text-sys-green",
      border: "border-sys-green/20",
      bg: "bg-sys-green/5",
      iconBg: "bg-sys-green/10",
    },
    {
      label: "Prevista — 30 dias",
      sublabel: "Abril 2026",
      value: data.projected_30d_brl,
      icon: ArrowRight,
      color: "text-primary",
      border: "border-primary/20",
      bg: "bg-primary/5",
      iconBg: "bg-primary/10",
    },
    {
      label: "Prevista — 90 dias",
      sublabel: "Mai–Jun 2026",
      value: data.projected_90d_brl,
      icon: TrendingUp,
      color: "text-plan-legacy",
      border: "border-plan-legacy/20",
      bg: "bg-plan-legacy/5",
      iconBg: "bg-plan-legacy/10",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div
            key={item.label}
            className={`rounded-xl border p-4 ${item.border} ${item.bg}`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-[10px] text-label-tertiary">{item.sublabel}</p>
              </div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
            <p className={`mt-3 text-2xl font-bold tabular-nums ${item.color}`}>
              R$ {(item.value / 1000).toFixed(0)}k
            </p>
          </div>
        );
      })}
    </div>
  );
}
