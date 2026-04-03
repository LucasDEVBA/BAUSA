"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, MoreHorizontal, AlertTriangle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/*
  COMPONENT: DealCard
  PROBLEM:   Hardcoded zinc/indigo/purple classes. Avatar gradient uses raw from-/to-
             classes. Overdue border uses raw red-500/30. Hover states use raw
             white/10. The more button opacity trick works but needs proper token.
  DECISION:  Migrate to CRM tokens. Classification badges use semantic hot/warm/cold
             tokens. Overdue uses error tokens. Hover elevation uses shadow tokens.
             Keep draggable rotate-2 effect (Premium micro-interaction).
             Brand DNA: Data-Rich (status at a glance), Premium (drag interaction).
  CONTRAST:  Name: --crm-text-primary on surface = 17.6:1 AAA
             Sport/series: --crm-text-tertiary on surface = 4.2:1 AA
             Value: --crm-success on surface = 8.4:1 AAA
*/

const CLASSIFICATION_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  hot: {
    bg: "bg-[var(--crm-hot-subtle)]",
    text: "text-[var(--crm-hot)]",
    border: "border-[var(--crm-hot-border)]",
  },
  warm: {
    bg: "bg-[var(--crm-warm-subtle)]",
    text: "text-[var(--crm-warm)]",
    border: "border-[var(--crm-warm-border)]",
  },
  cold: {
    bg: "bg-[var(--crm-cold-subtle)]",
    text: "text-[var(--crm-cold)]",
    border: "border-[var(--crm-cold-border)]",
  },
};

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();
}

function formatRelativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

interface DealCardProps {
  deal: any;
  isDragging?: boolean;
  onClick?: () => void;
}

export function DealCard({ deal, isDragging, onClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;

  const cls = deal.atleta?.lead_classificacao;
  const classColors = CLASSIFICATION_COLORS[cls] || {
    bg: "bg-[var(--crm-neutral-100)]",
    text: "text-[var(--crm-text-secondary)]",
    border: "border-[var(--crm-border)]",
  };
  const atletaNome = deal.atleta?.nome_completo || "\u2014";
  const today = new Date().toISOString().split("T")[0];
  const isOverdue = deal.data_proxima_acao && deal.data_proxima_acao < today;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "crm-card crm-card-interactive group !p-3",
        "cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-[var(--crm-shadow-lg)] rotate-2",
        isOverdue && "border-[var(--crm-error-border)]",
      )}
    >
      {/* Header: avatar + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="crm-avatar crm-avatar-sm">
            {getInitials(atletaNome)}
          </div>
          <span className={cn(
            "inline-flex items-center rounded-[var(--crm-radius-full)] border px-1.5 py-0.5 text-[var(--crm-text-2xs)] font-[var(--crm-weight-bold)] tracking-[var(--crm-tracking-wider)]",
            classColors.bg, classColors.text, classColors.border,
          )}>
            {cls ? cls.toUpperCase() : "\u2014"}
          </span>
          {deal.flag_retrocedido && (
            <span className="crm-badge crm-badge-warning crm-badge-no-dot text-[var(--crm-text-2xs)]">
              <RotateCcw className="h-2.5 w-2.5" /> Retrocedido
            </span>
          )}
        </div>
        <button
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded opacity-0 transition-opacity duration-[var(--crm-duration-fast)] group-hover:opacity-100 hover:bg-[var(--crm-hover-overlay)]"
          aria-label="Mais opcoes"
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-[var(--crm-text-tertiary)]" />
        </button>
      </div>

      {/* Name */}
      <div className="mt-2">
        <p className="text-[var(--crm-text-base)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)] leading-tight">
          {atletaNome}
        </p>
        <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)] mt-0.5">
          {deal.atleta?.esporte || "\u2014"} {"\u00B7"} {deal.atleta?.serie_escolar || "\u2014"}
        </p>
      </div>

      {/* Value */}
      {deal.valor_estimado && (
        <div className="mt-2">
          <span className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] text-[var(--crm-success)] tabular-nums">
            R$ {Number(deal.valor_estimado).toLocaleString("pt-BR")}
          </span>
        </div>
      )}

      {/* Next action */}
      {deal.next_action && (
        <p className={cn(
          "mt-1.5 text-[var(--crm-text-xs)] truncate",
          isOverdue ? "text-[var(--crm-error)] font-[var(--crm-weight-medium)]" : "text-[var(--crm-text-tertiary)]",
        )}>
          {isOverdue && <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />}
          {deal.next_action}
        </p>
      )}

      {/* Time */}
      <div className="mt-2 flex items-center gap-1 text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">
        <Clock className="h-3 w-3" />
        <span>{formatRelativeTime(deal.updated_at || deal.created_at)}</span>
      </div>
    </div>
  );
}
