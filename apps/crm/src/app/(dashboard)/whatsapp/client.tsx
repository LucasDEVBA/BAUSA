"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, RefreshCw, Search, Send, Settings2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, Input, PageHeader, ScrollList, Skeleton } from "@/components/ui";
import { cn, getInitials } from "@/lib/utils";
import {
  formatPhoneDisplay,
  type EspelhoChat,
  type EspelhoContact,
  type EspelhoMessage,
} from "@/lib/whatsapp-espelho";

// ─── Constantes ──────────────────────────────────────────────────

const CHATS_POLL_MS = 30_000;
const THREAD_POLL_MS = 15_000;
const MESSAGE_MAX_LENGTH = 4096;
/** 100vh − header (4rem) − padding do main (2rem) − PageHeader denso + gap (~3.75rem). */
const PANEL_HEIGHT = "h-[calc(100vh-9.75rem)] min-h-[26rem]";

type LoadStatus = "loading" | "ready" | "error" | "unconfigured";

interface ChatsResponse {
  chats?: EspelhoChat[];
}

interface MessagesResponse {
  messages?: EspelhoMessage[];
  /** true = instância Z-API multi-device não expõe histórico por API. */
  historyUnavailable?: boolean;
  /** true = histórico veio do espelho próprio (whatsapp_mensagens via webhook). */
  mirror?: boolean;
}

/** Janela p/ casar eco local com a mensagem real vinda do espelho (webhook). */
const ECHO_MATCH_WINDOW_MS = 120_000;
/** Eco sem confirmação some depois disso (evita fantasma eterno). */
const ECHO_TTL_MS = 10 * 60_000;

interface ContactResponse {
  contact?: EspelhoContact;
}

/** Contatos buscados em lotes p/ não estourar rate limit da Z-API. */
const CONTACTS_CHUNK_SIZE = 4;

interface SendResponse {
  success?: boolean;
  error?: string;
}

// ─── Helpers de formatação ───────────────────────────────────────

const TIME_FORMAT = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" });
const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" });

function formatChatTime(epochMs: number): string {
  const date = new Date(epochMs);
  const isToday = date.toDateString() === new Date().toDateString();
  return isToday ? TIME_FORMAT.format(date) : DATE_FORMAT.format(date);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

// ─── Sub-componentes ─────────────────────────────────────────────

/** Avatar com foto real do WhatsApp (fallback: iniciais no gradiente de marca). */
function ChatAvatar({ name, imgUrl }: { name: string | null; imgUrl: string | null }) {
  // Erro rastreado POR URL: trocar de contato (header sem key por chat) não
  // pode herdar o "failed" da foto expirada do contato anterior.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const failed = imgUrl !== null && failedUrl === imgUrl;
  if (imgUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- foto externa da Z-API (pps.whatsapp.net); domínio dinâmico fora do next/image
      <img
        src={imgUrl}
        alt=""
        aria-hidden
        referrerPolicy="no-referrer"
        onError={() => setFailedUrl(imgUrl)}
        className="size-9 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white"
    >
      {name ? getInitials(name) : <MessageCircle className="size-4" />}
    </span>
  );
}

interface ChatListItemProps {
  chat: EspelhoChat;
  contact: EspelhoContact | null;
  selected: boolean;
  onSelect: (phone: string) => void;
}

function ChatListItem({ chat, contact, selected, onSelect }: ChatListItemProps) {
  const displayName = chat.name ?? contact?.name ?? formatPhoneDisplay(chat.phone);

  return (
    <button
      type="button"
      onClick={() => onSelect(chat.phone)}
      aria-current={selected ? "true" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        selected ? "bg-primary/10" : "hover:bg-accent",
      )}
    >
      <ChatAvatar name={chat.name ?? contact?.name ?? null} imgUrl={contact?.imgUrl ?? null} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium text-foreground">{displayName}</span>
          {chat.lastMessageTime !== null && (
            <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
              {formatChatTime(chat.lastMessageTime)}
            </span>
          )}
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">
            {chat.lastMessagePreview ?? formatPhoneDisplay(chat.phone)}
          </span>
          {chat.unread > 0 && (
            <Badge tone="brand" size="sm">
              {chat.unread}
            </Badge>
          )}
        </span>
      </span>
    </button>
  );
}

function MessageBubble({ message }: { message: EspelhoMessage }) {
  return (
    <div className={cn("flex", message.fromMe ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-3 py-2",
          message.fromMe ? "rounded-br-md bg-primary/10" : "rounded-bl-md bg-secondary",
        )}
      >
        {message.text !== null ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{message.text}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground">[mídia]</p>
        )}
        {message.timestamp !== null && (
          <p className="mt-0.5 text-right text-[10px] tabular-nums text-muted-foreground">
            {TIME_FORMAT.format(new Date(message.timestamp))}
          </p>
        )}
      </div>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 p-3" aria-hidden>
      {Array.from({ length: 7 }, (_, index) => (
        <Skeleton key={index} className="h-12 w-full rounded-xl" />
      ))}
    </div>
  );
}

function ThreadSkeleton() {
  return (
    <div className="flex flex-1 flex-col justify-end gap-2 p-4" aria-hidden>
      <Skeleton className="h-10 w-3/5 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-2/5 rounded-2xl" />
      <Skeleton className="h-14 w-1/2 rounded-2xl" />
      <Skeleton className="ml-auto h-10 w-3/5 rounded-2xl" />
    </div>
  );
}

// ─── Tela ────────────────────────────────────────────────────────

export function WhatsAppEspelhoClient() {
  const [chats, setChats] = useState<EspelhoChat[]>([]);
  const [chatsStatus, setChatsStatus] = useState<LoadStatus>("loading");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<EspelhoMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<LoadStatus>("ready");
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [mirrorActive, setMirrorActive] = useState(false);
  const [contacts, setContacts] = useState<Record<string, EspelhoContact | null>>({});
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const chatsAbortRef = useRef<AbortController | null>(null);
  const messagesAbortRef = useRef<AbortController | null>(null);
  const contactsInflightRef = useRef<Set<string>>(new Set());
  const contactsCacheRef = useRef<Record<string, EspelhoContact | null>>({});
  /** Conversa aberta AGORA — guard contra eco/refetch na thread errada após await. */
  const selectedPhoneRef = useRef<string | null>(null);
  /** Ecos de envios da sessão, por conversa — sobrevivem à troca de chat (multi-device). */
  const sessionEchoesRef = useRef<Map<string, EspelhoMessage[]>>(new Map());
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  // ── Fetchers (proxy server-side — credenciais Z-API nunca chegam aqui) ──

  const fetchChats = useCallback(async (opts?: { silent?: boolean }) => {
    chatsAbortRef.current?.abort();
    const controller = new AbortController();
    chatsAbortRef.current = controller;
    if (!opts?.silent) setChatsStatus("loading");

    try {
      const res = await fetch("/api/whatsapp/chats", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 503) {
        setChatsStatus("unconfigured");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as ChatsResponse;
      setChats(data.chats ?? []);
      setChatsStatus("ready");
    } catch (error) {
      if (isAbortError(error)) return;
      // Polling silencioso mantém a lista anterior; falha explícita vira estado de erro.
      if (!opts?.silent) setChatsStatus("error");
    }
  }, []);

  const fetchMessages = useCallback(async (phone: string, opts?: { silent?: boolean }) => {
    messagesAbortRef.current?.abort();
    const controller = new AbortController();
    messagesAbortRef.current = controller;
    if (!opts?.silent) setMessagesStatus("loading");

    try {
      const res = await fetch(`/api/whatsapp/messages?phone=${encodeURIComponent(phone)}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      if (res.status === 503) {
        setMessagesStatus("unconfigured");
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as MessagesResponse;
      if (data.historyUnavailable) {
        // Multi-device sem espelho: NÃO sobrescreve as mensagens locais
        // (ecos de envios desta sessão continuam visíveis).
        setHistoryUnavailable(true);
        setMirrorActive(false);
        setMessagesStatus("ready");
        return;
      }
      const server = data.messages ?? [];
      // Mescla ecos locais ainda não confirmados pelo espelho (o webhook leva
      // ~1-2s p/ gravar o envio) — sem isso o eco pisca/some até o próximo poll.
      const echoes = (sessionEchoesRef.current.get(phone) ?? []).filter((echo) => {
        const confirmed = server.some(
          (msg) =>
            msg.fromMe &&
            msg.text === echo.text &&
            Math.abs((msg.timestamp ?? 0) - (echo.timestamp ?? 0)) < ECHO_MATCH_WINDOW_MS,
        );
        const expired = Date.now() - (echo.timestamp ?? 0) > ECHO_TTL_MS;
        return !confirmed && !expired;
      });
      sessionEchoesRef.current.set(phone, echoes);
      setHistoryUnavailable(false);
      setMirrorActive(data.mirror === true);
      setMessages([...server, ...echoes]);
      setMessagesStatus("ready");
    } catch (error) {
      if (isAbortError(error)) return;
      if (!opts?.silent) setMessagesStatus("error");
    }
  }, []);

  // ── Metadados de contato (foto/nome/about) — lotes com cache em memória ──
  // Cache em ref (fonte da verdade de "já buscado") + estado só p/ render:
  // o efeito depende apenas de `chats`, sem churn de cancel/refetch.

  useEffect(() => {
    const cache = contactsCacheRef.current;
    const inflight = contactsInflightRef.current;
    const pending = chats
      .map((chat) => chat.phone)
      .filter((phone) => !(phone in cache) && !inflight.has(phone));
    if (pending.length === 0) {
      // Sincroniza resultados que chegaram após um cancelamento (bail-out se igual —
      // evita re-render a cada poll de chats).
      setContacts((prev) =>
        Object.keys(prev).length === Object.keys(cache).length ? prev : { ...cache },
      );
      return;
    }

    let cancelled = false;

    void (async () => {
      for (let i = 0; i < pending.length; i += CONTACTS_CHUNK_SIZE) {
        if (cancelled) break;
        const batch = pending.slice(i, i + CONTACTS_CHUNK_SIZE);
        // Marca inflight SÓ o batch que vai de fato buscar — cancelamento no meio
        // (poll de 30s / StrictMode) não deixa phones presos p/ sempre (starvation).
        batch.forEach((phone) => inflight.add(phone));
        const results = await Promise.all(
          batch.map(async (phone): Promise<[string, EspelhoContact | null]> => {
            try {
              const res = await fetch(
                `/api/whatsapp/contact?phone=${encodeURIComponent(phone)}`,
                { cache: "no-store" },
              );
              if (!res.ok) return [phone, null];
              const data = (await res.json()) as ContactResponse;
              return [phone, data.contact ?? null];
            } catch {
              return [phone, null];
            }
          }),
        );
        for (const [phone, contact] of results) {
          cache[phone] = contact;
          inflight.delete(phone);
        }
        if (!cancelled) setContacts({ ...cache });
      }
    })();

    return () => {
      cancelled = true;
      // Batch em voo ainda grava no cache e sai do inflight ao concluir; o branch
      // de sincronização acima entrega esses resultados na próxima execução.
    };
  }, [chats]);

  // ── Carga inicial + polling da lista (30s, pausa com aba oculta) ──

  useEffect(() => {
    void fetchChats();
    const interval = setInterval(() => {
      if (document.hidden) return;
      void fetchChats({ silent: true });
    }, CHATS_POLL_MS);
    return () => {
      clearInterval(interval);
      chatsAbortRef.current?.abort();
    };
  }, [fetchChats]);

  // ── Carga da thread ao selecionar + polling (15s, pausa com aba oculta) ──

  useEffect(() => {
    if (!selectedPhone) return;
    // Semeia com os ecos da sessão desta conversa (no multi-device o servidor
    // não devolve histórico — sem isso, trocar de chat apagaria os envios).
    setMessages(sessionEchoesRef.current.get(selectedPhone) ?? []);
    setHistoryUnavailable(false);
    void fetchMessages(selectedPhone);

    const interval = setInterval(() => {
      if (document.hidden) return;
      void fetchMessages(selectedPhone, { silent: true });
    }, THREAD_POLL_MS);
    return () => {
      clearInterval(interval);
      messagesAbortRef.current?.abort();
    };
  }, [selectedPhone, fetchMessages]);

  // ── Auto-scroll para o fim da thread quando as mensagens mudam ──

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  // ── Ações ──

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    // Ação explícita do usuário: re-tenta contatos que falharam (cache null) —
    // o refetch de chats re-dispara o loader sem tempestade no polling.
    const cache = contactsCacheRef.current;
    for (const key of Object.keys(cache)) {
      if (cache[key] === null) delete cache[key];
    }
    try {
      await Promise.all([
        fetchChats({ silent: true }),
        selectedPhone ? fetchMessages(selectedPhone, { silent: true }) : Promise.resolve(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchChats, fetchMessages, selectedPhone]);

  const handleSend = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const message = draft.trim();
      if (!selectedPhone || message.length === 0 || sending) return;
      // Captura a conversa-alvo ANTES do await — o usuário pode trocar de chat
      // com o envio em voo (a lista continua clicável).
      const phone = selectedPhone;

      setSending(true);
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message }),
        });
        const data = (await res.json().catch(() => null)) as SendResponse | null;

        if (!res.ok) {
          toast.error(
            data?.error === "zapi_nao_configurado"
              ? "Z-API não configurada no ambiente do Engine."
              : "Falha ao enviar a mensagem. Tente novamente.",
          );
          return;
        }

        setDraft("");
        const echo: EspelhoMessage = {
          id: `local-${Date.now()}`,
          phone,
          fromMe: true,
          text: message,
          timestamp: Date.now(),
        };
        // Persiste o eco por conversa (sessão) — reaparece ao voltar ao chat.
        sessionEchoesRef.current.set(phone, [
          ...(sessionEchoesRef.current.get(phone) ?? []),
          echo,
        ]);
        // Se o usuário já está noutra conversa, não contamina a thread aberta
        // nem aborta o fetch dela — o eco fica guardado para quando voltar.
        if (selectedPhoneRef.current !== phone) return;
        setMessages((prev) => [...prev, echo]);
        void fetchMessages(phone, { silent: true });
      } catch {
        toast.error("Falha ao enviar a mensagem. Verifique a conexão.");
      } finally {
        setSending(false);
      }
    },
    [draft, selectedPhone, sending, fetchMessages],
  );

  // ── Derivados ──

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (query.length === 0) return chats;
    const queryDigits = query.replace(/\D/g, "");
    return chats.filter(
      (chat) =>
        (chat.name?.toLowerCase().includes(query) ?? false) ||
        (queryDigits.length > 0 && chat.phone.includes(queryDigits)),
    );
  }, [chats, search]);

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.phone === selectedPhone) ?? null,
    [chats, selectedPhone],
  );

  const selectedContact = selectedPhone ? (contacts[selectedPhone] ?? null) : null;

  const selectedDisplayName =
    selectedChat?.name ??
    selectedContact?.name ??
    (selectedPhone ? formatPhoneDisplay(selectedPhone) : "");

  // ── Render ──

  return (
    <div className="space-y-5">
      <PageHeader
        dense
        eyebrow="Comercial"
        title="WhatsApp"
        description="Espelho das conversas do número comercial via Z-API — leitura e resposta rápida sem sair do Engine."
        actions={
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn(refreshing && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      {chatsStatus === "unconfigured" ? (
        <Card className={cn("flex flex-col items-center justify-center", PANEL_HEIGHT)}>
          <EmptyState
            icon={Settings2}
            title="Z-API não configurada"
            description="Configure ZAPI_INSTANCE_ID, ZAPI_TOKEN e ZAPI_CLIENT_TOKEN nas variáveis de ambiente do Engine para ativar o espelho do WhatsApp."
            action={
              <Button variant="secondary" size="sm" onClick={() => void fetchChats()}>
                <RefreshCw />
                Verificar novamente
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(17rem,21rem)_minmax(0,1fr)]">
          {/* Lista de conversas */}
          <Card padding="none" className={cn("flex flex-col overflow-hidden", PANEL_HEIGHT)}>
            <div className="shrink-0 border-b border-border p-3">
              <div className="relative">
                <Search
                  aria-hidden
                  className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nome ou telefone"
                  aria-label="Buscar conversa"
                  className="pl-8"
                />
              </div>
            </div>

            {chatsStatus === "loading" ? (
              <ListSkeleton />
            ) : chatsStatus === "error" ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={TriangleAlert}
                  title="Não foi possível carregar as conversas"
                  description="A Z-API não respondeu. Tente novamente em instantes."
                  action={
                    <Button variant="secondary" size="sm" onClick={() => void fetchChats()}>
                      <RefreshCw />
                      Tentar novamente
                    </Button>
                  }
                />
              </div>
            ) : filteredChats.length === 0 ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={MessageCircle}
                  title="Nenhuma conversa encontrada"
                  description={
                    search.trim().length > 0
                      ? "Ajuste a busca por nome ou telefone."
                      : "As conversas do número comercial aparecem aqui."
                  }
                />
              </div>
            ) : (
              <ScrollList gutter={false} className="divide-y divide-border">
                {filteredChats.map((chat) => (
                  <ChatListItem
                    key={chat.phone}
                    chat={chat}
                    contact={contacts[chat.phone] ?? null}
                    selected={chat.phone === selectedPhone}
                    onSelect={setSelectedPhone}
                  />
                ))}
              </ScrollList>
            )}
          </Card>

          {/* Thread da conversa */}
          <Card padding="none" className={cn("flex flex-col overflow-hidden", PANEL_HEIGHT)}>
            {!selectedPhone ? (
              <div className="flex flex-1 items-center justify-center">
                <EmptyState
                  icon={MessageCircle}
                  title="Selecione uma conversa"
                  description="Escolha uma conversa na lista ao lado para ver o histórico e responder."
                />
              </div>
            ) : (
              <>
                <div className="flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-3">
                  <ChatAvatar
                    name={selectedChat?.name ?? selectedContact?.name ?? null}
                    imgUrl={selectedContact?.imgUrl ?? null}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{selectedDisplayName}</p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {formatPhoneDisplay(selectedPhone)}
                      {selectedContact?.about ? (
                        <span className="ml-2 font-normal not-italic text-label-tertiary">
                          · {selectedContact.about}
                        </span>
                      ) : null}
                    </p>
                  </div>
                </div>

                {messagesStatus === "loading" ? (
                  <ThreadSkeleton />
                ) : messagesStatus === "error" || messagesStatus === "unconfigured" ? (
                  <div className="flex flex-1 items-center justify-center">
                    <EmptyState
                      icon={TriangleAlert}
                      title="Não foi possível carregar o histórico"
                      description="A Z-API não respondeu. Tente novamente em instantes."
                      action={
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => void fetchMessages(selectedPhone)}
                        >
                          <RefreshCw />
                          Tentar novamente
                        </Button>
                      }
                    />
                  </div>
                ) : messages.length === 0 && historyUnavailable ? (
                  <div className="flex flex-1 items-center justify-center px-6">
                    <EmptyState
                      icon={TriangleAlert}
                      title="Histórico indisponível nesta instância Z-API"
                      description="Instâncias multi-device da Z-API não fornecem o histórico de conversas por API. As mensagens que você enviar por aqui aparecem durante a sessão — para o espelho completo, é preciso ativar o armazenamento via webhook (ver docs/ATIVACAO.md)."
                    />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center px-6">
                    <EmptyState
                      icon={MessageCircle}
                      title="Sem mensagens nesta conversa"
                      description={
                        mirrorActive
                          ? "O espelho registra as mensagens a partir da ativação do webhook — esta conversa ainda não tem registros. Envie ou receba uma mensagem e ela aparece aqui."
                          : "Envie a primeira mensagem pelo campo abaixo."
                      }
                    />
                  </div>
                ) : (
                  <>
                    {historyUnavailable && (
                      <p className="shrink-0 border-b border-border bg-secondary px-4 py-1.5 text-center text-[11px] text-muted-foreground">
                        Histórico completo indisponível (Z-API multi-device) — mostrando as mensagens desta sessão.
                      </p>
                    )}
                    <ScrollList ref={threadRef} className="space-y-2 p-4" aria-label="Histórico da conversa">
                      {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                    </ScrollList>
                  </>
                )}

                <form
                  onSubmit={handleSend}
                  className="flex shrink-0 items-center gap-2 border-t border-border p-3"
                >
                  <Input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    placeholder="Escreva uma mensagem"
                    aria-label="Mensagem"
                    maxLength={MESSAGE_MAX_LENGTH}
                    disabled={sending}
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={sending || draft.trim().length === 0}
                    aria-label="Enviar mensagem"
                  >
                    <Send />
                  </Button>
                </form>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
