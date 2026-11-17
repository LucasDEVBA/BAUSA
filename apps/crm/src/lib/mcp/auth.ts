import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ════════════════════════════════════════════════════════════════════════
// Autenticação do conector do Claude (MCP remoto do Engine).
//
// O Claude autentica pelo servidor OAuth 2.1 do PRÓPRIO Supabase Auth (DCR +
// PKCE; consentimento em /oauth/consent). O access token é um JWT do usuário
// do Engine com o claim extra `client_id` — então cada consulta roda com o
// token dele e o RLS vale exatamente como nas telas. Este módulo:
//   1. extrai o Bearer, valida assinatura/expiração (getClaims com o JWKS
//      ES256 do projeto) e confere iss/aud/role/client_id;
//   2. exige papel CEO/CTO ativo (o conector expõe o CRM inteiro);
//   3. responde 401 no formato que o Claude espera (RFC 9728):
//      WWW-Authenticate: Bearer resource_metadata="…".
// ════════════════════════════════════════════════════════════════════════

export const CAMINHO_MCP = "/api/mcp";
export const CAMINHO_METADADOS_RECURSO = "/.well-known/oauth-protected-resource";
const ESCOPOS_SUPORTADOS = ["openid", "email", "profile"] as const;
const BEARER_RE = /^Bearer\s+([A-Za-z0-9._~+/=-]+)$/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAPEIS_PERMITIDOS = new Set(["ceo", "cto"]);
// O servidor OAuth do projeto assina com ES256 (JWKS). Recusar outro alg/sem
// kid ANTES de validar evita ida à rede por token forjado (getClaims cai no
// getUser — chamada ao Supabase Auth — quando não acha a chave).
const ALG_ESPERADO = "ES256";

export interface ContextoMcp {
  supabase: SupabaseClient;
  usuarioId: string;
  clientId: string;
}

type ClaimsJwt = NonNullable<Awaited<ReturnType<SupabaseClient["auth"]["getClaims"]>>["data"]>["claims"];

export type ResultadoAuthMcp = { ok: true; contexto: ContextoMcp } | { ok: false; resposta: Response };

const supabaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL ausente");
  return url.replace(/\/+$/, "");
};

/** Emissor dos tokens do servidor OAuth do Supabase (`iss`). */
export const emissorOAuth = (): string => `${supabaseUrl()}/auth/v1`;

export const urlRecursoMcp = (origem: string): string => `${origem}${CAMINHO_MCP}`;

export const urlMetadadosRecurso = (origem: string): string => `${origem}${CAMINHO_METADADOS_RECURSO}${CAMINHO_MCP}`;

/** RFC 9728 — o Claude usa SÓ o 1º authorization server; `resource` = URL exata do MCP. */
export function metadadosRecursoProtegido(origem: string) {
  return {
    resource: urlRecursoMcp(origem),
    authorization_servers: [emissorOAuth()],
    scopes_supported: [...ESCOPOS_SUPORTADOS],
    bearer_methods_supported: ["header"],
    resource_name: "BAUSA Engine",
  };
}

export function extrairBearer(header: string | null): string | null {
  const m = header?.trim().match(BEARER_RE);
  return m ? m[1] : null;
}

/** Cabeçalho do JWT sem verificar (só para o filtro barato de alg/kid). */
export function cabecalhoJwt(token: string): { alg?: unknown; kid?: unknown } | null {
  const [parte] = token.split(".");
  if (!parte) return null;
  try {
    const json = Buffer.from(parte.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    const h = JSON.parse(json) as unknown;
    return h && typeof h === "object" ? (h as { alg?: unknown; kid?: unknown }) : null;
  } catch {
    return null;
  }
}

/** Falha do Supabase Auth (rede/5xx) — não é token inválido: 503, sem refazer OAuth. */
function ehFalhaTransitoria(erro: unknown): boolean {
  if (!erro || typeof erro !== "object") return false;
  const e = erro as { name?: unknown; status?: unknown };
  return e.name === "AuthRetryableFetchError" || (typeof e.status === "number" && e.status >= 500);
}

function respostaIndisponivel(): Response {
  return new Response(JSON.stringify({ error: "temporarily_unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Retry-After": "30" },
  });
}

export function respostaNaoAutorizado(origem: string, motivo: string, status: 401 | 403 = 401): Response {
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  // 401 = sem token / token inválido → o Claude refaz o OAuth. 403 = autenticado
  // mas sem permissão (papel) → refazer o login não adianta.
  if (status === 401) {
    headers.set("WWW-Authenticate", `Bearer resource_metadata="${urlMetadadosRecurso(origem)}"`);
  }
  return new Response(JSON.stringify({ error: status === 401 ? "invalid_token" : "insufficient_scope", error_description: motivo }), {
    status,
    headers,
  });
}

const audienciaInclui = (aud: unknown, esperado: string): boolean =>
  aud === esperado || (Array.isArray(aud) && aud.includes(esperado));

/** Valida o Bearer do Claude e monta o client Supabase que age COMO o usuário. */
export async function autenticarMcp(req: Request, origem: string): Promise<ResultadoAuthMcp> {
  const token = extrairBearer(req.headers.get("authorization"));
  if (!token) return { ok: false, resposta: respostaNaoAutorizado(origem, "Token ausente.") };
  const cabecalho = cabecalhoJwt(token);
  if (cabecalho?.alg !== ALG_ESPERADO || typeof cabecalho.kid !== "string" || cabecalho.kid.length === 0) {
    return { ok: false, resposta: respostaNaoAutorizado(origem, "Token inválido.") };
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!anonKey) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ausente");

  const supabase = createClient(supabaseUrl(), anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  // getClaims LANÇA com JWT malformado ("Missing exp claim", kid desconhecido)
  // em vez de devolver `error`. Token ruim = 401 (o Claude refaz o OAuth);
  // Supabase Auth fora do ar = 503 (refazer o OAuth no meio da pane não ajuda).
  let claims: ClaimsJwt;
  try {
    const { data, error } = await supabase.auth.getClaims(token);
    if (error && ehFalhaTransitoria(error)) return { ok: false, resposta: respostaIndisponivel() };
    if (error || !data?.claims) return { ok: false, resposta: respostaNaoAutorizado(origem, "Token inválido ou expirado.") };
    claims = data.claims;
  } catch (e) {
    if (ehFalhaTransitoria(e)) return { ok: false, resposta: respostaIndisponivel() };
    return { ok: false, resposta: respostaNaoAutorizado(origem, "Token inválido ou expirado.") };
  }

  const clientId = (claims as Record<string, unknown>).client_id;
  const valido =
    claims.iss === emissorOAuth() &&
    audienciaInclui(claims.aud, "authenticated") &&
    claims.role === "authenticated" &&
    typeof claims.sub === "string" &&
    UUID_RE.test(claims.sub) &&
    // Só token emitido pelo servidor OAuth (tem client_id): um token de
    // sessão do navegador não vira credencial do conector.
    typeof clientId === "string" &&
    clientId.length > 0;
  if (!valido) return { ok: false, resposta: respostaNaoAutorizado(origem, "Token não emitido para o conector.") };

  const perfil = await supabase.from("user_profiles").select("papel, ativo").eq("id", claims.sub).maybeSingle();
  if (perfil.error) {
    console.error({ level: "error", action: "mcp_auth_perfil", usuarioId: claims.sub, message: perfil.error.message });
    throw new Error("Falha ao ler o perfil do usuário");
  }
  const papel = perfil.data?.papel;
  if (!perfil.data || perfil.data.ativo === false || typeof papel !== "string" || !PAPEIS_PERMITIDOS.has(papel)) {
    console.warn({ level: "warn", action: "mcp_auth_negado", usuarioId: claims.sub, clientId, papel: papel ?? null });
    return { ok: false, resposta: respostaNaoAutorizado(origem, "Conector restrito a CEO/CTO ativos.", 403) };
  }

  return { ok: true, contexto: { supabase, usuarioId: claims.sub, clientId } };
}
