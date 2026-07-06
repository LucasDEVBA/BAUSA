"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, FileText, Sparkles } from "lucide-react";
import { MinimalCard } from "@/components/shared/MinimalUI";
import {
  getTranscricaoReuniao,
  type ReuniaoTranscricao,
} from "@/lib/actions/transcricoes";

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
 * Bloco "Transcrição da reunião" — capturada automaticamente do Google
 * Meet pela CF meeting-transcripts. Sem registro → não renderiza nada
 * (a transcrição só existe depois que a reunião acontece e o Meet gera
 * o Doc anexado ao evento).
 */
export function TranscricaoReuniaoCard({
  dealId,
  formSubmissionId,
}: TranscricaoReuniaoCardProps) {
  const [transcricao, setTranscricao] = useState<ReuniaoTranscricao | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    getTranscricaoReuniao({ dealId, formSubmissionId })
      .then((data) => {
        if (!cancelled) setTranscricao(data);
      })
      .catch(() => {
        if (!cancelled) setTranscricao(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dealId, formSubmissionId]);

  if (!transcricao) return null;

  return (
    <MinimalCard
      title="Transcrição da reunião"
      icon={FileText}
      iconColor="text-sys-purple"
      action={
        <span className="text-[10px] tabular-nums text-muted-foreground">
          Capturada em {fmtDateTime(transcricao.capturada_at)}
        </span>
      }
    >
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
    </MinimalCard>
  );
}
