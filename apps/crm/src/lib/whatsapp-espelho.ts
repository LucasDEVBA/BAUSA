/**
 * Espelho do WhatsApp — tipos e normalizadores dos payloads da Z-API.
 *
 * Os shapes reais da Z-API variam entre endpoints/versões: o timestamp de
 * mensagem chama `momment` (com dois "m"), o texto vem em `text.message` ou
 * `body`, e campos numéricos/booleanos chegam como string. Estes adapters são
 * deliberadamente defensivos — toleram campos ausentes ou com tipo inesperado
 * e NUNCA lançam por shape estranho (mensagem não-texto vira `text: null`,
 * que a UI exibe como "[mídia]").
 *
 * Módulo puro (sem dependências de server/client) — usado pelas API routes
 * e pela tela /whatsapp.
 */

export interface EspelhoChat {
  /** Telefone só-dígitos com DDI — chave da conversa na Z-API. */
  phone: string;
  /** Nome do contato, quando a Z-API informa. */
  name: string | null;
  /** Epoch em ms da última mensagem, quando disponível. */
  lastMessageTime: number | null;
  /** Preview textual da última mensagem, quando disponível. */
  lastMessagePreview: string | null;
  /** Quantidade de mensagens não lidas. */
  unread: number;
}

export interface EspelhoMessage {
  id: string;
  phone: string;
  fromMe: boolean;
  /** Texto da mensagem; `null` quando é mídia/tipo não-texto. */
  text: string | null;
  /** Epoch em ms, quando disponível. */
  timestamp: number | null;
}

const PHONE_MIN_DIGITS = 10;
const PHONE_MAX_DIGITS = 15;
const MASKED_VISIBLE_DIGITS = 4;
/** Abaixo disso o epoch está em segundos (Z-API alterna entre s e ms). */
const EPOCH_MS_THRESHOLD = 1_000_000_000_000;

// ─── Coerções defensivas ─────────────────────────────────────────

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function toEpochMs(value: unknown): number | null {
  const num =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isFinite(num) || num <= 0) return null;
  return num < EPOCH_MS_THRESHOLD ? Math.round(num * 1000) : Math.round(num);
}

function toBool(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function toCount(value: unknown): number {
  const num =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : 0;
}

// ─── Telefone ────────────────────────────────────────────────────

/** Remove tudo que não é dígito. */
export function cleanPhone(input: string): string {
  return input.replace(/\D/g, "");
}

/** Válido = 10 a 15 dígitos (E.164 sem o `+`). Exclui grupos/broadcast da Z-API. */
export function isValidPhone(digits: string): boolean {
  return /^\d+$/.test(digits) && digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS;
}

/** Mascara para logs — só os últimos 4 dígitos visíveis. */
export function maskPhone(input: string): string {
  const digits = cleanPhone(input);
  if (digits.length <= MASKED_VISIBLE_DIGITS) return "***";
  return `***${digits.slice(-MASKED_VISIBLE_DIGITS)}`;
}

/** Formata para exibição: BR vira +55 (XX) XXXXX-XXXX; demais DDIs ficam +<dígitos>. */
export function formatPhoneDisplay(input: string): string {
  const digits = cleanPhone(input);
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    const split = rest.length - 4;
    return `+55 (${ddd}) ${rest.slice(0, split)}-${rest.slice(split)}`;
  }
  return digits.length > 0 ? `+${digits}` : input;
}

// ─── Normalizadores Z-API ────────────────────────────────────────

/**
 * Normaliza um item de GET /chats. Retorna `null` para entradas sem telefone
 * individual válido (grupos, broadcast, shapes inesperados).
 */
export function normalizeChat(raw: unknown): EspelhoChat | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const phone = cleanPhone(asNonEmptyString(rec.phone) ?? "");
  if (!isValidPhone(phone) || toBool(rec.isGroup)) return null;

  const lastMessage = asRecord(rec.lastMessage);
  const lastMessagePreview =
    asNonEmptyString(lastMessage?.message) ??
    asNonEmptyString(rec.lastMessage) ??
    asNonEmptyString(rec.messagePreview);

  return {
    phone,
    name: asNonEmptyString(rec.name),
    lastMessageTime: toEpochMs(rec.lastMessageTime) ?? toEpochMs(rec.messageTime),
    lastMessagePreview,
    unread: toCount(rec.unread) || toCount(rec.messagesUnread),
  };
}

/**
 * Normaliza um item de GET /chat-messages/{phone}. Retorna `null` só para
 * shapes irrecuperáveis (não-objeto); mensagem não-texto vira `text: null`.
 */
export function normalizeMessage(raw: unknown, index: number): EspelhoMessage | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const textRec = asRecord(rec.text);
  const text = asNonEmptyString(textRec?.message) ?? asNonEmptyString(rec.body);
  const timestamp = toEpochMs(rec.momment) ?? toEpochMs(rec.timestamp);

  return {
    id:
      asNonEmptyString(rec.messageId) ??
      asNonEmptyString(rec.id) ??
      `msg-${index}-${timestamp ?? "sem-ts"}`,
    phone: cleanPhone(asNonEmptyString(rec.phone) ?? ""),
    fromMe: toBool(rec.fromMe),
    text,
    timestamp,
  };
}
