import { cn } from "@/lib/utils";
import { CalendarClock, AlertTriangle } from "lucide-react";
import { ScrollList } from "@/components/ui";
import type { UpcomingAction } from "@/lib/war-room-queries";

const CARD_HEIGHT = "flex h-[24rem] flex-col";

interface UpcomingActionsSectionProps {
  actions: UpcomingAction[];
}

export function UpcomingActionsSection({ actions }: UpcomingActionsSectionProps) {
  if (actions.length === 0) {
    return (
      <div className={cn("rounded-2xl glass-card p-4", CARD_HEIGHT)}>
        <h3 className="mb-3 shrink-0 text-sm font-semibold text-foreground">Proximas Acoes</h3>
        <div className="flex flex-1 items-center justify-center">
          <p className="text-xs text-muted-foreground">Nenhuma acao programada para os proximos 3 dias.</p>
        </div>
      </div>
    );
  }

  const overdueCount = actions.filter((a) => a.is_overdue).length;

  return (
    <div className={cn("rounded-2xl glass-card p-4", CARD_HEIGHT)}>
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Proximas Acoes</h3>
        </div>
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-sys-red/10 border border-sys-red/20 px-2 py-0.5 text-[10px] font-semibold text-sys-red">
            <AlertTriangle className="h-2.5 w-2.5" />
            {overdueCount} atrasada{overdueCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      <ScrollList className="space-y-2">
        {actions.map((action) => {
          const dateObj = new Date(action.date + "T00:00:00");
          const formattedDate = dateObj.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
          });

          return (
            <div
              key={action.id}
              className={cn(
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-accent",
                action.is_overdue
                  ? "border-sys-red/20 bg-sys-red/5"
                  : "border-border bg-popover"
              )}
            >
              {/* Date */}
              <div
                className={cn(
                  "flex h-8 w-12 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  action.is_overdue
                    ? "bg-sys-red/15 text-sys-red"
                    : "bg-secondary text-foreground"
                )}
              >
                {formattedDate}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{action.athlete_name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{action.next_action}</p>
              </div>

              {/* Overdue indicator */}
              {action.is_overdue && (
                <span className="text-[10px] font-bold text-sys-red flex-shrink-0">ATRASADO</span>
              )}
            </div>
          );
        })}
      </ScrollList>
    </div>
  );
}
