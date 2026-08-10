import { createServerSupabaseClient } from "./supabase-server";

// ─── Tipos ───────────────────────────────────────────────────────────────────

export interface AutomacaoStatus {
  nome: string;
  descricao: string;
  status: "operacional" | "atencao" | "critico" | "inativo";
  ultimaExecucao: string | null;
  detalhes: string;
  metrica: number;
  metricaLabel: string;
}

export interface FilaItem {
  id: string;
  athlete_name: string;
  email: string;
  classification: string;
  qualified_at: string | null;
  whatsapp_sent_at: string | null;
  followup_1_sent_at: string | null;
  followup_2_sent_at: string | null;
  meeting_scheduled: boolean | null;
  created_at: string;
  motivo: string;
}

export interface MonitorMetrics {
  totalLeads: number;
  qualificadosHoje: number;
  whatsappEnviadosHoje: number;
  followupsEnviadosHoje: number;
  reunioesDetectadas: number;
  leadsComProblema: number;
}

export interface MonitorData {
  metrics: MonitorMetrics;
  automacoes: AutomacaoStatus[];
  filaWhatsappInicial: FilaItem[];
  filaFollowup1: FilaItem[];
  filaFollowup2: FilaItem[];
  leadsPendentesQualificacao: FilaItem[];
  leadsTrancados: FilaItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function horasAtras(horas: number): string {
  return new Date(Date.now() - horas * 60 * 60 * 1000).toISOString();
}

function inicioDoDia(): string {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return hoje.toISOString();
}

// ─── Queries ─────────────────────────────────────────────────────────────────

export async function fetchMonitorData(): Promise<MonitorData> {
  const supabase = await createServerSupabaseClient();
  const inicioHoje = inicioDoDia();

  // Thresholds REAIS do scheduler (fail-open p/ defaults; clamp 1–720h como
  // nas CFs) — hardcode de 22h/48h aqui gerava falso-positivo quando o CEO
  // mudava scheduler_intervalos.
  const { data: intervalosRow } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", "scheduler_intervalos")
    .limit(1);
  const iv = (intervalosRow?.[0]?.valor ?? {}) as Record<string, unknown>;
  const num = (v: unknown, padrao: number) =>
    typeof v === "number" && v >= 1 && v <= 720 ? v : padrao;
  const hInicial = num(iv.whatsapp_inicial_horas, 22);
  const hFu1 = num(iv.followup_1_horas, 48);
  const hFu2 = num(iv.followup_2_horas, 168);

  const h22atras = horasAtras(hInicial);
  const h48atras = horasAtras(hFu1);
  const d7atras = horasAtras(hFu2);
  const hTrancado = horasAtras(hInicial * 2);
  const h1atras = horasAtras(1);

  // ─── Queries paralelas ──────────────────────────────────────────────────

  const [
    totalLeadsRes,
    qualificadosHojeRes,
    whatsappHojeRes,
    followupsHojeRes,
    reunioesRes,
    pendentesQualificacaoRes,
    filaWhatsappRes,
    filaFollowup1Res,
    filaFollowup2Res,
    leadsTrancadosRes,
    ultimoWhatsappRes,
    ultimoFollowup1Res,
    ultimoFollowup2Res,
    ultimaReuniaoRes,
    ultimaQualificacaoRes,
  ] = await Promise.all([
    // Total de leads
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true }),

    // Qualificados hoje
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .not("qualified_at", "is", null)
      .gte("qualified_at", inicioHoje),

    // WhatsApp enviados hoje
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .not("whatsapp_sent_at", "is", null)
      .gte("whatsapp_sent_at", inicioHoje),

    // Follow-ups enviados hoje (1 + 2)
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .or(`followup_1_sent_at.gte.${inicioHoje},followup_2_sent_at.gte.${inicioHoje}`),

    // Reunioes detectadas total
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("meeting_scheduled", true),

    // Pendentes de qualificacao (submitted > 1h sem qualified_at)
    supabase
      .from("form_submissions")
      .select("id, athlete_name, email, qualification_classification, qualified_at, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, meeting_scheduled, submitted_at")
      .is("qualified_at", null)
      // form_submissions NÃO tem created_at — a coluna de entrada é submitted_at.
      // (Bug histórico: o PostgREST devolvia 400 sem lançar e as filas ficavam
      // silenciosamente vazias — foi assim que o monitor não viu o incidente.)
      .lt("submitted_at", h1atras)
      .order("submitted_at", { ascending: true })
      .limit(50),

    // Fila WhatsApp inicial: qualificados QUENTE/MORNO, >22h, sem whatsapp
    supabase
      .from("form_submissions")
      .select("id, athlete_name, email, qualification_classification, qualified_at, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, meeting_scheduled, submitted_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("qualified_at", "is", null)
      .lt("qualified_at", h22atras)
      .is("whatsapp_sent_at", null)
      // INVARIANTE: fluxo ideal ≠ timing alternativo — sem este filtro, lead
      // muito_cedo legítimo (48h) aparecia como "na fila" (falso-positivo).
      .or("timing_status.is.null,timing_status.eq.ideal")
      // Paridade com o scheduler: lead aguardando aprovação do CEO não está
      // "na fila" — está retido de propósito pelo gate humano.
      .eq("aprovacao_status", "aprovado")
      .order("qualified_at", { ascending: true })
      .limit(50),

    // Fila Follow-up 1: whatsapp >48h, sem followup_1, sem reuniao
    supabase
      .from("form_submissions")
      .select("id, athlete_name, email, qualification_classification, qualified_at, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, meeting_scheduled, submitted_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("whatsapp_sent_at", "is", null)
      .lt("whatsapp_sent_at", h48atras)
      .is("followup_1_sent_at", null)
      .or("meeting_scheduled.is.null,meeting_scheduled.eq.false")
      .or("timing_status.is.null,timing_status.eq.ideal")
      .order("whatsapp_sent_at", { ascending: true })
      .limit(50),

    // Fila Follow-up 2: whatsapp >7d, followup_1 enviado, sem followup_2, sem reuniao
    supabase
      .from("form_submissions")
      .select("id, athlete_name, email, qualification_classification, qualified_at, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, meeting_scheduled, submitted_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("whatsapp_sent_at", "is", null)
      .lt("whatsapp_sent_at", d7atras)
      .not("followup_1_sent_at", "is", null)
      .is("followup_2_sent_at", null)
      .or("meeting_scheduled.is.null,meeting_scheduled.eq.false")
      .or("timing_status.is.null,timing_status.eq.ideal")
      .order("whatsapp_sent_at", { ascending: true })
      .limit(50),

    // Leads trancados: qualificados QUENTE/MORNO >48h sem whatsapp (possivel bug)
    supabase
      .from("form_submissions")
      .select("id, athlete_name, email, qualification_classification, qualified_at, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, meeting_scheduled, submitted_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("qualified_at", "is", null)
      .lt("qualified_at", hTrancado)
      .is("whatsapp_sent_at", null)
      .or("timing_status.is.null,timing_status.eq.ideal")
      .eq("aprovacao_status", "aprovado")
      .order("qualified_at", { ascending: true })
      .limit(50),

    // Ultimo WhatsApp enviado
    supabase
      .from("form_submissions")
      .select("whatsapp_sent_at")
      .not("whatsapp_sent_at", "is", null)
      .order("whatsapp_sent_at", { ascending: false })
      .limit(1),

    // Ultimo Follow-up 1 enviado
    supabase
      .from("form_submissions")
      .select("followup_1_sent_at")
      .not("followup_1_sent_at", "is", null)
      .order("followup_1_sent_at", { ascending: false })
      .limit(1),

    // Ultimo Follow-up 2 enviado
    supabase
      .from("form_submissions")
      .select("followup_2_sent_at")
      .not("followup_2_sent_at", "is", null)
      .order("followup_2_sent_at", { ascending: false })
      .limit(1),

    // Ultima reuniao detectada
    supabase
      .from("form_submissions")
      .select("meeting_scheduled_at")
      .eq("meeting_scheduled", true)
      .not("meeting_scheduled_at", "is", null)
      .order("meeting_scheduled_at", { ascending: false })
      .limit(1),

    // Ultima qualificacao
    supabase
      .from("form_submissions")
      .select("qualified_at")
      .not("qualified_at", "is", null)
      .order("qualified_at", { ascending: false })
      .limit(1),
  ]);

  // ─── Métricas ───────────────────────────────────────────────────────────

  const pendentesQualificacao = pendentesQualificacaoRes.data ?? [];
  const filaWhatsapp = filaWhatsappRes.data ?? [];
  const filaFollowup1 = filaFollowup1Res.data ?? [];
  const filaFollowup2 = filaFollowup2Res.data ?? [];
  const leadsTrancados = leadsTrancadosRes.data ?? [];

  const ultimoWhatsapp = ultimoWhatsappRes.data?.[0]?.whatsapp_sent_at ?? null;
  const ultimoFollowup1 = ultimoFollowup1Res.data?.[0]?.followup_1_sent_at ?? null;
  const ultimoFollowup2 = ultimoFollowup2Res.data?.[0]?.followup_2_sent_at ?? null;
  const ultimaReuniao = ultimaReuniaoRes.data?.[0]?.meeting_scheduled_at ?? null;
  const ultimaQualificacao = ultimaQualificacaoRes.data?.[0]?.qualified_at ?? null;

  const metrics: MonitorMetrics = {
    totalLeads: totalLeadsRes.count ?? 0,
    qualificadosHoje: qualificadosHojeRes.count ?? 0,
    whatsappEnviadosHoje: whatsappHojeRes.count ?? 0,
    followupsEnviadosHoje: followupsHojeRes.count ?? 0,
    reunioesDetectadas: reunioesRes.count ?? 0,
    leadsComProblema: leadsTrancados.length + pendentesQualificacao.length,
  };

  // ─── Status das automações ──────────────────────────────────────────────

  const automacoes: AutomacaoStatus[] = [
    buildQualificacaoStatus(ultimaQualificacao, pendentesQualificacao.length, metrics.qualificadosHoje),
    buildWhatsappInicialStatus(ultimoWhatsapp, filaWhatsapp.length, leadsTrancados.length, metrics.whatsappEnviadosHoje),
    buildFollowup1Status(ultimoFollowup1, filaFollowup1.length),
    buildFollowup2Status(ultimoFollowup2, filaFollowup2.length),
    buildCalendarWebhookStatus(ultimaReuniao, metrics.reunioesDetectadas),
  ];

  // ─── Mapear filas ───────────────────────────────────────────────────────

  const mapToFilaItem = (item: Record<string, unknown>, motivo: string): FilaItem => ({
    id: item.id as string,
    athlete_name: item.athlete_name as string,
    email: item.email as string,
    classification: (item.qualification_classification as string) ?? "N/A",
    qualified_at: item.qualified_at as string | null,
    whatsapp_sent_at: item.whatsapp_sent_at as string | null,
    followup_1_sent_at: item.followup_1_sent_at as string | null,
    followup_2_sent_at: item.followup_2_sent_at as string | null,
    meeting_scheduled: item.meeting_scheduled as boolean | null,
    // Campo mantém o nome created_at (contrato da UI), mas o valor vem de
    // submitted_at — única coluna de entrada que existe em form_submissions.
    created_at: item.submitted_at as string,
    motivo,
  });

  return {
    metrics,
    automacoes,
    filaWhatsappInicial: filaWhatsapp.map((i) => mapToFilaItem(i, "Aguardando envio (>22h qualificado)")),
    filaFollowup1: filaFollowup1.map((i) => mapToFilaItem(i, "Elegivel para follow-up 1 (>48h WhatsApp)")),
    filaFollowup2: filaFollowup2.map((i) => mapToFilaItem(i, "Elegivel para follow-up 2 (>7d WhatsApp)")),
    leadsPendentesQualificacao: pendentesQualificacao.map((i) => mapToFilaItem(i, "Sem qualificacao (>1h)")),
    leadsTrancados: leadsTrancados.map((i) => mapToFilaItem(i, "QUENTE/MORNO >48h sem WhatsApp")),
  };
}

// ─── Builders de status ──────────────────────────────────────────────────────

function tempoDesde(iso: string | null): string {
  if (!iso) return "Nunca executado";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  const horas = Math.floor(diffMs / 3600000);
  const dias = Math.floor(diffMs / 86400000);

  if (mins < 1) return "Agora";
  if (mins < 60) return `${mins}min atras`;
  if (horas < 24) return `${horas}h atras`;
  return `${dias}d atras`;
}

function buildQualificacaoStatus(
  ultimaExecucao: string | null,
  pendentes: number,
  qualificadosHoje: number,
): AutomacaoStatus {
  let status: AutomacaoStatus["status"] = "operacional";
  let detalhes = `${qualificadosHoje} qualificados hoje`;

  if (pendentes > 0) {
    status = pendentes > 5 ? "critico" : "atencao";
    detalhes = `${pendentes} lead${pendentes !== 1 ? "s" : ""} aguardando qualificacao (>1h)`;
  } else if (!ultimaExecucao) {
    status = "inativo";
    detalhes = "Nenhuma qualificacao registrada";
  }

  return {
    nome: "Qualificacao Gemini",
    descricao: "Cloud Function qualify-lead — classifica leads via IA",
    status,
    ultimaExecucao,
    detalhes,
    metrica: qualificadosHoje,
    metricaLabel: "hoje",
  };
}

function buildWhatsappInicialStatus(
  ultimaExecucao: string | null,
  naFila: number,
  trancados: number,
  enviadosHoje: number,
): AutomacaoStatus {
  let status: AutomacaoStatus["status"] = "operacional";
  let detalhes = `${enviadosHoje} enviados hoje`;

  if (trancados > 0) {
    status = "critico";
    detalhes = `${trancados} lead${trancados !== 1 ? "s" : ""} trancado${trancados !== 1 ? "s" : ""} (>48h sem envio)`;
  } else if (naFila > 10) {
    status = "atencao";
    detalhes = `${naFila} na fila aguardando proximo ciclo`;
  } else if (!ultimaExecucao) {
    status = "inativo";
    detalhes = "Nenhum WhatsApp enviado";
  }

  return {
    nome: "WhatsApp Inicial (22h)",
    descricao: "Cloud Scheduler process-pending-whatsapp — envia apos 22h da qualificacao",
    status,
    ultimaExecucao,
    detalhes,
    metrica: naFila,
    metricaLabel: "na fila",
  };
}

function buildFollowup1Status(
  ultimaExecucao: string | null,
  naFila: number,
): AutomacaoStatus {
  let status: AutomacaoStatus["status"] = "operacional";
  let detalhes = "Nenhum lead pendente";

  if (naFila > 0) {
    status = naFila > 10 ? "atencao" : "operacional";
    detalhes = `${naFila} lead${naFila !== 1 ? "s" : ""} elegive${naFila !== 1 ? "is" : "l"} para follow-up`;
  }
  if (!ultimaExecucao) {
    status = "inativo";
    detalhes = "Nenhum follow-up 1 enviado";
  }

  return {
    nome: "Follow-up 1 (48h)",
    descricao: "Cloud Scheduler process-followup-whatsapp — 48h apos WhatsApp inicial",
    status,
    ultimaExecucao,
    detalhes,
    metrica: naFila,
    metricaLabel: "elegiveis",
  };
}

function buildFollowup2Status(
  ultimaExecucao: string | null,
  naFila: number,
): AutomacaoStatus {
  let status: AutomacaoStatus["status"] = "operacional";
  let detalhes = "Nenhum lead pendente";

  if (naFila > 0) {
    status = naFila > 10 ? "atencao" : "operacional";
    detalhes = `${naFila} lead${naFila !== 1 ? "s" : ""} elegive${naFila !== 1 ? "is" : "l"} para follow-up 2`;
  }
  if (!ultimaExecucao) {
    status = "inativo";
    detalhes = "Nenhum follow-up 2 enviado";
  }

  return {
    nome: "Follow-up 2 (7 dias)",
    descricao: "Cloud Scheduler process-followup-whatsapp — 7 dias apos WhatsApp inicial",
    status,
    ultimaExecucao,
    detalhes,
    metrica: naFila,
    metricaLabel: "elegiveis",
  };
}

function buildCalendarWebhookStatus(
  ultimaReuniao: string | null,
  totalReunioes: number,
): AutomacaoStatus {
  let status: AutomacaoStatus["status"] = "operacional";
  let detalhes = `${totalReunioes} reunio${totalReunioes !== 1 ? "es" : "ao"} detectada${totalReunioes !== 1 ? "s" : ""}`;

  if (!ultimaReuniao) {
    status = "inativo";
    detalhes = "Nenhuma reuniao detectada";
  } else {
    const diffHoras = Math.floor((Date.now() - new Date(ultimaReuniao).getTime()) / 3600000);
    if (diffHoras > 168) {
      status = "atencao";
      detalhes = `Nenhuma reuniao detectada ha ${Math.floor(diffHoras / 24)} dias`;
    }
  }

  return {
    nome: "Calendar Webhook",
    descricao: "Google Calendar push notification — detecta reunioes agendadas",
    status,
    ultimaExecucao: ultimaReuniao,
    detalhes,
    metrica: totalReunioes,
    metricaLabel: "total",
  };
}

export { tempoDesde };
