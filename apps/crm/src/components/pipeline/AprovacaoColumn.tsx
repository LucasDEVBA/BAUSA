"use client";

import { CalendarClock, Flame, Thermometer, UserCheck } from "lucide-react";

import type { LeadPendenteCard } from "@/lib/actions/leads";
import { formatRelativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

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
  leads: LeadPendenteCard[];
  onLeadClick: (leadId: string) => void;
}

export function AprovacaoColumn({ leads, onLeadClick }: AprovacaoColumnProps) {
  return (
    <div className="flex w-[252px] shrink-0 flex-col rounded-xl border border-sys-orange/25 bg-sys-orange/5">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <UserCheck aria-hidden className="size-3 shrink-0 text-sys-orange" />
          <span className="truncate text-[11px] font-semibold text-foreground">Aguardando aprovação</span>
          <span className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {leads.length}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
        {leads.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center">
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              Nenhum lead esperando decisão
            </p>
          </div>
        ) : (
          leads.map((lead) => {
            const estilo = CLASSE_STYLE[lead.qualification_classification ?? ""] ?? null;
            const timing =
              lead.timing_status && lead.timing_status !== "ideal"
                ? TIMING_LABEL[lead.timing_status]
                : null;
            return (
              <button
                key={lead.id}
                type="button"
                onClick={() => onLeadClick(lead.id)}
                title="Abrir para aprovar ou reprovar"
                className="group relative rounded-xl border border-border bg-card p-2.5 pl-3 text-left shadow-xs transition-all hover:-translate-y-px hover:border-sys-orange/40 hover:shadow-md"
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
                  <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
                    {formatRelativeTime(lead.submitted_at)}
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
