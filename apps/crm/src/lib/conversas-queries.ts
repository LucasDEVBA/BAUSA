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
    .eq("is_grupo", false) // só 1:1 — mensagens de grupo (coletor) nunca entram nas métricas de conversa
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

// ─── Helpers de gap em dias (usados pelo funil avançado) ────────────────────

const DIA_MS = 24 * 60 * 60 * 1000;

function gapDias(deIso: string | null, ateIso: string | null): number | null {
  if (!deIso || !ateIso) return null;
  const d = Date.parse(deIso);
  const a = Date.parse(ateIso);
  if (!Number.isFinite(d) || !Number.isFinite(a) || a < d) return null;
  return (a - d) / DIA_MS;
}

// ─── Funil AVANÇADO: percentis + conversão entre etapas + cadência ──────────

export interface Distribuicao {
  p25: number | null;
  p50: number | null; // mediana
  p75: number | null;
  p90: number | null;
  media: number | null;
  amostra: number;
}

function percentil(ordenado: number[], p: number): number | null {
  if (ordenado.length === 0) return null;
  if (ordenado.length === 1) return ordenado[0];
  const idx = (ordenado.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return ordenado[lo];
  return ordenado[lo] + (ordenado[hi] - ordenado[lo]) * (idx - lo);
}

export function distribuicao(v: number[]): Distribuicao {
  const o = [...v].sort((a, b) => a - b);
  return {
    p25: percentil(o, 0.25),
    p50: percentil(o, 0.5),
    p75: percentil(o, 0.75),
    p90: percentil(o, 0.9),
    media: media(v),
    amostra: v.length,
  };
}

export interface TransicaoDist {
  chave: string;
  label: string;
  dist: Distribuicao;
}

export interface EtapaFunil {
  chave: string;
  label: string;
  total: number;
  /** Taxa de passagem a partir da etapa anterior (0-1); null na 1ª. */
  taxaDaAnterior: number | null;
}

export interface FunilAvancado {
  transicoes: TransicaoDist[];
  etapas: EtapaFunil[];
  totalDeals: number;
}

interface DealFunilRow {
  created_at: string;
  etapa: string;
  reuniao_realizada_at: string | null;
  contrato_enviado_at: string | null;
  contrato_assinado_at: string | null;
  sinal_pago_at: string | null;
  atletas: {
    form_submissions: {
      created_at: string | null;
      whatsapp_sent_at: string | null;
      meeting_scheduled_at: string | null;
    } | null;
  } | null;
}

// Ordem das etapas (espelha a ordem CANÔNICA de negócio de DEAL_STAGE_CONFIG).
// perdido/desconhecido = -1 (não usa ordem — só timestamps dizem até onde o
// deal perdido chegou).
// ⚠️ Cópia paralela LEGADA usada só pela lógica do funil (progressão de
// negócio, NÃO exibição). A fonte canônica de EXIBIÇÃO — com a ordem/rótulos
// configurados pelo CEO (`etapas_deal_config`) — é `src/lib/etapas-deal.ts`.
const ORDEM_ETAPA: Record<string, number> = {
  contato_feito: -0.5,
  lead: 0,
  aguardando_timing: 0.5,
  reuniao_marcada: 1,
  reuniao_realizada: 2,
  diagnostico_fit: 3,
  alinhamento_estrategico: 4,
  proposta_enviada: 5,
  followup_proposta: 6,
  negociacao: 7,
  contrato_enviado: 8,
  contrato_assinado: 9,
  sinal_pago: 10,
  admission_process: 11,
  concluido: 12,
};
const rankEtapa = (etapa: string): number => ORDEM_ETAPA[etapa] ?? -1;

export async function fetchFunilAvancado(period: ConversaPeriod): Promise<FunilAvancado> {
  const supabase = await createServerSupabaseClient();
  const inicio = startMs(period);
  const inicioISO = inicio !== null ? new Date(inicio).toISOString() : null;

  let query = supabase
    .from("deals")
    .select(
      "created_at, etapa, reuniao_realizada_at, contrato_enviado_at, contrato_assinado_at, sinal_pago_at, " +
        "atletas ( form_submissions ( created_at:submitted_at, whatsapp_sent_at, meeting_scheduled_at ) )",
    )
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(FETCH_LIMIT);
  if (inicioISO) query = query.gte("created_at", inicioISO);

  const { data, error } = await query;
  if (error) {
    console.error({ level: "error", action: "fetch_funil_avancado", error: error.message });
  }
  const deals = (data as unknown as DealFunilRow[] | null) ?? [];

  const contatoAgenda: number[] = [];
  const agendaReuniao: number[] = [];
  const reuniaoContrato: number[] = [];
  const ciclo: number[] = [];
  let comReuniao = 0;
  let comContratoEnviado = 0;
  let comAssinado = 0;
  let comSinal = 0;

  for (const d of deals) {
    const form = d.atletas?.form_submissions ?? null;
    const contato = form?.created_at ?? d.created_at;
    const r = rankEtapa(d.etapa); // -1 se perdido/desconhecido

    // Tempos (por timestamp) — inalterados
    if (form?.meeting_scheduled_at) {
      const g = gapDias(form.created_at, form.meeting_scheduled_at);
      if (g !== null) contatoAgenda.push(g);
      if (d.reuniao_realizada_at) {
        const g2 = gapDias(form.meeting_scheduled_at, d.reuniao_realizada_at);
        if (g2 !== null) agendaReuniao.push(g2);
      }
    }
    if (d.reuniao_realizada_at && d.contrato_assinado_at) {
      const g = gapDias(d.reuniao_realizada_at, d.contrato_assinado_at);
      if (g !== null) reuniaoContrato.push(g);
    }
    if (d.contrato_assinado_at) {
      const g = gapDias(contato, d.contrato_assinado_at);
      if (g !== null) ciclo.push(g);
    }

    // Marcos CUMULATIVOS (monotônicos): timestamp downstream OU etapa alcançada.
    // Garante comReuniao ≥ comContratoEnviado ≥ comAssinado ≥ comSinal (taxa ≤ 100%).
    // O funil não é aninhado (deals pulam reuniao_realizada) — daí a implicação.
    const alcSinal = !!d.sinal_pago_at || r >= 10;
    const alcAssinado = !!d.contrato_assinado_at || alcSinal || r >= 9;
    const alcEnviado = !!d.contrato_enviado_at || alcAssinado || r >= 8;
    const alcReuniao = !!d.reuniao_realizada_at || alcEnviado || r >= 2;
    if (alcReuniao) comReuniao++;
    if (alcEnviado) comContratoEnviado++;
    if (alcAssinado) comAssinado++;
    if (alcSinal) comSinal++;
  }

  const total = deals.length;
  const taxa = (num: number, den: number) => (den > 0 ? num / den : null);

  return {
    totalDeals: total,
    transicoes: [
      { chave: "contato_agenda", label: "1º contato → agendamento", dist: distribuicao(contatoAgenda) },
      { chave: "agenda_reuniao", label: "Agendamento → reunião", dist: distribuicao(agendaReuniao) },
      { chave: "reuniao_contrato", label: "Reunião → contrato assinado", dist: distribuicao(reuniaoContrato) },
      { chave: "ciclo", label: "Ciclo total (contato → assinatura)", dist: distribuicao(ciclo) },
    ],
    etapas: [
      { chave: "entrada", label: "Entrada no pipeline", total, taxaDaAnterior: null },
      { chave: "reuniao", label: "Reunião realizada", total: comReuniao, taxaDaAnterior: taxa(comReuniao, total) },
      { chave: "contrato_enviado", label: "Contrato enviado", total: comContratoEnviado, taxaDaAnterior: taxa(comContratoEnviado, comReuniao) },
      { chave: "assinado", label: "Contrato assinado", total: comAssinado, taxaDaAnterior: taxa(comAssinado, comContratoEnviado) },
      { chave: "sinal", label: "Sinal pago", total: comSinal, taxaDaAnterior: taxa(comSinal, comAssinado) },
    ],
  };
}

// ─── Cadência pós-reunião (deals ↔ whatsapp_mensagens por telefone) ─────────
// Aproximado: casa o telefone do atleta com whatsapp_mensagens pelos últimos 10
// dígitos (DDI/DDD variam). Cadência real depende do espelho ter as mensagens.

export interface CadenciaPosReuniao {
  /** Reunião → 1ª mensagem nossa (follow-up), em HORAS. */
  primeiroFollowupHoras: Distribuicao;
  /** Nº de mensagens nossas entre a reunião e o contrato assinado (ganhos). */
  toquesAteDecisaoMediana: number | null;
  toquesAmostra: number;
  /** Deals com reunião realizada considerados. */
  amostraReunioes: number;
}

interface DealCadenciaRow {
  reuniao_realizada_at: string | null;
  contrato_assinado_at: string | null;
  atletas: { whatsapp: string | null } | null;
}

const tail10 = (s: string | null) => (s ?? "").replace(/\D/g, "").slice(-10);

export async function fetchCadenciaPosReuniao(period: ConversaPeriod): Promise<CadenciaPosReuniao> {
  const supabase = await createServerSupabaseClient();
  const inicio = startMs(period);
  const inicioISO = inicio !== null ? new Date(inicio).toISOString() : null;

  let dealQuery = supabase
    .from("deals")
    .select("reuniao_realizada_at, contrato_assinado_at, atletas ( whatsapp )")
    .is("deleted_at", null)
    .not("reuniao_realizada_at", "is", null)
    .order("reuniao_realizada_at", { ascending: false })
    .limit(FETCH_LIMIT);
  if (inicioISO) dealQuery = dealQuery.gte("reuniao_realizada_at", inicioISO);

  const [{ data: dealData, error: dealErr }, { data: msgData, error: msgErr }] = await Promise.all([
    dealQuery,
    // Só mensagens NOSSAS (from_me) — DESC + limit p/ manter as recentes.
    supabase
      .from("whatsapp_mensagens")
      .select("phone, momment, created_at")
      .eq("from_me", true)
      .eq("is_grupo", false) // 1:1 apenas — não misturar mensagens de grupo no índice por telefone
      .order("created_at", { ascending: false })
      .limit(FETCH_LIMIT),
  ]);
  if (dealErr || msgErr) {
    console.error({
      level: "error",
      action: "fetch_cadencia_pos_reuniao",
      error: dealErr?.message ?? msgErr?.message,
    });
  }

  const deals = (dealData as unknown as DealCadenciaRow[] | null) ?? [];
  const msgs = (msgData as { phone: string; momment: string | null; created_at: string }[] | null) ?? [];

  // Índice: tail10(phone) → epochs (momment) das nossas mensagens (ordem não
  // importa — usamos min/filter, não a posição).
  const porTelefone = new Map<string, number[]>();
  for (const m of msgs) {
    const key = tail10(m.phone);
    if (key.length < 8) continue;
    const t = Date.parse(m.momment ?? m.created_at);
    if (!Number.isFinite(t)) continue;
    const lista = porTelefone.get(key);
    if (lista) lista.push(t);
    else porTelefone.set(key, [t]);
  }

  const followupHoras: number[] = [];
  const toques: number[] = [];
  // Conta TODAS as reuniões do período (a query já filtra reuniao_realizada_at
  // not null) — independente de casar telefone; o gate de telefone só afeta os
  // arrays de follow-up/toques.
  const amostraReunioes = deals.length;

  for (const d of deals) {
    const tel = tail10(d.atletas?.whatsapp ?? null);
    if (tel.length < 8 || !d.reuniao_realizada_at) continue;
    const reuniaoMs = Date.parse(d.reuniao_realizada_at);
    if (!Number.isFinite(reuniaoMs)) continue;
    const epochs = porTelefone.get(tel);
    if (!epochs || epochs.length === 0) continue;

    // 1º follow-up após a reunião = MENOR momment > reunião (não a posição no
    // array, que está em ordem de created_at, não de momment).
    const posteriores = epochs.filter((t) => t > reuniaoMs);
    if (posteriores.length > 0) {
      followupHoras.push((Math.min(...posteriores) - reuniaoMs) / (60 * 60 * 1000));
    }
    // Toques (nossas msgs) entre a reunião e o contrato assinado (ganhos)
    if (d.contrato_assinado_at) {
      const assinadoMs = Date.parse(d.contrato_assinado_at);
      if (Number.isFinite(assinadoMs) && assinadoMs > reuniaoMs) {
        toques.push(epochs.filter((t) => t > reuniaoMs && t <= assinadoMs).length);
      }
    }
  }

  return {
    primeiroFollowupHoras: distribuicao(followupHoras),
    toquesAteDecisaoMediana: mediana(toques),
    toquesAmostra: toques.length,
    amostraReunioes,
  };
}
