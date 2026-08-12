"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { promoverLead } from "@/lib/actions/leads";

/**
 * Agenda ligada ao Google Calendar de verdade.
 *
 * A tela antiga listava `deals.reuniao_data` — ou seja, só as reuniões que
 * já tinham virado deal. Reunião no Calendar sem lead correspondente ficava
 * invisível, e o CEO usava a tela como se fosse a agenda dele (incidente
 * 12/08/2026: 3 reuniões no dia, 1 na tela).
 *
 * Aqui o Calendar é a fonte da verdade; o CRM enriquece.
 */

export interface EventoAgenda {
  eventId: string;
  titulo: string;
  inicio: string | null;
  fim: string | null;
  diaInteiro: boolean;
  meetLink: string | null;
  htmlLink: string | null;
  emails: string[];
  telefone: string | null;
  descricao: string;
  leadId: string | null;
  athleteName: string | null;
  guardianName: string | null;
  classificacao: string | null;
  meetingScheduled: boolean;
  /** Preenchido no Engine, cruzando o lead com o pipeline. */
  dealId?: string | null;
  etapa?: string | null;
}

type Result<T = undefined> =
  | ({ success: true } & (T extends undefined ? object : { data: T }))
  | { success: false; error: string };

const SEM_CONFIG =
  "Integração com o Calendar não configurada (CALENDAR_WEBHOOK_URL + WEBHOOK_SECRET).";

async function exigirCeo(): Promise<string | null> {
  return (await getUserPapel()) === "ceo" ? null : "Apenas o CEO pode gerenciar a agenda.";
}

/**
 * Eventos do Calendar na janela, já com o vínculo resolvido.
 *
 * Falha da CF NÃO derruba a tela: a Agenda continua renderizando as
 * reuniões do banco e mostra o aviso. Antes de existir esta integração a
 * tela era 100% banco — degradar para isso é o pior caso aceitável.
 */
export async function getEventosCalendar(
  desde: string,
  ate: string,
): Promise<Result<EventoAgenda[]>> {
  const erro = await exigirCeo();
  if (erro) return { success: false, error: erro };

  const url = process.env.CALENDAR_WEBHOOK_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url || !secret) return { success: false, error: SEM_CONFIG };

  try {
    const alvo = new URL(url);
    alvo.searchParams.set("action", "agenda");
    alvo.searchParams.set("desde", desde);
    alvo.searchParams.set("ate", ate);

    const res = await fetch(alvo.toString(), {
      method: "GET",
      headers: { "x-webhook-secret": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      return { success: false, error: `Calendar respondeu ${res.status}.` };
    }
    const json = (await res.json()) as { success: boolean; eventos?: EventoAgenda[]; error?: string };
    if (!json.success) return { success: false, error: json.error ?? "Falha ao ler o Calendar." };

    const eventos = json.eventos ?? [];
    return { success: true, data: await enriquecerComDeal(eventos) };
  } catch (e) {
    console.error({ level: "error", action: "get_eventos_calendar", erro: String(e) });
    return { success: false, error: "Não foi possível falar com o Calendar agora." };
  }
}

/** Cruza os leads dos eventos com o pipeline para trazer deal e etapa. */
async function enriquecerComDeal(eventos: EventoAgenda[]): Promise<EventoAgenda[]> {
  const leadIds = [...new Set(eventos.map((e) => e.leadId).filter(Boolean))] as string[];
  if (!leadIds.length) return eventos;

  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("atletas")
    .select("form_submission_id, deals(id, etapa, deleted_at)")
    .in("form_submission_id", leadIds)
    .is("deleted_at", null);

  const porLead = new Map<string, { dealId: string; etapa: string }>();
  for (const a of (data ?? []) as unknown as Array<{
    form_submission_id: string;
    deals: { id: string; etapa: string; deleted_at: string | null }[] | null;
  }>) {
    const ativo = (a.deals ?? []).find((d) => !d.deleted_at);
    if (ativo) porLead.set(a.form_submission_id, { dealId: ativo.id, etapa: ativo.etapa });
  }

  return eventos.map((e) => ({
    ...e,
    dealId: e.leadId ? porLead.get(e.leadId)?.dealId ?? null : null,
    etapa: e.leadId ? porLead.get(e.leadId)?.etapa ?? null : null,
  }));
}

// ─── Vínculo manual ──────────────────────────────────────────────────────

const vincularSchema = z.object({
  leadId: z.string().uuid(),
  eventId: z.string().min(1).max(1024),
  inicio: z.string().min(1),
  meetLink: z.string().url().nullable().optional(),
});

/**
 * Liga um evento do Calendar a um lead que já existe.
 *
 * Não dispara WhatsApp: é uma correção de cadastro feita pelo CEO, muitas
 * vezes de reunião que já aconteceu — mensagem automática aqui seria pior
 * que silêncio. A confirmação continua sendo do webhook, no fluxo normal.
 */
export async function vincularEventoALead(input: unknown): Promise<Result> {
  const erro = await exigirCeo();
  if (erro) return { success: false, error: erro };
  const parsed = vincularSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const { leadId, eventId, inicio, meetLink } = parsed.data;

  try {
    const supabase = await createAuditedSupabaseClient();
    const agora = new Date().toISOString();

    const { error: erroLead } = await supabase
      .from("form_submissions")
      .update({ meeting_scheduled: true, meeting_scheduled_at: agora })
      .eq("id", leadId);
    if (erroLead) return { success: false, error: `Não foi possível marcar: ${erroLead.message}` };

    const { data: atleta } = await supabase
      .from("atletas")
      .select("id")
      .eq("form_submission_id", leadId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!atleta) {
      return {
        success: false,
        error: "Lead marcado, mas ele ainda não está no pipeline (sem atleta/deal).",
      };
    }

    const { data: deal } = await supabase
      .from("deals")
      .select("id, etapa")
      .eq("atleta_id", atleta.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!deal) return { success: false, error: "Lead sem deal no pipeline." };

    // Só avança a etapa se o deal ainda está no começo — não puxar de volta
    // um deal que já está em proposta/contrato por causa de um vínculo.
    const patch: Record<string, unknown> = {
      reuniao_data: inicio,
      reuniao_link: meetLink ?? null,
      google_calendar_event_id: eventId,
      reuniao_agendada_at: agora,
    };
    if (deal.etapa === "lead" || deal.etapa === "contato_feito") {
      patch.etapa = "reuniao_marcada";
    }

    const { error: erroDeal } = await supabase.from("deals").update(patch).eq("id", deal.id);
    if (erroDeal) return { success: false, error: `Não foi possível vincular: ${erroDeal.message}` };

    revalidatePath("/agenda");
    revalidatePath("/pipeline");
    return { success: true };
  } catch (e) {
    console.error({ level: "error", action: "vincular_evento", eventId, erro: String(e) });
    return { success: false, error: "Falha ao vincular. Tente de novo." };
  }
}

// ─── Busca de leads para o vínculo ───────────────────────────────────────

export interface LeadBusca {
  id: string;
  athleteName: string;
  guardianName: string | null;
  email: string | null;
  classificacao: string | null;
  jaTemReuniao: boolean;
}

export async function buscarLeadsParaVincular(termo: string): Promise<LeadBusca[]> {
  if ((await getUserPapel()) !== "ceo") return [];
  const q = termo.trim();
  if (q.length < 2) return [];

  const supabase = await createServerSupabaseClient();
  const escapado = q.replace(/[%,()]/g, " ");
  const { data } = await supabase
    .from("form_submissions")
    .select("id, athlete_name, guardian_name, email, qualification_classification, meeting_scheduled")
    .or(
      `athlete_name.ilike.%${escapado}%,guardian_name.ilike.%${escapado}%,` +
        `email.ilike.%${escapado}%,guardian_email.ilike.%${escapado}%`,
    )
    .order("submitted_at", { ascending: false })
    .limit(20);

  return ((data ?? []) as unknown as Array<{
    id: string;
    athlete_name: string;
    guardian_name: string | null;
    email: string | null;
    qualification_classification: string | null;
    meeting_scheduled: boolean | null;
  }>).map((l) => ({
    id: l.id,
    athleteName: l.athlete_name,
    guardianName: l.guardian_name,
    email: l.email,
    classificacao: l.qualification_classification,
    jaTemReuniao: l.meeting_scheduled === true,
  }));
}

// ─── Criar lead a partir do evento ───────────────────────────────────────

const criarLeadSchema = z.object({
  eventId: z.string().min(1).max(1024),
  inicio: z.string().min(1),
  meetLink: z.string().url().nullable().optional(),
  athleteName: z.string().trim().min(3, "Informe o nome do atleta.").max(120),
  guardianName: z.string().trim().max(120).nullable().optional(),
  email: z.string().trim().email("E-mail inválido."),
  whatsapp: z.string().trim().max(32).nullable().optional(),
});

/**
 * Cria o lead a partir dos dados do evento e já o vincula.
 *
 * Para quem agendou sem passar pelo formulário. O registro nasce SEM
 * classificação da IA (não há respostas para qualificar) e já aprovado —
 * o CEO está criando à mão, o gate humano já aconteceu aqui.
 */
export async function criarLeadDeEvento(input: unknown): Promise<Result<{ leadId: string }>> {
  const erro = await exigirCeo();
  if (erro) return { success: false, error: erro };
  const parsed = criarLeadSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const d = parsed.data;

  try {
    const supabase = await createAuditedSupabaseClient();
    const agora = new Date().toISOString();

    // UNIQUE(email, athlete_name): se já existe, reaproveita em vez de
    // estourar 23505 na cara do CEO.
    const { data: existente } = await supabase
      .from("form_submissions")
      .select("id")
      .eq("email", d.email)
      .eq("athlete_name", d.athleteName)
      .maybeSingle();

    let leadId = existente?.id as string | undefined;

    if (!leadId) {
      const { data: criado, error: erroInsert } = await supabase
        .from("form_submissions")
        .insert({
          athlete_name: d.athleteName,
          email: d.email,
          guardian_name: d.guardianName ?? null,
          guardian_email: d.email,
          guardian_whatsapp: d.whatsapp ?? null,
          submitted_at: agora,
          meeting_scheduled: true,
          meeting_scheduled_at: agora,
          aprovacao_status: "aprovado",
          aprovacao_decidida_em: agora,
          aprovacao_motivo: "Lead criado manualmente a partir de reunião no Calendar",
        })
        .select("id")
        .maybeSingle();
      if (erroInsert || !criado) {
        return { success: false, error: `Não foi possível criar o lead: ${erroInsert?.message}` };
      }
      leadId = criado.id;
    }

    if (!leadId) return { success: false, error: "Não foi possível criar o lead." };

    // Coloca no pipeline reusando a promoção oficial (cria responsável,
    // endereço, atleta e deal com as mesmas regras da tela de Leads).
    // Sem isto o vínculo abaixo falharia por não achar atleta/deal.
    const promocao = await promoverLead(leadId);
    if (!promocao.success) {
      return {
        success: false,
        error: `Lead criado, mas não entrou no pipeline: ${promocao.error}`,
      };
    }

    const vinculo = await vincularEventoALead({
      leadId,
      eventId: d.eventId,
      inicio: d.inicio,
      meetLink: d.meetLink ?? null,
    });
    // Lead criado é o que importa; se o pipeline ainda não tem o atleta, o
    // CEO vê a mensagem e resolve — não perde o cadastro.
    if (!vinculo.success) return { success: false, error: vinculo.error };

    revalidatePath("/agenda");
    revalidatePath("/leads");
    return { success: true, data: { leadId } };
  } catch (e) {
    console.error({ level: "error", action: "criar_lead_de_evento", erro: String(e) });
    return { success: false, error: "Falha ao criar o lead. Tente de novo." };
  }
}
