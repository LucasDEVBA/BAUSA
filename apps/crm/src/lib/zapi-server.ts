/**
 * Cliente Z-API server-side — usado EXCLUSIVAMENTE pelas API routes de
 * /api/whatsapp/*. As credenciais (ZAPI_INSTANCE_ID / ZAPI_TOKEN /
 * ZAPI_CLIENT_TOKEN) vivem em process.env e NUNCA chegam ao client — a UI
 * fala apenas com o proxy.
 *
 * Segurança de log: nunca logar URL (contém instance/token), corpo de
 * mensagem nem tokens. Telefones sempre mascarados via `maskPhone`.
 */

const ZAPI_BASE_URL = "https://api.z-api.io";
const ZAPI_TIMEOUT_MS = 15_000;

export interface ZapiConfig {
  instanceId: string;
  token: string;
  clientToken: string;
}

export interface ZapiResult {
  ok: boolean;
  status: number;
  data: unknown;
}

interface ZapiRequestInit {
  method?: "GET" | "POST";
  body?: Record<string, unknown>;
}

type LogLevel = "info" | "warn" | "error";

/** Lê as credenciais Z-API do ambiente; `null` se qualquer uma faltar. */
export function getZapiConfig(): ZapiConfig | null {
  const instanceId = process.env.ZAPI_INSTANCE_ID;
  const token = process.env.ZAPI_TOKEN;
  const clientToken = process.env.ZAPI_CLIENT_TOKEN;
  if (!instanceId || !token || !clientToken) return null;
  return { instanceId, token, clientToken };
}

/** Log estruturado JSON (padrão do projeto) — sem dados sensíveis. */
export function logZapi(level: LogLevel, action: string, details: Record<string, unknown> = {}): void {
  console.log(JSON.stringify({ level, service: "whatsapp-espelho", action, ...details }));
}

/**
 * Requisição à Z-API com timeout de 15s (AbortController) e parse JSON
 * tolerante. Erros de rede/timeout propagam como exceção — o route handler
 * captura e responde 502.
 */
export async function zapiRequest(
  config: ZapiConfig,
  path: string,
  init?: ZapiRequestInit,
): Promise<ZapiResult> {
  const url = `${ZAPI_BASE_URL}/instances/${config.instanceId}/token/${config.token}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZAPI_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: init?.method ?? "GET",
      headers: {
        "Client-Token": config.clientToken,
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init?.body ? JSON.stringify(init.body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    const rawBody = await response.text();
    let data: unknown = null;
    try {
      data = rawBody.length > 0 ? JSON.parse(rawBody) : null;
    } catch {
      // Corpo não-JSON (HTML de erro, texto solto) — segue com data null.
      data = null;
    }

    return { ok: response.ok, status: response.status, data };
  } finally {
    clearTimeout(timer);
  }
}
