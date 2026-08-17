"use client";

import { LayoutGrid, List, Search, X } from "lucide-react";
import type { LeadClassification } from "@/types/lead";
import type { ProductTier } from "@/types/deal";
import { PipelineSortMenu, type PipelineSortMode } from "./PipelineSortMenu";
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
  /** Modo comum quando TODAS as colunas coincidem; "padrao" quando divergem. */
  sortTodas: PipelineSortMode;
  /** "Aplicar a todas": seta o modo em todas as colunas e limpa overrides. */
  onSortTodasChange: (mode: PipelineSortMode) => void;
}

const CLASSIFICATION_OPTIONS: Array<{
  value: PipelineFiltersState["classificacao"];
  label: string;
  activeCls: string;
}> = [
  { value: "TODAS", label: "Todas", activeCls: "bg-secondary text-foreground" },
  {
    value: "QUENTE",
    label: "Quente",
    activeCls: "bg-sys-green/12 text-sys-green",
  },
  {
    value: "MORNO",
    label: "Morno",
    activeCls: "bg-sys-orange/12 text-sys-orange",
  },
  { value: "FRIO", label: "Frio", activeCls: "bg-sys-blue/12 text-sys-blue" },
];

const PLANO_OPTIONS: Array<{ value: PipelineFiltersState["plano"]; label: string }> = [
  { value: "TODOS", label: "Todos os planos" },
  { value: "Legacy", label: "Legacy" },
  { value: "Journey", label: "Journey" },
  { value: "Start", label: "Start" },
];

export function emptyPipelineFilters(): PipelineFiltersState {
  return {
    search: "",
    classificacao: "TODAS",
    plano: "TODOS",
    comAtraso: false,
    filterMode: "todos",
  };
}

function SegmentedToggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string; activeCls?: string; icon?: React.ReactNode }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex h-7 items-center gap-px rounded-md bg-secondary/40 p-0.5">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              "inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] font-medium transition-colors",
              active
                ? opt.activeCls ?? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function PipelineFiltersBar({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  totalDeals,
  filteredDeals,
  hasCurrentUser,
  sortTodas,
  onSortTodasChange,
}: Props) {
  const hasActive =
    filters.search.trim() !== "" ||
    filters.classificacao !== "TODAS" ||
    filters.plano !== "TODOS" ||
    filters.comAtraso ||
    filters.filterMode === "meus";

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {/* Busca */}
      <div className="relative flex items-center">
        <Search className="absolute left-2 h-3 w-3 text-muted-foreground" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          placeholder="Buscar…"
          className="h-7 w-48 rounded-md border border-border bg-background pl-6 pr-6 text-[11px] text-foreground placeholder:text-muted-foreground outline-none transition-colors focus:border-primary/40"
        />
        {filters.search && (
          <button
            onClick={() => onFiltersChange({ ...filters, search: "" })}
            className="absolute right-1 rounded p-0.5 text-muted-foreground hover:bg-secondary"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Classificação */}
      <SegmentedToggle
        options={CLASSIFICATION_OPTIONS}
        value={filters.classificacao}
        onChange={(v) => onFiltersChange({ ...filters, classificacao: v })}
      />

      {/* Plano (select pequeno) */}
      <select
        value={filters.plano}
        onChange={(e) =>
          onFiltersChange({
            ...filters,
            plano: e.target.value as PipelineFiltersState["plano"],
          })
        }
        className="h-7 rounded-md border border-border bg-background px-2 text-[11px] text-foreground outline-none transition-colors focus:border-primary/40"
      >
        {PLANO_OPTIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>

      {/* Atraso */}
      <button
        onClick={() =>
          onFiltersChange({ ...filters, comAtraso: !filters.comAtraso })
        }
        className={cn(
          "inline-flex h-7 items-center rounded-md border px-2 text-[11px] font-medium transition-colors",
          filters.comAtraso
            ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
            : "border-border bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        Com atraso
      </button>

      {/* Meus/Todos */}
      {hasCurrentUser && (
        <SegmentedToggle
          options={[
            { value: "todos", label: "Todos" },
            { value: "meus", label: "Meus" },
          ]}
          value={filters.filterMode}
          onChange={(v) => onFiltersChange({ ...filters, filterMode: v })}
        />
      )}

      {hasActive && (
        <button
          onClick={() => onFiltersChange(emptyPipelineFilters())}
          className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Limpar
        </button>
      )}

      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
        {filteredDeals === totalDeals
          ? `${totalDeals} deals`
          : `${filteredDeals} / ${totalDeals}`}
      </span>

      {view === "kanban" && (
        <PipelineSortMenu
          value={sortTodas}
          onChange={onSortTodasChange}
          ariaLabel="Ordenar todas as colunas"
          menuLabel="Ordenar todas as colunas"
        />
      )}

      <SegmentedToggle
        options={[
          {
            value: "kanban",
            label: "Kanban",
            icon: <LayoutGrid className="h-3 w-3" />,
          },
          {
            value: "tabela",
            label: "Tabela",
            icon: <List className="h-3 w-3" />,
          },
        ]}
        value={view}
        onChange={onViewChange}
      />
    </div>
  );
}
