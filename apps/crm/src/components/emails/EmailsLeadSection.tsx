"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { ArrowDownLeft, ArrowUpRight, Loader2, Mail, Paperclip, Plus } from "lucide-react";

import { Badge, Button } from "@/components/ui";
import { localPart, statusChips } from "@/components/emails/email-status";
import {
  CompositorEmail,
  type CompositorPrefill,
} from "@/app/(dashboard)/emails/compositor";
import { listarEmailsLead } from "@/lib/actions/emails";
import type { EmailMensagem } from "@/lib/emails-queries";
import { CAIXA_EMAIL_PADRAO } from "@/lib/emails-queries";
import { cn, formatRelativeTime } from "@/lib/utils";

/**
 * Aba "E-mails" no detalhe do lead/deal (LeadDetailModal + DealDetailModal).
 * Carrega a timeline SOB DEMANDA — o componente só monta quando a aba abre,
 * então o fetch no mount não pesa o load do sheet.
 */
export function EmailsLeadSection({
  formSubmissionId,
  leadNome,
  leadEmail,
}: {
  /** form_submissions.id do lead (null = lead sem vínculo). */
  formSubmissionId: string | null;
  leadNome?: string | null;
  /** E-mail preferencial de contato (responsável > atleta). */
  leadEmail?: string | null;
}) {
  const [mensagens, setMensagens] = useState<EmailMensagem[]>([]);
  const [contas, setContas] = useState<string[]>([CAIXA_EMAIL_PADRAO]);
  const [padraoEnvio, setPadraoEnvio] = useState(CAIXA_EMAIL_PADRAO);
  const [assinaturas, setAssinaturas] = useState<Record<string, string>>({});
  const [erro, setErro] = useState<string | null>(null);
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [compositorAberto, setCompositorAberto] = useState(false);
  const [carregando, startCarregar] = useTransition();

  const carregar = useCallback(() => {
    if (!formSubmissionId) return;
    startCarregar(async () => {
      const res = await listarEmailsLead(formSubmissionId);
      if (!res.success) {
        setErro(res.error);
        return;
      }
      setErro(null);
      setMensagens(res.mensagens);
      setContas(res.contas);
      setPadraoEnvio(res.padraoEnvio);
      setAssinaturas(res.assinaturas);
    });
  }, [formSubmissionId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  if (!formSubmissionId) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        Lead sem vínculo com o formulário — sem histórico de e-mails.
      </p>
    );
  }

  const prefill: CompositorPrefill = {
    para: leadEmail ?? undefined,
    formSubmissionId,
    leadNome: leadNome ?? undefined,
  };

  return (
    <div className="space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Mail className="h-3 w-3 text-sys-blue" />
          E-mails do lead
        </h3>
        <Button size="sm" onClick={() => setCompositorAberto(true)}>
          <Plus />
          Novo e-mail
        </Button>
      </header>

      {!leadEmail && (
        <p className="text-[11px] text-muted-foreground">
          Lead sem e-mail cadastrado — o destinatário precisa ser digitado no compositor.
        </p>
      )}

      {erro && (
        <p role="alert" className="text-xs font-medium text-sys-red">
          {erro}
        </p>
      )}

      {carregando && mensagens.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Carregando e-mails…
        </div>
      ) : mensagens.length === 0 && !erro ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nenhum e-mail trocado com este lead ainda.
        </p>
      ) : (
        <ol className="space-y-1.5">
          {mensagens.map((msg) => {
            const enviado = msg.direcao === "enviado";
            const Icon = enviado ? ArrowUpRight : ArrowDownLeft;
            const expandido = expandidoId === msg.id;
            const corpo = msg.corpoText ?? msg.snippet;
            return (
              <li
                key={msg.id}
                className="rounded-md border border-border bg-background/40"
              >
                <button
                  type="button"
                  onClick={() => setExpandidoId(expandido ? null : msg.id)}
                  aria-expanded={expandido}
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                      enviado
                        ? "bg-primary/10 text-primary"
                        : "bg-sys-green/15 text-sys-green",
                    )}
                    title={enviado ? "Enviado" : "Recebido"}
                  >
                    <Icon className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {msg.assunto || "(sem assunto)"}
                      </span>
                      {enviado &&
                        statusChips(msg).map((chip) => (
                          <Badge key={chip.label} tone={chip.tone} size="sm">
                            {chip.label}
                          </Badge>
                        ))}
                      {msg.anexos && msg.anexos.length > 0 && (
                        <Badge
                          tone="neutral"
                          size="sm"
                          title={msg.anexos.map((a) => a.nome).join(", ")}
                        >
                          <Paperclip aria-hidden className="h-3 w-3" />
                          {msg.anexos.length}
                        </Badge>
                      )}
                      {contas.length > 1 && msg.caixaEmail && (
                        <Badge tone="neutral" size="sm">
                          {localPart(msg.caixaEmail)}
                        </Badge>
                      )}
                      <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground">
                        {formatRelativeTime(msg.mensagemEm)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                      {enviado ? `para ${msg.paraEmail}` : `de ${msg.deEmail}`}
                    </span>
                    {corpo && (
                      <span
                        className={cn(
                          "mt-1 block text-xs leading-relaxed text-muted-foreground",
                          expandido
                            ? "whitespace-pre-wrap break-words text-foreground"
                            : "truncate",
                        )}
                      >
                        {expandido ? corpo : (msg.snippet ?? corpo)}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}

      {/* Compositor pré-preenchido — remonta zerado a cada abertura */}
      {compositorAberto && (
        <CompositorEmail
          prefill={prefill}
          contas={contas}
          padraoEnvio={padraoEnvio}
          assinaturas={assinaturas}
          onFechar={() => setCompositorAberto(false)}
          onEnviado={carregar}
        />
      )}
    </div>
  );
}
