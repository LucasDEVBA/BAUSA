"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Gift, Check } from "lucide-react";
import { marcarRecompensaEntregue } from "@/lib/crm/actions/indicacoes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface IndicacoesListProps {
  indicacoes: any[];
}

const STATUS_COLORS: Record<string, string> = {
  pendente: "bg-[var(--crm-neutral-100)] text-[var(--crm-text-secondary)] border-[var(--crm-border)]",
  em_negociacao: "bg-[var(--crm-info-subtle)] text-[var(--crm-info)] border-[var(--crm-info-border)]",
  convertido: "bg-[var(--crm-success-subtle)] text-[var(--crm-success)] border-[var(--crm-success-border)]",
  perdido: "bg-[var(--crm-error-subtle)] text-[var(--crm-error)] border-[var(--crm-error-border)]",
};

export function IndicacoesList({ indicacoes }: IndicacoesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState("all");

  const total = indicacoes.length;
  const convertidos = indicacoes.filter((i) => i.status === "convertido").length;
  const taxaConversao = total > 0 ? ((convertidos / total) * 100).toFixed(0) : "0";
  const recompensasPendentes = indicacoes.filter((i) => i.recompensa_devida && !i.recompensa_entregue).length;

  const filtered = filter === "all"
    ? indicacoes
    : indicacoes.filter((i) => i.status === filter);

  const handleRecompensa = (id: string) => {
    startTransition(async () => {
      const result = await marcarRecompensaEntregue(id, "Recompensa entregue pelo CEO");
      if (result.success) {
        toast.success("Recompensa marcada como entregue!");
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="crm-card text-center">
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Total indicacoes</p>
          <p className="text-2xl font-[var(--crm-weight-bold)] text-[var(--crm-text-primary)] mt-1">{total}</p>
        </div>
        <div className="crm-card text-center">
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Taxa de conversao</p>
          <p className="text-2xl font-[var(--crm-weight-bold)] text-[var(--crm-success)] mt-1">{taxaConversao}%</p>
        </div>
        <div className={cn("crm-card text-center", recompensasPendentes > 0 && "border-[var(--crm-warning-border)]")}>
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">Recompensas pendentes</p>
          <p className="text-2xl font-[var(--crm-weight-bold)] text-[var(--crm-warning)] mt-1">{recompensasPendentes}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex rounded-[var(--crm-radius-lg)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-0.5 w-fit">
        {["all", "pendente", "em_negociacao", "convertido", "perdido"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-[var(--crm-radius-md)] px-3 py-1.5 text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)]",
              "transition-all duration-[var(--crm-duration-fast)]",
              filter === f
                ? "bg-[var(--crm-accent-bg-hover)] text-[var(--crm-accent-text)]"
                : "text-[var(--crm-text-tertiary)] hover:text-[var(--crm-text-secondary)]",
            )}
          >
            {f === "all" ? "Todas" : f.replace("_", " ")}
          </button>
        ))}
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="crm-card">
          <div className="crm-empty-state">
            <div className="crm-empty-state-icon">
              <Gift className="h-5 w-5" />
            </div>
            <p className="crm-empty-state-title">Nenhuma indicacao encontrada</p>
            <p className="crm-empty-state-description">Ajuste os filtros para ver indicacoes.</p>
          </div>
        </div>
      ) : (
        <div className="crm-card !p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Quem indicou</th>
                  <th>Atleta indicado</th>
                  <th>Status</th>
                  <th>Recompensa</th>
                  <th>Data</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((ind: any) => (
                  <tr key={ind.id}>
                    <td className="font-[var(--crm-weight-medium)] text-[var(--crm-text-primary)]">{ind.indicador?.nome || "\u2014"}</td>
                    <td className="text-[var(--crm-text-secondary)]">{ind.atleta?.nome_completo || "\u2014"}</td>
                    <td>
                      <span className={cn("crm-badge crm-badge-no-dot text-[var(--crm-text-xs)]", STATUS_COLORS[ind.status] || "")}>
                        {ind.status.replace("_", " ")}
                      </span>
                    </td>
                    <td>
                      {ind.recompensa_devida ? (
                        ind.recompensa_entregue ? (
                          <span className="crm-badge crm-badge-success crm-badge-no-dot text-[var(--crm-text-xs)]">
                            <Check className="w-3 h-3" /> Entregue
                          </span>
                        ) : (
                          <span className="crm-badge crm-badge-warning crm-badge-no-dot text-[var(--crm-text-xs)]">Pendente</span>
                        )
                      ) : (
                        <span className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">\u2014</span>
                      )}
                    </td>
                    <td className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">
                      {new Date(ind.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td>
                      {ind.recompensa_devida && !ind.recompensa_entregue && (
                        <button
                          className="crm-btn crm-btn-secondary text-[var(--crm-text-xs)]"
                          disabled={isPending}
                          onClick={() => handleRecompensa(ind.id)}
                        >
                          {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Gift className="w-3 h-3" />}
                          Entregar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
