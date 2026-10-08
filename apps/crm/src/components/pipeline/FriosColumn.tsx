"use client";

import { useState, useTransition } from "react";
import { Loader2, Snowflake, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { enviarFrioParaAprovacao, type LeadFrioCard } from "@/lib/actions/leads";
import { cn, formatRelativeTime } from "@/lib/utils";

import { ReuniaoDetectadaBadge } from "./ReuniaoDetectadaBadge";
import { RevisaoLista } from "./RevisaoLista";

/**
 * Coluna "Frios — revisão" (pedido do CEO, 2026-09-04).
 *
 * FRIO nunca aparecia no board; agora os últimos 90 dias ficam visíveis para
 * revisão humana. Cards NÃO são arrastáveis e a coluna NÃO alimenta métrica,
 * automação nem outreach — a única saída é o resgate explícito, que manda o
 * lead para a fila de aprovação como MORNO provisório (caso Pietro).
 */

interface FriosColumnProps {
  /** Cards já FILTRADOS pelo board (busca/classe). */
  leads: LeadFrioCard[];
  /** Total real do recorte no banco (count exact) — "100 de 194" (T7). */
  total: number;
  /** Quantos ainda não foram carregados do servidor. */
  maisRestantes: number;
  carregandoMais: boolean;
  onCarregarMais: () => void;
  /** Resgate concluído: o board tira o card e recarrega (router.refresh). */
  onResgatado: (leadId: string) => void;
  /** Clique no card: expande o dossiê completo (modal da revisão). */
  onLeadClick: (leadId: string) => void;
}

export function FriosColumn({
  leads,
  total,
  maisRestantes,
  carregandoMais,
  onCarregarMais,
  onResgatado,
  onLeadClick,
}: FriosColumnProps) {
  const [resgatandoId, setResgatandoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const resgatar = (lead: LeadFrioCard) => {
    setResgatandoId(lead.id);
    startTransition(async () => {
      try {
        const r = await enviarFrioParaAprovacao(lead.id);
        if (r.success) {
          toast.success(`${lead.athlete_name} enviado para a fila de aprovação`, {
            description: "Entrou como MORNO provisório — decida na fila, nada é enviado sem aprovar.",
          });
          onResgatado(lead.id);
        } else {
          toast.error(r.error);
        }
      } catch {
        toast.error("Falha de rede ao enviar para a fila. Tente de novo.");
      } finally {
        setResgatandoId(null);
      }
    });
  };

  // "100 de 194": o número do cabeçalho é SEMPRE o total real do banco (T7).
  const contagem = leads.length < total ? `${leads.length} de ${total}` : String(total);

  const card = (lead: LeadFrioCard) => {
    const resgatando = resgatandoId === lead.id;
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onLeadClick(lead.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onLeadClick(lead.id);
        }}
        title={`Abrir dossiê completo (dados, conversa e e-mail)${lead.guardian_name ? ` — Resp.: ${lead.guardian_name}` : ""}`}
        className="group relative cursor-pointer rounded-xl border border-border bg-card p-2.5 pl-3 shadow-xs transition-all hover:-translate-y-px hover:border-sys-blue/40 hover:shadow-md"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-3 h-5 w-[3px] rounded-r-full bg-sys-blue"
        />
        <p className="truncate text-[10px] font-semibold text-foreground">{lead.athlete_name}</p>
        <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
          {lead.position ?? "—"} · {lead.city_state ?? "—"}
        </p>
        {lead.qualification_reason && (
          <p
            className="mt-1 line-clamp-2 text-[9px] leading-snug text-label-tertiary"
            title={lead.qualification_reason}
          >
            {lead.qualification_reason}
          </p>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <span className="inline-flex items-center gap-0.5 rounded bg-sys-blue/12 px-1 py-px text-[9px] font-medium text-sys-blue">
            <Snowflake aria-hidden className="h-2 w-2" />
            FRIO{lead.score_financeiro != null ? ` · ${lead.score_financeiro}` : ""}
          </span>
          {lead.meeting_scheduled && (
            <ReuniaoDetectadaBadge variante="card" detectadaEm={lead.meeting_scheduled_at} semDeal />
          )}
          <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
            {formatRelativeTime(lead.submitted_at)}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            resgatar(lead);
          }}
          disabled={resgatando}
          title="Enviar para a fila de aprovação (MORNO provisório)"
          className={cn(
            "mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-md bg-sys-blue/10 px-2 py-1 text-[10px] font-semibold text-sys-blue transition-colors hover:bg-sys-blue/20",
            resgatando && "opacity-60",
          )}
        >
          {resgatando ? <Loader2 className="size-3 animate-spin" /> : <UserPlus className="size-3" />}
          Enviar p/ aprovação
        </button>
      </div>
    );
  };

  return (
    <div className="flex w-[252px] shrink-0 flex-col rounded-xl border border-sys-blue/20 bg-sys-blue/5">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Snowflake aria-hidden className="size-3 shrink-0 text-sys-blue" />
          <span className="truncate text-[11px] font-semibold text-foreground">Frios — revisão</span>
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold tabular-nums text-muted-foreground"
            title={`${total} leads frios no recorte (últimos 90 dias, sem decisão e sem deal)`}
          >
            {contagem}
          </span>
        </div>
      </div>

      <RevisaoLista
        itens={leads}
        renderItem={card}
        rotulo="Leads frios para revisão"
        vazio={
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center">
            <p className="text-[10px] leading-relaxed text-muted-foreground">Nenhum lead frio nos últimos 90 dias</p>
          </div>
        }
        maisRestantes={maisRestantes}
        carregandoMais={carregandoMais}
        onCarregarMais={onCarregarMais}
        tomBotao="border-sys-blue/30 text-sys-blue hover:bg-sys-blue/10"
      />
    </div>
  );
}
