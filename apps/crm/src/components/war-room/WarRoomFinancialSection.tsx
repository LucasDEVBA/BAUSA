import { DollarSign, AlertTriangle, FileText, TrendingUp } from "lucide-react";
import { StatCard } from "@/components/ui";
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
  return (
    <div>
      <p className="mb-3 text-eyebrow text-label-tertiary">Financeiro</p>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Receita recebida (mês)"
          value={formatBRL(data.receita_recebida_mes)}
          icon={DollarSign}
          accent="green"
        />
        <StatCard
          label="Inadimplência"
          value={formatBRL(data.inadimplencia)}
          context={`${data.inadimplencia_count} parcela${data.inadimplencia_count !== 1 ? "s" : ""}`}
          icon={AlertTriangle}
          accent={data.inadimplencia > 0 ? "red" : "green"}
        />
        <StatCard
          label="NFs pendentes"
          value={String(data.nfs_pendentes)}
          icon={FileText}
          accent={data.nfs_pendentes > 0 ? "orange" : "green"}
        />
        <StatCard
          label="Previsão 30d"
          value={formatBRL(data.previsao_30d)}
          icon={TrendingUp}
          accent="blue"
        />
      </div>
    </div>
  );
}
