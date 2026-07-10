"use server";

import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";

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
  };
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
    const { data, error } = await supabase
      .from("whatsapp_mensagens")
      .select("from_me, momment, created_at, tipo")
      .in("phone", chaves)
      .order("created_at", { ascending: false })
      .limit(MAX_MENSAGENS);

    if (error) return { success: false, error: "Não foi possível carregar as métricas." };
    const rows = (data as Row[] | null) ?? [];
    if (rows.length === 0) {
      return { success: true, metricas: metricasVazias() };
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
