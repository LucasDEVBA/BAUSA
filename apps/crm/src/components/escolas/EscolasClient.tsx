"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Plus, Search, X } from "lucide-react";

import { rotuloEstadoUs } from "@/lib/escolas/apresentacao";
import type { School } from "@/types/school";
import { Button, EmptyState, Input } from "@/components/ui";

import {
  PERFIL_OPTIONS,
  STATUS_OPTIONS,
  TIPO_OPTIONS,
  type PerfilEscola,
  type StatusEscola,
  type TipoEscola,
} from "./school-options";
import { SchoolCard } from "./SchoolCard";
import { SchoolDetailSheet } from "./SchoolDetailSheet";
import { SchoolFormSheet } from "./SchoolFormSheet";

const TODOS = "todos";
const SEM_PERFIL = "sem_perfil";

type FiltroTipo = TipoEscola | typeof TODOS;
type FiltroStatus = StatusEscola | typeof TODOS;
type FiltroPerfil = PerfilEscola | typeof SEM_PERFIL | typeof TODOS;

const selectClass =
  "h-9 w-full min-w-0 appearance-none rounded-md border border-input bg-card px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 sm:w-auto";

interface EscolasClientProps {
  schools: School[];
  historicoDisponivel: boolean;
  /** Gerado no servidor: cálculos de "dias atrás" puros e sem mismatch de hidratação. */
  agoraMs: number;
}

/**
 * Lista ÚNICA por nome (pedido do CEO: high schools não se agrupam por
 * "divisão"). Filtros: tipo, estado, status, perfil e — só quando houver
 * dado — esporte.
 */
export function EscolasClient({ schools, historicoDisponivel, agoraMs }: EscolasClientProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [query, setQuery] = useState("");
  const [tipo, setTipo] = useState<FiltroTipo>(TODOS);
  const [estado, setEstado] = useState<string>(TODOS);
  const [status, setStatus] = useState<FiltroStatus>(TODOS);
  const [perfil, setPerfil] = useState<FiltroPerfil>(TODOS);
  const [esporte, setEsporte] = useState<string>(TODOS);

  // Derivado da lista atual: após router.refresh() o detalhe mostra o dado novo.
  const selected = useMemo(
    () => schools.find((s) => s.id === selectedId) ?? null,
    [schools, selectedId],
  );

  const estados = useMemo(
    () => Array.from(new Set(schools.map((s) => s.estado_us))).sort(),
    [schools],
  );
  const esportes = useMemo(
    () => Array.from(new Set(schools.flatMap((s) => s.esportes_oferecidos))).sort(),
    [schools],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return schools.filter((s) => {
      if (tipo !== TODOS && s.tipo !== tipo) return false;
      if (estado !== TODOS && s.estado_us !== estado) return false;
      if (status !== TODOS && s.status !== status) return false;
      if (perfil === SEM_PERFIL && s.perfil !== null) return false;
      if (perfil !== TODOS && perfil !== SEM_PERFIL && s.perfil !== perfil) return false;
      if (esporte !== TODOS && !s.esportes_oferecidos.includes(esporte)) return false;
      if (!q) return true;
      return [s.nome, s.cidade, s.estado_us].some((campo) => campo.toLowerCase().includes(q));
    });
  }, [schools, query, tipo, estado, status, perfil, esporte]);

  const hasFilters =
    query.trim() !== "" ||
    tipo !== TODOS ||
    estado !== TODOS ||
    status !== TODOS ||
    perfil !== TODOS ||
    esporte !== TODOS;

  const clearFilters = () => {
    setQuery("");
    setTipo(TODOS);
    setEstado(TODOS);
    setStatus(TODOS);
    setPerfil(TODOS);
    setEsporte(TODOS);
  };

  return (
    <section aria-label="Lista de escolas" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative lg:w-72 lg:flex-none">
          <label htmlFor="escolas-busca" className="sr-only">
            Buscar escola
          </label>
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="escolas-busca"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, cidade ou estado…"
            className="pl-9 pr-9"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X aria-hidden className="size-3.5" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as FiltroTipo)}
            className={selectClass}
            aria-label="Filtrar por tipo"
          >
            <option value={TODOS}>Todos os tipos</option>
            {TIPO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            className={selectClass}
            aria-label="Filtrar por estado"
          >
            <option value={TODOS}>Todos os estados</option>
            {estados.map((uf) => (
              <option key={uf} value={uf}>
                {rotuloEstadoUs(uf)}
              </option>
            ))}
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as FiltroStatus)}
            className={selectClass}
            aria-label="Filtrar por status"
          >
            <option value={TODOS}>Todos os status</option>
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <select
            value={perfil}
            onChange={(e) => setPerfil(e.target.value as FiltroPerfil)}
            className={selectClass}
            aria-label="Filtrar por perfil"
          >
            <option value={TODOS}>Todos os perfis</option>
            {PERFIL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
            <option value={SEM_PERFIL}>Não classificado</option>
          </select>

          {esportes.length > 0 && (
            <select
              value={esporte}
              onChange={(e) => setEsporte(e.target.value)}
              className={selectClass}
              aria-label="Filtrar por esporte"
            >
              <option value={TODOS}>Todos os esportes</option>
              {esportes.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          )}
        </div>

        <Button onClick={() => setIsCreating(true)} className="lg:ml-auto">
          <Plus aria-hidden />
          Adicionar escola
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/60">
          <EmptyState
            icon={GraduationCap}
            title={schools.length === 0 ? "Nenhuma escola cadastrada ainda." : "Nenhuma escola para estes filtros."}
            action={
              schools.length === 0 ? (
                <Button onClick={() => setIsCreating(true)}>
                  <Plus aria-hidden />
                  Cadastrar primeira escola
                </Button>
              ) : (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
                >
                  Limpar filtros
                </button>
              )
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <p className="text-xs text-label-tertiary" aria-live="polite">
              {filtered.length} {filtered.length === 1 ? "escola" : "escolas"}
              {hasFilters ? ` de ${schools.length}` : ""}
            </p>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-medium text-primary transition-colors hover:text-primary/80"
              >
                Limpar filtros
              </button>
            )}
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((school) => (
              <li key={school.id} className="min-w-0">
                <SchoolCard
                  school={school}
                  onSelect={(s) => setSelectedId(s.id)}
                  agoraMs={agoraMs}
                  historicoDisponivel={historicoDisponivel}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <SchoolFormSheet open={isCreating} onClose={() => setIsCreating(false)} />
      {selected && (
        <SchoolDetailSheet
          key={selected.id}
          school={selected}
          agoraMs={agoraMs}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
}
