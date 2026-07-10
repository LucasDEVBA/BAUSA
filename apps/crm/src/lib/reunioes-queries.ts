import { createServerSupabaseClient } from "@/lib/supabase-server";
import { distribuicao, type Distribuicao } from "@/lib/conversas-queries";

// ════════════════════════════════════════════════════════════════════════
// Analytics de REUNIÕES — agendamentos, remarcações e tempos do ciclo.
//
// Fontes:
//  • form_submissions — created_at (1º contato), whatsapp_sent_at (1ª msg),
//    meeting_scheduled_at (1º agendamento, setado UMA vez pelo webhook).
//  • deals — reuniao_data (estado ATUAL, sobrescrito em remarcação),
//    reuniao_realizada_at, etapa.
//  • audit_logs — ÚNICA fonte histórica de remarcações: o trigger de audit
//    grava cada UPDATE de deals com campos_alterados; filtramos
//    cs.{reuniao_data}. 1ª row por deal = 1º agendamento; as demais =
//    remarcações (resync do webhook ou relink manual).
//  • reunioes_transcricoes — proxy de "reunião de fato aconteceu".
// ════════════════════════════════════════════════════════════════════════

export type ReunioesPeriod = "30d" | "90d" | "6m" | "12m" | "tudo";

const PERIOD_DIAS: Record<Exclude<ReunioesPeriod, "tudo">, number> = {
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "12m": 365,
};

const FETCH_LIMIT = 3000;
const AUDIT_LIMIT = 5000;
const MS_HORA = 3_600_000;

function inicioMs(period: ReunioesPeriod): number | null {
  if (period === "tudo") return null;
  return Date.now() - PERIOD_DIAS[period] * 86_400_000;
}

const horasEntre = (aIso: string, bIso: string): number | null => {
  const a = Date.parse(aIso);
  const b = Date.parse(bIso);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  const h = (b - a) / MS_HORA;
  return h >= 0 ? h : null;
};

export interface SemanaReunioes {
  /** Início da semana (segunda), ISO date. */
  semana: string;
  agendadas: number;
  realizadas: number;
}

export interface ReunioesMetrics {
  // ─── KPIs do período ───
  agendadasPeriodo: number;
  realizadasPeriodo: number;
  remarcacoesPeriodo: number;
  /** % de deals com reunião agendada que tiveram ≥1 remarcação (all-time da janela). */
  taxaRemarcacaoPct: number | null;
  transcricoesPeriodo: number;
  /** Reuniões com data futura (independe do período). */
  proximasReunioes: number;

  // ─── Tempos (horas) — deals cujo 1º agendamento caiu no período ───
  /** 1º contato (form) → agendamento. */
  contatoAteAgendar: Distribuicao;
  /** 1ª mensagem de WhatsApp → agendamento (o que o CEO pediu: "após receber a mensagem"). */
  mensagemAteAgendar: Distribuicao;
  /** Ato de agendar → data marcada da reunião (com que antecedência agendam). */
  antecedenciaReuniao: Distribuicao;
  /** 1º agendamento → 1ª remarcação (quando há remarcação). */
  agendamentoAteRemarcar: Distribuicao;

  // ─── Série semanal (período) ───
  porSemana: SemanaReunioes[];

  periodo: ReunioesPeriod;
}

interface DealReuniaoRow {
  id: string;
  etapa: string;
  reuniao_data: string | null;
  reuniao_realizada_at: string | null;
  atletas: {
    id: string;
    form_submissions: {
      created_at: string | null;
      whatsapp_sent_at: string | null;
      meeting_scheduled_at: string | null;
    } | null;
  } | null;
}

interface AuditReuniaoRow {
  registro_id: string;
  created_at: string;
  reuniao_depois: string | null;
}

/** Segunda-feira da semana em BRT (UTC−3, sem DST no Brasil desde 2019). */
function inicioSemana(iso: string): string {
  const d = new Date(Date.parse(iso) - 3 * 3_600_000);
  const dow = (d.getUTCDay() + 6) % 7; // 0 = segunda
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

export async function fetchReunioesMetrics(period: ReunioesPeriod): Promise<ReunioesMetrics> {
  const supabase = await createServerSupabaseClient();
  // Filtro de período em JS (noPeriodo): os cortes usam timestamps diferentes
  // (meeting_scheduled_at, reuniao_realizada_at, audit.created_at) e o volume
  // de deals com reunião é pequeno — carrega a janela toda uma vez.
  const inicio = inicioMs(period);
  const agora = Date.now();

  const [dealsRes, auditRes, transcricoesRes] = await Promise.all([
    // Deals com reunião conhecida (agendada OU realizada — deal movido
    // manualmente p/ reuniao_realizada pode não ter reuniao_data)
    supabase
      .from("deals")
      .select(
        // created_at:submitted_at — form_submissions NÃO tem created_at (alias PostgREST)
        "id, etapa, reuniao_data, reuniao_realizada_at, " +
          "atletas ( id, form_submissions ( created_at:submitted_at, whatsapp_sent_at, meeting_scheduled_at ) )",
      )
      .is("deleted_at", null)
      .or("reuniao_data.not.is.null,reuniao_realizada_at.not.is.null")
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT),
    // Histórico de agendamentos/remarcações (audit trail dos deals)
    supabase
      .from("audit_logs")
      .select("registro_id, created_at, reuniao_depois:dados_novos->>reuniao_data")
      .eq("tabela", "deals")
      .contains("campos_alterados", ["reuniao_data"])
      .order("registro_id", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(AUDIT_LIMIT),
    supabase
      .from("reunioes_transcricoes")
      .select("id, capturada_at")
      .order("capturada_at", { ascending: false })
      .limit(FETCH_LIMIT),
  ]);

  if (dealsRes.error) {
    console.error({ level: "error", action: "fetch_reunioes_deals", error: dealsRes.error.message });
  }
  if (auditRes.error) {
    console.error({ level: "error", action: "fetch_reunioes_audit", error: auditRes.error.message });
  }
  if (transcricoesRes.error) {
    console.error({
      level: "error",
      action: "fetch_reunioes_transcricoes",
      error: transcricoesRes.error.message,
    });
  }

  const deals = (dealsRes.data as unknown as DealReuniaoRow[] | null) ?? [];
  const audit = (auditRes.data as unknown as AuditReuniaoRow[] | null) ?? [];
  const transcricoes = (transcricoesRes.data as { capturada_at: string }[] | null) ?? [];

  const noPeriodo = (iso: string | null | undefined): boolean => {
    if (!iso) return false;
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return false;
    return inicio === null || t >= inicio;
  };

  // ─── Histórico por deal (audit): 1ª row = 1º agendamento; demais = remarcações ───
  const porDeal = new Map<string, AuditReuniaoRow[]>();
  for (const row of audit) {
    const lista = porDeal.get(row.registro_id) ?? [];
    lista.push(row);
    porDeal.set(row.registro_id, lista);
  }

  let remarcacoesPeriodo = 0;
  let dealsComAgendamento = 0;
  let dealsComRemarcacao = 0;
  const agendamentoAteRemarcarHoras: number[] = [];
  for (const eventos of porDeal.values()) {
    dealsComAgendamento++;
    if (eventos.length > 1) {
      dealsComRemarcacao++;
      const gap = horasEntre(eventos[0].created_at, eventos[1].created_at);
      if (gap !== null) agendamentoAteRemarcarHoras.push(gap);
      for (const remarcacao of eventos.slice(1)) {
        if (noPeriodo(remarcacao.created_at)) remarcacoesPeriodo++;
      }
    }
  }

  // ─── KPIs + tempos a partir dos deals ───
  let agendadasPeriodo = 0;
  let realizadasPeriodo = 0;
  let proximasReunioes = 0;
  const contatoAteAgendarHoras: number[] = [];
  const mensagemAteAgendarHoras: number[] = [];
  const antecedenciaHoras: number[] = [];
  const agendadasSemana = new Map<string, number>();
  const realizadasSemana = new Map<string, number>();

  // Dedup por atleta nos cortes ancorados no form: 2+ deals do mesmo atleta
  // (ex.: perdido + relançado) embedam o MESMO form_submission.
  const atletasContados = new Set<string>();

  for (const d of deals) {
    const form = d.atletas?.form_submissions ?? null;
    const agendadoEm = form?.meeting_scheduled_at ?? null;
    const atletaJaContado = d.atletas ? atletasContados.has(d.atletas.id) : false;
    if (d.atletas) atletasContados.add(d.atletas.id);

    if (!atletaJaContado && noPeriodo(agendadoEm)) {
      agendadasPeriodo++;
      const semana = inicioSemana(agendadoEm as string);
      agendadasSemana.set(semana, (agendadasSemana.get(semana) ?? 0) + 1);

      if (form?.created_at && agendadoEm) {
        const h = horasEntre(form.created_at, agendadoEm);
        if (h !== null) contatoAteAgendarHoras.push(h);
      }
      if (form?.whatsapp_sent_at && agendadoEm) {
        const h = horasEntre(form.whatsapp_sent_at, agendadoEm);
        if (h !== null) mensagemAteAgendarHoras.push(h);
      }
      // Antecedência: usa a 1ª reuniao_data do audit (a atual pode ser remarcada)
      const primeiro = porDeal.get(d.id)?.[0];
      const reuniaoOriginal = primeiro?.reuniao_depois ?? d.reuniao_data;
      if (agendadoEm && reuniaoOriginal) {
        const h = horasEntre(agendadoEm, reuniaoOriginal);
        if (h !== null) antecedenciaHoras.push(h);
      }
    }

    if (noPeriodo(d.reuniao_realizada_at)) {
      realizadasPeriodo++;
      const semana = inicioSemana(d.reuniao_realizada_at as string);
      realizadasSemana.set(semana, (realizadasSemana.get(semana) ?? 0) + 1);
    }

    // Deal perdido pode reter reuniao_data futura (nunca é limpa) — não conta.
    if (d.etapa !== "perdido" && d.reuniao_data && Date.parse(d.reuniao_data) > agora) {
      proximasReunioes++;
    }
  }

  const transcricoesPeriodo = transcricoes.filter((t) => noPeriodo(t.capturada_at)).length;

  // ─── Série semanal CONTÍNUA (preenche semanas vazias entre a 1ª e a última —
  // sem isso o AreaChart liga reta sobre buracos e comprime gaps) ───
  const comDados = [...new Set([...agendadasSemana.keys(), ...realizadasSemana.keys()])].sort();
  const porSemana: SemanaReunioes[] = [];
  if (comDados.length > 0) {
    const fim = Date.parse(comDados[comDados.length - 1]);
    for (let t = Date.parse(comDados[0]); t <= fim; t += 7 * 86_400_000) {
      const semana = new Date(t).toISOString().slice(0, 10);
      porSemana.push({
        semana,
        agendadas: agendadasSemana.get(semana) ?? 0,
        realizadas: realizadasSemana.get(semana) ?? 0,
      });
    }
  }

  return {
    agendadasPeriodo,
    realizadasPeriodo,
    remarcacoesPeriodo,
    taxaRemarcacaoPct:
      dealsComAgendamento > 0 ? (dealsComRemarcacao / dealsComAgendamento) * 100 : null,
    transcricoesPeriodo,
    proximasReunioes,
    contatoAteAgendar: distribuicao(contatoAteAgendarHoras),
    mensagemAteAgendar: distribuicao(mensagemAteAgendarHoras),
    antecedenciaReuniao: distribuicao(antecedenciaHoras),
    agendamentoAteRemarcar: distribuicao(agendamentoAteRemarcarHoras),
    porSemana,
    periodo: period,
  };
}
