import { NextResponse } from "next/server";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getZapiConfig, type ZapiConfig } from "@/lib/zapi-server";

export type WhatsAppApiGuard = { config: ZapiConfig } | { response: NextResponse };

/**
 * Guard comum das rotas /api/whatsapp/* de conversa 1:1:
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

/**
 * Guard do ENVIO a um GRUPO (grupo_id, ex.: 120363...@g.us):
 * 1. Papel CEO ou Head de Sucesso → senão 403.
 * 2. O grupo tem de ser VISÍVEL ao usuário — SELECT em whatsapp_grupos via
 *    client autenticado (RLS): o CEO enxerga qualquer grupo; o Head só os
 *    VINCULADOS a uma família (policy `whatsapp_grupos_head_select`). Grupo
 *    não visível → 403. Isso impõe no servidor "CEO sempre; Head só vinculado".
 * 3. Credenciais Z-API presentes → senão 503.
 *
 * Recebe o grupo_id no formato do BANCO (sem @g.us — cleanGroupId da
 * zapi-inbox). O sufixo do jid é responsabilidade do caller (rota de envio).
 * NUNCA normalizar como E.164.
 */
export async function guardWhatsAppGrupoEnvio(grupoId: string): Promise<WhatsAppApiGuard> {
  const papel = await getUserPapel();
  if (papel !== "ceo" && papel !== "head_sucesso") {
    return { response: NextResponse.json({ error: "nao_autorizado" }, { status: 403 }) };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase
      .from("whatsapp_grupos")
      .select("grupo_id")
      .eq("grupo_id", grupoId)
      .is("deleted_at", null)
      .maybeSingle();
    // RLS já filtra o escopo: linha ausente = sem permissão p/ este grupo.
    if (!data) {
      return { response: NextResponse.json({ error: "grupo_nao_autorizado" }, { status: 403 }) };
    }
  } catch {
    return { response: NextResponse.json({ error: "grupo_indisponivel" }, { status: 502 }) };
  }

  const config = getZapiConfig();
  if (!config) {
    return { response: NextResponse.json({ error: "zapi_nao_configurado" }, { status: 503 }) };
  }

  return { config };
}
