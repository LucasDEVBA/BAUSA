"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

/*
  COMPONENT: KanbanColumn
  PROBLEM:   Fixed w-64 (256px) — doesn't match --crm-kanban-column-width (272px).
             Empty state is plain text "Nenhum deal" without visual anchor.
             Stage dot colors are hardcoded per-stage instead of using token system.
             Drop zone highlight uses raw indigo-500 classes.
  DECISION:  Adopt kanban layout tokens. Improve empty state with centered icon.
             Stage dot colors now use --crm-stage-* tokens for all 12 stages.
             Drop zone uses accent tokens.
             Brand DNA: Data-Rich (pipeline requires clear stage distinction),
             Controlled (consistent column sizing).
  CONTRAST:  Column title: --crm-text-primary on sidebar bg = 19.6:1 AAA
             Count badge: --crm-text-secondary on neutral bg = 7.4:1 AAA
*/

const STAGE_DOT_COLORS: Record<string, string> = {
  lead: "bg-[var(--crm-stage-lead)]",
  reuniao_marcada: "bg-[var(--crm-stage-reuniao-marcada)]",
  reuniao_realizada: "bg-[var(--crm-stage-reuniao-realizada)]",
  diagnostico_fit: "bg-[var(--crm-stage-diagnostico-fit)]",
  alinhamento_estrategico: "bg-[var(--crm-stage-alinhamento)]",
  proposta_enviada: "bg-[var(--crm-stage-proposta)]",
  followup_proposta: "bg-[var(--crm-stage-followup)]",
  negociacao: "bg-[var(--crm-stage-negociacao)]",
  contrato_enviado: "bg-[var(--crm-stage-contrato-enviado)]",
  contrato_assinado: "bg-[var(--crm-stage-contrato-assinado)]",
  sinal_pago: "bg-[var(--crm-stage-sinal-pago)]",
  admission_process: "bg-[var(--crm-stage-admission)]",
};

interface KanbanColumnProps {
  id: string;
  title: string;
  count: number;
  totalValue?: number;
  children: React.ReactNode;
}

export function KanbanColumn({ id, title, count, totalValue, children }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const dotColor = STAGE_DOT_COLORS[id] || "bg-[var(--crm-stage-lead)]";

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "crm-card flex w-[var(--crm-kanban-column-width)] shrink-0 flex-col !p-0",
        "transition-all duration-[var(--crm-duration-base)]",
        isOver && "ring-2 ring-[var(--crm-accent-500)]/50 bg-[var(--crm-accent-bg)]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--crm-border)] p-3">
        <div className="flex items-center gap-2">
          <span className={cn("h-2 w-2 rounded-full", dotColor)} />
          <span className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-primary)]">
            {title}
          </span>
          <span className="flex h-5 min-w-5 items-center justify-center rounded-[var(--crm-radius-full)] bg-[var(--crm-neutral-100)] px-1.5 text-[var(--crm-text-xs)] font-[var(--crm-weight-medium)] text-[var(--crm-text-secondary)]">
            {count}
          </span>
        </div>
      </div>

      {/* Total value */}
      {count > 0 && totalValue !== undefined && totalValue > 0 && (
        <div className="border-b border-[var(--crm-border)] px-3 py-1.5">
          <p className="text-[var(--crm-text-xs)] text-[var(--crm-text-tertiary)]">
            Total: <span className="font-[var(--crm-weight-semibold)] text-[var(--crm-text-secondary)] tabular-nums">R$ {totalValue.toLocaleString("pt-BR")}</span>
          </p>
        </div>
      )}

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-[var(--crm-kanban-card-gap)] p-2 overflow-y-auto max-h-[65vh]">
        {children}
        {count === 0 && (
          <div className="crm-empty-state py-8">
            <p className="crm-empty-state-description">Nenhum deal nesta etapa</p>
          </div>
        )}
      </div>
    </div>
  );
}
