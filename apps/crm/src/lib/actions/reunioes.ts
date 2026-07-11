"use server";

import { revalidatePath } from "next/cache";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { isCeoLevel } from "@/lib/papel";

export type ReuniaoStatus =
  | "agendada"
  | "realizada"
  | "cancelada"
  | "reagendada";

export interface ReuniaoFamilia {
  id: string;
  experiencia_id: string;
  etapa_estado_id: string | null;
  titulo: string;
  assuntos: string[];
  data_hora: string;
  duracao_minutos: number;
  link_reuniao: string | null;
  /** Id do evento no Google Calendar (criado via CF calendar-create-event). */
  google_event_id: string | null;
  status: ReuniaoStatus;
  participantes: string[];
  notas_realizacao: string | null;
  assuntos_discutidos: string[];
  realizada_at: string | null;
  cancelada_motivo: string | null;
  cancelada_at: string | null;
  created_at: string;
}

async function requireHeadOrCeo() {
  const papel = await getUserPapel();
  if (!papel || (!isCeoLevel(papel) && papel !== "head_sucesso")) return null;
  return papel;
}

async function notifyCeos(
  supabase: Awaited<ReturnType<typeof createAuditedSupabaseClient>>,
  payload: {
    titulo: string;
    mensagem: string;
    tipo: string;
    severidade: "baixa" | "media" | "alta" | "critica";
  },
) {
  const { data: ceos } = await supabase
    .from("user_profiles")
    .select("id")
    .in("papel", ["ceo", "cto"])
    .eq("ativo", true);
  if (!ceos || ceos.length === 0) return;
  await supabase.from("notificacoes").insert(
    ceos.map((c) => ({
      destinatario_id: c.id,
      ...payload,
      link: "/war-room/familias-onboarding",
    })),
  );
}

// ─── Google Calendar (CF calendar-create-event) ─────────────
// Mesmo contrato/envs do consumidor de referência (agenda.ts):
// POST { athleteName, guardianName, leadEmail, startIso, duracaoMin,
// observacao } com header x-webhook-secret → { success, eventId,
// htmlLink, hangoutLink, meetCriado, conviteEnviado }.

const CALENDAR_TIMEOUT_MS = 30_000;
const DURACAO_PADRAO_MIN = 30;
// Faixa aceita pela CF — fora dela ela RESETA para 60min; clampamos aqui
// para o evento ficar o mais próximo possível da duração real da reunião.
const CF_DURACAO_MIN = 15;
const CF_DURACAO_MAX = 240;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface EventoCalendarArgs {
  nomeAtleta: string;
  titulo: string;
  convidadoEmail: string | null;
  startIso: string;
  duracaoMin: number;
  assuntos: string[];
}

type EventoCalendarResult =
  | {
      success: true;
      eventId: string;
      hangoutLink: string | null;
      htmlLink: string | null;
    }
  | { success: false; error: string };

/** Cria o evento no Calendar do CEO via CF calendar-create-event.
 *  Nunca lança — qualquer falha vira { success: false } para a action
 *  degradar graciosamente (a reunião é criada mesmo sem evento). */
async function criarEventoCalendar(
  args: EventoCalendarArgs,
): Promise<EventoCalendarResult> {
  const url = process.env.CALENDAR_CREATE_EVENT_URL;
  const secret = process.env.WEBHOOK_SECRET;
  if (!url || !secret) {
    return {
      success: false,
      error: "Integração com o Calendar não configurada (CALENDAR_CREATE_EVENT_URL).",
    };
  }

  const startMs = Date.parse(args.startIso ?? "");
  if (!Number.isFinite(startMs)) {
    return { success: false, error: "Data/hora inválida para o evento." };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CALENDAR_TIMEOUT_MS);
    let resposta: Response;
    try {
      resposta = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
        body: JSON.stringify({
          // A CF monta o título como `Reunião — <athleteName> (<guardianName>)`;
          // com athleteName="Família <atleta>" e guardianName=<título> o evento
          // vira "Reunião — Família <atleta> (<título>)".
          athleteName: `Família ${args.nomeAtleta}`,
          guardianName: args.titulo,
          leadEmail: args.convidadoEmail,
          // NUNCA enviar phone: a CF escreveria o telefone na descrição e o
          // calendar-webhook casaria o evento como reunião COMERCIAL do lead
          // (confirmação WhatsApp + deal→reuniao_marcada) — fluxo errado para
          // uma reunião de pós-venda/LRM.
          startIso: new Date(startMs).toISOString(),
          duracaoMin: Math.min(Math.max(args.duracaoMin, CF_DURACAO_MIN), CF_DURACAO_MAX),
          observacao:
            args.assuntos.length > 0 ? `Pauta: ${args.assuntos.join("; ")}` : "",
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
      error?: string;
    } | null;
    if (!resposta.ok || !corpo?.success || !corpo.eventId) {
      return {
        success: false,
        error: corpo?.error ?? `Calendar indisponível (HTTP ${resposta.status}).`,
      };
    }
    return {
      success: true,
      eventId: corpo.eventId,
      hangoutLink: corpo.hangoutLink ?? null,
      htmlLink: corpo.htmlLink ?? null,
    };
  } catch {
    return {
      success: false,
      error: "Falha de rede/timeout ao criar o evento no Calendar.",
    };
  }
}

// ─── Listar reuniões de uma família ─────────────────────────
export async function listarReunioesFamilia(
  experienciaId: string,
): Promise<ReuniaoFamilia[]> {
  const papel = await requireHeadOrCeo();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("reunioes_familia")
    .select("*")
    .eq("experiencia_id", experienciaId)
    .is("deleted_at", null)
    .order("data_hora", { ascending: false });
  return (data ?? []) as ReuniaoFamilia[];
}

// ─── Criar reunião + notificar CEO ──────────────────────────
export type CriarReuniaoResult =
  | { success: false; error: string }
  | {
      success: true;
      reuniaoId: string;
      /** undefined = evento no Calendar não foi solicitado. */
      calendarCriado?: boolean;
      /** Presente quando calendarCriado=false — aviso curto para a UI. */
      calendarAviso?: string;
    };

export async function criarReuniao(
  experienciaId: string,
  dados: {
    titulo: string;
    assuntos: string[];
    data_hora: string; // ISO
    duracao_minutos?: number;
    link_reuniao?: string;
    etapa_estado_id?: string;
    participantes?: string[];
    /** Criar o evento real no Google Calendar do CEO (Meet automático). */
    criar_no_calendar?: boolean;
    /** E-mail do responsável/família — a CF tenta convidar quando possível. */
    convidado_email?: string;
  },
): Promise<CriarReuniaoResult> {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!dados.titulo.trim()) return { success: false, error: "Título é obrigatório." };
  if (!dados.data_hora) return { success: false, error: "Data/hora é obrigatória." };

  const convidadoEmail = dados.convidado_email?.trim().toLowerCase() || null;
  if (convidadoEmail && !EMAIL_REGEX.test(convidadoEmail)) {
    return { success: false, error: "E-mail do convidado inválido." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Vínculo com etapa do onboarding: só etapa aberta e da MESMA família
  // (o gate de conclusão conta reuniões por etapa_estado_id — vínculo
  // cruzado satisfaria o gate de outra família)
  if (dados.etapa_estado_id) {
    const { data: etapa } = await supabase
      .from("onboarding_etapa_estado")
      .select("id, status, instancia:onboarding_instancias(experiencia_id)")
      .eq("id", dados.etapa_estado_id)
      .maybeSingle();

    const instRaw = etapa?.instancia as unknown;
    const instObj = (Array.isArray(instRaw) ? instRaw[0] : instRaw) as
      | { experiencia_id?: string }
      | null;

    if (
      !etapa ||
      (etapa.status !== "pendente" && etapa.status !== "em_andamento") ||
      instObj?.experiencia_id !== experienciaId
    ) {
      return {
        success: false,
        error:
          "A etapa selecionada não está mais disponível para vínculo. Recarregue e tente novamente.",
      };
    }
  }

  // Nome do atleta — usado no título do evento do Calendar e na notificação
  let nomeAtleta = "atleta";
  try {
    const { data: exp } = await supabase
      .from("crm_experiencia")
      .select("atleta:atletas(nome_completo)")
      .eq("id", experienciaId)
      .maybeSingle();
    const rawA = exp?.atleta as unknown;
    const ao = (Array.isArray(rawA) ? rawA[0] : rawA) as { nome_completo?: string } | null;
    nomeAtleta = ao?.nome_completo ?? "atleta";
  } catch (e) {
    console.warn("[criarReuniao] atleta lookup failed", e);
  }

  // Evento no Google Calendar (opcional) — ANTES do INSERT para gravar o
  // link do Meet e o google_event_id junto com a reunião. Falha da CF NÃO
  // bloqueia o agendamento (degradação graciosa).
  const linkManual = dados.link_reuniao?.trim() || null;
  const assuntosLimpos = dados.assuntos.filter((a) => a.trim()).map((a) => a.trim());
  let linkReuniao = linkManual;
  let googleEventId: string | null = null;
  let calendarCriado: boolean | undefined;
  let calendarAviso: string | undefined;

  if (dados.criar_no_calendar) {
    const evento = await criarEventoCalendar({
      nomeAtleta,
      titulo: dados.titulo.trim(),
      convidadoEmail,
      startIso: dados.data_hora,
      duracaoMin: dados.duracao_minutos ?? DURACAO_PADRAO_MIN,
      assuntos: assuntosLimpos,
    });
    if (evento.success) {
      googleEventId = evento.eventId;
      calendarCriado = true;
      // Link manual digitado VENCE o gerado pelo Calendar
      if (!linkManual) linkReuniao = evento.hangoutLink ?? evento.htmlLink ?? null;
    } else {
      calendarCriado = false;
      calendarAviso = `Evento não criado no Calendar: ${evento.error} A reunião foi agendada só no Engine.`;
      console.warn({
        level: "warn",
        action: "criar_reuniao_calendar_falhou",
        experienciaId,
        error: evento.error,
      });
    }
  }

  const { data, error } = await supabase
    .from("reunioes_familia")
    .insert({
      experiencia_id: experienciaId,
      etapa_estado_id: dados.etapa_estado_id ?? null,
      titulo: dados.titulo.trim(),
      assuntos: assuntosLimpos,
      data_hora: dados.data_hora,
      duracao_minutos: dados.duracao_minutos ?? DURACAO_PADRAO_MIN,
      link_reuniao: linkReuniao,
      google_event_id: googleEventId,
      participantes: dados.participantes ?? [],
      status: "agendada",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (error) {
    // Evento pode ter sido criado no Calendar sem a reunião correspondente —
    // logar o id para o CEO remover manualmente (a CF não tem delete).
    if (googleEventId) {
      console.warn({
        level: "warn",
        action: "criar_reuniao_insert_falhou_com_evento",
        googleEventId,
        error: error.message,
      });
    }
    return { success: false, error: error.message };
  }

  // Notificar CEO (inclui o link final — manual ou Meet gerado)
  try {
    await notifyCeos(supabase, {
      titulo: `Reuniao agendada com ${nomeAtleta}`,
      mensagem: `${dados.titulo} em ${new Date(dados.data_hora).toLocaleString("pt-BR")}.` +
        (linkReuniao ? ` Link: ${linkReuniao}` : "") +
        (assuntosLimpos.length > 0 ? ` Assuntos: ${assuntosLimpos.join(", ")}` : ""),
      tipo: "reuniao_agendada",
      severidade: "media",
    });
  } catch (e) {
    console.warn("[criarReuniao] notif failed", e);
  }

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return { success: true, reuniaoId: data.id, calendarCriado, calendarAviso };
}

// ─── Confirmar reunião como realizada ───────────────────────
export async function confirmarReuniaoRealizada(
  reuniaoId: string,
  dados: {
    notas_realizacao: string;
    assuntos_discutidos?: string[];
  },
) {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!dados.notas_realizacao.trim()) {
    return { success: false, error: "Notas da reunião são obrigatórias." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { data: reuniao } = await supabase
    .from("reunioes_familia")
    .select("titulo, experiencia_id")
    .eq("id", reuniaoId)
    .maybeSingle();

  const { error } = await supabase
    .from("reunioes_familia")
    .update({
      status: "realizada",
      realizada_at: new Date().toISOString(),
      notas_realizacao: dados.notas_realizacao.trim(),
      assuntos_discutidos: (dados.assuntos_discutidos ?? [])
        .filter((a) => a.trim())
        .map((a) => a.trim()),
    })
    .eq("id", reuniaoId);

  if (error) return { success: false, error: error.message };

  // Notificar CEO
  try {
    if (reuniao?.experiencia_id) {
      const { data: exp } = await supabase
        .from("crm_experiencia")
        .select("atleta:atletas(nome_completo)")
        .eq("id", reuniao.experiencia_id)
        .maybeSingle();
      const rawA = exp?.atleta as unknown;
      const ao = (Array.isArray(rawA) ? rawA[0] : rawA) as { nome_completo?: string } | null;
      const nome = ao?.nome_completo ?? "atleta";

      await notifyCeos(supabase, {
        titulo: `Reuniao realizada: ${nome}`,
        mensagem: `${reuniao.titulo} concluida. Notas: ${dados.notas_realizacao.slice(0, 180)}${dados.notas_realizacao.length > 180 ? "..." : ""}`,
        tipo: "reuniao_realizada",
        severidade: "baixa",
      });
    }
  } catch (e) {
    console.warn("[confirmarReuniaoRealizada] notif failed", e);
  }

  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return { success: true };
}

// ─── Cancelar reunião ───────────────────────────────────────
// Limitação conhecida: a CF calendar-create-event NÃO tem caminho de
// delete — se a reunião tem google_event_id, o evento permanece no
// Calendar e a UI avisa o usuário para cancelá-lo por lá.
export type CancelarReuniaoResult =
  | { success: false; error: string }
  | { success: true; avisoCalendar?: string };

export async function cancelarReuniao(
  reuniaoId: string,
  motivo: string,
): Promise<CancelarReuniaoResult> {
  const papel = await requireHeadOrCeo();
  if (!papel) return { success: false, error: "Sem permissão." };
  if (!motivo.trim()) return { success: false, error: "Motivo é obrigatório." };

  const supabase = await createAuditedSupabaseClient();

  const { data: reuniao } = await supabase
    .from("reunioes_familia")
    .select("google_event_id")
    .eq("id", reuniaoId)
    .maybeSingle();

  const { error } = await supabase
    .from("reunioes_familia")
    .update({
      status: "cancelada",
      cancelada_at: new Date().toISOString(),
      cancelada_motivo: motivo.trim(),
    })
    .eq("id", reuniaoId);

  if (error) return { success: false, error: error.message };
  revalidatePath("/familias-crm");
  revalidatePath("/familias-pipeline");
  revalidatePath("/minha-area");
  revalidatePath("/war-room");
  return {
    success: true,
    ...(reuniao?.google_event_id
      ? {
          avisoCalendar:
            "Cancele também no Google Calendar — o evento não é removido automaticamente.",
        }
      : {}),
  };
}

// ─── Próximas reuniões agendadas (vista global ou por familia) ─
export interface ProximaReuniaoResumo {
  id: string;
  experiencia_id: string;
  titulo: string;
  data_hora: string;
  link_reuniao: string | null;
  assuntos: string[];
  experiencia: { atleta: { nome_completo: string } | null } | null;
}

export async function listarProximasReunioes(
  limit: number = 20,
): Promise<ProximaReuniaoResumo[]> {
  const papel = await requireHeadOrCeo();
  if (!papel) return [];

  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("reunioes_familia")
    .select(
      "id, experiencia_id, titulo, data_hora, link_reuniao, assuntos, status, " +
      "experiencia:crm_experiencia(atleta:atletas(nome_completo))",
    )
    .eq("status", "agendada")
    .gte("data_hora", new Date().toISOString())
    .is("deleted_at", null)
    .order("data_hora", { ascending: true })
    .limit(limit);

  // Normalizar: Supabase devolve `experiencia` como array OU objeto
  type RawRow = {
    id: string;
    experiencia_id: string;
    titulo: string;
    data_hora: string;
    link_reuniao: string | null;
    assuntos: string[];
    experiencia?:
      | { atleta?: { nome_completo?: string } | null | { nome_completo?: string }[] }
      | { atleta?: { nome_completo?: string } | null }[]
      | null;
  };
  const rows = (data ?? []) as unknown as RawRow[];
  return rows.map((r) => {
    const expRaw = r.experiencia;
    const expObj = Array.isArray(expRaw) ? expRaw[0] : expRaw;
    const atletaRaw = expObj?.atleta;
    const atletaObj = Array.isArray(atletaRaw) ? atletaRaw[0] : atletaRaw;
    return {
      id: r.id,
      experiencia_id: r.experiencia_id,
      titulo: r.titulo,
      data_hora: r.data_hora,
      link_reuniao: r.link_reuniao,
      assuntos: r.assuntos ?? [],
      experiencia: expObj
        ? {
            atleta: atletaObj?.nome_completo
              ? { nome_completo: atletaObj.nome_completo }
              : null,
          }
        : null,
    };
  });
}
