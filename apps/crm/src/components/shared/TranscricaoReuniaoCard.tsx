"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ExternalLink, FileText, RefreshCw, Sparkles } from "lucide-react";
import { MinimalCard } from "@/components/shared/MinimalUI";
import {
  listarTranscricoesReuniao,
  type ReuniaoTranscricao,
} from "@/lib/actions/transcricoes";
import { cn } from "@/lib/utils";

interface TranscricaoReuniaoCardProps {
  dealId?: string;
  formSubmissionId?: string;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Uma reunião transcrita (resumo Gemini + transcrição completa + Doc). */
function TranscricaoItem({
  t,
  rotulo,
  aberta,
}: {
  t: ReuniaoTranscricao;
  rotulo: string;
  aberta: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card/60">
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {rotulo}
        </span>
        <span className="text-[10px] tabular-nums text-label-tertiary">
          {fmtDateTime(t.capturada_at)}
        </span>
      </div>
      <div className="space-y-2 p-2.5">
        {t.resumo && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
            <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-primary">
              <Sparkles className="h-2.5 w-2.5" />
              Resumo (Gemini)
            </p>
            <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {t.resumo}
            </p>
          </div>
        )}

        {t.transcript_text && (
          <details className="group rounded-md border border-border bg-background/40" open={aberta}>
            <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-foreground/80 transition-colors hover:text-foreground">
              <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
              Transcrição completa
            </summary>
            <div className="max-h-64 overflow-y-auto border-t border-border px-3 py-2">
              <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                {t.transcript_text}
              </p>
            </div>
          </details>
        )}

        {t.doc_url && (
          <a
            href={t.doc_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Abrir no Google Docs
            <ExternalLink className="h-3 w-3 opacity-60" />
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Bloco "Transcrições das reuniões" — capturadas automaticamente do Google Meet
 * pela CF meeting-transcripts (a cada 2h). Um lead/deal pode ter VÁRIAS reuniões
 * (remarcações, follow-ups): todas são acumuladas aqui, uma por reunião, da mais
 * recente para a mais antiga. A captura NÃO é em tempo real — o botão de
 * atualizar re-consulta o banco (útil logo após a reunião).
 */
export function TranscricaoReuniaoCard({
  dealId,
  formSubmissionId,
}: TranscricaoReuniaoCardProps) {
  const [transcricoes, setTranscricoes] = useState<ReuniaoTranscricao[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(
    async (comSpinner: boolean) => {
      if (!dealId && !formSubmissionId) return;
      if (comSpinner) setAtualizando(true);
      try {
        const data = await listarTranscricoesReuniao({ dealId, formSubmissionId });
        setTranscricoes(data);
      } catch {
        setTranscricoes([]);
      } finally {
        setCarregou(true);
        setAtualizando(false);
      }
    },
    [dealId, formSubmissionId],
  );

  useEffect(() => {
    void carregar(false);
  }, [carregar]);

  // Antes da 1ª carga não pisca o estado vazio.
  if (!carregou && transcricoes.length === 0) return null;

  const total = transcricoes.length;
  const titulo = total > 1 ? "Transcrições das reuniões" : "Transcrição da reunião";

  const botaoRefresh = (
    <button
      type="button"
      onClick={() => void carregar(true)}
      disabled={atualizando}
      aria-label="Atualizar transcrições"
      title="Verificar se há transcrição nova"
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", atualizando && "animate-spin")} />
    </button>
  );

  return (
    <MinimalCard
      title={titulo}
      icon={FileText}
      iconColor="text-sys-purple"
      action={
        <div className="flex items-center gap-2">
          {total > 0 && (
            <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-muted-foreground">
              {total} reunião{total > 1 ? "s" : ""}
            </span>
          )}
          {botaoRefresh}
        </div>
      }
    >
      {total > 0 ? (
        <div className="space-y-2.5">
          {transcricoes.map((t, i) => (
            <TranscricaoItem
              key={t.id}
              t={t}
              rotulo={
                total > 1
                  ? i === 0
                    ? "Reunião mais recente"
                    : `Reunião ${total - i}`
                  : "Reunião"
              }
              // só a mais recente já vem aberta quando é a única
              aberta={total === 1}
            />
          ))}
        </div>
      ) : (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Nenhuma transcrição capturada ainda. Ela aparece após a reunião, quando o Google Meet
          gera o Doc (verificação automática a cada 2h) — use o botão para checar agora.
        </p>
      )}
    </MinimalCard>
  );
}
