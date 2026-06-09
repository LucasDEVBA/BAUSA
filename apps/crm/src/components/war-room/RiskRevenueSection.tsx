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
      border: "border-sys-red/20",
      bg: "bg-sys-red/5",
      iconBg: "bg-sys-red/10",
      icon: "text-sys-red",
      value: "text-sys-red",
      badge: "bg-sys-red/20 text-sys-red border-sys-red/30",
    },
    warning: {
      border: "border-sys-orange/20",
      bg: "bg-sys-orange/5",
      iconBg: "bg-sys-orange/10",
      icon: "text-sys-orange",
      value: "text-sys-orange",
      badge: "bg-sys-orange/20 text-sys-orange border-sys-orange/30",
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
      <p className="mt-0.5 text-xs font-medium text-foreground">{label}</p>
      <p className="mt-1 text-[10px] text-label-tertiary leading-relaxed">{description}</p>
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
