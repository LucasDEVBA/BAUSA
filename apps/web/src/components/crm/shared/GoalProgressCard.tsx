import { TrendingUp, TrendingDown, Target } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  COMPONENT: GoalProgressCard
  IDENTITY:  BAUSA Elite — .crm-card base. KPI values: tabular-nums, bold,
             colored (success/accent/primary). Progress bars via
             .crm-progress-track + .crm-progress-fill. Status banner: tinted bg with border.
  CONTRAST:  Labels: --crm-text-tertiary on surface = 4.2:1 AA
             Values: success/accent/primary on surface = all >6:1 AA+
*/

interface GoalProgressCardProps {
  recebido: number;
  projetado: number;
  meta: number;
  periodo?: string;
}

export function GoalProgressCard({ recebido, projetado, meta, periodo = "Mes atual" }: GoalProgressCardProps) {
  const achievedPct = Math.min(Math.round((recebido / (meta || 1)) * 100), 100);
  const projectedPct = Math.min(Math.round((projetado / (meta || 1)) * 100), 100);
  const gap = recebido - meta;
  const isOnTrack = gap >= 0;

  const fmt = (v: number) => `R$ ${(v / 1000).toFixed(0)}k`;

  return (
    <div className="crm-card">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[var(--crm-text-base)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">
            Meta do Mes
          </p>
          <p className="mt-0.5 text-[var(--crm-text-sm)] text-[var(--crm-text-tertiary)]">{periodo}</p>
        </div>
        <div className={cn(
          "flex items-center gap-1.5 rounded-[var(--crm-radius-full)] border px-2.5 py-1 text-[var(--crm-text-sm)] font-[var(--crm-weight-semibold)]",
          isOnTrack
            ? "border-[var(--crm-success-border)] bg-[var(--crm-success-subtle)] text-[var(--crm-success)]"
            : "border-[var(--crm-error-border)] bg-[var(--crm-error-subtle)] text-[var(--crm-error)]",
        )}>
          {isOnTrack ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {isOnTrack ? "No target" : `Gap ${fmt(Math.abs(gap))}`}
        </div>
      </div>

      {/* KPI grid */}
      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)] text-[var(--crm-text-tertiary)]">Recebido</p>
          <p className="text-xl font-[var(--crm-weight-bold)] tabular-nums text-[var(--crm-success)]">{fmt(recebido)}</p>
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{achievedPct}% da meta</p>
        </div>
        <div>
          <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)] text-[var(--crm-text-tertiary)]">Projetado</p>
          <p className="text-xl font-[var(--crm-weight-bold)] tabular-nums text-[var(--crm-accent-text)]">{fmt(projetado)}</p>
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">{projectedPct}% da meta</p>
        </div>
        <div>
          <p className="text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)] text-[var(--crm-text-tertiary)]">Meta</p>
          <p className="text-xl font-[var(--crm-weight-bold)] tabular-nums text-[var(--crm-text-primary)]">{fmt(meta)}</p>
          <div className="mt-0.5 flex items-center gap-1">
            <Target className="h-3 w-3 text-[var(--crm-text-tertiary)]" />
            <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">mensal</span>
          </div>
        </div>
      </div>

      {/* Progress bars */}
      <div className="mt-4 space-y-2.5">
        <div className="space-y-1">
          <div className="flex justify-between text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">
            <span>Recebido</span>
            <span className="font-[var(--crm-weight-medium)] tabular-nums">{achievedPct}%</span>
          </div>
          <div className="crm-progress-track">
            <div
              className="crm-progress-fill bg-[var(--crm-success)]"
              style={{ width: `${achievedPct}%` }}
            />
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[var(--crm-text-xs)] text-[var(--crm-text-secondary)]">
            <span>Projetado</span>
            <span className="font-[var(--crm-weight-medium)] tabular-nums">{projectedPct}%</span>
          </div>
          <div className="crm-progress-track">
            <div
              className={cn(
                "crm-progress-fill",
                projectedPct >= 100 ? "bg-[var(--crm-success)]" : "crm-progress-fill-brand",
              )}
              style={{ width: `${projectedPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Status banner */}
      <div className={cn(
        "mt-4 flex items-center gap-2 rounded-[var(--crm-radius-xl)] border px-3 py-2.5",
        isOnTrack
          ? "border-[var(--crm-success-border)] bg-[var(--crm-success-subtle)]"
          : "border-[var(--crm-error-border)] bg-[var(--crm-error-subtle)]",
      )}>
        <p className="text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)]">
          {isOnTrack
            ? <span className="text-[var(--crm-success)]">Superando a meta em {fmt(gap)}</span>
            : <span className="text-[var(--crm-error)]">Faltam {fmt(Math.abs(gap))} para atingir a meta</span>
          }
        </p>
      </div>
    </div>
  );
}
