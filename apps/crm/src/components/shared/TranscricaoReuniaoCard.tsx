"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ExternalLink, FileText, RefreshCw, Sparkles } from "lucide-react";
import { MinimalCard } from "@/components/shared/MinimalUI";
import {
  getTranscricaoReuniao,
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

/**
 * Bloco "Transcrição da reunião" — capturada automaticamente do Google Meet
 * pela CF meeting-transcripts (a cada 2h). A captura NÃO é em tempo real: o
 * botão de atualizar re-consulta o banco para ver se uma nova transcrição já
 * caiu (útil logo após a reunião, sem reabrir o detalhe).
 */
export function TranscricaoReuniaoCard({
  dealId,
  formSubmissionId,
}: TranscricaoReuniaoCardProps) {
  const [transcricao, setTranscricao] = useState<ReuniaoTranscricao | null>(null);
  const [carregou, setCarregou] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = useCallback(
    async (comSpinner: boolean) => {
      if (!dealId && !formSubmissionId) return;
      if (comSpinner) setAtualizando(true);
      try {
        const data = await getTranscricaoReuniao({ dealId, formSubmissionId });
        setTranscricao(data);
      } catch {
        setTranscricao(null);
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
  if (!carregou && !transcricao) return null;

  const botaoRefresh = (
    <button
      type="button"
      onClick={() => void carregar(true)}
      disabled={atualizando}
      aria-label="Atualizar transcrição"
      title="Verificar se há transcrição nova"
      className="flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
    >
      <RefreshCw className={cn("h-3.5 w-3.5", atualizando && "animate-spin")} />
    </button>
  );

  return (
    <MinimalCard
      title="Transcrição da reunião"
      icon={FileText}
      iconColor="text-sys-purple"
      action={
        <div className="flex items-center gap-2">
          {transcricao && (
            <span className="text-[10px] tabular-nums text-muted-foreground">
              Capturada em {fmtDateTime(transcricao.capturada_at)}
            </span>
          )}
          {botaoRefresh}
        </div>
      }
    >
      {transcricao ? (
        <div className="space-y-2.5">
          {transcricao.resumo && (
            <div className="rounded-md border border-primary/20 bg-primary/5 px-3 py-2">
              <p className="mb-1 flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-primary">
                <Sparkles className="h-2.5 w-2.5" />
                Resumo (Gemini)
              </p>
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
                {transcricao.resumo}
              </p>
            </div>
          )}

          {transcricao.transcript_text && (
            <details className="group rounded-md border border-border bg-background/40">
              <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-[11px] font-medium text-foreground/80 transition-colors hover:text-foreground">
                <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                Transcrição completa
              </summary>
              <div className="max-h-64 overflow-y-auto border-t border-border px-3 py-2">
                <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground/80">
                  {transcricao.transcript_text}
                </p>
              </div>
            </details>
          )}

          {transcricao.doc_url && (
            <a
              href={transcricao.doc_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Abrir no Google Docs
              <ExternalLink className="h-3 w-3 opacity-60" />
            </a>
          )}
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
