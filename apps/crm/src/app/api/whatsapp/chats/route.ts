import { NextResponse } from "next/server";

import { normalizeChat, type EspelhoChat } from "@/lib/whatsapp-espelho";
import { logZapi, zapiRequest } from "@/lib/zapi-server";

import { guardWhatsAppApi } from "../guard";

export const dynamic = "force-dynamic";

const CHATS_PAGE_SIZE = 60;

/** GET /api/whatsapp/chats — lista de conversas via Z-API (proxy server-side). */
export async function GET(): Promise<NextResponse> {
  const guard = await guardWhatsAppApi();
  if ("response" in guard) return guard.response;

  try {
    const result = await zapiRequest(
      guard.config,
      `/chats?page=1&pageSize=${CHATS_PAGE_SIZE}`,
    );

    if (!result.ok) {
      logZapi("error", "chats_zapi_error", { zapiStatus: result.status });
      return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
    }

    const rawList = Array.isArray(result.data) ? result.data : [];
    const chats = rawList
      .map(normalizeChat)
      .filter((chat): chat is EspelhoChat => chat !== null)
      .sort((a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0));

    logZapi("info", "chats_listed", { count: chats.length });
    return NextResponse.json({ chats });
  } catch (error) {
    logZapi("error", "chats_request_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "zapi_indisponivel" }, { status: 502 });
  }
}
