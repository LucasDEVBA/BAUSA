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

export function PipelineColumn({ stage, deals, onDealClick }: PipelineColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const config = DEAL_STAGE_CONFIG[stage];
  const totalValue = deals.reduce((sum, d) => sum + d.deal_value_brl, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex w-[272px] flex-shrink-0 flex-col rounded-xl border border-[#1e2130] bg-[#0f1117]",
        isOver && "ring-2 ring-indigo-500/40 bg-indigo-500/5",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#1e2130] p-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", config.dotColor)} />
          <span className="text-xs font-semibold text-zinc-200">{config.shortLabel}</span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white/5 px-1.5 text-[10px] font-medium text-zinc-400">
            {deals.length}
          </span>
        </div>
      </div>

      {/* Total */}
      {deals.length > 0 && (
        <div className="border-b border-[#1e2130] px-3 py-1.5">
          <p className="text-[10px] text-zinc-500">
            Total:{" "}
            <span className="font-semibold text-zinc-400">
              R$ {totalValue.toLocaleString("pt-BR")}
            </span>
          </p>
        </div>
      )}

      {/* Cards — scroll vertical */}
      <div className="flex flex-1 flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-280px)]">
        {deals.length === 0 ? (
          <div className="flex flex-1 items-center justify-center py-8">
            <p className="text-[11px] text-zinc-600">Nenhum deal</p>
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
