/**
 * Client Gemini — SOMENTE servidor (server actions). Espelha a config usada na
 * Cloud Function qualify-lead (gemini-flash-latest, temperature 0.2, JSON mode).
 * A chave vem de GEMINI_API_KEY (não NEXT_PUBLIC_*) — nunca exposta ao browser.
 * Nunca logar a chave nem o prompt bruto.
 *
 * Resiliência (2026-07): o alias `gemini-flash-latest` retorna HTTP 503
 * ("high demand") de forma intermitente. Sem retry, um único 503 virava falha
 * imediata na UI (ex.: "Gerar insights"). Agora:
 *  - retry com backoff exponencial em erros transitórios (429/5xx/rede/timeout);
 *  - fallback para um modelo GA de capacidade separada quando o primário está
 *    indisponível (503 esgotado OU 404 model-not-found);
 *  - deadline global para não estourar o timeout da função serverless (o que
 *    mataria o fallback justamente quando ele é útil).
 */

/** Modelos tentados em ordem — o fallback tem capacidade separada do primário. */
const GEMINI_MODELS = ["gemini-flash-latest", "gemini-flash-lite-latest"] as const;
const GEMINI_ENDPOINT = (model: string) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
const TIMEOUT_MS = 15_000; // por tentativa
const DEADLINE_MS = 25_000; // orçamento total (cabe no timeout da função + UX aceitável)
const MAX_TENTATIVAS_POR_MODELO = 2;
const BACKOFF_BASE_MS = 600;
/** HTTP transitórios que valem re-tentar no MESMO modelo (capacidade/rate). */
const STATUS_TRANSIENTE = new Set([429, 500, 502, 503, 504]);

/** Como o laço deve reagir a uma falha. */
type ErroCategoria =
  | "retry" // capacidade/rede/timeout → re-tenta o mesmo modelo (com backoff)
  | "pular" // modelo indisponível (404 model-not-found) → tenta o próximo modelo já
  | "fatal"; // request inválido / MAX_TOKENS → sobe imediatamente

/** IA não configurada no ambiente (falta GEMINI_API_KEY) — erro operacional, não bug. */
export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("IA não configurada (GEMINI_API_KEY ausente no ambiente).");
    this.name = "GeminiNotConfiguredError";
  }
}

/** Falha na chamada à Gemini (rede, HTTP, resposta vazia, timeout). */
export class GeminiError extends Error {
  readonly categoria: ErroCategoria;
  constructor(message: string, categoria: ErroCategoria = "fatal") {
    super(message);
    this.name = "GeminiError";
    this.categoria = categoria;
  }
}

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Força responseMimeType application/json (default true). */
  json?: boolean;
}

/** Uma mídia inline (base64) enviada à Gemini multimodal (vision). */
export interface GeminiMidia {
  /** MIME do arquivo (ex.: image/jpeg, application/pdf). */
  mimeType: string;
  /** Conteúdo binário já em base64, SEM prefixo `data:`. */
  base64: string;
}

/** MIMEs que os modelos flash aceitam via inlineData no generateContent (v1beta). */
const MIMETYPES_MULTIMODAIS = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);
/** Teto por mídia inline (comprimento do base64). Acima disso, não manda inline. */
const MAX_MIDIA_BASE64_LEN = 15 * 1024 * 1024;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Backoff exponencial com jitter (base pequena p/ não travar a UI). */
function backoffMs(tentativa: number): number {
  const base = BACKOFF_BASE_MS * 2 ** (tentativa - 1);
  return base + Math.floor(Math.random() * BACKOFF_BASE_MS);
}

/**
 * Uma chamada a um modelo específico, com timeout próprio (limitado pelo
 * orçamento restante). Lança GeminiError com a categoria correta.
 */
async function chamarModelo(
  model: string,
  apiKey: string,
  body: string,
  timeoutMs: number,
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GEMINI_ENDPOINT(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      const texto = await res.text().catch(() => "");
      let categoria: ErroCategoria;
      if (STATUS_TRANSIENTE.has(res.status)) {
        categoria = "retry";
      } else if (res.status === 404) {
        // Corpo vazio = rate-limit de edge do free-tier (transitório → retry).
        // Corpo com erro = model-not-found → pula para o próximo modelo.
        categoria = texto.trim() ? "pular" : "retry";
      } else {
        // 400/401/403… → request/credencial inválidos: definitivo.
        categoria = "fatal";
      }
      throw new GeminiError(`Gemini HTTP ${res.status}: ${texto.slice(0, 200)}`, categoria);
    }

    const data = (await res.json()) as {
      candidates?: Array<{
        finishReason?: string;
        content?: { parts?: Array<{ text?: string }> };
      }>;
    };
    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.[0]?.text;
    if (!text) {
      // gemini-flash-latest "pensa" no mesmo orçamento de saída; se estourar, o
      // texto vem vazio — re-tentar com a mesma config não ajuda (definitivo).
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new GeminiError("Resposta truncada (MAX_TOKENS) — aumente maxOutputTokens.");
      }
      throw new GeminiError("Gemini retornou resposta vazia.");
    }
    return text;
  } catch (err) {
    if (err instanceof GeminiError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new GeminiError("Gemini excedeu o tempo limite.", "retry");
    }
    // Falhas de rede (fetch) são transitórias.
    throw new GeminiError(
      err instanceof Error ? err.message : "Erro desconhecido ao chamar a Gemini.",
      "retry",
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Monta o generationConfig comum (texto e multimodal compartilham a config). */
function montarGenerationConfig(opts: GeminiOptions): Record<string, unknown> {
  const { temperature = 0.2, maxOutputTokens = 2048, json = true } = opts;
  return {
    temperature,
    maxOutputTokens,
    ...(json ? { responseMimeType: "application/json" } : {}),
  };
}

/**
 * Executa o request (body pronto) com a resiliência do cliente: retry com
 * backoff em transitórios, fallback de modelo em indisponibilidade, deadline
 * global. Texto e multimodal usam EXATAMENTE este laço — só o body difere.
 * Lança GeminiNotConfiguredError se a chave faltar.
 */
async function gerarComResiliencia(body: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const inicio = Date.now();
  const restante = () => DEADLINE_MS - (Date.now() - inicio);
  let ultimoErro: GeminiError | null = null;

  for (const model of GEMINI_MODELS) {
    for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_POR_MODELO; tentativa++) {
      if (restante() <= 0) {
        throw ultimoErro ?? new GeminiError("Gemini excedeu o tempo total.", "retry");
      }
      try {
        return await chamarModelo(model, apiKey, body, Math.min(TIMEOUT_MS, restante()));
      } catch (err) {
        if (err instanceof GeminiNotConfiguredError) throw err;
        const gerr = err instanceof GeminiError ? err : new GeminiError(String(err), "retry");
        ultimoErro = gerr;
        if (gerr.categoria === "fatal") throw gerr;
        if (gerr.categoria === "pular") break; // modelo indisponível → próximo modelo
        // "retry": backoff antes da próxima tentativa do mesmo modelo (se houver
        // tentativa restante E orçamento).
        if (tentativa < MAX_TENTATIVAS_POR_MODELO && restante() > BACKOFF_BASE_MS) {
          await sleep(Math.min(backoffMs(tentativa), Math.max(0, restante() - 1000)));
        }
      }
    }
    // Esgotou/pulou este modelo → tenta o próximo (fallback).
  }

  throw ultimoErro ?? new GeminiError("Falha ao chamar a Gemini após retries.", "retry");
}

/**
 * Gera conteúdo textual via Gemini. Retorna o texto bruto do primeiro candidato.
 * Lança GeminiNotConfiguredError se a chave faltar. Em falha transitória
 * (capacidade/rede/timeout) re-tenta com backoff; em modelo indisponível cai
 * para o fallback; erros definitivos (MAX_TOKENS, request inválido) sobem na
 * hora. Todo o processo respeita um deadline global.
 */
export async function gerarConteudoGemini(
  prompt: string,
  opts: GeminiOptions = {},
): Promise<string> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: montarGenerationConfig(opts),
  });
  return gerarComResiliencia(body);
}

/**
 * Gera conteúdo via Gemini MULTIMODAL (vision): texto + mídias inline (base64).
 * Só aceita image/jpeg, image/png, image/webp e application/pdf; ignora demais
 * MIMEs e mídias vazias/acima do teto. Se sobrar NENHUMA mídia legível, lança
 * GeminiError("fatal") para o chamador cair no fallback textual sem gastar
 * chamada. Reusa a mesma resiliência do texto (retry/backoff/fallback/deadline).
 */
export async function gerarConteudoGeminiMultimodal(
  prompt: string,
  midias: readonly GeminiMidia[],
  opts: GeminiOptions = {},
): Promise<string> {
  const partesMidia = midias
    .filter(
      (m) =>
        MIMETYPES_MULTIMODAIS.has(m.mimeType) &&
        m.base64.length > 0 &&
        m.base64.length <= MAX_MIDIA_BASE64_LEN,
    )
    .map((m) => ({ inlineData: { mimeType: m.mimeType, data: m.base64 } }));

  if (partesMidia.length === 0) {
    throw new GeminiError("Nenhuma mídia suportada para leitura multimodal.", "fatal");
  }

  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }, ...partesMidia] }],
    generationConfig: montarGenerationConfig(opts),
  });
  return gerarComResiliencia(body);
}
