import type { createServerSupabaseClient } from "@/lib/supabase-server";

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// ════════════════════════════════════════════════════════════════════════
// Meta Ads — camada de dados da seção /ads (A1.5: SOMENTE LEITURA)
// ════════════════════════════════════════════════════════════════════════
//
// Graph API (Marketing API) com o token de LEITURA (ads_read) via env
// META_ACCESS_TOKEN + META_AD_ACCOUNT_ID — server-side apenas; o token
// NUNCA vai ao client e NUNCA entra em URL (Authorization header).
// Sem as envs a UI degrada com estado de ativação (padrão GEMINI_API_KEY).
//
// Cache: fetch com revalidate de 5 min (rate limit da Marketing API).
// Cruzamentos com o funil (leads reais, série própria) vêm do Supabase —
// client criado NA PAGE e injetado (padrão da casa; client dentro de lib
// concorrente já causou "fetch failed" no dev).
// ════════════════════════════════════════════════════════════════════════

const GRAPH_BASE = "https://graph.facebook.com";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const REVALIDATE_S = 300;
const MAX_PAGINAS = 5;
const THUMB_PX = "1080"; // full-HD — a Meta serve p1080x1080 (validado na Graph)

export class MetaAdsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MetaAdsError";
  }
}

export function metaAdsConfigurado(): boolean {
  return Boolean(process.env.META_ACCESS_TOKEN && process.env.META_AD_ACCOUNT_ID);
}

function contaAnuncio(): string {
  const raw = process.env.META_AD_ACCOUNT_ID ?? "";
  return raw.startsWith("act_") ? raw : `act_${raw}`;
}

function tokenLeitura(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new MetaAdsError("META_ACCESS_TOKEN não configurado.");
  return token;
}

interface GraphErro {
  error?: { message?: string; code?: number };
}

async function graphFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${tokenLeitura()}` },
    next: { revalidate: REVALIDATE_S },
  });
  const json = (await res.json()) as T & GraphErro;
  if (!res.ok || json.error) {
    // Mensagem da Meta é segura de exibir (não ecoa o token).
    throw new MetaAdsError(json.error?.message ?? `Meta API HTTP ${res.status}`);
  }
  return json;
}

interface GraphPage<T> {
  data?: T[];
  paging?: { next?: string };
}

/** GET de edge com paginação (até MAX_PAGINAS). */
async function graphGet<T>(path: string, params: Record<string, string>): Promise<T[]> {
  let url = `${GRAPH_BASE}/${GRAPH_VERSION}/${path}?${new URLSearchParams(params).toString()}`;
  const rows: T[] = [];
  for (let pagina = 0; pagina < MAX_PAGINAS && url; pagina++) {
    const json = await graphFetch<GraphPage<T>>(url);
    if (Array.isArray(json.data)) rows.push(...json.data);
    url = json.paging?.next ?? "";
  }
  return rows;
}

/** GET de nó único (ex.: uma campanha). */
async function graphGetNode<T>(path: string, params: Record<string, string>): Promise<T> {
  return graphFetch<T>(`${GRAPH_BASE}/${GRAPH_VERSION}/${path}?${new URLSearchParams(params).toString()}`);
}

// ─── Períodos (Desempenho: presets fechados OU range custom) ────────────

export interface RangeDatas {
  /** YYYY-MM-DD inclusivo */
  since: string;
  until: string;
}

export const PERIODO_PRESETS = ["7d", "30d", "90d", "6m", "12m"] as const;
export type PeriodoPreset = (typeof PERIODO_PRESETS)[number];

const PRESET_DIAS: Record<PeriodoPreset, number> = { "7d": 7, "30d": 30, "90d": 90, "6m": 182, "12m": 365 };

const isoDia = (t: number): string => new Date(t).toISOString().slice(0, 10);
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve searchParams (?periodo=90d OU ?de=...&ate=...) num range concreto. */
export function resolverRange(sp: { periodo?: string; de?: string; ate?: string }): {
  range: RangeDatas;
  preset: PeriodoPreset | null;
} {
  if (sp.de && sp.ate && DATA_RE.test(sp.de) && DATA_RE.test(sp.ate) && sp.de <= sp.ate) {
    return { range: { since: sp.de, until: sp.ate }, preset: null };
  }
  const preset: PeriodoPreset = PERIODO_PRESETS.includes(sp.periodo as PeriodoPreset)
    ? (sp.periodo as PeriodoPreset)
    : "90d";
  return { range: { since: isoDia(Date.now() - PRESET_DIAS[preset] * 86_400_000), until: isoDia(Date.now()) }, preset };
}

// ─── Campanhas (cards) ──────────────────────────────────────────────────

export interface CampanhaAds {
  id: string;
  nome: string;
  /** effective_status da Meta: ACTIVE, PAUSED, CAMPAIGN_PAUSED, ARCHIVED, ... */
  status: string;
  objetivo: string | null;
  /** Budgets em BRL (a Meta devolve em centavos) */
  budgetDiario: number | null;
  budgetTotal: number | null;
  criadaEm: string | null;
  thumbnailUrl: string | null;
  // Vida toda (Graph, date_preset maximum) — campanhas ativas fora da janela
  // de 30d mostravam "—" em tudo; a vida toda sempre tem o histórico.
  gastoVida: number;
  impressoesVida: number;
  cliquesVida: number;
  ctrVida: number | null;
  // Últimos 30d — do NOSSO histórico (meta_ads_campanha), preenchido na page.
  gasto30d: number;
  cliques30d: number;
  impressoes30d: number;
}

interface GraphInsightsRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpm?: string;
  frequency?: string;
  reach?: string;
}

interface GraphCreative {
  id?: string;
  thumbnail_url?: string;
  image_url?: string;
  url_tags?: string;
  object_story_spec?: { link_data?: { link?: string } };
}

interface GraphCampanha {
  id: string;
  name?: string;
  effective_status?: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  insights?: { data?: GraphInsightsRow[] };
  ads?: { data?: Array<{ creative?: GraphCreative }> };
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const numOuNull = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const centavos = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : null;
};

/**
 * Thumbnails em alta: o thumbnail_url default da Meta é 64px. Buscamos os
 * criativos em lote (?ids=...) pedindo thumbnail_width/height = 512.
 * Fail-open: sem thumbs em alta, os cards usam o que tiver.
 */
async function thumbsEmAlta(creativeIds: string[]): Promise<Map<string, string>> {
  const mapa = new Map<string, string>();
  const unicos = [...new Set(creativeIds)].filter(Boolean);
  for (let i = 0; i < unicos.length; i += 50) {
    const lote = unicos.slice(i, i + 50);
    try {
      const json = await graphGetNode<Record<string, GraphCreative>>("", {
        ids: lote.join(","),
        fields: "thumbnail_url",
        thumbnail_width: THUMB_PX,
        thumbnail_height: THUMB_PX,
      });
      for (const [id, c] of Object.entries(json)) {
        if (c && typeof c === "object" && typeof c.thumbnail_url === "string") mapa.set(id, c.thumbnail_url);
      }
    } catch {
      // fail-open — thumb 64px é melhor que tela quebrada
    }
  }
  return mapa;
}

export async function fetchCampanhasAds(): Promise<CampanhaAds[]> {
  const rows = await graphGet<GraphCampanha>(`${contaAnuncio()}/campaigns`, {
    fields:
      "name,effective_status,objective,daily_budget,lifetime_budget,created_time," +
      "insights.date_preset(maximum){spend,impressions,clicks,ctr}," +
      "ads.limit(1){creative{id,thumbnail_url,image_url}}",
    limit: "50",
  });

  const thumbs = await thumbsEmAlta(
    rows.map((c) => c.ads?.data?.[0]?.creative?.id ?? "").filter((id) => id !== ""),
  );

  return rows.map((c) => {
    const ins = c.insights?.data?.[0];
    const creative = c.ads?.data?.[0]?.creative;
    const thumbAlta = creative?.id ? thumbs.get(creative.id) : undefined;
    return {
      id: c.id,
      nome: c.name ?? c.id,
      status: c.effective_status ?? "UNKNOWN",
      objetivo: c.objective ?? null,
      budgetDiario: centavos(c.daily_budget),
      budgetTotal: centavos(c.lifetime_budget),
      criadaEm: c.created_time ?? null,
      thumbnailUrl: thumbAlta ?? creative?.image_url ?? creative?.thumbnail_url ?? null,
      gastoVida: num(ins?.spend),
      impressoesVida: num(ins?.impressions),
      cliquesVida: num(ins?.clicks),
      ctrVida: numOuNull(ins?.ctr),
      gasto30d: 0,
      cliques30d: 0,
      impressoes30d: 0,
    };
  });
}

/** Agrega os últimos 30d do NOSSO histórico por campanha (merge nos cards). */
export async function fetchAgregado30dPorCampanha(supabase: SupabaseServer): Promise<Map<string, { gasto: number; cliques: number; impressoes: number }>> {
  const top = await fetchTopCampanhas(supabase, resolverRange({ periodo: "30d" }).range, 1000);
  return new Map(top.map((t) => [t.campanhaId, { gasto: t.gasto, cliques: t.cliques, impressoes: t.impressoes }]));
}

// ─── Detalhe de UMA campanha (conjuntos + anúncios + insights vida toda) ─

export interface InsightsResumo {
  gasto: number;
  impressoes: number;
  cliques: number;
  ctr: number | null;
  cpm: number | null;
  alcance: number | null;
  frequencia: number | null;
}

export interface ConjuntoAds {
  id: string;
  nome: string;
  status: string;
  budgetDiario: number | null;
  // Vida toda — a janela de 30d zerava entregas antigas (mesmo bug dos cards)
  gastoVida: number;
  impressoesVida: number;
  cliquesVida: number;
}

export interface AnuncioAds {
  id: string;
  nome: string;
  status: string;
  thumbnailUrl: string | null;
  gastoVida: number;
  impressoesVida: number;
  cliquesVida: number;
  ctrVida: number | null;
  /** Destino do anúncio (link_data.link). null = boost de post (o link mora no post orgânico). */
  linkDestino: string | null;
  /** Parâmetros de URL (url_tags) do criativo — onde o UTM vive. */
  urlTags: string | null;
}

export interface CampanhaDetalhe {
  id: string;
  nome: string;
  status: string;
  objetivo: string | null;
  budgetDiario: number | null;
  budgetTotal: number | null;
  criadaEm: string | null;
  inicioEm: string | null;
  fimEm: string | null;
  thumbnailUrl: string | null;
  /** Vida toda (date_preset maximum) */
  total: InsightsResumo;
  conjuntos: ConjuntoAds[];
  anuncios: AnuncioAds[];
}

interface GraphAdset {
  id: string;
  name?: string;
  effective_status?: string;
  daily_budget?: string;
  insights?: { data?: GraphInsightsRow[] };
}

interface GraphAd {
  id: string;
  name?: string;
  effective_status?: string;
  creative?: GraphCreative;
  insights?: { data?: GraphInsightsRow[] };
}

interface GraphCampanhaDetalhe extends GraphCampanha {
  start_time?: string;
  stop_time?: string;
  adsets?: { data?: GraphAdset[] };
}

const resumo = (ins: GraphInsightsRow | undefined): InsightsResumo => ({
  gasto: num(ins?.spend),
  impressoes: num(ins?.impressions),
  cliques: num(ins?.clicks),
  ctr: numOuNull(ins?.ctr),
  cpm: numOuNull(ins?.cpm),
  alcance: numOuNull(ins?.reach),
  frequencia: numOuNull(ins?.frequency),
});

export async function fetchCampanhaDetalhe(campanhaId: string): Promise<CampanhaDetalhe | null> {
  if (!/^\d{5,25}$/.test(campanhaId)) return null; // id da Meta é numérico — valida antes de ir à API
  let c: GraphCampanhaDetalhe;
  try {
    c = await graphGetNode<GraphCampanhaDetalhe>(campanhaId, {
      fields:
        "name,effective_status,objective,daily_budget,lifetime_budget,created_time,start_time,stop_time," +
        "insights.date_preset(maximum){spend,impressions,clicks,ctr,cpm,reach,frequency}," +
        "adsets.limit(50){name,effective_status,daily_budget,insights.date_preset(maximum){spend,impressions,clicks}}",
    });
  } catch (e) {
    // Campanha inexistente/sem permissão → 404 amigável em vez de tela de erro
    if (e instanceof MetaAdsError && /does not exist|Unsupported get|cannot be loaded/i.test(e.message)) return null;
    throw e;
  }

  const ads = await graphGet<GraphAd>(`${campanhaId}/ads`, {
    fields:
      "name,effective_status,creative{id,thumbnail_url,image_url,url_tags,object_story_spec{link_data{link}}}," +
      "insights.date_preset(maximum){spend,impressions,clicks,ctr}",
    limit: "50",
  });

  const thumbs = await thumbsEmAlta(ads.map((a) => a.creative?.id ?? "").filter((id) => id !== ""));
  const thumbDe = (creative: GraphCreative | undefined): string | null =>
    creative?.image_url ?? (creative?.id ? thumbs.get(creative.id) : undefined) ?? creative?.thumbnail_url ?? null;

  return {
    id: c.id,
    nome: c.name ?? c.id,
    status: c.effective_status ?? "UNKNOWN",
    objetivo: c.objective ?? null,
    budgetDiario: centavos(c.daily_budget),
    budgetTotal: centavos(c.lifetime_budget),
    criadaEm: c.created_time ?? null,
    inicioEm: c.start_time ?? null,
    fimEm: c.stop_time ?? null,
    thumbnailUrl: thumbDe(ads[0]?.creative),
    total: resumo(c.insights?.data?.[0]),
    conjuntos: (c.adsets?.data ?? []).map((a) => {
      const ins = a.insights?.data?.[0];
      return {
        id: a.id,
        nome: a.name ?? a.id,
        status: a.effective_status ?? "UNKNOWN",
        budgetDiario: centavos(a.daily_budget),
        gastoVida: num(ins?.spend),
        impressoesVida: num(ins?.impressions),
        cliquesVida: num(ins?.clicks),
      };
    }),
    anuncios: ads.map((a) => {
      const ins = a.insights?.data?.[0];
      return {
        id: a.id,
        nome: a.name ?? a.id,
        status: a.effective_status ?? "UNKNOWN",
        thumbnailUrl: thumbDe(a.creative),
        gastoVida: num(ins?.spend),
        impressoesVida: num(ins?.impressions),
        cliquesVida: num(ins?.clicks),
        ctrVida: numOuNull(ins?.ctr),
        linkDestino: a.creative?.object_story_spec?.link_data?.link ?? null,
        urlTags: a.creative?.url_tags ?? null,
      };
    }),
  };
}

// ─── Funil real por campanha (Supabase: utm_id ↔ campanha_id) ───────────

export interface FunilCampanha {
  leadsTotal: number;
  leadsQualificados: number;
  leads30d: number;
  reunioes: number;
}

export async function fetchFunilPorCampanha(supabase: SupabaseServer): Promise<Map<string, FunilCampanha>> {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("utm_id, qualification_classification, meeting_scheduled, submitted_at")
    .not("utm_id", "is", null);
  if (error) throw new MetaAdsError(`form_submissions: ${error.message}`);

  const corte30d = Date.now() - 30 * 86_400_000;
  const mapa = new Map<string, FunilCampanha>();
  for (const row of data ?? []) {
    const chave = String(row.utm_id).trim();
    if (!chave) continue;
    const atual = mapa.get(chave) ?? { leadsTotal: 0, leadsQualificados: 0, leads30d: 0, reunioes: 0 };
    atual.leadsTotal += 1;
    const classe = typeof row.qualification_classification === "string" ? row.qualification_classification : "";
    if (classe === "QUENTE" || classe === "MORNO") atual.leadsQualificados += 1;
    if (row.meeting_scheduled === true) atual.reunioes += 1;
    if (row.submitted_at && Date.parse(String(row.submitted_at)) >= corte30d) atual.leads30d += 1;
    mapa.set(chave, atual);
  }
  return mapa;
}

export interface LeadCampanha {
  nome: string;
  submetidoEm: string;
  classe: string | null;
  reuniao: boolean;
}

export async function fetchLeadsCampanha(supabase: SupabaseServer, campanhaId: string): Promise<LeadCampanha[]> {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("athlete_name, submitted_at, qualification_classification, meeting_scheduled")
    .eq("utm_id", campanhaId)
    .order("submitted_at", { ascending: false })
    .limit(50);
  if (error) throw new MetaAdsError(`form_submissions: ${error.message}`);
  return (data ?? []).map((r) => ({
    nome: String(r.athlete_name ?? "—"),
    submetidoEm: String(r.submitted_at ?? ""),
    classe: typeof r.qualification_classification === "string" ? r.qualification_classification : null,
    reuniao: r.meeting_scheduled === true,
  }));
}

// ─── Desempenho: séries do histórico próprio (Supabase, sem rate limit) ──

export interface DiaGastoAds {
  dia: string; // YYYY-MM-DD
  gasto: number;
  cliques: number;
  impressoes: number;
}

export async function fetchSerieDiariaGasto(
  supabase: SupabaseServer,
  range: RangeDatas,
  campanhaId?: string,
): Promise<DiaGastoAds[]> {
  let query = supabase
    .from("meta_ads_campanha")
    .select("data, valor_gasto, cliques, impressoes")
    .gte("data", range.since)
    .lte("data", range.until)
    .is("deleted_at", null)
    .order("data", { ascending: true });
  if (campanhaId) query = query.eq("campanha_id", campanhaId);
  const { data, error } = await query;
  if (error) throw new MetaAdsError(`meta_ads_campanha: ${error.message}`);

  const porDia = new Map<string, DiaGastoAds>();
  for (const row of data ?? []) {
    const dia = String(row.data);
    const atual = porDia.get(dia) ?? { dia, gasto: 0, cliques: 0, impressoes: 0 };
    atual.gasto += Number(row.valor_gasto) || 0;
    atual.cliques += Number(row.cliques) || 0;
    atual.impressoes += Number(row.impressoes) || 0;
    porDia.set(dia, atual);
  }
  return [...porDia.values()];
}

export interface TopCampanha {
  campanhaId: string;
  nome: string;
  gasto: number;
  cliques: number;
  impressoes: number;
}

export async function fetchTopCampanhas(supabase: SupabaseServer, range: RangeDatas, top: number): Promise<TopCampanha[]> {
  const { data, error } = await supabase
    .from("meta_ads_campanha")
    .select("campanha_id, campanha_nome, valor_gasto, cliques, impressoes")
    .gte("data", range.since)
    .lte("data", range.until)
    .is("deleted_at", null);
  if (error) throw new MetaAdsError(`meta_ads_campanha: ${error.message}`);

  const agg = new Map<string, TopCampanha>();
  for (const row of data ?? []) {
    const id = String(row.campanha_id ?? "").trim();
    if (!id) continue;
    const atual = agg.get(id) ?? { campanhaId: id, nome: String(row.campanha_nome ?? id), gasto: 0, cliques: 0, impressoes: 0 };
    atual.gasto += Number(row.valor_gasto) || 0;
    atual.cliques += Number(row.cliques) || 0;
    atual.impressoes += Number(row.impressoes) || 0;
    agg.set(id, atual);
  }
  return [...agg.values()].sort((a, b) => b.gasto - a.gasto).slice(0, top);
}

export interface DiaLeads {
  dia: string;
  leads: number;
}

/** Leads do funil por dia (só os atribuíveis a campanhas — utm_id presente). */
export async function fetchLeadsPorDia(supabase: SupabaseServer, range: RangeDatas): Promise<DiaLeads[]> {
  const { data, error } = await supabase
    .from("form_submissions")
    .select("submitted_at")
    .not("utm_id", "is", null)
    .gte("submitted_at", `${range.since}T00:00:00Z`)
    .lte("submitted_at", `${range.until}T23:59:59Z`);
  if (error) throw new MetaAdsError(`form_submissions: ${error.message}`);

  const porDia = new Map<string, number>();
  for (const row of data ?? []) {
    const dia = String(row.submitted_at ?? "").slice(0, 10);
    if (!dia) continue;
    porDia.set(dia, (porDia.get(dia) ?? 0) + 1);
  }
  return [...porDia.entries()].map(([dia, leads]) => ({ dia, leads })).sort((a, b) => a.dia.localeCompare(b.dia));
}

// ─── Desempenho: breakdowns demográficos/plataforma (Graph, com range) ──

export interface BreakdownLinha {
  chave: string;
  gasto: number;
  impressoes: number;
  cliques: number;
}

type BreakdownTipo = "age" | "gender" | "publisher_platform";

interface GraphBreakdownRow extends GraphInsightsRow {
  age?: string;
  gender?: string;
  publisher_platform?: string;
}

export async function fetchBreakdown(tipo: BreakdownTipo, range: RangeDatas): Promise<BreakdownLinha[]> {
  const rows = await graphGet<GraphBreakdownRow>(`${contaAnuncio()}/insights`, {
    breakdowns: tipo,
    fields: "spend,impressions,clicks",
    time_range: JSON.stringify({ since: range.since, until: range.until }),
    limit: "200",
  });
  const agg = new Map<string, BreakdownLinha>();
  for (const r of rows) {
    const chave = String(r[tipo] ?? "desconhecido");
    const atual = agg.get(chave) ?? { chave, gasto: 0, impressoes: 0, cliques: 0 };
    atual.gasto += num(r.spend);
    atual.impressoes += num(r.impressions);
    atual.cliques += num(r.clicks);
    agg.set(chave, atual);
  }
  return [...agg.values()].sort((a, b) => b.gasto - a.gasto);
}
