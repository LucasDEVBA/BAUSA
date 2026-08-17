import { createServerSupabaseClient } from "@/lib/supabase-server";
import { dedupInvestimentos } from "@/lib/marketing-spend";

// ════════════════════════════════════════════════════════════════════════
// CAC/ROI — camada de dados (Fase 1, input manual de gasto)
// ════════════════════════════════════════════════════════════════════════
//
// Cruza investimentos_marketing (gasto) com form_submissions (leads) e
// contratos_financeiros (clientes) para calcular:
//   - CAC por Lead          = gastoTotal / totalLeads
//   - CAC por Lead Qualif.   = gastoTotal / leads QUENTE+MORNO
//   - CAC por Cliente        = gastoTotal / contratos no período
//   - ROI por canal          = (receita estimada do canal − gasto) / gasto
//
// LIMITAÇÕES (documentadas):
//   - Gasto é por CANAL; atribuição de lead é por utm_source (texto livre).
//     Mapeamento via dicionário de aliases normalizado (lower()).
//   - ROI por canal é APROXIMADO: usa taxa de conversão global × ticket
//     médio (não há join receita→utm_source na Fase 1). Badge na UI.
//   - "Cliente" usa contratos_financeiros.created_at como proxy da data de
//     fechamento (não existe data_assinatura) — mesmo critério do War Room
//     (fetchReceitaFechadaMes). Dívida técnica aceita.
//   - Janela de período em UTC, consistente com war-room-queries.
// ════════════════════════════════════════════════════════════════════════

export type Period = "30d" | "90d" | "6m" | "12m";

const PERIOD_DAYS: Record<Period, number> = {
  "30d": 30,
  "90d": 90,
  "6m": 182,
  "12m": 365,
};

export interface CanalGasto {
  canal: string;
  gasto: number;
  leadsGerados: number;
}

export interface MesGasto {
  mes: string; // YYYY-MM
  gasto: number;
}

export interface RoiCanal {
  canal: string;
  gasto: number;
  receitaEstimada: number;
  roi: number | null; // null = gasto 0 (indeterminado)
}

export interface CacMetrics {
  period: Period;
  gastoTotal: number;
  totalLeads: number;
  leadsQualificados: number;
  clientes: number;
  cacLead: number | null;
  cacLeadQualificado: number | null;
  cacCliente: number | null;
  ticketMedio: number | null;
  porCanal: CanalGasto[];
  porMes: MesGasto[];
  roiPorCanal: RoiCanal[];
  /** ROI é aproximado (taxa de conversão global × ticket médio). */
  roiAproximado: boolean;
}

/** ROI EXATO de uma campanha Meta (gasto real × conversões atribuídas por utm_id). */
export interface CampanhaRoi {
  campanhaId: string;
  campanhaNome: string | null;
  gasto: number;
  impressoes: number;
  cliques: number;
  leads: number;
  leadsQualificados: number;
  clientes: number;
  receita: number;
  cacLead: number | null;
  cacCliente: number | null;
  /** (receita − gasto) / gasto. null quando gasto = 0. */
  roi: number | null;
}

export interface DiaGasto {
  data: string; // YYYY-MM-DD
  gasto: number;
}

export interface CampanhaMetrics {
  /** Há linhas em meta_ads_campanha no período (sync do Meta ativo). */
  temDados: boolean;
  gastoTotal: number;
  porCampanha: CampanhaRoi[];
  porDia: DiaGasto[];
  /** Leads no período sem utm_id → não atribuíveis a uma campanha. */
  leadsSemCampanha: number;
}

interface GastoRow {
  mes: string;
  canal: string;
  valor_gasto: number;
  leads_gerados: number | null;
  source: string;
}

interface LeadRow {
  qualification_classification: string | null;
  utm_source: string | null;
}

interface ContratoRow {
  valor_total: number;
}

// Mapeia canal de gasto → aliases possíveis de utm_source (normalizado).
const CANAL_UTM_ALIASES: Record<string, string[]> = {
  instagram: ["instagram", "ig"],
  facebook: ["facebook", "fb"],
  meta: ["meta", "facebook", "fb", "instagram", "ig"],
  google: ["google", "adwords", "google_ads", "googleads"],
  tiktok: ["tiktok", "tt"],
  youtube: ["youtube", "yt"],
  outro: [],
};

function startDateUTC(period: Period): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - PERIOD_DAYS[period]);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function normalize(value: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Calcula todas as métricas de CAC/ROI para o período informado.
 * Nunca lança em divisão por zero — retorna `null` (UI exibe "—").
 */
export async function fetchCacMetrics(period: Period): Promise<CacMetrics> {
  const supabase = await createServerSupabaseClient();
  const start = startDateUTC(period);
  const startISO = start.toISOString();
  const startMonth = `${start.toISOString().slice(0, 7)}-01`; // YYYY-MM-01

  const [gastoRes, leadsRes, contratosRes] = await Promise.all([
    supabase
      .from("investimentos_marketing")
      .select("mes, canal, valor_gasto, leads_gerados, source")
      .is("deleted_at", null)
      .gte("mes", startMonth),
    supabase
      .from("form_submissions")
      .select("qualification_classification, utm_source")
      .is("deleted_at", null)
      .gte("submitted_at", startISO),
    supabase
      .from("contratos_financeiros")
      .select("valor_total")
      .is("deleted_at", null)
      .gte("created_at", startISO),
  ]);

  // Dedup por (mês, canal): meta_api vence manual — mesma regra do DRE, para
  // não dobrar o gasto de Meta quando o sync automático e o manual coexistem.
  const gastos = dedupInvestimentos((gastoRes.data as GastoRow[] | null) ?? []);
  const leads = (leadsRes.data as LeadRow[] | null) ?? [];
  const contratos = (contratosRes.data as ContratoRow[] | null) ?? [];

  const gastoTotal = gastos.reduce((s, g) => s + Number(g.valor_gasto), 0);
  const totalLeads = leads.length;
  const leadsQualificados = leads.filter((l) =>
    ["QUENTE", "MORNO"].includes(l.qualification_classification ?? ""),
  ).length;
  const clientes = contratos.length;
  const receitaTotal = contratos.reduce((s, c) => s + Number(c.valor_total), 0);

  // CAC só é definido quando houve gasto no período. Sem gasto, o custo de
  // aquisição é indefinido (não zero) → null → UI exibe "—" em vez de "R$ 0"
  // (que sugeriria, erroneamente, que adquirir custou nada).
  const temGasto = gastoTotal > 0;
  const cacLead = temGasto && totalLeads > 0 ? gastoTotal / totalLeads : null;
  const cacLeadQualificado =
    temGasto && leadsQualificados > 0 ? gastoTotal / leadsQualificados : null;
  const cacCliente = temGasto && clientes > 0 ? gastoTotal / clientes : null;
  const ticketMedio = clientes > 0 ? receitaTotal / clientes : null;
  const conversaoGlobal = totalLeads > 0 ? clientes / totalLeads : 0;

  // Gasto agregado por canal
  const canalMap = new Map<string, { gasto: number; leadsGerados: number }>();
  for (const g of gastos) {
    const prev = canalMap.get(g.canal) ?? { gasto: 0, leadsGerados: 0 };
    prev.gasto += Number(g.valor_gasto);
    prev.leadsGerados += Number(g.leads_gerados ?? 0);
    canalMap.set(g.canal, prev);
  }
  const porCanal: CanalGasto[] = Array.from(canalMap.entries())
    .map(([canal, v]) => ({ canal, gasto: v.gasto, leadsGerados: v.leadsGerados }))
    .sort((a, b) => b.gasto - a.gasto);

  // Gasto agregado por mês (tendência)
  const mesMap = new Map<string, number>();
  for (const g of gastos) {
    const ym = String(g.mes).slice(0, 7);
    mesMap.set(ym, (mesMap.get(ym) ?? 0) + Number(g.valor_gasto));
  }
  const porMes: MesGasto[] = Array.from(mesMap.entries())
    .map(([mes, gasto]) => ({ mes, gasto }))
    .sort((a, b) => a.mes.localeCompare(b.mes));

  // Leads por utm_source normalizado
  const leadsPorUtm = new Map<string, number>();
  for (const l of leads) {
    const src = normalize(l.utm_source);
    if (!src) continue;
    leadsPorUtm.set(src, (leadsPorUtm.get(src) ?? 0) + 1);
  }

  // ROI por canal (APROXIMADO): leads do canal → conversão global → ticket
  const roiPorCanal: RoiCanal[] = porCanal.map(({ canal, gasto }) => {
    const aliases = CANAL_UTM_ALIASES[canal] ?? [canal];
    let leadsDoCanal = 0;
    for (const alias of aliases) {
      leadsDoCanal += leadsPorUtm.get(alias) ?? 0;
    }
    const clientesEstimados = leadsDoCanal * conversaoGlobal;
    const receitaEstimada =
      ticketMedio != null ? clientesEstimados * ticketMedio : 0;
    const roi = gasto > 0 ? (receitaEstimada - gasto) / gasto : null;
    return { canal, gasto, receitaEstimada, roi };
  });

  return {
    period,
    gastoTotal,
    totalLeads,
    leadsQualificados,
    clientes,
    cacLead,
    cacLeadQualificado,
    cacCliente,
    ticketMedio,
    porCanal,
    porMes,
    roiPorCanal,
    roiAproximado: true,
  };
}

// ─── ROI EXATO por campanha (Meta) ──────────────────────────────────────
//
// Cruza o gasto real por campanha (meta_ads_campanha.campanha_id) com as
// conversões atribuídas via form_submissions.utm_id (= Meta campaign.id).
// Cliente → campanha percorre contrato → deal → atleta → form_submission.
// Diferente do ROI por canal (aproximado): aqui a atribuição é 1:1 exata.

interface MetaRow {
  data: string;
  campanha_id: string;
  campanha_nome: string | null;
  valor_gasto: number;
  impressoes: number | null;
  cliques: number | null;
}

interface LeadCampanhaRow {
  utm_id: string | null;
  qualification_classification: string | null;
}

interface ContratoCampanhaRow {
  valor_total: number;
  deals: unknown; // embed to-one (objeto ou array, tratado por firstOf)
}

/** Embeds PostgREST to-one podem vir como objeto ou array de 1 — normaliza. */
function firstOf<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

/** utm_id do lead que originou o contrato (contrato→deal→atleta→form_submission). */
function utmIdFromContrato(row: ContratoCampanhaRow): string | null {
  const deal = firstOf<{ atletas: unknown }>(row.deals);
  const atleta = firstOf<{ form_submissions: unknown }>(deal?.atletas);
  const fs = firstOf<{ utm_id: string | null }>(atleta?.form_submissions);
  const utm = fs?.utm_id?.trim();
  return utm ? utm : null;
}

export async function fetchCampanhaMetrics(
  period: Period,
): Promise<CampanhaMetrics> {
  const supabase = await createServerSupabaseClient();
  const start = startDateUTC(period);
  const startISO = start.toISOString();
  const startDate = start.toISOString().slice(0, 10); // meta_ads_campanha.data é DATE

  const [metaRes, leadsRes, contratosRes] = await Promise.all([
    supabase
      .from("meta_ads_campanha")
      .select("data, campanha_id, campanha_nome, valor_gasto, impressoes, cliques")
      .is("deleted_at", null)
      .gte("data", startDate),
    supabase
      .from("form_submissions")
      .select("utm_id, qualification_classification")
      .is("deleted_at", null)
      .gte("submitted_at", startISO),
    supabase
      .from("contratos_financeiros")
      .select("valor_total, deals(atletas(form_submissions(utm_id)))")
      .is("deleted_at", null)
      .gte("created_at", startISO),
  ]);

  // Sem a tabela/sync do Meta, a query falha silenciosamente (data null) →
  // temDados=false → a UI mostra o estado de ativação em vez de dados falsos.
  const metaRows = (metaRes.data as MetaRow[] | null) ?? [];
  const leads = (leadsRes.data as LeadCampanhaRow[] | null) ?? [];
  const contratos = (contratosRes.data as ContratoCampanhaRow[] | null) ?? [];

  // Gasto/impressões/cliques agregados por campanha + série diária
  interface Acc {
    nome: string | null;
    gasto: number;
    impressoes: number;
    cliques: number;
  }
  const porCampanhaAcc = new Map<string, Acc>();
  const porDiaMap = new Map<string, number>();
  for (const r of metaRows) {
    // Chave normalizada com trim — espelha o trim do lado leads/contratos
    // (utmIdFromContrato / leads.utm_id) para o join não falhar por espaço residual.
    const campanhaId = r.campanha_id?.trim();
    if (!campanhaId) continue;
    const acc = porCampanhaAcc.get(campanhaId) ?? {
      nome: null,
      gasto: 0,
      impressoes: 0,
      cliques: 0,
    };
    acc.gasto += Number(r.valor_gasto);
    acc.impressoes += Number(r.impressoes ?? 0);
    acc.cliques += Number(r.cliques ?? 0);
    if (r.campanha_nome) acc.nome = r.campanha_nome;
    porCampanhaAcc.set(campanhaId, acc);
    if (r.data) porDiaMap.set(r.data, (porDiaMap.get(r.data) ?? 0) + Number(r.valor_gasto));
  }

  // Leads (total e qualificados) atribuídos por campanha (utm_id = campaign.id)
  const leadsPorCampanha = new Map<string, { total: number; qualificados: number }>();
  let leadsSemCampanha = 0;
  for (const l of leads) {
    const utm = l.utm_id?.trim();
    if (!utm) {
      leadsSemCampanha += 1;
      continue;
    }
    const prev = leadsPorCampanha.get(utm) ?? { total: 0, qualificados: 0 };
    prev.total += 1;
    if (["QUENTE", "MORNO"].includes(l.qualification_classification ?? "")) {
      prev.qualificados += 1;
    }
    leadsPorCampanha.set(utm, prev);
  }

  // Clientes + receita atribuídos por campanha (contrato → utm_id de origem)
  const clientesPorCampanha = new Map<string, { clientes: number; receita: number }>();
  for (const c of contratos) {
    const utm = utmIdFromContrato(c);
    if (!utm) continue;
    const prev = clientesPorCampanha.get(utm) ?? { clientes: 0, receita: 0 };
    prev.clientes += 1;
    prev.receita += Number(c.valor_total);
    clientesPorCampanha.set(utm, prev);
  }

  // ROI por campanha (chaveado nas campanhas COM gasto — onde ROI faz sentido)
  const porCampanha: CampanhaRoi[] = Array.from(porCampanhaAcc.entries())
    .map(([campanhaId, acc]) => {
      const l = leadsPorCampanha.get(campanhaId) ?? { total: 0, qualificados: 0 };
      const cl = clientesPorCampanha.get(campanhaId) ?? { clientes: 0, receita: 0 };
      const temGasto = acc.gasto > 0;
      return {
        campanhaId,
        campanhaNome: acc.nome,
        gasto: acc.gasto,
        impressoes: acc.impressoes,
        cliques: acc.cliques,
        leads: l.total,
        leadsQualificados: l.qualificados,
        clientes: cl.clientes,
        receita: cl.receita,
        cacLead: temGasto && l.total > 0 ? acc.gasto / l.total : null,
        cacCliente: temGasto && cl.clientes > 0 ? acc.gasto / cl.clientes : null,
        roi: temGasto ? (cl.receita - acc.gasto) / acc.gasto : null,
      };
    })
    .sort((a, b) => b.gasto - a.gasto);

  const porDia: DiaGasto[] = Array.from(porDiaMap.entries())
    .map(([data, gasto]) => ({ data, gasto }))
    .sort((a, b) => a.data.localeCompare(b.data));

  const gastoTotal = porCampanha.reduce((s, c) => s + c.gasto, 0);

  return {
    temDados: metaRows.length > 0,
    gastoTotal,
    porCampanha,
    porDia,
    leadsSemCampanha,
  };
}
