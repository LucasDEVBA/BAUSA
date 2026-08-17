"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import {
  ChevronDown,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { MinimalCard } from "@/components/shared/MinimalUI";
import { Badge, type BadgeTone } from "@/components/ui";
import {
  listarTranscricoesReuniao,
  type ReuniaoTranscricao,
} from "@/lib/actions/transcricoes";
import {
  extrairCaracteristicasReuniao,
  type CaracteristicasReuniao,
} from "@/lib/actions/reuniao-caracteristicas";
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

// ─── Características valorizadas (extraídas por IA) ─────────────────────

const URGENCIA_CONFIG: Record<
  NonNullable<CaracteristicasReuniao["urgencia"]["nivel"]>,
  { label: string; tone: BadgeTone }
> = {
  alta: { label: "Urgência alta", tone: "green" },
  media: { label: "Urgência média", tone: "orange" },
  baixa: { label: "Urgência baixa", tone: "red" },
};

/** Lista com marcador colorido — objeções/sinais/próximos passos. */
function ListaCaracteristica({
  titulo,
  itens,
  corTitulo,
  corMarcador,
}: {
  titulo: string;
  itens: string[];
  corTitulo: string;
  corMarcador: string;
}) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p
        className={cn(
          "mb-1 text-[9px] font-semibold uppercase tracking-widest",
          corTitulo,
        )}
      >
        {titulo}
      </p>
      <ul className="space-y-1">
        {itens.map((item) => (
          <li
            key={item}
            className="flex gap-1.5 text-[11px] leading-snug text-foreground/85"
          >
            <span
              aria-hidden
              className={cn("mt-1.5 size-1 shrink-0 rounded-full", corMarcador)}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Painel "Características da reunião" — resultado da extração por IA. */
function CaracteristicasPanel({
  caracteristicas: c,
  extraindo,
  onReprocessar,
}: {
  caracteristicas: CaracteristicasReuniao;
  extraindo: boolean;
  onReprocessar: () => void;
}) {
  const urgencia = c.urgencia.nivel ? URGENCIA_CONFIG[c.urgencia.nivel] : null;
  const temValor = Boolean(c.valor_investimento);

  return (
    <div className="rounded-md border border-sys-purple/20 bg-sys-purple/5">
      <div className="flex items-center justify-between gap-2 border-b border-sys-purple/15 px-3 py-1.5">
        <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-widest text-sys-purple">
          <Sparkles className="h-2.5 w-2.5" />
          Características da reunião
        </p>
        <button
          type="button"
          onClick={onReprocessar}
          disabled={extraindo}
          title="Reprocessar a extração com IA"
          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <RotateCw className={cn("h-2.5 w-2.5", extraindo && "animate-spin")} />
          Reprocessar
        </button>
      </div>

      <div className="space-y-2.5 p-2.5">
        {/* Destaques: valor de investimento + urgência */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div
            className={cn(
              "rounded-md border px-2.5 py-2",
              temValor
                ? "border-sys-green/25 bg-sys-green/8"
                : "border-border bg-secondary/30",
            )}
          >
            <p
              className={cn(
                "text-[9px] font-semibold uppercase tracking-widest",
                temValor ? "text-sys-green" : "text-muted-foreground",
              )}
            >
              Valor de investimento
            </p>
            <p
              className={cn(
                "mt-1 text-xs font-medium leading-snug",
                temValor ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {c.valor_investimento ?? "Não mencionado na reunião"}
            </p>
          </div>

          <div className="rounded-md border border-border bg-secondary/30 px-2.5 py-2">
            <p className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Urgência
            </p>
            <div className="mt-1">
              {urgencia ? (
                <Badge tone={urgencia.tone} size="sm">
                  {urgencia.label}
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Não foi possível avaliar
                </span>
              )}
            </div>
            {c.urgencia.justificativa && (
              <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                {c.urgencia.justificativa}
              </p>
            )}
          </div>
        </div>

        {c.decisor && (
          <div>
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
              Decisor
            </p>
            <p className="text-[11px] leading-snug text-foreground/85">{c.decisor}</p>
          </div>
        )}

        <ListaCaracteristica
          titulo="Objeções"
          itens={c.objecoes}
          corTitulo="text-sys-red"
          corMarcador="bg-sys-red"
        />
        <ListaCaracteristica
          titulo="Sinais de interesse"
          itens={c.sinais_interesse}
          corTitulo="text-sys-green"
          corMarcador="bg-sys-green"
        />
        <ListaCaracteristica
          titulo="Próximos passos"
          itens={c.proximos_passos}
          corTitulo="text-sys-blue"
          corMarcador="bg-sys-blue"
        />

        {c.resumo_fit && (
          <div className="rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2">
            <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
              Fit BAUSA
            </p>
            <p className="text-[11px] leading-snug text-foreground/90">{c.resumo_fit}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Uma reunião transcrita ─────────────────────────────────────────────

/** Uma reunião transcrita (resumo Gemini + características + transcrição + Doc). */
function TranscricaoItem({
  t,
  rotulo,
  aberta,
  extraindo,
  onExtrair,
}: {
  t: ReuniaoTranscricao;
  rotulo: string;
  aberta: boolean;
  extraindo: boolean;
  onExtrair: (force: boolean) => void;
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

        {t.caracteristicas ? (
          <CaracteristicasPanel
            caracteristicas={t.caracteristicas}
            extraindo={extraindo}
            onReprocessar={() => onExtrair(true)}
          />
        ) : (
          t.transcript_text && (
            <button
              type="button"
              onClick={() => onExtrair(false)}
              disabled={extraindo}
              className="inline-flex items-center gap-1.5 rounded-md border border-sys-purple/25 bg-sys-purple/8 px-2.5 py-1.5 text-[11px] font-medium text-sys-purple transition-colors hover:bg-sys-purple/15 disabled:opacity-60"
            >
              {extraindo ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              {extraindo
                ? "Extraindo características…"
                : "Extrair características (IA)"}
            </button>
          )
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
 * atualizar re-consulta o banco (útil logo após a reunião). Cada reunião com
 * transcrição pode ter as "características valorizadas" extraídas por IA
 * (cacheadas em reunioes_transcricoes.caracteristicas).
 */
export function TranscricaoReuniaoCard({
  dealId,
  formSubmissionId,
}: TranscricaoReuniaoCardProps) {
  const [transcricoes, setTranscricoes] = useState<ReuniaoTranscricao[]>([]);
  const [carregou, setCarregou] = useState(false);
  const [atualizando, setAtualizando] = useState(false);
  const [extraindoId, setExtraindoId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

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

  const extrair = useCallback((transcricaoId: string, force: boolean) => {
    setExtraindoId(transcricaoId);
    startTransition(async () => {
      try {
        const res = await extrairCaracteristicasReuniao(transcricaoId, force);
        if (res.success) {
          setTranscricoes((prev) =>
            prev.map((t) =>
              t.id === transcricaoId
                ? { ...t, caracteristicas: res.caracteristicas }
                : t,
            ),
          );
          if (!res.fromCache) toast.success("Características extraídas da reunião");
        } else {
          toast.error(res.error);
        }
      } catch {
        toast.error("Não foi possível extrair as características agora.");
      } finally {
        setExtraindoId(null);
      }
    });
  }, []);

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
              extraindo={extraindoId === t.id}
              onExtrair={(force) => extrair(t.id, force)}
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
