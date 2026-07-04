import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { cleanPhone, isValidPhone, maskPhone } from "@/lib/whatsapp-espelho";
import { logZapi, zapiRequest } from "@/lib/zapi-server";

import { guardWhatsAppApi } from "../guard";

export const dynamic = "force-dynamic";

const MESSAGE_MAX_LENGTH = 4096;

const sendSchema = z.object({
  phone: z
    .string()
    .min(1, "telefone_obrigatorio")
    .transform(cleanPhone)
    .refine(isValidPhone, "telefone_invalido"),
  message: z
    .string()
    .min(1, "mensagem_obrigatoria")
    .max(MESSAGE_MAX_LENGTH, "mensagem_muito_longa"),
});

/** POST /api/whatsapp/send — envia texto via Z-API /send-text (proxy server-side). */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const guard = await guardWhatsAppApi();
  if ("response" in guard) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "json_invalido" }, { status: 400 });
  }

  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "dados_invalidos" },
      { status: 400 },
    );
  }

  const { phone, message } = parsed.data;

  try {
    const result = await zapiRequest(guard.config, "/send-text", {
      method: "POST",
      body: { phone, message },
    });

    if (!result.ok) {
      logZapi("error", "send_zapi_error", {
        phone: maskPhone(phone),
        zapiStatus: result.status,
      });
      return NextResponse.json({ error: "zapi_erro" }, { status: 502 });
    }

    const data =
      typeof result.data === "object" && result.data !== null
        ? (result.data as Record<string, unknown>)
        : null;
    const messageId = typeof data?.messageId === "string" ? data.messageId : null;

    // Nunca logar o conteúdo da mensagem — só metadados.
    logZapi("info", "message_sent", {
      phone: maskPhone(phone),
      messageLength: message.length,
    });
    return NextResponse.json({ success: true, messageId });
  } catch (error) {
    logZapi("error", "send_request_failed", {
      phone: maskPhone(phone),
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "zapi_indisponivel" }, { status: 502 });
  }
}
