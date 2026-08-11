import { type NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  cleanPhone,
  isValidPhone,
  maskPhone,
  normalizeMessage,
  type EspelhoMessage,
  type MensagemTipo,
} from "@/lib/whatsapp-espelho";
import { logZapi, zapiRequest } from "@/lib/zapi-server";

import { guardWhatsAppApi } from "../guard";

export const dynamic = "force-dynamic";

const MESSAGES_AMOUNT = 60;
const MIRROR_LIMIT = 200;
/** Erros estruturais pré-migration → degradar p/ fallback (não 502): tabela
 *  ausente (42P01), coluna ausente (42703), cache de schema PostgREST (PGRST204). */
const PRE_MIGRATION_CODES = new Set(["42P01", "42703", "PGRST204"]);

interface MirrorRow {
  message_id: string;
  phone: string;
  from_me: boolean;
  texto: string | null;
  momment: string | null;
  tipo: MensagemTipo | null;
  media_url: string | null;
  mime_type: string | null;
  media_filename: string | null;
  /** Path no bucket próprio (whatsapp-midia) — permanente; preferido sobre media_url. */
  media_path: string | null;
}

const MEDIA_BUCKET = "whatsapp-midia";
const SIGNED_URL_TTL_S = 3600;

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * URLs assinadas (1h) para as mensagens re-hospedadas no bucket próprio.
 * As media_url da Z-API EXPIRAM em ~semanas — media_path é a fonte durável.
 * Fail-open: qualquer erro devolve mapa vazio e a UI cai na media_url legada.
 */
async function assinarMidias(
  supabase: SupabaseServer,
  rows: { media_path: string | null }[],
): Promise<Map<string, string>> {
  const paths = [...new Set(rows.map((r) => r.media_path).filter((p): p is string => Boolean(p)))];
  if (paths.length === 0) return new Map();
  try {
    const { data, error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL_S);
    if (error || !data) {
      logZapi("warn", "midia_sign_failed", { count: paths.length });
      return new Map();
    }
    const map = new Map<string, string>();
    for (const item of data) {
      if (item.path && item.signedUrl && !item.error) map.set(item.path, item.signedUrl);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** mediaUrl efetivo da linha: assinada do bucket próprio > legada da Z-API. */
function resolverMediaUrl(row: MirrorRow, assinadas: Map<string, string>): string | null {
  return (row.media_path && assinadas.get(row.media_path)) || row.media_url;
}

/**
 * GET /api/whatsapp/messages?phone= — histórico da conversa.
 * Fonte primária: espelho próprio (whatsapp_mensagens, alimentado pelo webhook
 * da Z-API via CF zapi-inbox) — a instância multi-device não fornece histórico
 * por API. Fallback: Z-API direto (tabela ausente pré-migration).
 */
/** grupo_id no formato do banco (sem @g.us) — mesmo padrão da zapi-inbox. */
const GROUP_ID_DB_RE = /^[\d-]{5,40}$/;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await guardWhatsAppApi();
  if ("response" in guard) return guard.response;

  // ── Thread de GRUPO (?groupId=) — espelho only, sem fallback Z-API ──
  const groupIdRaw = (request.nextUrl.searchParams.get("groupId") ?? "").replace(/@g\.us$/i, "");
  if (groupIdRaw) {
    if (!GROUP_ID_DB_RE.test(groupIdRaw)) {
      return NextResponse.json({ error: "grupo_invalido" }, { status: 400 });
    }
    try {
      const supabase = await createServerSupabaseClient();
      const selecionarGrupo = (comMediaPath: boolean) =>
        supabase
          .from("whatsapp_mensagens")
          .select(
            comMediaPath
              ? "message_id, phone, from_me, texto, momment, tipo, media_url, mime_type, media_filename, media_path, participante_nome"
              : "message_id, phone, from_me, texto, momment, tipo, media_url, mime_type, media_filename, participante_nome",
          )
          .eq("grupo_id", groupIdRaw)
          .eq("is_grupo", true)
          .order("momment", { ascending: false, nullsFirst: false })
          .limit(MIRROR_LIMIT);

      let { data, error } = await selecionarGrupo(true);
      // Janela pré-migration: coluna media_path ainda ausente → re-tenta sem ela
      if (error && PRE_MIGRATION_CODES.has(error.code ?? "")) {
        ({ data, error } = await selecionarGrupo(false));
      }

      if (error) {
        logZapi("warn", "group_messages_mirror_error", { code: error.code ?? "unknown" });
        return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
      }

      const rows = ((data as unknown as (MirrorRow & { participante_nome: string | null })[] | null) ?? []).map(
        (r) => ({ ...r, media_path: r.media_path ?? null }),
      );
      const assinadas = await assinarMidias(supabase, rows);
      const messages: EspelhoMessage[] = rows
        .map((row) => ({
          id: row.message_id,
          phone: row.phone,
          fromMe: row.from_me,
          text: row.texto,
          timestamp: row.momment ? Date.parse(row.momment) : null,
          tipo: (row.tipo ?? "text") as MensagemTipo,
          mediaUrl: resolverMediaUrl(row, assinadas),
          mimeType: row.mime_type,
          fileName: row.media_filename,
          senderName: row.participante_nome,
        }))
        .reverse();
      logZapi("info", "group_messages_mirror_listed", { count: messages.length });
      return NextResponse.json({ messages, mirror: true });
    } catch {
      return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
    }
  }

  const phone = cleanPhone(request.nextUrl.searchParams.get("phone") ?? "");
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "telefone_invalido" }, { status: 400 });
  }
  // O WhatsApp novo endereça por LID: o webhook às vezes grava a mensagem sob o
  // LID da conversa (não o telefone). A thread casa por telefone OU lid.
  const lid = cleanPhone(request.nextUrl.searchParams.get("lid") ?? "");
  const chaves = lid && lid !== phone ? [phone, lid] : [phone];

  // ── Fonte primária: espelho no banco ──
  try {
    const supabase = await createServerSupabaseClient();
    // DESC + reverse: pega as N mais RECENTES (asc pegaria as mais antigas e
    // congelaria a thread quando a conversa passasse do limite).
    const selecionarEspelho = (comMediaPath: boolean) =>
      supabase
        .from("whatsapp_mensagens")
        .select(
          comMediaPath
            ? "message_id, phone, from_me, texto, momment, tipo, media_url, mime_type, media_filename, media_path"
            : "message_id, phone, from_me, texto, momment, tipo, media_url, mime_type, media_filename",
        )
        .in("phone", chaves)
        .eq("is_grupo", false) // espelho 1:1 — mensagens de grupo têm sua própria thread (coletor)
        .order("momment", { ascending: false, nullsFirst: false })
        .limit(MIRROR_LIMIT);

    let { data, error } = await selecionarEspelho(true);
    // Coluna media_path ausente (janela pré-migration) → re-tenta SEM ela antes
    // de degradar p/ Z-API — senão o histórico espelhado sumiria da UI na janela.
    if (error && PRE_MIGRATION_CODES.has(error.code ?? "")) {
      ({ data, error } = await selecionarEspelho(false));
    }

    if (!error) {
      const rows = ((data as unknown as MirrorRow[] | null) ?? []).map((r) => ({
        ...r,
        media_path: r.media_path ?? null,
      }));
      const assinadas = await assinarMidias(supabase, rows);
      const messages: EspelhoMessage[] = rows
        .map((row) => ({
          id: row.message_id,
          phone: row.phone,
          fromMe: row.from_me,
          text: row.texto,
          timestamp: row.momment ? Date.parse(row.momment) : null,
          tipo: (row.tipo ?? "text") as MensagemTipo,
          mediaUrl: resolverMediaUrl(row, assinadas),
          mimeType: row.mime_type,
          fileName: row.media_filename,
        }))
        .reverse();
      logZapi("info", "messages_mirror_listed", {
        phone: maskPhone(phone),
        count: messages.length,
      });
      return NextResponse.json({ messages, mirror: true });
    }

    // Cai no fallback Z-API só em erro estrutural pré-migration: tabela ausente
    // (42P01) OU coluna ausente (42703 / cache PostgREST PGRST204) — janela em
    // que o Engine subiu antes da migration de mídia aplicar. Erro transitório
    // não pode virar o aviso multi-device na UI → 502 genérico.
    logZapi("warn", "messages_mirror_error", { code: error.code ?? "unknown" });
    if (!PRE_MIGRATION_CODES.has(error.code ?? "")) {
      return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
    }
  } catch {
    // Falha no client Supabase — segue para o fallback.
  }

  try {
    const result = await zapiRequest(
      guard.config,
      `/chat-messages/${phone}?amount=${MESSAGES_AMOUNT}`,
    );

    if (!result.ok) {
      // Instâncias multi-device da Z-API não expõem histórico por API
      // (400 "Does not work in multi device version") — limitação permanente
      // do plano, não instabilidade. A UI mostra o estado honesto em vez de
      // "tente novamente".
      const zapiError =
        typeof (result.data as { error?: unknown } | null)?.error === "string"
          ? (result.data as { error: string }).error
          : "";
      if (result.status === 400 && zapiError.toLowerCase().includes("multi device")) {
        logZapi("info", "messages_history_unavailable_multidevice", {
          phone: maskPhone(phone),
        });
        return NextResponse.json({ messages: [], historyUnavailable: true });
      }

      logZapi("error", "messages_zapi_error", {
        phone: maskPhone(phone),
        zapiStatus: result.status,
      });
      return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
    }

    const rawList = Array.isArray(result.data) ? result.data : [];
    const messages = rawList
      .map((raw, index) => normalizeMessage(raw, index))
      .filter((message): message is EspelhoMessage => message !== null)
      .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

    logZapi("info", "messages_listed", {
      phone: maskPhone(phone),
      count: messages.length,
    });
    return NextResponse.json({ messages });
  } catch (error) {
    logZapi("error", "messages_request_failed", {
      phone: maskPhone(phone),
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "zapi_indisponivel" }, { status: 502 });
  }
}
