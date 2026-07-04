import { type NextRequest, NextResponse } from "next/server";

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

/** GET /api/whatsapp/messages?phone= — histórico da conversa via Z-API. */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await guardWhatsAppApi();
  if ("response" in guard) return guard.response;

  const phone = cleanPhone(request.nextUrl.searchParams.get("phone") ?? "");
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "telefone_invalido" }, { status: 400 });
  }

  try {
    const result = await zapiRequest(
      guard.config,
      `/chat-messages/${phone}?amount=${MESSAGES_AMOUNT}`,
    );

    if (!result.ok) {
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
