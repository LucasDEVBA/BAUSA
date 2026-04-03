"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, MoreHorizontal, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import { type Deal, DEAL_STAGE_CONFIG, PRODUCT_TIER_STYLES } from "@/types/deal";
import { formatRelativeTime, formatInvestmentRange, getInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

function getScoreClassification(score: number | undefined): { label: string; bg: string; text: string; border: string } {
  if (!score && score !== 0) return { label: "—", bg: "bg-zinc-500/15", text: "text-zinc-400", border: "border-zinc-500/30" };
  if (score >= 70) return { label: "HOT", bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" };
  if (score >= 40) return { label: "WARM", bg: "bg-amber-500/15", text: "text-amber-400", border: "border-amber-500/30" };
  return { label: "COLD", bg: "bg-blue-500/15", text: "text-blue-400", border: "border-blue-500/30" };
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "group rounded-lg border border-[#1e2130] bg-[#141720] p-3 transition-all hover:border-zinc-600/50 hover:shadow-lg hover:shadow-black/20 cursor-grab active:cursor-grabbing",
        isDragging && "opacity-50 shadow-xl rotate-1 scale-105",
        isOverdue && "border-red-500/30",
      )}
    >
      {/* Header: avatar + badges */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 text-[11px] font-bold text-indigo-300">
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
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-400">
              <CheckCircle className="h-2.5 w-2.5" />
              Qualif.
            </span>
          )}
          {deal.flag_retrocedido && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-400">
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
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
          onClick={(e) => { e.stopPropagation(); }}
        >
          <MoreHorizontal className="h-3.5 w-3.5 text-zinc-500" />
        </button>
      </div>

      {/* Nome */}
      <div className="mt-2">
        <p className="text-sm font-semibold text-zinc-100 leading-tight">{deal.athlete_name}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{deal.guardian_name}</p>
      </div>

      {/* Valor */}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-emerald-400">
          R$ {deal.deal_value_brl.toLocaleString("pt-BR")}
        </span>
        {deal.address_state && (
          <span className="text-[10px] text-zinc-500">{deal.address_state}</span>
        )}
      </div>

      {/* Next action */}
      {deal.next_action && (
        <p className={cn("mt-1.5 text-[10px] truncate", isOverdue ? "text-red-400 font-medium" : "text-zinc-500")}>
          {isOverdue && <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5" />}
          {deal.next_action}
        </p>
      )}

      {/* Financial bar */}
      {stageConfig.isFinancial && deal.signal_value_brl && deal.deal_value_brl > 0 && (
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-[9px] text-zinc-500">
            <span>Sinal R$ {deal.signal_value_brl.toLocaleString("pt-BR")}</span>
            <span>Total R$ {deal.deal_value_brl.toLocaleString("pt-BR")}</span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${Math.round((deal.signal_value_brl / deal.deal_value_brl) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Motivo de perda */}
      {deal.lost_reason && (
        <p className="mt-1.5 text-[10px] text-red-400/70 leading-tight italic">{deal.lost_reason}</p>
      )}

      {/* Tempo */}
      <div className="mt-2 flex items-center gap-1 text-[10px] text-zinc-500">
        <Clock className="h-3 w-3" />
        <span>{timeInStage}</span>
      </div>
    </div>
  );
}
