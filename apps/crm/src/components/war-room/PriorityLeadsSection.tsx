import { cn } from "@/lib/utils";
import { Flame, Thermometer, Snowflake } from "lucide-react";
import { ScrollList } from "@/components/ui";
import type { PriorityLead } from "@/lib/war-room-queries";

const CARD_HEIGHT = "flex h-[24rem] flex-col";

const CLASSIFICATION_CONFIG = {
  hot: { label: "Quente", color: "text-lead-hot", bg: "bg-lead-hot/10 border-lead-hot/20", icon: Flame },
  warm: { label: "Morno", color: "text-lead-warm", bg: "bg-lead-warm/10 border-lead-warm/20", icon: Thermometer },
  cold: { label: "Frio", color: "text-lead-cold", bg: "bg-lead-cold/10 border-lead-cold/20", icon: Snowflake },
} as const;

interface PriorityLeadsSectionProps {
  leads: PriorityLead[];
}

export function PriorityLeadsSection({ leads }: PriorityLeadsSectionProps) {
  if (leads.length === 0) {
    return (
      <div className={cn("rounded-2xl glass-card p-4", CARD_HEIGHT)}>
        <h3 className="mb-3 shrink-0 text-sm font-semibold text-foreground">Leads Prioritarios</h3>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">Nenhum lead com score calculado.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl glass-card p-4", CARD_HEIGHT)}>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Leads Prioritarios</h3>
        <span className="text-[10px] font-medium text-label-tertiary">Top 10 por Score</span>
      </div>
      <ScrollList className="space-y-2">
        {leads.map((lead) => {
          const cfg = lead.classification ? CLASSIFICATION_CONFIG[lead.classification] : null;
          const Icon = cfg?.icon;
          const daysColor =
            lead.days_since_last_action > 7
              ? "text-sys-red"
              : lead.days_since_last_action > 3
              ? "text-sys-orange"
              : "text-muted-foreground";

          return (
            <div
              key={lead.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2.5 transition-colors hover:bg-accent"
            >
              {/* Name + action */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{lead.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
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
      </ScrollList>
    </div>
  );
}
