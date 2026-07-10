"use client";

import { useState, useTransition } from "react";
import { X, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Sprint, StatusSprint } from "@/types/crm";
import { criarSprint, atualizarSprint, excluirSprint } from "@/lib/actions/tarefas-kanban";

interface SprintModalProps {
  sprint: Sprint | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: (sprint: Sprint) => void;
  onDeleted: (sprintId: string) => void;
}

const STATUS_OPTS: { value: StatusSprint; label: string }[] = [
  { value: "planejada", label: "Planejada" },
  { value: "ativa", label: "Ativa" },
  { value: "concluida", label: "Concluída" },
];

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary focus:ring-1 focus:ring-primary/30";
const labelClass = "text-xs font-medium text-muted-foreground";

export function SprintModal({ sprint, canDelete, onClose, onSaved, onDeleted }: SprintModalProps) {
  // Modal remonta a cada abertura → estado inicial vem das props (sem effect).
  const [nome, setNome] = useState(() => sprint?.nome ?? "");
  const [objetivo, setObjetivo] = useState(() => sprint?.objetivo ?? "");
  const [dataInicio, setDataInicio] = useState(() => sprint?.data_inicio ?? "");
  const [dataFim, setDataFim] = useState(() => sprint?.data_fim ?? "");
  const [status, setStatus] = useState<StatusSprint>(() => sprint?.status ?? "planejada");
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    if (!nome.trim()) {
      toast.error("Nome da sprint é obrigatório");
      return;
    }
    startTransition(async () => {
      if (sprint) {
        const result = await atualizarSprint(sprint.id, {
          nome,
          objetivo,
          data_inicio: dataInicio || null,
          data_fim: dataFim || null,
          status,
        });
        if (result.success) {
          onSaved({
            ...sprint,
            nome: nome.trim(),
            objetivo: objetivo.trim() || null,
            data_inicio: dataInicio || null,
            data_fim: dataFim || null,
            status,
          });
          toast.success("Sprint atualizada");
        } else {
          toast.error(result.error ?? "Erro ao salvar sprint");
        }
      } else {
        const result = await criarSprint({
          nome,
          objetivo,
          data_inicio: dataInicio || undefined,
          data_fim: dataFim || undefined,
          status,
        });
        if (result.success) {
          const now = new Date().toISOString();
          onSaved({
            id: result.sprintId,
            nome: nome.trim(),
            objetivo: objetivo.trim() || null,
            data_inicio: dataInicio || null,
            data_fim: dataFim || null,
            status,
            created_at: now,
            updated_at: now,
            deleted_at: null,
          });
          toast.success("Sprint criada");
        } else {
          toast.error(result.error ?? "Erro ao criar sprint");
        }
      }
    });
  };

  const handleDelete = () => {
    if (!sprint) return;
    if (!confirm(`Excluir a sprint "${sprint.nome}"? As tarefas voltam ao backlog geral.`)) return;
    startTransition(async () => {
      const result = await excluirSprint(sprint.id);
      if (result.success) {
        onDeleted(sprint.id);
        toast.success("Sprint excluída");
      } else {
        toast.error(result.error ?? "Erro ao excluir sprint");
      }
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="liquid-glass w-full max-w-md rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 className="text-base font-semibold text-foreground">
              {sprint ? "Editar sprint" : "Nova sprint"}
            </h2>
            <button
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-fill-4 hover:text-foreground"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-6 py-5">
            <div className="space-y-1.5">
              <label className={labelClass}>Nome *</label>
              <input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: Sprint 12 — Fechamento de julho"
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Objetivo</label>
              <textarea
                value={objetivo}
                onChange={(e) => setObjetivo(e.target.value)}
                placeholder="Meta da sprint..."
                rows={2}
                className={cn(inputClass, "resize-none")}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Início</label>
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Fim</label>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as StatusSprint)}
                className={cn(inputClass, "appearance-none")}
              >
                {STATUS_OPTS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
            {sprint && canDelete ? (
              <Button variant="ghost" onClick={handleDelete} disabled={isPending}>
                <Trash2 className="h-4 w-4 text-sys-red" />
                Excluir
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={isPending}>
                {isPending ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {sprint ? "Salvar" : "Criar sprint"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
