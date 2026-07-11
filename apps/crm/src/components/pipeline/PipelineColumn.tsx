"use client";

import { useDroppable } from "@dnd-kit/core";
import { type Deal, type DealStage } from "@/types/deal";
import {
  DEFAULT_DEAL_STAGE_DISPLAY,
  type DealStageConfigMap,
} from "@/lib/etapas-deal";
import { DealCard } from "./DealCard";
import { cn } from "@/lib/utils";

interface PipelineColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  /** Config de exibição das etapas (rótulo/cor/oculta) — default estático. */
  stageConfig?: DealStageConfigMap;
}

function fmtCompact(value: number): string {
  if (value >= 1_000_000) return `R$ ${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `R$ ${Math.round(value / 1_000)}k`;
  return `R$ ${value}`;
}

export function PipelineColumn({
  stage,
  deals,
  onDealClick,
  stageConfig = DEFAULT_DEAL_STAGE_DISPLAY,
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const config = stageConfig[stage];
  const totalValue = deals.reduce((sum, d) => sum + d.deal_value_brl, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[252px] shrink-0 flex-col rounded-xl border border-border/70 bg-secondary/40 transition-colors",
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn("h-2 w-2 shrink-0 rounded-full", config.dotColor)}
          />
          <span className="truncate text-[11px] font-semibold text-foreground">
            {config.shortLabel}
          </span>
          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {deals.length}
          </span>
          {config.oculta && (
            <span
              className="shrink-0 rounded-sm bg-secondary px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
              title="Coluna marcada como oculta nas configurações — visível porque ainda tem deals (deals nunca são escondidos)."
            >
              Oculta
            </span>
          )}
        </div>
        {totalValue > 0 && (
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            {fmtCompact(totalValue)}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {deals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-[10px] text-muted-foreground">vazio</p>
          </div>
        ) : (
          deals.map((deal) => (
            <DealCard
              key={deal.id}
              deal={deal}
              onClick={() => onDealClick(deal)}
            />
          ))
        )}
      </div>
    </div>
  );
}
