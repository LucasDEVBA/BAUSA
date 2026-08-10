import type { createServerSupabaseClient } from "@/lib/supabase-server";

type SupabaseServer = Awaited<ReturnType<typeof createServerSupabaseClient>>;

// ════════════════════════════════════════════════════════════════════════
// Meta Ads — camada de dados da seção /ads (A1: SOMENTE LEITURA)
// ════════════════════════════════════════════════════════════════════════
//
// Fala com a Graph API (Marketing API) usando o token de LEITURA (ads_read)
// via env META_ACCESS_TOKEN + META_AD_ACCOUNT_ID — server-side apenas; o
// token NUNCA vai ao client e NUNCA entra em URL (Authorization header).
// Sem as envs a UI degrada com estado de ativação (padrão GEMINI_API_KEY).
//
// Cache: fetch com revalidate de 5 min (respeita rate limit da Marketing
// API; dado de anúncio não muda em segundos). O cruzamento com o funil
// (leads reais por campanha) vem do Supabase via utm_id ↔ campanha_id —
// mesma chave do ROI exato do /analytics/cac.
// ════════════════════════════════════════════════════════════════════════

const GRAPH_BASE = "https://graph.facebook.com";
const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v23.0";
const REVALIDATE_S = 300;
const MAX_PAGINAS = 5;

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

interface GraphPage<T> {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string; code?: number };
}

async function graphGet<T>(path: string, params: Record<string, string>): Promise<T[]> {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new MetaAdsError("META_ACCESS_TOKEN não configurado.");

  let url = `${GRAPH_BASE}/${GRAPH_VERSION}/${path}?${new URLSearchParams(params).toString()}`;
  const rows: T[] = [];

  for (let pagina = 0; pagina < MAX_PAGINAS && url; pagina++) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: REVALIDATE_S },
    });
    const json = (await res.json()) as GraphPage<T>;
    if (!res.ok || json.error) {
      // Mensagem da Meta é segura de exibir (não ecoa o token); código ajuda no diagnóstico.
      throw new MetaAdsError(json.error?.message ?? `Meta API HTTP ${res.status}`);
    }
    if (Array.isArray(json.data)) rows.push(...json.data);
    url = json.paging?.next ?? "";
  }
  return rows;
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
  // Insights 30d (null = campanha sem entrega no período)
  gasto30d: number;
  impressoes30d: number;
  cliques30d: number;
  ctr30d: number | null;
  frequencia30d: number | null;
}

interface GraphInsightsRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  frequency?: string;
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
  ads?: { data?: Array<{ creative?: { thumbnail_url?: string; image_url?: string } }> };
}

const num = (v: string | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const centavos = (v: string | undefined): number | null => {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n / 100 : null;
};

export async function fetchCampanhasAds(): Promise<CampanhaAds[]> {
  const rows = await graphGet<GraphCampanha>(`${contaAnuncio()}/campaigns`, {
    fields:
      "name,effective_status,objective,daily_budget,lifetime_budget,created_time," +
      "insights.date_preset(last_30d){spend,impressions,clicks,ctr,frequency}," +
      "ads.limit(1){creative{thumbnail_url,image_url}}",
    limit: "50",
  });

  return rows.map((c) => {
    const ins = c.insights?.data?.[0];
    const creative = c.ads?.data?.[0]?.creative;
    const ctr = ins?.ctr !== undefined ? Number(ins.ctr) : NaN;
    const freq = ins?.frequency !== undefined ? Number(ins.frequency) : NaN;
    return {
      id: c.id,
      nome: c.name ?? c.id,
      status: c.effective_status ?? "UNKNOWN",
      objetivo: c.objective ?? null,
      budgetDiario: centavos(c.daily_budget),
      budgetTotal: centavos(c.lifetime_budget),
      criadaEm: c.created_time ?? null,
      thumbnailUrl: creative?.image_url ?? creative?.thumbnail_url ?? null,
      gasto30d: num(ins?.spend),
      impressoes30d: num(ins?.impressions),
      cliques30d: num(ins?.clicks),
      ctr30d: Number.isFinite(ctr) ? ctr : null,
      frequencia30d: Number.isFinite(freq) ? freq : null,
    };
  });
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
    const chave = String(row.utm_id);
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

// ─── Desempenho: série diária (Supabase — histórico próprio, sem rate limit) ──

export interface DiaGastoAds {
  dia: string; // YYYY-MM-DD
  gasto: number;
  cliques: number;
}

export async function fetchSerieDiariaGasto(supabase: SupabaseServer, dias: number): Promise<DiaGastoAds[]> {
  const corte = new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("meta_ads_campanha")
    .select("data, valor_gasto, cliques")
    .gte("data", corte)
    .is("deleted_at", null)
    .order("data", { ascending: true });
  if (error) throw new MetaAdsError(`meta_ads_campanha: ${error.message}`);

  const porDia = new Map<string, DiaGastoAds>();
  for (const row of data ?? []) {
    const dia = String(row.data);
    const atual = porDia.get(dia) ?? { dia, gasto: 0, cliques: 0 };
    atual.gasto += Number(row.valor_gasto) || 0;
    atual.cliques += Number(row.cliques) || 0;
    porDia.set(dia, atual);
  }
  return [...porDia.values()];
}

// ─── Desempenho: breakdowns demográficos/plataforma (Graph) ─────────────

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

export async function fetchBreakdown(tipo: BreakdownTipo): Promise<BreakdownLinha[]> {
  const rows = await graphGet<GraphBreakdownRow>(`${contaAnuncio()}/insights`, {
    breakdowns: tipo,
    fields: "spend,impressions,clicks",
    date_preset: "last_90d",
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
