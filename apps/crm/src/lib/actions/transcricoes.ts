"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";

export interface ReuniaoTranscricao {
  id: string;
  deal_id: string | null;
  form_submission_id: string | null;
  google_event_id: string;
  doc_url: string | null;
  transcript_text: string | null;
  resumo: string | null;
  capturada_at: string;
}

interface GetTranscricaoParams {
  dealId?: string;
  formSubmissionId?: string;
}

/**
 * Busca a transcrição de reunião mais recente capturada pela CF
 * meeting-transcripts para um deal ou um lead (form_submission).
 * Leitura simples — RLS restringe o SELECT a nível CEO.
 */
export async function getTranscricaoReuniao(
  params: GetTranscricaoParams,
): Promise<ReuniaoTranscricao | null> {
  if (!params.dealId && !params.formSubmissionId) return null;

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("reunioes_transcricoes")
    .select(
      "id, deal_id, form_submission_id, google_event_id, doc_url, transcript_text, resumo, capturada_at",
    )
    .order("capturada_at", { ascending: false })
    .limit(1);

  if (params.dealId) {
    query = query.eq("deal_id", params.dealId);
  } else if (params.formSubmissionId) {
    query = query.eq("form_submission_id", params.formSubmissionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("getTranscricaoReuniao:", error.message);
    return null;
  }

  return (data?.[0] as ReuniaoTranscricao | undefined) ?? null;
}

/**
 * Lista TODAS as transcrições de um deal/lead — uma por reunião (um lead pode
 * ter várias reuniões: remarcações, follow-ups). Acumula o contexto ao longo
 * do tempo. Ordenado da mais recente para a mais antiga. RLS = CEO.
 */
export async function listarTranscricoesReuniao(
  params: GetTranscricaoParams,
): Promise<ReuniaoTranscricao[]> {
  if (!params.dealId && !params.formSubmissionId) return [];

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("reunioes_transcricoes")
    .select(
      "id, deal_id, form_submission_id, google_event_id, doc_url, transcript_text, resumo, capturada_at",
    )
    .order("capturada_at", { ascending: false });

  if (params.dealId) {
    query = query.eq("deal_id", params.dealId);
  } else if (params.formSubmissionId) {
    query = query.eq("form_submission_id", params.formSubmissionId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("listarTranscricoesReuniao:", error.message);
    return [];
  }

  return (data as ReuniaoTranscricao[] | null) ?? [];
}

// ─── Transcrição sob demanda por evento (aba Reunião) ────────────────────

export type TranscricaoEventoResult =
  | { success: true; status: "ok"; transcricao: ReuniaoTranscricao }
  | { success: true; status: "nao_disponivel" }
  | { success: false; error: string };

interface ObterTranscricaoEventoInput {
  eventId: string;
  dealId?: string;
  formSubmissionId?: string;
}

/**
 * Puxa a transcrição de UM evento do Calendar do lead, sob demanda:
 * 1. cache: reunioes_transcricoes por google_event_id (RLS CEO);
 * 2. senão, aciona a CF meeting-transcripts em modo targeted (captura o Doc
 *    do Meet, resume via Gemini e persiste) e devolve o resultado.
 * Independe do vínculo deals.google_calendar_event_id — qualquer reunião
 * listada na aba pode ter a transcrição aberta com um clique.
 */
export async function obterTranscricaoEvento(
  input: ObterTranscricaoEventoInput,
): Promise<TranscricaoEventoResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode consultar transcrições." };
  }

  const eventId = (input.eventId ?? "").trim();
  if (eventId.length < 5 || eventId.length > 1024 || /\s/.test(eventId)) {
    return { success: false, error: "Evento inválido." };
  }

  // 1. Cache no banco (o cron pode já ter capturado)
  const supabase = await createServerSupabaseClient();
  const { data: cached, error: cacheError } = await supabase
    .from("reunioes_transcricoes")
    .select(
      "id, deal_id, form_submission_id, google_event_id, doc_url, transcript_text, resumo, capturada_at",
    )
    .eq("google_event_id", eventId)
    .limit(1);

  if (!cacheError && cached?.[0]) {
    return { success: true, status: "ok", transcricao: cached[0] as ReuniaoTranscricao };
  }

  // 2. Captura sob demanda via CF (modo targeted)
  const url = process.env.MEETING_TRANSCRIPTS_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url || !secret) {
    return {
      success: false,
      error: "MEETING_TRANSCRIPTS_URL/WEBHOOK_SECRET não configuradas no ambiente do Engine.",
    };
  }

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-secret": secret,
      },
      body: JSON.stringify({
        eventId,
        dealId: input.dealId,
        formSubmissionId: input.formSubmissionId,
      }),
      // Export do Doc + resumo Gemini podem levar dezenas de segundos
      signal: AbortSignal.timeout(120_000),
    });

    if (!resp.ok) {
      return { success: false, error: `Falha na captura (HTTP ${resp.status}).` };
    }

    const body = (await resp.json()) as {
      status?: string;
      transcript?: Omit<ReuniaoTranscricao, "id"> & { id?: string };
    };

    if ((body.status === "captured" || body.status === "already") && body.transcript) {
      return {
        success: true,
        status: "ok",
        transcricao: { id: body.transcript.id ?? eventId, ...body.transcript } as ReuniaoTranscricao,
      };
    }
    if (body.status === "not_ready") {
      return { success: true, status: "nao_disponivel" };
    }
    if (body.status === "access_denied") {
      return {
        success: false,
        error:
          "O Doc da transcrição não está compartilhado com a service account (pasta \"Meet Recordings\" → acesso Leitor).",
      };
    }
    if (body.status === "event_not_found") {
      return { success: false, error: "Evento não encontrado no Calendar (apagado?)." };
    }
    return { success: false, error: "Resposta inesperada da captura." };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "erro desconhecido";
    console.error("obterTranscricaoEvento:", msg);
    return { success: false, error: "Não foi possível capturar a transcrição agora." };
  }
}
