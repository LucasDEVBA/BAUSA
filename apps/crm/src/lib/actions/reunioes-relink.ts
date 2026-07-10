"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Relink de reunião do deal — quando o lead REMARCA, o Meet cria um novo
// evento (com a transcrição anexada nele) e o deal pode ficar preso no
// antigo. Aqui o CEO enxerga TODAS as reuniões do lead no Calendar (via CF
// calendar-lead-events, read-only) e religa o deal ao evento correto.
// O webhook já ressincroniza remarcações futuras sozinho; isto cobre o
// passado e dá visibilidade/controle manual.
// ════════════════════════════════════════════════════════════════════════

export interface ReuniaoCalendar {
  id: string;
  summary: string;
  start: string | null;
  end: string | null;
  status: string;
  hangoutLink: string | null;
  htmlLink: string | null;
  temTranscricaoAnexada: boolean;
}

export type ListarReunioesResult =
  | { success: true; atual: string | null; eventos: ReuniaoCalendar[] }
  | { success: false; error: string };

interface DealContatoRow {
  google_calendar_event_id: string | null;
  atleta: {
    form: {
      email: string | null;
      guardian_email: string | null;
      guardian_whatsapp: string | null;
      athlete_whatsapp: string | null;
    } | null;
  } | null;
}

/** Todas as reuniões do lead no Calendar do CEO (via CF, read-only). */
export async function listarReunioesLead(dealId: string): Promise<ListarReunioesResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode listar as reuniões." };
  }

  const url = process.env.CALENDAR_LEAD_EVENTS_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url || !secret) {
    return {
      success: false,
      error: "Integração com o Calendar não configurada (CALENDAR_LEAD_EVENTS_URL).",
    };
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("deals")
      .select(
        "google_calendar_event_id, atleta:atletas(form:form_submissions(email, guardian_email, guardian_whatsapp, athlete_whatsapp))",
      )
      .eq("id", dealId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) {
      return { success: false, error: "Deal não encontrado." };
    }
    const row = data as unknown as DealContatoRow;
    const form = row.atleta?.form ?? null;
    // Os DOIS telefones (responsável + atleta) — o webhook casa contra ambos.
    const phones = [form?.guardian_whatsapp, form?.athlete_whatsapp].filter(Boolean);

    if (!form?.email && !form?.guardian_email && phones.length === 0) {
      return { success: false, error: "Lead sem e-mail/telefone para casar com o Calendar." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-webhook-secret": secret,
        },
        body: JSON.stringify({
          email: form?.email ?? null,
          guardianEmail: form?.guardian_email ?? null,
          phones,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!resposta.ok) {
      return { success: false, error: `Calendar indisponível (HTTP ${resposta.status}).` };
    }
    const corpo = (await resposta.json()) as {
      success: boolean;
      eventos?: ReuniaoCalendar[];
      error?: string;
    };
    if (!corpo.success) {
      return { success: false, error: corpo.error ?? "Falha ao listar as reuniões." };
    }

    return {
      success: true,
      atual: row.google_calendar_event_id ?? null,
      eventos: corpo.eventos ?? [],
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "listar_reunioes_lead",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Não foi possível consultar o Calendar agora." };
  }
}

export type RelinkResult = { success: true } | { success: false; error: string };

/**
 * Religa o deal a um evento específico do Calendar (escolhido pelo CEO na
 * lista acima). Atualiza id/data/link da reunião — a CF meeting-transcripts
 * passa a procurar a transcrição no evento certo no próximo tick.
 */
export async function relinkReuniaoDeal(
  dealId: string,
  evento: { id: string; start: string | null; hangoutLink: string | null; htmlLink?: string | null },
): Promise<RelinkResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode religar a reunião." };
  }
  // Evento sem start jamais zera a reuniao_data existente (classe do bug do
  // webhook) — a action é chamável com payload arbitrário, blinda aqui.
  if (!evento?.id || !evento.start) {
    return { success: false, error: "Evento inválido (sem id ou sem horário)." };
  }

  try {
    const supabase = await createAuditedSupabaseClient();
    const { data, error } = await supabase
      .from("deals")
      .update({
        google_calendar_event_id: evento.id,
        reuniao_data: evento.start,
        reuniao_link: evento.hangoutLink ?? evento.htmlLink ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", dealId)
      .is("deleted_at", null)
      .select("id");

    if (error) return { success: false, error: error.message };
    if (!data || data.length === 0) {
      return { success: false, error: "Deal não encontrado ou sem permissão." };
    }

    revalidatePath("/pipeline");
    revalidatePath("/leads");
    revalidatePath("/agenda");
    return { success: true };
  } catch (err) {
    console.error({
      level: "error",
      action: "relink_reuniao_deal",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Erro ao religar a reunião." };
  }
}
