// Jornada conforme spec Bolsa Atleta USA
export type FamilyJourneyStage =
  | "admissao"
  | "aprovado"
  | "pre_embarque"
  | "embarcado_inicial"
  | "acompanhamento"
  | "encerrado";

export const FAMILY_JOURNEY_STAGES: FamilyJourneyStage[] = [
  "admissao",
  "aprovado",
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

  // Perfil de risco por dimensão
  risk_profile: FamilyRiskProfile[];

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

  // Milestone
  next_milestone: string;
  next_milestone_date: string;
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
  admissao: {
    id: "admissao",
    label: "Admissão",
    description: "Processo de aplicação às escolas",
    order: 0,
    alertDays: 7,
  },
  aprovado: {
    id: "aprovado",
    label: "Aprovado",
    description: "Aceite recebido pela escola",
    order: 1,
    alertDays: 7,
  },
  pre_embarque: {
    id: "pre_embarque",
    label: "Pré-embarque",
    description: "Visto, documentos e preparação final",
    order: 2,
    alertDays: 15,
  },
  embarcado_inicial: {
    id: "embarcado_inicial",
    label: "Embarcado (0–90 dias)",
    description: "Primeiros 90 dias nos EUA",
    order: 3,
    alertDays: 7,
  },
  acompanhamento: {
    id: "acompanhamento",
    label: "Acompanhamento Contínuo",
    description: "Suporte ao longo da jornada",
    order: 4,
    alertDays: 30,
  },
  encerrado: {
    id: "encerrado",
    label: "Encerrado",
    description: "Jornada concluída",
    order: 5,
    alertDays: 0,
  },
};

export const FAMILY_STATUS_CONFIG: Record<FamilyStatus, { label: string; color: string; bg: string; dot: string }> = {
  satisfeita: {
    label: "Satisfeita",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10 border-emerald-500/20",
    dot: "bg-emerald-400",
  },
  atencao: {
    label: "Atenção",
    color: "text-amber-400",
    bg: "bg-amber-500/10 border-amber-500/20",
    dot: "bg-amber-400",
  },
  crise: {
    label: "Crise",
    color: "text-red-400",
    bg: "bg-red-500/10 border-red-500/20",
    dot: "bg-red-400",
  },
};

export const TEMPERATURE_CONFIG: Record<FamilyTemperature, { label: string; color: string; bg: string; icon: string }> = {
  verde: { label: "Verde", color: "text-emerald-400", bg: "bg-emerald-500/10", icon: "🟢" },
  amarelo: { label: "Amarelo", color: "text-amber-400", bg: "bg-amber-500/10", icon: "🟡" },
  vermelho: { label: "Vermelho", color: "text-red-400", bg: "bg-red-500/10", icon: "🔴" },
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
  baixo: { label: "Baixo", color: "text-emerald-400", bgColor: "bg-emerald-500/10 border-emerald-500/20", dotColor: "bg-emerald-400" },
  medio: { label: "Médio", color: "text-amber-400", bgColor: "bg-amber-500/10 border-amber-500/20", dotColor: "bg-amber-400" },
  alto: { label: "Alto", color: "text-orange-400", bgColor: "bg-orange-500/10 border-orange-500/20", dotColor: "bg-orange-400" },
  critico: { label: "Crítico", color: "text-red-400", bgColor: "bg-red-500/10 border-red-500/20", dotColor: "bg-red-400" },
};

export const EMOTIONAL_TEMP_CONFIG: Record<EmotionalTemperature, { label: string; emoji: string; color: string; bgColor: string }> = {
  otimo: { label: "Ótimo", emoji: "😊", color: "text-emerald-400", bgColor: "bg-emerald-500/10" },
  bem: { label: "Bem", emoji: "🙂", color: "text-blue-400", bgColor: "bg-blue-500/10" },
  atento: { label: "Atenção", emoji: "😐", color: "text-amber-400", bgColor: "bg-amber-500/10" },
  preocupante: { label: "Preocupante", emoji: "😟", color: "text-red-400", bgColor: "bg-red-500/10" },
};
