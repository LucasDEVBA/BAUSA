import { DollarSign, AlertTriangle, FileText, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WarRoomFinancialSummary } from "@/lib/war-room-queries";

function formatBRL(val: number) {
  return val.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

interface WarRoomFinancialSectionProps {
  data: WarRoomFinancialSummary;
}

export function WarRoomFinancialSection({ data }: WarRoomFinancialSectionProps) {
  const cards = [
    {
      label: "Receita Recebida (mes)",
      value: formatBRL(data.receita_recebida_mes),
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    },
    {
      label: "Inadimplencia",
      value: formatBRL(data.inadimplencia),
      sub: `${data.inadimplencia_count} parcela${data.inadimplencia_count !== 1 ? "s" : ""}`,
      icon: AlertTriangle,
      color: data.inadimplencia > 0 ? "text-red-400" : "text-emerald-400",
      bg: data.inadimplencia > 0 ? "bg-red-500/10" : "bg-emerald-500/10",
      border: data.inadimplencia > 0 ? "border-red-500/20" : "border-emerald-500/20",
    },
    {
      label: "NFs Pendentes",
      value: String(data.nfs_pendentes),
      icon: FileText,
      color: data.nfs_pendentes > 0 ? "text-amber-400" : "text-emerald-400",
      bg: data.nfs_pendentes > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
      border: data.nfs_pendentes > 0 ? "border-amber-500/20" : "border-emerald-500/20",
    },
    {
      label: "Previsao 30d",
      value: formatBRL(data.previsao_30d),
      icon: TrendingUp,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      border: "border-blue-500/20",
    },
  ];

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-zinc-600">
        Financeiro
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={cn(
                "rounded-xl border bg-[#141720] p-4 transition-colors hover:bg-[#1a1f2e]",
                card.border
              )}
            >
              <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", card.bg)}>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
              <p className={cn("text-xl font-bold", card.color)}>{card.value}</p>
              <p className="mt-0.5 text-xs text-zinc-500">{card.label}</p>
              {"sub" in card && card.sub && (
                <p className="text-[10px] text-zinc-600">{card.sub}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
