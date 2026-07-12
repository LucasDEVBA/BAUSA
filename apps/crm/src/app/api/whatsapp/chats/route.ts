import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { normalizeChat, type EspelhoChat } from "@/lib/whatsapp-espelho";
import {
  construirMapaNomes,
  resolverNomeLead,
  type AtletaLookupRow,
  type ResponsavelLookupRow,
} from "@/lib/whatsapp-lead-lookup";
import { logZapi, zapiRequest } from "@/lib/zapi-server";

import { guardWhatsAppApi } from "../guard";

export const dynamic = "force-dynamic";

const CHATS_PAGE_SIZE = 60;

/**
 * Enriquece os chats com dados do CRM/espelho, tolerante a falha (a lista da
 * Z-API é o essencial; nome de lead e não-lida são bônus). Nunca lança.
 */
async function enriquecer(chats: EspelhoChat[]): Promise<EspelhoChat[]> {
  if (chats.length === 0) return chats;
  try {
    const supabase = await createServerSupabaseClient();
    // Telefones + LIDs: o webhook grava mensagens sob qualquer um dos dois.
    const chaves = [
      ...new Set(chats.flatMap((c) => [c.phone, c.lid].filter((k): k is string => !!k))),
    ];

    const [atletasRes, respRes, inboundRes] = await Promise.all([
      supabase.from("atletas").select("nome_completo, whatsapp, responsavel_id"),
      supabase.from("responsaveis").select("id, nome, whatsapp"),
      // Última RECEBIDA por chave (p/ badge de não-lida no Engine).
      supabase
        .from("whatsapp_mensagens")
        .select("phone, momment")
        .in("phone", chaves)
        .eq("from_me", false)
        .eq("is_grupo", false) // badge de não-lida é do 1:1 — ignora mensagens de grupo
        .order("momment", { ascending: false }),
    ]);

    const mapaNomes = construirMapaNomes(
      (atletasRes.data as AtletaLookupRow[] | null) ?? [],
      (respRes.data as ResponsavelLookupRow[] | null) ?? [],
    );

    const lastInbound = new Map<string, number>();
    for (const row of (inboundRes.data as { phone: string; momment: string | null }[] | null) ??
      []) {
      if (lastInbound.has(row.phone)) continue; // já ordenado desc → 1º = mais recente
      const ts = row.momment ? Date.parse(row.momment) : NaN;
      if (Number.isFinite(ts)) lastInbound.set(row.phone, ts);
    }

    // Maior timestamp entre o telefone e o LID da conversa.
    const inboundDoChat = (c: EspelhoChat): number | null => {
      const porTelefone = lastInbound.get(c.phone);
      const porLid = c.lid ? lastInbound.get(c.lid) : undefined;
      const maior = Math.max(porTelefone ?? 0, porLid ?? 0);
      return maior > 0 ? maior : null;
    };

    return chats.map((c) => ({
      ...c,
      leadName: resolverNomeLead(mapaNomes, c.phone),
      lastInboundAt: inboundDoChat(c),
    }));
  } catch (error) {
    logZapi("warn", "chats_enrich_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return chats;
  }
}

/** GET /api/whatsapp/chats — lista de conversas via Z-API + enriquecimento CRM. */
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
    const base = rawList
      .map(normalizeChat)
      .filter((chat): chat is EspelhoChat => chat !== null)
      .sort((a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0));

    const chats = await enriquecer(base);

    logZapi("info", "chats_listed", { count: chats.length });
    return NextResponse.json({ chats });
  } catch (error) {
    logZapi("error", "chats_request_failed", {
      reason: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "zapi_indisponivel" }, { status: 502 });
  }
}
