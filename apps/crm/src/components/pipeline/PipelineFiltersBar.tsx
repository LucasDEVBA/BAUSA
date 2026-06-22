"use client";

import { LayoutGrid, List, Search, Users, X } from "lucide-react";
import type { LeadClassification } from "@/types/lead";
import type { ProductTier } from "@/types/deal";
import { cn } from "@/lib/utils";

export type PipelineView = "kanban" | "tabela";

export interface PipelineFiltersState {
  search: string;
  classificacao: LeadClassification | "TODAS";
  plano: ProductTier | "TODOS";
  comAtraso: boolean;
  filterMode: "todos" | "meus";
}

interface Props {
  view: PipelineView;
  onViewChange: (v: PipelineView) => void;
  filters: PipelineFiltersState;
  onFiltersChange: (f: PipelineFiltersState) => void;
  totalDeals: number;
  filteredDeals: number;
  hasCurrentUser: boolean;
}

const CLASSIFICATION_OPTIONS: Array<{
  value: PipelineFiltersState["classificacao"];
  label: string;
  cls: string;
}> = [
  { value: "TODAS", label: "Todas", cls: "" },
  {
    value: "QUENTE",
    label: "Quente",
    cls: "data-[active=true]:bg-sys-green/15 data-[active=true]:text-sys-green data-[active=true]:border-sys-green/30",
  },
  {
    value: "MORNO",
    label: "Morno",
    cls: "data-[active=true]:bg-sys-orange/15 data-[active=true]:text-sys-orange data-[active=true]:border-sys-orange/30",
  },
  {
    value: "FRIO",
    label: "Frio",
    cls: "data-[active=true]:bg-sys-blue/15 data-[active=true]:text-sys-blue data-[active=true]:border-sys-blue/30",
  },
];

const PLANO_OPTIONS: Array<{
  value: PipelineFiltersState["plano"];
  label: string;
}> = [
  { value: "TODOS", label: "Todos" },
  { value: "Legacy", label: "Legacy" },
  { value: "Journey", label: "Journey" },
  { value: "Start", label: "Start" },
];

function emptyFilters(): PipelineFiltersState {
  return {
    search: "",
    classificacao: "TODAS",
    plano: "TODOS",
    comAtraso: false,
    filterMode: "todos",
  };
}

export function PipelineFiltersBar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  totalDeals,
  filteredDeals,
  hasCurrentUser,
}: Props) {
  const hasActiveFilter =
    filters.search.trim() !== "" ||
    filters.classificacao !== "TODAS" ||
    filters.plano !== "TODOS" ||
    filters.comAtraso ||
    filters.filterMode === "meus";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card/60 px-3 py-2">
      {/* Busca */}
      <div className="relative flex items-center">
        <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          placeholder="Buscar atleta, responsável ou esporte…"
          className="h-8 w-64 rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: "" })}
            className="absolute right-1 rounded p-0.5 text-muted-foreground hover:bg-secondary"
            title="Limpar busca"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Classificação */}
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
        {CLASSIFICATION_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            data-active={filters.classificacao === opt.value}
            onClick={() =>
              onFiltersChange({ ...filters, classificacao: opt.value })
            }
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors data-[active=true]:border data-[active=false]:text-muted-foreground hover:text-foreground",
              opt.cls || "data-[active=true]:bg-secondary data-[active=true]:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Plano */}
      <select
        value={filters.plano}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            plano: e.target.value as PipelineFiltersState["plano"],
          })
        }
        className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary/40"
        title="Plano"
      >
        {PLANO_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            Plano: {p.label}
          </option>
        ))}
      </select>

      {/* Atraso */}
      <label
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
          filters.comAtraso
            ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
            : "border-border bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        <input
          type="checkbox"
          checked={filters.comAtraso}
          onChange={(e) =>
            onFiltersChange({ ...filters, comAtraso: e.target.checked })
          }
          className="sr-only"
        />
        Com atraso
      </label>

      {/* Meus/Todos */}
      {hasCurrentUser && (
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          {(["todos", "meus"] as const).map((m) => (
            <button
              key={m}
              data-active={filters.filterMode === m}
              onClick={() => onFiltersChange({ ...filters, filterMode: m })}
              className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:bg-secondary data-[active=true]:text-foreground hover:text-foreground"
            >
              {m === "meus" && <Users className="h-3 w-3" />}
              {m === "todos" ? "Todos" : "Meus"}
            </button>
          ))}
        </div>
      )}

      {/* Reset */}
      {hasActiveFilter && (
        <button
          onClick={() => onFiltersChange(emptyFilters())}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Limpar
        </button>
      )}

      {/* Contador */}
      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
        {filteredDeals === totalDeals
          ? `${totalDeals} deals`
          : `${filteredDeals} de ${totalDeals}`}
      </span>

      {/* Toggle de view */}
      <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
        <button
          onClick={() => onViewChange("kanban")}
          data-active={view === "kanban"}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:bg-secondary data-[active=true]:text-foreground hover:text-foreground"
          title="Visualização Kanban"
        >
          <LayoutGrid className="h-3 w-3" />
          Kanban
        </button>
        <button
          onClick={() => onViewChange("tabela")}
          data-active={view === "tabela"}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:bg-secondary data-[active=true]:text-foreground hover:text-foreground"
          title="Visualização em tabela"
        >
          <List className="h-3 w-3" />
          Tabela
        </button>
      </div>
    </div>
  );
}

export { emptyFilters as emptyPipelineFilters };
