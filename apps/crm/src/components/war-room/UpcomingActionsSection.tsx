import { cn } from "@/lib/utils";
import { CalendarClock, AlertTriangle } from "lucide-react";
import type { UpcomingAction } from "@/lib/war-room-queries";

interface UpcomingActionsSectionProps {
  actions: UpcomingAction[];
}

export function UpcomingActionsSection({ actions }: UpcomingActionsSectionProps) {
  if (actions.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">Proximas Acoes</h3>
        <p className="text-xs text-muted-foreground">Nenhuma acao programada para os proximos 3 dias.</p>
      </div>
    );
  }

  const overdueCount = actions.filter((a) => a.is_overdue).length;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="mb-4 flex items-center justify-between">
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
      <div className="space-y-2">
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
      </div>
    </div>
  );
}
