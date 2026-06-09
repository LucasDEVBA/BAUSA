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
    <div className="sticky top-0 z-30 rounded-xl border border-sys-red/30 bg-sys-red/10 px-5 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sys-red/20">
            <AlertTriangle className="h-4 w-4 text-sys-red" />
          </div>
          <div>
            <p className="text-sm font-bold text-sys-red">
              {totalCritical} alerta{totalCritical !== 1 ? "s" : ""} critico{totalCritical !== 1 ? "s" : ""}
            </p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {items.map((item) => (
                <p key={item.label} className="text-xs text-sys-red/80">
                  {item.label}
                </p>
              ))}
            </div>
          </div>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-sys-red hover:bg-sys-red/20 hover:text-sys-red/70 transition-colors"
          aria-label="Dispensar alertas"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
