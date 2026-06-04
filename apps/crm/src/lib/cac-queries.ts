import { createServerSupabaseClient } from "@/lib/supabase-server";

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

interface GastoRow {
  mes: string;
  canal: string;
  valor_gasto: number;
  leads_gerados: number | null;
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
      .select("mes, canal, valor_gasto, leads_gerados")
      .is("deleted_at", null)
      .gte("mes", startMonth),
    supabase
      .from("form_submissions")
      .select("qualification_classification, utm_source")
      .gte("submitted_at", startISO),
    supabase
      .from("contratos_financeiros")
      .select("valor_total")
      .is("deleted_at", null)
      .gte("created_at", startISO),
  ]);

  const gastos = (gastoRes.data as GastoRow[] | null) ?? [];
  const leads = (leadsRes.data as LeadRow[] | null) ?? [];
  const contratos = (contratosRes.data as ContratoRow[] | null) ?? [];

  const gastoTotal = gastos.reduce((s, g) => s + Number(g.valor_gasto), 0);
  const totalLeads = leads.length;
  const leadsQualificados = leads.filter((l) =>
    ["QUENTE", "MORNO"].includes(l.qualification_classification ?? ""),
  ).length;
  const clientes = contratos.length;
  const receitaTotal = contratos.reduce((s, c) => s + Number(c.valor_total), 0);

  const cacLead = totalLeads > 0 ? gastoTotal / totalLeads : null;
  const cacLeadQualificado =
    leadsQualificados > 0 ? gastoTotal / leadsQualificados : null;
  const cacCliente = clientes > 0 ? gastoTotal / clientes : null;
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
