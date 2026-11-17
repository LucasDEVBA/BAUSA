import { isIP } from "node:net";

import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Devolve o IP público de QUEM CHAMOU — usado pelo formulário como sinal de
 * correspondência da API de Conversões do Meta (o formulário posta direto no
 * Supabase, então nenhum servidor nosso vê o IP no envio). Não lê nem grava
 * nada; na Vercel o x-forwarded-for é reescrito pela plataforma com o IP real.
 */
export function GET(req: NextRequest) {
  const bruto =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim() || "";
  const ip = isIP(bruto) !== 0 ? bruto : null;
  return NextResponse.json({ ip }, { headers: { "Cache-Control": "no-store" } });
}
