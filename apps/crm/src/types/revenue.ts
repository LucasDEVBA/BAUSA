import { type DealStage } from "./deal";

// ─── War Room: seções detalhadas ─────────────────────────────────────────────

export interface MetaRevenueMetrics {
  net_revenue_month_brl: number;
  monthly_target_brl: number;
  projected_revenue_brl: number;
  gap_to_target_brl: number;
}

export interface CommercialFunnelMetrics {
  leads_qualified: number;
  meetings_done: number;
  proposals_sent: number;
  contracts_signed: number;
  signals_paid: number;
  auto_conversions: number;
}

export interface CashFlowMetrics {
  net_received_brl: number;
  projected_30d_brl: number;
  projected_90d_brl: number;
}

export interface RevenueAtRiskMetrics {
  contracts_without_signature_count: number;
  contracts_without_signature_brl: number;
  unpaid_signals_count: number;
  unpaid_signals_brl: number;
  pending_remaining_count: number;
  pending_remaining_brl: number;
  overdue_receivables_brl: number;
}

export interface PositioningMetrics {
  pct_legacy: number;
  pct_journey: number;
  pct_start: number;
  avg_ticket_brl: number;
  pct_discounted: number;
}

export interface FamilyExperienceMetrics {
  active_families: number;
  at_risk_families: number;
  satisfied_families: number;
  open_crises: number;
  referral_potential: number;
}

// ─── Existentes ──────────────────────────────────────────────────────────────

export interface RevenueMonth {
  month: number;
  year: number;
  month_label: string;
  contracted_brl: number;
  received_brl: number;
  projected_brl: number;
  families_signed: number;
}

export interface PipelineStageMetrics {
  stage: DealStage;
  count: number;
  total_value_brl: number;
}

export interface ConversionFunnelStep {
  label: string;
  value: number;
  fill: string;
}

export interface WarRoomMetrics {
  mrr_brl: number;
  mrr_trend_pct: number;
  arr_brl: number;
  pipeline_total_brl: number;
  avg_ticket_brl: number;
  conversion_rate: number;
  active_families: number;
  at_risk_families: number;
  nps_average: number;
  nps_respondentes: number;
  next_action_compliance_pct: number;
  active_deals_count: number;
  leads_this_month: number;
  closed_this_month: number;
  revenue_ytd_brl: number;
}

export interface Alert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
  action_label?: string;
  created_at: string;
}

export interface Bottleneck {
  id: string;
  title: string;
  description: string;
  impact: "alto" | "medio";
  suggestion: string;
}
