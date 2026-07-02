"use client";

import { LayoutGrid, List, Search, X } from "lucide-react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export type FamiliasView = "kanban" | "tabela";

export interface FamiliasFiltersState {
  search: string;
  status: "TODOS" | "satisfeita" | "atencao" | "crise";
  temperatura: "TODAS" | "verde" | "amarelo" | "vermelho";
  semContato: boolean; // > 15d
}

interface Props {
  view: FamiliasView;
  onViewChange: (v: FamiliasView) => void;
  filters: FamiliasFiltersState;
  onFiltersChange: (f: FamiliasFiltersState) => void;
  total: number;
  filtered: number;
}

const STATUS_OPTIONS: Array<{
  value: FamiliasFiltersState["status"];
  label: string;
  cls: string;
}> = [
  { value: "TODOS", label: "Todos", cls: "" },
  {
    value: "satisfeita",
    label: "Satisfeita",
    cls: "data-[active=true]:bg-sys-green/15 data-[active=true]:text-sys-green data-[active=true]:border-sys-green/30",
  },
  {
    value: "atencao",
    label: "Atenção",
    cls: "data-[active=true]:bg-sys-orange/15 data-[active=true]:text-sys-orange data-[active=true]:border-sys-orange/30",
  },
  {
    value: "crise",
    label: "Crise",
    cls: "data-[active=true]:bg-sys-red/15 data-[active=true]:text-sys-red data-[active=true]:border-sys-red/30",
  },
];

const TEMP_OPTIONS: Array<{
  value: FamiliasFiltersState["temperatura"];
  label: string;
  cls: string;
}> = [
  { value: "TODAS", label: "Todas", cls: "" },
  {
    value: "verde",
    label: "Verde",
    cls: "data-[active=true]:bg-sys-green/15 data-[active=true]:text-sys-green data-[active=true]:border-sys-green/30",
  },
  {
    value: "amarelo",
    label: "Amarela",
    cls: "data-[active=true]:bg-sys-orange/15 data-[active=true]:text-sys-orange data-[active=true]:border-sys-orange/30",
  },
  {
    value: "vermelho",
    label: "Vermelha",
    cls: "data-[active=true]:bg-sys-red/15 data-[active=true]:text-sys-red data-[active=true]:border-sys-red/30",
  },
];

export function emptyFamiliasFilters(): FamiliasFiltersState {
  return {
    search: "",
    status: "TODOS",
    temperatura: "TODAS",
    semContato: false,
  };
}

export function FamiliasPipelineFilters({
  view,
  onViewChange,
  filters,
  onFiltersChange,
  total,
  filtered,
}: Props) {
  const hasActiveFilter =
    filters.search.trim() !== "" ||
    filters.status !== "TODOS" ||
    filters.temperatura !== "TODAS" ||
    filters.semContato;

  return (
    <Card padding="none" className="flex flex-wrap items-center gap-2 px-3 py-2">
      <div className="relative flex items-center">
        <Search className="absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          placeholder="Buscar família ou responsável…"
          className="h-8 w-64 rounded-md border border-border bg-background pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
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

      <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            data-active={filters.status === opt.value}
            onClick={() =>
              onFiltersChange({ ...filters, status: opt.value })
            }
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors data-[active=true]:border data-[active=false]:text-muted-foreground hover:text-foreground",
              opt.cls ||
                "data-[active=true]:bg-secondary data-[active=true]:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
        {TEMP_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            data-active={filters.temperatura === opt.value}
            onClick={() =>
              onFiltersChange({ ...filters, temperatura: opt.value })
            }
            className={cn(
              "rounded px-2 py-1 text-[11px] font-medium transition-colors data-[active=true]:border data-[active=false]:text-muted-foreground hover:text-foreground",
              opt.cls ||
                "data-[active=true]:bg-secondary data-[active=true]:text-foreground",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <label
        className={cn(
          "inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
          filters.semContato
            ? "border-sys-orange/30 bg-sys-orange/10 text-sys-orange"
            : "border-border bg-background text-muted-foreground hover:text-foreground",
        )}
      >
        <input
          type="checkbox"
          checked={filters.semContato}
          onChange={(e) =>
            onFiltersChange({ ...filters, semContato: e.target.checked })
          }
          className="sr-only"
        />
        Sem contato &gt; 15d
      </label>

      {hasActiveFilter && (
        <button
          onClick={() => onFiltersChange(emptyFamiliasFilters())}
          className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <X className="h-3 w-3" />
          Limpar
        </button>
      )}

      <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">
        {filtered === total ? `${total} famílias` : `${filtered} de ${total}`}
      </span>

      <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
        <button
          onClick={() => onViewChange("kanban")}
          data-active={view === "kanban"}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:bg-secondary data-[active=true]:text-foreground hover:text-foreground"
        >
          <LayoutGrid className="h-3 w-3" />
          Kanban
        </button>
        <button
          onClick={() => onViewChange("tabela")}
          data-active={view === "tabela"}
          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors data-[active=true]:bg-secondary data-[active=true]:text-foreground hover:text-foreground"
        >
          <List className="h-3 w-3" />
          Tabela
        </button>
      </div>
    </Card>
  );
}
