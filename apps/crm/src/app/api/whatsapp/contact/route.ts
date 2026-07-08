import { type NextRequest, NextResponse } from "next/server";

import {
  cleanPhone,
  isValidPhone,
  maskPhone,
  normalizeContact,
} from "@/lib/whatsapp-espelho";
import { logZapi, zapiRequest } from "@/lib/zapi-server";

import { guardWhatsAppApi } from "../guard";

export const dynamic = "force-dynamic";

/**
 * GET /api/whatsapp/contact?phone= — metadados do contato via Z-API
 * (/contacts/{phone}: nome, "about" e foto de perfil). Fallback para
 * /profile-picture quando o imgUrl não vem no contato.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const guard = await guardWhatsAppApi();
  if ("response" in guard) return guard.response;

  const phone = cleanPhone(request.nextUrl.searchParams.get("phone") ?? "");
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "telefone_invalido" }, { status: 400 });
  }

  try {
    const result = await zapiRequest(guard.config, `/contacts/${phone}`);
    const contact = normalizeContact(result.ok ? result.data : null);

    // Foto pode não vir em /contacts (privacidade/cache) — tenta o endpoint dedicado.
    if (!contact.imgUrl) {
      try {
        const pic = await zapiRequest(guard.config, `/profile-picture?phone=${phone}`);
        const link =
          pic.ok && typeof (pic.data as { link?: unknown } | null)?.link === "string"
            ? ((pic.data as { link: string }).link.trim() || null)
            : null;
        contact.imgUrl = link;
      } catch {
        // Foto é enriquecimento — falha aqui não derruba o contato.
      }
    }

    return NextResponse.json({ contact });
  } catch (error) {
    logZapi("error", "contact_request_failed", {
      phone: maskPhone(phone),
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "zapi_indisponivel" }, { status: 502 });
  }
}
