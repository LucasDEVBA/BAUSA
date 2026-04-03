import { cn } from "@/lib/utils";
import { CalendarClock, AlertTriangle } from "lucide-react";
import type { UpcomingAction } from "@/lib/war-room-queries";

interface UpcomingActionsSectionProps {
  actions: UpcomingAction[];
}

export function UpcomingActionsSection({ actions }: UpcomingActionsSectionProps) {
  if (actions.length === 0) {
    return (
      <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
        <h3 className="mb-3 text-sm font-semibold text-white">Proximas Acoes</h3>
        <p className="text-xs text-zinc-500">Nenhuma acao programada para os proximos 3 dias.</p>
      </div>
    );
  }

  const overdueCount = actions.filter((a) => a.is_overdue).length;

  return (
    <div className="rounded-xl border border-[#1e2130] bg-[#141720] p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-indigo-400" />
          <h3 className="text-sm font-semibold text-white">Proximas Acoes</h3>
        </div>
        {overdueCount > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-semibold text-red-400">
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
                "flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors hover:bg-[#1a1f2e]",
                action.is_overdue
                  ? "border-red-500/20 bg-red-500/5"
                  : "border-[#1e2130] bg-[#0f1117]"
              )}
            >
              {/* Date */}
              <div
                className={cn(
                  "flex h-8 w-12 flex-shrink-0 items-center justify-center rounded-lg text-xs font-bold",
                  action.is_overdue
                    ? "bg-red-500/15 text-red-400"
                    : "bg-zinc-800 text-zinc-300"
                )}
              >
                {formattedDate}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{action.athlete_name}</p>
                <p className="text-[10px] text-zinc-500 truncate">{action.next_action}</p>
              </div>

              {/* Overdue indicator */}
              {action.is_overdue && (
                <span className="text-[10px] font-bold text-red-400 flex-shrink-0">ATRASADO</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
