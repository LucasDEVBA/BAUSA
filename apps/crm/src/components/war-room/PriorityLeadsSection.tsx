import { cn } from "@/lib/utils";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import type { PriorityLead } from "@/lib/war-room-queries";

const CLASSIFICATION_CONFIG = {
  hot: { label: "Quente", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: Flame },
  warm: { label: "Morno", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20", icon: Thermometer },
  cold: { label: "Frio", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: Snowflake },
} as const;

interface PriorityLeadsSectionProps {
  leads: PriorityLead[];
}

export function PriorityLeadsSection({ leads }: PriorityLeadsSectionProps) {
  if (leads.length === 0) {
    return (
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Leads Prioritarios</h3>
        <p className="text-xs text-zinc-500">Nenhum lead com score calculado.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Leads Prioritarios</h3>
        <span className="text-[10px] font-medium text-zinc-600">Top 10 por Score</span>
      </div>
      <div className="space-y-2">
        {leads.map((lead) => {
          const cfg = lead.classification ? CLASSIFICATION_CONFIG[lead.classification] : null;
          const Icon = cfg?.icon;
          const daysColor =
            lead.days_since_last_action > 7
              ? "text-red-400"
              : lead.days_since_last_action > 3
              ? "text-amber-400"
              : "text-zinc-500";

          return (
            <div
              key={lead.id}
              className="flex items-center gap-3 rounded-lg border border-[#1e2130] bg-[#0f1117] px-3 py-2.5 transition-colors hover:bg-[#1a1f2e]"
            >
              {/* Score */}
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-500/10">
                <span className="text-xs font-bold text-indigo-400">{lead.lead_score}</span>
              </div>

              {/* Name + action */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{lead.name}</p>
                <p className="text-[10px] text-zinc-500 truncate">
                  {lead.next_action || "Sem proxima acao"}
                </p>
              </div>

              {/* Classification badge */}
              {cfg && Icon && (
                <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold", cfg.bg, cfg.color)}>
                  <Icon className="h-2.5 w-2.5" />
                  {cfg.label}
                </span>
              )}

              {/* Days since last action */}
              <span className={cn("text-[10px] font-medium flex-shrink-0", daysColor)}>
                {lead.days_since_last_action}d
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
