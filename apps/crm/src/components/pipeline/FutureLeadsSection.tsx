"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, RotateCcw, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { type Deal } from "@/types/deal";
import { moverDeal } from "@/lib/actions/deals";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface FutureLeadsSectionProps {
  deals: Deal[];
}

export function FutureLeadsSection({ deals }: FutureLeadsSectionProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isExpanded, setIsExpanded] = useState(true);
  const [reactivatingId, setReactivatingId] = useState<string | null>(null);

  const futureDeals = deals.filter((d) => d.stage === "projeto_futuro");

  if (futureDeals.length === 0) return null;

  const handleReactivate = (dealId: string) => {
    setReactivatingId(dealId);
    startTransition(async () => {
      const result = await moverDeal(dealId, "lead" as never, "Reativacao de lead futuro");
      if (result.success) {
        toast.success("Lead reativado e movido para pipeline");
        router.refresh();
      } else {
        toast.error(result.error ?? "Erro ao reativar lead");
      }
      setReactivatingId(null);
    });
  };

  return (
    <div className="rounded-xl border-sys-teal/20 border border-border/70 bg-card/60">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <CalendarClock className="h-4 w-4 text-sys-teal" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Leads Futuros</h2>
          <p className="text-[10px] text-muted-foreground">
            {futureDeals.length} lead{futureDeals.length !== 1 ? "s" : ""} com projeto futuro
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-border px-5 py-4">
          <div className="space-y-2">
            {futureDeals.map((d) => {
              const isReactivating = reactivatingId === d.id;
              const reactivationDate = d.future_reactivation_date
                ? new Date(d.future_reactivation_date)
                : null;
              const now = new Date();
              const isOverdue = reactivationDate
                ? reactivationDate <= now
                : false;
              const daysUntil = reactivationDate
                ? Math.ceil(
                    (reactivationDate.getTime() - now.getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                : null;
              const isWithin30Days =
                daysUntil !== null && daysUntil > 0 && daysUntil <= 30;

              return (
                <div
                  key={d.id}
                  className={cn(
                    "flex items-center gap-4 rounded-lg border px-4 py-3",
                    isOverdue
                      ? "border-sys-red/30 bg-sys-red/5"
                      : isWithin30Days
                      ? "border-sys-orange/30 bg-sys-orange/5"
                      : "border-border bg-background"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.athlete_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      {d.future_project_year && (
                        <span className="text-sys-teal font-semibold">
                          Projeto {d.future_project_year}
                        </span>
                      )}
                      {reactivationDate && isOverdue && (
                        <span className="text-sys-red font-semibold">
                          Reativacao vencida!
                        </span>
                      )}
                      {reactivationDate && isWithin30Days && (
                        <span className="text-sys-orange font-semibold">
                          Reativacao em {daysUntil} dia{daysUntil !== 1 ? "s" : ""}
                        </span>
                      )}
                      {reactivationDate && !isOverdue && !isWithin30Days && (
                        <span className="text-muted-foreground">
                          Reativacao: {reactivationDate.toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {d.lost_reason && (
                        <span className="text-label-tertiary truncate max-w-[200px]">
                          Motivo: {d.lost_reason}
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => handleReactivate(d.id)}
                    disabled={isPending}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                      isOverdue
                        ? "border-sys-red/30 bg-sys-red/10 text-sys-red hover:bg-sys-red/20"
                        : isWithin30Days
                        ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange hover:bg-sys-orange/20"
                        : "border-border bg-card text-muted-foreground hover:bg-fill-4 hover:text-foreground",
                      "disabled:opacity-40"
                    )}
                  >
                    {isReactivating ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3 w-3" />
                    )}
                    Reativar
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
