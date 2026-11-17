"use server";

import { redirect } from "next/navigation";

import { getUserProfile } from "@/lib/auth";
import { redirectPermitidoParaConsentimento } from "@/lib/mcp/redirect-consentimento";
import { isCeoLevel } from "@/lib/papel";
import { createServerSupabaseClient } from "@/lib/supabase-server";

// ════════════════════════════════════════════════════════════════════════
// Decisão do consentimento OAuth (conector do Claude → servidor OAuth 2.1 do
// Supabase Auth). "use server" = endpoint público: TODA checagem é refeita
// aqui, nunca confiando no que a tela mostrou.
//   - aprovar: só CEO/CTO ATIVO e só para destino oficial do Claude (claude.ai/
//     claude.com ou loopback do Claude Code) — ver redirect-consentimento.ts;
//   - negar: sempre permitido; só volta ao app se o destino for oficial.
// redirect() lança NEXT_REDIRECT: nunca dentro de try/catch.
// ════════════════════════════════════════════════════════════════════════

const AUTORIZACAO_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const DESTINO_NEUTRO = "/war-room";

function voltarComErro(id: string, erro: string): never {
  redirect(`/oauth/consent?authorization_id=${encodeURIComponent(id)}&erro=${encodeURIComponent(erro)}`);
}

/** Chamada ao Supabase sem lançar (rede/5xx viram `null` + log). */
async function semLancar<T>(acao: string, fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch (e) {
    console.error({ level: "error", action: "oauth_consentimento", etapa: acao, message: e instanceof Error ? e.message : String(e) });
    return null;
  }
}

export async function decidirAutorizacaoOAuth(formData: FormData): Promise<void> {
  const id = String(formData.get("authorization_id") ?? "");
  const decisao = formData.get("decisao");
  if (!AUTORIZACAO_ID_RE.test(id) || (decisao !== "aprovar" && decisao !== "negar")) {
    redirect(DESTINO_NEUTRO);
  }

  const perfil = await semLancar("perfil", () => getUserProfile());
  if (!perfil) redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${id}`)}`);

  const supabase = await createServerSupabaseClient();
  const detalhes = await semLancar("detalhes", () => supabase.auth.oauth.getAuthorizationDetails(id));
  if (!detalhes || detalhes.error || !detalhes.data || !("authorization_id" in detalhes.data)) {
    voltarComErro(id, "expirado");
  }
  const pedido = detalhes.data;
  const destinoOficial = redirectPermitidoParaConsentimento(pedido.redirect_uri);

  if (decisao === "aprovar") {
    if (perfil.ativo === false || !isCeoLevel(perfil.papel)) voltarComErro(id, "papel");
    if (!destinoOficial) voltarComErro(id, "destino");
    const r = await semLancar("aprovar", () => supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true }));
    if (!r || r.error || !r.data || !redirectPermitidoParaConsentimento(r.data.redirect_url, { comParametros: true })) {
      console.error({ level: "error", action: "oauth_consentimento", decisao, usuarioId: perfil.id, message: r?.error?.message });
      voltarComErro(id, "falha");
    }
    console.log({ level: "info", action: "oauth_consentimento", decisao, usuarioId: perfil.id, cliente: pedido.client?.name ?? null });
    redirect(r.data.redirect_url);
  }

  const r = await semLancar("negar", () => supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true }));
  console.log({
    level: "info",
    action: "oauth_consentimento",
    decisao,
    usuarioId: perfil.id,
    cliente: pedido.client?.name ?? null,
    erro: r?.error?.message ?? null,
  });
  const volta =
    r && !r.error && r.data && destinoOficial && redirectPermitidoParaConsentimento(r.data.redirect_url, { comParametros: true })
      ? r.data.redirect_url
      : DESTINO_NEUTRO;
  redirect(volta);
}
