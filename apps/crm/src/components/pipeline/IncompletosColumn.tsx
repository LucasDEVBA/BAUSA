"use client";

import { useState, useTransition } from "react";
import { FileQuestion, Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { enviarIncompletoParaAprovacao, type LeadIncompletoCard } from "@/lib/actions/leads";
import { cn, formatRelativeTime } from "@/lib/utils";

import { ReuniaoDetectadaBadge } from "./ReuniaoDetectadaBadge";
import { RevisaoLista } from "./RevisaoLista";

/**
 * Coluna "Incompletos — revisão" (pedido do CEO, 2026-09-23).
 *
 * INCOMPLETO (profissão/faixa ausentes no formulário) ficava invisível — fora
 * de fila, board e outreach. Mesmo desenho da coluna Frios: últimos 90 dias
 * visíveis, cards NÃO arrastáveis, zero métrica/automação/outreach. Saídas:
 * resgate explícito (MORNO provisório, caso Pietro) ou reprovação no dossiê.
 */

interface IncompletosColumnProps {
  /** Cards já FILTRADOS pelo board (busca/classe). */
  leads: LeadIncompletoCard[];
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

export function IncompletosColumn({
  leads,
  total,
  maisRestantes,
  carregandoMais,
  onCarregarMais,
  onResgatado,
  onLeadClick,
}: IncompletosColumnProps) {
  const [resgatandoId, setResgatandoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const resgatar = (lead: LeadIncompletoCard) => {
    setResgatandoId(lead.id);
    startTransition(async () => {
      try {
        const r = await enviarIncompletoParaAprovacao(lead.id);
        if (r.success) {
          toast.success(`${lead.athlete_name} enviado para a fila de aprovação`, {
            description: "Entrou como MORNO provisório — complete os dados na conversa e decida na fila.",
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

  const card = (lead: LeadIncompletoCard) => {
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
        className="group relative cursor-pointer rounded-xl border border-border bg-card p-2.5 pl-3 shadow-xs transition-all hover:-translate-y-px hover:border-sys-purple/40 hover:shadow-md"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute left-0 top-3 h-5 w-[3px] rounded-r-full bg-sys-purple"
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
          <span className="inline-flex items-center gap-0.5 rounded bg-sys-purple/12 px-1 py-px text-[9px] font-medium text-sys-purple">
            <FileQuestion aria-hidden className="h-2 w-2" />
            INCOMPLETO
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
            "mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-md bg-sys-purple/10 px-2 py-1 text-[10px] font-semibold text-sys-purple transition-colors hover:bg-sys-purple/20",
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
    <div className="flex w-[252px] shrink-0 flex-col rounded-xl border border-sys-purple/20 bg-sys-purple/5">
      <div className="flex items-center justify-between gap-2 px-2.5 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <FileQuestion aria-hidden className="size-3 shrink-0 text-sys-purple" />
          <span className="truncate text-[11px] font-semibold text-foreground">Incompletos — revisão</span>
          <span
            className="flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-card px-1 text-[10px] font-semibold tabular-nums text-muted-foreground"
            title={`${total} cadastros incompletos no recorte (últimos 90 dias, sem decisão e sem deal)`}
          >
            {contagem}
          </span>
        </div>
      </div>

      <RevisaoLista
        itens={leads}
        renderItem={card}
        rotulo="Cadastros incompletos para revisão"
        vazio={
          <div className="flex flex-1 items-center justify-center px-3 py-6 text-center">
            <p className="text-[10px] leading-relaxed text-muted-foreground">Nenhum cadastro incompleto nos últimos 90 dias</p>
          </div>
        }
        maisRestantes={maisRestantes}
        carregandoMais={carregandoMais}
        onCarregarMais={onCarregarMais}
        tomBotao="border-sys-purple/30 text-sys-purple hover:bg-sys-purple/10"
      />
    </div>
  );
}
