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
      color: "text-sys-green",
      bg: "bg-sys-green/10",
      border: "border-sys-green/20",
    },
    {
      label: "Inadimplencia",
      value: formatBRL(data.inadimplencia),
      sub: `${data.inadimplencia_count} parcela${data.inadimplencia_count !== 1 ? "s" : ""}`,
      icon: AlertTriangle,
      color: data.inadimplencia > 0 ? "text-sys-red" : "text-sys-green",
      bg: data.inadimplencia > 0 ? "bg-sys-red/10" : "bg-sys-green/10",
      border: data.inadimplencia > 0 ? "border-sys-red/20" : "border-sys-green/20",
    },
    {
      label: "NFs Pendentes",
      value: String(data.nfs_pendentes),
      icon: FileText,
      color: data.nfs_pendentes > 0 ? "text-sys-orange" : "text-sys-green",
      bg: data.nfs_pendentes > 0 ? "bg-sys-orange/10" : "bg-sys-green/10",
      border: data.nfs_pendentes > 0 ? "border-sys-orange/20" : "border-sys-green/20",
    },
    {
      label: "Previsao 30d",
      value: formatBRL(data.previsao_30d),
      icon: TrendingUp,
      color: "text-sys-blue",
      bg: "bg-sys-blue/10",
      border: "border-sys-blue/20",
    },
  ];

  return (
    <div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-label-tertiary">
        Financeiro
      </p>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={cn(
                "glass-card rounded-xl p-4 hover:shadow-md",
                card.border
              )}
            >
              <div className={cn("mb-3 flex h-9 w-9 items-center justify-center rounded-lg", card.bg)}>
                <Icon className={cn("h-4 w-4", card.color)} />
              </div>
              <p className={cn("text-xl font-bold", card.color)}>{card.value}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{card.label}</p>
              {"sub" in card && card.sub && (
                <p className="text-[10px] text-label-tertiary">{card.sub}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
