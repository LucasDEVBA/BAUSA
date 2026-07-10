"use client";

import { useDraggable } from "@dnd-kit/core";
import { AlertTriangle, Clock, Zap, RefreshCw, MessageCircle, Layers } from "lucide-react";
import type { Tarefa } from "@/types/crm";
import { cn } from "@/lib/utils";
import {
  PRIORIDADE_CONFIG,
  MODULO_CONFIG,
  RECORRENCIA_LABELS,
  type RecorrenciaTarefa,
  getRelativeTime,
  isOverdue,
  parseComments,
} from "./tarefa-utils";

interface TarefaCardProps {
  tarefa: Tarefa;
  responsavelNome?: string;
  sprintNome?: string | null;
  onClick?: () => void;
  isDragging?: boolean;
}

export function TarefaCard({
  tarefa,
  responsavelNome,
  sprintNome,
  onClick,
  isDragging,
}: TarefaCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: tarefa.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const prio = PRIORIDADE_CONFIG[tarefa.prioridade];
  const modulo = MODULO_CONFIG[tarefa.modulo_origem] ?? {
    label: tarefa.modulo_origem,
    color: "text-muted-foreground",
  };
  const overdue = isOverdue(tarefa);
  const done = tarefa.quadro_coluna === "feito";
  const comentarios = parseComments(tarefa.descricao).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group cursor-grab rounded-xl border border-border bg-card p-2.5 shadow-xs transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
        overdue && !done && "border-sys-red/30",
        done && "opacity-70",
        isDragging && "rotate-1 scale-[1.03] opacity-80 shadow-lg",
      )}
    >
      {/* Título + prioridade */}
      <div className="flex items-start gap-1.5">
        <span
          className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", prio.bg, prio.text)}
          style={{ backgroundColor: "currentColor" }}
          aria-hidden
        />
        <p
          className={cn(
            "min-w-0 flex-1 text-xs font-medium leading-snug text-foreground",
            done && "line-through text-muted-foreground",
          )}
        >
          {tarefa.titulo}
        </p>
      </div>

      {/* Badges */}
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        <span
          className={cn("rounded-full px-1.5 py-0.5 text-[9px] font-semibold", prio.bg, prio.text)}
        >
          {prio.label}
        </span>
        {tarefa.criada_automaticamente && (
          <span className="flex items-center gap-0.5 rounded-full bg-plan-legacy/15 px-1.5 py-0.5 text-[9px] font-semibold text-plan-legacy">
            <Zap className="h-2.5 w-2.5" />
            Auto
          </span>
        )}
        {tarefa.recorrencia && tarefa.recorrencia !== "nenhuma" && (
          <span className="flex items-center gap-0.5 rounded-full bg-sys-teal/15 px-1.5 py-0.5 text-[9px] font-semibold text-sys-teal">
            <RefreshCw className="h-2.5 w-2.5" />
            {RECORRENCIA_LABELS[tarefa.recorrencia as RecorrenciaTarefa] ?? tarefa.recorrencia}
          </span>
        )}
        {sprintNome && (
          <span className="flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
            <Layers className="h-2.5 w-2.5" />
            {sprintNome}
          </span>
        )}
      </div>

      {/* Meta */}
      <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
        <span className={cn("flex items-center gap-1", overdue && !done && "text-sys-red")}>
          {overdue && !done ? (
            <AlertTriangle className="h-2.5 w-2.5" />
          ) : (
            <Clock className="h-2.5 w-2.5" />
          )}
          {getRelativeTime(tarefa.prazo)}
        </span>
        <div className="flex items-center gap-1.5">
          {comentarios > 0 && (
            <span className="flex items-center gap-0.5">
              <MessageCircle className="h-2.5 w-2.5" />
              {comentarios}
            </span>
          )}
          <span className={cn("truncate", modulo.color)}>{modulo.label}</span>
        </div>
      </div>

      {responsavelNome && (
        <p className="mt-0.5 truncate text-[10px] text-label-tertiary">{responsavelNome}</p>
      )}
    </div>
  );
}
