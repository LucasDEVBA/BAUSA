"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/**
 * Conversa de WhatsApp 1:1 do lead — embutida no detalhe do lead/deal (CEO).
 *
 * Reusa os endpoints REST já existentes (GET /api/whatsapp/messages,
 * POST /api/whatsapp/send) — ambos protegidos por `guardWhatsAppApi` (só CEO,
 * 403 caso contrário). O histórico vem do espelho `whatsapp_mensagens`
 * (alimentado pelo webhook da Z-API); o compositor faz eco otimista e reconcilia
 * com o espelho no refetch. Altura contida (`h-[26rem]`, scroll interno) — o
 * sheet/modal hospedeiro tem o próprio scroll.
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

// ─── Renderização de mensagem (bolhas / hora / from_me / mídia) ──────────────
// Espelha o visual da tela /whatsapp (client.tsx) para consistência, mas em
// componente próprio — o módulo /whatsapp não é modificado.

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

function MessageBubble({ message }: { message: EspelhoMessage }) {
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
        {isMedia && <MessageMedia message={message} />}
        {message.text !== null && (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {message.text}
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
}

export function ConversaLeadPanel({ telefone }: ConversaLeadPanelProps) {
  const digits = telefone ? cleanPhone(telefone) : "";
  const valido = isValidPhone(digits);

  const [serverMessages, setServerMessages] = useState<EspelhoMessage[]>([]);
  const [echoes, setEchoes] = useState<EspelhoMessage[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const threadRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!valido) return;
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      if (!opts?.silent) setStatus("loading");

      try {
        const res = await fetch(
          `/api/whatsapp/messages?phone=${encodeURIComponent(digits)}`,
          { signal: controller.signal, cache: "no-store" },
        );
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
    [digits, valido],
  );

  useEffect(() => {
    if (!valido) return;
    void load();
    return () => abortRef.current?.abort();
  }, [valido, load]);

  // ── Só os ecos DESTA conversa (ao trocar de lead, ecos antigos somem) ──
  const localEchoes = echoes.filter((echo) => echo.phone === digits);
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
      if (!valido || message.length === 0 || sending) return;

      setSending(true);
      const echo: EspelhoMessage = {
        id: `local-${Date.now()}`,
        phone: digits,
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

      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: digits, message }),
        });
        const data = (await res.json().catch(() => null)) as SendResponse | null;

        if (!res.ok || !data?.success) {
          setEchoes((prev) => prev.filter((x) => x.id !== echo.id));
          setDraft(message);
          toast.error(
            data?.error === "zapi_nao_configurado"
              ? "WhatsApp não configurado."
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
    [draft, valido, sending, digits, load],
  );

  // ── Sem telefone: aviso em vez do painel ──
  if (!valido) {
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

  return (
    <div className="flex h-[26rem] flex-col overflow-hidden rounded-lg border border-border/70 bg-card/60">
      {/* Cabeçalho */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <MessageCircle className="size-3.5 shrink-0 text-sys-green" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Conversa
          </span>
          <span className="truncate text-[11px] tabular-nums text-muted-foreground">
            {formatPhoneDisplay(digits)}
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
              {historyUnavailable
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
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
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
          placeholder="Escrever mensagem…"
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
