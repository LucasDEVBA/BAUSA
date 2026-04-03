import { FileX, AlertCircle, Clock, DollarSign } from "lucide-react";
import { type RevenueAtRiskMetrics } from "@/types/revenue";

interface RiskRevenueCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count?: number;
  valueUsd: number;
  severity: "critical" | "warning";
  description: string;
}

function RiskRevenueCard({ icon: Icon, label, count, valueUsd, severity, description }: RiskRevenueCardProps) {
  const styles = {
    critical: {
      border: "border-red-500/20",
      bg: "bg-red-500/5",
      iconBg: "bg-red-500/10",
      icon: "text-red-400",
      value: "text-red-400",
      badge: "bg-red-500/20 text-red-400 border-red-500/30",
    },
    warning: {
      border: "border-amber-500/20",
      bg: "bg-amber-500/5",
      iconBg: "bg-amber-500/10",
      icon: "text-amber-400",
      value: "text-amber-400",
      badge: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    },
  };
  const s = styles[severity];

  return (
    <div className={`rounded-xl border p-4 ${s.border} ${s.bg}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${s.iconBg}`}>
          <Icon className={`h-4.5 w-4.5 ${s.icon}`} />
        </div>
        {count !== undefined && (
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.badge}`}>
            {count} {count === 1 ? "item" : "itens"}
          </span>
        )}
      </div>
      <p className={`mt-3 text-xl font-bold tabular-nums ${s.value}`}>
        US$ {(valueUsd / 1000).toFixed(0)}k
      </p>
      <p className="mt-0.5 text-xs font-medium text-zinc-300">{label}</p>
      <p className="mt-1 text-[10px] text-zinc-600 leading-relaxed">{description}</p>
    </div>
  );
}

interface RiskRevenueSectionProps {
  data: RevenueAtRiskMetrics;
}

export function RiskRevenueSection({ data }: RiskRevenueSectionProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      <RiskRevenueCard
        icon={FileX}
        label="Contratos sem Assinatura"
        count={data.contracts_without_signature_count}
        valueUsd={data.contracts_without_signature_usd}
        severity="warning"
        description="Negociações concluídas aguardando assinatura formal do contrato."
      />
      <RiskRevenueCard
        icon={AlertCircle}
        label="Sinais Não Pagos"
        count={data.unpaid_signals_count}
        valueUsd={data.unpaid_signals_usd}
        severity="critical"
        description="Contratos assinados onde o sinal inicial ainda não foi recebido."
      />
      <RiskRevenueCard
        icon={Clock}
        label="Remanescentes Pendentes"
        count={data.pending_remaining_count}
        valueUsd={data.pending_remaining_usd}
        severity="warning"
        description="Matrículas confirmadas com parcela final ainda em aberto."
      />
      <RiskRevenueCard
        icon={DollarSign}
        label="Recebíveis Vencidos"
        valueUsd={data.overdue_receivables_usd}
        severity="critical"
        description="Valores com prazo de pagamento expirado. Ação de cobrança necessária."
      />
    </div>
  );
}
