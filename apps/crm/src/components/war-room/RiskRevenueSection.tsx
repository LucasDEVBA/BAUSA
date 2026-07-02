import { FileX, AlertCircle, Clock, DollarSign } from "lucide-react";
import { StatCard } from "@/components/ui";
import { type RevenueAtRiskMetrics } from "@/types/revenue";

interface RiskRevenueSectionProps {
  data: RevenueAtRiskMetrics;
}

const fmt = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;
const nItens = (n: number) => `${n} ${n === 1 ? "item" : "itens"}`;

export function RiskRevenueSection({ data }: RiskRevenueSectionProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label="Contratos sem assinatura"
        value={fmt(data.contracts_without_signature_brl)}
        context={`${nItens(data.contracts_without_signature_count)} aguardando`}
        icon={FileX}
        accent="orange"
      />
      <StatCard
        label="Sinais não pagos"
        value={fmt(data.unpaid_signals_brl)}
        context={`${nItens(data.unpaid_signals_count)} pendentes`}
        icon={AlertCircle}
        accent="red"
      />
      <StatCard
        label="Remanescentes pendentes"
        value={fmt(data.pending_remaining_brl)}
        context={`${nItens(data.pending_remaining_count)} em aberto`}
        icon={Clock}
        accent="orange"
      />
      <StatCard
        label="Recebíveis vencidos"
        value={fmt(data.overdue_receivables_brl)}
        context="ação de cobrança necessária"
        icon={DollarSign}
        accent="red"
      />
    </div>
  );
}
