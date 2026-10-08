"use client";

import { useDraggable } from "@dnd-kit/core";
import { Clock, AlertTriangle, CheckCircle, ArrowLeft, CalendarClock, Trash2 } from "lucide-react";
import {
  type Deal,
  DEAL_STAGE_CONFIG,
  PRODUCT_TIER_STYLES,
} from "@/types/deal";
import {
  DEFAULT_DEAL_STAGE_DISPLAY,
  type DealStageConfigMap,
} from "@/lib/etapas-deal";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import {
  ROTULO_ORIGEM_VALOR,
  contratoAguardandoPlano,
  explicarOrigemValor,
  formatarValorDeal,
  sinalPagoAntesDoPlano,
  textoPrevisaoDoSinal,
  textoSinalAntesDoPlano,
} from "@/lib/valor-deal";

/** Timing fora da janela ideal — badge lateral (a coluna aguardando_timing
 *  saiu do board em 2026-08-11; o motivo continua visível no card). */
const TIMING_BADGE: Record<string, { label: string; title: string; faixa: string; badge: string }> = {
  muito_cedo: {
    label: "Cedo",
    title: "Fora do timing: atleta muito jovem — em revisão manual (mensagens automáticas desligadas em 2026-09-07)",
    faixa: "bg-plan-legacy",
    badge: "bg-plan-legacy/12 text-plan-legacy",
  },
  tarde_demais: {
    label: "Tarde",
    title: "Fora do timing: formado há 2+ anos",
    faixa: "bg-sys-orange",
    badge: "bg-sys-orange/12 text-sys-orange",
  },
};

interface DealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: () => void;
  /** Config de exibição das etapas (rótulo/cor do CEO). Default = estático. */
  stageConfig?: DealStageConfigMap;
  /** Excluir o LEAD inteiro (soft delete em cascata) direto do card. */
  onExcluir?: () => void;
  /** Clique no VALOR (T3): sem contrato abre a customização; com contrato, a
   *  aba do contrato. Ausente (sem permissão) = valor só leitura. */
  onValorClick?: () => void;
}

/** "≈ R$ 22.000 estimado" / "R$ 24.000 negociado" / "R$ 26.000" (contrato).
 *  Sinal pago antes do plano (T11): "Sinal R$ X pago · total a definir" com a
 *  previsão embaixo — o número somado na coluna continua sendo deal_value_brl. */
function ValorDoCard({ deal }: { deal: Deal }) {
  const origem = deal.valor_origem ?? "estimado";
  const sinalAntesDoPlano = sinalPagoAntesDoPlano(deal);
  if (sinalAntesDoPlano !== null) {
    const previsao = textoPrevisaoDoSinal(deal);
    return (
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-semibold tabular-nums text-sys-green">
          {textoSinalAntesDoPlano(sinalAntesDoPlano)}
        </span>
        {previsao && (
          <span className="truncate text-[9px] tabular-nums text-muted-foreground">{previsao}</span>
        )}
      </span>
    );
  }
  return (
    <>
      <span
        className={cn(
          "truncate text-[11px] font-semibold tabular-nums",
          origem === "estimado" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {formatarValorDeal(deal.deal_value_brl, origem)}
      </span>
      {origem !== "contratado" && (
        <span
          className={cn(
            "shrink-0 text-[9px] font-medium",
            origem === "negociado" ? "text-sys-orange" : "text-muted-foreground",
          )}
        >
          {ROTULO_ORIGEM_VALOR[origem]}
        </span>
      )}
    </>
  );
}

// O nome acessível começa pelo texto VISÍVEL (WCAG 2.5.3): quem usa comando
// de voz fala o que vê no card.
function rotuloAcessivelValor(deal: Deal): string {
  const sinalAntesDoPlano = sinalPagoAntesDoPlano(deal);
  if (sinalAntesDoPlano !== null) {
    const previsao = textoPrevisaoDoSinal(deal);
    return `${textoSinalAntesDoPlano(sinalAntesDoPlano)}${previsao ? `, ${previsao}` : ""} — definir valor negociado`;
  }
  const origem = deal.valor_origem ?? "estimado";
  const valor = formatarValorDeal(deal.deal_value_brl, origem);
  if (!(deal.deal_value_brl > 0)) return `${valor} — definir valor negociado`;
  if (origem === "contratado") return `${valor} — valor do contrato, abrir contrato`;
  if (origem === "negociado") return `${valor} negociado — editar valor`;
  return `${valor} estimado — definir valor negociado`;
}

export function DealCard({
  deal,
  isDragging,
  onClick,
  stageConfig: configMap,
  onExcluir,
  onValorClick,
}: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: deal.id,
  });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  // Overrides do CEO quando disponíveis; DEAL_STAGE_CONFIG é só o fallback
  // (antes o card lia o estático direto e ignorava a config — bug latente).
  const stageConfig =
    (configMap ?? DEFAULT_DEAL_STAGE_DISPLAY)[deal.stage] ?? DEAL_STAGE_CONFIG[deal.stage];
  const timing = deal.timing_status ? TIMING_BADGE[deal.timing_status] : undefined;
  // Prioridade interna por engajamento (P1/P2) — camada de exibição; a
  // classificação Gemini continua no badge "IA". Sem prioridade = sem badge.
  const prioridade = deal.prioridade_engajamento ?? undefined;
  const timeInStage = formatRelativeTime(deal.stage_updated_at);
  const tierStyle = deal.product_tier
    ? PRODUCT_TIER_STYLES[deal.product_tier]
    : null;
  const isQualified = deal.qualificado_gemini === true;
  const sinalRecebido = deal.signal_value_brl ?? 0;
  const aguardandoPlano = contratoAguardandoPlano(deal);
  // Com o sinal antes do plano, ele já é o texto principal da linha do valor.
  const sinalNoValor = sinalPagoAntesDoPlano(deal) !== null;

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
          ? 'Próxima ação não preenchida.'
          : undefined
      }
      className={cn(
        "group relative cursor-grab rounded-xl border border-border bg-card p-2.5 pl-3 shadow-xs transition-all hover:-translate-y-px hover:border-primary/40 hover:shadow-md active:cursor-grabbing",
        isDragging && "rotate-1 scale-105 opacity-70 shadow-lg",
        isUnconfigured && !isLost && "border-sys-red/40",
      )}
    >
      {/* Faixa lateral: cor da etapa (ou do timing, que é mais urgente).
          Mesma anatomia do accent do Card e do board de famílias. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-3 h-5 w-[3px] rounded-r-full",
          timing?.faixa ?? stageConfig.dotColor,
        )}
      />

      {/* Excluir o lead — aparece no hover; não dispara drag nem o clique
          do card (o root tem os listeners do dnd-kit no pointerdown). */}
      {onExcluir && (
        <button
          type="button"
          aria-label={`Excluir lead ${deal.athlete_name}`}
          title="Excluir lead"
          draggable={false}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onExcluir();
          }}
          className="absolute bottom-1.5 right-1.5 z-10 flex h-5 w-5 items-center justify-center rounded opacity-0 transition-opacity text-label-tertiary hover:bg-sys-red/10 hover:text-sys-red focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}

      {/* Sinal de incompleto */}
      {isUnconfigured && !isLost && (
        <span
          className="pointer-events-none absolute right-1.5 top-1.5"
          aria-label="Próxima ação não preenchida"
        >
          <span className="block h-1.5 w-1.5 rounded-full bg-sys-red" />
        </span>
      )}

      {/* Linha 1: nome */}
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[10px] font-semibold leading-tight text-foreground">
          {deal.athlete_name}
        </p>
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
        {aguardandoPlano && (
          <span
            className="shrink-0 rounded-sm border border-border bg-secondary px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-muted-foreground"
            title={
              sinalRecebido > 0
                ? "Sinal registrado — plano ainda não escolhido"
                : "Contrato aguardando a escolha do plano"
            }
          >
            A definir
          </span>
        )}
      </div>

      {/* Linha 3: valor (contrato > negociado > estimado) + tempo na etapa.
          O botão do valor não dispara drag (pointerdown) nem o clique do card. */}
      <div className="mt-1.5 flex items-center justify-between gap-2">
        {onValorClick ? (
          <button
            type="button"
            draggable={false}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onValorClick();
            }}
            title={explicarOrigemValor(deal)}
            aria-label={rotuloAcessivelValor(deal)}
            className="-mx-1 flex min-w-0 items-baseline gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ValorDoCard deal={deal} />
          </button>
        ) : (
          <span className="flex min-w-0 items-baseline gap-1" title={explicarOrigemValor(deal)}>
            <ValorDoCard deal={deal} />
          </span>
        )}
        <span className="flex shrink-0 items-center gap-1 text-[10px] tabular-nums text-muted-foreground">
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

      {/* Sinal recebido (soma das parcelas de entrada RECEBIDAS — T3). O texto
          não depende do valor (lead sem faixa também paga sinal); só a barra
          precisa de um total para comparar. */}
      {sinalRecebido > 0 && !sinalNoValor && (
        <div className="mt-1.5">
          <p className="text-[9px] tabular-nums text-sys-green">
            Sinal R$ {Math.round(sinalRecebido).toLocaleString("pt-BR")}
          </p>
          {deal.deal_value_brl > 0 && (
            <div aria-hidden className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-sys-green"
                style={{
                  width: `${Math.min(100, Math.round((sinalRecebido / deal.deal_value_brl) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Mini badges em rodapé (prioridade/timing/qualif/retroc) */}
      {(prioridade || timing || isQualified || deal.flag_retrocedido) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {prioridade && (
            <span
              className={cn(
                "inline-flex items-center rounded px-1 py-px text-[9px] font-semibold",
                prioridade.nivel === "P1"
                  ? "bg-sys-red/12 text-sys-red"
                  : "bg-sys-orange/12 text-sys-orange",
              )}
              title={
                prioridade.motivos.length > 0
                  ? `${prioridade.motivos.join(" · ")} · ${prioridade.pontos} pts`
                  : `Sem sinais de engajamento ainda · ${prioridade.pontos} pts`
              }
            >
              {prioridade.nivel}
            </span>
          )}
          {timing && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-medium",
                timing.badge,
              )}
              title={timing.title}
            >
              <CalendarClock className="h-2 w-2" />
              {timing.label}
            </span>
          )}
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
        <p className="mt-1 truncate text-[10px] italic text-sys-red">
          {deal.lost_reason}
        </p>
      )}
    </div>
  );
}
