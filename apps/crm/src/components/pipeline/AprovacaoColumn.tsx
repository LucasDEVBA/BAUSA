"use client";

import { CalendarCheck, CalendarClock, Flame, Thermometer, UserCheck } from "lucide-react";

import type { LeadPendenteCard } from "@/lib/actions/leads";
import { cn, formatDate, formatRelativeTime } from "@/lib/utils";

import { RevisaoLista } from "./RevisaoLista";

/**
 * Coluna "Aguardando aprovação" — a PRIMEIRA do Kanban.
 *
 * Alimentada pela FILA (form_submissions com aprovacao_status='pendente'),
 * não por deals: o deal só nasce quando o CEO aprova. Isso mantém a garantia
 * de que nada não-aprovado entra em métrica de funil, automação ou outreach —
 * e ao mesmo tempo o board deixa de mentir por omissão sobre o topo do funil.
 *
 * Por isso os cards NÃO são arrastáveis: a saída daqui é a decisão (aprovar /
 * reprovar), não um drag. Clicar abre a fila de aprovação já nesse lead.
 */

const CLASSE_STYLE: Record<string, { faixa: string; badge: string; Icone: typeof Flame }> = {
  QUENTE: { faixa: "bg-sys-green", badge: "bg-sys-green/12 text-sys-green", Icone: Flame },
  MORNO: { faixa: "bg-sys-orange", badge: "bg-sys-orange/12 text-sys-orange", Icone: Thermometer },
};

const TIMING_LABEL: Record<string, string> = {
  muito_cedo: "Cedo",
  tarde_demais: "Tarde",
};

interface AprovacaoColumnProps {
  /** Cards já FILTRADOS pelo board. */
  leads: LeadPendenteCard[];
  /** Total real da fila no banco (count exact). */
  total: number;
  maisRestantes: number;
  carregandoMais: boolean;
  onCarregarMais: () => void;
  onLeadClick: (leadId: string) => void;
}

export function AprovacaoColumn({
  leads,
  total,
  maisRestantes,
  carregandoMais,
  onCarregarMais,
  onLeadClick,
}: AprovacaoColumnProps) {
  const contagem = leads.length < total ? `${leads.length} de ${total}` : String(total);

  const card = (lead: LeadPendenteCard) => {
    const estilo = CLASSE_STYLE[lead.qualification_classification ?? ""] ?? null;
    const timing =
      lead.timing_status && lead.timing_status !== "ideal" ? TIMING_LABEL[lead.timing_status] : null;
    return (
      <button
        type="button"
        onClick={() => onLeadClick(lead.id)}
        title={`Abrir para aprovar ou reprovar${lead.guardian_name ? ` — Resp.: ${lead.guardian_name}` : ""}`}
        className="group relative w-full rounded-xl border border-border bg-card p-2.5 pl-3 text-left shadow-xs transition-all hover:-translate-y-px hover:border-sys-orange/40 hover:shadow-md"
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-0 top-3 h-5 w-[3px] rounded-r-full",
            estilo?.faixa ?? "bg-muted-foreground",
          )}
        />
        <p className="truncate text-[10px] font-semibold text-foreground">{lead.athlete_name}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {lead.position ?? "—"} · {lead.city_state ?? "—"}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {estilo && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-medium",
                estilo.badge,
              )}
            >
              <estilo.Icone className="h-2 w-2" />
              {lead.qualification_classification}
            </span>
          )}
          {timing && (
            <span className="inline-flex items-center gap-0.5 rounded bg-plan-legacy/12 px-1 py-px text-[9px] font-medium text-plan-legacy">
              <CalendarClock className="h-2 w-2" />
              {timing}
            </span>
          )}
          {lead.meeting_scheduled && (
            <span
              className="inline-flex items-center gap-0.5 rounded bg-sys-green/12 px-1 py-px text-[9px] font-medium text-sys-green"
              title={lead.meeting_scheduled_at ? `Reunião detectada em ${formatDate(lead.meeting_scheduled_at)}` : "Reunião detectada"}
            >
              <CalendarCheck aria-hidden className="h-2 w-2" />
              Reunião detectada
            </span>
          )}
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
            {formatRelativeTime(lead.submitted_at)}
          </span>
        </div>
      </button>
    );
  };

  return (
    <div className="flex w-[252px] shrink-0 flex-col rounded-xl border border-sys-orange/25 bg-sys-orange/5">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserCheck aria-hidden className="size-3 shrink-0 text-sys-orange" />
          <span className="truncate text-[11px] font-semibold text-foreground">Aguardando aprovação</span>
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold tabular-nums text-muted-foreground"
            title={`${total} lead(s) Quente/Morno aguardando decisão`}
          >
            {contagem}
          </span>
        </div>
      </div>

      <RevisaoLista
        itens={leads}
        renderItem={card}
        rotulo="Leads aguardando aprovação"
        vazio={
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center">
            <p className="text-[10px] leading-relaxed text-muted-foreground">Nenhum lead esperando decisão</p>
          </div>
        }
        maisRestantes={maisRestantes}
        carregandoMais={carregandoMais}
        onCarregarMais={onCarregarMais}
        tomBotao="border-sys-orange/30 text-sys-orange hover:bg-sys-orange/10"
      />
    </div>
  );
}
