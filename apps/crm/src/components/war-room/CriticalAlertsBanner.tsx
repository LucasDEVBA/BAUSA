"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

interface CriticalAlertCounts {
  dealsWithoutAction48h: number;
  overdueInstallments: number;
  familiesInCrisis: number;
  proposalsWithoutFollowup48h: number;
  docsUrgentes: number;
}

interface CriticalAlertsBannerProps {
  counts: CriticalAlertCounts;
}

export function CriticalAlertsBanner({ counts }: CriticalAlertsBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  const totalCritical =
    counts.dealsWithoutAction48h +
    counts.overdueInstallments +
    counts.familiesInCrisis +
    counts.proposalsWithoutFollowup48h +
    (counts.docsUrgentes ?? 0);

  if (dismissed || totalCritical === 0) return null;

  const items: Array<{ label: string; count: number }> = [];

  if (counts.dealsWithoutAction48h > 0) {
    items.push({
      label: `${counts.dealsWithoutAction48h} deal${counts.dealsWithoutAction48h !== 1 ? "s" : ""} sem proxima acao ha 48h+`,
      count: counts.dealsWithoutAction48h,
    });
  }

  if (counts.overdueInstallments > 0) {
    items.push({
      label: `${counts.overdueInstallments} parcela${counts.overdueInstallments !== 1 ? "s" : ""} atrasada${counts.overdueInstallments !== 1 ? "s" : ""}`,
      count: counts.overdueInstallments,
    });
  }

  if (counts.familiesInCrisis > 0) {
    items.push({
      label: `${counts.familiesInCrisis} familia${counts.familiesInCrisis !== 1 ? "s" : ""} em crise`,
      count: counts.familiesInCrisis,
    });
  }

  if (counts.proposalsWithoutFollowup48h > 0) {
    items.push({
      label: `${counts.proposalsWithoutFollowup48h} proposta${counts.proposalsWithoutFollowup48h !== 1 ? "s" : ""} sem follow-up ha 48h+`,
      count: counts.proposalsWithoutFollowup48h,
    });
  }

  if ((counts.docsUrgentes ?? 0) > 0) {
    items.push({
      label: `${counts.docsUrgentes} documento${counts.docsUrgentes !== 1 ? "s" : ""} com deadline proximo (<14 dias)`,
      count: counts.docsUrgentes,
    });
  }

  return (
    <div className="glass-card relative overflow-hidden rounded-2xl !border-sys-red/25 p-4">
      <span
        aria-hidden
        className="pointer-events-none absolute left-3 top-4 h-4 w-[3px] rounded-full bg-sys-red"
      />
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sys-red/12 text-sys-red">
            <AlertTriangle className="size-[18px]" />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tabular-nums text-sys-red">{totalCritical}</span>
              <span className="text-sm font-semibold text-foreground">
                alerta{totalCritical !== 1 ? "s" : ""} crítico{totalCritical !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {items.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1 rounded-full bg-sys-red/8 px-2 py-0.5 text-[11px] font-medium text-sys-red/90"
                >
                  <span aria-hidden className="size-1 rounded-full bg-sys-red" />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-sys-red/10 hover:text-sys-red"
          aria-label="Dispensar alertas"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
