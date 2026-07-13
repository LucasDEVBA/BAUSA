"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  Users,
  RefreshCw,
  Link2,
  MessageSquareText,
  Loader2,
  Info,
  ShieldCheck,
  ShieldOff,
  Send,
  Sparkles,
  Brain,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Card, EmptyState, Input, PageHeader, ScrollList, Skeleton } from "@/components/ui";
import { cn } from "@/lib/utils";
import { sugerirRespostaChatbot } from "@/lib/actions/chatbot-sugestao";
import { extrairMemoriaConversa } from "@/lib/actions/lead-memoria";
import { gerarInsightsGrupo, type InsightsConversa } from "@/lib/actions/whatsapp-insights";
import {
  definirCapturaGrupo,
  listarAtletasParaVinculo,
  listarGrupos,
  listarMensagensGrupo,
  metricasGrupo,
  vincularGrupoFamilia,
  type AtletaOpcao,
  type GrupoItem,
  type GrupoMensagem,
  type MetricasGrupo,
} from "@/lib/actions/whatsapp-grupos";

// -13rem: desconta header + padding do main + faixa de abas (igual ao espelho 1:1).
const PANEL_HEIGHT = "h-[calc(100vh-13rem)] min-h-[26rem]";
const MESSAGE_MAX_LENGTH = 4096;
const THREAD_POLL_MS = 12_000;
/** Eco local sem confirmação do espelho some depois disso (evita fantasma eterno). */
const ECHO_TTL_MS = 10 * 60_000;

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const HORA = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Sao_Paulo",
});
const DIA_CURTO = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

function formatUltimaAtividade(iso: string | null): string {
  if (!iso) return "Sem atividade";
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? DATA_HORA.format(ms) : "Sem atividade";
}

function fmtDataMs(ms: number | null): string {
  if (ms === null) return "—";
  return DATA_HORA.format(ms);
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n)}%`;
}

const MIDIA_LABEL: Record<string, string> = {
  image: "[Foto]",
  audio: "[Áudio]",
  video: "[Vídeo]",
  document: "[Documento]",
  sticker: "[Figurinha]",
  location: "[Localização]",
  contact: "[Contato]",
  reaction: "[Reação]",
  other: "[Mídia]",
};

// ─── Mensagem de grupo (bolha; participante_nome quando não é nossa) ─────────

function GrupoMessageBubble({ m }: { m: GrupoMensagem }) {
  return (
    <div className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] space-y-1 rounded-2xl px-3 py-2",
          m.fromMe ? "rounded-br-md bg-primary/10" : "rounded-bl-md bg-secondary",
        )}
      >
        {!m.fromMe && m.participanteNome && (
          <p className="text-[11px] font-semibold text-primary">{m.participanteNome}</p>
        )}
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">
          {m.texto ?? MIDIA_LABEL[m.tipo] ?? "[Mídia]"}
        </p>
        {m.timestamp !== null && (
          <p className="text-right text-[10px] tabular-nums text-muted-foreground">
            {HORA.format(m.timestamp)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Painel de métricas do grupo (coluna direita) ───────────────────────────

function MetricaMini({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-label-tertiary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-[10px] tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Mini timeline de atividade diária (barras compactas). */
function MiniTimeline({ serie }: { serie: MetricasGrupo["serie"] }) {
  const max = Math.max(1, ...serie.map((d) => d.total));
  const primeiro = serie[0];
  const ultimo = serie[serie.length - 1];
  return (
    <div className="space-y-1">
      <div className="flex h-16 items-end gap-0.5" role="img" aria-label="Atividade diária do grupo">
        {serie.map((d) => (
          <div
            key={d.dia}
            title={`${d.dia}: ${d.total} mensagem(ns)`}
            className="flex-1 rounded-t bg-primary/60"
            style={{ height: `${Math.max(3, (d.total / max) * 100)}%` }}
          />
        ))}
      </div>
      {primeiro && ultimo && (
        <div className="flex justify-between text-[10px] tabular-nums text-muted-foreground">
          <span>{DIA_CURTO.format(Date.parse(`${primeiro.dia}T12:00:00`))}</span>
          <span>{DIA_CURTO.format(Date.parse(`${ultimo.dia}T12:00:00`))}</span>
        </div>
      )}
    </div>
  );
}

/** Bloco de insights de IA do grupo (sob demanda) — espelha o bloco 1:1. */
function GrupoInsightsBlock({
  insights,
  insightsLoading,
  temMensagens,
  onGerar,
  onLimpar,
}: {
  insights: InsightsConversa | null;
  insightsLoading: boolean;
  temMensagens: boolean;
  onGerar: () => void;
  onLimpar: () => void;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-eyebrow text-label-tertiary">Insights de IA</p>
        {insights && (
          <button
            type="button"
            onClick={onLimpar}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            limpar
          </button>
        )}
      </div>

      {insights ? (
        <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span
              className={cn(
                "rounded px-1.5 py-px text-[10px] font-semibold",
                insights.sentimento === "positivo" && "bg-sys-green/12 text-sys-green",
                insights.sentimento === "negativo" && "bg-sys-red/12 text-sys-red",
                (insights.sentimento === "neutro" || insights.sentimento === "indeciso") &&
                  "bg-sys-orange/12 text-sys-orange",
              )}
            >
              {insights.sentimento}
            </span>
            <span
              className={cn(
                "rounded px-1.5 py-px text-[10px] font-semibold",
                insights.interesse === "alto" && "bg-sys-green/12 text-sys-green",
                insights.interesse === "medio" && "bg-sys-orange/12 text-sys-orange",
                insights.interesse === "baixo" && "bg-sys-red/12 text-sys-red",
              )}
            >
              interesse {insights.interesse}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-foreground">{insights.resumo}</p>
          <p className="text-xs leading-relaxed text-foreground">
            <span className="font-semibold text-primary">Próxima ação:</span> {insights.proxima_acao}
          </p>
          {insights.sinais.length > 0 && (
            <ul className="space-y-0.5 border-t border-primary/15 pt-2">
              {insights.sinais.map((sinal, i) => (
                <li
                  key={`${i}-${sinal.slice(0, 24)}`}
                  className="text-[11px] leading-relaxed text-muted-foreground"
                >
                  • {sinal}
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={insightsLoading}
            onClick={onGerar}
          >
            {insightsLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Regenerar
          </Button>
        </div>
      ) : (
        <>
          <Button
            variant="secondary"
            size="sm"
            className="w-full"
            disabled={insightsLoading || !temMensagens}
            onClick={onGerar}
          >
            {insightsLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
            Gerar insights do grupo
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            A IA resume o clima do grupo, o interesse e sugere a próxima ação. Edite o prompt em
            Agents.
          </p>
        </>
      )}
    </section>
  );
}

/** Extração SOB DEMANDA de memória + documentos do grupo vinculado (CEO). */
function GrupoMemoriaBlock({
  grupo,
  podeGerenciar,
}: {
  grupo: GrupoItem;
  podeGerenciar: boolean;
}) {
  const [extraindo, setExtraindo] = useState(false);
  const vinculado = Boolean(grupo.atletaId);

  // Escrita da memória é CEO-only (RLS) — só o gestor vê a ação.
  if (!podeGerenciar) return null;

  const handleExtrair = async () => {
    if (!vinculado || extraindo) return;
    setExtraindo(true);
    try {
      const r = await extrairMemoriaConversa({
        grupoId: grupo.grupoId,
        atletaId: grupo.atletaId ?? undefined,
        experienciaId: grupo.experienciaId ?? undefined,
      });
      if (!r.success) {
        toast.error(r.notConfigured ? "IA não configurada neste ambiente." : r.error);
        return;
      }
      toast.success(
        `Memória atualizada: ${r.fatosNovos} ${r.fatosNovos === 1 ? "fato" : "fatos"}, ${r.documentosNovos} ${r.documentosNovos === 1 ? "documento" : "documentos"}.`,
        {
          description:
            r.documentosNovos > 0
              ? "Os documentos aparecem no detalhe do lead (seção Documentos)."
              : undefined,
        },
      );
    } catch {
      toast.error("Não foi possível extrair a memória agora.");
    } finally {
      setExtraindo(false);
    }
  };

  return (
    <section className="space-y-2">
      <p className="text-eyebrow text-label-tertiary">Memória & Documentos</p>
      <Button
        variant="secondary"
        size="sm"
        className="w-full"
        disabled={!vinculado || extraindo}
        onClick={() => void handleExtrair()}
      >
        {extraindo ? <Loader2 className="animate-spin" /> : <Brain />}
        Extrair memória & docs
      </Button>
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        {vinculado
          ? "A IA extrai fatos/insights para a memória da família e identifica documentos enviados. Ela nunca envia nada."
          : "Vincule o grupo a uma família (à esquerda) para extrair memória & documentos."}
      </p>
    </section>
  );
}

function MetricasGrupoPanel({
  grupo,
  metricas,
  loading,
  insights,
  insightsLoading,
  podeGerenciar,
  onGerarInsights,
  onLimparInsights,
}: {
  grupo: GrupoItem;
  metricas: MetricasGrupo | null;
  loading: boolean;
  insights: InsightsConversa | null;
  insightsLoading: boolean;
  podeGerenciar: boolean;
  onGerarInsights: () => void;
  onLimparInsights: () => void;
}) {
  const temMensagens = (metricas?.total ?? 0) > 0;
  return (
    <div className="crm-scroll flex h-full flex-col gap-3 overflow-y-auto p-3">
      <p className="text-eyebrow text-label-tertiary">Métricas do grupo</p>

      {loading && !metricas ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : metricas && metricas.total > 0 ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricaMini
              label="Mensagens"
              value={metricas.total.toLocaleString("pt-BR")}
              sub={metricas.janelaTruncada ? "janela recente" : "capturadas"}
            />
            <MetricaMini
              label="Participantes"
              value={metricas.participantesAtivos.toLocaleString("pt-BR")}
              sub="falaram no grupo"
            />
            <MetricaMini label="Enviadas por nós" value={fmtPct(metricas.pctEnviadasNos)} sub={`${metricas.enviadasNos} msgs`} />
            <MetricaMini label="Últimos 7 dias" value={metricas.ativos7d.toLocaleString("pt-BR")} sub={`30d: ${metricas.ativos30d.toLocaleString("pt-BR")}`} />
          </div>

          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-label-tertiary/80">
              Atividade (14 dias)
            </p>
            <MiniTimeline serie={metricas.serie} />
            <p className="text-[10px] tabular-nums text-muted-foreground">
              Última atividade: {fmtDataMs(metricas.ultimaAtividadeMs)}
            </p>
          </div>

          {metricas.topParticipantes.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-label-tertiary/80">
                Quem mais fala
              </p>
              <TopParticipantes participantes={metricas.topParticipantes} />
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Sem mensagens capturadas neste grupo ainda. As métricas aparecem a partir da captura.
        </p>
      )}

      {/* Insights de IA (sob demanda; NÃO auto-dispara). Bloco separado do ✨ do compositor. */}
      <GrupoInsightsBlock
        insights={insights}
        insightsLoading={insightsLoading}
        temMensagens={temMensagens}
        onGerar={onGerarInsights}
        onLimpar={onLimparInsights}
      />

      {/* Memória & Documentos (sob demanda; a IA nunca envia). */}
      <GrupoMemoriaBlock grupo={grupo} podeGerenciar={podeGerenciar} />
    </div>
  );
}

function TopParticipantes({ participantes }: { participantes: MetricasGrupo["topParticipantes"] }) {
  const max = Math.max(1, ...participantes.map((p) => p.total));
  return (
    <div className="space-y-1">
      {participantes.map((p) => (
        <div key={p.nome} className="flex items-center gap-2">
          <span className="w-24 shrink-0 truncate text-[11px] text-foreground" title={p.nome}>
            {p.nome}
          </span>
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${(p.total / max) * 100}%` }}
              aria-hidden
            />
          </div>
          <span className="w-6 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
            {p.total}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Painel de conversa do grupo (coluna do meio) ───────────────────────────

interface GrupoEcho extends GrupoMensagem {
  criadoEm: number;
}

function GrupoConversaPanel({
  grupo,
  podeGerenciar,
}: {
  grupo: GrupoItem;
  podeGerenciar: boolean;
}) {
  const [mensagens, setMensagens] = useState<GrupoMensagem[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const echoesRef = useRef<GrupoEcho[]>([]);
  const grupoIdRef = useRef(grupo.grupoId);

  useEffect(() => {
    grupoIdRef.current = grupo.grupoId;
  }, [grupo.grupoId]);

  const carregarMensagens = useCallback(
    async (grupoId: string, opts?: { silent?: boolean }) => {
      if (!opts?.silent) setStatus("loading");
      try {
        const r = await listarMensagensGrupo(grupoId);
        if (grupoIdRef.current !== grupoId) return; // trocou de grupo em voo
        if (!r.success) {
          if (!opts?.silent) setStatus("error");
          return;
        }
        const serverIds = new Set(r.mensagens.map((m) => m.id));
        const agora = Date.now();
        echoesRef.current = echoesRef.current.filter(
          (e) => !serverIds.has(e.id) && agora - e.criadoEm < ECHO_TTL_MS,
        );
        setMensagens([...r.mensagens, ...echoesRef.current]);
        setStatus("ready");
      } catch {
        if (grupoIdRef.current === grupoId && !opts?.silent) setStatus("error");
      }
    },
    [],
  );

  // Carga + polling ao (re)selecionar o grupo. Reseta os ecos ao trocar.
  useEffect(() => {
    echoesRef.current = [];
    setMensagens([]);
    setDraft("");
    void carregarMensagens(grupo.grupoId);
    const interval = setInterval(() => {
      if (document.hidden) return;
      void carregarMensagens(grupo.grupoId, { silent: true });
    }, THREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [grupo.grupoId, carregarMensagens]);

  // Auto-scroll ao fim quando as mensagens mudam.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [mensagens]);

  const handleSend = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const message = draft.trim();
      if (message.length === 0 || sending) return;
      const grupoId = grupo.grupoId;
      setSending(true);
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ groupId: grupoId, message }),
        });
        const data = (await res.json().catch(() => null)) as
          | { success?: boolean; error?: string; messageId?: string | null }
          | null;
        if (!res.ok) {
          toast.error(
            data?.error === "zapi_nao_configurado"
              ? "Z-API não configurada no ambiente do Engine."
              : data?.error === "grupo_nao_autorizado"
                ? "Você não pode enviar para este grupo."
                : "Falha ao enviar a mensagem. Tente novamente.",
          );
          return;
        }
        setDraft("");
        const echo: GrupoEcho = {
          id: data?.messageId ?? `local-${Date.now()}`,
          fromMe: true,
          texto: message,
          tipo: "text",
          mediaUrl: null,
          fileName: null,
          participanteNome: null,
          timestamp: Date.now(),
          criadoEm: Date.now(),
        };
        echoesRef.current = [...echoesRef.current, echo];
        if (grupoIdRef.current === grupoId) {
          setMensagens((prev) => [...prev, echo]);
          void carregarMensagens(grupoId, { silent: true });
        }
      } catch {
        toast.error("Falha ao enviar a mensagem. Verifique a conexão.");
      } finally {
        setSending(false);
      }
    },
    [draft, sending, grupo.grupoId, carregarMensagens],
  );

  const handleSugerir = useCallback(async () => {
    if (sugerindo) return;
    setSugerindo(true);
    try {
      const r = await sugerirRespostaChatbot({
        grupoId: grupo.grupoId,
        leadNome: grupo.atletaNome ?? undefined,
      });
      if (!r.success) {
        toast.error(r.notConfigured ? "IA não configurada neste ambiente." : r.error);
        return;
      }
      setDraft(r.sugestao);
      toast.success("Sugestão preenchida — revise e envie.");
    } catch {
      toast.error("Não foi possível gerar a sugestão agora.");
    } finally {
      setSugerindo(false);
    }
  }, [sugerindo, grupo.grupoId, grupo.atletaNome]);

  return (
    <>
      <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-white">
          <Users className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {grupo.nome ?? "Grupo sem nome"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {grupo.atletaNome ? (
              <span className="inline-flex items-center gap-1 text-primary">
                <Link2 className="size-3" /> {grupo.atletaNome}
              </span>
            ) : (
              "Sem vínculo com família"
            )}
            {" · "}
            {grupo.totalMensagens.toLocaleString("pt-BR")} msgs
          </p>
        </div>
      </div>

      {status === "loading" ? (
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : status === "error" ? (
        <div className="flex flex-1 items-center justify-center p-6">
          <EmptyState
            icon={TriangleAlert}
            title="Não foi possível carregar as mensagens"
            description="Tente novamente em instantes."
            action={
              <Button variant="secondary" size="sm" onClick={() => void carregarMensagens(grupo.grupoId)}>
                <RefreshCw />
                Tentar novamente
              </Button>
            }
          />
        </div>
      ) : mensagens.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <EmptyState
            icon={MessageSquareText}
            title="Nenhuma mensagem capturada ainda"
            description={
              grupo.capturar
                ? "As mensagens aparecem a partir da captura — sem histórico retroativo. Envie a primeira pelo campo abaixo."
                : "A captura deste grupo está desligada. As mensagens que você enviar aqui aparecem só nesta sessão."
            }
          />
        </div>
      ) : (
        <ScrollList ref={scrollRef} className="space-y-2 p-4" aria-label="Mensagens do grupo">
          {mensagens.map((m) => (
            <GrupoMessageBubble key={m.id} m={m} />
          ))}
        </ScrollList>
      )}

      {/* Compositor + chatbot assistido (IA sugere; humano revisa e envia). */}
      <form onSubmit={handleSend} className="shrink-0 space-y-1.5 border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Sugerir resposta com IA"
            title="A IA sugere; você revisa e envia."
            disabled={sugerindo || sending}
            onClick={() => void handleSugerir()}
          >
            {sugerindo ? <Loader2 className="animate-spin" /> : <Sparkles />}
          </Button>
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escreva uma mensagem para o grupo"
            aria-label="Mensagem para o grupo"
            maxLength={MESSAGE_MAX_LENGTH}
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || draft.trim().length === 0} aria-label="Enviar ao grupo">
            {sending ? <Loader2 className="animate-spin" /> : <Send />}
          </Button>
        </div>
        <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">
          ✨ A IA sugere uma resposta; você revisa e envia. Ela nunca envia sozinha.
          {!podeGerenciar && " Você vê e responde os grupos das suas famílias."}
        </p>
      </form>
    </>
  );
}

// ─── Item da lista de grupos (coluna esquerda) ──────────────────────────────

function GrupoListItem({
  grupo,
  atletas,
  selected,
  pending,
  podeGerenciar,
  onSelect,
  onToggleCaptura,
  onVincular,
}: {
  grupo: GrupoItem;
  atletas: AtletaOpcao[];
  selected: boolean;
  pending: boolean;
  podeGerenciar: boolean;
  onSelect: (grupo: GrupoItem) => void;
  onToggleCaptura: (grupo: GrupoItem) => void;
  onVincular: (grupo: GrupoItem, atletaId: string | null) => void;
}) {
  return (
    <div className={cn("space-y-2 px-3 py-2.5 transition-colors", selected && "bg-primary/10")}>
      <button
        type="button"
        onClick={() => onSelect(grupo)}
        aria-current={selected ? "true" : undefined}
        className="flex w-full items-center gap-2.5 text-left focus-visible:outline-none"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-white">
          <Users className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            {grupo.nome ?? "Grupo sem nome"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {formatUltimaAtividade(grupo.lastMessageAt)}
          </span>
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
            grupo.capturar ? "bg-sys-green/12 text-sys-green" : "bg-secondary text-muted-foreground",
          )}
        >
          {grupo.capturar ? `${grupo.totalMensagens.toLocaleString("pt-BR")}` : "off"}
        </span>
      </button>

      {podeGerenciar ? (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={grupo.capturar}
              disabled={pending}
              onClick={() => onToggleCaptura(grupo)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors disabled:opacity-50",
                grupo.capturar
                  ? "border-sys-green/30 bg-sys-green/10 text-sys-green hover:bg-sys-green/15"
                  : "border-border text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {grupo.capturar ? <ShieldCheck className="size-3.5" /> : <ShieldOff className="size-3.5" />}
              {grupo.capturar ? "Capturando" : "Capturar"}
            </button>
          </div>
          <label className="flex items-center gap-1.5">
            <Link2 className="size-3 shrink-0 text-label-tertiary" />
            <select
              value={grupo.atletaId ?? ""}
              disabled={pending}
              onChange={(e) => onVincular(grupo, e.target.value === "" ? null : e.target.value)}
              aria-label={`Vincular ${grupo.nome ?? "grupo"} à família`}
              className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <option value="">Sem vínculo</option>
              {atletas.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nome}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        grupo.atletaNome && (
          <p className="flex items-center gap-1.5 pl-11 text-[11px] text-primary">
            <Link2 className="size-3 shrink-0" /> {grupo.atletaNome}
          </p>
        )
      )}
    </div>
  );
}

// ─── Tela de grupos ─────────────────────────────────────────────────────────

export function GruposClient({ podeGerenciar }: { podeGerenciar: boolean }) {
  const [grupos, setGrupos] = useState<GrupoItem[]>([]);
  const [atletas, setAtletas] = useState<AtletaOpcao[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<MetricasGrupo | null>(null);
  const [metricasLoading, setMetricasLoading] = useState(false);
  const [insights, setInsights] = useState<InsightsConversa | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [, startTransition] = useTransition();
  const selectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const carregar = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setStatus("loading");
      try {
        const [gruposRes, atletasRes] = await Promise.all([
          listarGrupos(),
          podeGerenciar ? listarAtletasParaVinculo() : Promise.resolve<AtletaOpcao[]>([]),
        ]);
        if (gruposRes.success) {
          setGrupos(gruposRes.grupos);
          setStatus("ready");
        } else {
          setStatus("error");
        }
        setAtletas(atletasRes);
      } catch {
        setStatus("error");
      }
    },
    [podeGerenciar],
  );

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const carregarMetricas = useCallback((grupoId: string) => {
    setMetricas(null);
    setMetricasLoading(true);
    void metricasGrupo(grupoId)
      .then((r) => {
        if (selectedIdRef.current !== grupoId) return;
        if (r.success) setMetricas(r.metricas);
      })
      .finally(() => {
        if (selectedIdRef.current === grupoId) setMetricasLoading(false);
      });
  }, []);

  const handleSelect = useCallback(
    (grupo: GrupoItem) => {
      setSelectedId(grupo.grupoId);
      setInsights(null); // insights são do grupo anterior
      setInsightsLoading(false);
      carregarMetricas(grupo.grupoId);
    },
    [carregarMetricas],
  );

  const handleGerarInsights = useCallback(async () => {
    const grupoId = selectedIdRef.current;
    if (!grupoId || insightsLoading) return;
    setInsightsLoading(true);
    try {
      const r = await gerarInsightsGrupo(grupoId);
      if (selectedIdRef.current !== grupoId) return; // trocou de grupo em voo
      if (!r.success) {
        toast.error(r.notConfigured ? "IA não configurada neste ambiente." : r.error);
        return;
      }
      setInsights(r.insights);
    } catch {
      toast.error("Não foi possível gerar os insights agora.");
    } finally {
      if (selectedIdRef.current === grupoId) setInsightsLoading(false);
    }
  }, [insightsLoading]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await carregar({ silent: true });
      const sel = selectedIdRef.current;
      if (sel) carregarMetricas(sel);
    } finally {
      setRefreshing(false);
    }
  }, [carregar, carregarMetricas]);

  const handleToggleCaptura = useCallback((grupo: GrupoItem) => {
    const proximo = !grupo.capturar;
    setGrupos((prev) =>
      prev.map((g) => (g.grupoId === grupo.grupoId ? { ...g, capturar: proximo } : g)),
    );
    setPendingId(grupo.grupoId);
    startTransition(() => {
      void definirCapturaGrupo(grupo.grupoId, proximo)
        .then((r) => {
          if (!r.success) {
            setGrupos((prev) =>
              prev.map((g) => (g.grupoId === grupo.grupoId ? { ...g, capturar: grupo.capturar } : g)),
            );
            toast.error(r.error);
          } else {
            toast.success(proximo ? "Captura ligada para este grupo." : "Captura desligada.");
          }
        })
        .finally(() => setPendingId(null));
    });
  }, []);

  const handleVincular = useCallback(
    (grupo: GrupoItem, atletaId: string | null) => {
      const anterior = grupo.atletaId;
      const nome = atletaId ? (atletas.find((a) => a.id === atletaId)?.nome ?? null) : null;
      setGrupos((prev) =>
        prev.map((g) => (g.grupoId === grupo.grupoId ? { ...g, atletaId, atletaNome: nome } : g)),
      );
      setPendingId(grupo.grupoId);
      startTransition(() => {
        void vincularGrupoFamilia(grupo.grupoId, atletaId)
          .then((r) => {
            if (!r.success) {
              setGrupos((prev) =>
                prev.map((g) =>
                  g.grupoId === grupo.grupoId ? { ...g, atletaId: anterior, atletaNome: grupo.atletaNome } : g,
                ),
              );
              toast.error(r.error);
            } else {
              toast.success(atletaId ? "Grupo vinculado à família." : "Vínculo removido.");
            }
          })
          .finally(() => setPendingId(null));
      });
    },
    [atletas],
  );

  const termo = search.trim().toLowerCase();
  const filtrados = useMemo(
    () =>
      termo.length === 0
        ? grupos
        : grupos.filter((g) => (g.nome ?? "").toLowerCase().includes(termo)),
    [grupos, termo],
  );

  const grupoSelecionado = useMemo(
    () => grupos.find((g) => g.grupoId === selectedId) ?? null,
    [grupos, selectedId],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        dense
        eyebrow="Comercial"
        title="Grupos de clientes"
        description={
          podeGerenciar
            ? "Grupos de WhatsApp com os clientes — ligue a captura, vincule à família e converse pelo painel. Fundação dos agents de WhatsApp."
            : "Grupos de WhatsApp das famílias que você acompanha — leia, responda e veja as métricas."
        }
        actions={
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      {podeGerenciar && (
        <div className="flex items-start gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <p>
            Todo grupo aparece aqui, mas o conteúdo das mensagens só é armazenado nos grupos com a
            captura ligada (opt-in). Sem histórico retroativo — a captura vale das próximas mensagens
            em diante.
          </p>
        </div>
      )}

      {status === "loading" ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]">
          <Skeleton className={cn("w-full rounded-xl", PANEL_HEIGHT)} />
          <Skeleton className={cn("w-full rounded-xl", PANEL_HEIGHT)} />
        </div>
      ) : status === "error" ? (
        <Card className={cn("flex items-center justify-center", PANEL_HEIGHT)}>
          <EmptyState
            icon={Info}
            title="Não foi possível carregar os grupos"
            description="Tente novamente em instantes."
            action={
              <Button variant="secondary" size="sm" onClick={() => void carregar()}>
                <RefreshCw />
                Tentar novamente
              </Button>
            }
          />
        </Card>
      ) : (
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)]",
            grupoSelecionado && "xl:grid-cols-[minmax(15rem,20rem)_minmax(0,1fr)_18rem]",
          )}
        >
          {/* Coluna esquerda: lista de grupos + controles */}
          <Card padding="none" className={cn("flex flex-col overflow-hidden", PANEL_HEIGHT)}>
            <div className="shrink-0 border-b border-border p-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar grupo por nome"
                aria-label="Buscar grupo"
              />
            </div>
            {filtrados.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-6">
                <EmptyState
                  icon={Users}
                  title={termo.length > 0 ? "Nenhum grupo encontrado" : "Nenhum grupo ainda"}
                  description={
                    termo.length > 0
                      ? "Ajuste a busca pelo nome do grupo."
                      : podeGerenciar
                        ? "Mande ou receba uma mensagem em um grupo do WhatsApp comercial para ele aparecer aqui."
                        : "Os grupos das suas famílias aparecem aqui quando vinculados pelo CEO."
                  }
                />
              </div>
            ) : (
              <ScrollList gutter={false} className="divide-y divide-border">
                {filtrados.map((grupo) => (
                  <GrupoListItem
                    key={grupo.grupoId}
                    grupo={grupo}
                    atletas={atletas}
                    selected={grupo.grupoId === selectedId}
                    pending={pendingId === grupo.grupoId}
                    podeGerenciar={podeGerenciar}
                    onSelect={handleSelect}
                    onToggleCaptura={handleToggleCaptura}
                    onVincular={handleVincular}
                  />
                ))}
              </ScrollList>
            )}
          </Card>

          {/* Coluna do meio: conversa do grupo */}
          <Card padding="none" className={cn("flex flex-col overflow-hidden", PANEL_HEIGHT)}>
            {grupoSelecionado ? (
              <GrupoConversaPanel
                key={grupoSelecionado.grupoId}
                grupo={grupoSelecionado}
                podeGerenciar={podeGerenciar}
              />
            ) : (
              <div className="flex flex-1 items-center justify-center px-6">
                <EmptyState
                  icon={MessageSquareText}
                  title="Selecione um grupo"
                  description="Escolha um grupo na lista ao lado para ver a conversa, responder e acompanhar as métricas."
                />
              </div>
            )}
          </Card>

          {/* Coluna direita: métricas do grupo (só com grupo selecionado) */}
          {grupoSelecionado && (
            <Card
              padding="none"
              className="flex flex-col overflow-hidden lg:col-span-2 xl:col-span-1 h-[26rem] xl:h-[calc(100vh-13rem)] xl:min-h-[26rem]"
            >
              <MetricasGrupoPanel
                grupo={grupoSelecionado}
                metricas={metricas}
                loading={metricasLoading}
                insights={insights}
                insightsLoading={insightsLoading}
                podeGerenciar={podeGerenciar}
                onGerarInsights={handleGerarInsights}
                onLimparInsights={() => setInsights(null)}
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
