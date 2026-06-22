"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import {
  type Deal,
  DEAL_STAGE_CONFIG,
  PRODUCT_TIER_STYLES,
} from "@/types/deal";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

function scoreTone(score: number | undefined): {
  cls: string;
  label: string;
} {
  if (score == null)
    return { cls: "text-muted-foreground", label: "" };
  if (score >= 70) return { cls: "text-sys-green", label: "HOT" };
  if (score >= 40) return { cls: "text-sys-orange", label: "WARM" };
  return { cls: "text-sys-blue", label: "COLD" };
}

interface DealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
}

export function DealCard({ deal, isDragging, onClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: deal.id,
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const score = scoreTone(deal.lead_score);
  const stageConfig = DEAL_STAGE_CONFIG[deal.stage];
  const timeInStage = formatRelativeTime(deal.stage_updated_at);
  const tierStyle = deal.product_tier
    ? PRODUCT_TIER_STYLES[deal.product_tier]
    : null;
  const isQualified = deal.qualificado_gemini === true;

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = deal.next_action_date && deal.next_action_date < today;

  const isUnconfigured =
    !deal.next_action?.trim() || !deal.next_action_date;
  const isLost = stageConfig.isLost;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      title={
        isUnconfigured && !isLost
          ? 'Preencha "Próxima ação" e a data antes de avançar.'
          : undefined
      }
      className={cn(
        "group relative cursor-grab rounded-md border border-border bg-card p-2 transition-all hover:border-primary/30 hover:shadow-sm active:cursor-grabbing",
        isDragging && "rotate-1 scale-105 opacity-60 shadow-lg",
        isUnconfigured && !isLost && "border-sys-red/30",
      )}
    >
      {/* Sinal de incompleto */}
      {isUnconfigured && !isLost && (
        <span
          className="pointer-events-none absolute right-1.5 top-1.5"
          aria-label="Próxima ação não preenchida"
        >
          <span className="block h-1.5 w-1.5 rounded-full bg-sys-red" />
        </span>
      )}

      {/* Linha 1: nome + score */}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12px] font-semibold leading-tight text-foreground">
          {deal.athlete_name}
        </p>
        {deal.lead_score != null && (
          <span
            className={cn(
              "shrink-0 text-[10px] font-bold tabular-nums",
              score.cls,
            )}
          >
            {deal.lead_score}
          </span>
        )}
      </div>

      {/* Linha 2: responsável + plano */}
      <div className="mt-0.5 flex items-center justify-between gap-2">
        <p className="truncate text-[10px] text-muted-foreground">
          {deal.guardian_name}
        </p>
        {tierStyle && deal.product_tier && (
          <span
            className={cn(
              "shrink-0 rounded-sm px-1 py-px text-[9px] font-semibold uppercase tracking-wide",
              tierStyle.badge,
            )}
          >
            {deal.product_tier}
          </span>
        )}
      </div>

      {/* Linha 3: valor + estado */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold tabular-nums text-foreground">
          R$ {deal.deal_value_brl.toLocaleString("pt-BR")}
        </span>
        <span className="flex items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
          <Clock className="h-2.5 w-2.5" />
          {timeInStage}
        </span>
      </div>

      {/* Próxima ação */}
      {deal.next_action && (
        <p
          className={cn(
            "mt-1 truncate text-[10px]",
            isOverdue ? "font-medium text-sys-red" : "text-muted-foreground",
          )}
        >
          {isOverdue && (
            <AlertTriangle className="mr-0.5 inline h-2.5 w-2.5" />
          )}
          {deal.next_action}
        </p>
      )}

      {/* Barra financeira (apenas em estágios pós-contrato) */}
      {stageConfig.isFinancial &&
        deal.signal_value_brl &&
        deal.deal_value_brl > 0 && (
          <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-sys-green"
              style={{
                width: `${Math.round((deal.signal_value_brl / deal.deal_value_brl) * 100)}%`,
              }}
            />
          </div>
        )}

      {/* Mini badges em rodapé (qualif/retroc) */}
      {(isQualified || deal.flag_retrocedido) && (
        <div className="mt-1.5 flex items-center gap-1">
          {isQualified && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-sys-green/12 px-1 py-px text-[9px] font-medium text-sys-green"
              title="Qualificado por Gemini"
            >
              <CheckCircle className="h-2 w-2" />
              IA
            </span>
          )}
          {deal.flag_retrocedido && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-sys-orange/12 px-1 py-px text-[9px] font-medium text-sys-orange"
              title="Deal retrocedeu"
            >
              <ArrowLeft className="h-2 w-2" />
              Retrocesso
            </span>
          )}
        </div>
      )}

      {/* Motivo de perda */}
      {deal.lost_reason && (
        <p className="mt-1 truncate text-[10px] italic text-sys-red/70">
          {deal.lost_reason}
        </p>
      )}
    </div>
  );
}
