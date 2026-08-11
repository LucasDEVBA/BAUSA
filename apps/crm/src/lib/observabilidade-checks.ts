import { createServerSupabaseClient } from "./supabase-server";
import { getZapiConfig, zapiRequest } from "./zapi-server";
import { GeminiNotConfiguredError, gerarConteudoGemini } from "./gemini";

/**
 * Observabilidade — motor de verificações on-demand (server-side, CEO).
 *
 * Nasceu do incidente 2026-07-15/17: a instância Z-API caiu por ~2 dias e
 * nenhum monitor percebeu. Causas mapeadas:
 *   1. o CAS marca `*_sent_at` ANTES do envio (correto p/ idempotência, mas
 *      esvazia as filas mesmo quando nada foi entregue);
 *   2. a CF send-whatsapp responde HTTP 200 mesmo com falha real de envio;
 *   3. a própria Z-API aceita mensagens desconectada (200 + messageId) e as
 *      segura em fila interna — sem nenhum erro em lugar algum.
 *
 * Lição codificada aqui: AUSÊNCIA DE ERRO ≠ FUNCIONANDO. Os checks verificam
 * sinais POSITIVOS de vida (conexão real, espelho de mensagens confirmando
 * entrega, fila interna vazia) em vez de só contar pendências.
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type CheckStatus = "ok" | "atencao" | "critico" | "info";

export interface CheckResult {
  id: string;
  titulo: string;
  status: CheckStatus;
  /** Uma linha: o veredito. */
  resumo: string;
  /** Linhas de evidência (leads afetados, latências, instruções). */
  detalhes: string[];
  latenciaMs?: number | null;
}

export interface FilasKpis {
  /** null = credenciais ausentes (não dá para saber). */
  conexaoOnline: boolean | null;
  /** null = não foi possível consultar. */
  filaInternaZapi: number | null;
  enviosMarcados24h: number;
  espelhadasEnviadas24h: number;
  problemas: number;
}

export interface ObservabilidadeFilas {
  verificadoEm: string;
  kpis: FilasKpis;
  checks: CheckResult[];
}

export interface FunilDia {
  leads: number;
  qualificados: number;
  whatsappMarcado: number;
  espelhadas: number;
  reunioes: number;
}

export interface ObservabilidadeGeral {
  verificadoEm: string;
  conexoes: CheckResult[];
  fluxos: CheckResult[];
  funil24h: FunilDia;
}

// ─── Constantes ──────────────────────────────────────────────────────────────

/** Folga sobre o SLA da fila antes de acusar "presa" (scheduler roda 1x/h). */
const FOLGA_FILA_HORAS = 4;
/** Espelho: margem antes da marca ao procurar a mensagem correspondente. */
const ESPELHO_MARGEM_MIN = 5;
/** Espelho: janela após a marca ao procurar a mensagem correspondente. */
const ESPELHO_JANELA_POS_MIN = 15;
/** Espelho: idade mínima de um envio para ser suspeito (lag normal de webhook). */
const ESPELHO_IDADE_MIN_MIN = 10;
/** Espelho: quanto tempo de marcas de envio entram na correlação. */
const ESPELHO_JANELA_MARCAS_HORAS = 48;
/** Tolerância nas verificações de timing entre etapas. */
const TIMING_TOLERANCIA_HORAS = 1;
const PING_TIMEOUT_MS = 5_000;

const INTERVALOS_PADRAO = {
  whatsapp_inicial_horas: 22,
  whatsapp_timing_alt_horas: 48,
  followup_1_horas: 48,
  followup_2_horas: 168,
} as const;

/** Âncoras fixas dos runs de sistema (migration 20260709220205). */
const ANCORAS_SISTEMA: { id: string; nome: string }[] = [
  { id: "a0000000-0000-4000-8000-000000000001", nome: "WhatsApp inicial" },
  { id: "a0000000-0000-4000-8000-000000000002", nome: "WhatsApp timing alternativo" },
  { id: "a0000000-0000-4000-8000-000000000003", nome: "Follow-up 1" },
  { id: "a0000000-0000-4000-8000-000000000004", nome: "Follow-up 2" },
  { id: "a0000000-0000-4000-8000-000000000005", nome: "Retomada de novembro" },
  { id: "a0000000-0000-4000-8000-000000000006", nome: "Qualificação Gemini" },
  { id: "a0000000-0000-4000-8000-000000000007", nome: "Confirmação de reunião" },
  { id: "a0000000-0000-4000-8000-000000000008", nome: "E-mails de confirmação" },
];

/** CFs cujas URLs o Engine já possui (ping de disponibilidade, sem secret → 401 = no ar). */
const CFS_PING: { nome: string; env: string }[] = [
  { nome: "send-whatsapp (envio WhatsApp)", env: "SEND_WHATSAPP_URL" },
  { nome: "send-messages (e-mails)", env: "SEND_MESSAGES_URL" },
  { nome: "calendar-create-event (agenda)", env: "CALENDAR_CREATE_EVENT_URL" },
  { nome: "calendar-lead-events (relink reunião)", env: "CALENDAR_LEAD_EVENTS_URL" },
  { nome: "retry-qualification (requalificação)", env: "RETRY_QUALIFICATION_URL" },
  { nome: "send-remarketing (re-marketing)", env: "SEND_REMARKETING_URL" },
  // Opt-out LGPD: se esta rota cair, descadastros param de gravar e os envios
  // continuam — risco legal sem sintoma interno (auditoria 2026-07-19).
  { nome: "remarketing-unsubscribe (opt-out LGPD)", env: "REMARKETING_UNSUBSCRIBE_URL" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Supabase = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function horasAtrasISO(horas: number): string {
  return new Date(Date.now() - horas * 3_600_000).toISOString();
}

function fmtDuracao(ms: number): string {
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}min`;
  const horas = Math.floor(mins / 60);
  if (horas < 48) return `${horas}h`;
  return `${Math.floor(horas / 24)}d ${horas % 24}h`;
}

function fmtQuando(iso: string): string {
  return `há ${fmtDuracao(Date.now() - new Date(iso).getTime())}`;
}

/** Nunca deixa uma verificação individual derrubar a página inteira. */
async function seguro(id: string, titulo: string, fn: () => Promise<CheckResult>): Promise<CheckResult> {
  try {
    return await fn();
  } catch (e) {
    return {
      id,
      titulo,
      status: "atencao",
      resumo: `Falha ao executar a verificação: ${e instanceof Error ? e.message : String(e)}`,
      detalhes: [],
    };
  }
}

function contarProblemas(checks: CheckResult[]): number {
  return checks.filter((c) => c.status === "critico" || c.status === "atencao").length;
}

// ─── Z-API: conexão + fila interna ───────────────────────────────────────────

interface ZapiStatusInfo {
  check: CheckResult;
  online: boolean | null;
}

async function checkZapiConexao(): Promise<ZapiStatusInfo> {
  const id = "zapi_conexao";
  const titulo = "Conexão Z-API (WhatsApp)";
  const config = getZapiConfig();
  if (!config) {
    return {
      online: null,
      check: {
        id,
        titulo,
        status: "info",
        resumo: "Credenciais Z-API não configuradas neste ambiente.",
        detalhes: [],
      },
    };
  }

  const t0 = Date.now();
  try {
    const res = await zapiRequest(config, "/status");
    const latenciaMs = Date.now() - t0;
    const data = (res.data ?? {}) as Record<string, unknown>;
    const connected = data.connected === true;
    const smartphone = data.smartphoneConnected === true;

    if (connected && smartphone) {
      return {
        online: true,
        check: { id, titulo, status: "ok", resumo: "Instância conectada e telefone pareado.", detalhes: [], latenciaMs },
      };
    }

    const motivo = typeof data.error === "string" ? data.error : `connected=${String(data.connected)}, smartphone=${String(data.smartphoneConnected)}`;
    return {
      online: false,
      check: {
        id,
        titulo,
        status: "critico",
        resumo: "Instância DESCONECTADA — nenhuma mensagem está sendo entregue.",
        detalhes: [
          `Resposta da Z-API: ${motivo}`,
          "Reconectar: painel Z-API → instância → QR Code → WhatsApp → Dispositivos conectados.",
        ],
        latenciaMs,
      },
    };
  } catch {
    return {
      online: null,
      check: {
        id,
        titulo,
        status: "critico",
        resumo: "Z-API sem resposta (timeout/erro de rede).",
        detalhes: ["Não foi possível consultar /status em 15s."],
      },
    };
  }
}

async function checkZapiFilaInterna(online: boolean | null): Promise<{ check: CheckResult; count: number | null }> {
  const id = "zapi_fila_interna";
  const titulo = "Fila interna da Z-API";
  const config = getZapiConfig();
  if (!config) {
    return { count: null, check: { id, titulo, status: "info", resumo: "Credenciais Z-API não configuradas.", detalhes: [] } };
  }
  try {
    const res = await zapiRequest(config, "/queue/count");
    const data = (res.data ?? {}) as Record<string, unknown>;
    const count = typeof data.count === "number" ? data.count : null;
    if (count === null) {
      return { count, check: { id, titulo, status: "atencao", resumo: `Resposta inesperada ao consultar a fila (HTTP ${res.status}).`, detalhes: [] } };
    }
    if (count > 0 && online === false) {
      return {
        count,
        check: {
          id,
          titulo,
          status: "critico",
          resumo: `${count} mensagem(ns) presa(s) na fila interna aguardando reconexão.`,
          detalhes: ["Ao reconectar, a Z-API dispara a fila — avaliar antes se todas ainda fazem sentido."],
        },
      };
    }
    if (count > 20) {
      return { count, check: { id, titulo, status: "atencao", resumo: `${count} mensagens na fila interna (acima do normal).`, detalhes: [] } };
    }
    return { count, check: { id, titulo, status: "ok", resumo: count === 0 ? "Fila interna vazia." : `${count} mensagem(ns) em trânsito (normal).`, detalhes: [] } };
  } catch {
    return { count: null, check: { id, titulo, status: "atencao", resumo: "Não foi possível consultar a fila interna.", detalhes: [] } };
  }
}

// ─── Espelho: envios marcados sem confirmação de entrega ─────────────────────

const COLUNAS_ENVIO: { col: string; label: string }[] = [
  { col: "whatsapp_sent_at", label: "WhatsApp inicial" },
  { col: "followup_1_sent_at", label: "Follow-up 1" },
  { col: "followup_2_sent_at", label: "Follow-up 2" },
  { col: "scheduled_followup_sent_at", label: "Retomada agendada" },
];

/** Últimos 10 dígitos do telefone (mesmo matching do calendar-webhook). */
function tail10(phone: unknown): string | null {
  if (typeof phone !== "string") return null;
  const digitos = phone.replace(/\D/g, "");
  return digitos.length >= 8 ? digitos.slice(-10) : null;
}

/**
 * O check que teria pegado o incidente: todo envio real gera um callback
 * `SentCallback` espelhado em `whatsapp_mensagens` (from_me=true). A
 * correlação é POR MARCA: cada `*_sent_at` recente precisa de uma mensagem
 * espelhada para o telefone daquele lead (tail-10, atleta OU responsável)
 * numa janela de −5min/+15min em torno da marca. Comparar só contra a última
 * espelhada global mascararia falha parcial (ex.: envio fantasma seguido de
 * mensagem manual do CEO ou de envio bem-sucedido a outro lead).
 */
async function checkEnviosSemEspelho(supabase: Supabase, online: boolean | null): Promise<CheckResult> {
  const id = "envios_sem_espelho";
  const titulo = "Envios sem espelho de entrega";
  const erros: string[] = [];

  const { data: ultimaRows, error: ultimaErr } = await supabase
    .from("whatsapp_mensagens")
    .select("created_at")
    .eq("from_me", true)
    .order("created_at", { ascending: false })
    .limit(1);
  if (ultimaErr) {
    return { id, titulo, status: "atencao", resumo: `Falha ao consultar o espelho: ${ultimaErr.message}`, detalhes: [] };
  }
  const ultimaEspelhada = (ultimaRows?.[0]?.created_at as string | undefined) ?? null;
  if (!ultimaEspelhada) {
    return { id, titulo, status: "info", resumo: "Sem histórico no espelho de mensagens ainda.", detalhes: [] };
  }

  // 1. Marcas de envio recentes (todas as 4 colunas). Select estático —
  // coluna dinâmica no template quebra o parser de tipos do supabase-js.
  const desdeMarcas = horasAtrasISO(ESPELHO_JANELA_MARCAS_HORAS);
  const resultados = await Promise.all(
    COLUNAS_ENVIO.map((c) =>
      supabase
        .from("form_submissions")
        .select(
          "id, athlete_name, athlete_whatsapp, guardian_whatsapp, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, scheduled_followup_sent_at",
        )
        .gte(c.col, desdeMarcas)
        .order(c.col, { ascending: true })
        .limit(100),
    ),
  );

  interface Marca {
    nome: string;
    label: string;
    quandoMs: number;
    quandoIso: string;
    tails: string[];
  }
  const marcas: Marca[] = [];
  resultados.forEach((res, i) => {
    const { col, label } = COLUNAS_ENVIO[i];
    if (res.error) {
      erros.push(`Falha ao consultar marcas de ${label}: ${res.error.message}`);
      return;
    }
    for (const raw of res.data ?? []) {
      const row = raw as Record<string, unknown>;
      const quandoIso = row[col] as string;
      const tails = [tail10(row.athlete_whatsapp), tail10(row.guardian_whatsapp)].filter(
        (t): t is string => t !== null,
      );
      marcas.push({ nome: String(row.athlete_name), label, quandoMs: new Date(quandoIso).getTime(), quandoIso, tails });
    }
  });

  if (marcas.length === 0) {
    return {
      id,
      titulo,
      status: erros.length > 0 ? "atencao" : "ok",
      resumo:
        erros.length > 0
          ? "Verificação parcial — houve falha de consulta."
          : `Nenhum envio marcado nas últimas ${ESPELHO_JANELA_MARCAS_HORAS}h (última mensagem espelhada ${fmtQuando(ultimaEspelhada)}).`,
      detalhes: erros,
    };
  }

  // 2. Espelho na janela global das marcas (uma consulta só).
  const minMs = Math.min(...marcas.map((m) => m.quandoMs)) - ESPELHO_MARGEM_MIN * 60_000;
  const maxMs = Math.min(Date.now(), Math.max(...marcas.map((m) => m.quandoMs)) + ESPELHO_JANELA_POS_MIN * 60_000);
  const { data: espelhoRows, error: espelhoErr } = await supabase
    .from("whatsapp_mensagens")
    .select("phone, created_at")
    .eq("from_me", true)
    .gte("created_at", new Date(minMs).toISOString())
    .lte("created_at", new Date(maxMs).toISOString())
    .limit(1000);
  if (espelhoErr) {
    return { id, titulo, status: "atencao", resumo: `Falha ao consultar o espelho: ${espelhoErr.message}`, detalhes: erros };
  }
  const espelho = (espelhoRows ?? []).map((raw) => {
    const r = raw as Record<string, unknown>;
    return { tail: tail10(r.phone), ms: new Date(String(r.created_at)).getTime() };
  });
  if (espelho.length >= 1000) {
    erros.push("Janela de espelho truncada em 1000 mensagens — resultado pode subnotificar.");
  }

  // 3. Correlação marca ↔ espelho.
  const limiteIdadeMs = Date.now() - ESPELHO_IDADE_MIN_MIN * 60_000;
  const suspeitos: string[] = [];
  for (const m of marcas) {
    // Envio muito recente pode só estar com o webhook atrasado — a não ser
    // que a conexão esteja comprovadamente caída.
    if (online !== false && m.quandoMs > limiteIdadeMs) continue;
    const antes = m.quandoMs - ESPELHO_MARGEM_MIN * 60_000;
    const depois = m.quandoMs + ESPELHO_JANELA_POS_MIN * 60_000;
    const temEspelho = espelho.some(
      (e) => e.ms >= antes && e.ms <= depois && e.tail !== null && m.tails.includes(e.tail),
    );
    if (!temEspelho) {
      suspeitos.push(`${m.nome} — ${m.label} marcado ${fmtQuando(m.quandoIso)} sem espelho de envio`);
    }
  }

  if (suspeitos.length > 0) {
    return {
      id,
      titulo,
      status: "critico",
      resumo: `${suspeitos.length} envio(s) marcados como enviados SEM confirmação de entrega nas últimas ${ESPELHO_JANELA_MARCAS_HORAS}h.`,
      detalhes: [...suspeitos.slice(0, 15), ...erros],
    };
  }
  return {
    id,
    titulo,
    status: erros.length > 0 ? "atencao" : "ok",
    resumo:
      erros.length > 0
        ? "Verificação parcial — houve falha de consulta."
        : `Todos os ${marcas.length} envios das últimas ${ESPELHO_JANELA_MARCAS_HORAS}h têm espelho de entrega.`,
    detalhes: erros,
  };
}

// ─── Timing entre etapas ─────────────────────────────────────────────────────

interface IntervalosConfig {
  whatsapp_inicial_horas: number;
  whatsapp_timing_alt_horas: number;
  followup_1_horas: number;
  followup_2_horas: number;
}

async function lerIntervalos(supabase: Supabase): Promise<IntervalosConfig> {
  const { data } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", "scheduler_intervalos")
    .limit(1);
  const valor = (data?.[0]?.valor ?? {}) as Record<string, unknown>;
  // Mesmo clamp das CFs (1–720h) — valores fora da faixa caem no padrão.
  const num = (k: keyof IntervalosConfig): number => {
    const v = valor[k];
    return typeof v === "number" && v >= 1 && v <= 720 ? v : INTERVALOS_PADRAO[k];
  };
  return {
    whatsapp_inicial_horas: num("whatsapp_inicial_horas"),
    whatsapp_timing_alt_horas: num("whatsapp_timing_alt_horas"),
    followup_1_horas: num("followup_1_horas"),
    followup_2_horas: num("followup_2_horas"),
  };
}

/**
 * Detecta comportamento incorreto entre etapas — ex.: follow-up 1 disparado
 * logo após o inicial sem respeitar o prazo configurado, ou etapa fora de
 * sequência (follow-up sem inicial).
 */
async function checkTimingEtapas(supabase: Supabase): Promise<CheckResult> {
  const id = "timing_etapas";
  const titulo = "Timing entre etapas (janela 30d)";
  const d30 = horasAtrasISO(24 * 30);
  const intervalos = await lerIntervalos(supabase);
  const tolMs = TIMING_TOLERANCIA_HORAS * 3_600_000;

  const [comInicialRes, fu1SemInicialRes, fu2SemFu1Res] = await Promise.all([
    supabase
      .from("form_submissions")
      .select("athlete_name, qualified_at, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, timing_status")
      // Janela por QUALQUER etapa recente — pega FU despejado agora sobre
      // inicial antigo (cenário pós-backlog/incidente).
      .or(`whatsapp_sent_at.gte.${d30},followup_1_sent_at.gte.${d30},followup_2_sent_at.gte.${d30}`)
      .not("whatsapp_sent_at", "is", null)
      .limit(500),
    supabase
      .from("form_submissions")
      .select("athlete_name, followup_1_sent_at")
      .gte("followup_1_sent_at", d30)
      .is("whatsapp_sent_at", null)
      .limit(50),
    supabase
      .from("form_submissions")
      .select("athlete_name, followup_2_sent_at")
      .gte("followup_2_sent_at", d30)
      .is("followup_1_sent_at", null)
      .limit(50),
  ]);

  const errosQuery: string[] = [];
  for (const [rotulo, res] of [
    ["etapas", comInicialRes],
    ["FU1 sem inicial", fu1SemInicialRes],
    ["FU2 sem FU1", fu2SemFu1Res],
  ] as const) {
    if (res.error) errosQuery.push(`Falha na consulta (${rotulo}): ${res.error.message}`);
  }

  const anomalias: string[] = [];
  const ms = (iso: string) => new Date(iso).getTime();

  for (const raw of comInicialRes.data ?? []) {
    const r = raw as Record<string, unknown>;
    const nome = String(r.athlete_name);
    const wa = r.whatsapp_sent_at as string;
    const qual = r.qualified_at as string | null;
    const fu1 = r.followup_1_sent_at as string | null;
    const fu2 = r.followup_2_sent_at as string | null;
    const timingAlt = r.timing_status === "muito_cedo" || r.timing_status === "tarde_demais";
    const prazoInicialH = timingAlt ? intervalos.whatsapp_timing_alt_horas : intervalos.whatsapp_inicial_horas;

    if (qual && ms(wa) - ms(qual) < prazoInicialH * 3_600_000 - tolMs) {
      anomalias.push(`${nome}: inicial ${fmtDuracao(ms(wa) - ms(qual))} após qualificação (esperado ≥ ${prazoInicialH}h)`);
    }
    if (fu1 && ms(fu1) - ms(wa) < intervalos.followup_1_horas * 3_600_000 - tolMs) {
      anomalias.push(`${nome}: follow-up 1 ${fmtDuracao(ms(fu1) - ms(wa))} após o inicial (esperado ≥ ${intervalos.followup_1_horas}h)`);
    }
    if (fu2 && ms(fu2) - ms(wa) < intervalos.followup_2_horas * 3_600_000 - tolMs) {
      anomalias.push(`${nome}: follow-up 2 ${fmtDuracao(ms(fu2) - ms(wa))} após o inicial (esperado ≥ ${intervalos.followup_2_horas}h)`);
    }
    if (fu1 && fu2 && ms(fu2) - ms(fu1) < 24 * 3_600_000 - tolMs) {
      anomalias.push(`${nome}: follow-up 2 apenas ${fmtDuracao(ms(fu2) - ms(fu1))} após o follow-up 1 (esperado ≥ 24h)`);
    }
  }
  for (const raw of fu1SemInicialRes.data ?? []) {
    const r = raw as Record<string, unknown>;
    anomalias.push(`${String(r.athlete_name)}: follow-up 1 marcado SEM WhatsApp inicial (sequência inválida)`);
  }
  for (const raw of fu2SemFu1Res.data ?? []) {
    const r = raw as Record<string, unknown>;
    anomalias.push(`${String(r.athlete_name)}: follow-up 2 marcado SEM follow-up 1 (sequência inválida)`);
  }

  if (anomalias.length > 0) {
    return {
      id,
      titulo,
      status: anomalias.length > 3 ? "critico" : "atencao",
      resumo: `${anomalias.length} anomalia(s) de timing entre etapas nos últimos 30 dias (base: intervalos atuais — mudá-los reavalia o histórico da janela).`,
      detalhes: [...anomalias.slice(0, 15), ...errosQuery],
    };
  }
  if (errosQuery.length > 0) {
    return { id, titulo, status: "atencao", resumo: "Verificação parcial — houve falha de consulta.", detalhes: errosQuery };
  }
  return { id, titulo, status: "ok", resumo: "Todos os intervalos entre etapas respeitados nos últimos 30 dias.", detalhes: [] };
}

// ─── Filas presas (além do SLA + folga) ──────────────────────────────────────

async function checkFilasPresas(supabase: Supabase): Promise<CheckResult> {
  const id = "filas_presas";
  const titulo = "Filas presas (além do prazo + folga)";
  const intervalos = await lerIntervalos(supabase);

  const corteInicial = horasAtrasISO(intervalos.whatsapp_inicial_horas + FOLGA_FILA_HORAS);
  const corteAlt = horasAtrasISO(intervalos.whatsapp_timing_alt_horas + FOLGA_FILA_HORAS);
  const corteFu1 = horasAtrasISO(intervalos.followup_1_horas + FOLGA_FILA_HORAS);
  const corteFu2 = horasAtrasISO(intervalos.followup_2_horas + FOLGA_FILA_HORAS);
  const corteQualificacao = horasAtrasISO(2);
  const agora = new Date().toISOString();

  // INVARIANTE (espelha os schedulers): classe QUENTE/MORNO + timing_status
  // correto em toda consulta de elegibilidade — nunca misturar fluxos.
  const [qualifRes, inicialRes, altRes, fu1Res, fu2Res, retomadaRes] = await Promise.all([
    supabase
      .from("form_submissions")
      // A coluna de entrada é submitted_at — form_submissions NÃO tem created_at.
      .select("athlete_name, submitted_at")
      .is("qualified_at", null)
      .lt("submitted_at", corteQualificacao)
      .order("submitted_at", { ascending: true })
      .limit(30),
    supabase
      .from("form_submissions")
      .select("athlete_name, qualified_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("qualified_at", "is", null)
      .lt("qualified_at", corteInicial)
      .is("whatsapp_sent_at", null)
      .or("timing_status.is.null,timing_status.eq.ideal")
      // Paridade com o scheduler: sem aprovação humana não é fila presa —
      // o lead está retido de propósito pelo gate do CEO.
      .eq("aprovacao_status", "aprovado")
      .order("qualified_at", { ascending: true })
      .limit(30),
    supabase
      .from("form_submissions")
      .select("athlete_name, qualified_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("qualified_at", "is", null)
      .lt("qualified_at", corteAlt)
      .is("whatsapp_sent_at", null)
      .in("timing_status", ["muito_cedo", "tarde_demais"])
      .eq("aprovacao_status", "aprovado")
      .order("qualified_at", { ascending: true })
      .limit(30),
    supabase
      .from("form_submissions")
      .select("athlete_name, whatsapp_sent_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("whatsapp_sent_at", "is", null)
      .lt("whatsapp_sent_at", corteFu1)
      .is("followup_1_sent_at", null)
      .or("meeting_scheduled.is.null,meeting_scheduled.eq.false")
      .or("timing_status.is.null,timing_status.eq.ideal")
      .order("whatsapp_sent_at", { ascending: true })
      .limit(30),
    supabase
      .from("form_submissions")
      .select("athlete_name, whatsapp_sent_at")
      .in("qualification_classification", ["QUENTE", "MORNO"])
      .not("whatsapp_sent_at", "is", null)
      .lt("whatsapp_sent_at", corteFu2)
      .not("followup_1_sent_at", "is", null)
      .is("followup_2_sent_at", null)
      .or("meeting_scheduled.is.null,meeting_scheduled.eq.false")
      .or("timing_status.is.null,timing_status.eq.ideal")
      .order("whatsapp_sent_at", { ascending: true })
      .limit(30),
    supabase
      .from("form_submissions")
      .select("athlete_name, scheduled_followup_at")
      .eq("timing_status", "muito_cedo")
      .lte("scheduled_followup_at", agora)
      .is("scheduled_followup_sent_at", null)
      .eq("aprovacao_status", "aprovado")
      .limit(30),
  ]);

  const nomes = (rows: unknown[] | null): string =>
    (rows ?? [])
      .slice(0, 5)
      .map((r) => String((r as Record<string, unknown>).athlete_name))
      .join(", ");

  const filas: { label: string; res: { data: unknown[] | null; error: { message: string } | null }; peso: CheckStatus }[] = [
    { label: "Qualificação Gemini (>2h sem classe)", res: qualifRes, peso: "critico" },
    { label: `WhatsApp inicial (>${intervalos.whatsapp_inicial_horas + FOLGA_FILA_HORAS}h)`, res: inicialRes, peso: "critico" },
    { label: `Timing alternativo (>${intervalos.whatsapp_timing_alt_horas + FOLGA_FILA_HORAS}h)`, res: altRes, peso: "atencao" },
    { label: `Follow-up 1 (>${intervalos.followup_1_horas + FOLGA_FILA_HORAS}h)`, res: fu1Res, peso: "atencao" },
    { label: `Follow-up 2 (>${Math.round((intervalos.followup_2_horas + FOLGA_FILA_HORAS) / 24)}d)`, res: fu2Res, peso: "atencao" },
    { label: "Retomada de novembro vencida", res: retomadaRes, peso: "atencao" },
  ];

  const detalhes: string[] = [];
  let status: CheckStatus = "ok";
  let total = 0;
  let falhas = 0;
  for (const f of filas) {
    // PostgREST devolve erro sem lançar exceção — checar SEMPRE, senão a fila
    // reporta 0 silenciosamente (classe de bug que escondeu o monitor antigo).
    if (f.res.error) {
      falhas += 1;
      detalhes.push(`Falha na consulta "${f.label}": ${f.res.error.message}`);
      if (status !== "critico") status = "atencao";
      continue;
    }
    const n = f.res.data?.length ?? 0;
    if (n === 0) continue;
    total += n;
    detalhes.push(`${f.label}: ${n} lead(s) — ${nomes(f.res.data)}${n > 5 ? "…" : ""}`);
    if (f.peso === "critico") status = "critico";
    else if (status !== "critico") status = "atencao";
  }
  if (!retomadaRes.error && (retomadaRes.data?.length ?? 0) > 0) {
    detalhes.push("Nota: conferir o cron da CF process-scheduled-followups (ausente em infra/scheduler.sh).");
  }

  if (total === 0 && falhas === 0) {
    return { id, titulo, status: "ok", resumo: "Nenhuma fila além do prazo esperado.", detalhes: [] };
  }
  const resumo =
    total > 0
      ? `${total} lead(s) presos além do prazo${falhas > 0 ? ` (+${falhas} consulta(s) com falha)` : ""}.`
      : "Verificação parcial — houve falha de consulta.";
  return { id, titulo, status, resumo, detalhes };
}

// ─── Runs recentes (automacao_runs) ──────────────────────────────────────────

async function checkRunsSistema(supabase: Supabase): Promise<CheckResult> {
  const id = "runs_sistema";
  const titulo = "Execuções de sistema (últimas 24h)";
  const d1 = horasAtrasISO(24);

  const [runsRes, errosRes] = await Promise.all([
    supabase
      .from("automacao_runs")
      .select("automacao_id, created_at, status")
      .in("automacao_id", ANCORAS_SISTEMA.map((a) => a.id))
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("automacao_runs")
      .select("id", { count: "exact", head: true })
      .eq("status", "erro")
      .gte("created_at", d1),
  ]);

  if (runsRes.error) {
    return { id, titulo, status: "atencao", resumo: `Falha ao consultar runs: ${runsRes.error.message}`, detalhes: [] };
  }

  const ultimoPorAncora = new Map<string, { created_at: string; status: string }>();
  for (const raw of runsRes.data ?? []) {
    const r = raw as Record<string, unknown>;
    const key = String(r.automacao_id);
    if (!ultimoPorAncora.has(key)) {
      ultimoPorAncora.set(key, { created_at: String(r.created_at), status: String(r.status) });
    }
  }

  const detalhes = ANCORAS_SISTEMA.map((a) => {
    const ultimo = ultimoPorAncora.get(a.id);
    return ultimo
      ? `${a.nome}: último run ${fmtQuando(ultimo.created_at)} (${ultimo.status})`
      : `${a.nome}: nenhum run registrado`;
  });
  detalhes.push("Runs só são criados quando há leads elegíveis — ausência não prova falha.");

  const erros = errosRes.count ?? 0;
  if (erros > 0) {
    return { id, titulo, status: "atencao", resumo: `${erros} run(s) com erro nas últimas 24h.`, detalhes };
  }
  return { id, titulo, status: "info", resumo: "Nenhum run com erro nas últimas 24h.", detalhes };
}

// ─── Monitor de Filas (aba 1) ────────────────────────────────────────────────

export async function runChecksFilas(): Promise<ObservabilidadeFilas> {
  const supabase = await createServerSupabaseClient();
  const d1 = horasAtrasISO(24);

  const zapi = await checkZapiConexao();

  const [fila, espelho, timing, presas, runs, marcados24hRes, espelhadas24hRes] = await Promise.all([
    checkZapiFilaInterna(zapi.online),
    seguro("envios_sem_espelho", "Envios sem espelho de entrega", () => checkEnviosSemEspelho(supabase, zapi.online)),
    seguro("timing_etapas", "Timing entre etapas (janela 30d)", () => checkTimingEtapas(supabase)),
    seguro("filas_presas", "Filas presas (além do prazo + folga)", () => checkFilasPresas(supabase)),
    seguro("runs_sistema", "Execuções de sistema (últimas 24h)", () => checkRunsSistema(supabase)),
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .or(
        `whatsapp_sent_at.gte.${d1},followup_1_sent_at.gte.${d1},followup_2_sent_at.gte.${d1},scheduled_followup_sent_at.gte.${d1}`,
      ),
    supabase
      .from("whatsapp_mensagens")
      .select("id", { count: "exact", head: true })
      .eq("from_me", true)
      .gte("created_at", d1),
  ]);

  const checks = [zapi.check, fila.check, espelho, presas, timing, runs];

  return {
    verificadoEm: new Date().toISOString(),
    kpis: {
      conexaoOnline: zapi.online,
      filaInternaZapi: fila.count,
      enviosMarcados24h: marcados24hRes.count ?? 0,
      espelhadasEnviadas24h: espelhadas24hRes.count ?? 0,
      problemas: contarProblemas(checks),
    },
    checks,
  };
}

// ─── Observabilidade Geral (aba 2) ───────────────────────────────────────────

async function checkSupabaseConexao(supabase: Supabase): Promise<CheckResult> {
  const id = "supabase";
  const titulo = "Supabase (banco de dados)";
  const t0 = Date.now();
  const { error } = await supabase.from("form_submissions").select("id", { count: "exact", head: true });
  const latenciaMs = Date.now() - t0;
  if (error) {
    return { id, titulo, status: "critico", resumo: `Erro ao consultar o banco: ${error.message}`, detalhes: [], latenciaMs };
  }
  return {
    id,
    titulo,
    status: latenciaMs > 3_000 ? "atencao" : "ok",
    resumo: latenciaMs > 3_000 ? `Respondendo lento (${latenciaMs}ms).` : `Conectado (${latenciaMs}ms).`,
    detalhes: [],
    latenciaMs,
  };
}

/**
 * Ping de disponibilidade: GET com secret DELIBERADAMENTE inválido. Com o
 * header presente e errado, TODAS as CFs respondem 401 sem executar nada —
 * inclusive as que hoje são fail-open sem header (retry-qualification e
 * send-remarketing pulam o auth quando o header está AUSENTE e rodariam o job
 * inteiro). Nunca pingar sem o header.
 */
async function pingCf(nome: string, envVar: string): Promise<CheckResult> {
  const id = `cf_${envVar.toLowerCase()}`;
  const titulo = nome;
  const url = process.env[envVar];
  if (!url) {
    return { id, titulo, status: "info", resumo: `URL não configurada (env ${envVar}).`, detalhes: [] };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "x-webhook-secret": "observability-ping-invalido" },
      signal: controller.signal,
      cache: "no-store",
    });
    const latenciaMs = Date.now() - t0;
    return { id, titulo, status: "ok", resumo: `No ar — respondeu HTTP ${res.status} em ${latenciaMs}ms.`, detalhes: [], latenciaMs };
  } catch {
    return { id, titulo, status: "critico", resumo: `Sem resposta em ${PING_TIMEOUT_MS / 1000}s (fora do ar ou rede).`, detalhes: [] };
  } finally {
    clearTimeout(timer);
  }
}

async function checkGemini(): Promise<CheckResult> {
  const id = "gemini";
  const titulo = "Gemini (IA)";
  const t0 = Date.now();
  try {
    await gerarConteudoGemini("Responda apenas com a palavra OK.");
    const latenciaMs = Date.now() - t0;
    return { id, titulo, status: "ok", resumo: `Respondendo (${latenciaMs}ms).`, detalhes: [], latenciaMs };
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return { id, titulo, status: "info", resumo: "GEMINI_API_KEY não configurada neste ambiente.", detalhes: [] };
    }
    return { id, titulo, status: "critico", resumo: `Erro na chamada de teste: ${e instanceof Error ? e.message : String(e)}`, detalhes: [] };
  }
}

// ─── Checks de fluxo (paridade com o watchdog monitor-health v2) ─────────────
// A MESMA lógica roda automaticamente na CF a cada 30min (alerta) e aqui
// on-demand (diagnóstico) — o guard tests/monitor-health-invariants.test.js
// trava a paridade dos dois lados.

const ENTRADA_ZERO_HORAS = 24;
const CHATBOT_ERRO_MINIMO = 3;
const REMARKETING_PRESA_HORAS = 2;
const REGUA_FOLGA_DIAS = 2;
const NPS_PRAZO_DIAS = 181;
const META_FRESCOR_DIAS = 3; // idade do GASTO — sinal secundário, atenção SÓ na tela
const META_TICK_MAX_HORAS = 26; // heartbeat do sync (job diário 06h + folga, padrão billing)
const TRANSCRICAO_FOLGA_HORAS = 24;
const RUNS_PRESOS_HORAS = 2;

async function contarSimples(
  supabase: Supabase,
  monta: (q: ReturnType<Supabase["from"]>) => PromiseLike<{ count: number | null; error: { message: string } | null }>,
  tabela: string,
): Promise<number> {
  const res = await monta(supabase.from(tabela));
  if (res.error) throw new Error(`${tabela}: ${res.error.message}`);
  return res.count ?? 0;
}

async function checkEntradaZero(supabase: Supabase): Promise<CheckResult> {
  const n = await contarSimples(
    supabase,
    (q) => q.select("id", { count: "exact", head: true }).gte("submitted_at", horasAtrasISO(ENTRADA_ZERO_HORAS)),
    "form_submissions",
  );
  return {
    id: "entrada_zero",
    titulo: "Entrada de leads (formulário)",
    status: n > 0 ? "ok" : "critico",
    resumo: n > 0
      ? `${n} submissão(ões) nas últimas ${ENTRADA_ZERO_HORAS}h.`
      : `ZERO submissões em ${ENTRADA_ZERO_HORAS}h — formulário/funil de entrada possivelmente parado (mídia queimando sem lead).`,
    detalhes: [],
  };
}

async function checkAprovacaoPendenteAntiga(supabase: Supabase): Promise<CheckResult> {
  const id = "aprovacao_pendente_antiga";
  const titulo = "Fila de aprovação de leads";
  const HORAS = 24;
  const n = await contarSimples(
    supabase,
    (q) =>
      q
        .select("id", { count: "exact", head: true })
        .eq("aprovacao_status", "pendente")
        .in("qualification_classification", ["QUENTE", "MORNO"])
        .lt("qualified_at", horasAtrasISO(HORAS)),
    "form_submissions",
  );
  return {
    id,
    titulo,
    status: n === 0 ? "ok" : "atencao",
    resumo: n === 0
      ? "Nenhum lead esperando aprovação além do prazo."
      : `${n} lead(s) QUENTE/MORNO aguardando aprovação do CEO há ${HORAS}h+ — a fila retém pipeline E WhatsApp (abrir em Leads → Aprovações).`,
    detalhes: [],
  };
}

async function checkChatbotErro(supabase: Supabase): Promise<CheckResult> {
  const id = "chatbot_erro";
  const titulo = "Chatbot autônomo (erros)";
  const { data } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", "chatbot_autonomo").limit(1);
  const modo = ((data?.[0]?.valor ?? {}) as Record<string, unknown>).modo;
  if (modo !== "sombra" && modo !== "ativo") {
    return { id, titulo, status: "info", resumo: "Chatbot autônomo off — check pulado.", detalhes: [] };
  }
  const desde = horasAtrasISO(6);
  const [erros, falhasEnvio] = await Promise.all([
    contarSimples(supabase, (q) => q.select("id", { count: "exact", head: true }).eq("decisao", "erro").gte("created_at", desde), "chatbot_autonomo_log"),
    contarSimples(supabase, (q) => q.select("id", { count: "exact", head: true }).eq("decisao", "respondeu").eq("enviado", false).gte("created_at", desde), "chatbot_autonomo_log"),
  ]);
  const soma = erros + falhasEnvio;
  return {
    id,
    titulo,
    status: soma < CHATBOT_ERRO_MINIMO ? "ok" : "critico",
    resumo: `Chatbot (${String(modo)}): ${erros} erro(s) + ${falhasEnvio} resposta(s) sem envio nas últimas 6h.`,
    detalhes: [],
  };
}

async function checkRemarketingPresa(supabase: Supabase): Promise<CheckResult> {
  const n = await contarSimples(
    supabase,
    (q) => q.select("id", { count: "exact", head: true }).eq("status", "enviando").is("deleted_at", null).lt("updated_at", horasAtrasISO(REMARKETING_PRESA_HORAS)),
    "remarketing_campanhas",
  );
  return {
    id: "remarketing_presa",
    titulo: "Re-marketing (campanha presa)",
    status: n === 0 ? "ok" : "critico",
    resumo: n === 0
      ? "Nenhuma campanha presa em 'enviando'."
      : `${n} campanha(s) em 'enviando' sem progresso há ${REMARKETING_PRESA_HORAS}h+ (cron de disparo parado?).`,
    detalhes: [],
  };
}

async function checkReguaCobranca(supabase: Supabase): Promise<CheckResult> {
  const corte = horasAtrasISO(REGUA_FOLGA_DIAS * 24).slice(0, 10);
  const n = await contarSimples(
    supabase,
    (q) => q.select("id", { count: "exact", head: true })
      .eq("status", "atrasado").is("deleted_at", null).lt("vencimento", corte)
      .is("regua_dneg3_at", null).is("regua_d0_at", null).is("regua_d1_at", null)
      .is("regua_d3_at", null).is("regua_d7_at", null).is("regua_d15_at", null),
    "parcelas",
  );
  return {
    id: "regua_cobranca",
    titulo: "Régua de cobrança",
    status: n === 0 ? "ok" : "atencao",
    resumo: n === 0
      ? "Nenhuma parcela atrasada sem marco da régua."
      : `${n} parcela(s) atrasada(s) ${REGUA_FOLGA_DIAS}d+ sem NENHUM marco da régua (job pausado?).`,
    detalhes: ["Suprimível no monitor via monitor_checks_desativados enquanto a régua estiver pausada de propósito."],
  };
}

async function checkExperienciaNps(supabase: Supabase): Promise<CheckResult> {
  const n = await contarSimples(
    supabase,
    (q) => q.select("id", { count: "exact", head: true })
      .in("fase", ["embarcado_inicial", "acompanhamento"])
      .is("nps_enviado_at", null)
      .lt("created_at", horasAtrasISO(NPS_PRAZO_DIAS * 24)),
    "crm_experiencia",
  );
  return {
    id: "experiencia_nps",
    titulo: "NPS pós-venda",
    status: n === 0 ? "ok" : "atencao",
    resumo: n === 0
      ? "Nenhuma família elegível a NPS sem envio."
      : `${n} família(s) elegível(is) a NPS sem envio além do prazo (+24h folga) — job pausado?`,
    detalhes: ["Suprimível no monitor via monitor_checks_desativados enquanto o job estiver pausado de propósito."],
  };
}

async function checkMetaFrescor(supabase: Supabase): Promise<CheckResult> {
  const id = "meta_frescor";
  const titulo = "CAC Meta (frescor do sync)";

  // Sinal PRIMÁRIO: heartbeat do sync (meta_sync_last_tick_at, gravado pela
  // CF sync-meta-spend em TODO tick, mesmo com gasto 0). Idade do gasto é
  // sinal SECUNDÁRIO informativo: campanhas pausadas ≠ sync quebrado — o
  // check antigo confundia os dois ("token expirado?" com sync perfeito).
  const tick = await lerConfigValor(supabase, "meta_sync_last_tick_at");

  // Sinal secundário NUNCA derruba o primário: erro aqui degrada o detalhe
  // (regressão de grant/RLS na tabela de gasto não pode cegar o heartbeat).
  let gastoDias: number | null = null;
  let detalheGasto: string;
  try {
    const { data, error } = await supabase.from("meta_ads_campanha").select("data").order("data", { ascending: false }).limit(1);
    if (error) throw new Error(error.message);
    gastoDias = data && data.length > 0 ? Math.floor((Date.now() - new Date(String(data[0].data)).getTime()) / 86_400_000) : null;
    detalheGasto =
      gastoDias === null
        ? "Sem linhas de gasto ainda."
        : `Último GASTO registrado há ${gastoDias}d${gastoDias > META_FRESCOR_DIAS ? " — campanhas pausadas ou sem investimento (informativo; NÃO é falha do sync)." : "."}`;
  } catch (e) {
    detalheGasto = `Idade do gasto indisponível (${e instanceof Error ? e.message : "erro na consulta"}) — não afeta o heartbeat.`;
  }

  if (typeof tick.at !== "string") {
    return { id, titulo, status: "info", resumo: "Sync Meta nunca tickou (config pendente) — check pulado.", detalhes: [detalheGasto] };
  }
  const horas = Math.floor((Date.now() - new Date(tick.at).getTime()) / 3_600_000);
  // Fail-closed como a CF: heartbeat ilegível (NaN) = crítico, nunca "vivo há NaNh"
  if (!Number.isFinite(horas)) {
    return { id, titulo, status: "critico", resumo: "Heartbeat do sync Meta ILEGÍVEL (meta_sync_last_tick_at.at inválido).", detalhes: [detalheGasto] };
  }
  if (horas > META_TICK_MAX_HORAS) {
    return {
      id,
      titulo,
      status: "critico",
      resumo: `Sync Meta SEM TICK há ${horas}h — job parado ou token inválido (CAC/DRE congelados).`,
      detalhes: [detalheGasto],
    };
  }
  return {
    id,
    titulo,
    status: gastoDias !== null && gastoDias > META_FRESCOR_DIAS ? "atencao" : "ok",
    resumo: `Sync Meta vivo (último tick há ${horas}h).`,
    detalhes: [detalheGasto],
  };
}

// A3: CPL real (30d) × CPL alvo dos planos executados vinculados a campanha.
// SÓ NOTIFICA (decisão do CEO) — o corte é clique humano no /ads.
async function checkAdsCplAlvo(supabase: Supabase): Promise<CheckResult> {
  const id = "ads_cpl_alvo";
  const titulo = "Ads: CPL real × alvo dos planos";
  const { data: planos, error } = await supabase
    .from("ads_planos")
    .select("titulo, campanha_id, plano")
    .eq("status", "executado")
    .not("campanha_id", "is", null)
    .is("deleted_at", null)
    .limit(10);
  if (error) throw new Error(`ads_planos: ${error.message}`);
  if (!planos || planos.length === 0) {
    return { id, titulo, status: "info", resumo: "Nenhum plano executado vinculado a campanha — check pulado.", detalhes: [] };
  }

  const corteDia = horasAtrasISO(30 * 24).slice(0, 10);
  const corteTs = horasAtrasISO(30 * 24);
  const estourados: string[] = [];
  let avaliados = 0;
  for (const p of planos) {
    const plano = p.plano as { cplAlvo?: { valorBrl?: number } } | null;
    const alvo = Number(plano?.cplAlvo?.valorBrl);
    const cid = String(p.campanha_id ?? "").trim();
    if (!Number.isFinite(alvo) || alvo <= 0 || !cid) continue;

    const { data: gastoRows } = await supabase
      .from("meta_ads_campanha")
      .select("valor_gasto")
      .eq("campanha_id", cid)
      .gte("data", corteDia)
      .is("deleted_at", null);
    const gasto = (gastoRows ?? []).reduce((s, r) => s + (Number(r.valor_gasto) || 0), 0);
    if (gasto <= 0) continue;
    avaliados += 1;

    const { count } = await supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("utm_id", cid)
      .gte("submitted_at", corteTs);
    const leads = count ?? 0;
    const cpl = leads > 0 ? gasto / leads : null;
    // Sem leads: só acusa após gastar 3x o alvo (evita alarme no 1º dia)
    const estourou = cpl === null ? gasto > alvo * 3 : cpl > alvo * 1.3;
    if (estourou) {
      estourados.push(`"${String(p.titulo).slice(0, 40)}": CPL ${cpl === null ? "sem leads" : `R$ ${cpl.toFixed(0)}`} vs alvo R$ ${alvo}`);
    }
  }

  if (estourados.length > 0) {
    return {
      id,
      titulo,
      status: "critico",
      resumo: `CPL acima do alvo em ${estourados.length} plano(s) — avaliar cortar/ajustar no /ads.`,
      detalhes: estourados,
    };
  }
  return {
    id,
    titulo,
    status: "ok",
    resumo: `${avaliados > 0 ? `${avaliados} plano(s) com entrega dentro do alvo` : `${planos.length} plano(s) vinculados, ainda sem entrega no período`}.`,
    detalhes: [],
  };
}

async function checkTranscricaoFaltante(supabase: Supabase): Promise<CheckResult> {
  const id = "transcricao_faltante";
  const titulo = "Transcrições do Meet";
  const { count: total } = await supabase.from("reunioes_transcricoes").select("id", { count: "exact", head: true });
  if (!total) {
    return { id, titulo, status: "info", resumo: "Nenhuma transcrição capturada ainda (config pendente) — check pulado.", detalhes: [] };
  }
  const { data: deals, error } = await supabase
    .from("deals")
    .select("google_calendar_event_id")
    .eq("etapa", "reuniao_realizada")
    .not("google_calendar_event_id", "is", null)
    .is("deleted_at", null)
    .gte("updated_at", horasAtrasISO(7 * 24))
    .lt("updated_at", horasAtrasISO(TRANSCRICAO_FOLGA_HORAS))
    .limit(50);
  if (error) throw new Error(`deals: ${error.message}`);
  const ids = (deals ?? []).map((d) => String((d as Record<string, unknown>).google_calendar_event_id)).filter(Boolean);
  if (ids.length === 0) {
    return { id, titulo, status: "ok", resumo: "Nenhuma reunião realizada aguardando transcrição.", detalhes: [] };
  }
  const { data: capturadas } = await supabase.from("reunioes_transcricoes").select("google_event_id").in("google_event_id", ids);
  const set = new Set((capturadas ?? []).map((t) => String((t as Record<string, unknown>).google_event_id)));
  const faltantes = ids.filter((i) => !set.has(i)).length;
  return {
    id,
    titulo,
    status: faltantes === 0 ? "ok" : "atencao",
    resumo: faltantes === 0
      ? "Todas as reuniões realizadas têm transcrição capturada."
      : `${faltantes} reunião(ões) realizadas há ${TRANSCRICAO_FOLGA_HORAS}h+ sem transcrição capturada.`,
    detalhes: [],
  };
}

// ─── Sinais criados na F2 (fluxos que antes não deixavam rastro) ─────────────

async function lerConfigValor(supabase: Supabase, chave: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from("configuracoes_sistema").select("valor").eq("chave", chave).limit(1);
  if (error) throw new Error(`configuracoes_sistema(${chave}): ${error.message}`);
  return (data?.[0]?.valor ?? {}) as Record<string, unknown>;
}

async function checkCalendarWatch(supabase: Supabase): Promise<CheckResult> {
  const id = "calendar_watch_expirando";
  const titulo = "Watch do Google Calendar";
  const state = await lerConfigValor(supabase, "calendar_watch_state");
  if (typeof state.expiration !== "string") {
    return { id, titulo, status: "info", resumo: "Aguardando primeiro sinal do renew-calendar-watch (config pendente).", detalhes: [] };
  }
  const expMs = new Date(state.expiration).getTime();
  const renovadoMs = typeof state.renewed_at === "string" ? new Date(state.renewed_at).getTime() : NaN;
  const expiraEmH = Math.floor((expMs - Date.now()) / 3_600_000);
  const renovadoHaDias = Number.isFinite(renovadoMs) ? Math.floor((Date.now() - renovadoMs) / 86_400_000) : 999;
  const ok = expMs > Date.now() + 24 * 3_600_000 && renovadoHaDias <= 8;
  return {
    id,
    titulo,
    status: ok ? "ok" : "critico",
    resumo: ok
      ? `Watch saudável — expira em ${expiraEmH}h (renovado há ${renovadoHaDias}d).`
      : `Watch ${expMs < Date.now() ? "EXPIRADO" : `expira em ${expiraEmH}h`} (renovação há ${renovadoHaDias}d) — a detecção de reuniões vai morrer em silêncio.`,
    detalhes: [],
  };
}

async function checkSheetsSync(supabase: Supabase): Promise<CheckResult> {
  const n = await contarSimples(
    supabase,
    (q) => q.select("id", { count: "exact", head: true })
      .is("sheets_synced_at", null)
      .lt("submitted_at", horasAtrasISO(2))
      .gte("submitted_at", horasAtrasISO(7 * 24)),
    "form_submissions",
  );
  return {
    id: "sheets_sync_pendente",
    titulo: "Sync Google Sheets",
    status: n === 0 ? "ok" : "critico",
    resumo: n === 0
      ? "Todos os leads recentes sincronizados na planilha."
      : `${n} lead(s) há 2h+ sem sync no Google Sheets — planilha dessincronizada do banco.`,
    detalhes: [],
  };
}

async function checkWeeklyReport(supabase: Supabase): Promise<CheckResult> {
  const id = "weekly_report_atrasado";
  const titulo = "Relatório semanal";
  const state = await lerConfigValor(supabase, "weekly_report_state");
  if (typeof state.last_sent_at !== "string") {
    return { id, titulo, status: "info", resumo: "Aguardando primeiro envio do weekly-report.", detalhes: [] };
  }
  const dias = Math.floor((Date.now() - new Date(state.last_sent_at).getTime()) / 86_400_000);
  return {
    id,
    titulo,
    status: dias <= 8 ? "ok" : "atencao",
    resumo: `Último relatório semanal enviado há ${dias}d${dias > 8 ? " — job parado ou providers de e-mail falhando." : "."}`,
    detalhes: [],
  };
}

async function checkBillingTick(supabase: Supabase): Promise<CheckResult> {
  const id = "billing_tick_atrasado";
  const titulo = "Régua de cobrança (heartbeat)";
  const state = await lerConfigValor(supabase, "billing_last_tick_at");
  if (typeof state.at !== "string") {
    return { id, titulo, status: "info", resumo: "Régua nunca tickou (job pausado de propósito).", detalhes: [] };
  }
  const horas = Math.floor((Date.now() - new Date(state.at).getTime()) / 3_600_000);
  return {
    id,
    titulo,
    status: horas <= 26 ? "ok" : "atencao",
    resumo: `Último tick da régua há ${horas}h${horas > 26 ? " — job pausado/quebrado (parcelas sem cobrança)." : "."}`,
    detalhes: [],
  };
}

async function checkRunsPresos(supabase: Supabase): Promise<CheckResult> {
  const corte = horasAtrasISO(RUNS_PRESOS_HORAS);
  const [pendentes, retryVencido] = await Promise.all([
    contarSimples(supabase, (q) => q.select("id", { count: "exact", head: true }).eq("status", "pendente").lt("created_at", corte), "automacao_runs"),
    contarSimples(supabase, (q) => q.select("id", { count: "exact", head: true }).eq("status", "erro").lt("proxima_tentativa_at", corte), "automacao_runs"),
  ]);
  const soma = pendentes + retryVencido;
  return {
    id: "runs_presos",
    titulo: "Engine de automações (runs presos)",
    status: soma === 0 ? "ok" : "critico",
    resumo: soma === 0
      ? "Nenhum run preso — engine consumindo a fila."
      : `${pendentes} run(s) pendentes ${RUNS_PRESOS_HORAS}h+ e ${retryVencido} retry(s) vencidos — engine de automações possivelmente parada.`,
    detalhes: [],
  };
}

async function checkCalendar(supabase: Supabase): Promise<CheckResult> {
  const id = "calendar";
  const titulo = "Google Calendar (detecção de reuniões)";
  const { data } = await supabase
    .from("form_submissions")
    .select("meeting_scheduled_at")
    .eq("meeting_scheduled", true)
    .not("meeting_scheduled_at", "is", null)
    .order("meeting_scheduled_at", { ascending: false })
    .limit(1);
  const ultima = (data?.[0]?.meeting_scheduled_at as string | undefined) ?? null;
  return {
    id,
    titulo,
    status: "info",
    resumo: ultima ? `Última reunião detectada ${fmtQuando(ultima)}.` : "Nenhuma reunião detectada ainda.",
    detalhes: ["Detecção depende de leads agendando — ausência recente não prova falha do webhook."],
  };
}

export async function runChecksGeral(): Promise<ObservabilidadeGeral> {
  const supabase = await createServerSupabaseClient();
  const d1 = horasAtrasISO(24);

  const zapiPromise = checkZapiConexao();

  const [
    zapi,
    supabaseCheck,
    gemini,
    calendar,
    entradaZero,
    chatbotErro,
    remarketingPresa,
    reguaCobranca,
    experienciaNps,
    metaFrescor,
    transcricaoFaltante,
    runsPresos,
    calendarWatch,
    sheetsSync,
    weeklyReport,
    billingTick,
    ...cfsEDados
  ] = await Promise.all([
    zapiPromise,
    seguro("supabase", "Supabase (banco de dados)", () => checkSupabaseConexao(supabase)),
    seguro("gemini", "Gemini (IA)", () => checkGemini()),
    seguro("calendar", "Google Calendar (detecção de reuniões)", () => checkCalendar(supabase)),
    // Paridade com o watchdog monitor-health v2 (mesma lógica, on-demand)
    seguro("entrada_zero", "Entrada de leads (formulário)", () => checkEntradaZero(supabase)),
    seguro("aprovacao_pendente_antiga", "Fila de aprovação de leads", () => checkAprovacaoPendenteAntiga(supabase)),
    seguro("chatbot_erro", "Chatbot autônomo (erros)", () => checkChatbotErro(supabase)),
    seguro("remarketing_presa", "Re-marketing (campanha presa)", () => checkRemarketingPresa(supabase)),
    seguro("regua_cobranca", "Régua de cobrança", () => checkReguaCobranca(supabase)),
    seguro("experiencia_nps", "NPS pós-venda", () => checkExperienciaNps(supabase)),
    seguro("meta_frescor", "CAC Meta (frescor do sync)", () => checkMetaFrescor(supabase)),
    seguro("ads_cpl_alvo", "Ads: CPL real × alvo dos planos", () => checkAdsCplAlvo(supabase)),
    seguro("transcricao_faltante", "Transcrições do Meet", () => checkTranscricaoFaltante(supabase)),
    seguro("runs_presos", "Engine de automações (runs presos)", () => checkRunsPresos(supabase)),
    seguro("calendar_watch_expirando", "Watch do Google Calendar", () => checkCalendarWatch(supabase)),
    seguro("sheets_sync_pendente", "Sync Google Sheets", () => checkSheetsSync(supabase)),
    seguro("weekly_report_atrasado", "Relatório semanal", () => checkWeeklyReport(supabase)),
    seguro("billing_tick_atrasado", "Régua de cobrança (heartbeat)", () => checkBillingTick(supabase)),
    ...CFS_PING.map((cf) => seguro(`cf_${cf.env.toLowerCase()}`, cf.nome, () => pingCf(cf.nome, cf.env))),
  ]);

  const cfs = cfsEDados as CheckResult[];

  const [leadsRes, qualifRes, waRes, espelhadasRes, reunioesRes] = await Promise.all([
    supabase.from("form_submissions").select("id", { count: "exact", head: true }).gte("submitted_at", d1),
    supabase.from("form_submissions").select("id", { count: "exact", head: true }).gte("qualified_at", d1),
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .or(
        `whatsapp_sent_at.gte.${d1},followup_1_sent_at.gte.${d1},followup_2_sent_at.gte.${d1},scheduled_followup_sent_at.gte.${d1}`,
      ),
    supabase.from("whatsapp_mensagens").select("id", { count: "exact", head: true }).eq("from_me", true).gte("created_at", d1),
    supabase.from("form_submissions").select("id", { count: "exact", head: true }).gte("meeting_scheduled_at", d1),
  ]);

  return {
    verificadoEm: new Date().toISOString(),
    conexoes: [zapi.check, supabaseCheck, ...cfs, gemini],
    fluxos: [
      entradaZero,
      calendarWatch,
      sheetsSync,
      runsPresos,
      chatbotErro,
      remarketingPresa,
      reguaCobranca,
      billingTick,
      experienciaNps,
      metaFrescor,
      transcricaoFaltante,
      weeklyReport,
      calendar,
    ],
    funil24h: {
      leads: leadsRes.count ?? 0,
      qualificados: qualifRes.count ?? 0,
      whatsappMarcado: waRes.count ?? 0,
      espelhadas: espelhadasRes.count ?? 0,
      reunioes: reunioesRes.count ?? 0,
    },
  };
}
