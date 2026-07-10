"use client";

import type { ReactNode } from "react";
import { useDroppable } from "@dnd-kit/core";
import type { QuadroColuna } from "@/types/crm";
import { cn } from "@/lib/utils";

interface TarefaColunaProps {
  coluna: { key: QuadroColuna; label: string; dot: string };
  count: number;
  children: ReactNode;
}

export function TarefaColuna({ coluna, count, children }: TarefaColunaProps) {
  const { setNodeRef, isOver } = useDroppable({ id: coluna.key });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[240px] flex-1 flex-col rounded-xl border border-border/70 bg-secondary/40 transition-colors",
        isOver && "border-primary/40 bg-primary/5",
      )}
    >
      <div className="flex items-center gap-1.5 px-2.5 py-2">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", coluna.dot)} />
        <span className="text-[11px] font-semibold text-foreground">{coluna.label}</span>
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
          {count}
        </span>
      </div>

      <div className="crm-scroll flex min-h-24 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {count === 0 ? (
          <div className="flex flex-1 items-center justify-center py-6">
            <p className="text-[10px] text-muted-foreground">vazio</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
