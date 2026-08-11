"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import type { CampanhaRoi } from "@/lib/cac-queries";
import { cn } from "@/lib/utils";

// Tabela de ROI com filtros client-side: busca por nome + recortes de
// resultado (com gasto / com leads / com clientes / ROI positivo).

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type FiltroRoi = "todas" | "com_gasto" | "com_leads" | "com_clientes" | "roi_positivo";

const FILTROS: Array<{ id: FiltroRoi; label: string }> = [
  { id: "todas", label: "Todas" },
  { id: "com_gasto", label: "Com gasto" },
  { id: "com_leads", label: "Com leads" },
  { id: "com_clientes", label: "Com clientes" },
  { id: "roi_positivo", label: "ROI positivo" },
];

export function RoiTabela({ campanhas }: { campanhas: CampanhaRoi[] }) {
  const [filtro, setFiltro] = useState<FiltroRoi>("todas");
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return campanhas.filter((c) => {
      if (filtro === "com_gasto" && c.gasto <= 0) return false;
      if (filtro === "com_leads" && c.leads <= 0) return false;
      if (filtro === "com_clientes" && c.clientes <= 0) return false;
      if (filtro === "roi_positivo" && !(c.roi !== null && c.roi >= 0)) return false;
      if (termo && !(c.campanhaNome ?? c.campanhaId).toLowerCase().includes(termo)) return false;
      return true;
    });
  }, [campanhas, filtro, busca]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Filtrar campanhas do ROI" className="flex flex-wrap gap-1.5">
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
        <EmptyState title="Nenhuma campanha com esses filtros" description="Ajuste o recorte ou o termo de busca." />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-label-tertiary">
                  <th className="px-4 py-3 font-semibold">Campanha</th>
                  <th className="px-3 py-3 text-right font-semibold">Gasto</th>
                  <th className="px-3 py-3 text-right font-semibold">Leads</th>
                  <th className="px-3 py-3 text-right font-semibold">Qualif.</th>
                  <th className="px-3 py-3 text-right font-semibold">Clientes</th>
                  <th className="px-3 py-3 text-right font-semibold">Receita</th>
                  <th className="px-3 py-3 text-right font-semibold">CAC/lead</th>
                  <th className="px-4 py-3 text-right font-semibold">ROI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visiveis.map((c) => (
                  <tr key={c.campanhaId} className="transition-colors hover:bg-secondary/60">
                    <td className="max-w-[280px] px-4 py-3">
                      <Link href={`/ads/campanha/${c.campanhaId}`} className="block truncate font-semibold text-foreground hover:text-primary" title={c.campanhaNome ?? c.campanhaId}>
                        {c.campanhaNome ?? c.campanhaId}
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">{brl.format(c.gasto)}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{c.leads}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{c.leadsQualificados}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{c.clientes}</td>
                    <td className="px-3 py-3 text-right font-semibold text-foreground">{c.receita > 0 ? brl.format(c.receita) : "—"}</td>
                    <td className="px-3 py-3 text-right text-muted-foreground">{c.cacLead !== null ? brl.format(c.cacLead) : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {c.roi !== null ? (
                        <Badge tone={c.roi >= 0 ? "green" : "red"}>{`${(c.roi * 100).toFixed(0)}%`}</Badge>
                      ) : (
                        <span className="text-label-tertiary">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
