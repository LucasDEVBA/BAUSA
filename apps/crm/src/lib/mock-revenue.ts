import {
  type RevenueMonth,
  type WarRoomMetrics,
  type Alert,
  type Bottleneck,
  type ConversionFunnelStep,
  type PipelineStageMetrics,
  type MetaRevenueMetrics,
  type CommercialFunnelMetrics,
  type CashFlowMetrics,
  type RevenueAtRiskMetrics,
  type PositioningMetrics,
  type FamilyExperienceMetrics,
} from "@/types/revenue";

// Valores em R$ (BRL) — Meta anual R$ 1.5M | Meta mensal R$ 125k
export const MOCK_REVENUE_MONTHS: RevenueMonth[] = [
  { month: 4, year: 2025, month_label: "Abr/25", contracted_usd: 78000, received_usd: 68000, projected_usd: 0, families_signed: 3 },
  { month: 5, year: 2025, month_label: "Mai/25", contracted_usd: 104000, received_usd: 92000, projected_usd: 0, families_signed: 4 },
  { month: 6, year: 2025, month_label: "Jun/25", contracted_usd: 96000, received_usd: 88000, projected_usd: 0, families_signed: 4 },
  { month: 7, year: 2025, month_label: "Jul/25", contracted_usd: 138000, received_usd: 125000, projected_usd: 0, families_signed: 5 },
  { month: 8, year: 2025, month_label: "Ago/25", contracted_usd: 115000, received_usd: 110000, projected_usd: 0, families_signed: 5 },
  { month: 9, year: 2025, month_label: "Set/25", contracted_usd: 88000, received_usd: 80000, projected_usd: 0, families_signed: 3 },
  { month: 10, year: 2025, month_label: "Out/25", contracted_usd: 156000, received_usd: 142000, projected_usd: 0, families_signed: 6 },
  { month: 11, year: 2025, month_label: "Nov/25", contracted_usd: 92000, received_usd: 78000, projected_usd: 0, families_signed: 4 },
  { month: 12, year: 2025, month_label: "Dez/25", contracted_usd: 120000, received_usd: 108000, projected_usd: 0, families_signed: 5 },
  { month: 1, year: 2026, month_label: "Jan/26", contracted_usd: 130000, received_usd: 115000, projected_usd: 15000, families_signed: 5 },
  { month: 2, year: 2026, month_label: "Fev/26", contracted_usd: 148000, received_usd: 125000, projected_usd: 23000, families_signed: 6 },
  { month: 3, year: 2026, month_label: "Mar/26", contracted_usd: 110000, received_usd: 67000, projected_usd: 43000, families_signed: 4 },
];

// BAUSA: Meta anual R$ 1.5M | Meta mensal R$ 125k | Ticket médio R$ 23k | 6 contratos/mês
export const MOCK_WAR_ROOM_METRICS: WarRoomMetrics = {
  mrr_usd: 67000,      // Receita recebida mês atual (BRL)
  mrr_trend_pct: 8.3,
  arr_usd: 1200000,    // Projeção anual (BRL)
  pipeline_total_usd: 386000,  // Pipeline ativo (BRL)
  avg_ticket_usd: 23000,       // Ticket médio pix (BRL)
  conversion_rate: 42,
  active_families: 6,
  at_risk_families: 2,
  nps_average: 8.2,
  leads_this_month: 18,
  closed_this_month: 4,
  revenue_ytd_usd: 307000,     // Receita YTD 2026 (BRL)
};

export const MOCK_PIPELINE_STAGE_METRICS: PipelineStageMetrics[] = [
  { stage: "lead", count: 2, total_value_usd: 50000 },
  { stage: "reuniao_marcada", count: 1, total_value_usd: 26000 },
  { stage: "reuniao_realizada", count: 1, total_value_usd: 32000 },
  { stage: "diagnostico_fit", count: 1, total_value_usd: 26000 },
  { stage: "alinhamento_estrategico", count: 1, total_value_usd: 32000 },
  { stage: "proposta_enviada", count: 2, total_value_usd: 58000 },
  { stage: "followup_proposta", count: 1, total_value_usd: 26000 },
  { stage: "negociacao", count: 1, total_value_usd: 26000 },
  { stage: "contrato_enviado", count: 1, total_value_usd: 32000 },
  { stage: "contrato_assinado", count: 2, total_value_usd: 58000 },
  { stage: "sinal_pago", count: 1, total_value_usd: 32000 },
  { stage: "admission_process", count: 1, total_value_usd: 32000 },
  { stage: "concluido", count: 2, total_value_usd: 52000 },
  { stage: "perdido", count: 2, total_value_usd: 36000 },
];

export const MOCK_CONVERSION_FUNNEL: ConversionFunnelStep[] = [
  { label: "Leads Captados", value: 45, fill: "#6366f1" },
  { label: "Qualificados", value: 31, fill: "#818cf8" },
  { label: "Reuniões", value: 18, fill: "#a5b4fc" },
  { label: "Propostas", value: 12, fill: "#c7d2fe" },
  { label: "Contratos", value: 9, fill: "#10b981" },
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: "a1",
    type: "critical",
    title: "Visto negado — nova tentativa amanhã",
    description: "Gustavo Lopes (UTSA) teve o primeiro visto negado. Entrevista consular remarcada para amanhã. Família em estado de estresse elevado.",
    action_label: "Ver caso",
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "a2",
    type: "critical",
    title: "Família sem contato há 12 dias",
    description: "Gustavo Lopes não recebe check-in há 12 dias. Prazo de matrícula vence em 30 dias.",
    action_label: "Ligar agora",
    created_at: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "a3",
    type: "warning",
    title: "Dificuldade de adaptação cultural",
    description: "Matheus Costa (South Carolina) chegou há 2 semanas e está com saudade de casa. Próximo check-in agendado para em 4 dias.",
    action_label: "Agendar call",
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "a4",
    type: "warning",
    title: "Sem contato há 8 dias — Onboarding",
    description: "Bruno Carvalho Neto (UCF) está em onboarding mas sem check-in há 8 dias. Pai é militar e muito criterioso.",
    action_label: "Agendar check-in",
    created_at: new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "a5",
    type: "info",
    title: "3 marcos esta semana",
    description: "Rafael Mendes precisa enviar vídeo de highlights em 3 dias. Gustavo Lopes tem entrevista consular amanhã. Lucas Andrade inicia processo de visto em 5 dias.",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const MOCK_BOTTLENECKS: Bottleneck[] = [
  {
    id: "b1",
    title: "Pipeline parado na etapa de Proposta Enviada",
    description: "2 deals totalizando US$ 55.000 estão na etapa de Proposta Enviada há mais de 15 dias sem movimentação.",
    impact: "alto",
    suggestion: "Agendar follow-up direto com os responsáveis. Verificar se há objeções de preço não mapeadas.",
  },
  {
    id: "b2",
    title: "Taxa de conversão abaixo do target",
    description: "Conversão atual de 38% contra target de 50%. Perda concentrada na transição Reunião → Proposta.",
    impact: "alto",
    suggestion: "Revisar o roteiro de reunião e incluir cases de sucesso. Analisar objeções mais comuns nesta etapa.",
  },
  {
    id: "b3",
    title: "Risco de evasão pós-contrato (1 família crítica)",
    description: "Família Lopes em risco alto com NPS 5 e visto em jogo. Risco de churn impacta receita e reputação.",
    impact: "medio",
    suggestion: "Acionar protocolo de crise imediatamente. Contato diário até resolução do visto.",
  },
];

// ─── War Room: métricas detalhadas por seção ──────────────────────────────────

// Meta mensal BAUSA: R$ 125k | 6 contratos/mês
export const MOCK_META_REVENUE: MetaRevenueMetrics = {
  net_revenue_month_usd: 67000,    // Receita recebida mês atual (BRL)
  monthly_target_usd: 125000,      // Meta mensal BAUSA (BRL)
  projected_revenue_usd: 110000,   // Projeção até fim do mês (BRL)
  gap_to_target_usd: -15000,       // Gap (negativo = abaixo da meta)
};

export const MOCK_COMMERCIAL_FUNNEL: CommercialFunnelMetrics = {
  leads_qualified: 14,
  meetings_done: 9,
  proposals_sent: 6,
  contracts_signed: 4,
  signals_paid: 3,
  auto_conversions: 1,
};

export const MOCK_CASH_FLOW: CashFlowMetrics = {
  net_received_usd: 91000,
  projected_30d_usd: 63000,
  projected_90d_usd: 198000,
};

export const MOCK_REVENUE_AT_RISK: RevenueAtRiskMetrics = {
  contracts_without_signature_count: 2,
  contracts_without_signature_usd: 115000,
  unpaid_signals_count: 2,
  unpaid_signals_usd: 40250,
  pending_remaining_count: 2,
  pending_remaining_usd: 94250,
  overdue_receivables_usd: 28000,
};

export const MOCK_POSITIONING: PositioningMetrics = {
  pct_legacy: 45,
  pct_journey: 38,
  pct_start: 17,
  avg_ticket_usd: 49500,
  pct_discounted: 22,
};

export const MOCK_FAMILY_EXPERIENCE: FamilyExperienceMetrics = {
  active_families: 6,
  at_risk_families: 1,
  satisfied_families: 4,
  open_crises: 1,
  referral_potential: 3,
};
