/**
 * Para onde a tela /oauth/consent aceita mandar um código de autorização.
 *
 * Com o registro dinâmico (DCR) ligado no Supabase, QUALQUER app pode se
 * registrar como cliente OAuth. Sem esta trava, um link de phishing ("clique
 * para conectar") faria o CEO aprovar um app de terceiro que passaria a ler o
 * CRM inteiro com o token dele. Só aceitamos os destinos oficiais do Claude:
 *   - claude.ai / claude.com (web, desktop, celular e Cowork);
 *   - loopback do Claude Code (localhost / 127.0.0.1 / [::1], qualquer porta,
 *     caminho /callback) — caminho fixo para um open redirect de algum
 *     servidor de dev local não virar canal de vazamento do código.
 *
 * `comParametros`: a URI REGISTRADA do cliente não tem query; o redirect FINAL
 * (com code/state) tem — só ele pode trazer parâmetros.
 */
const DESTINOS_HTTPS = new Set(["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback"]);
const HOSTS_LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const CAMINHO_LOOPBACK = "/callback";

export function redirectPermitidoParaConsentimento(
  uri: string | null | undefined,
  opcoes: { comParametros?: boolean } = {},
): boolean {
  if (!uri) return false;
  let u: URL;
  try {
    u = new URL(uri);
  } catch {
    return false;
  }
  if (u.username || u.password || u.hash) return false;
  if (!opcoes.comParametros && u.search) return false;
  if (u.protocol === "https:") return DESTINOS_HTTPS.has(`${u.origin}${u.pathname}`);
  return u.protocol === "http:" && HOSTS_LOOPBACK.has(u.hostname) && u.pathname === CAMINHO_LOOPBACK;
}
