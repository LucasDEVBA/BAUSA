"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileText, Search } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

// Planos salvos do planejador com filtros client-side (status + busca).

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const dataCurta = (iso: string): string =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });

export interface PlanoResumo {
  id: string;
  titulo: string;
  status: string;
  campanhaId: string | null;
  orcamentoDiario: number | null;
  cplAlvo: number | null;
  criadoEm: string;
}

type FiltroPlano = "todos" | "rascunhos" | "executados" | "vinculados";

const FILTROS: Array<{ id: FiltroPlano; label: string }> = [
  { id: "todos", label: "Todos" },
  { id: "rascunhos", label: "Rascunhos" },
  { id: "executados", label: "Executados" },
  { id: "vinculados", label: "Vinculados a campanha" },
];

export function PlanosSalvos({ planos }: { planos: PlanoResumo[] }) {
  const [filtro, setFiltro] = useState<FiltroPlano>("todos");
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return planos.filter((p) => {
      if (filtro === "rascunhos" && p.status === "executado") return false;
      if (filtro === "executados" && p.status !== "executado") return false;
      if (filtro === "vinculados" && !p.campanhaId) return false;
      if (termo && !p.titulo.toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [planos, filtro, busca]);

  if (planos.length === 0) return null;

  return (
    <section>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-label-tertiary">
          Planos salvos ({visiveis.length} de {planos.length})
        </p>
        <div role="group" aria-label="Filtrar planos" className="flex flex-wrap gap-1.5">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFiltro(f.id)}
              aria-pressed={filtro === f.id}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                filtro === f.id
                  ? "border-primary/30 bg-primary/10 text-primary"
                  : "border-border bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto w-full sm:w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-label-tertiary" aria-hidden />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar plano…"
            aria-label="Buscar plano por título"
            className="pl-9"
          />
        </div>
      </div>
      {visiveis.length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhum plano com esses filtros.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visiveis.map((p) => (
            <Link
              key={p.id}
              href={`/ads/planejar/${p.id}`}
              className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="flex h-full flex-col gap-2 p-4 transition-shadow hover:shadow-lg">
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                  <p className="line-clamp-2 min-w-0 flex-1 text-xs font-bold leading-snug text-foreground" title={p.titulo}>
                    {p.titulo}
                  </p>
                </div>
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  <Badge tone={p.status === "executado" ? "green" : "blue"} size="sm">
                    {p.status === "executado" ? "Executado" : "Rascunho"}
                  </Badge>
                  {p.orcamentoDiario !== null ? <Badge tone="neutral" size="sm">{brl.format(p.orcamentoDiario)}/dia</Badge> : null}
                  {p.cplAlvo !== null ? <Badge tone="neutral" size="sm">CPL alvo {brl.format(p.cplAlvo)}</Badge> : null}
                  {p.campanhaId ? <Badge tone="green" size="sm">Vinculado</Badge> : null}
                  <span className="ml-auto text-[10px] text-label-tertiary">{p.criadoEm ? dataCurta(p.criadoEm) : ""}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
