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
    { label: "Leads Qualificados", value: data.leads_qualified, color: "text-zinc-300", bg: "bg-zinc-700/30" },
    { label: "Reuniões Realizadas", value: data.meetings_done, color: "text-indigo-300", bg: "bg-indigo-500/10" },
    { label: "Propostas Enviadas", value: data.proposals_sent, color: "text-blue-300", bg: "bg-blue-500/10" },
    { label: "Contratos Assinados", value: data.contracts_signed, color: "text-violet-300", bg: "bg-violet-500/10" },
    { label: "Sinais Pagos", value: data.signals_paid, color: "text-cyan-300", bg: "bg-cyan-500/10" },
    { label: "Concluídos", value: data.auto_conversions, color: "text-emerald-300", bg: "bg-emerald-500/10" },
  ];

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <h3 className="text-sm font-semibold text-zinc-100">Funil Comercial</h3>
      <p className="mt-0.5 text-xs text-zinc-500">Performance por etapa do processo de vendas</p>

      <div className="mt-5 flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((step, idx) => (
          <div key={step.label} className="flex items-center gap-1">
            <div className={`flex flex-col items-center rounded-xl border border-[#1e2130] px-3 py-3 ${step.bg} min-w-[100px]`}>
              <p className={`text-2xl font-bold tabular-nums ${step.color}`}>{step.value}</p>
              <p className="mt-1 text-center text-[9px] text-zinc-500 leading-tight">{step.label}</p>
              {idx > 0 && (
                <p className="mt-1 text-[9px] font-semibold text-zinc-600">
                  {conversionRate(steps[idx - 1].value, step.value)} conv.
                </p>
              )}
            </div>
            {idx < steps.length - 1 && (
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-zinc-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
