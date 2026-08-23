"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  Archive,
  ArchiveRestore,
  FileText,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  Pin,
  PinOff,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  TriangleAlert,
  User as UserIcon,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { uploadMensagemArquivo, uploadMensagemAudio } from "@/lib/actions/mensagem-media";
import { sugerirRespostaChatbot } from "@/lib/actions/chatbot-sugestao";
import { AnaliseAgentBlock } from "@/components/agents/AnaliseAgentBlock";
import { ConversaAutonomoToggle } from "@/components/whatsapp/ConversaAutonomoToggle";
import { TextoLinkado } from "@/components/whatsapp/TextoLinkado";
import type { AgentResumo } from "@/types/agent";
import {
  gerarInsightsConversa,
  type InsightsConversa,
} from "@/lib/actions/whatsapp-insights";
import {
  fetchMetricasConversa,
  type MetricasConversa,
} from "@/lib/actions/whatsapp-conversa-metricas";

import { Button, Card, EmptyState, Input, PageHeader, ScrollList, Skeleton } from "@/components/ui";
import { cn, getInitials } from "@/lib/utils";
import {
  formatPhoneDisplay,
  type EspelhoChat,
  type EspelhoContact,
  type EspelhoMessage,
} from "@/lib/whatsapp-espelho";

// ─── Constantes ──────────────────────────────────────────────────

const CHATS_POLL_MS = 15_000;
const THREAD_POLL_MS = 8_000;
/** localStorage: última vez que o CEO abriu cada conversa (badge de não-lida). */
const LAST_SEEN_KEY = "bausa_whatsapp_last_seen";
/** localStorage: conversas fixadas e arquivadas (local, só nesta tela). */
const PINNED_KEY = "bausa_whatsapp_pinned";
const ARCHIVED_KEY = "bausa_whatsapp_archived";
const MESSAGE_MAX_LENGTH = 4096;
/** Teto de upload (foto/documento) — casa com a action e fica sob o bodySizeLimit. */
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Aceitos ao anexar (foto ou PDF). */
const ATTACH_ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf";
/** 100vh − header (4rem) − padding do main (2rem) − PageHeader denso + gap (~3.75rem). */
// -13rem: desconta a faixa de abas (BrandTabs + gap) inserida pelo módulo
// /whatsapp acima do espelho — sem isso o painel estoura o viewport e o
// compositor cai abaixo da dobra (igual ao PANEL_HEIGHT da aba Grupos).
const PANEL_HEIGHT = "h-[calc(100vh-13rem)] min-h-[26rem]";

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
  /** messageId da Z-API — id real da mensagem, usado p/ casar o eco 1:1. */
  messageId?: string | null;
}

/** Mídia selecionada/gravada aguardando revisão e confirmação de envio. */
interface PendingMedia {
  kind: "image" | "document" | "audio";
  file: File;
  /** object URL local só p/ o preview (revogado ao confirmar/cancelar). */
  previewUrl: string;
  fileName: string;
  /** Legenda (só imagem — vai como caption no /send-image). */
  caption: string;
  /** Conversa-alvo capturada na seleção (troca de chat não muda o destino). */
  phone: string;
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
  unread: boolean;
  selected: boolean;
  pinned: boolean;
  archived: boolean;
  menuOpen: boolean;
  onSelect: (phone: string) => void;
  onToggleMenu: (phone: string) => void;
  onTogglePin: (phone: string) => void;
  onToggleArchive: (phone: string) => void;
}

function ChatListItem({
  chat,
  contact,
  unread,
  selected,
  pinned,
  archived,
  menuOpen,
  onSelect,
  onToggleMenu,
  onTogglePin,
  onToggleArchive,
}: ChatListItemProps) {
  // De-para: nome do CRM PRIMEIRO (atleta, ou "<resp> - Resp - <atleta>" —
  // padrão do CEO 2026-08-23) → contato do aparelho → telefone. O CRM é a
  // fonte canônica: o pushName/agenda só vale p/ número que não conhecemos.
  const displayName =
    chat.leadName ?? chat.name ?? contact?.name ?? formatPhoneDisplay(chat.phone);

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(chat.phone)}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
          selected ? "bg-primary/10" : "hover:bg-accent",
        )}
      >
        <ChatAvatar name={displayName} imgUrl={contact?.imgUrl ?? null} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1">
              {pinned && (
                <Pin aria-label="Fixada" className="size-3 shrink-0 rotate-45 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "truncate text-sm text-foreground",
                  unread ? "font-bold" : "font-medium",
                )}
              >
                {displayName}
              </span>
            </span>
            {chat.lastMessageTime !== null && (
              <span
                className={cn(
                  "shrink-0 text-[10px] tabular-nums transition-opacity group-hover:opacity-0",
                  unread ? "font-semibold text-sys-green" : "text-muted-foreground",
                )}
              >
                {formatChatTime(chat.lastMessageTime)}
              </span>
            )}
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span
              className={cn(
                "truncate text-xs",
                unread ? "font-medium text-foreground" : "text-muted-foreground",
              )}
            >
              {chat.lastMessagePreview ?? formatPhoneDisplay(chat.phone)}
            </span>
            {unread && (
              <span
                aria-label="Mensagem não lida"
                className="size-2.5 shrink-0 rounded-full bg-sys-green"
              />
            )}
          </span>
        </span>
      </button>

      {/* Kebab de opções (fixar/arquivar) — aparece no hover/foco. */}
      <button
        type="button"
        aria-label="Opções da conversa"
        aria-expanded={menuOpen}
        onClick={(e) => {
          // stopImmediatePropagation (não só stopPropagation): no App Router o
          // React delega no document, onde vive o listener de "fechar ao clicar
          // fora" — sem isto, trocar direto de um menu p/ o kebab de outro item
          // fecharia em vez de trocar.
          e.stopPropagation();
          e.nativeEvent.stopImmediatePropagation();
          onToggleMenu(chat.phone);
        }}
        className={cn(
          "absolute right-2 top-2 flex size-6 items-center justify-center rounded-md bg-card/90 text-muted-foreground opacity-0 shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100",
          menuOpen && "opacity-100",
        )}
      >
        <MoreVertical className="size-4" />
      </button>

      {menuOpen && (
        <div className="absolute right-2 top-9 z-20 w-44 overflow-hidden rounded-lg border border-border bg-popover py-1 shadow-lg">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onTogglePin(chat.phone);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent"
          >
            {pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
            {pinned ? "Desafixar" : "Fixar no topo"}
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive(chat.phone);
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent"
          >
            {archived ? <ArchiveRestore className="size-3.5" /> : <Archive className="size-3.5" />}
            {archived ? "Desarquivar" : "Arquivar"}
          </button>
        </div>
      )}
    </div>
  );
}

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

/** Renderiza o conteúdo de mídia da mensagem (foto/áudio/vídeo/documento). */
function MessageMedia({ message }: { message: EspelhoMessage }) {
  const { tipo, mediaUrl, fileName } = message;
  // URLs de mídia da Z-API podem expirar/exigir auth/ser bloqueadas (CSP,
  // adblock). Sem onError, o browser mostra ícone quebrado — pior que texto.
  // Ao falhar o carregamento, cai no mesmo rótulo textual (padrão do ChatAvatar).
  const [failed, setFailed] = useState(false);

  // Rótulo textual: mídia antiga (sem URL), tipo sem arquivo, ou carga falhou.
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
    return <p className="text-sm italic text-muted-foreground">[{MIDIA_LABEL[tipo] ?? "mídia"}]</p>;
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
            tipo === "sticker" ? "max-h-32 w-32" : "max-h-64 max-w-full",
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
        className="w-56 max-w-full"
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
        className="max-h-64 max-w-full rounded-lg"
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
    <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-sm text-primary underline">
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
          "max-w-[75%] space-y-1 rounded-2xl px-3 py-2",
          message.fromMe ? "rounded-br-md bg-primary/10" : "rounded-bl-md bg-secondary",
        )}
      >
        {isMedia && <MessageMedia message={message} />}
        {/* Texto = mensagem (tipo text) OU legenda da mídia. */}
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

/**
 * Modal de REVISÃO antes do envio (foto/áudio/documento) — como no WhatsApp o
 * envio não pode ser cancelado, o CEO revê/ouve/visualiza e confirma. Imagem
 * ganha legenda opcional.
 */
function MediaPreviewModal({
  media,
  sending,
  onCaptionChange,
  onCancel,
  onConfirm,
}: {
  media: PendingMedia;
  sending: boolean;
  onCaptionChange: (caption: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titulo =
    media.kind === "image" ? "Revisar foto" : media.kind === "audio" ? "Revisar áudio" : "Revisar documento";
  return (
    <>
      <div
        className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px]"
        onClick={sending ? undefined : onCancel}
        aria-hidden
      />
      <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        >
          <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <p className="text-sm font-semibold text-foreground">{titulo}</p>
            <button
              type="button"
              onClick={onCancel}
              disabled={sending}
              aria-label="Fechar"
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
            >
              <X className="size-4" />
            </button>
          </header>

          <div className="space-y-3 p-4">
            {media.kind === "image" && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element -- preview local (object URL) */}
                <img
                  src={media.previewUrl}
                  alt="Pré-visualização"
                  className="max-h-72 w-full rounded-lg bg-secondary object-contain"
                />
                <Input
                  value={media.caption}
                  onChange={(e) => onCaptionChange(e.target.value)}
                  placeholder="Legenda (opcional)"
                  aria-label="Legenda"
                  maxLength={MESSAGE_MAX_LENGTH}
                  disabled={sending}
                />
              </>
            )}
            {media.kind === "audio" && (
              <audio controls src={media.previewUrl} className="w-full" />
            )}
            {media.kind === "document" && (
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-3 py-3">
                <FileText className="size-6 shrink-0 text-primary" />
                <span className="min-w-0 truncate text-sm font-medium text-foreground">
                  {media.fileName}
                </span>
              </div>
            )}
          </div>

          <footer className="flex items-center justify-end gap-2 border-t border-border bg-secondary/30 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={sending}>
              Cancelar
            </Button>
            <Button size="sm" onClick={onConfirm} disabled={sending}>
              {sending ? <Loader2 className="animate-spin" /> : <Send />}
              {sending ? "Enviando…" : "Enviar"}
            </Button>
          </footer>
        </div>
      </div>
    </>
  );
}

// ─── Painel direito: métricas da conversa + insights de IA ──────────────────

function fmtRespMin(min: number | null): string {
  if (min === null) return "—";
  if (min < 1) return "<1m";
  if (min < 60) return `${Math.round(min)}m`;
  const h = min / 60;
  if (h < 24) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

function fmtDataCurta(ms: number | null): string {
  if (ms === null) return "—";
  return new Date(ms).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

function fmtPct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n)}%`;
}

function fmtDuracao(dias: number): string {
  if (dias <= 0) return "Mesmo dia";
  if (dias === 1) return "1 dia";
  if (dias < 30) return `${dias} dias`;
  const meses = dias / 30;
  return `${meses.toFixed(meses < 10 ? 1 : 0)} meses`;
}

function fmtHoras(h: number | null): string {
  if (h === null) return "—";
  if (h < 1) return "<1h";
  if (h < 24) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

const TIPO_MIDIA_LABEL: Record<string, string> = {
  image: "Imagem",
  audio: "Áudio",
  ptt: "Áudio",
  video: "Vídeo",
  document: "Documento",
  sticker: "Figurinha",
  contact: "Contato",
  location: "Local",
};

function fmtTipoMidia(tipo: string): string {
  return TIPO_MIDIA_LABEL[tipo] ?? tipo.charAt(0).toUpperCase() + tipo.slice(1);
}

function MetricaMini({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-label-tertiary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{value}</p>
      {sub && <p className="text-[10px] tabular-nums text-muted-foreground">{sub}</p>}
    </div>
  );
}

/** Barra de proporção enviadas (nós) × recebidas (lead). */
function BarraProporcao({ enviadas, recebidas }: { enviadas: number; recebidas: number }) {
  const total = enviadas + recebidas;
  if (total === 0) return null;
  const pctEnv = (enviadas / total) * 100;
  return (
    <div className="space-y-1">
      <div className="flex h-2 overflow-hidden rounded-full bg-secondary">
        <div className="bg-primary" style={{ width: `${pctEnv}%` }} aria-hidden />
        <div className="bg-sys-green" style={{ width: `${100 - pctEnv}%` }} aria-hidden />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span className="text-primary">{enviadas} nós</span>
        <span className="text-sys-green">{recebidas} lead</span>
      </div>
    </div>
  );
}

/** Distribuição das mensagens do lead por faixa horária (BRT) — melhor horário. */
function MiniFaixas({ faixas }: { faixas: { faixa: string; recebidas: number }[] }) {
  const max = Math.max(1, ...faixas.map((f) => f.recebidas));
  const totalRec = faixas.reduce((s, f) => s + f.recebidas, 0);
  return (
    <div className="space-y-1">
      {faixas.map((f) => {
        const destaque = totalRec > 0 && f.recebidas === max;
        return (
          <div key={f.faixa} className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-[10px] text-muted-foreground">{f.faixa}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
              <div
                className={cn("h-full rounded-full", destaque ? "bg-primary" : "bg-primary/40")}
                style={{ width: `${(f.recebidas / max) * 100}%` }}
                aria-hidden
              />
            </div>
            <span className="w-5 shrink-0 text-right text-[10px] tabular-nums text-muted-foreground">
              {f.recebidas}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ConversaPanel({
  metricas,
  metricasLoading,
  insights,
  insightsLoading,
  onGerarInsights,
  onFecharInsights,
  agentsAnalise,
  phone,
  lid,
  leadNome,
}: {
  metricas: MetricasConversa | null;
  metricasLoading: boolean;
  insights: InsightsConversa | null;
  insightsLoading: boolean;
  onGerarInsights: () => void;
  onFecharInsights: () => void;
  agentsAnalise: AgentResumo[];
  phone: string;
  /** LID da conversa (quando migrada) — a análise por agent precisa dele. */
  lid?: string;
  leadNome?: string;
}) {
  return (
    <div className="crm-scroll flex h-full flex-col gap-3 overflow-y-auto p-3">
      {/* Métricas desta conversa */}
      <section className="space-y-2">
        <p className="text-eyebrow text-label-tertiary">Métricas da conversa</p>
        {metricasLoading && !metricas ? (
          <div className="flex justify-center py-4">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : metricas && metricas.total > 0 ? (
          <div className="space-y-3">
            {/* Engajamento — velocidade e reciprocidade da conversa */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-label-tertiary/80">
                Engajamento
              </p>
              <div className="grid grid-cols-2 gap-2">
                <MetricaMini
                  label="Nossa resposta"
                  value={fmtRespMin(metricas.nossaRespostaMedianaMin)}
                  sub={
                    metricas.nossaRespostaP90Min !== null
                      ? `p90 ${fmtRespMin(metricas.nossaRespostaP90Min)}`
                      : "mediana"
                  }
                />
                <MetricaMini
                  label="Resposta do lead"
                  value={fmtRespMin(metricas.leadRespostaMedianaMin)}
                  sub={
                    metricas.leadRespostaP90Min !== null
                      ? `p90 ${fmtRespMin(metricas.leadRespostaP90Min)}`
                      : "mediana"
                  }
                />
                <MetricaMini
                  label="Taxa de resposta"
                  value={fmtPct(metricas.taxaRespostaLeadPct)}
                  sub="lead responde"
                />
                <MetricaMini
                  label="1ª resposta"
                  value={fmtRespMin(metricas.tempoPrimeiraRespostaMin)}
                  sub="nosso 1º retorno"
                />
              </div>
            </div>

            {/* Atividade — volume, longevidade e status */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-label-tertiary/80">
                Atividade
              </p>
              <div className="grid grid-cols-2 gap-2">
                <MetricaMini
                  label="Mensagens"
                  value={metricas.total.toLocaleString("pt-BR")}
                  sub={`${metricas.diasAtivos} dia(s) ativo(s)`}
                />
                <MetricaMini
                  label="Duração"
                  value={fmtDuracao(metricas.duracaoDias)}
                  sub={metricas.iniciadoPeloLead ? "lead iniciou" : "nós iniciamos"}
                />
                <MetricaMini
                  label="Primeira msg"
                  value={fmtDataCurta(metricas.primeiraMs)}
                />
                <MetricaMini
                  label="Última msg"
                  value={fmtDataCurta(metricas.ultimaMs)}
                  sub={metricas.ultimaFromMe ? "nossa" : "do lead"}
                />
              </div>
              <BarraProporcao enviadas={metricas.enviadas} recebidas={metricas.recebidas} />
              {metricas.aguardando && (
                <p className="rounded-md bg-sys-orange/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-sys-orange">
                  Lead aguarda resposta há {fmtHoras(metricas.aguardandoHoras)}.
                </p>
              )}
              {metricas.janelaTruncada && (
                <p className="text-[10px] leading-relaxed text-label-tertiary">
                  Duração, início e dias ativos consideram as {metricas.total.toLocaleString("pt-BR")} mensagens
                  mais recentes.
                </p>
              )}
            </div>

            {/* Agendamento — lead casado a esta conversa (telefone → atleta/responsável) */}
            {metricas.agendamento && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-label-tertiary/80">
                  Agendamento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <MetricaMini
                    label="Msg → agendou"
                    value={
                      metricas.agendamento.agendou
                        ? fmtHoras(metricas.agendamento.msgAteAgendarHoras)
                        : "—"
                    }
                    sub={
                      metricas.agendamento.agendou
                        ? "da 1ª msg ao agendamento"
                        : metricas.agendamento.aguardandoAgendaHoras !== null
                          ? `sem agenda há ${fmtHoras(metricas.agendamento.aguardandoAgendaHoras)}`
                          : "ainda não agendou"
                    }
                  />
                  <MetricaMini
                    label="Reunião"
                    value={fmtDataCurta(
                      metricas.agendamento.reuniaoData
                        ? Date.parse(metricas.agendamento.reuniaoData)
                        : null,
                    )}
                    sub={
                      metricas.agendamento.reuniaoData
                        ? metricas.agendamento.reuniaoFutura
                          ? "próxima"
                          : "já ocorreu"
                        : "sem data"
                    }
                  />
                  <MetricaMini
                    label="Remarcações"
                    value={metricas.agendamento.remarcacoes}
                    sub={
                      metricas.agendamento.agendamentoAteRemarcarHoras !== null
                        ? `1ª após ${fmtHoras(metricas.agendamento.agendamentoAteRemarcarHoras)}`
                        : "nenhuma"
                    }
                  />
                  <MetricaMini
                    label="Lead"
                    value={
                      <span className="block truncate text-xs">
                        {metricas.agendamento.atletaNome}
                      </span>
                    }
                    sub={metricas.agendamento.agendou ? "reunião agendada" : "sem reunião"}
                  />
                </div>
              </div>
            )}

            {/* Mídia — só quando houve troca de mídia */}
            {metricas.midiaEnviadas + metricas.midiaRecebidas > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-label-tertiary/80">
                  Mídia trocada
                </p>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {metricas.midiaEnviadas}↑ · {metricas.midiaRecebidas}↓
                  </span>
                  {metricas.midiaPorTipo.map((m) => (
                    <span
                      key={m.tipo}
                      className="rounded-full border border-border bg-card px-2 py-0.5 text-[10px] tabular-nums text-foreground"
                    >
                      {fmtTipoMidia(m.tipo)} {m.total}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Melhor horário — quando o lead costuma responder (BRT) */}
            {metricas.recebidas > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-label-tertiary/80">
                  Quando o lead responde
                </p>
                <MiniFaixas faixas={metricas.faixasHorario} />
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Sem mensagens registradas nesta conversa.</p>
        )}
      </section>

      {/* Insights de IA (sob demanda; prompt editável em /automacoes) */}
      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-eyebrow text-label-tertiary">Insights de IA</p>
          {insights && (
            <button
              type="button"
              onClick={onFecharInsights}
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
                  <li key={`${i}-${sinal.slice(0, 24)}`} className="text-[11px] leading-relaxed text-muted-foreground">
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
              onClick={onGerarInsights}
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
              disabled={insightsLoading}
              onClick={onGerarInsights}
            >
              {insightsLoading ? <Loader2 className="animate-spin" /> : <Sparkles />}
              Gerar insights da conversa
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              A IA resume o clima da conversa, o interesse e sugere a próxima ação. Edite o prompt
              em Automações.
            </p>
          </>
        )}
      </section>

      {/* Analista sob demanda (agents custom com capacidade `analise`) */}
      <AnaliseAgentBlock key={phone} agents={agentsAnalise} phone={phone} lid={lid} leadNome={leadNome} />
    </div>
  );
}

// ─── Tela ────────────────────────────────────────────────────────

export function WhatsAppEspelhoClient({
  agentsConversa = [],
  agentsAnalise = [],
  agentsChatbot = [],
}: {
  agentsConversa?: AgentResumo[];
  agentsAnalise?: AgentResumo[];
  /** Agents `chatbot_autonomo` p/ o seletor por conversa (CEO-only). */
  agentsChatbot?: AgentResumo[];
}) {
  const [chats, setChats] = useState<EspelhoChat[]>([]);
  const [chatsStatus, setChatsStatus] = useState<LoadStatus>("loading");
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const [messages, setMessages] = useState<EspelhoMessage[]>([]);
  const [messagesStatus, setMessagesStatus] = useState<LoadStatus>("ready");
  const [historyUnavailable, setHistoryUnavailable] = useState(false);
  const [mirrorActive, setMirrorActive] = useState(false);
  const [contacts, setContacts] = useState<Record<string, EspelhoContact | null>>({});
  /** phone → epoch ms da última vez que o CEO abriu a conversa (badge não-lida). */
  const [lastSeen, setLastSeen] = useState<Record<string, number>>({});
  /** Conversas fixadas/arquivadas (local, por navegador do CEO). */
  const [pinned, setPinned] = useState<Set<string>>(new Set());
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [menuPhone, setMenuPhone] = useState<string | null>(null);
  const [viewArchived, setViewArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sugerindo, setSugerindo] = useState(false);
  /** Copiloto (agent custom `conversa`) usado na sugestão; "" = persona padrão. */
  const [copilotoId, setCopilotoId] = useState("");
  const [attaching, setAttaching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [pendingMedia, setPendingMedia] = useState<PendingMedia | null>(null);
  /** Insights de IA da conversa aberta (sob demanda; limpa ao trocar de chat). */
  const [insights, setInsights] = useState<InsightsConversa | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  /** Métricas da conversa aberta (painel direito; recarrega ao trocar de chat). */
  const [metricas, setMetricas] = useState<MetricasConversa | null>(null);
  const [metricasLoading, setMetricasLoading] = useState(false);

  const attachRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** true = descartar o áudio ao parar (cancelado, não enviar). */
  const cancelRecordRef = useRef(false);
  /** Conversa-alvo capturada no início da gravação (troca de chat não muda o destino). */
  const recordPhoneRef = useRef<string | null>(null);
  /** Guard síncrono anti-duplo-clique: bloqueia iniciar 2 gravações durante o
   *  await do getUserMedia (o estado `recording` só seta depois). */
  const startingRef = useRef(false);
  const chatsAbortRef = useRef<AbortController | null>(null);
  const messagesAbortRef = useRef<AbortController | null>(null);
  const contactsInflightRef = useRef<Set<string>>(new Set());
  const contactsCacheRef = useRef<Record<string, EspelhoContact | null>>({});
  /** Conversa aberta AGORA — guard contra eco/refetch na thread errada após await. */
  const selectedPhoneRef = useRef<string | null>(null);
  /** telefone → LID da conversa (WhatsApp novo endereça por LID; o webhook grava
   *  mensagens sob o LID). fetchMessages busca por telefone OU lid. */
  const phoneToLidRef = useRef<Record<string, string>>({});
  /** Ecos de envios da sessão, por conversa — sobrevivem à troca de chat (multi-device). */
  const sessionEchoesRef = useRef<Map<string, EspelhoMessage[]>>(new Map());
  const threadRef = useRef<HTMLDivElement>(null);
  /** Nome exibido da conversa aberta — lido no clique do chatbot (contexto do prompt). */
  const selectedNameRef = useRef<string>("");

  useEffect(() => {
    selectedPhoneRef.current = selectedPhone;
  }, [selectedPhone]);

  // Mapa telefone→LID sempre atualizado com a lista de chats (usado por
  // fetchMessages para casar mensagens gravadas sob o LID da conversa).
  useEffect(() => {
    const map: Record<string, string> = {};
    for (const c of chats) if (c.lid) map[c.phone] = c.lid;
    phoneToLidRef.current = map;
  }, [chats]);

  // Carrega o "visto por último" persistido (por navegador do CEO).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LAST_SEEN_KEY);
      if (raw) setLastSeen(JSON.parse(raw) as Record<string, number>);
    } catch {
      // localStorage indisponível/corrompido — segue sem histórico de leitura.
    }
  }, []);

  // Carrega fixadas/arquivadas persistidas (local).
  useEffect(() => {
    const carregar = (key: string, apply: (s: Set<string>) => void) => {
      try {
        const raw = localStorage.getItem(key);
        if (raw) apply(new Set(JSON.parse(raw) as string[]));
      } catch {
        // ignora localStorage corrompido/indisponível
      }
    };
    carregar(PINNED_KEY, setPinned);
    carregar(ARCHIVED_KEY, setArchived);
  }, []);

  // Alterna fixar/arquivar (persiste) e fecha o menu.
  const togglePhoneSet = useCallback(
    (
      key: string,
      setState: Dispatch<SetStateAction<Set<string>>>,
      phone: string,
    ) => {
      setState((prev) => {
        const next = new Set(prev);
        if (next.has(phone)) next.delete(phone);
        else next.add(phone);
        try {
          localStorage.setItem(key, JSON.stringify([...next]));
        } catch {
          // ignora falha de persistência
        }
        return next;
      });
      setMenuPhone(null);
    },
    [],
  );

  const togglePin = useCallback(
    (phone: string) => togglePhoneSet(PINNED_KEY, setPinned, phone),
    [togglePhoneSet],
  );
  const toggleArchive = useCallback(
    (phone: string) => togglePhoneSet(ARCHIVED_KEY, setArchived, phone),
    [togglePhoneSet],
  );

  // Fecha o menu de opções ao clicar fora (listener adicionado no próximo tick
  // p/ o clique que abriu não fechar imediatamente).
  useEffect(() => {
    if (!menuPhone) return;
    const fechar = () => setMenuPhone(null);
    const id = window.setTimeout(() => document.addEventListener("click", fechar), 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener("click", fechar);
    };
  }, [menuPhone]);

  // Marca a conversa como lida ATÉ `value` (epoch ms). Faz bail se já estiver
  // igual/maior — sem re-render/gravação à toa (o efeito de thread chama a cada
  // mudança de mensagens).
  const markSeen = useCallback((phone: string, value: number) => {
    setLastSeen((prev) => {
      if ((prev[phone] ?? 0) >= value) return prev;
      const next = { ...prev, [phone]: value };
      try {
        localStorage.setItem(LAST_SEEN_KEY, JSON.stringify(next));
      } catch {
        // ignora falha de persistência
      }
      return next;
    });
  }, []);

  // Abrir a conversa = selecionar + marcar como lida até a última recebida
  // conhecida (max com now cobre conversas sem inbound registrado; usar o
  // lastInboundAt do servidor evita skew do relógio do cliente).
  const handleSelect = useCallback(
    (phone: string) => {
      setSelectedPhone(phone);
      const inbound =
        chats.find((c) => c.phone === phone)?.lastInboundAt ?? 0;
      markSeen(phone, Math.max(Date.now(), inbound));
    },
    [markSeen, chats],
  );

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
      const lid = phoneToLidRef.current[phone];
      const query = lid
        ? `phone=${encodeURIComponent(phone)}&lid=${encodeURIComponent(lid)}`
        : `phone=${encodeURIComponent(phone)}`;
      const res = await fetch(`/api/whatsapp/messages?${query}`, {
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
      // Consumo 1:1: cada linha do servidor confirma NO MÁXIMO um eco (enviar a
      // mesma mensagem 2x em <2min não pode sumir com as duas).
      const usadas = new Set<string>();
      const echoes = (sessionEchoesRef.current.get(phone) ?? []).filter((echo) => {
        // Preferir casar pelo messageId REAL da Z-API (id do eco = messageId
        // quando o envio o retornou) — determinístico, imune a texto null de
        // mídia e a skew de relógio. Fallback: heurística fromMe + MESMO tipo
        // (não cruza mídia com texto) + texto igual + janela.
        const temIdReal = !echo.id.startsWith("local-");
        const idMatch = temIdReal ? server.find((msg) => msg.id === echo.id) : undefined;
        const heurMatch = idMatch
          ? undefined
          : server.find(
              (msg) =>
                !usadas.has(msg.id) &&
                msg.fromMe &&
                msg.tipo === echo.tipo &&
                msg.text === echo.text &&
                Math.abs((msg.timestamp ?? 0) - (echo.timestamp ?? 0)) < ECHO_MATCH_WINDOW_MS,
            );
        const match = idMatch ?? heurMatch;
        if (match) usadas.add(match.id);
        const expired = Date.now() - (echo.timestamp ?? 0) > ECHO_TTL_MS;
        return !match && !expired;
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

  // ── Carga inicial + polling da lista (15s, pausa com aba oculta) ──

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

  // ── Carga da thread ao selecionar + polling (8s, pausa com aba oculta) ──

  useEffect(() => {
    if (!selectedPhone) return;
    // Semeia com os ecos da sessão desta conversa (no multi-device o servidor
    // não devolve histórico — sem isso, trocar de chat apagaria os envios).
    setMessages(sessionEchoesRef.current.get(selectedPhone) ?? []);
    setHistoryUnavailable(false);
    setInsights(null); // insights são da conversa anterior
    void fetchMessages(selectedPhone);

    // Métricas da conversa (painel direito) — guard contra troca em voo
    const phoneMetricas = selectedPhone;
    setMetricas(null);
    setMetricasLoading(true);
    void fetchMetricasConversa({
      phone: phoneMetricas,
      lid: phoneToLidRef.current[phoneMetricas] ?? null,
    })
      .then((r) => {
        if (selectedPhoneRef.current !== phoneMetricas) return;
        if (r.success) setMetricas(r.metricas);
      })
      .finally(() => {
        if (selectedPhoneRef.current === phoneMetricas) setMetricasLoading(false);
      });

    const interval = setInterval(() => {
      if (document.hidden) return;
      void fetchMessages(selectedPhone, { silent: true });
    }, THREAD_POLL_MS);
    return () => {
      clearInterval(interval);
      messagesAbortRef.current?.abort();
    };
  }, [selectedPhone, fetchMessages]);

  // Conversa aberta = lida até a última RECEBIDA exibida (timestamp do servidor,
  // sem skew do relógio do cliente). Cobre inbounds que chegam com a conversa
  // aberta; o markSeen faz bail quando não há avanço.
  useEffect(() => {
    if (!selectedPhone || messages.length === 0) return;
    let maxInbound = 0;
    for (const m of messages) {
      if (!m.fromMe && (m.timestamp ?? 0) > maxInbound) maxInbound = m.timestamp ?? 0;
    }
    if (maxInbound > 0) markSeen(selectedPhone, maxInbound);
  }, [messages, selectedPhone, markSeen]);

  // ── Refresh imediato ao voltar para a aba (não espera o próximo tick) ──

  useEffect(() => {
    const onVisible = () => {
      if (document.hidden) return;
      void fetchChats({ silent: true });
      const phone = selectedPhoneRef.current;
      if (phone) void fetchMessages(phone, { silent: true });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [fetchChats, fetchMessages]);

  // ── Auto-scroll para o fim da thread quando as mensagens mudam ──

  useEffect(() => {
    const node = threadRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  // ── Ações ──

  // Insights de IA da conversa (sob demanda; guard contra troca de chat em voo)
  const handleInsights = useCallback(async () => {
    if (!selectedPhone || insightsLoading) return;
    const phone = selectedPhone;
    setInsightsLoading(true);
    try {
      const r = await gerarInsightsConversa({ phone, lid: phoneToLidRef.current[phone] ?? null });
      if (selectedPhoneRef.current !== phone) return; // trocou de conversa
      if (r.success) {
        setInsights(r.insights);
      } else {
        toast.error(r.error);
      }
    } catch {
      toast.error("Não foi possível gerar os insights agora.");
    } finally {
      setInsightsLoading(false);
    }
  }, [selectedPhone, insightsLoading]);

  // Chatbot assistido (IA sugere a resposta; humano revisa e envia). Preenche o
  // compositor — NUNCA envia. Guard contra troca de chat em voo.
  const handleSugerirResposta = useCallback(async () => {
    if (!selectedPhone || sugerindo) return;
    const phone = selectedPhone;
    setSugerindo(true);
    try {
      const r = await sugerirRespostaChatbot({
        phone,
        lid: phoneToLidRef.current[phone] ?? null,
        leadNome: selectedNameRef.current || undefined,
        agentId: copilotoId || undefined,
      });
      if (selectedPhoneRef.current !== phone) return; // trocou de conversa
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
  }, [selectedPhone, sugerindo, copilotoId]);

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
          // id = messageId real da Z-API → casa 1:1 com a linha do espelho.
          id: data?.messageId ?? `local-${Date.now()}`,
          phone,
          fromMe: true,
          text: message,
          timestamp: Date.now(),
          tipo: "text",
          mediaUrl: null,
          mimeType: null,
          fileName: null,
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

  // Anexar e enviar foto/documento: upload → Z-API (/send-image ou
  // /send-document) → eco de mídia. Guard de tamanho + try/catch (upload via
  // Server Action; ver next-serveraction-bodysize).
  // Upload + envio da mídia JÁ REVISADA (chamado pelo modal de confirmação).
  // Guard de tamanho + try/catch (upload via Server Action; ver bodySizeLimit).
  const enviarMidia = useCallback(
    async (pm: PendingMedia) => {
      const { kind, file, fileName, caption, phone } = pm;
      setAttaching(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const up = kind === "audio" ? await uploadMensagemAudio(fd) : await uploadMensagemArquivo(fd);
        if (!up.success) {
          toast.error(up.error);
          return;
        }
        const legenda = kind === "image" ? caption.trim() : "";
        const corpo =
          kind === "image"
            ? { phone, imageUrl: up.url, caption: legenda || undefined }
            : kind === "document"
              ? { phone, documentUrl: up.url, fileName }
              : { phone, audioUrl: up.url };
        const res = await fetch("/api/whatsapp/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(corpo),
        });
        const data = (await res.json().catch(() => null)) as SendResponse | null;
        if (!res.ok) {
          toast.error(
            data?.error === "zapi_nao_configurado"
              ? "Z-API não configurada no ambiente do Engine."
              : "Falha ao enviar. Tente novamente.",
          );
          return;
        }
        const echo: EspelhoMessage = {
          id: data?.messageId ?? `local-${Date.now()}`,
          phone,
          fromMe: true,
          text: kind === "image" ? legenda || null : null,
          timestamp: Date.now(),
          tipo: kind,
          mediaUrl: up.url,
          mimeType: file.type || null,
          fileName: kind === "document" ? fileName : null,
        };
        sessionEchoesRef.current.set(phone, [
          ...(sessionEchoesRef.current.get(phone) ?? []),
          echo,
        ]);
        toast.success(
          kind === "image" ? "Imagem enviada" : kind === "document" ? "Documento enviado" : "Áudio enviado",
        );
        // Fecha o modal de revisão SÓ no sucesso — em falha (upload/502/rede) o
        // modal fica aberto p/ nova tentativa (a mídia não é descartada).
        setPendingMedia(null);
        if (selectedPhoneRef.current === phone) {
          setMessages((prev) => [...prev, echo]);
          void fetchMessages(phone, { silent: true });
        }
      } catch {
        toast.error("Falha ao enviar. Verifique a conexão.");
      } finally {
        setAttaching(false);
      }
    },
    [fetchMessages],
  );

  // Selecionar foto/documento → abre o modal de REVISÃO (não envia direto).
  const handleAttach = useCallback(
    (file: File) => {
      if (!selectedPhone) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        toast.error("Arquivo muito grande (máx 10MB).");
        return;
      }
      setPendingMedia({
        kind: file.type.startsWith("image/") ? "image" : "document",
        file,
        previewUrl: URL.createObjectURL(file),
        fileName: file.name,
        caption: "",
        phone: selectedPhone,
      });
    },
    [selectedPhone],
  );

  // Confirmar o envio da mídia revisada. Mantém o modal aberto durante o envio
  // (sending=attaching → spinner + botões desabilitados + backdrop travado); o
  // `attaching` guard bloqueia reentrada/duplo-clique. O modal fecha no sucesso
  // (dentro de enviarMidia); em falha fica aberto p/ retry.
  const confirmSendMedia = useCallback(() => {
    if (!pendingMedia || attaching) return;
    void enviarMidia(pendingMedia);
  }, [pendingMedia, attaching, enviarMidia]);

  const cancelPendingMedia = useCallback(() => {
    setPendingMedia(null);
  }, []);

  // ── Gravação e envio de áudio (mensagem de voz) ──
  // Grava via MediaRecorder → upload (bucket) → Z-API /send-audio → eco.
  // O MediaRecorder do Chrome grava webm/opus; a Z-API transcodifica p/ WhatsApp.

  const finalizarAudio = useCallback(() => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    audioStreamRef.current?.getTracks().forEach((t) => t.stop());
    audioStreamRef.current = null;
    setRecording(false);

    const phone = recordPhoneRef.current;
    const chunks = audioChunksRef.current;
    audioChunksRef.current = [];
    // Cancelado, sem conversa, ou gravação vazia → descarta.
    if (cancelRecordRef.current || !phone || chunks.length === 0) return;

    // MIME BASE (sem `;codecs=opus`): o storage-js ignora options.contentType
    // para File/Blob e usa File.type — então o tipo TEM de vir limpo aqui para
    // casar com o allowed_mime_types do bucket (senão o Storage rejeita).
    const baseType =
      (mediaRecorderRef.current?.mimeType || "audio/webm").split(";")[0].trim().toLowerCase() ||
      "audio/webm";
    const blob = new Blob(chunks, { type: baseType });
    if (blob.size === 0) return;
    if (blob.size > MAX_UPLOAD_BYTES) {
      toast.error("Áudio muito longo (máx 10MB).");
      return;
    }
    const ext = baseType.split("/")[1] || "webm";
    const file = new File([blob], `audio-${Date.now()}.${ext}`, { type: baseType });

    // Abre o modal de REVISÃO p/ OUVIR o áudio antes de enviar (não envia direto).
    setPendingMedia({
      kind: "audio",
      file,
      previewUrl: URL.createObjectURL(blob),
      fileName: file.name,
      caption: "",
      phone,
    });
  }, []);

  const handleStartRecording = useCallback(async () => {
    // Guard síncrono (startingRef) além do estado `recording` — o estado só
    // seta após o await do getUserMedia, então dois cliques rápidos criariam
    // dois recorders (o 1º ficaria órfão → mic preso).
    if (!selectedPhone || recording || attaching || startingRef.current) return;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error("Gravação de áudio não suportada neste navegador.");
      return;
    }
    startingRef.current = true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      const mime =
        ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find(
          (t) => MediaRecorder.isTypeSupported(t),
        ) ?? "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      audioChunksRef.current = [];
      cancelRecordRef.current = false;
      recordPhoneRef.current = selectedPhone;
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      rec.onstop = () => void finalizarAudio();
      mediaRecorderRef.current = rec;
      rec.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      audioStreamRef.current = null;
      toast.error("Não foi possível acessar o microfone. Verifique a permissão.");
    } finally {
      startingRef.current = false;
    }
  }, [selectedPhone, recording, attaching, finalizarAudio]);

  // Parar a gravação: só age se estiver realmente gravando (evita 2º stop() →
  // InvalidStateError) e o state guard impede inverter enviar/cancelar.
  const handleStopAndSend = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") return;
    cancelRecordRef.current = false;
    try {
      rec.stop();
    } catch {
      /* já parado */
    }
  }, []);

  const handleCancelRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec || rec.state === "inactive") return;
    cancelRecordRef.current = true;
    try {
      rec.stop();
    } catch {
      /* já parado */
    }
  }, []);

  // Trocar de conversa durante a gravação → cancela (evita a barra sob o chat
  // errado e o áudio ir para o lead capturado no início — mis-send).
  useEffect(() => {
    if (recording && recordPhoneRef.current && selectedPhone !== recordPhoneRef.current) {
      handleCancelRecording();
    }
  }, [selectedPhone, recording, handleCancelRecording]);

  // Encerra gravação/stream ao desmontar (evita mic preso).
  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      audioStreamRef.current?.getTracks().forEach((t) => t.stop());
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        cancelRecordRef.current = true;
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Revoga o object URL ao trocar de mídia / fechar / desmontar. Depende SÓ da
  // previewUrl (string) — editar a legenda recria o objeto pendingMedia com a
  // MESMA url; depender do objeto inteiro revogaria a imagem em uso a cada tecla.
  useEffect(() => {
    const url = pendingMedia?.previewUrl;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [pendingMedia?.previewUrl]);

  // ── Derivados ──

  const filteredChats = useMemo(() => {
    const query = search.trim().toLowerCase();
    const queryDigits = query.replace(/\D/g, "");
    const buscados =
      query.length === 0
        ? chats
        : chats.filter(
            (chat) =>
              (chat.name?.toLowerCase().includes(query) ?? false) ||
              (queryDigits.length > 0 && chat.phone.includes(queryDigits)),
          );
    // Filtra por arquivadas (view atual) e sobe as fixadas ao topo (sort estável
    // → mantém a ordem por lastMessageTime dentro de cada grupo).
    return buscados
      .filter((chat) => archived.has(chat.phone) === viewArchived)
      .sort((a, b) => (pinned.has(b.phone) ? 1 : 0) - (pinned.has(a.phone) ? 1 : 0));
  }, [chats, search, archived, viewArchived, pinned]);

  const archivedCount = useMemo(
    () => chats.reduce((n, c) => (archived.has(c.phone) ? n + 1 : n), 0),
    [chats, archived],
  );

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.phone === selectedPhone) ?? null,
    [chats, selectedPhone],
  );

  const selectedContact = selectedPhone ? (contacts[selectedPhone] ?? null) : null;

  // Mesma precedência da lista: nome do CRM primeiro (inclui o padrão
  // "<resp> - Resp - <atleta>"), aparelho como fallback.
  const selectedDisplayName =
    selectedChat?.leadName ??
    selectedChat?.name ??
    selectedContact?.name ??
    (selectedPhone ? formatPhoneDisplay(selectedPhone) : "");

  // Nome exibido acessível ao handler do chatbot (fora do render).
  useEffect(() => {
    selectedNameRef.current = selectedDisplayName;
  }, [selectedDisplayName]);

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
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)]",
            selectedPhone && "xl:grid-cols-[minmax(16rem,20rem)_minmax(0,1fr)_19rem]",
          )}
        >
          {/* Lista de conversas */}
          <Card padding="none" className={cn("flex flex-col overflow-hidden", PANEL_HEIGHT)}>
            <div className="shrink-0 space-y-2 border-b border-border p-3">
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
              {(archivedCount > 0 || viewArchived) && (
                <button
                  type="button"
                  onClick={() => setViewArchived((v) => !v)}
                  aria-pressed={viewArchived}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium transition-colors",
                    viewArchived
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <Archive className="size-3.5 shrink-0" />
                  {viewArchived ? "Voltar às conversas" : `Arquivadas (${archivedCount})`}
                </button>
              )}
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
                  icon={viewArchived ? Archive : MessageCircle}
                  title={
                    viewArchived
                      ? "Nenhuma conversa arquivada"
                      : "Nenhuma conversa encontrada"
                  }
                  description={
                    viewArchived
                      ? "Conversas que você arquivar aparecem aqui."
                      : search.trim().length > 0
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
                    unread={
                      chat.phone !== selectedPhone &&
                      (chat.lastInboundAt ?? 0) > (lastSeen[chat.phone] ?? 0)
                    }
                    selected={chat.phone === selectedPhone}
                    pinned={pinned.has(chat.phone)}
                    archived={archived.has(chat.phone)}
                    menuOpen={menuPhone === chat.phone}
                    onSelect={handleSelect}
                    onToggleMenu={(phone) => setMenuPhone((cur) => (cur === phone ? null : phone))}
                    onTogglePin={togglePin}
                    onToggleArchive={toggleArchive}
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
                    name={selectedDisplayName || null}
                    imgUrl={selectedContact?.imgUrl ?? null}
                  />
                  <div className="min-w-0 flex-1">
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
                  {/* Override do chatbot autônomo SÓ desta conversa (CEO-only; a
                      tela 1:1 já é CEO). Não interfere no envio manual/sugestão. */}
                  <ConversaAutonomoToggle
                    key={selectedPhone}
                    phone={selectedPhone}
                    agents={agentsChatbot}
                  />
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

                {recording ? (
                  <div className="flex shrink-0 items-center gap-3 border-t border-border p-3">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Cancelar gravação"
                      onClick={handleCancelRecording}
                    >
                      <Trash2 className="text-sys-red" />
                    </Button>
                    <span className="flex flex-1 items-center gap-2 text-sm text-foreground">
                      <span aria-hidden className="size-2.5 shrink-0 animate-pulse rounded-full bg-sys-red" />
                      <span className="tabular-nums">
                        {Math.floor(recordSeconds / 60)}:{String(recordSeconds % 60).padStart(2, "0")}
                      </span>
                      <span className="text-muted-foreground">Gravando áudio…</span>
                    </span>
                    {/* Parar → abre o modal de revisão p/ ouvir antes de enviar. */}
                    <Button
                      type="button"
                      size="icon"
                      aria-label="Parar e revisar áudio"
                      onClick={handleStopAndSend}
                    >
                      <Send />
                    </Button>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSend}
                    className="flex shrink-0 items-center gap-2 border-t border-border p-3"
                  >
                    <input
                      ref={attachRef}
                      type="file"
                      accept={ATTACH_ACCEPT}
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleAttach(file);
                        event.currentTarget.value = "";
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={attaching || sending}
                      aria-label="Anexar foto ou documento"
                      onClick={() => attachRef.current?.click()}
                    >
                      {attaching ? <Loader2 className="animate-spin" /> : <Paperclip />}
                    </Button>
                    {agentsConversa.length > 0 && (
                      <select
                        value={copilotoId}
                        onChange={(event) => setCopilotoId(event.target.value)}
                        disabled={sugerindo || sending}
                        aria-label="Copiloto usado na sugestão de resposta"
                        title="Copiloto usado na sugestão de resposta"
                        className="h-9 max-w-[8.5rem] shrink-0 rounded-md border border-border bg-card px-2 text-xs text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        <option value="">Copiloto: Padrão</option>
                        {agentsConversa.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                    )}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={sugerindo || sending}
                      aria-label="Sugerir resposta com IA"
                      title="A IA sugere; você revisa e envia."
                      onClick={() => void handleSugerirResposta()}
                    >
                      {sugerindo ? <Loader2 className="animate-spin" /> : <Sparkles />}
                    </Button>
                    <Input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      placeholder="Escreva uma mensagem"
                      aria-label="Mensagem"
                      maxLength={MESSAGE_MAX_LENGTH}
                      disabled={sending}
                    />
                    {draft.trim().length > 0 ? (
                      <Button type="submit" size="icon" disabled={sending} aria-label="Enviar mensagem">
                        <Send />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="icon"
                        disabled={attaching || sending}
                        aria-label="Gravar áudio"
                        onClick={handleStartRecording}
                      >
                        <Mic />
                      </Button>
                    )}
                  </form>
                )}
              </>
            )}
          </Card>

          {/* Painel: métricas da conversa + insights. 3ª coluna em xl; abaixo
              disso empilha em largura total sob o thread (não some). */}
          {selectedPhone && (
            <Card
              padding="none"
              className="flex flex-col overflow-hidden lg:col-span-2 xl:col-span-1 h-[30rem] xl:h-[calc(100vh-13rem)] xl:min-h-[26rem]"
            >
              <ConversaPanel
                metricas={metricas}
                metricasLoading={metricasLoading}
                insights={insights}
                insightsLoading={insightsLoading}
                onGerarInsights={() => void handleInsights()}
                onFecharInsights={() => setInsights(null)}
                agentsAnalise={agentsAnalise}
                phone={selectedPhone}
                lid={phoneToLidRef.current[selectedPhone] ?? undefined}
                leadNome={selectedDisplayName || undefined}
              />
            </Card>
          )}
        </div>
      )}

      {pendingMedia && (
        <MediaPreviewModal
          media={pendingMedia}
          sending={attaching}
          onCaptionChange={(caption) =>
            setPendingMedia((pm) => (pm ? { ...pm, caption } : pm))
          }
          onCancel={cancelPendingMedia}
          onConfirm={confirmSendMedia}
        />
      )}
    </div>
  );
}
