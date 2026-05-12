"use server";

import { revalidatePath } from "next/cache";
import { requirePapel } from "@/lib/auth";

/**
 * Força nova tentativa de qualificação Gemini para leads pendentes.
 *
 * - Sem argumento: dispara o cron `retry-qualification` que processa
 *   todos os leads elegíveis (cooldown de 6h respeitado).
 * - Com `leadId`: força retry imediato de 1 lead específico, ignorando
 *   o cooldown.
 *
 * Acesso restrito ao papel CEO ou head_sucesso.
 */
export async function forceRequalify(leadId?: string): Promise<{
  success: boolean;
  message: string;
  processed?: number;
  classification?: string | null;
}> {
  // Validação de permissão
  await requirePapel("ceo");

  const RETRY_URL = process.env.RETRY_QUALIFICATION_URL;
  const SECRET = process.env.WEBHOOK_SECRET;

  if (!RETRY_URL) {
    return {
      success: false,
      message:
        "RETRY_QUALIFICATION_URL não configurada. Adicione a variável de ambiente.",
    };
  }

  const payload: Record<string, unknown> = {
    triggered_by: leadId ? "manual_single" : "manual_bulk",
  };
  if (leadId) {
    payload.lead_id = leadId;
  }

  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };
  if (SECRET) {
    headers["x-webhook-secret"] = SECRET;
  }

  try {
    const resp = await fetch(RETRY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      // Cloud Function pode demorar (até 9 min em batch)
      signal: AbortSignal.timeout(540_000),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return {
        success: false,
        message: `Falha na chamada: HTTP ${resp.status} ${errText.substring(0, 200)}`,
      };
    }

    const data = await resp.json();
    const processed = data?.processed || 0;
    const classification = data?.results?.details?.[0]?.action || null;

    revalidatePath("/war-room");
    revalidatePath("/leads");

    return {
      success: true,
      message: leadId
        ? `Retry executado para 1 lead.`
        : `Retry executado para ${processed} lead(s).`,
      processed,
      classification,
    };
  } catch (err) {
    return {
      success: false,
      message: `Erro inesperado: ${(err as Error).message}`,
    };
  }
}
