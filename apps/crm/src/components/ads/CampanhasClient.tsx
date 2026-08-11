"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { CampanhaCard } from "@/components/ads/CampanhaCard";
import type { CampanhaAds, FunilCampanha } from "@/lib/meta-ads";
import { cn } from "@/lib/utils";

// Grid de campanhas com filtros client-side (status + busca) e clique →
// tela da campanha. Ordenação: ATIVAS primeIRO (decisão do CEO), depois gasto.

type FiltroStatus = "todas" | "ativas" | "pausadas" | "com_gasto";

const FILTROS: Array<{ id: FiltroStatus; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "ativas", label: "Ativas" },
  { id: "pausadas", label: "Pausadas" },
  { id: "com_gasto", label: "Com gasto 30d" },
];

const ehAtiva = (c: CampanhaAds): boolean => c.status === "ACTIVE";
const ehPausada = (c: CampanhaAds): boolean => c.status.includes("PAUSED");

export function CampanhasClient({
  campanhas,
  funil,
}: {
  campanhas: CampanhaAds[];
  funil: Record<string, FunilCampanha>;
}) {
  const [filtro, setFiltro] = useState<FiltroStatus>("todas");
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return campanhas
      .filter((c) => {
        if (filtro === "ativas" && !ehAtiva(c)) return false;
        if (filtro === "pausadas" && !ehPausada(c)) return false;
        if (filtro === "com_gasto" && c.gasto30d <= 0) return false;
        if (termo && !c.nome.toLowerCase().includes(termo)) return false;
        return true;
      })
      .sort((a, b) => {
        const ativaA = ehAtiva(a) ? 0 : 1;
        const ativaB = ehAtiva(b) ? 0 : 1;
        return ativaA !== ativaB ? ativaA - ativaB : b.gasto30d - a.gasto30d;
      });
  }, [campanhas, filtro, busca]);

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar campanhas por status" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                filtro === f.id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label-tertiary" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar campanha…"
            aria-label="Buscar campanha por nome"
            className="pl-9"
          />
        </div>
        <Badge tone="neutral">{visiveis.length} de {campanhas.length}</Badge>
      </div>

      {visiveis.length === 0 ? (
        <EmptyState title="Nenhuma campanha com esses filtros" description="Ajuste o status ou o termo de busca." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {visiveis.map((c) => (
            <Link
              key={c.id}
              href={`/ads/campanha/${c.id}`}
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Abrir campanha ${c.nome}`}
            >
              <CampanhaCard campanha={c} funil={funil[c.id] ?? null} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
