import { type LeadClassification } from "./lead";

export type DealStage =
  | "lead"
  | "aguardando_timing"
  | "reuniao_marcada"
  | "reuniao_realizada"
  | "diagnostico_fit"
  | "alinhamento_estrategico"
  | "proposta_enviada"
  | "followup_proposta"
  | "negociacao"
  | "contrato_enviado"
  | "contrato_assinado"
  | "sinal_pago"
  | "admission_process"
  | "concluido"
  | "perdido"
  | "cancelamento_solicitado"
  | "projeto_futuro";

export type ProductTier = "Legacy" | "Journey" | "Start";

export interface Deal {
  id: string;
  lead_id?: string;
  atleta_id?: string;
  athlete_name: string;
  athlete_position?: string;
  guardian_name: string;
  guardian_profession?: string;
  investment_range: string;
  deal_value_brl: number;
  stage: DealStage;
  classification: LeadClassification;
  address_state?: string;
  created_at: string;
  stage_updated_at: string;
  closed_at?: string;
  consultant?: string;
  notes?: string;
  // Next action obrigatório
  next_action?: string;
  next_action_date?: string;
  // Posicionamento comercial
  product_tier?: ProductTier;
  has_discount?: boolean;
  discount_pct?: number;
  // Rastreamento financeiro (estágios pós-contrato)
  signal_value_brl?: number;
  remaining_value_brl?: number;
  contract_signed_at?: string;
  signal_paid_at?: string;
  enrollment_confirmed_at?: string;
  remaining_paid_at?: string;
  // Lead futuro
  is_future_lead?: boolean;
  future_project_year?: number;
  future_reactivation_date?: string;
  // Retrocesso
  flag_retrocedido?: boolean;
  motivo_retrocesso?: string;
  // Rastreamento de perda
  lost_reason?: string;
  lost_reason_category?: string;
  lost_detail?: string;
  can_reactivate?: boolean;
  reactivation_date?: string;
  // Gemini qualification
  qualificado_gemini?: boolean;
  classificacao_gemini?: string;
  motivo_gemini?: string;
  confianca_gemini?: string;
  qualificado_gemini_at?: string;
  // Lead Score
  lead_score?: number;
  // Reuniao
  reuniao_agendada_at?: string;
  reuniao_link?: string;
  reuniao_data?: string;
  // Sport details
  esporte?: string;
  serie_escolar?: string;
  nivel_ingles?: string;
  nivel_competitivo?: string;
  whatsapp?: string;
  // Extra athlete data
  instagram?: string;
  video_highlights_url?: string;
  escola_atual?: string;
  cidade_estado?: string;
  desempenho_academico?: string;
  // Communication timestamps
  whatsapp_sent_at?: string;
  followup_1_sent_at?: string;
  followup_2_sent_at?: string;
  submitted_at?: string;
  // Extra athlete fields
  historico_clubes?: string;
  conquistas?: string;
  data_nascimento?: string;
  email?: string;
  comprometimento?: string;
  decisao_familiar?: string;
  modelo_educacional?: string;
  momento_inicio?: string;
  guardian_email?: string;
  // Familia (siblings)
  siblings?: { id: string; nome: string; esporte?: string }[];
  // LGPD
  consentimento_lgpd?: boolean;
  aceite_whatsapp?: boolean;
  aceite_email?: boolean;
  consentimento_at?: string;
  // Responsavel (para filtro Meus/Todos)
  responsavel_id?: string;
  // Flag de valores customizados
  flag_valores_customizados?: boolean;
}

export interface DealStageConfig {
  id: DealStage;
  label: string;
  shortLabel: string;
  dotColor: string;
  isFinancial: boolean;
  isLost: boolean;
  order: number;
  /** Indica que o deal está aguardando timing (atleta muito jovem) e será reativado em novembro do ano civil seguinte. */
  isWaitingTiming?: boolean;
}

export const DEAL_STAGE_CONFIG: Record<DealStage, DealStageConfig> = {
  lead: {
    id: "lead",
    label: "Lead",
    shortLabel: "Lead",
    dotColor: "bg-muted-foreground",
    isFinancial: false,
    isLost: false,
    order: 0,
  },
  aguardando_timing: {
    id: "aguardando_timing",
    label: "Aguardando Timing",
    shortLabel: "Timing",
    dotColor: "bg-plan-legacy",
    isFinancial: false,
    isLost: false,
    order: 0.5,
    isWaitingTiming: true,
  },
  reuniao_marcada: {
    id: "reuniao_marcada",
    label: "Reunião Marcada",
    shortLabel: "Réu. Marcada",
    dotColor: "bg-sys-blue",
    isFinancial: false,
    isLost: false,
    order: 1,
  },
  reuniao_realizada: {
    id: "reuniao_realizada",
    label: "Reunião Realizada",
    shortLabel: "Reunião",
    dotColor: "bg-primary",
    isFinancial: false,
    isLost: false,
    order: 2,
  },
  diagnostico_fit: {
    id: "diagnostico_fit",
    label: "Diagnóstico / Fit Confirmado",
    shortLabel: "Diagnóstico",
    dotColor: "bg-plan-journey",
    isFinancial: false,
    isLost: false,
    order: 3,
  },
  alinhamento_estrategico: {
    id: "alinhamento_estrategico",
    label: "Alinhamento Estratégico",
    shortLabel: "Alinhamento",
    dotColor: "bg-sys-purple",
    isFinancial: false,
    isLost: false,
    order: 4,
  },
  proposta_enviada: {
    id: "proposta_enviada",
    label: "Proposta Enviada",
    shortLabel: "Proposta",
    dotColor: "bg-sys-blue",
    isFinancial: false,
    isLost: false,
    order: 5,
  },
  followup_proposta: {
    id: "followup_proposta",
    label: "Follow-up Proposta",
    shortLabel: "Follow-up",
    dotColor: "bg-sys-teal",
    isFinancial: false,
    isLost: false,
    order: 6,
  },
  negociacao: {
    id: "negociacao",
    label: "Negociação",
    shortLabel: "Negoc.",
    dotColor: "bg-sys-orange",
    isFinancial: false,
    isLost: false,
    order: 7,
  },
  contrato_enviado: {
    id: "contrato_enviado",
    label: "Contrato Enviado",
    shortLabel: "Ctr. Enviado",
    dotColor: "bg-sys-orange",
    isFinancial: false,
    isLost: false,
    order: 8,
  },
  contrato_assinado: {
    id: "contrato_assinado",
    label: "Contrato Assinado",
    shortLabel: "Contrato",
    dotColor: "bg-plan-journey",
    isFinancial: true,
    isLost: false,
    order: 9,
  },
  sinal_pago: {
    id: "sinal_pago",
    label: "Sinal Pago",
    shortLabel: "Sinal",
    dotColor: "bg-sys-mint",
    isFinancial: true,
    isLost: false,
    order: 10,
  },
  admission_process: {
    id: "admission_process",
    label: "Admission Process",
    shortLabel: "Admission",
    dotColor: "bg-sys-green",
    isFinancial: true,
    isLost: false,
    order: 11,
  },
  concluido: {
    id: "concluido",
    label: "Concluído ✓",
    shortLabel: "Concluído",
    dotColor: "bg-sys-green",
    isFinancial: true,
    isLost: false,
    order: 12,
  },
  perdido: {
    id: "perdido",
    label: "Perdido",
    shortLabel: "Perdido",
    dotColor: "bg-destructive",
    isFinancial: false,
    isLost: true,
    order: 13,
  },
  cancelamento_solicitado: {
    id: "cancelamento_solicitado",
    label: "Cancelamento Solicitado",
    shortLabel: "Cancelam.",
    dotColor: "bg-sys-red",
    isFinancial: false,
    isLost: true,
    order: 14,
  },
  projeto_futuro: {
    id: "projeto_futuro",
    label: "Projeto Futuro",
    shortLabel: "Futuro",
    dotColor: "bg-sys-teal",
    isFinancial: false,
    isLost: false,
    order: 15,
  },
};

export const PIPELINE_STAGE_ORDER: DealStage[] = [
  "lead",
  "aguardando_timing",
  "reuniao_marcada",
  "reuniao_realizada",
  "diagnostico_fit",
  "alinhamento_estrategico",
  "proposta_enviada",
  "followup_proposta",
  "negociacao",
  "contrato_enviado",
  "contrato_assinado",
  "sinal_pago",
  "admission_process",
  "concluido",
  "perdido",
];

export const PRODUCT_TIER_STYLES: Record<ProductTier, { badge: string }> = {
  Legacy: { badge: "bg-plan-legacy/15 text-plan-legacy border border-plan-legacy/20" },
  Journey: { badge: "bg-plan-journey/15 text-plan-journey border border-plan-journey/20" },
  Start: { badge: "bg-secondary text-muted-foreground border border-border" },
};
