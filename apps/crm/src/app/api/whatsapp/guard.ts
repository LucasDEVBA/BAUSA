import { NextResponse } from "next/server";

import { getUserPapel } from "@/lib/auth";
import { getZapiConfig, type ZapiConfig } from "@/lib/zapi-server";

export type WhatsAppApiGuard = { config: ZapiConfig } | { response: NextResponse };

/**
 * Guard comum das rotas /api/whatsapp/*:
 * 1. Autorização — só CEO (cto resolve p/ ceo em getUserPapel) → 403.
 * 2. Credenciais Z-API presentes → senão 503 `zapi_nao_configurado`
 *    (a UI mostra o estado de setup em vez de UI falsa).
 */
export async function guardWhatsAppApi(): Promise<WhatsAppApiGuard> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return {
      response: NextResponse.json({ error: "nao_autorizado" }, { status: 403 }),
    };
  }

  const config = getZapiConfig();
  if (!config) {
    return {
      response: NextResponse.json({ error: "zapi_nao_configurado" }, { status: 503 }),
    };
  }

  return { config };
}
