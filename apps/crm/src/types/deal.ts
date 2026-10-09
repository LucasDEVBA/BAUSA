import { type LeadClassification } from "./lead";

export type DealStage =
  | "contato_feito"
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
  // Etapa própria pós-sinal (2026-10, T2): antes era só um rótulo sobre
  // 'negociacao' (pré-venda) e o board marcava retrocesso falso.
  | "plano_escolhido"
  | "admission_process"
  | "concluido"
  | "perdido"
  | "cancelamento_solicitado"
  | "projeto_futuro"
  // Slots de coluna personalizada (o CEO "cria" uma coluna nomeando um slot
  // livre em etapas_deal_config — o enum PG tem os mesmos 6 valores fixos).
  | "custom_1"
  | "custom_2"
  | "custom_3"
  | "custom_4"
  | "custom_5"
  | "custom_6";

/** Timing do lead (form_submissions.timing_status) — exibido como badge no card. */
export type DealTimingStatus = "ideal" | "muito_cedo" | "tarde_demais";

export type ProductTier = "Legacy" | "Journey" | "Start" | "Personalizado";

/**
 * De onde vem o `deal_value_brl` exibido (T3, 2026-10-08) — precedência
 * calculada NA LEITURA por lib/valor-deal.ts:
 *   contratado = contratos_financeiros.valor_total (contrato vigente com plano)
 *   negociado  = deals.valor_estimado com flag_valores_customizados (CEO, com justificativa)
 *   estimado   = deals.valor_estimado automático (faixa de investimento do formulário)
 */
export type OrigemValorDeal = "contratado" | "negociado" | "estimado";

export interface Deal {
  id: string;
  lead_id?: string;
  atleta_id?: string;
  athlete_name: string;
  athlete_position?: string;
  guardian_name: string;
  guardian_profession?: string;
  investment_range: string;
  /** Valor EXIBIDO e somado em todo o Engine: contrato > negociado > estimado
   *  (lib/valor-deal.ts). Nunca é gravado — derivado na leitura. */
  deal_value_brl: number;
  /** Origem de `deal_value_brl` — controla o "≈ … · estimado" e o destino do
   *  clique no valor (modal de customização × aba do contrato). */
  valor_origem?: OrigemValorDeal;
  /** deals.valor_estimado cru (estimativa da faixa OU valor negociado). */
  valor_estimado_brl?: number;
  /** Justificativa da customização do valor (deals.justificativa_customizacao). */
  justificativa_valor?: string;
  /** contratos_financeiros.id vigente (mesmo "aguardando plano"). */
  contrato_id?: string;
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
  /** Etapa em que a próxima ação atual foi gravada (deals.next_action_etapa);
   *  ausente em ações legadas (antes de 2026-10). */
  next_action_etapa?: string;
  /** true = escrita à mão pelo CEO (deals.next_action_manual_em preenchido). */
  next_action_manual?: boolean;
  // Posicionamento comercial
  product_tier?: ProductTier;
  has_discount?: boolean;
  discount_pct?: number;
  // Rastreamento financeiro (estágios pós-contrato)
  signal_value_brl?: number;
  remaining_value_brl?: number;
  contract_signed_at?: string;
  signal_paid_at?: string;
  /** Prova de pagamento do sinal (deals.sinal_pago_confirmado_por) — só as RPCs fin_* gravam.
   *  false com signal_paid_at = card ARRASTADO para Sinal pago sem registro (T11). */
  signal_confirmed?: boolean;
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
  // Classificador v2 (form_submissions, migration 20260825120000) — ausentes
  // em leads pré-v2; a exibição degrada
  score_financeiro?: number | null;
  tier_profissao?: string | null;
  sinais_reforco?: string[] | null;
  sinais_alerta?: string[] | null;
  /** Potencial ESPORTIVO (ALTA/MEDIA/PADRAO) — eixo independente do score
   *  financeiro e distinto de `prioridade_engajamento` (P1/P2). */
  prioridade_estrategica?: string | null;
  acao_recomendada?: string | null;
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
  /** Timing do lead (form_submissions) — badge no card desde 2026-08-11,
   *  quando a coluna aguardando_timing saiu do board. */
  timing_status?: DealTimingStatus | string;
  /** form_submissions.id — abre o dossiê completo (modal de revisão) a partir
   *  do card; ausente em deals de prospecção manual (sem formulário). */
  form_submission_id?: string;
  /** Prioridade interna P1/P2 por ENGAJAMENTO (camada de exibição, calculada
   *  na page via lib/prioridade-engajamento — não substitui a classe Gemini).
   *  União inline p/ não acoplar a camada de types à lib server-side. */
  prioridade_engajamento?: { nivel: "P1" | "P2"; pontos: number; motivos: string[] } | null;
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
  /** Slot de coluna personalizada: oculto por padrão até o CEO nomeá-lo. */
  isCustomSlot?: boolean;
  /** Etapa nova que nasce OCULTA até a config torná-la visível (plano_escolhido
   *  até a migration de dados *_plano_escolhido_coluna_board). Espelhado no SQL
   *  (ordem_etapa_board) — mudar aqui exige mudar lá. */
  ocultaPorPadrao?: boolean;
  /** Soltar card sem plano nesta coluna abre a escolha de plano (default da
   *  regra pede_plano de etapas_deal_regras). */
  pedePlanoPorPadrao?: boolean;
}

export const DEAL_STAGE_CONFIG: Record<DealStage, DealStageConfig> = {
  // Prospecção ativa (fora do formulário). O rótulo/ordem visíveis vêm de
  // etapas_deal_config — aqui ficam só os defaults e as flags de negócio.
  contato_feito: {
    id: "contato_feito",
    label: "Contato feito",
    shortLabel: "Contato",
    dotColor: "bg-sys-blue",
    isFinancial: false,
    isLost: false,
    order: -1,
  },
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
  // GANHO pós-sinal: a família escolhe Start/Journey/Legacy/Personalizado.
  // Nasce oculta (ocultaPorPadrao) até a migration de dados 124400 levar o
  // rótulo "Plano escolhido" de 'negociacao' para cá — ver rollout no PR.
  plano_escolhido: {
    id: "plano_escolhido",
    label: "Plano escolhido",
    shortLabel: "Plano",
    dotColor: "bg-sys-orange",
    isFinancial: true,
    isLost: false,
    order: 10.5,
    ocultaPorPadrao: true,
    pedePlanoPorPadrao: true,
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
  // Slots de coluna personalizada: nascem OCULTOS (isCustomSlot) e sem
  // semântica de funil — o CEO os ativa nomeando em etapas_deal_config
  // ("Nova coluna" no board). Ordem alta (21+) os deixa no fim por padrão.
  custom_1: customSlot(1),
  custom_2: customSlot(2),
  custom_3: customSlot(3),
  custom_4: customSlot(4),
  custom_5: customSlot(5),
  custom_6: customSlot(6),
};

function customSlot(i: number): DealStageConfig {
  return {
    id: `custom_${i}` as DealStage,
    label: `Coluna personalizada ${i}`,
    shortLabel: `Coluna ${i}`,
    dotColor: "bg-muted-foreground",
    isFinancial: false,
    isLost: false,
    order: 20 + i,
    isCustomSlot: true,
  };
}

export const PIPELINE_STAGE_ORDER: DealStage[] = [
  "contato_feito",
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
  "plano_escolhido",
  "admission_process",
  "concluido",
  "perdido",
  // Slots custom entram no conjunto do board; ocultos e vazios são
  // invisíveis (regra existente: coluna oculta some quando esvazia).
  "custom_1",
  "custom_2",
  "custom_3",
  "custom_4",
  "custom_5",
  "custom_6",
];

export const PRODUCT_TIER_STYLES: Record<ProductTier, { badge: string }> = {
  Legacy: { badge: "bg-plan-legacy/15 text-plan-legacy border border-plan-legacy/20" },
  Journey: { badge: "bg-plan-journey/15 text-plan-journey border border-plan-journey/20" },
  Start: { badge: "bg-secondary text-muted-foreground border border-border" },
  Personalizado: { badge: "bg-sys-purple/12 text-sys-purple border border-sys-purple/20" },
};
