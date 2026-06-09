"use client";

import { Users, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineFilterToggleProps {
  filterMode: "todos" | "meus";
  onFilterChange: (mode: "todos" | "meus") => void;
  totalCount: number;
  filteredCount: number;
}

export function PipelineFilterToggle({
  filterMode,
  onFilterChange,
  totalCount,
  filteredCount,
}: PipelineFilterToggleProps) {
  const count = filterMode === "meus" ? filteredCount : totalCount;

  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-1 rounded-lg border border-border bg-popover p-1">
        <button
          onClick={() => onFilterChange("todos")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            filterMode === "todos"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-fill-3 hover:text-foreground"
          )}
        >
          <Users className="h-3.5 w-3.5" />
          Todos
        </button>
        <button
          onClick={() => onFilterChange("meus")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            filterMode === "meus"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-fill-3 hover:text-foreground"
          )}
        >
          <User className="h-3.5 w-3.5" />
          Meus
        </button>
      </div>
      <span className="text-[10px] text-label-tertiary">
        {count} deal{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
