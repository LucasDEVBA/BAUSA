/**
 * Sinais de correspondência para a API de Conversões do Meta (evento
 * LeadQualificado, enviado DEPOIS pela CF meta-capi quando a IA classifica o
 * lead como QUENTE/MORNO).
 *
 * - `_fbp`: cookie first-party do Meta Pixel (identifica o navegador).
 * - `_fbc`: cookie do clique no anúncio. Quando o Pixel não o gravou, montamos
 *   no formato oficial `fb.1.{timestamp_ms}.{fbclid}` a partir do `fbclid` da
 *   URL de chegada — sem ele o Meta não liga o lead ao clique.
 * - IP: o formulário posta direto no Supabase (sem servidor no meio), então o
 *   IP só é visível na rota /api/client-context.
 *
 * Tudo aqui é FAIL-SOFT: nenhuma falha de tracking pode atrasar ou impedir o
 * envio do formulário.
 */

const FBCLID_STORAGE_KEY = "bau_fbclid";
const FBCLID_MAX = 500;
// Formato oficial + sufixo opcional ("appendix" do Parameter Builder do Meta).
const FBP_RE = /^fb\.\d\.\d{10,13}\.\d{1,20}(\.[A-Za-z0-9_-]{1,64})?$/;
const FBC_RE = /^fb\.\d\.\d{10,13}\.[A-Za-z0-9_-]{1,500}(\.[A-Za-z0-9_-]{1,64})?$/;
// Mesma validade do cookie _fbc do Pixel: clique de 90+ dias não atribui.
const FBCLID_VALIDADE_MS = 90 * 24 * 60 * 60 * 1000;
const FBCLID_RE = /^[A-Za-z0-9_-]+$/;
const IP_TIMEOUT_MS = 1500;

interface FbclidGuardado {
  fbclid: string;
  at: number;
}

function lerCookie(nome: string): string | null {
  if (typeof document === "undefined") return null;
  const prefixo = `${nome}=`;
  for (const parte of document.cookie.split(";")) {
    const c = parte.trim();
    if (c.startsWith(prefixo)) {
      try {
        return decodeURIComponent(c.slice(prefixo.length));
      } catch {
        return null;
      }
    }
  }
  return null;
}

function lerFbclidGuardado(): FbclidGuardado | null {
  try {
    const bruto = localStorage.getItem(FBCLID_STORAGE_KEY);
    if (!bruto) return null;
    const v = JSON.parse(bruto) as Partial<FbclidGuardado>;
    if (typeof v.fbclid !== "string" || typeof v.at !== "number") return null;
    return { fbclid: v.fbclid, at: v.at };
  } catch {
    return null;
  }
}

/**
 * Guarda o `fbclid` da URL atual. Diferente das UTMs (first-touch), aqui vale
 * o clique MAIS RECENTE — é o que o Meta usa para atribuir. Mesmo fbclid não
 * renova o timestamp (o Meta exige o horário do primeiro registro do clique).
 */
export function captureFbclid(): void {
  if (typeof window === "undefined") return;
  try {
    const fbclid = new URLSearchParams(window.location.search).get("fbclid")?.trim();
    if (!fbclid || fbclid.length > FBCLID_MAX || !FBCLID_RE.test(fbclid)) return;
    if (lerFbclidGuardado()?.fbclid === fbclid) return;
    localStorage.setItem(FBCLID_STORAGE_KEY, JSON.stringify({ fbclid, at: Date.now() }));
  } catch {
    // localStorage bloqueado (aba privada): segue sem o sinal.
  }
}

export interface SinaisMeta {
  meta_fbp: string | null;
  meta_fbc: string | null;
}

export function getMetaMatchSignals(): SinaisMeta {
  if (typeof window === "undefined") return { meta_fbp: null, meta_fbc: null };
  const fbp = lerCookie("_fbp");
  const fbcCookie = lerCookie("_fbc");
  let fbc = fbcCookie && FBC_RE.test(fbcCookie) ? fbcCookie : null;
  if (!fbc) {
    const guardado = lerFbclidGuardado();
    const vigente = guardado && Date.now() - guardado.at <= FBCLID_VALIDADE_MS;
    if (guardado && vigente && FBCLID_RE.test(guardado.fbclid)) fbc = `fb.1.${guardado.at}.${guardado.fbclid}`;
  }
  return {
    meta_fbp: fbp && FBP_RE.test(fbp) ? fbp : null,
    meta_fbc: fbc,
  };
}

/** IP público do visitante (via rota própria). Nunca lança; em ~1,5 s desiste. */
export async function fetchClientIp(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  try {
    const res = await fetch("/api/client-context", {
      cache: "no-store",
      signal: AbortSignal.timeout(IP_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { ip?: unknown };
    return typeof data.ip === "string" && data.ip.length > 0 ? data.ip : null;
  } catch {
    return null;
  }
}
