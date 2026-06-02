"use client";

import { Heart } from "lucide-react";
import {
  calcularHealthScore,
  getHealthLevel,
  HEALTH_COLOR,
  HEALTH_LABEL,
  type HealthInput,
} from "@/lib/health-score";
import { cn } from "@/lib/utils";

interface HealthBadgeProps extends HealthInput {
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function HealthBadge({ size = "sm", showLabel = false, ...input }: HealthBadgeProps) {
  const score = calcularHealthScore(input);
  const level = getHealthLevel(score);
  const colors = HEALTH_COLOR[level];

  if (size === "lg") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 rounded-xl px-3 py-2 ring-1",
          colors.bg,
          colors.text,
          colors.ring,
        )}
      >
        <Heart className="h-4 w-4" />
        <div>
          <p className="text-lg font-bold leading-none">{score}</p>
          <p className="text-[10px] opacity-80 leading-tight mt-0.5">
            {HEALTH_LABEL[level]}
          </p>
        </div>
      </div>
    );
  }

  if (size === "md") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-2 py-1 ring-1",
          colors.bg,
          colors.text,
          colors.ring,
        )}
        title={`Health Score: ${score}/100 — ${HEALTH_LABEL[level]}`}
      >
        <Heart className="h-3 w-3" />
        <span className="text-xs font-bold">{score}</span>
        {showLabel && (
          <span className="text-[10px] opacity-80">{HEALTH_LABEL[level]}</span>
        )}
      </div>
    );
  }

  // size === sm
  return (
    <div
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 ring-1",
        colors.bg,
        colors.text,
        colors.ring,
      )}
      title={`Health Score: ${score}/100 — ${HEALTH_LABEL[level]}`}
    >
      <Heart className="h-2.5 w-2.5" />
      <span className="text-[10px] font-bold">{score}</span>
    </div>
  );
}

/** Versão grande para o header do modal — barra + score + breakdown */
export function HealthScoreCard(input: HealthInput) {
  const score = calcularHealthScore(input);
  const level = getHealthLevel(score);
  const colors = HEALTH_COLOR[level];

  return (
    <div
      className={cn(
        "rounded-xl border bg-gradient-to-br p-4",
        level === "excelente" && "border-emerald-500/30 from-emerald-500/10 to-emerald-500/5",
        level === "bom" && "border-blue-500/30 from-blue-500/10 to-blue-500/5",
        level === "atencao" && "border-amber-500/30 from-amber-500/10 to-amber-500/5",
        level === "critico" && "border-red-500/30 from-red-500/10 to-red-500/5",
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Heart className={cn("h-4 w-4", colors.text)} />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Health Score
          </p>
        </div>
        <span className={cn("text-[10px] font-bold uppercase", colors.text)}>
          {HEALTH_LABEL[level]}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("text-4xl font-bold tracking-tight", colors.text)}>
          {score}
        </span>
        <span className="text-sm text-zinc-500">/100</span>
      </div>
      <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            level === "excelente" && "bg-emerald-500",
            level === "bom" && "bg-blue-500",
            level === "atencao" && "bg-amber-500",
            level === "critico" && "bg-red-500",
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
