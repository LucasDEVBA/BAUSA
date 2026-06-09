"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import { Search, Filter, Plus, X, GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";
import { listarContatosEscola } from "@/lib/actions/escolas";
import {
  SCHOOL_STATUS_CONFIG,
  SCHOOL_TYPE_CONFIG,
  type School,
  type SchoolType,
  type SchoolStatus,
} from "@/types/school";
import { SchoolCard } from "./SchoolCard";
import { SchoolDetailSheet } from "./SchoolDetailSheet";
import { SchoolFormSheet } from "./SchoolFormSheet";

interface ContatoEscola {
  id: string;
  escola_id: string;
  data_contato: string;
  tipo_contato: string;
  resumo: string;
  created_at: string;
}

const TYPE_ORDER: readonly SchoolType[] = [
  "Division I",
  "Division II",
  "Division III",
  "NAIA",
  "JUCO",
];
const STATUS_FILTERS: readonly SchoolStatus[] = ["ativa", "em_avaliacao", "inativa"];

const inputClass =
  "w-full rounded-md border border-input bg-card py-2 text-sm text-foreground placeholder:text-placeholder focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";
const selectClass =
  "appearance-none rounded-md border border-input bg-card py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30";

interface EscolasClientProps {
  schools: School[];
}

export function EscolasClient({ schools }: EscolasClientProps) {
  const [selectedSchool, setSelectedSchool] = useState<School | null>(null);
  const [contatos, setContatos] = useState<ContatoEscola[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<SchoolType | "todos">("todos");
  const [statusFilter, setStatusFilter] = useState<SchoolStatus | "todos">("todos");
  // Lazy initializer roda uma única vez na montagem — valor estável para os cálculos de "dias atrás".
  const [now] = useState(() => Date.now());
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!selectedSchool) return;
    let active = true;
    startTransition(async () => {
      const result = await listarContatosEscola(selectedSchool.id);
      if (active && result.success) {
        setContatos(result.data as ContatoEscola[]);
      }
    });
    return () => {
      active = false;
    };
  }, [selectedSchool]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter((school) => {
      if (typeFilter !== "todos" && school.type !== typeFilter) return false;
      if (statusFilter !== "todos" && school.status !== statusFilter) return false;
      if (!q) return true;
      return (
        school.name.toLowerCase().includes(q) ||
        school.city.toLowerCase().includes(q) ||
        school.state.toLowerCase().includes(q)
      );
    });
  }, [schools, query, typeFilter, statusFilter]);

  const grouped = useMemo(
    () =>
      TYPE_ORDER.map((type) => ({
        type,
        items: filtered.filter((school) => school.type === type),
      })).filter((group) => group.items.length > 0),
    [filtered],
  );

  const hasFilters =
    query.trim() !== "" || typeFilter !== "todos" || statusFilter !== "todos";

  const clearFilters = () => {
    setQuery("");
    setTypeFilter("todos");
    setStatusFilter("todos");
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1 lg:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, cidade ou estado..."
            className={cn(inputClass, "pl-9 pr-9")}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Filter className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as SchoolType | "todos")}
              className={cn(selectClass, "pl-8 pr-7")}
              aria-label="Filtrar por tipo"
            >
              <option value="todos">Todos os tipos</option>
              {TYPE_ORDER.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SchoolStatus | "todos")}
            className={cn(selectClass, "px-3")}
            aria-label="Filtrar por status"
          >
            <option value="todos">Todos os status</option>
            {STATUS_FILTERS.map((status) => (
              <option key={status} value={status}>
                {SCHOOL_STATUS_CONFIG[status].label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setIsCreating(true)}
          className="flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 lg:ml-auto"
        >
          <Plus className="h-4 w-4" />
          Adicionar escola
        </button>
      </div>

      {/* Resultados */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl py-12 text-center">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-label-tertiary" />
          <p className="text-sm text-muted-foreground">
            {schools.length === 0
              ? "Nenhuma escola cadastrada ainda."
              : "Nenhuma escola encontrada para os filtros aplicados."}
          </p>
          {schools.length === 0 ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              Cadastrar primeira escola
            </button>
          ) : (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <p className="text-xs text-label-tertiary">
            {filtered.length} {filtered.length === 1 ? "escola" : "escolas"}
            {hasFilters ? ` de ${schools.length}` : ""}
          </p>
          {grouped.map(({ type, items }) => {
            const typeCfg = SCHOOL_TYPE_CONFIG[type];
            return (
              <div key={type}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={cn("rounded-md border px-2.5 py-1 text-xs font-bold", typeCfg.bg, typeCfg.color)}>
                    {type}
                  </span>
                  <p className="text-xs text-label-tertiary">
                    {items.length} escola{items.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((school) => (
                    <SchoolCard key={school.id} school={school} onSelect={setSelectedSchool} now={now} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sheets */}
      <SchoolFormSheet open={isCreating} onClose={() => setIsCreating(false)} />
      {selectedSchool && (
        <SchoolDetailSheet
          school={selectedSchool}
          contatos={contatos}
          open={!!selectedSchool}
          onClose={() => {
            setSelectedSchool(null);
            setContatos([]);
          }}
        />
      )}
    </div>
  );
}
