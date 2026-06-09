"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, MoreHorizontal, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import { type Deal, DEAL_STAGE_CONFIG, PRODUCT_TIER_STYLES } from "@/types/deal";
import { formatRelativeTime, formatInvestmentRange, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

function getScoreClassification(score: number | undefined): { label: string; bg: string; text: string; border: string } {
  if (!score && score !== 0) return { label: "—", bg: "bg-secondary", text: "text-muted-foreground", border: "border-border" };
  if (score >= 70) return { label: "HOT", bg: "bg-sys-green/15", text: "text-sys-green", border: "border-sys-green/20" };
  if (score >= 40) return { label: "WARM", bg: "bg-sys-orange/15", text: "text-sys-orange", border: "border-sys-orange/20" };
  return { label: "COLD", bg: "bg-sys-blue/15", text: "text-sys-blue", border: "border-sys-blue/20" };
}

interface DealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
}

export function DealCard({ deal, isDragging, onClick }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const scoreClass = getScoreClassification(deal.lead_score);
  const stageConfig = DEAL_STAGE_CONFIG[deal.stage];
  const timeInStage = formatRelativeTime(deal.stage_updated_at);
  const investmentLabel = formatInvestmentRange(deal.investment_range);
  const tierStyle = deal.product_tier ? PRODUCT_TIER_STYLES[deal.product_tier] : null;
  const isQualified = deal.qualificado_gemini === true;

  const today = new Date().toISOString().split("T")[0];
  const isOverdue = deal.next_action_date && deal.next_action_date < today;

  // Deal não pode avançar enquanto não tiver próxima ação preenchida
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
          ? 'Preencha "Próxima ação" e a data antes de avançar este deal.'
          : undefined
      }
      className={cn(
        "group relative rounded-xl border border-border bg-card p-3 transition-all hover:border-fill-1 hover:shadow-lg cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-lg rotate-1 scale-105",
        isOverdue && "border-sys-red/30",
        isUnconfigured && !isLost && "ring-1 ring-sys-red/20",
      )}
    >
      {/* Indicador visível: deal incompleto não avança */}
      {isUnconfigured && !isLost && (
        <span
          className="pointer-events-none absolute -right-1 -top-1 flex h-3 w-3 items-center justify-center"
          aria-label="Próxima ação não preenchida"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sys-red/40" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-sys-red" />
        </span>
      )}
      {/* Header: avatar + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-plan-legacy/30 text-[11px] font-bold text-primary">
            {getInitials(deal.athlete_name)}
          </div>
          {/* Lead Score badge (dinâmico) */}
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
              scoreClass.bg, scoreClass.text, scoreClass.border,
            )}
          >
            {deal.lead_score ?? 0}
            <span className="font-medium opacity-70">{scoreClass.label}</span>
          </span>
          {/* Gemini Qualificado badge */}
          {isQualified && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sys-green/15 border border-sys-green/20 px-1.5 py-0.5 text-[9px] font-semibold text-sys-green">
              <CheckCircle className="h-2.5 w-2.5" />
              Qualif.
            </span>
          )}
          {deal.flag_retrocedido && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-sys-orange/15 border border-sys-orange/20 px-1.5 py-0.5 text-[9px] font-semibold text-sys-orange">
              <ArrowLeft className="h-2.5 w-2.5" />
              Retrocedido
            </span>
          )}
          {tierStyle && deal.product_tier && (
            <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold", tierStyle.badge)}>
              {deal.product_tier}
            </span>
          )}
        </div>
        <button
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-fill-4"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Nome */}
      <div className="mt-2">
        <p className="text-sm font-semibold text-foreground leading-tight">{deal.athlete_name}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{deal.guardian_name}</p>
      </div>

      {/* Valor */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-sys-green">
          R$ {deal.deal_value_brl.toLocaleString("pt-BR")}
        </span>
        {deal.address_state && (
          <span className="text-[10px] text-muted-foreground">{deal.address_state}</span>
        )}
      </div>

      {/* Next action */}
      {deal.next_action && (
        <p className={cn("mt-1.5 text-[10px] truncate", isOverdue ? "text-sys-red font-medium" : "text-muted-foreground")}>
          {isOverdue && <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />}
          {deal.next_action}
        </p>
      )}

      {/* Financial bar */}
      {stageConfig.isFinancial && deal.signal_value_brl && deal.deal_value_brl > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[9px] text-muted-foreground">
            <span>Sinal R$ {deal.signal_value_brl.toLocaleString("pt-BR")}</span>
            <span>Total R$ {deal.deal_value_brl.toLocaleString("pt-BR")}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-sys-green transition-all"
              style={{ width: `${Math.round((deal.signal_value_brl / deal.deal_value_brl) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Motivo de perda */}
      {deal.lost_reason && (
        <p className="mt-1.5 text-[10px] text-sys-red/70 leading-tight italic">{deal.lost_reason}</p>
      )}

      {/* Tempo */}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
        <Clock className="h-3 w-3" />
        <span>{timeInStage}</span>
      </div>
    </div>
  );
}
