import { createServerSupabaseClient } from "@/lib/supabase-server";

// ════════════════════════════════════════════════════════════════════════
// Métricas de conversas (WhatsApp) + timings do funil comercial.
// Fonte de conversa: whatsapp_mensagens (schema public SEMPRE; RLS CEO-only) —
// histórico só a partir da ativação do webhook (2026-07-08), sem backfill.
// Agregação em JS (padrão de cac-queries/war-room-queries). Divisão por zero
// → null (a UI mostra "—").
//
// PEGADINHA LID: `phone` guarda telefone real OU o LID; uma conversa pode se
// partir em duas chaves. O de-para só existe no /chats da Z-API (não no banco),
// então "conversas distintas" e gaps são POR CHAVE phone — aproximação aceita
// no volume atual (documentada na UI).
// ════════════════════════════════════════════════════════════════════════

export type ConversaPeriod = "7d" | "30d" | "90d" | "tudo";

const PERIOD_DAYS: Record<ConversaPeriod, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  tudo: null,
};

const PARADA_DIAS = 3; // conversa "parada": última msg há mais de N dias
const RESPOSTA_MAX_HORAS = 72; // gaps acima disso não contam como "tempo de resposta"
const SP_TZ = "America/Sao_Paulo";
const FETCH_LIMIT = 20_000; // teto defensivo — order DESC garante que o corte perca o ANTIGO, não o recente

/** Últimos 10 dígitos do número do CEO (env opcional) — as auto-notificações do
 *  sistema ao CEO usam a mesma instância Z-API e poluiriam as métricas. Sem a
 *  env, nenhuma exclusão (degradação graciosa). */
const CEO_TAIL = (process.env.CEO_WHATSAPP ?? "").replace(/\D/g, "").slice(-10);

function startMs(period: ConversaPeriod): number | null {
  const days = PERIOD_DAYS[period];
  if (days === null) return null;
  return Date.now() - days * 24 * 60 * 60 * 1000;
}

function diaSP(ms: number): string {
  // YYYY-MM-DD no fuso de São Paulo (en-CA formata como ISO date)
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: SP_TZ });
}

function mediana(valores: number[]): number | null {
  if (valores.length === 0) return null;
  const ord = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ord.length / 2);
  return ord.length % 2 ? ord[meio] : (ord[meio - 1] + ord[meio]) / 2;
}

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

// ─── Conversas (WhatsApp) ────────────────────────────────────────────────

export interface VolumeDia {
  dia: string;
  enviadas: number;
  recebidas: number;
}

export interface MidiaTipo {
  tipo: string;
  enviadas: number;
  recebidas: number;
}

export interface ConversaMetrics {
  totalMensagens: number;
  enviadas: number;
  recebidas: number;
  /** Conversas distintas (por chave phone) com msg no período. */
  conversasAtivas: number;
  /** Conversas cuja última msg (all-time) é do lead → devemos resposta. */
  aguardandoResposta: number;
  /** Conversas sem NENHUMA msg recebida (lead nunca respondeu). */
  nuncaResponderam: number;
  /** Conversas cuja última msg (all-time) foi há mais de PARADA_DIAS dias. */
  paradas: number;
  /** Taxa de resposta: conversas com ≥1 msg do lead / total de conversas. */
  taxaResposta: number | null;
  /** Nosso tempo de resposta (minutos) — mediana e média (gaps < 72h). */
  nossaRespostaMedianaMin: number | null;
  nossaRespostaMediaMin: number | null;
  /** Tempo de resposta do lead (minutos). */
  leadRespostaMedianaMin: number | null;
  leadRespostaMediaMin: number | null;
  volumePorDia: VolumeDia[];
  midiaPorTipo: MidiaTipo[];
}

interface MsgRow {
  from_me: boolean;
  phone: string;
  momment: string | null;
  created_at: string;
  tipo: string | null;
}

export async function fetchConversaMetrics(period: ConversaPeriod): Promise<ConversaMetrics> {
  const supabase = await createServerSupabaseClient();

  // Uma leitura só: tudo é agregado em JS (volume/mídia/resposta no período;
  // engajamento é estado ATUAL = all-time). Ordena por tempo p/ os gaps.
  // order DESC: se a tabela passar de FETCH_LIMIT, o corte perde as ANTIGAS,
  // não as recentes (o dashboard nunca "congela no passado" silenciosamente).
  const { data, error } = await supabase
    .from("whatsapp_mensagens")
    .select("from_me, phone, momment, created_at, tipo")
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  const vazio: ConversaMetrics = {
    totalMensagens: 0,
    enviadas: 0,
    recebidas: 0,
    conversasAtivas: 0,
    aguardandoResposta: 0,
    nuncaResponderam: 0,
    paradas: 0,
    taxaResposta: null,
    nossaRespostaMedianaMin: null,
    nossaRespostaMediaMin: null,
    leadRespostaMedianaMin: null,
    leadRespostaMediaMin: null,
    volumePorDia: [],
    midiaPorTipo: [],
  };
  if (error || !data || data.length === 0) return vazio;

  // Exclui a conversa do próprio CEO (auto-notificações do sistema — mesma
  // instância Z-API) para não poluir taxa de resposta / "nunca responderam".
  const rows = (data as MsgRow[]).filter(
    (r) => !CEO_TAIL || !r.phone.replace(/\D/g, "").endsWith(CEO_TAIL),
  );
  if (rows.length === 0) return vazio;
  const tempoMs = (r: MsgRow) => Date.parse(r.momment ?? r.created_at);
  const inicio = startMs(period);

  // Estado por conversa (all-time p/ engajamento; ordenado p/ gaps)
  const porConversa = new Map<string, MsgRow[]>();
  for (const r of rows) {
    const lista = porConversa.get(r.phone);
    if (lista) lista.push(r);
    else porConversa.set(r.phone, [r]);
  }

  // ── Período: volume por dia + mídia por tipo + gaps de resposta ──
  const volumeMap = new Map<string, { enviadas: number; recebidas: number }>();
  const midiaMap = new Map<string, { enviadas: number; recebidas: number }>();
  const nossosGaps: number[] = []; // min — lead falou → nós respondemos
  const leadGaps: number[] = []; // min — nós falamos → lead respondeu
  let enviadas = 0;
  let recebidas = 0;
  let totalPeriodo = 0;

  const noPeriodo = (t: number) => inicio === null || t >= inicio;

  for (const [, lista] of porConversa) {
    // lista já vem globalmente ordenada por created_at asc; reforça por tempo real
    const ordenada = [...lista].sort((a, b) => tempoMs(a) - tempoMs(b));
    let anterior: MsgRow | null = null;
    for (const r of ordenada) {
      const t = tempoMs(r);
      if (noPeriodo(t)) {
        totalPeriodo++;
        if (r.from_me) enviadas++;
        else recebidas++;
        const dia = diaSP(t);
        const v = volumeMap.get(dia) ?? { enviadas: 0, recebidas: 0 };
        if (r.from_me) v.enviadas++;
        else v.recebidas++;
        volumeMap.set(dia, v);
        const tp = r.tipo ?? "text";
        if (tp !== "text") {
          const m = midiaMap.get(tp) ?? { enviadas: 0, recebidas: 0 };
          if (r.from_me) m.enviadas++;
          else m.recebidas++;
          midiaMap.set(tp, m);
        }
      }
      // Gap na virada de direção (conta no período pela msg-resposta)
      if (anterior && anterior.from_me !== r.from_me && noPeriodo(t)) {
        const gapMin = (t - tempoMs(anterior)) / 60000;
        if (gapMin >= 0 && gapMin <= RESPOSTA_MAX_HORAS * 60) {
          if (r.from_me) nossosGaps.push(gapMin); // lead(false) → nós(true)
          else leadGaps.push(gapMin); // nós(true) → lead(false)
        }
      }
      anterior = r;
    }
  }

  // ── Engajamento: estado ATUAL (all-time) por conversa ──
  const agora = Date.now();
  let conversasAtivas = 0;
  let aguardandoResposta = 0;
  let nuncaResponderam = 0;
  let paradas = 0;
  let comResposta = 0;
  const totalConversas = porConversa.size;

  for (const [, lista] of porConversa) {
    const ordenada = [...lista].sort((a, b) => tempoMs(a) - tempoMs(b));
    const ultima = ordenada[ordenada.length - 1];
    const temInbound = ordenada.some((r) => !r.from_me);
    if (temInbound) comResposta++;
    else nuncaResponderam++;
    if (!ultima.from_me) aguardandoResposta++;
    const diasDesdeUltima = (agora - tempoMs(ultima)) / (24 * 60 * 60 * 1000);
    if (diasDesdeUltima > PARADA_DIAS) paradas++;
    // "ativa" = teve mensagem no período
    if (inicio === null || ordenada.some((r) => tempoMs(r) >= inicio)) conversasAtivas++;
  }

  const volumePorDia = preencherDias(
    [...volumeMap.entries()]
      .map(([dia, v]) => ({ dia, ...v }))
      .sort((a, b) => a.dia.localeCompare(b.dia)),
  );

  const midiaPorTipo: MidiaTipo[] = [...midiaMap.entries()]
    .map(([tipo, v]) => ({ tipo, ...v }))
    .sort((a, b) => b.enviadas + b.recebidas - (a.enviadas + a.recebidas));

  return {
    totalMensagens: totalPeriodo,
    enviadas,
    recebidas,
    conversasAtivas,
    aguardandoResposta,
    nuncaResponderam,
    paradas,
    taxaResposta: totalConversas > 0 ? comResposta / totalConversas : null,
    nossaRespostaMedianaMin: mediana(nossosGaps),
    nossaRespostaMediaMin: media(nossosGaps),
    leadRespostaMedianaMin: mediana(leadGaps),
    leadRespostaMediaMin: media(leadGaps),
    volumePorDia,
    midiaPorTipo,
  };
}

/** Preenche dias sem mensagem com zero (entre o 1º e o último dia observados) —
 *  senão o AreaChart liga uma reta por cima de buracos de vários dias. Ancora
 *  ao meio-dia UTC (= 9h SP) p/ o slice de data casar com o dia-SP das chaves. */
function preencherDias(ordenado: VolumeDia[]): VolumeDia[] {
  if (ordenado.length <= 1) return ordenado;
  const mapa = new Map(ordenado.map((v) => [v.dia, v]));
  const out: VolumeDia[] = [];
  let cur = new Date(`${ordenado[0].dia}T12:00:00Z`).getTime();
  const fim = new Date(`${ordenado[ordenado.length - 1].dia}T12:00:00Z`).getTime();
  let guarda = 0;
  while (cur <= fim && guarda++ < 1000) {
    const dia = new Date(cur).toISOString().slice(0, 10);
    out.push(mapa.get(dia) ?? { dia, enviadas: 0, recebidas: 0 });
    cur += DIA_MS_LOCAL;
  }
  return out;
}
const DIA_MS_LOCAL = 24 * 60 * 60 * 1000;

// ─── Funil comercial — timings (dias) ────────────────────────────────────

export interface FunilEtapa {
  chave: string;
  label: string;
  medianaDias: number | null;
  mediaDias: number | null;
  amostra: number; // nº de leads/deals que passaram pela transição
}

export interface FunilTiming {
  etapas: FunilEtapa[];
  /** Ciclo total (1º contato → contrato assinado), dias. */
  cicloMedianaDias: number | null;
  cicloAmostra: number;
}

interface FormRow {
  created_at: string;
  whatsapp_sent_at: string | null;
  meeting_scheduled_at: string | null;
}

interface DealRow {
  created_at: string;
  reuniao_realizada_at: string | null;
  contrato_assinado_at: string | null;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function gapDias(deIso: string | null, ateIso: string | null): number | null {
  if (!deIso || !ateIso) return null;
  const d = Date.parse(deIso);
  const a = Date.parse(ateIso);
  if (!Number.isFinite(d) || !Number.isFinite(a) || a < d) return null;
  return (a - d) / DIA_MS;
}

export async function fetchFunilTiming(period: ConversaPeriod): Promise<FunilTiming> {
  const supabase = await createServerSupabaseClient();
  const inicio = startMs(period);
  const inicioISO = inicio !== null ? new Date(inicio).toISOString() : null;

  const formQuery = supabase
    .from("form_submissions")
    .select("created_at, whatsapp_sent_at, meeting_scheduled_at")
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);
  const dealQuery = supabase
    .from("deals")
    .select("created_at, reuniao_realizada_at, contrato_assinado_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);

  const [{ data: formData }, { data: dealData }] = await Promise.all([
    inicioISO ? formQuery.gte("created_at", inicioISO) : formQuery,
    inicioISO ? dealQuery.gte("created_at", inicioISO) : dealQuery,
  ]);

  const forms = (formData as FormRow[] | null) ?? [];
  const deals = (dealData as DealRow[] | null) ?? [];

  // Transições (dias). Decisão = call → (assinado OU perdido via updated_at).
  const contatoWhats: number[] = [];
  const contatoAgenda: number[] = [];
  const agendaCall: number[] = [];
  const callDecisao: number[] = [];
  const ciclo: number[] = [];

  for (const f of forms) {
    const g1 = gapDias(f.created_at, f.whatsapp_sent_at);
    if (g1 !== null) contatoWhats.push(g1);
    const g2 = gapDias(f.created_at, f.meeting_scheduled_at);
    if (g2 !== null) contatoAgenda.push(g2);
  }

  for (const d of deals) {
    const gAgendaCall = gapDias(d.created_at, d.reuniao_realizada_at);
    // 1º contato → call usa created_at do deal como proxy de agendamento; a
    // etapa reuniao_realizada seta o timestamp (trigger). Mede "entrada→call".
    if (gAgendaCall !== null) agendaCall.push(gAgendaCall);

    // Decisão (ganho): da call até assinar. NÃO usamos updated_at p/ perdidos —
    // updated_at é qualquer edição posterior (ex.: nota meses depois), inflaria
    // o tempo sem teto. Mede-se o tempo de FECHAMENTO (assinatura).
    if (d.reuniao_realizada_at && d.contrato_assinado_at) {
      const g = gapDias(d.reuniao_realizada_at, d.contrato_assinado_at);
      if (g !== null) callDecisao.push(g);
    }
    const gCiclo = gapDias(d.created_at, d.contrato_assinado_at);
    if (gCiclo !== null) ciclo.push(gCiclo);
  }

  const etapas: FunilEtapa[] = [
    { chave: "contato_whats", label: "1º contato → WhatsApp", medianaDias: mediana(contatoWhats), mediaDias: media(contatoWhats), amostra: contatoWhats.length },
    { chave: "contato_agenda", label: "1º contato → agendamento", medianaDias: mediana(contatoAgenda), mediaDias: media(contatoAgenda), amostra: contatoAgenda.length },
    { chave: "entrada_call", label: "Entrada no pipeline → reunião", medianaDias: mediana(agendaCall), mediaDias: media(agendaCall), amostra: agendaCall.length },
    { chave: "call_decisao", label: "Reunião → fechamento", medianaDias: mediana(callDecisao), mediaDias: media(callDecisao), amostra: callDecisao.length },
  ];

  return {
    etapas,
    cicloMedianaDias: mediana(ciclo),
    cicloAmostra: ciclo.length,
  };
}
