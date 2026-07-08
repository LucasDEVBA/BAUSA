/**
 * Client Gemini — SOMENTE servidor (server actions). Espelha a config usada na
 * Cloud Function qualify-lead (gemini-2.5-flash, temperature 0.2, JSON mode).
 * A chave vem de GEMINI_API_KEY (não NEXT_PUBLIC_*) — nunca exposta ao browser.
 * Nunca logar a chave nem o prompt bruto.
 */

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const TIMEOUT_MS = 30_000;

/** IA não configurada no ambiente (falta GEMINI_API_KEY) — erro operacional, não bug. */
export class GeminiNotConfiguredError extends Error {
  constructor() {
    super("IA não configurada (GEMINI_API_KEY ausente no ambiente).");
    this.name = "GeminiNotConfiguredError";
  }
}

/** Falha na chamada à Gemini (rede, HTTP, resposta vazia, timeout). */
export class GeminiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

interface GeminiOptions {
  temperature?: number;
  maxOutputTokens?: number;
  /** Força responseMimeType application/json (default true). */
  json?: boolean;
}

/**
 * Gera conteúdo textual via Gemini. Retorna o texto bruto do primeiro candidato.
 * Lança GeminiNotConfiguredError se a chave faltar, GeminiError em qualquer
 * outra falha — o chamador decide como degradar.
 */
export async function gerarConteudoGemini(
  prompt: string,
  opts: GeminiOptions = {},
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new GeminiNotConfiguredError();

  const { temperature = 0.2, maxOutputTokens = 2048, json = true } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature,
          maxOutputTokens,
          ...(json ? { responseMimeType: "application/json" } : {}),
        },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      throw new GeminiError(`Gemini HTTP ${res.status}: ${body.slice(0, 200)}`);
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
      // gemini-2.5-flash "pensa" no mesmo orçamento de saída; se estourar, o
      // texto vem vazio — mensagem específica p/ diagnosticar (≠ resposta vazia).
      if (candidate?.finishReason === "MAX_TOKENS") {
        throw new GeminiError(
          "Resposta truncada (MAX_TOKENS) — aumente maxOutputTokens.",
        );
      }
      throw new GeminiError("Gemini retornou resposta vazia.");
    }
    return text;
  } catch (err) {
    if (err instanceof GeminiNotConfiguredError || err instanceof GeminiError) {
      throw err;
    }
    if (err instanceof Error && err.name === "AbortError") {
      throw new GeminiError("Gemini excedeu o tempo limite (30s).");
    }
    throw new GeminiError(
      err instanceof Error ? err.message : "Erro desconhecido ao chamar a Gemini.",
    );
  } finally {
    clearTimeout(timeout);
  }
}
