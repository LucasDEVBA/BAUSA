"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Criar compromisso no Google Calendar direto da /agenda do Engine.
//
// Fluxo: action → CF calendar-create-event (escreve no Calendar do CEO com o
// NOME DO ATLETA no título e telefone/e-mail do lead na descrição) → PATCH
// imediato no deal (UI instantânea) → notificação ao lead:
//  • lead SEM reunião anterior → o calendar-webhook detecta o evento novo e
//    dispara a confirmação automática (lead + CEO) — não enviamos nada aqui
//    (evita mensagem duplicada).
//  • lead JÁ com reunião (remarcação) → o webhook ressincroniza silencioso;
//    se notificarLead, enviamos a confirmação custom via send-whatsapp.
// ════════════════════════════════════════════════════════════════════════

export interface CriarCompromissoInput {
  dealId: string;
  /** Início ISO (com offset). */
  startIso: string;
  duracaoMin: number;
  observacao?: string;
  /** Avisar o lead por WhatsApp (aplicável só a remarcação — 1ª reunião é
   *  notificada automaticamente pelo webhook). */
  notificarLead: boolean;
}

export type CriarCompromissoResult =
  | {
      success: true;
      hangoutLink: string | null;
      meetCriado: boolean;
      /** Como o lead será avisado: 'webhook' (automático), 'enviado', 'nao' */
      notificacao: "webhook" | "enviado" | "nao";
    }
  | { success: false; error: string };

interface DealAgendaRow {
  id: string;
  etapa: string;
  atleta: {
    id: string;
    nome_completo: string;
    form: {
      id: string;
      athlete_name: string | null;
      guardian_name: string | null;
      email: string | null;
      guardian_email: string | null;
      guardian_whatsapp: string | null;
      athlete_whatsapp: string | null;
      meeting_scheduled: boolean | null;
      qualification_classification: string | null;
    } | null;
  } | null;
}

const fmtDataHoraBRT = (iso: string) => {
  const d = new Date(iso);
  const data = d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = d.toLocaleTimeString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
  });
  return { data, hora };
};

export async function criarCompromisso(
  input: CriarCompromissoInput,
): Promise<CriarCompromissoResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode criar compromissos." };
  }

  const url = process.env.CALENDAR_CREATE_EVENT_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url || !secret) {
    return {
      success: false,
      error: "Integração não configurada (CALENDAR_CREATE_EVENT_URL).",
    };
  }

  const startMs = Date.parse(input.startIso ?? "");
  if (!Number.isFinite(startMs)) return { success: false, error: "Data/hora inválida." };
  if (startMs <= Date.now()) return { success: false, error: "O compromisso precisa ser no futuro." };

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("deals")
      .select(
        "id, etapa, atleta:atletas(id, nome_completo, form:form_submissions(id, athlete_name, guardian_name, email, guardian_email, guardian_whatsapp, athlete_whatsapp, meeting_scheduled, qualification_classification))",
      )
      .eq("id", input.dealId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error || !data) return { success: false, error: "Deal não encontrado." };
    const row = data as unknown as DealAgendaRow;
    const atleta = row.atleta;
    const form = atleta?.form ?? null;
    if (!atleta) return { success: false, error: "Deal sem atleta vinculado." };

    const athleteName = form?.athlete_name || atleta.nome_completo;
    const phone = form?.guardian_whatsapp || form?.athlete_whatsapp || null;

    // 1) Cria o evento no Calendar (CF de escrita)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
        body: JSON.stringify({
          athleteName,
          guardianName: form?.guardian_name ?? null,
          leadEmail: form?.email ?? form?.guardian_email ?? null,
          phone,
          startIso: new Date(startMs).toISOString(),
          duracaoMin: input.duracaoMin,
          observacao: input.observacao ?? "",
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    const corpo = (await resposta.json().catch(() => null)) as {
      success?: boolean;
      eventId?: string;
      htmlLink?: string | null;
      hangoutLink?: string | null;
      meetCriado?: boolean;
      error?: string;
    } | null;
    if (!resposta.ok || !corpo?.success || !corpo.eventId) {
      return { success: false, error: corpo?.error ?? `Calendar indisponível (HTTP ${resposta.status}).` };
    }

    const reuniaoLink = corpo.hangoutLink ?? corpo.htmlLink ?? null;

    // 2) PATCH imediato no deal (o webhook confirmará/ressincronizará depois)
    const audited = await createAuditedSupabaseClient();
    const { error: patchErr } = await audited
      .from("deals")
      .update({
        google_calendar_event_id: corpo.eventId,
        reuniao_data: new Date(startMs).toISOString(),
        reuniao_link: reuniaoLink,
        reuniao_agendada_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.dealId)
      .is("deleted_at", null);
    if (patchErr) {
      // Evento criado mas deal não atualizado — o webhook corrige no próximo
      // push; reporta como sucesso parcial via log.
      console.error({ level: "error", action: "criar_compromisso_patch", error: patchErr.message });
    }

    // 3) Notificação ao lead
    let notificacao: "webhook" | "enviado" | "nao" = "nao";
    if (!form?.meeting_scheduled) {
      // 1ª reunião: o calendar-webhook detecta e notifica sozinho — MAS o
      // matching dele exige telefone na descrição (e-mail só casa via
      // attendee, que cai no 403 sem DWD). Sem telefone, ninguém notifica.
      notificacao = phone ? "webhook" : "nao";
    } else if (input.notificarLead && phone) {
      const enviado = await enviarConfirmacaoRemarcacao({
        athleteName,
        guardianName: form?.guardian_name ?? null,
        phone,
        startIso: new Date(startMs).toISOString(),
        // Só o Meet vai ao lead — htmlLink é o evento no Calendar do CEO
        // (lead sem acesso veria "evento não encontrado").
        linkReuniao: corpo.hangoutLink ?? null,
        classification: form?.qualification_classification ?? null,
      });
      notificacao = enviado ? "enviado" : "nao";
    }

    revalidatePath("/agenda");
    revalidatePath("/pipeline");
    return {
      success: true,
      hangoutLink: corpo.hangoutLink ?? null,
      meetCriado: Boolean(corpo.meetCriado),
      notificacao,
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "criar_compromisso",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Não foi possível criar o compromisso agora." };
  }
}

// ─── Link premium da reunião (bolsaatletausa.com/analise-<nome>) ────────────
// Espelho TS do helper da CF calendar-webhook: cria/reusa um link curto de
// marca em links_curtos apontando para o Meet — o lead nunca recebe o
// meet.google.com cru nem htmlLink. Reagendamento do MESMO atleta reusa o
// slug (PATCH do destino). Falha → devolve o link original (fail-open).
function slugReuniaoBase(athleteName: string): string | null {
  const primeiro = athleteName
    .trim()
    .split(/\s+/)[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return primeiro.length >= 2 ? `analise-${primeiro}` : null;
}

async function criarLinkReuniaoPremium(
  athleteName: string,
  meetUrl: string,
): Promise<string> {
  try {
    const base = slugReuniaoBase(athleteName);
    if (!base) return meetUrl;
    const titulo = `Reunião — ${athleteName.slice(0, 80)}`;
    const supabase = await createAuditedSupabaseClient();

    for (const sufixo of ["", "-2", "-3", "-4", "-5"]) {
      const slug = `${base}${sufixo}`;
      const { error } = await supabase
        .from("links_curtos")
        .insert({ slug, destino: meetUrl, titulo });
      if (!error) return `https://bolsaatletausa.com/${slug}`;

      // Slug ocupado: mesmo atleta → atualiza o destino e reusa
      const { data: existente } = await supabase
        .from("links_curtos")
        .select("titulo")
        .eq("slug", slug)
        .maybeSingle();
      if (existente?.titulo === titulo) {
        await supabase
          .from("links_curtos")
          .update({ destino: meetUrl })
          .eq("slug", slug);
        return `https://bolsaatletausa.com/${slug}`;
      }
      // Homônimo → próximo sufixo
    }
    return meetUrl;
  } catch (err) {
    console.warn("[criarLinkReuniaoPremium] fail-open", err);
    return meetUrl;
  }
}

/** Confirmação de REMARCAÇÃO via send-whatsapp (caminho meeting_confirmed +
 *  customMessage). Nunca lança — falha vira false (o CEO vê 'não notificado'). */
async function enviarConfirmacaoRemarcacao(args: {
  athleteName: string;
  guardianName: string | null;
  phone: string;
  startIso: string;
  linkReuniao: string | null;
  classification: string | null;
}): Promise<boolean> {
  const url = process.env.SEND_WHATSAPP_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url || !secret) return false;

  const { data, hora } = fmtDataHoraBRT(args.startIso);
  const nome = args.guardianName || args.athleteName;
  const customMessage =
    `Olá, ${nome}! 👋\n\n` +
    `Sua reunião com a Bolsa Atleta USA sobre o projeto de ${args.athleteName} ` +
    `foi reagendada para *${data}* às *${hora}* (horário de Brasília).\n\n` +
    `Até lá!`;

  // Link premium de marca no lugar do meet.google.com cru (fail-open)
  const linkPremium = args.linkReuniao
    ? await criarLinkReuniaoPremium(args.athleteName, args.linkReuniao)
    : null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
        body: JSON.stringify({
          messageType: "meeting_confirmed",
          // athlete_name na raiz: a CF valida data.athlete_name antes do branch custom
          athlete_name: args.athleteName,
          qualification_classification: args.classification,
          phone: args.phone,
          customMessage,
          ...(linkPremium ? { linkUrl: linkPremium } : {}),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!resposta.ok) return false;
    // FRIO é pulado pela CF com HTTP 200 {action:'skipped'} (invariante
    // FRIO-nunca-recebe) — reportar 'não notificado' p/ o CEO avisar manual.
    const corpo = (await resposta.json().catch(() => null)) as { action?: string } | null;
    return corpo?.action !== "skipped";
  } catch {
    return false;
  }
}
