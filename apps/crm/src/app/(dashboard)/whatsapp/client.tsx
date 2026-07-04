"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MessageCircle, RefreshCw, Search, Send, Settings2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Badge, Button, Card, EmptyState, Input, PageHeader, ScrollList, Skeleton } from "@/components/ui";
import { cn, getInitials } from "@/lib/utils";
import {
  formatPhoneDisplay,
  type EspelhoChat,
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
}

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

interface ChatListItemProps {
  chat: EspelhoChat;
  selected: boolean;
  onSelect: (phone: string) => void;
}

function ChatListItem({ chat, selected, onSelect }: ChatListItemProps) {
  const displayName = chat.name ?? formatPhoneDisplay(chat.phone);

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
      <span
        aria-hidden
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white"
      >
        {chat.name ? getInitials(chat.name) : <MessageCircle className="size-4" />}
      </span>
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
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const chatsAbortRef = useRef<AbortController | null>(null);
  const messagesAbortRef = useRef<AbortController | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

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
      setMessages(data.messages ?? []);
      setMessagesStatus("ready");
    } catch (error) {
      if (isAbortError(error)) return;
      if (!opts?.silent) setMessagesStatus("error");
    }
  }, []);

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
    setMessages([]);
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

      setSending(true);
      try {
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: selectedPhone, message }),
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
        // Eco otimista + refetch para confirmar com o histórico real da Z-API.
        setMessages((prev) => [
          ...prev,
          {
            id: `local-${Date.now()}`,
            phone: selectedPhone,
            fromMe: true,
            text: message,
            timestamp: Date.now(),
          },
        ]);
        void fetchMessages(selectedPhone, { silent: true });
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

  const selectedDisplayName = selectedChat?.name ?? (selectedPhone ? formatPhoneDisplay(selectedPhone) : "");

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
                  <span
                    aria-hidden
                    className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white"
                  >
                    {selectedChat?.name ? getInitials(selectedChat.name) : <MessageCircle className="size-4" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{selectedDisplayName}</p>
                    <p className="truncate text-xs tabular-nums text-muted-foreground">
                      {formatPhoneDisplay(selectedPhone)}
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
                ) : messages.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center">
                    <EmptyState
                      icon={MessageCircle}
                      title="Sem mensagens nesta conversa"
                      description="Envie a primeira mensagem pelo campo abaixo."
                    />
                  </div>
                ) : (
                  <ScrollList ref={threadRef} className="space-y-2 p-4" aria-label="Histórico da conversa">
                    {messages.map((message) => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                  </ScrollList>
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
