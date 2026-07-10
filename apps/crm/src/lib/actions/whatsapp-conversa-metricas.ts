"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";
import { phoneKey } from "@/lib/whatsapp-lead-lookup";

// ════════════════════════════════════════════════════════════════════════
// Métricas granulares de UMA conversa do espelho WhatsApp (painel direito,
// sob demanda). Foco em ENGAJAMENTO: tempo de resposta (mediana + p90), taxa
// de resposta por turnos, primeira resposta, iniciativa, atividade (dias
// ativos, aguardando há quanto tempo), mix de mídia e melhor faixa horária
// do lead. Só CEO (whatsapp_mensagens é CEO-only). Fonte: schema public.
// ════════════════════════════════════════════════════════════════════════

const MAX_MENSAGENS = 2000;
const RESPOSTA_MAX_HORAS = 72;
const MS_DIA = 86400000;
const phoneRe = /^\d{10,15}$/;

const FAIXA_LABELS = ["Madrugada", "Manhã", "Tarde", "Noite"] as const;

export interface FaixaHorario {
  faixa: string;
  recebidas: number;
}

export interface MidiaTipo {
  tipo: string;
  total: number;
}

export interface MetricasConversa {
  total: number;
  enviadas: number;
  recebidas: number;

  // ─── Tempo de resposta (minutos) ───
  nossaRespostaMedianaMin: number | null;
  nossaRespostaP90Min: number | null;
  leadRespostaMedianaMin: number | null;
  leadRespostaP90Min: number | null;
  /** Tempo do nosso 1º retorno à 1ª mensagem do lead (min). */
  tempoPrimeiraRespostaMin: number | null;

  // ─── Engajamento (turnos) ───
  /** % dos nossos blocos de fala que o lead respondeu. */
  taxaRespostaLeadPct: number | null;
  /** % dos blocos do lead que nós respondemos. */
  taxaRespostaNossaPct: number | null;
  /** A conversa começou por iniciativa do lead? */
  iniciadoPeloLead: boolean;

  // ─── Atividade ───
  primeiraMs: number | null;
  ultimaMs: number | null;
  /** Duração do relacionamento em dias (0 = mesmo dia). */
  duracaoDias: number;
  /** Dias-calendário (BRT) distintos com mensagem. */
  diasAtivos: number;
  /** Última mensagem foi nossa? */
  ultimaFromMe: boolean;
  /** Última mensagem foi do lead (devemos resposta). */
  aguardando: boolean;
  /** Se aguardando, há quantas horas o lead espera resposta. */
  aguardandoHoras: number | null;

  // ─── Volume / mídia ───
  midiaEnviadas: number;
  midiaRecebidas: number;
  /** Mídias não-texto agrupadas por tipo (desc). */
  midiaPorTipo: MidiaTipo[];

  // ─── Melhor horário (mensagens do lead por faixa BRT) ───
  faixasHorario: FaixaHorario[];

  /** A conversa excede o limite lido: histórico/duração refletem só a janela recente. */
  janelaTruncada: boolean;

  /** Agendamento do lead casado a esta conversa (null = telefone não casa com nenhum lead). */
  agendamento: AgendamentoConversa | null;
}

export interface AgendamentoConversa {
  atletaNome: string;
  /** Lead já agendou reunião? */
  agendou: boolean;
  /** 1ª mensagem enviada → agendamento (horas). null = ainda não agendou ou sem msg. */
  msgAteAgendarHoras: number | null;
  /** Sem agendamento: há quantas horas a 1ª mensagem espera resposta de agenda. */
  aguardandoAgendaHoras: number | null;
  /** Data marcada da reunião atual (estado do deal). */
  reuniaoData: string | null;
  reuniaoFutura: boolean;
  /** Nº de remarcações (audit trail do deal). */
  remarcacoes: number;
  /** 1º agendamento → 1ª remarcação (horas), quando houve remarcação. */
  agendamentoAteRemarcarHoras: number | null;
}

export type MetricasConversaResult =
  | { success: true; metricas: MetricasConversa }
  | { success: false; error: string };

interface Row {
  from_me: boolean;
  momment: string | null;
  created_at: string;
  tipo: string | null;
}

function mediana(v: number[]): number | null {
  return percentil(v, 0.5);
}

/** Percentil com interpolação linear (idx = (n-1)*p). */
function percentil(v: number[], p: number): number | null {
  if (v.length === 0) return null;
  if (v.length === 1) return v[0];
  const o = [...v].sort((a, b) => a - b);
  const idx = (o.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return o[lo];
  return o[lo] + (o[hi] - o[lo]) * (idx - lo);
}

function metricasVazias(): MetricasConversa {
  return {
    total: 0,
    enviadas: 0,
    recebidas: 0,
    nossaRespostaMedianaMin: null,
    nossaRespostaP90Min: null,
    leadRespostaMedianaMin: null,
    leadRespostaP90Min: null,
    tempoPrimeiraRespostaMin: null,
    taxaRespostaLeadPct: null,
    taxaRespostaNossaPct: null,
    iniciadoPeloLead: false,
    primeiraMs: null,
    ultimaMs: null,
    duracaoDias: 0,
    diasAtivos: 0,
    ultimaFromMe: false,
    aguardando: false,
    aguardandoHoras: null,
    midiaEnviadas: 0,
    midiaRecebidas: 0,
    midiaPorTipo: [],
    faixasHorario: FAIXA_LABELS.map((faixa) => ({ faixa, recebidas: 0 })),
    janelaTruncada: false,
    agendamento: null,
  };
}

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

/**
 * Casa o telefone da conversa com um lead (atleta OU responsável, via
 * phoneKey) e computa os tempos de agendamento: msg→agendou, remarcações
 * (audit trail do deal) e reunião atual. Enriquecimento não-crítico: qualquer
 * falha devolve null sem quebrar as métricas da conversa.
 */
async function buscarAgendamento(
  supabase: SupabaseServer,
  phone: string,
): Promise<AgendamentoConversa | null> {
  const chave = phoneKey(phone);
  if (!chave) return null;

  try {
    // Limit explícito: acima disso o PostgREST truncaria silencioso (cap 1000)
    // e o lead poderia não casar. Volume atual: centenas.
    const [{ data: atletas }, { data: responsaveis }] = await Promise.all([
      supabase
        .from("atletas")
        .select("id, nome_completo, whatsapp, responsavel_id, form_submission_id, created_at")
        .is("deleted_at", null)
        .limit(3000),
      supabase.from("responsaveis").select("id, whatsapp").limit(3000),
    ]);

    type AtletaRow = {
      id: string;
      nome_completo: string;
      whatsapp: string | null;
      responsavel_id: string | null;
      form_submission_id: string | null;
      created_at: string;
    };
    const listaAtletas = (atletas as AtletaRow[] | null) ?? [];
    const listaResp = (responsaveis as { id: string; whatsapp: string | null }[] | null) ?? [];

    // Match direto pelo número do atleta; senão, pelo número do responsável
    // (atleta mais recente vinculado a ele).
    let atleta = listaAtletas.find((a) => a.whatsapp && phoneKey(a.whatsapp) === chave) ?? null;
    if (!atleta) {
      const resp = listaResp.find((r) => r.whatsapp && phoneKey(r.whatsapp) === chave);
      if (resp) {
        atleta =
          listaAtletas
            .filter((a) => a.responsavel_id === resp.id)
            .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0] ?? null;
      }
    }
    if (!atleta) return null;

    const [formRes, dealRes] = await Promise.all([
      atleta.form_submission_id
        ? supabase
            .from("form_submissions")
            .select("whatsapp_sent_at, meeting_scheduled_at")
            .eq("id", atleta.form_submission_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
      supabase
        .from("deals")
        .select("id, reuniao_data")
        .eq("atleta_id", atleta.id)
        .is("deleted_at", null)
        .neq("etapa", "perdido")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const form = (formRes.data ?? null) as {
      whatsapp_sent_at: string | null;
      meeting_scheduled_at: string | null;
    } | null;
    const deal = (dealRes.data ?? null) as { id: string; reuniao_data: string | null } | null;

    // Remarcações: histórico de mudanças de reuniao_data no audit trail
    let remarcacoes = 0;
    let agendamentoAteRemarcarHoras: number | null = null;
    if (deal) {
      const { data: auditRows } = await supabase
        .from("audit_logs")
        .select("created_at")
        .eq("tabela", "deals")
        .eq("registro_id", deal.id)
        .contains("campos_alterados", ["reuniao_data"])
        .order("created_at", { ascending: true })
        .limit(50);
      const eventos = (auditRows as { created_at: string }[] | null) ?? [];
      if (eventos.length > 1) {
        remarcacoes = eventos.length - 1;
        const gap =
          (Date.parse(eventos[1].created_at) - Date.parse(eventos[0].created_at)) / 3_600_000;
        if (Number.isFinite(gap) && gap >= 0) agendamentoAteRemarcarHoras = gap;
      }
    }

    const enviadaEm = form?.whatsapp_sent_at ?? null;
    const agendadoEm = form?.meeting_scheduled_at ?? null;
    const agendou = Boolean(agendadoEm);

    let msgAteAgendarHoras: number | null = null;
    if (enviadaEm && agendadoEm) {
      const h = (Date.parse(agendadoEm) - Date.parse(enviadaEm)) / 3_600_000;
      if (Number.isFinite(h) && h >= 0) msgAteAgendarHoras = h;
    }
    let aguardandoAgendaHoras: number | null = null;
    if (!agendou && enviadaEm) {
      const h = (Date.now() - Date.parse(enviadaEm)) / 3_600_000;
      if (Number.isFinite(h) && h >= 0) aguardandoAgendaHoras = h;
    }

    return {
      atletaNome: atleta.nome_completo,
      agendou,
      msgAteAgendarHoras,
      aguardandoAgendaHoras,
      reuniaoData: deal?.reuniao_data ?? null,
      reuniaoFutura: Boolean(deal?.reuniao_data && Date.parse(deal.reuniao_data) > Date.now()),
      remarcacoes,
      agendamentoAteRemarcarHoras,
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "buscar_agendamento_conversa",
      error: err instanceof Error ? err.name : "unknown",
    });
    return null;
  }
}

export async function fetchMetricasConversa(input: {
  phone: string;
  lid?: string | null;
}): Promise<MetricasConversaResult> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas o CEO pode ver as métricas." };
  }
  const phone = (input.phone ?? "").replace(/\D/g, "");
  if (!phoneRe.test(phone)) return { success: false, error: "Telefone inválido." };
  const lid = (input.lid ?? "").replace(/\D/g, "");
  const chaves = lid && lid !== phone ? [phone, lid] : [phone];

  try {
    const supabase = await createServerSupabaseClient();
    // DESC + limit: se a conversa passar de MAX_MENSAGENS, mantém as RECENTES
    // (última msg / "aguardando" corretos) — reordena p/ cronológico em JS.
    const [{ data, error }, agendamento] = await Promise.all([
      supabase
        .from("whatsapp_mensagens")
        .select("from_me, momment, created_at, tipo")
        .in("phone", chaves)
        .order("created_at", { ascending: false })
        .limit(MAX_MENSAGENS),
      buscarAgendamento(supabase, phone),
    ]);

    if (error) return { success: false, error: "Não foi possível carregar as métricas." };
    const rows = (data as Row[] | null) ?? [];
    if (rows.length === 0) {
      return { success: true, metricas: { ...metricasVazias(), agendamento } };
    }

    const tempoMs = (r: Row) => Date.parse(r.momment ?? r.created_at);
    const ordenada = [...rows].sort((a, b) => tempoMs(a) - tempoMs(b));

    // Formatação em BRT (UTC-3, sem DST) para dia-ativo e faixa horária.
    const diaFmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const horaFmt = new Intl.DateTimeFormat("en-GB", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      hourCycle: "h23",
    });
    const brtHora = (ms: number) => parseInt(horaFmt.format(new Date(ms)), 10) || 0;

    let enviadas = 0;
    let recebidas = 0;
    let midiaEnviadas = 0;
    let midiaRecebidas = 0;
    const nossosGaps: number[] = [];
    const leadGaps: number[] = [];
    const midiaTipos = new Map<string, number>();
    const diasSet = new Set<string>();
    const faixas = [0, 0, 0, 0];
    const blocos: boolean[] = [];
    let anterior: Row | null = null;
    let ultimoBloco: boolean | null = null;

    for (const r of ordenada) {
      const t = tempoMs(r);
      if (r.from_me) enviadas++;
      else recebidas++;

      const tp = (r.tipo ?? "text").toLowerCase();
      if (tp !== "text") {
        if (r.from_me) midiaEnviadas++;
        else midiaRecebidas++;
        midiaTipos.set(tp, (midiaTipos.get(tp) ?? 0) + 1);
      }

      diasSet.add(diaFmt.format(new Date(t)));

      // Faixa horária só das mensagens do lead (quando ele está ativo).
      if (!r.from_me) {
        const h = brtHora(t);
        const bin = h < 6 ? 0 : h < 12 ? 1 : h < 18 ? 2 : 3;
        faixas[bin]++;
      }

      // Gap de resposta em transições de remetente (dentro da janela válida).
      if (anterior && anterior.from_me !== r.from_me) {
        const gap = (t - tempoMs(anterior)) / 60000;
        if (gap >= 0 && gap <= RESPOSTA_MAX_HORAS * 60) {
          if (r.from_me) nossosGaps.push(gap);
          else leadGaps.push(gap);
        }
      }

      // Blocos de fala consecutivos do mesmo remetente (para taxa de resposta).
      if (ultimoBloco === null || ultimoBloco !== r.from_me) {
        blocos.push(r.from_me);
        ultimoBloco = r.from_me;
      }

      anterior = r;
    }

    // Taxa de resposta por turnos: um bloco é "respondido" se existe um bloco
    // seguinte (que, por construção, é do remetente oposto).
    let nossosBlocos = 0;
    let nossosRespondidos = 0;
    let leadBlocos = 0;
    let leadRespondidos = 0;
    for (let i = 0; i < blocos.length; i++) {
      const respondido = i < blocos.length - 1;
      if (blocos[i]) {
        nossosBlocos++;
        if (respondido) nossosRespondidos++;
      } else {
        leadBlocos++;
        if (respondido) leadRespondidos++;
      }
    }

    // Nosso 1º retorno à 1ª mensagem do lead.
    const primeiroLeadIdx = ordenada.findIndex((r) => !r.from_me);
    let tempoPrimeiraRespostaMin: number | null = null;
    if (primeiroLeadIdx >= 0) {
      const nossaResp = ordenada.slice(primeiroLeadIdx + 1).find((r) => r.from_me);
      if (nossaResp) {
        tempoPrimeiraRespostaMin =
          (tempoMs(nossaResp) - tempoMs(ordenada[primeiroLeadIdx])) / 60000;
      }
    }

    const primeira = ordenada[0];
    const ultima = ordenada[ordenada.length - 1];
    const primeiraMs = tempoMs(primeira);
    const ultimaMs = tempoMs(ultima);
    const aguardando = !ultima.from_me;

    const midiaPorTipo = [...midiaTipos.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([tipo, total]) => ({ tipo, total }));

    return {
      success: true,
      metricas: {
        total: ordenada.length,
        enviadas,
        recebidas,
        nossaRespostaMedianaMin: mediana(nossosGaps),
        nossaRespostaP90Min: percentil(nossosGaps, 0.9),
        leadRespostaMedianaMin: mediana(leadGaps),
        leadRespostaP90Min: percentil(leadGaps, 0.9),
        tempoPrimeiraRespostaMin,
        taxaRespostaLeadPct: nossosBlocos > 0 ? (nossosRespondidos / nossosBlocos) * 100 : null,
        taxaRespostaNossaPct: leadBlocos > 0 ? (leadRespondidos / leadBlocos) * 100 : null,
        iniciadoPeloLead: !primeira.from_me,
        primeiraMs,
        ultimaMs,
        duracaoDias: Math.max(0, Math.floor((ultimaMs - primeiraMs) / MS_DIA)),
        diasAtivos: diasSet.size,
        ultimaFromMe: ultima.from_me,
        aguardando,
        aguardandoHoras: aguardando ? Math.max(0, (Date.now() - ultimaMs) / 3600000) : null,
        midiaEnviadas,
        midiaRecebidas,
        midiaPorTipo,
        faixasHorario: FAIXA_LABELS.map((faixa, i) => ({ faixa, recebidas: faixas[i] })),
        janelaTruncada: rows.length >= MAX_MENSAGENS,
        agendamento,
      },
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "fetch_metricas_conversa",
      error: err instanceof Error ? err.name : "unknown",
    });
    return { success: false, error: "Erro ao carregar as métricas." };
  }
}
