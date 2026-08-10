import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  WarRoomMetrics,
  MetaRevenueMetrics,
  CommercialFunnelMetrics,
  CashFlowMetrics,
  RevenueAtRiskMetrics,
  PositioningMetrics,
  FamilyExperienceMetrics,
  RevenueMonth,
  ConversionFunnelStep,
  Alert,
  Bottleneck,
} from "@/types/revenue";
import type { Family } from "@/types/family";
import type { Deal, DealStage } from "@/types/deal";

// ─── Helpers ────────────────────────────────────────────────────────

function mesAtualPrefix(): string {
  return new Date().toISOString().slice(0, 7);
}

function firstOfMonth(): string {
  return `${mesAtualPrefix()}-01`;
}

function daysAgoISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function daysFromNowISO(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

// ─── Core Queries (reused across pages) ─────────────────────────────

export async function fetchReceitaFechadaMes() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("contratos_financeiros")
    .select("valor_total")
    .is("deleted_at", null)
    .gte("created_at", firstOfMonth());
  return (data || []).reduce((s, c) => s + Number(c.valor_total), 0);
}

export async function fetchReceitaRecebidaMes() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "recebido")
    .is("deleted_at", null)
    .gte("recebido_at", firstOfMonth());
  return (data || []).reduce((s, p) => s + Number(p.valor), 0);
}

export async function fetchDealsAtivos() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("deals")
    .select("id, valor_estimado, probabilidade_fechamento, etapa, next_action, data_proxima_acao, atleta:atletas(nome_completo)")
    .is("deleted_at", null)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado)");
  return data || [];
}

export async function fetchDealsConcluidos() {
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("etapa", "concluido")
    .is("deleted_at", null);
  return count || 0;
}

export async function fetchDealsTotal() {
  const supabase = await createServerSupabaseClient();
  const { count } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  return count || 0;
}

export async function fetchMetaMensal(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", "meta_mensal_padrao")
    .single();
  return data ? Number(data.valor) : 125000;
}

export async function fetchExperienciaStats() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("crm_experiencia")
    .select("temperatura, status, ansiedade, satisfacao, nps_6meses")
    .is("deleted_at", null);
  return data || [];
}

export async function fetchParcelasAtrasadas() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "atrasado")
    .is("deleted_at", null);
  return data || [];
}

export async function fetchParcelasPrevist30d() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "previsto")
    .is("deleted_at", null)
    .lte("vencimento", daysFromNowISO(30));
  return (data || []).reduce((s, p) => s + Number(p.valor), 0);
}

export async function fetchParcelasPrevist90d() {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "previsto")
    .is("deleted_at", null)
    .lte("vencimento", daysFromNowISO(90));
  return (data || []).reduce((s, p) => s + Number(p.valor), 0);
}

// ─── Transformed Data for Components ────────────────────────────────

export async function fetchWarRoomMetrics(): Promise<WarRoomMetrics> {
  const [
    receitaMes,
    dealsAtivos,
    dealsConcluidos,
    dealsTotal,
    expStats,
  ] = await Promise.all([
    fetchReceitaRecebidaMes(),
    fetchDealsAtivos(),
    fetchDealsConcluidos(),
    fetchDealsTotal(),
    fetchExperienciaStats(),
  ]);

  const pipelineTotal = dealsAtivos.reduce((s, d) => s + (Number(d.valor_estimado) || 0), 0);
  const taxaConversao = dealsTotal > 0 ? Math.round((dealsConcluidos / dealsTotal) * 100) : 0;
  const avgTicket = dealsConcluidos > 0 ? Math.round(pipelineTotal / dealsAtivos.length) : 0;
  const expTotal = expStats.length;
  const expCrise = expStats.filter((e) => e.status === "crise").length;

  // NPS real (escala 1-10): promotores ≥9, detratores ≤6. Conta apenas quem
  // respondeu (nps_6meses não-nulo — campo preenchido após 6 meses de contato).
  // Se ninguém respondeu, nps_respondentes=0 e a UI exibe "—" (não 0 enganoso).
  const npsRespostas = expStats.filter(
    (e) => e.nps_6meses != null && typeof e.nps_6meses === "number",
  );
  const npsRespondentes = npsRespostas.length;
  const npsPromotores = npsRespostas.filter((e) => Number(e.nps_6meses) >= 9).length;
  const npsDetratores = npsRespostas.filter((e) => Number(e.nps_6meses) <= 6).length;
  const npsAverage =
    npsRespondentes > 0
      ? Math.round(((npsPromotores - npsDetratores) / npsRespondentes) * 100)
      : 0;

  // Next-action compliance: % de deals ativos com next_action preenchido.
  // Sinal de saúde operacional do pipeline (todo deal ativo deve ter próxima ação).
  const activeDealsCount = dealsAtivos.length;
  const dealsComAcao = dealsAtivos.filter(
    (d) => d.next_action != null && String(d.next_action).trim() !== "",
  ).length;
  const nextActionCompliancePct =
    activeDealsCount > 0 ? Math.round((dealsComAcao / activeDealsCount) * 100) : 0;

  // Previous month revenue for trend (simplified)
  const supabase = await createServerSupabaseClient();
  const prevMonth = new Date();
  prevMonth.setMonth(prevMonth.getMonth() - 1);
  const prevPrefix = prevMonth.toISOString().slice(0, 7);
  const { data: prevParcelas } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "recebido")
    .is("deleted_at", null)
    .gte("recebido_at", `${prevPrefix}-01`)
    .lt("recebido_at", firstOfMonth());
  const prevReceita = (prevParcelas || []).reduce((s, p) => s + Number(p.valor), 0);
  const mrrTrend = prevReceita > 0 ? Math.round(((receitaMes - prevReceita) / prevReceita) * 100 * 10) / 10 : 0;

  // Leads + closed this month
  const { count: leadsThisMonth } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .gte("created_at", firstOfMonth());

  const { count: closedThisMonth } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .eq("etapa", "concluido")
    .is("deleted_at", null)
    .gte("updated_at", firstOfMonth());

  // Revenue YTD
  const anoAtual = new Date().getFullYear();
  const { data: ytdParcelas } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "recebido")
    .is("deleted_at", null)
    .gte("recebido_at", `${anoAtual}-01-01`);
  const revenueYtd = (ytdParcelas || []).reduce((s, p) => s + Number(p.valor), 0);

  return {
    mrr_brl: receitaMes,
    mrr_trend_pct: mrrTrend,
    arr_brl: receitaMes * 12,
    pipeline_total_brl: pipelineTotal,
    avg_ticket_brl: avgTicket,
    conversion_rate: taxaConversao,
    active_families: expTotal,
    at_risk_families: expCrise,
    nps_average: npsAverage,
    nps_respondentes: npsRespondentes,
    next_action_compliance_pct: nextActionCompliancePct,
    active_deals_count: activeDealsCount,
    leads_this_month: leadsThisMonth || 0,
    closed_this_month: closedThisMonth || 0,
    revenue_ytd_brl: revenueYtd,
  };
}

export async function fetchMetaRevenue(): Promise<MetaRevenueMetrics> {
  const [receitaRecebida, metaMensal, dealsAtivos] = await Promise.all([
    fetchReceitaRecebidaMes(),
    fetchMetaMensal(),
    fetchDealsAtivos(),
  ]);

  const pipelineProvavel = dealsAtivos.reduce(
    (s, d) => s + (Number(d.valor_estimado) || 0) * (Number(d.probabilidade_fechamento) || 0) / 100,
    0
  );
  const projected = receitaRecebida + pipelineProvavel;
  const gap = projected - metaMensal;

  return {
    net_revenue_month_brl: receitaRecebida,
    monthly_target_brl: metaMensal,
    projected_revenue_brl: projected,
    gap_to_target_brl: gap,
  };
}

export async function fetchCommercialFunnel(): Promise<CommercialFunnelMetrics> {
  const supabase = await createServerSupabaseClient();

  const countByEtapa = async (etapas: string | string[]) => {
    const query = supabase
      .from("deals")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null);

    if (Array.isArray(etapas)) {
      query.in("etapa", etapas);
    } else {
      query.eq("etapa", etapas);
    }

    const { count } = await query;
    return count || 0;
  };

  const [leads, reunioes, propostas, contratos, sinais, concluidos] = await Promise.all([
    countByEtapa(["lead", "reuniao_marcada"]),
    countByEtapa(["reuniao_realizada", "diagnostico_fit", "alinhamento_estrategico"]),
    countByEtapa(["proposta_enviada", "followup_proposta"]),
    countByEtapa(["contrato_assinado", "contrato_enviado", "negociacao"]),
    countByEtapa("sinal_pago"),
    countByEtapa("concluido"),
  ]);

  return {
    leads_qualified: leads,
    meetings_done: reunioes,
    proposals_sent: propostas,
    contracts_signed: contratos,
    signals_paid: sinais,
    auto_conversions: concluidos,
  };
}

export async function fetchCashFlow(): Promise<CashFlowMetrics> {
  const [recebido, proj30, proj90] = await Promise.all([
    fetchReceitaRecebidaMes(),
    fetchParcelasPrevist30d(),
    fetchParcelasPrevist90d(),
  ]);

  return {
    net_received_brl: recebido,
    projected_30d_brl: proj30,
    projected_90d_brl: proj90,
  };
}

export async function fetchRevenueAtRisk(): Promise<RevenueAtRiskMetrics> {
  const supabase = await createServerSupabaseClient();

  // Contratos enviados sem assinatura
  const { data: semAssinatura } = await supabase
    .from("deals")
    .select("id, valor_estimado")
    .eq("etapa", "contrato_enviado")
    .is("deleted_at", null);

  // Contrato assinado sem sinal pago
  const { data: semSinal } = await supabase
    .from("deals")
    .select("id, valor_estimado")
    .eq("etapa", "contrato_assinado")
    .is("deleted_at", null);

  // Sinal pago com remanescente pendente
  const { data: semRemanescente } = await supabase
    .from("deals")
    .select("id, valor_estimado")
    .in("etapa", ["sinal_pago", "admission_process"])
    .is("deleted_at", null);

  // Parcelas atrasadas
  const parcelasAtrasadas = await fetchParcelasAtrasadas();
  const totalAtrasado = parcelasAtrasadas.reduce((s, p) => s + Number(p.valor), 0);

  const semAssinaturaList = semAssinatura || [];
  const semSinalList = semSinal || [];
  const semRemanList = semRemanescente || [];

  return {
    contracts_without_signature_count: semAssinaturaList.length,
    contracts_without_signature_brl: semAssinaturaList.reduce((s, d) => s + (Number(d.valor_estimado) || 0), 0),
    unpaid_signals_count: semSinalList.length,
    unpaid_signals_brl: semSinalList.reduce((s, d) => s + (Number(d.valor_estimado) || 0) * 0.15, 0),
    pending_remaining_count: semRemanList.length,
    pending_remaining_brl: semRemanList.reduce((s, d) => s + (Number(d.valor_estimado) || 0) * 0.85, 0),
    overdue_receivables_brl: totalAtrasado,
  };
}

export async function fetchPositioning(): Promise<PositioningMetrics> {
  // Ticket médio do pipeline (deals ativos) — independente do mix de planos.
  const dealsAtivos = await fetchDealsAtivos();
  const totalDeals = dealsAtivos.length;
  const totalValor = dealsAtivos.reduce((s, d) => s + (Number(d.valor_estimado) || 0), 0);
  const avg_ticket_brl = totalDeals > 0 ? Math.round(totalValor / totalDeals) : 0;

  // Mix de planos + desconto vêm dos CONTRATOS: o plano real do cliente vive em
  // contratos_financeiros.plano (enum journey/legacy/start), NÃO em deals
  // (que nunca teve product_tier/has_discount). Desconto = valor customizado.
  const supabase = await createServerSupabaseClient();
  const { data: contratos } = await supabase
    .from("contratos_financeiros")
    .select("plano, valor_customizado")
    .is("deleted_at", null);

  const lista = contratos ?? [];
  const totalContratos = lista.length || 1;
  const porPlano = (plano: string) => lista.filter((c) => c.plano === plano).length;
  const comDesconto = lista.filter((c) => c.valor_customizado != null).length;

  return {
    pct_legacy: Math.round((porPlano("legacy") / totalContratos) * 100),
    pct_journey: Math.round((porPlano("journey") / totalContratos) * 100),
    pct_start: Math.round((porPlano("start") / totalContratos) * 100),
    avg_ticket_brl,
    pct_discounted: Math.round((comDesconto / totalContratos) * 100),
  };
}

export async function fetchFamilyExperience(): Promise<FamilyExperienceMetrics> {
  const expStats = await fetchExperienciaStats();
  const total = expStats.length;
  const atRisk = expStats.filter((e) => e.status === "crise" || e.temperatura === "vermelho").length;
  const satisfied = expStats.filter((e) => e.temperatura === "verde").length;
  const crises = expStats.filter((e) => e.status === "crise").length;

  return {
    active_families: total,
    at_risk_families: atRisk,
    satisfied_families: satisfied,
    open_crises: crises,
    referral_potential: satisfied,
  };
}

export async function fetchFamilyV2Metrics() {
  const expStats = await fetchExperienciaStats();
  const total = expStats.length;
  const satisfeita = expStats.filter((e) => e.temperatura === "verde").length;
  const atencao = expStats.filter((e) => e.temperatura === "amarelo").length;
  const crise = expStats.filter((e) => e.status === "crise").length;
  const avgSatisfaction = total > 0
    ? +(expStats.reduce((s, e) => s + (Number(e.satisfacao) || 0), 0) / total).toFixed(1)
    : 0;

  return { total, satisfeita, atencao, crise, avg_satisfaction: avgSatisfaction };
}

export async function fetchConversionFunnel(): Promise<ConversionFunnelStep[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("deals")
    .select("etapa")
    .is("deleted_at", null);

  const deals = data || [];
  const total = deals.length;
  const qualified = deals.filter((d) => d.etapa !== "perdido").length;
  const reunioes = deals.filter((d) =>
    ["reuniao_realizada", "diagnostico_fit", "alinhamento_estrategico", "proposta_enviada",
     "followup_proposta", "negociacao", "contrato_enviado", "contrato_assinado",
     "sinal_pago", "admission_process", "concluido"].includes(d.etapa)
  ).length;
  const propostas = deals.filter((d) =>
    ["proposta_enviada", "followup_proposta", "negociacao", "contrato_enviado",
     "contrato_assinado", "sinal_pago", "admission_process", "concluido"].includes(d.etapa)
  ).length;
  const contratos = deals.filter((d) =>
    ["contrato_assinado", "sinal_pago", "admission_process", "concluido"].includes(d.etapa)
  ).length;

  return [
    { label: "Leads Captados", value: total, fill: "#6366f1" },
    { label: "Qualificados", value: qualified, fill: "#818cf8" },
    { label: "Reunioes", value: reunioes, fill: "#a5b4fc" },
    { label: "Propostas", value: propostas, fill: "#c7d2fe" },
    { label: "Contratos", value: contratos, fill: "#10b981" },
  ];
}

export async function fetchRevenueMonths(): Promise<RevenueMonth[]> {
  const supabase = await createServerSupabaseClient();
  const months: RevenueMonth[] = [];
  const now = new Date();

  // Last 12 months
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    const monthLabel = `${["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"][month - 1]}/${String(year).slice(2)}`;

    const nextMonth = new Date(year, month, 1).toISOString();

    // Contracted (contratos_financeiros created this month)
    const { data: contratos } = await supabase
      .from("contratos_financeiros")
      .select("valor_total")
      .is("deleted_at", null)
      .gte("created_at", `${prefix}-01`)
      .lt("created_at", nextMonth);
    const contracted = (contratos || []).reduce((s, c) => s + Number(c.valor_total), 0);

    // Received (parcelas recebidas this month)
    const { data: parcelas } = await supabase
      .from("parcelas")
      .select("valor")
      .eq("status", "recebido")
      .is("deleted_at", null)
      .gte("recebido_at", `${prefix}-01`)
      .lt("recebido_at", nextMonth);
    const received = (parcelas || []).reduce((s, p) => s + Number(p.valor), 0);

    // Projected (pendente parcelas for future months)
    const { data: pendentes } = await supabase
      .from("parcelas")
      .select("valor")
      .eq("status", "previsto")
      .is("deleted_at", null)
      .gte("vencimento", `${prefix}-01`)
      .lt("vencimento", nextMonth);
    const projected = (pendentes || []).reduce((s, p) => s + Number(p.valor), 0);

    // Families signed
    const { count: familiesSigned } = await supabase
      .from("contratos_financeiros")
      .select("*", { count: "exact", head: true })
      .is("deleted_at", null)
      .gte("created_at", `${prefix}-01`)
      .lt("created_at", nextMonth);

    months.push({
      month,
      year,
      month_label: monthLabel,
      contracted_brl: contracted,
      received_brl: received,
      projected_brl: projected,
      families_signed: familiesSigned || 0,
    });
  }

  return months;
}

export async function fetchAlerts(): Promise<Alert[]> {
  const { verificarAlertas } = await import("@/lib/automacoes/verificar-alertas");
  const alertasCRM = await verificarAlertas();

  return alertasCRM.map((a, i) => ({
    id: a.deal_id || `alert-${i}`,
    type: a.severidade === "critica" || a.severidade === "alta" ? "critical" as const : "warning" as const,
    title: a.titulo,
    description: a.mensagem,
    action_label: "Ver deal",
    created_at: new Date().toISOString(),
  }));
}

// ─── Leads pendentes de qualificação (Gemini falhou) ───────────────
// Conta e lista os leads com `qualification_pending = true` para
// renderizar o alerta no War Room e permitir retry manual.
export interface PendingQualificationLead {
  id: string;
  email: string;
  athlete_name: string;
  submitted_at: string;
  qualification_attempts: number;
  last_qualification_attempt_at: string | null;
  last_qualification_error: string | null;
}

export interface PendingQualificationSummary {
  count: number;
  leads: PendingQualificationLead[];
  oldest_attempt_at: string | null;
}

export async function fetchPendingQualifications(): Promise<PendingQualificationSummary> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("form_submissions")
    .select("id,email,athlete_name,submitted_at,qualification_attempts,last_qualification_attempt_at,last_qualification_error")
    .eq("qualification_pending", true)
    .order("last_qualification_attempt_at", { ascending: true, nullsFirst: true });

  if (error || !data) {
    return { count: 0, leads: [], oldest_attempt_at: null };
  }

  const leads = data.map((r) => ({
    id: r.id,
    email: r.email,
    athlete_name: r.athlete_name,
    submitted_at: r.submitted_at,
    qualification_attempts: r.qualification_attempts || 0,
    last_qualification_attempt_at: r.last_qualification_attempt_at,
    last_qualification_error: r.last_qualification_error,
  }));

  return {
    count: leads.length,
    leads,
    oldest_attempt_at: leads.length > 0 ? leads[0].last_qualification_attempt_at : null,
  };
}

// ─── Fila de aprovação manual (gate humano pré-outreach) ───────────
// Leads QUENTE/MORNO aguardando decisão do CEO/CTO. Só o count — a lista
// completa é buscada pelo modal via listarLeadsPendentesAprovacao.
export async function fetchLeadsAguardandoAprovacao(): Promise<number> {
  const supabase = await createServerSupabaseClient();
  const { count, error } = await supabase
    .from("form_submissions")
    .select("id", { count: "exact", head: true })
    .eq("aprovacao_status", "pendente")
    .in("qualification_classification", ["QUENTE", "MORNO"]);

  if (error) return 0;
  return count ?? 0;
}

// ─── Leads com timing alternativo (cedo demais / tarde demais) ─────
// Para card resumo no War Room: quantos atletas estão fora da janela
// ideal de aplicação e qual a próxima data de retomada agendada.
export interface TimingAlternativeSummary {
  aguardando_timing_count: number;        // muito_cedo (atletas a retomar)
  fora_timing_count: number;              // tarde_demais (leads alternativos)
  next_scheduled_followup_at: string | null; // data mais próxima de retorno
}

export async function fetchTimingAlternatives(): Promise<TimingAlternativeSummary> {
  const supabase = await createServerSupabaseClient();

  const [muitoCedo, tardeDemais, nextScheduled] = await Promise.all([
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("timing_status", "muito_cedo"),
    supabase
      .from("form_submissions")
      .select("id", { count: "exact", head: true })
      .eq("timing_status", "tarde_demais"),
    supabase
      .from("form_submissions")
      .select("scheduled_followup_at")
      .eq("timing_status", "muito_cedo")
      .not("scheduled_followup_at", "is", null)
      .is("scheduled_followup_sent_at", null)
      .order("scheduled_followup_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    aguardando_timing_count: muitoCedo.count ?? 0,
    fora_timing_count: tardeDemais.count ?? 0,
    next_scheduled_followup_at: (nextScheduled.data?.scheduled_followup_at as string | null) ?? null,
  };
}

export async function fetchBottlenecks(): Promise<Bottleneck[]> {
  const dealsAtivos = await fetchDealsAtivos();
  const bottlenecks: Bottleneck[] = [];

  // Deals stuck in proposta_enviada > 15 days
  const limite15d = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
  const supabase = await createServerSupabaseClient();
  const { data: propostasParadas } = await supabase
    .from("deals")
    .select("id, valor_estimado")
    .eq("etapa", "proposta_enviada")
    .is("deleted_at", null)
    .lt("updated_at", limite15d);

  if (propostasParadas && propostasParadas.length > 0) {
    const total = propostasParadas.reduce((s, d) => s + (Number(d.valor_estimado) || 0), 0);
    bottlenecks.push({
      id: "b-proposta",
      title: `Pipeline parado na etapa de Proposta Enviada`,
      description: `${propostasParadas.length} deal(s) totalizando R$ ${(total / 1000).toFixed(0)}k estao na etapa de Proposta Enviada ha mais de 15 dias.`,
      impact: "alto",
      suggestion: "Agendar follow-up direto com os responsaveis. Verificar se ha objecoes de preco nao mapeadas.",
    });
  }

  // Deals sem next_action
  const semAction = dealsAtivos.filter((d) => !d.next_action);
  if (semAction.length > 0) {
    bottlenecks.push({
      id: "b-next-action",
      title: `${semAction.length} deal(s) sem proxima acao definida`,
      description: `Deals ativos sem next_action prejudicam o acompanhamento do pipeline.`,
      impact: "alto",
      suggestion: "Definir proxima acao para todos os deals ativos.",
    });
  }

  // Low conversion rate check
  const [concluidos, totalDeals] = await Promise.all([fetchDealsConcluidos(), fetchDealsTotal()]);
  const taxa = totalDeals > 0 ? (concluidos / totalDeals) * 100 : 0;
  if (taxa < 40 && totalDeals > 5) {
    bottlenecks.push({
      id: "b-conversao",
      title: "Taxa de conversao abaixo do target",
      description: `Conversao atual de ${Math.round(taxa)}% contra target de 40%.`,
      impact: "alto",
      suggestion: "Revisar o roteiro de reuniao e incluir cases de sucesso.",
    });
  }

  return bottlenecks;
}

export async function fetchFamiliesFromExperiencia(): Promise<Family[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("crm_experiencia")
    .select("*, familia:familias(*, atleta:atletas(nome_completo, posicao))")
    .is("deleted_at", null);

  if (!data) return [];

  return data.map((exp: Record<string, unknown>, i: number) => {
    const familia = exp.familia as Record<string, unknown> | null;
    const atleta = (familia?.atleta as Record<string, unknown>) || {};

    const temperatura = (exp.temperatura as string) || "verde";
    const status = (exp.status as string) || "satisfeita";

    const riskLevel = status === "crise" ? "alto" : temperatura === "vermelho" ? "alto" : temperatura === "amarelo" ? "medio" : "baixo";

    return {
      id: (exp.id as string) || `exp-${i}`,
      athlete_name: (atleta.nome_completo as string) || "Atleta",
      athlete_position: (atleta.posicao as string) || "",
      guardian_name: (familia?.responsavel_nome as string) || "",
      email: (familia?.email as string) || "",
      whatsapp: (familia?.whatsapp as string) || "",
      plan: ((familia?.plano as string) || "Journey") as "Journey" | "Legacy" | "Start",
      journey_stage: ((exp.etapa_jornada as string) || "admissao") as Family["journey_stage"],
      family_status: status as Family["family_status"],
      temperature: temperatura as Family["temperature"],
      anxiety_level: Number(exp.ansiedade) || 2,
      satisfaction_level: Number(exp.satisfacao) || 3,
      perceived_risk: Number(exp.risco_percebido) || 2,
      risk_profile: [
        { dimension: "academico" as const, score: 2 },
        { dimension: "esportivo" as const, score: 2 },
        { dimension: "emocional" as const, score: 2 },
        { dimension: "financeiro" as const, score: 2 },
        { dimension: "relacional" as const, score: 2 },
        { dimension: "comunicacao" as const, score: 2 },
      ],
      last_contact_at: (exp.ultimo_contato_at as string) || new Date().toISOString(),
      last_contact_type: "whatsapp" as const,
      next_contact_date: (exp.proximo_contato_at as string) || new Date().toISOString(),
      days_without_contact: 0,
      contract_value_brl: Number(familia?.valor_contrato) || 26000,
      contracted_at: (familia?.contratado_at as string) || new Date().toISOString(),
      target_school: (familia?.escola_alvo as string) || "",
      target_sport: "Futebol",
      address_state: "",
      attention_records: [],
      crisis_records: [],
      next_milestone: (exp.proximo_marco as string) || "",
      next_milestone_date: (exp.proximo_marco_data as string) || new Date().toISOString(),
      risk_level: riskLevel as Family["risk_level"],
      nps_score: Number(exp.satisfacao) || null,
    } satisfies Family;
  });
}

// ─── Priority Leads (top 10 by lead_score) ─────────────────────────

export interface PriorityLead {
  id: string;
  name: string;
  lead_score: number;
  classification: "hot" | "warm" | "cold" | null;
  next_action: string | null;
  days_since_last_action: number;
  deal_stage: string | null;
}

function computeUrgencyScore(dataProximaAcao: string | null): number {
  if (!dataProximaAcao) return 0;
  const now = Date.now();
  const actionDate = new Date(dataProximaAcao).getTime();
  const diffMs = now - actionDate;
  if (diffMs <= 0) return 0;
  const overdueDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (overdueDays >= 7) return 100;
  if (overdueDays >= 3) return 60;
  if (overdueDays >= 1) return 30;
  return 0;
}

export async function fetchPriorityLeads(safra?: string): Promise<PriorityLead[]> {
  const supabase = await createServerSupabaseClient();

  const query = supabase
    .from("atletas")
    .select("id, nome_completo, lead_score, lead_classificacao, deals:deals(id, etapa, next_action, data_proxima_acao, probabilidade_fechamento, updated_at, safra, deleted_at)")
    .is("deleted_at", null)
    .not("lead_score", "is", null)
    .order("lead_score", { ascending: false })
    .limit(30);

  const { data } = await query;
  if (!data) return [];

  const now = Date.now();

  return data
    .map((a: Record<string, unknown>) => {
      const deals = (a.deals as Array<Record<string, unknown>>) || [];
      const activeDeals = deals.filter(
        (d) =>
          !d.deleted_at &&
          d.etapa !== "perdido" &&
          d.etapa !== "concluido" &&
          d.etapa !== "cancelamento_solicitado" &&
          (!safra || d.safra === safra)
      );
      const deal = activeDeals[0] || null;
      const lastActionDate = deal ? (deal.updated_at as string) : (a as Record<string, unknown>).updated_at as string;
      const daysSince = lastActionDate
        ? Math.floor((now - new Date(lastActionDate).getTime()) / (1000 * 60 * 60 * 24))
        : 0;

      const leadScore = Number(a.lead_score) || 0;
      const probabilidade = deal ? (Number(deal.probabilidade_fechamento) || 0) : 0;
      const urgencyScore = deal ? computeUrgencyScore(deal.data_proxima_acao as string | null) : 0;
      const compositeScore = (leadScore * 0.4) + (probabilidade * 0.3) + (urgencyScore * 0.3);

      return {
        id: a.id as string,
        name: a.nome_completo as string,
        lead_score: leadScore,
        classification: (a.lead_classificacao as PriorityLead["classification"]) || null,
        next_action: deal ? (deal.next_action as string | null) : null,
        days_since_last_action: daysSince,
        deal_stage: deal ? (deal.etapa as string) : null,
        _hasDeal: !!deal,
        _compositeScore: compositeScore,
      };
    })
    .filter((l: { _hasDeal: boolean }) => safra ? l._hasDeal : true)
    .sort((a: { _compositeScore: number }, b: { _compositeScore: number }) => b._compositeScore - a._compositeScore)
    .slice(0, 10)
    .map(({ _hasDeal, _compositeScore, ...rest }: { _hasDeal: boolean; _compositeScore: number } & PriorityLead) => rest);
}

// ─── Next Actions (upcoming tasks) ──────────────────────────────────

export interface UpcomingAction {
  id: string;
  athlete_name: string;
  next_action: string;
  date: string;
  is_overdue: boolean;
  deal_stage: string;
}

export async function fetchUpcomingActions(safra?: string): Promise<UpcomingAction[]> {
  const supabase = await createServerSupabaseClient();
  const threeDaysFromNow = daysFromNowISO(3).split("T")[0];

  let query = supabase
    .from("deals")
    .select("id, etapa, next_action, data_proxima_acao, safra, atleta:atletas(nome_completo)")
    .is("deleted_at", null)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado)")
    .not("data_proxima_acao", "is", null)
    .lte("data_proxima_acao", threeDaysFromNow)
    .order("data_proxima_acao", { ascending: true })
    .limit(30);

  if (safra) {
    query = query.eq("safra", safra);
  }

  const { data } = await query;
  if (!data) return [];

  const hoje = new Date().toISOString().split("T")[0];

  return (data as Array<Record<string, unknown>>)
    .slice(0, 15)
    .map((d) => {
      const atleta = d.atleta as Record<string, unknown> | null;
      const dateStr = d.data_proxima_acao as string;
      return {
        id: d.id as string,
        athlete_name: (atleta?.nome_completo as string) || "Atleta",
        next_action: (d.next_action as string) || "Sem descricao",
        date: dateStr,
        is_overdue: dateStr < hoje,
        deal_stage: d.etapa as string,
      };
    });
}

// ─── Financial Summary for War Room ─────────────────────────────────

export interface WarRoomFinancialSummary {
  receita_recebida_mes: number;
  inadimplencia: number;
  inadimplencia_count: number;
  nfs_pendentes: number;
  previsao_30d: number;
}

export async function fetchWarRoomFinancialSummary(): Promise<WarRoomFinancialSummary> {
  const supabase = await createServerSupabaseClient();
  const mesPrefix = mesAtualPrefix();
  const hoje = new Date().toISOString().split("T")[0];

  // Receita recebida no mes
  const { data: recebidas } = await supabase
    .from("parcelas")
    .select("valor")
    .eq("status", "recebido")
    .is("deleted_at", null)
    .gte("recebido_at", `${mesPrefix}-01`);
  const receitaMes = (recebidas || []).reduce((s, p) => s + Number(p.valor), 0);

  // Inadimplencia (parcelas previstas com vencimento passado)
  const { data: atrasadas } = await supabase
    .from("parcelas")
    .select("valor")
    .is("deleted_at", null)
    .in("status", ["atrasado"])
    .lt("vencimento", hoje);
  const inadimplencia = (atrasadas || []).reduce((s, p) => s + Number(p.valor), 0);

  // Also check previsto with past due date
  const { data: prevVencidas } = await supabase
    .from("parcelas")
    .select("valor")
    .is("deleted_at", null)
    .eq("status", "previsto")
    .lt("vencimento", hoje);
  const inadTotal = inadimplencia + (prevVencidas || []).reduce((s, p) => s + Number(p.valor), 0);
  const inadCount = (atrasadas || []).length + (prevVencidas || []).length;

  // NFs pendentes
  const { count: nfsPendentes } = await supabase
    .from("contratos_financeiros")
    .select("*", { count: "exact", head: true })
    .eq("nf_status", "pendente")
    .is("deleted_at", null);

  // Previsao 30d
  const proj30 = await fetchParcelasPrevist30d();

  return {
    receita_recebida_mes: receitaMes,
    inadimplencia: inadTotal,
    inadimplencia_count: inadCount,
    nfs_pendentes: nfsPendentes || 0,
    previsao_30d: proj30,
  };
}

// ─── Distinct Safras ─────────────────────────────────────────────────

export async function fetchDistinctSafras(): Promise<string[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("deals")
    .select("safra")
    .is("deleted_at", null)
    .not("safra", "is", null);

  if (!data) return [];

  const unique = [...new Set(data.map((d) => d.safra as string).filter(Boolean))];
  return unique.sort();
}

// ─── Cancellations for Financeiro ───────────────────────────────────

export interface CancellationDeal {
  id: string;
  athlete_name: string;
  valor_estimado: number;
  motivo_perda: string | null;
  detalhe_perda: string | null;
  pode_reativar: boolean;
  data_reativacao: string | null;
  updated_at: string;
  etapa: string;
}

export async function fetchCancellations(): Promise<CancellationDeal[]> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("deals")
    .select("id, etapa, valor_estimado, motivo_perda, detalhe_perda, pode_reativar, data_reativacao, updated_at, atleta:atletas(nome_completo)")
    .is("deleted_at", null)
    .in("etapa", ["cancelamento_solicitado", "perdido"])
    .order("updated_at", { ascending: false });

  if (!data) return [];

  return data.map((d: Record<string, unknown>) => {
    const atleta = d.atleta as Record<string, unknown> | null;
    return {
      id: d.id as string,
      athlete_name: (atleta?.nome_completo as string) || "Atleta",
      valor_estimado: Number(d.valor_estimado) || 0,
      motivo_perda: d.motivo_perda as string | null,
      detalhe_perda: d.detalhe_perda as string | null,
      pode_reativar: (d.pode_reativar as boolean) || false,
      data_reativacao: d.data_reativacao as string | null,
      updated_at: d.updated_at as string,
      etapa: d.etapa as string,
    };
  });
}

export async function fetchDealsWithoutNextAction(): Promise<Array<{ id: string; athlete_name: string; stage: DealStage }>> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("deals")
    .select("id, etapa, atleta:atletas(nome_completo)")
    .is("next_action", null)
    .is("deleted_at", null)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado)");

  return (data || []).map((d: Record<string, unknown>) => {
    const atleta = d.atleta as Record<string, unknown> | null;
    return {
      id: d.id as string,
      athlete_name: (atleta?.nome_completo as string) || "Atleta",
      stage: (d.etapa as DealStage),
    };
  });
}

// ─── Critical Alert Counts for War Room Banner ─────────────────────

export interface CriticalAlertCounts {
  dealsWithoutAction48h: number;
  overdueInstallments: number;
  familiesInCrisis: number;
  proposalsWithoutFollowup48h: number;
  docsUrgentes: number;
}

export async function fetchCriticalAlertCounts(): Promise<CriticalAlertCounts> {
  const supabase = await createServerSupabaseClient();
  const limit48h = daysAgoISO(2);
  const hoje = new Date().toISOString().split("T")[0];
  const in14Days = daysFromNowISO(14);

  // Deals sem next_action ha 48h+
  const { count: dealsNoAction } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .is("next_action", null)
    .is("deleted_at", null)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado)")
    .lt("updated_at", limit48h);

  // Parcelas atrasadas
  const { count: overdueCount } = await supabase
    .from("parcelas")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "atrasado");

  // Tambem contar previstas vencidas
  const { count: prevOverdueCount } = await supabase
    .from("parcelas")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "previsto")
    .lt("vencimento", hoje);

  // Familias em crise
  const { count: crisisCount } = await supabase
    .from("crm_experiencia")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("status", "crise");

  // Propostas sem follow-up ha 48h+
  const { count: proposalsNoFollowup } = await supabase
    .from("deals")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null)
    .eq("etapa", "proposta_enviada")
    .lt("updated_at", limit48h);

  // Documentos com deadline < 14 dias e nao aprovados
  const { count: docsUrgentesCount } = await supabase
    .from("documentos_atleta")
    .select("*", { count: "exact", head: true })
    .lt("deadline", in14Days)
    .neq("status", "aprovado")
    .is("deleted_at", null);

  return {
    dealsWithoutAction48h: dealsNoAction ?? 0,
    overdueInstallments: (overdueCount ?? 0) + (prevOverdueCount ?? 0),
    familiesInCrisis: crisisCount ?? 0,
    proposalsWithoutFollowup48h: proposalsNoFollowup ?? 0,
    docsUrgentes: docsUrgentesCount ?? 0,
  };
}
