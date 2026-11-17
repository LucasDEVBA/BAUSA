"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSession, getUserPapel, requirePapel } from "@/lib/auth";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";

// Lote: a CF processa vários leads com throttle entre eles (até 9 min).
const TIMEOUT_LOTE_MS = 540_000;
// 1 lead = 1 chamada ao qualify-lead (Gemini + 2ª passagem adversarial) — folga de 2 min.
const TIMEOUT_UM_LEAD_MS = 120_000;

interface RespostaRetryCf {
  processed?: number;
  results?: { details?: { action?: string }[] };
}

type ChamadaRetry = { ok: true; data: RespostaRetryCf } | { ok: false; message: string };

/** POST na CF `retry-qualification` com o secret do ambiente. Nunca lança. */
async function chamarRetryQualificacao(payload: Record<string, unknown>, timeoutMs: number): Promise<ChamadaRetry> {
  const RETRY_URL = process.env.RETRY_QUALIFICATION_URL;
  const SECRET = process.env.WEBHOOK_SECRET;

  if (!RETRY_URL) {
    return { ok: false, message: "RETRY_QUALIFICATION_URL não configurada. Adicione a variável de ambiente." };
  }

  const headers: HeadersInit = { "Content-Type": "application/json" };
  if (SECRET) {
    headers["x-webhook-secret"] = SECRET;
  }

  try {
    const resp = await fetch(RETRY_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { ok: false, message: `Falha na chamada: HTTP ${resp.status} ${errText.substring(0, 200)}` };
    }

    return { ok: true, data: (await resp.json()) as RespostaRetryCf };
  } catch (err) {
    return { ok: false, message: `Erro inesperado: ${(err as Error).message}` };
  }
}

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

  const payload: Record<string, unknown> = {
    triggered_by: leadId ? "manual_single" : "manual_bulk",
  };
  if (leadId) {
    payload.lead_id = leadId;
  }

  const r = await chamarRetryQualificacao(payload, TIMEOUT_LOTE_MS);
  if (!r.ok) return { success: false, message: r.message };

  const processed = r.data?.processed || 0;
  const classification = r.data?.results?.details?.[0]?.action || null;

  revalidatePath("/war-room");
  revalidatePath("/leads");

  return {
    success: true,
    message: leadId ? `Retry executado para 1 lead.` : `Retry executado para ${processed} lead(s).`,
    processed,
    classification,
  };
}

export type ResultadoClassificarAgora =
  | { success: true; classificacao: string | null; pendente: boolean; ultimoErro: string | null }
  | { success: false; error: string };

/**
 * "Classificar agora" da faixa Fora do pipeline: roda a qualificação de UM
 * cadastro que está SEM classificação — inclusive o órfão de webhook
 * (`qualification_pending=false`), que a retentativa diária não enxerga.
 *
 * Só age em cadastro sem classe: reclassificar quem já tem classe pode mudar
 * a faixa e o fluxo do lead — isso é a requalificação em massa, com outras
 * travas. O resultado devolvido é RELIDO do banco (a resposta da CF não traz
 * a classe de forma confiável).
 */
export async function classificarCadastroAgora(formSubmissionId: string): Promise<ResultadoClassificarAgora> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem classificar um cadastro." };
  }
  const id = z.uuid().safeParse(formSubmissionId);
  if (!id.success) return { success: false, error: "Cadastro inválido." };

  const supabase = await createAuditedSupabaseClient();
  const usuario = await getSession().catch(() => null);
  const antes = await supabase
    .from("form_submissions")
    .select("id, qualification_classification")
    .eq("id", id.data)
    .is("deleted_at", null)
    .maybeSingle();
  if (antes.error) {
    console.error({ level: "error", action: "classificar_cadastro_agora", etapa: "ler", message: antes.error.message });
    return { success: false, error: "Erro ao ler o cadastro. Tente de novo." };
  }
  if (!antes.data) return { success: false, error: "Cadastro não encontrado (excluído?)." };
  if (antes.data.qualification_classification !== null) {
    return {
      success: false,
      error: `Este cadastro já foi classificado (${antes.data.qualification_classification}). Refaça a busca.`,
    };
  }

  const chamada = await chamarRetryQualificacao(
    { triggered_by: "manual_single_pipeline", lead_id: id.data },
    TIMEOUT_UM_LEAD_MS,
  );
  if (!chamada.ok) {
    console.error({
      level: "error",
      action: "classificar_cadastro_agora",
      etapa: "cf",
      usuarioId: usuario?.id ?? null,
      submissionId: id.data,
      message: chamada.message,
    });
    return { success: false, error: chamada.message };
  }

  const depois = await supabase
    .from("form_submissions")
    .select("qualification_classification, qualification_pending, last_qualification_error")
    .eq("id", id.data)
    .maybeSingle();
  revalidatePath("/pipeline");
  revalidatePath("/leads");
  revalidatePath("/war-room");
  if (depois.error || !depois.data) {
    console.error({
      level: "error",
      action: "classificar_cadastro_agora",
      etapa: "reler",
      submissionId: id.data,
      message: depois.error?.message ?? "sem linha",
    });
    return { success: false, error: "A classificação rodou, mas não deu para ler o resultado. Refaça a busca." };
  }

  console.log({
    level: "info",
    action: "classificar_cadastro_agora",
    usuarioId: usuario?.id ?? null,
    submissionId: id.data,
    classificacao: depois.data.qualification_classification,
    pendente: depois.data.qualification_pending === true,
  });
  return {
    success: true,
    classificacao: depois.data.qualification_classification,
    pendente: depois.data.qualification_pending === true,
    ultimoErro: depois.data.last_qualification_error,
  };
}
