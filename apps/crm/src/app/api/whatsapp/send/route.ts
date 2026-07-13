import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cleanPhone, isValidPhone, maskPhone } from "@/lib/whatsapp-espelho";
import { logZapi, zapiRequest } from "@/lib/zapi-server";

import { guardWhatsAppApi, guardWhatsAppGrupoEnvio } from "../guard";

export const dynamic = "force-dynamic";

const MESSAGE_MAX_LENGTH = 4096;
const FILENAME_MAX = 255;
const URL_MAX = 2048;

/** grupo_id da Z-API (ex.: 120363...@g.us) — dígitos/hífen + sufixo @g.us. */
const GROUP_ID_RE = /^[\d-]{5,40}@g\.us$/i;

const groupTextSchema = z.object({
  groupId: z.string().trim().regex(GROUP_ID_RE, "grupo_invalido"),
  message: z.string().min(1, "mensagem_obrigatoria").max(MESSAGE_MAX_LENGTH, "mensagem_muito_longa"),
});

/** Mascara o grupo_id p/ log (só o miolo final, sem vazar o id inteiro). */
function maskGroup(groupId: string): string {
  const core = groupId.split("@")[0];
  return core.length <= 4 ? "grupo:***" : `grupo:***${core.slice(-4)}`;
}

/**
 * Envio a GRUPO (texto). O `groupId` é passado CRU para a Z-API — nunca
 * normalizado como E.164 (cleanPhone/isValidPhone rejeitariam o @g.us e o id
 * de 18 dígitos). Permissão: CEO sempre; Head só p/ grupo vinculado (validado
 * no guardWhatsAppGrupoEnvio via RLS).
 */
async function handleGroupSend(body: Record<string, unknown>): Promise<NextResponse> {
  const parsed = groupTextSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "dados_invalidos" },
      { status: 400 },
    );
  }
  const { groupId, message } = parsed.data;

  const guard = await guardWhatsAppGrupoEnvio(groupId);
  if ("response" in guard) return guard.response;

  try {
    // phone = grupo_id CRU (sem normalização) — a Z-API endereça grupo pelo jid.
    const result = await zapiRequest(guard.config, "/send-text", {
      method: "POST",
      body: { phone: groupId, message },
    });

    if (!result.ok) {
      logZapi("error", "send_group_zapi_error", {
        group: maskGroup(groupId),
        zapiStatus: result.status,
      });
      return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
    }

    const data =
      typeof result.data === "object" && result.data !== null
        ? (result.data as Record<string, unknown>)
        : null;
    const messageId = typeof data?.messageId === "string" ? data.messageId : null;

    logZapi("info", "group_message_sent", { group: maskGroup(groupId), messageLength: message.length });
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    logZapi("error", "send_group_request_failed", {
      group: maskGroup(groupId),
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "zapi_indisponivel" }, { status: 502 });
  }
}

const phoneField = z
  .string()
  .min(1, "telefone_obrigatorio")
  .transform(cleanPhone)
  .refine(isValidPhone, "telefone_invalido");

const urlHttp = z
  .string()
  .trim()
  .max(URL_MAX, "url_muito_longa")
  .refine((v) => /^https?:\/\//i.test(v), "url_invalida");

const textSchema = z.object({
  phone: phoneField,
  message: z.string().min(1, "mensagem_obrigatoria").max(MESSAGE_MAX_LENGTH, "mensagem_muito_longa"),
});
const imageSchema = z.object({
  phone: phoneField,
  imageUrl: urlHttp,
  caption: z.string().max(MESSAGE_MAX_LENGTH).optional(),
});
const documentSchema = z.object({
  phone: phoneField,
  documentUrl: urlHttp,
  fileName: z.string().max(FILENAME_MAX).optional(),
});
const audioSchema = z.object({
  phone: phoneField,
  audioUrl: urlHttp,
});

/** Extensão do arquivo p/ o path da Z-API /send-document/{ext}. Default: pdf. */
function extensao(fileName: string | undefined): string {
  const m = (fileName ?? "").toLowerCase().match(/\.([a-z0-9]{1,8})$/);
  return m ? m[1] : "pdf";
}

/**
 * POST /api/whatsapp/send — proxy server-side de envio via Z-API.
 * Despacha por presença de mídia: `imageUrl` → /send-image; `documentUrl` →
 * /send-document/{ext}; senão `message` → /send-text.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    const raw = await request.json();
    body = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  // Envio a GRUPO (grupo_id CRU, sem E.164) — guard próprio (CEO ou Head
  // vinculado). Roteado ANTES do guard 1:1 (que é CEO-only e normaliza phone).
  if (body.groupId !== undefined) {
    return handleGroupSend(body);
  }

  const guard = await guardWhatsAppApi();
  if ("response" in guard) return guard.response;

  let path: string;
  let zbody: Record<string, unknown>;
  let phone: string;
  let logMeta: Record<string, unknown>;

  const invalido = (issue?: string) =>
    NextResponse.json({ error: issue ?? "dados_invalidos" }, { status: 400 });

  if (body.imageUrl !== undefined) {
    const parsed = imageSchema.safeParse(body);
    if (!parsed.success) return invalido(parsed.error.issues[0]?.message);
    phone = parsed.data.phone;
    path = "/send-image";
    zbody = { phone, image: parsed.data.imageUrl, caption: parsed.data.caption ?? "" };
    logMeta = { kind: "image" };
  } else if (body.audioUrl !== undefined) {
    const parsed = audioSchema.safeParse(body);
    if (!parsed.success) return invalido(parsed.error.issues[0]?.message);
    phone = parsed.data.phone;
    path = "/send-audio";
    zbody = { phone, audio: parsed.data.audioUrl };
    logMeta = { kind: "audio" };
  } else if (body.documentUrl !== undefined) {
    const parsed = documentSchema.safeParse(body);
    if (!parsed.success) return invalido(parsed.error.issues[0]?.message);
    phone = parsed.data.phone;
    const ext = extensao(parsed.data.fileName);
    path = `/send-document/${ext}`;
    zbody = { phone, document: parsed.data.documentUrl, fileName: parsed.data.fileName ?? `documento.${ext}` };
    logMeta = { kind: "document", ext };
  } else {
    const parsed = textSchema.safeParse(body);
    if (!parsed.success) return invalido(parsed.error.issues[0]?.message);
    phone = parsed.data.phone;
    path = "/send-text";
    zbody = { phone, message: parsed.data.message };
    logMeta = { kind: "text", messageLength: parsed.data.message.length };
  }

  try {
    const result = await zapiRequest(guard.config, path, { method: "POST", body: zbody });

    if (!result.ok) {
      logZapi("error", "send_zapi_error", {
        phone: maskPhone(phone),
        zapiStatus: result.status,
        ...logMeta,
      });
      return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
    }

    const data =
      typeof result.data === "object" && result.data !== null
        ? (result.data as Record<string, unknown>)
        : null;
    const messageId = typeof data?.messageId === "string" ? data.messageId : null;

    // Nunca logar o conteúdo — só metadados.
    logZapi("info", "message_sent", { phone: maskPhone(phone), ...logMeta });
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    logZapi("error", "send_request_failed", {
      phone: maskPhone(phone),
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "zapi_indisponivel" }, { status: 502 });
  }
}
