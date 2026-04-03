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
      <div className="flex gap-1 rounded-lg border border-[#1e2130] bg-[#0f1117] p-1">
        <button
          onClick={() => onFilterChange("todos")}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            filterMode === "todos"
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:bg-[#1e2130] hover:text-zinc-200"
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
              ? "bg-indigo-600 text-white"
              : "text-zinc-400 hover:bg-[#1e2130] hover:text-zinc-200"
          )}
        >
          <User className="h-3.5 w-3.5" />
          Meus
        </button>
      </div>
      <span className="text-[10px] text-zinc-600">
        {count} deal{count !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
