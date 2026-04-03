"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, AlertTriangle, CheckSquare } from "lucide-react";
import { marcarTarefaConcluida } from "@/lib/crm/actions/automacoes";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tarefa } from "@/types/crm";

interface TarefasListProps {
  tarefas: Tarefa[];
  papel: string;
}

const PRIORIDADE_ORDER = { critica: 0, alta: 1, media: 2, baixa: 3 };
const PRIORIDADE_COLORS: Record<string, string> = {
  critica: "bg-[var(--crm-error-subtle)] text-[var(--crm-error)] border-[var(--crm-error-border)]",
  alta: "bg-[var(--crm-warning-subtle)] text-[var(--crm-warning)] border-[var(--crm-warning-border)]",
  media: "bg-[var(--crm-info-subtle)] text-[var(--crm-info)] border-[var(--crm-info-border)]",
  baixa: "bg-[var(--crm-neutral-100)] text-[var(--crm-text-secondary)] border-[var(--crm-border)]",
};

export function TarefasList({ tarefas, papel }: TarefasListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState("pendente");
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();

  const hoje = new Date().toISOString();

  const filtered = tarefas
    .filter((t) => {
      if (filter !== "todas" && t.status !== filter) return false;
      if (search && !t.titulo.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      const pa = PRIORIDADE_ORDER[a.prioridade as keyof typeof PRIORIDADE_ORDER] ?? 9;
      const pb = PRIORIDADE_ORDER[b.prioridade as keyof typeof PRIORIDADE_ORDER] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.prazo).getTime() - new Date(b.prazo).getTime();
    });

  const handleConcluir = (tarefaId: string) => {
    startTransition(async () => {
      const result = await marcarTarefaConcluida(tarefaId);
      if (result.success) {
        toast.success("Tarefa concluida!");
        router.refresh();
      } else {
        toast.error(result.error || "Erro ao concluir tarefa.");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="flex rounded-[var(--crm-radius-lg)] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-0.5">
          {["pendente", "em_andamento", "concluida", "atrasada", "todas"].map((f) => (
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
              {f === "todas" ? "Todas" : f.replace("_", " ")}
            </button>
          ))}
        </div>
        <input
          placeholder="Buscar tarefa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="crm-input max-w-xs ml-auto"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="crm-card">
          <div className="crm-empty-state">
            <div className="crm-empty-state-icon">
              <CheckSquare className="h-5 w-5" />
            </div>
            <p className="crm-empty-state-title">Nenhuma tarefa encontrada</p>
            <p className="crm-empty-state-description">Ajuste os filtros para ver tarefas.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((tarefa) => {
            const vencida = tarefa.prazo < hoje && tarefa.status !== "concluida";
            return (
              <div key={tarefa.id} className={cn("crm-card !p-3", vencida && "border-[var(--crm-error-border)]")}>
                <div className="flex items-start gap-3">
                  {tarefa.status !== "concluida" && (
                    <Checkbox
                      checked={false}
                      disabled={isPending}
                      onCheckedChange={() => handleConcluir(tarefa.id)}
                      className="mt-1"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn(
                        "text-[var(--crm-text-sm)] font-[var(--crm-weight-medium)]",
                        tarefa.status === "concluida" ? "line-through text-[var(--crm-text-tertiary)]" : "text-[var(--crm-text-primary)]",
                      )}>
                        {tarefa.titulo}
                      </span>
                      <span className={cn("crm-badge crm-badge-no-dot text-[var(--crm-text-xs)]", PRIORIDADE_COLORS[tarefa.prioridade] || "")}>
                        {tarefa.prioridade}
                      </span>
                      {tarefa.criada_automaticamente && (
                        <span className="crm-badge crm-badge-neutral crm-badge-no-dot text-[var(--crm-text-xs)]">Auto</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">
                      <span className={cn("flex items-center gap-1", vencida && "text-[var(--crm-error)] font-[var(--crm-weight-medium)]")}>
                        {vencida && <AlertTriangle className="w-3 h-3" />}
                        <Clock className="w-3 h-3" />
                        {new Date(tarefa.prazo).toLocaleDateString("pt-BR")}
                      </span>
                      <span>{tarefa.modulo_origem}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
