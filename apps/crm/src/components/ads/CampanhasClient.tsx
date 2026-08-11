"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { CampanhaCard } from "@/components/ads/CampanhaCard";
import { OBJETIVO_LABEL, veiculacaoDe } from "@/components/ads/ads-labels";
import type { CampanhaAds, FunilCampanha } from "@/lib/meta-ads";
import { cn } from "@/lib/utils";

// Grid de campanhas com filtros client-side (veiculação + objetivo + busca)
// e clique → tela da campanha. Ordenação: ENTREGANDO primeiro (o que importa),
// depois ativas sem entrega, encerradas, pausadas — e gasto 30d dentro do grupo.

type FiltroVeiculacao = "todas" | "entregando" | "encerradas" | "pausadas" | "com_gasto" | "com_leads";

const FILTROS: Array<{ id: FiltroVeiculacao; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "entregando", label: "Entregando" },
  { id: "encerradas", label: "Encerradas" },
  { id: "pausadas", label: "Pausadas" },
  { id: "com_gasto", label: "Com gasto 30d" },
  { id: "com_leads", label: "Com leads" },
];

// entregando=0 · sem_entrega=1 · encerrada=2 · pausada/outras=3
const rankVeiculacao = (c: CampanhaAds): number => {
  const v = veiculacaoDe(c.status, c.fimEm, c.gasto7d);
  if (v === "entregando") return 0;
  if (v === "sem_entrega") return 1;
  if (v === "encerrada") return 2;
  return 3;
};

export function CampanhasClient({
  campanhas,
  funil,
}: {
  campanhas: CampanhaAds[];
  funil: Record<string, FunilCampanha>;
}) {
  const [filtro, setFiltro] = useState<FiltroVeiculacao>("todas");
  const [objetivo, setObjetivo] = useState<string>("todos");
  const [busca, setBusca] = useState("");

  // Objetivos presentes nos dados (rotulados), p/ o select
  const objetivos = useMemo(() => {
    const set = new Map<string, string>();
    for (const c of campanhas) {
      if (c.objetivo) set.set(c.objetivo, OBJETIVO_LABEL[c.objetivo] ?? c.objetivo);
    }
    return [...set.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [campanhas]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return campanhas
      .filter((c) => {
        const veic = veiculacaoDe(c.status, c.fimEm, c.gasto7d);
        if (filtro === "entregando" && veic !== "entregando") return false;
        if (filtro === "encerradas" && veic !== "encerrada") return false;
        if (filtro === "pausadas" && !c.status.includes("PAUSED")) return false;
        if (filtro === "com_gasto" && c.gasto30d <= 0) return false;
        if (filtro === "com_leads" && (funil[c.id]?.leadsTotal ?? 0) <= 0) return false;
        if (objetivo !== "todos" && c.objetivo !== objetivo) return false;
        if (termo && !c.nome.toLowerCase().includes(termo)) return false;
        return true;
      })
      .sort((a, b) => {
        const ra = rankVeiculacao(a);
        const rb = rankVeiculacao(b);
        return ra !== rb ? ra - rb : b.gasto30d - a.gasto30d || b.gastoVida - a.gastoVida;
      });
  }, [campanhas, funil, filtro, objetivo, busca]);

  return (
    <div className="space-y-4">
      {/* Barra de filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar campanhas por veiculação" className="flex flex-wrap gap-1.5">
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
        <div className="ml-auto flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <label className="sr-only" htmlFor="ads-objetivo">Filtrar por objetivo</label>
          <select
            id="ads-objetivo"
            value={objetivo}
            onChange={(e) => setObjetivo(e.target.value)}
            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="todos">Todos os objetivos</option>
            {objetivos.map(([valor, label]) => (
              <option key={valor} value={valor}>{label}</option>
            ))}
          </select>
          <div className="relative w-full sm:w-56">
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
      </div>

      {visiveis.length === 0 ? (
        <EmptyState title="Nenhuma campanha com esses filtros" description="Ajuste a veiculação, o objetivo ou o termo de busca." />
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
