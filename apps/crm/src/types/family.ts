// Jornada conforme spec Bolsa Atleta USA
export type FamilyJourneyStage =
  | "envio_opcoes"
  | "admissao"
  | "aprovado"
  | "pagamento_remanescente"
  | "pre_embarque"
  | "embarcado_inicial"
  | "acompanhamento"
  | "encerrado";

export const FAMILY_JOURNEY_STAGES: FamilyJourneyStage[] = [
  "envio_opcoes",
  "admissao",
  "aprovado",
  "pagamento_remanescente",
  "pre_embarque",
  "embarcado_inicial",
  "acompanhamento",
  "encerrado",
];

export type FamilyStatus = "satisfeita" | "atencao" | "crise";

// Temperatura visual (Verde/Amarelo/Vermelho)
export type FamilyTemperature = "verde" | "amarelo" | "vermelho";

export type RiskDimension =
  | "academico"
  | "esportivo"
  | "emocional"
  | "financeiro"
  | "relacional"
  | "comunicacao";

export interface FamilyRiskProfile {
  dimension: RiskDimension;
  score: number; // 1-5
  notes?: string;
}

export interface CrisisRecord {
  id: string;
  description: string;
  crisis_type: string;
  crisis_level: 1 | 2 | 3 | 4 | 5;
  action_taken: string;
  psychologist_activated: boolean;
  recorded_at: string;
}

export interface AttentionRecord {
  id: string;
  problem_description: string;
  action_ongoing: string;
  next_action: string;
  recorded_at: string;
}

export interface Family {
  id: string;
  atleta_id?: string;
  athlete_name: string;
  athlete_position?: string;
  guardian_name: string;
  email: string;
  whatsapp: string;
  plan: "Journey" | "Legacy" | "Start";
  journey_stage: FamilyJourneyStage;
  family_status: FamilyStatus;
  temperature: FamilyTemperature;

  // Indicadores de experiência (1-5)
  anxiety_level: number;
  satisfaction_level: number;
  perceived_risk: number;

  // Perfil de risco por dimensão (opcional — só quando derivável de dados reais)
  risk_profile?: FamilyRiskProfile[];

  // Controle de contato
  last_contact_at: string;
  last_contact_type: "whatsapp" | "ligacao" | "reuniao" | "email";
  next_contact_date: string;
  days_without_contact: number; // calculado

  // Dados do contrato
  contract_value_brl: number;
  contracted_at: string;
  expected_departure_date?: string;
  embarked_at?: string;

  // Escola alvo
  target_school?: string;
  target_sport?: string;
  address_state?: string;

  // ─── Campos de compatibilidade (componentes /families legado) ───────────
  risk_level?: RiskLevel;
  emotional_temperature?: EmotionalTemperature;
  nps_score?: number | null;
  alerts?: string[];
  target_university?: string;
  contract_value_usd?: number;

  // Histórico de ocorrências
  attention_records: AttentionRecord[];
  crisis_records: CrisisRecord[];

  // Campos de crise detalhados
  tipo_crise?: string | null;
  nivel_crise?: string | null;
  psicologa_acionada?: boolean;
  psicologa_acionada_at?: string | null;

  // Indicadores pos-embarque
  retencao_segundo_ano?: boolean | null;
  nps_6meses?: number | null;
  nps_enviado_at?: string | null;
  indicacoes_geradas?: number;

  // Processo admissao
  escola_confirmada_id?: string | null;

  // Milestone (opcional — derivado da próxima etapa do onboarding, quando existe)
  next_milestone?: string;
  next_milestone_date?: string;
  consultant?: string;
  consultant_notes?: string;
}

export interface FamilyJourneyStageConfig {
  id: FamilyJourneyStage;
  label: string;
  description: string;
  order: number;
  alertDays: number; // Dias sem contato que geram alerta
}

export const JOURNEY_STAGE_CONFIG: Record<FamilyJourneyStage, FamilyJourneyStageConfig> = {
  // Rótulos/ordem visíveis vêm de fases_familia_config (editáveis pelo CEO);
  // aqui ficam os defaults do processo definido em 2026-08-11.
  envio_opcoes: {
    id: "envio_opcoes",
    label: "Envio de opções",
    description: "Shortlist de escolas enviada à família",
    order: 0,
    alertDays: 7,
  },
  admissao: {
    id: "admissao",
    label: "Application em andamento",
    description: "Aplicações submetidas às escolas",
    order: 1,
    alertDays: 7,
  },
  aprovado: {
    id: "aprovado",
    label: "Aceito + I-20",
    description: "Aceite recebido e I-20 emitido",
    order: 2,
    alertDays: 7,
  },
  pagamento_remanescente: {
    id: "pagamento_remanescente",
    label: "Pagamento remanescente",
    description: "Saldo do contrato em liquidação",
    order: 3,
    alertDays: 10,
  },
  pre_embarque: {
    id: "pre_embarque",
    label: "Visto",
    description: "Entrevista, visto e preparação final",
    order: 4,
    alertDays: 15,
  },
  embarcado_inicial: {
    id: "embarcado_inicial",
    label: "Embarcado (0–90 dias)",
    description: "Primeiros 90 dias nos EUA",
    order: 5,
    alertDays: 7,
  },
  acompanhamento: {
    id: "acompanhamento",
    label: "Acompanhamento Contínuo",
    description: "Suporte ao longo da jornada",
    order: 6,
    alertDays: 30,
  },
  encerrado: {
    id: "encerrado",
    label: "Encerrado",
    description: "Jornada concluída",
    order: 7,
    alertDays: 0,
  },
};

export const FAMILY_STATUS_CONFIG: Record<FamilyStatus, { label: string; color: string; bg: string; dot: string }> = {
  satisfeita: {
    label: "Satisfeita",
    color: "text-sys-green",
    bg: "bg-sys-green/15 border-sys-green/20",
    dot: "bg-sys-green",
  },
  atencao: {
    label: "Atenção",
    color: "text-sys-orange",
    bg: "bg-sys-orange/15 border-sys-orange/20",
    dot: "bg-sys-orange",
  },
  crise: {
    label: "Crise",
    color: "text-sys-red",
    bg: "bg-sys-red/15 border-sys-red/20",
    dot: "bg-sys-red",
  },
};

export const TEMPERATURE_CONFIG: Record<FamilyTemperature, { label: string; color: string; bg: string; icon: string }> = {
  verde: { label: "Verde", color: "text-sys-green", bg: "bg-sys-green/15", icon: "🟢" },
  amarelo: { label: "Amarelo", color: "text-sys-orange", bg: "bg-sys-orange/15", icon: "🟡" },
  vermelho: { label: "Vermelho", color: "text-sys-red", bg: "bg-sys-red/15", icon: "🔴" },
};

export const RISK_DIMENSION_LABELS: Record<RiskDimension, string> = {
  academico: "Acadêmico",
  esportivo: "Esportivo",
  emocional: "Emocional",
  financeiro: "Financeiro",
  relacional: "Relacional",
  comunicacao: "Comunicação",
};

// ─── Aliases de backward compatibility (componentes legados /families) ────────
export type RiskLevel = "baixo" | "medio" | "alto" | "critico";
export type EmotionalTemperature = "otimo" | "bem" | "atento" | "preocupante";

export const RISK_LEVEL_CONFIG: Record<RiskLevel, { label: string; color: string; bgColor: string; dotColor: string }> = {
  baixo: { label: "Baixo", color: "text-sys-green", bgColor: "bg-sys-green/15 border-sys-green/20", dotColor: "bg-sys-green" },
  medio: { label: "Médio", color: "text-sys-orange", bgColor: "bg-sys-orange/15 border-sys-orange/20", dotColor: "bg-sys-orange" },
  alto: { label: "Alto", color: "text-sys-orange", bgColor: "bg-sys-orange/15 border-sys-orange/20", dotColor: "bg-sys-orange" },
  critico: { label: "Crítico", color: "text-sys-red", bgColor: "bg-sys-red/15 border-sys-red/20", dotColor: "bg-sys-red" },
};

export const EMOTIONAL_TEMP_CONFIG: Record<EmotionalTemperature, { label: string; emoji: string; color: string; bgColor: string }> = {
  otimo: { label: "Ótimo", emoji: "😊", color: "text-sys-green", bgColor: "bg-sys-green/15" },
  bem: { label: "Bem", emoji: "🙂", color: "text-sys-blue", bgColor: "bg-sys-blue/15" },
  atento: { label: "Atenção", emoji: "😐", color: "text-sys-orange", bgColor: "bg-sys-orange/15" },
  preocupante: { label: "Preocupante", emoji: "😟", color: "text-sys-red", bgColor: "bg-sys-red/15" },
};
