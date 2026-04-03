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
      value: data.net_received_usd,
      icon: DollarSign,
      color: "text-emerald-400",
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/5",
      iconBg: "bg-emerald-500/10",
    },
    {
      label: "Prevista — 30 dias",
      sublabel: "Abril 2026",
      value: data.projected_30d_usd,
      icon: ArrowRight,
      color: "text-indigo-400",
      border: "border-indigo-500/20",
      bg: "bg-indigo-500/5",
      iconBg: "bg-indigo-500/10",
    },
    {
      label: "Prevista — 90 dias",
      sublabel: "Mai–Jun 2026",
      value: data.projected_90d_usd,
      icon: TrendingUp,
      color: "text-purple-400",
      border: "border-purple-500/20",
      bg: "bg-purple-500/5",
      iconBg: "bg-purple-500/10",
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
                <p className="text-xs text-zinc-400">{item.label}</p>
                <p className="text-[10px] text-zinc-600">{item.sublabel}</p>
              </div>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
            </div>
            <p className={`mt-3 text-2xl font-bold tabular-nums ${item.color}`}>
              US$ {(item.value / 1000).toFixed(0)}k
            </p>
          </div>
        );
      })}
    </div>
  );
}
