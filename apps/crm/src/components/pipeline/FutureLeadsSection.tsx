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
    <div className="rounded-xl border border-cyan-500/20 bg-[#141720]">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left"
      >
        <CalendarClock className="h-4 w-4 text-cyan-400" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-white">Leads Futuros</h2>
          <p className="text-[10px] text-zinc-500">
            {futureDeals.length} lead{futureDeals.length !== 1 ? "s" : ""} com projeto futuro
          </p>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-500" />
        )}
      </button>

      {isExpanded && (
        <div className="border-t border-[#1e2130] px-5 py-4">
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
                      ? "border-red-500/30 bg-red-500/5"
                      : isWithin30Days
                      ? "border-amber-500/30 bg-amber-500/5"
                      : "border-[#1e2130] bg-[#0c0e16]"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{d.athlete_name}</p>
                    <div className="flex items-center gap-3 mt-1 text-[10px]">
                      {d.future_project_year && (
                        <span className="text-cyan-400 font-semibold">
                          Projeto {d.future_project_year}
                        </span>
                      )}
                      {reactivationDate && isOverdue && (
                        <span className="text-red-400 font-semibold">
                          Reativacao vencida!
                        </span>
                      )}
                      {reactivationDate && isWithin30Days && (
                        <span className="text-amber-400 font-semibold">
                          Reativacao em {daysUntil} dia{daysUntil !== 1 ? "s" : ""}
                        </span>
                      )}
                      {reactivationDate && !isOverdue && !isWithin30Days && (
                        <span className="text-zinc-500">
                          Reativacao: {reactivationDate.toLocaleDateString("pt-BR")}
                        </span>
                      )}
                      {d.lost_reason && (
                        <span className="text-zinc-600 truncate max-w-[200px]">
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
                        ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        : isWithin30Days
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        : "border-[#1e2130] bg-[#141720] text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
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
