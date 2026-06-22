"use client";

import { useDroppable } from "@dnd-kit/core";
import { type Deal, type DealStage, DEAL_STAGE_CONFIG } from "@/types/deal";
import { DealCard } from "./DealCard";
import { cn } from "@/lib/utils";

interface PipelineColumnProps {
  stage: DealStage;
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
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
}: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const config = DEAL_STAGE_CONFIG[stage];
  const totalValue = deals.reduce((sum, d) => sum + d.deal_value_brl, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[252px] shrink-0 flex-col rounded-lg border border-border bg-card/40 transition-colors",
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn("h-1.5 w-1.5 shrink-0 rounded-full", config.dotColor)}
          />
          <span className="truncate text-[11px] font-semibold text-foreground">
            {config.shortLabel}
          </span>
          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
            · {deals.length}
          </span>
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
            <p className="text-[10px] text-muted-foreground/60">vazio</p>
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
