import { type NextRequest, NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import {
  cleanPhone,
  isValidPhone,
  maskPhone,
  normalizeMessage,
  type EspelhoMessage,
} from "@/lib/whatsapp-espelho";
import { logZapi, zapiRequest } from "@/lib/zapi-server";

import { guardWhatsAppApi } from "../guard";

export const dynamic = "force-dynamic";

const MESSAGES_AMOUNT = 60;
const MIRROR_LIMIT = 200;

interface MirrorRow {
  message_id: string;
  phone: string;
  from_me: boolean;
  texto: string | null;
  momment: string | null;
}

/**
 * GET /api/whatsapp/messages?phone= — histórico da conversa.
 * Fonte primária: espelho próprio (whatsapp_mensagens, alimentado pelo webhook
 * da Z-API via CF zapi-inbox) — a instância multi-device não fornece histórico
 * por API. Fallback: Z-API direto (tabela ausente pré-migration).
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await guardWhatsAppApi();
  if ("response" in guard) return guard.response;

  const phone = cleanPhone(request.nextUrl.searchParams.get("phone") ?? "");
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "telefone_invalido" }, { status: 400 });
  }

  // ── Fonte primária: espelho no banco ──
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("whatsapp_mensagens")
      .select("message_id, phone, from_me, texto, momment")
      .eq("phone", phone)
      .order("momment", { ascending: true })
      .limit(MIRROR_LIMIT);

    if (!error) {
      const messages: EspelhoMessage[] = ((data as MirrorRow[] | null) ?? []).map(
        (row) => ({
          id: row.message_id,
          phone: row.phone,
          fromMe: row.from_me,
          text: row.texto,
          timestamp: row.momment ? Date.parse(row.momment) : null,
        }),
      );
      logZapi("info", "messages_mirror_listed", {
        phone: maskPhone(phone),
        count: messages.length,
      });
      return NextResponse.json({ messages, mirror: true });
    }
    // Tabela ausente/erro → cai no fallback Z-API abaixo.
    logZapi("warn", "messages_mirror_error", { code: error.code ?? "unknown" });
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
