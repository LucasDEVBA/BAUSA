"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  RefreshCw,
  Send,
  Settings2,
  User as UserIcon,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  cleanPhone,
  formatPhoneDisplay,
  isValidPhone,
  type EspelhoMessage,
} from "@/lib/whatsapp-espelho";
import { listarThreadsLead, type ConversaThread } from "@/lib/actions/conversa-threads";
import { TextoLinkado } from "./TextoLinkado";

/**
 * Conversa de WhatsApp do lead — embutida no detalhe do lead/deal (CEO).
 *
 * Multi-thread (2026-08-10): além do 1:1 principal, o CEO alterna entre o
 * privado do RESPONSÁVEL, o privado do ATLETA e o(s) GRUPO(s) da família —
 * leitura e envio em qualquer uma delas. Threads resolvidas server-side por
 * listarThreadsLead; grupos leem/enviam via ?groupId= (espelho do coletor).
 *
 * Reusa os endpoints REST (GET /api/whatsapp/messages, POST /api/whatsapp/send),
 * ambos sob `guardWhatsAppApi`/`guardWhatsAppGrupoEnvio`. Eco otimista com
 * reconciliação no refetch. Altura contida (h-[26rem], scroll interno).
 */

const MESSAGE_MAX_LENGTH = 4096;
/** Eco local sem confirmação do espelho some depois disso (evita fantasma eterno). */
const ECHO_TTL_MS = 10 * 60_000;

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

/** Rótulo textual por tipo (fallback quando não há URL de mídia). */
const MIDIA_LABEL: Record<string, string> = {
  image: "Foto",
  audio: "Áudio",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  location: "Localização",
  contact: "Contato",
  reaction: "Reação",
  other: "Mídia",
};

type LoadStatus = "loading" | "ready" | "error" | "unconfigured";

interface MessagesResponse {
  messages?: EspelhoMessage[];
  /** true = instância Z-API multi-device não expõe histórico por API. */
  historyUnavailable?: boolean;
  /** true = histórico veio do espelho próprio (whatsapp_mensagens via webhook). */
  mirror?: boolean;
  error?: string;
}

interface SendResponse {
  success?: boolean;
  error?: string;
  messageId?: string | null;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Chave estável da thread (dedupe de eco + params de fetch). */
function threadKey(t: ConversaThread): string {
  return t.tipo === "grupo" ? `g:${t.grupoId}` : `p:${t.phone}`;
}

// ─── Renderização de mensagem (bolhas / hora / from_me / mídia) ──────────────

/** Renderiza o conteúdo de mídia (foto/áudio/vídeo/documento); fallback textual. */
function MessageMedia({ message }: { message: EspelhoMessage }) {
  const { tipo, fileName } = message;
  // URLs da Z-API podem expirar/ser bloqueadas (CSP, adblock). Sem onError o
  // browser mostra ícone quebrado — pior que o rótulo textual.
  const [failed, setFailed] = useState(false);
  // Só aceita http(s): impede que um media_url malicioso (ex.: `javascript:`)
  // vindo do webhook Z-API vire XSS ao clicar/renderizar. Origem semiconfiável.
  const mediaUrl =
    message.mediaUrl && /^https?:\/\//i.test(message.mediaUrl)
      ? message.mediaUrl
      : null;

  const rotuloTextual = () => {
    if (tipo === "location") {
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-4 shrink-0" /> Localização
        </span>
      );
    }
    if (tipo === "contact") {
      return (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <UserIcon className="size-4 shrink-0" /> Contato
        </span>
      );
    }
    return (
      <p className="text-sm italic text-muted-foreground">
        [{MIDIA_LABEL[tipo] ?? "mídia"}]
        {tipo !== "reaction" && (
          <span className="ml-1 not-italic text-[10px] text-label-tertiary">
            (mídia expirada ou indisponível)
          </span>
        )}
      </p>
    );
  };

  if (!mediaUrl) return rotuloTextual();

  if (tipo === "image" || tipo === "sticker") {
    if (failed) return rotuloTextual();
    return (
      <a href={mediaUrl} target="_blank" rel="noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- mídia externa da Z-API; domínio dinâmico fora do next/image */}
        <img
          src={mediaUrl}
          alt={MIDIA_LABEL[tipo] ?? "Imagem"}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn(
            "rounded-lg object-cover",
            tipo === "sticker" ? "max-h-28 w-28" : "max-h-56 max-w-full",
          )}
        />
      </a>
    );
  }

  if (tipo === "audio") {
    if (failed) return rotuloTextual();
    return (
      <audio
        controls
        preload="none"
        src={mediaUrl}
        onError={() => setFailed(true)}
        className="w-52 max-w-full"
      />
    );
  }

  if (tipo === "video") {
    if (failed) return rotuloTextual();
    return (
      <video
        controls
        preload="metadata"
        src={mediaUrl}
        onError={() => setFailed(true)}
        className="max-h-56 max-w-full rounded-lg"
      />
    );
  }

  if (tipo === "document") {
    return (
      <a
        href={mediaUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2 transition-colors hover:bg-accent"
      >
        <FileText className="size-5 shrink-0 text-primary" />
        <span className="min-w-0 truncate text-sm font-medium text-foreground">
          {fileName ?? "Documento"}
        </span>
      </a>
    );
  }

  return (
    <a
      href={mediaUrl}
      target="_blank"
      rel="noreferrer"
      className="text-sm text-primary underline"
    >
      Abrir {MIDIA_LABEL[tipo] ?? "mídia"}
    </a>
  );
}

function MessageBubble({ message, mostrarRemetente }: { message: EspelhoMessage; mostrarRemetente?: boolean }) {
  const isMedia = message.tipo !== "text";
  return (
    <div className={cn("flex", message.fromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] space-y-1 rounded-2xl px-3 py-2",
          message.fromMe
            ? "rounded-br-md bg-primary/10"
            : "rounded-bl-md bg-secondary",
        )}
      >
        {mostrarRemetente && !message.fromMe && message.senderName && (
          <p className="text-[10px] font-semibold text-primary">{message.senderName}</p>
        )}
        {isMedia && <MessageMedia message={message} />}
        {message.text !== null && (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            <TextoLinkado texto={message.text} />
          </p>
        )}
        {!isMedia && message.text === null && (
          <p className="text-sm italic text-muted-foreground">[mídia]</p>
        )}
        {message.timestamp !== null && (
          <p className="text-right text-[10px] tabular-nums text-muted-foreground">
            {TIME_FORMAT.format(new Date(message.timestamp))}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Painel ──────────────────────────────────────────────────────────────────

interface ConversaLeadPanelProps {
  /** Telefone do lead (guardian_whatsapp || athlete_whatsapp || deal.whatsapp). */
  telefone?: string | null;
  /** Habilita as threads extras (responsável/atleta/grupos) quando informados. */
  atletaId?: string | null;
  formSubmissionId?: string | null;
}

export function ConversaLeadPanel({ telefone, atletaId, formSubmissionId }: ConversaLeadPanelProps) {
  const digits = telefone ? cleanPhone(telefone) : "";

  // Thread default: o telefone recebido via prop (comportamento histórico).
  const threadDefault = useMemo<ConversaThread | null>(
    () => (isValidPhone(digits) ? { tipo: "privado", label: "Contato", phone: digits } : null),
    [digits],
  );

  const [threads, setThreads] = useState<ConversaThread[]>(threadDefault ? [threadDefault] : []);
  const [threadAtiva, setThreadAtiva] = useState<ConversaThread | null>(threadDefault);

  const [serverMessages, setServerMessages] = useState<EspelhoMessage[]>([]);
  const [echoes, setEchoes] = useState<EspelhoMessage[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // ── Resolve as threads do lead (responsável/atleta/grupos) ──
  useEffect(() => {
    if (!atletaId && !formSubmissionId) return;
    let ativo = true;
    void (async () => {
      try {
        const r = await listarThreadsLead({ atletaId, formSubmissionId });
        if (!ativo || !r.success || r.threads.length === 0) return;
        setThreads(r.threads);
        // Mantém a thread do telefone da prop como ativa quando existir na lista
        setThreadAtiva((atual) => {
          const alvo = atual?.phone
            ? r.threads.find((t) => t.phone === atual.phone)
            : undefined;
          return alvo ?? r.threads[0];
        });
      } catch {
        // Threads extras são progressive enhancement — o default já funciona.
      }
    })();
    return () => {
      ativo = false;
    };
  }, [atletaId, formSubmissionId]);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!threadAtiva) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!opts?.silent) setStatus("loading");

      const params =
        threadAtiva.tipo === "grupo"
          ? `groupId=${encodeURIComponent(threadAtiva.grupoId ?? "")}`
          : `phone=${encodeURIComponent(threadAtiva.phone ?? "")}`;

      try {
        const res = await fetch(`/api/whatsapp/messages?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (res.status === 503) {
          setStatus("unconfigured");
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as MessagesResponse;
        const server = data.messages ?? [];
        setHistoryUnavailable(data.historyUnavailable === true);
        setServerMessages(server);
        // Descarta ecos já confirmados pelo espelho (mesmo id) ou expirados.
        setEchoes((prev) =>
          prev.filter(
            (echo) =>
              !server.some((msg) => msg.id === echo.id) &&
              Date.now() - (echo.timestamp ?? 0) < ECHO_TTL_MS,
          ),
        );
        setStatus("ready");
      } catch (error) {
        if (isAbortError(error)) return;
        if (!opts?.silent) setStatus("error");
      }
    },
    [threadAtiva],
  );

  useEffect(() => {
    if (!threadAtiva) return;
    setServerMessages([]);
    void load();
    return () => abortRef.current?.abort();
  }, [threadAtiva, load]);

  // ── Só os ecos DESTA thread (ao trocar, ecos das outras somem da vista) ──
  const chaveAtiva = threadAtiva ? threadKey(threadAtiva) : "";
  const localEchoes = echoes.filter((echo) => echo.phone === chaveAtiva);
  const messages = [...serverMessages, ...localEchoes];

  // ── Auto-scroll para o fim quando a lista muda ──
  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages.length]);

  const handleSend = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const message = draft.trim();
      if (!threadAtiva || message.length === 0 || sending) return;

      setSending(true);
      const echo: EspelhoMessage = {
        id: `local-${Date.now()}`,
        phone: chaveAtiva,
        fromMe: true,
        text: message,
        timestamp: Date.now(),
        tipo: "text",
        mediaUrl: null,
        mimeType: null,
        fileName: null,
      };
      setEchoes((prev) => [...prev, echo]);
      setDraft("");

      const payload =
        threadAtiva.tipo === "grupo"
          ? { groupId: threadAtiva.grupoId, message }
          : { phone: threadAtiva.phone, message };

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await res.json().catch(() => null)) as SendResponse | null;

        if (!res.ok || !data?.success) {
          setEchoes((prev) => prev.filter((x) => x.id !== echo.id));
          setDraft(message);
          toast.error(
            data?.error === "zapi_nao_configurado"
              ? "WhatsApp não configurado."
              : data?.error === "grupo_nao_autorizado"
                ? "Sem permissão para enviar neste grupo."
                : "Não foi possível enviar a mensagem.",
          );
          return;
        }

        // Reconcilia o id do eco com o messageId real (dedupe no próximo refetch).
        if (data.messageId) {
          const realId = data.messageId;
          setEchoes((prev) =>
            prev.map((x) => (x.id === echo.id ? { ...x, id: realId } : x)),
          );
        }
        // Puxa a verdade do espelho em segundo plano (webhook leva ~1-2s).
        void load({ silent: true });
      } catch {
        setEchoes((prev) => prev.filter((x) => x.id !== echo.id));
        setDraft(message);
        toast.error("Não foi possível enviar a mensagem agora.");
      } finally {
        setSending(false);
      }
    },
    [draft, threadAtiva, sending, chaveAtiva, load],
  );

  // ── Sem nenhuma thread: aviso em vez do painel ──
  if (!threadAtiva) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-4 py-8 text-center">
        <MessageCircle className="size-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">Sem telefone</p>
        <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
          Este lead não tem WhatsApp válido registrado, então não há conversa
          para exibir.
        </p>
      </div>
    );
  }

  const vazio = messages.length === 0;
  const grupoSemCaptura = threadAtiva.tipo === "grupo" && threadAtiva.capturaDesligada === true;

  return (
    <div className="flex h-[26rem] flex-col overflow-hidden rounded-lg border border-border/70 bg-card/60">
      {/* Cabeçalho */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          {threadAtiva.tipo === "grupo" ? (
            <Users className="size-3.5 shrink-0 text-sys-green" />
          ) : (
            <MessageCircle className="size-3.5 shrink-0 text-sys-green" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {threadAtiva.tipo === "grupo" ? "Grupo" : "Conversa"}
          </span>
          <span className="truncate text-[11px] tabular-nums text-muted-foreground">
            {threadAtiva.tipo === "grupo"
              ? threadAtiva.label
              : (threadAtiva.detalhe ?? formatPhoneDisplay(threadAtiva.phone ?? ""))}
          </span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={status === "loading"}
          aria-label="Atualizar conversa"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", status === "loading" && "animate-spin")} />
        </button>
      </div>

      {/* Seletor de thread (responsável / atleta / grupos) */}
      {threads.length > 1 && (
        <div className="flex shrink-0 flex-wrap gap-1 border-b border-border/60 px-2 py-1.5">
          {threads.map((t) => {
            const ativa = threadKey(t) === chaveAtiva;
            return (
              <button
                key={threadKey(t)}
                type="button"
                onClick={() => setThreadAtiva(t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
                  ativa
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                {t.tipo === "grupo" && <Users className="size-3" />}
                {t.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Lista de mensagens */}
      <div
        ref={threadRef}
        className="crm-scroll flex-1 space-y-2 overflow-y-auto px-3 py-3"
      >
        {status === "unconfigured" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <Settings2 className="size-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">
              WhatsApp não configurado
            </p>
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              As credenciais da Z-API não estão configuradas neste ambiente.
            </p>
          </div>
        ) : status === "loading" && vazio ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : status === "error" && vazio ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle className="size-6 text-sys-orange" />
            <p className="text-sm font-medium text-foreground">
              Erro ao carregar a conversa
            </p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              <RefreshCw className="size-3.5" />
              Tentar novamente
            </Button>
          </div>
        ) : vazio ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <MessageCircle className="size-6 text-muted-foreground/50" />
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              {grupoSemCaptura
                ? "A captura deste grupo está desligada — ligue em WhatsApp → Grupos para espelhar as mensagens aqui."
                : historyUnavailable
                  ? "O histórico ainda não está disponível — as mensagens aparecem a partir da captura pelo webhook."
                  : "Sem conversa registrada ainda — as mensagens aparecem a partir da captura pelo webhook."}
            </p>
          </div>
        ) : (
          <>
            {historyUnavailable && (
              <p className="rounded-md bg-sys-orange/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-sys-orange">
                Histórico completo indisponível nesta instância — exibindo apenas
                mensagens capturadas pelo webhook.
              </p>
            )}
            {grupoSemCaptura && (
              <p className="rounded-md bg-sys-orange/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-sys-orange">
                Captura desligada para este grupo — mensagens novas não estão
                sendo espelhadas.
              </p>
            )}
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                mostrarRemetente={threadAtiva.tipo === "grupo"}
              />
            ))}
          </>
        )}
      </div>

      {/* Compositor */}
      <form
        onSubmit={handleSend}
        className="flex shrink-0 items-end gap-2 border-t border-border/60 p-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={MESSAGE_MAX_LENGTH}
          disabled={status === "unconfigured" || sending}
          placeholder={
            threadAtiva.tipo === "grupo"
              ? `Mensagem para o grupo ${threadAtiva.label}…`
              : "Escrever mensagem…"
          }
          aria-label="Mensagem"
          className="max-h-24 min-h-[2.25rem] flex-1 resize-none rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-placeholder outline-none focus:border-primary/40 disabled:opacity-50"
        />
        <Button
          type="submit"
          size="sm"
          disabled={!draft.trim() || sending || status === "unconfigured"}
          aria-label="Enviar mensagem"
        >
          {sending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </div>
  );
}
