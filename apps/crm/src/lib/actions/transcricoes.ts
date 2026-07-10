"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";

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
