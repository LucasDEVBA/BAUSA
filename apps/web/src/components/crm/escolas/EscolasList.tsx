"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Building2 } from "lucide-react";
import { EscolaModal } from "./EscolaModal";
import { cn } from "@/lib/utils";
import type { Escola } from "@/types/crm";

interface EscolasListProps {
  escolas: Escola[];
}

export function EscolasList({ escolas }: EscolasListProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selected, setSelected] = useState<Escola | null>(null);
  const [showNew, setShowNew] = useState(false);

  const filtered = escolas.filter((e) => {
    const matchSearch = !search
      || e.nome.toLowerCase().includes(search.toLowerCase())
      || e.estado_us.toLowerCase().includes(search.toLowerCase())
      || e.cidade.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" || e.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const tempColor: Record<string, string> = {
    forte: "bg-[var(--crm-success-subtle)] text-[var(--crm-success)] border-[var(--crm-success-border)]",
    bom: "bg-[var(--crm-info-subtle)] text-[var(--crm-info)] border-[var(--crm-info-border)]",
    neutro: "bg-[var(--crm-neutral-100)] text-[var(--crm-text-secondary)] border-[var(--crm-border)]",
    frio: "bg-[var(--crm-error-subtle)] text-[var(--crm-error)] border-[var(--crm-error-border)]",
  };

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--crm-text-tertiary)]" />
          <input placeholder="Buscar escola..." value={search} onChange={(e) => setSearch(e.target.value)} className="crm-input pl-9" />
        </div>
        <div className="flex rounded-[var(--crm-radius-lg)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-0.5">
          {["all", "ativa", "inativa", "em_analise"].map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "rounded-[var(--crm-radius-md)] px-3 py-1.5 text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)]",
                "transition-all duration-[var(--crm-duration-fast)]",
                filterStatus === s
                  ? "bg-[var(--crm-accent-bg-hover)] text-[var(--crm-accent-text)]"
                  : "text-[var(--crm-text-tertiary)] hover:text-[var(--crm-text-secondary)]",
              )}
            >
              {s === "all" ? "Todas" : s.replace("_", " ")}
            </button>
          ))}
        </div>
        <button onClick={() => setShowNew(true)} className="crm-btn crm-btn-primary">
          <Plus className="w-4 h-4" /> Nova Escola
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="crm-card">
          <div className="crm-empty-state">
            <div className="crm-empty-state-icon">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="crm-empty-state-title">Nenhuma escola encontrada</p>
            <p className="crm-empty-state-description">Ajuste os filtros ou adicione uma nova escola.</p>
          </div>
        </div>
      ) : (
        <div className="crm-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Escola</th>
                  <th>Local</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Budget (USD)</th>
                  <th>Aceitacao</th>
                  <th>Relacionamento</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((escola) => (
                  <tr key={escola.id} className="cursor-pointer" onClick={() => setSelected(escola)}>
                    <td className="font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{escola.nome}</td>
                    <td className="text-[var(--crm-text-sm)] text-[var(--crm-text-secondary)]">{escola.cidade}, {escola.estado_us}</td>
                    <td><span className="crm-badge crm-badge-neutral crm-badge-no-dot capitalize">{escola.tipo}</span></td>
                    <td>
                      <span className={cn(
                        "crm-badge crm-badge-no-dot capitalize",
                        escola.status === "ativa" ? "crm-badge-success" : "crm-badge-neutral",
                      )}>
                        {escola.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="text-[var(--crm-text-sm)] text-[var(--crm-text-secondary)]">
                      {escola.budget_minimo_usd ? `$${Number(escola.budget_minimo_usd).toLocaleString()}` : "\u2014"}
                      {escola.budget_forte_usd ? ` \u2013 $${Number(escola.budget_forte_usd).toLocaleString()}` : ""}
                    </td>
                    <td className="text-[var(--crm-text-sm)] text-[var(--crm-text-secondary)]">
                      {escola.total_aplicados > 0 ? `${Number(escola.taxa_aceitacao).toFixed(0)}% (${escola.total_aceitos}/${escola.total_aplicados})` : "\u2014"}
                    </td>
                    <td>
                      <span className={cn("crm-badge crm-badge-no-dot", tempColor[escola.temperatura_relacionamento] || tempColor.neutro)}>
                        {escola.temperatura_relacionamento}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <EscolaModal escola={selected || undefined} open={!!selected || showNew} onClose={() => { setSelected(null); setShowNew(false); }} isNew={showNew} />
    </>
  );
}
