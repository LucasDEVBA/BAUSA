import { ArrowRight } from "lucide-react";
import { type CommercialFunnelMetrics } from "@/types/revenue";

interface FunnelStep {
  label: string;
  value: number;
  color: string;
  bg: string;
}

function conversionRate(from: number, to: number) {
  if (from === 0) return "—";
  return `${Math.round((to / from) * 100)}%`;
}

interface CommercialFunnelSectionProps {
  data: CommercialFunnelMetrics;
}

export function CommercialFunnelSection({ data }: CommercialFunnelSectionProps) {
  const steps: FunnelStep[] = [
    { label: "Leads Qualificados", value: data.leads_qualified, color: "text-muted-foreground", bg: "bg-secondary/50" },
    { label: "Reuniões Realizadas", value: data.meetings_done, color: "text-primary", bg: "bg-primary/10" },
    { label: "Propostas Enviadas", value: data.proposals_sent, color: "text-sys-blue", bg: "bg-sys-blue/10" },
    { label: "Contratos Assinados", value: data.contracts_signed, color: "text-plan-journey", bg: "bg-plan-journey/10" },
    { label: "Sinais Pagos", value: data.signals_paid, color: "text-sys-teal", bg: "bg-sys-teal/10" },
    { label: "Concluídos", value: data.auto_conversions, color: "text-sys-green", bg: "bg-sys-green/10" },
  ];

  return (
    <div className="glass-card rounded-xl p-5">
      <h3 className="text-sm font-semibold text-foreground">Funil Comercial</h3>
      <p className="mt-0.5 text-xs text-muted-foreground">Performance por etapa do processo de vendas</p>

      <div className="mt-5 flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex items-center gap-1">
            <div className={`flex flex-col items-center rounded-xl border border-border px-3 py-3 ${step.bg} min-w-[100px]`}>
              <p className={`text-2xl font-bold tabular-nums ${step.color}`}>{step.value}</p>
              <p className="mt-1 text-center text-[9px] text-muted-foreground leading-tight">{step.label}</p>
              {idx > 0 && (
                <p className="mt-1 text-[9px] font-semibold text-label-tertiary">
                  {conversionRate(steps[idx - 1].value, step.value)} conv.
                </p>
              )}
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-border" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
