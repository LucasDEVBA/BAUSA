export type SchoolType = "Division I" | "Division II" | "Division III" | "NAIA" | "JUCO";
export type SchoolStatus = "ativa" | "inativa" | "em_avaliacao";
export type SchoolSportInfluence = "baixa" | "media" | "alta" | "decisiva";
export type ScholarshipAggressiveness = "conservadora" | "moderada" | "agressiva";
export type RequiredTest = "Duolingo" | "PSAT" | "SSAT" | "TOEFL" | "SAT";

export interface School {
  id: string;
  name: string;
  state: string;
  city: string;
  type: SchoolType;
  status: SchoolStatus;

  // Regras financeiras
  min_budget_usd: number;
  strong_budget_usd: number;

  // Regras esportivas
  sport_influence: SchoolSportInfluence;
  elite_athlete_exception: boolean;
  scholarship_aggressiveness: ScholarshipAggressiveness;

  // Regras acadêmicas
  min_english_level: string;
  required_tests: RequiredTest[];

  // Regras por série
  preferred_grade: string;
  max_grade_accepted: string;

  // Inteligência institucional (acumulada por processos)
  total_applications: number;
  acceptance_count: number;
  avg_scholarship_pct: number;
  avg_response_days: number;

  // Regra prática BAUSA
  practical_rule: string;

  // Contato
  coach_name?: string;
  coach_email?: string;
  coach_phone?: string;

  // Notas internas
  notes?: string;

  // GPA
  gpa_minimo?: number | null;

  // Relacionamento e deadlines
  temperatura_relacionamento?: string;
  ultimo_contato_at?: string | null;
  deadline_fall?: string | null;
  deadline_spring?: string | null;
  rolling_admission?: boolean;
  serie_maxima?: string;
}

export interface SchoolStageStrategy {
  id: string;
  deal_id: string;
  athlete_name: string;
  school_id: string;
  school_name: string;
  priority: number;
  status: "pre_acordada" | "rede_ativa" | "planejamento" | "observacao_futura";
  estimated_scholarship_usd: number;
  notes?: string;
}

export const SCHOOL_STATUS_CONFIG: Record<SchoolStatus, { label: string; color: string; bg: string }> = {
  ativa: { label: "Ativa", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  inativa: { label: "Inativa", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  em_avaliacao: { label: "Em Avaliação", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
};

export const SCHOOL_TYPE_CONFIG: Record<SchoolType, { label: string; color: string; bg: string }> = {
  "Division I": { label: "Div. I", color: "text-purple-300", bg: "bg-purple-500/15 border-purple-500/30" },
  "Division II": { label: "Div. II", color: "text-blue-300", bg: "bg-blue-500/15 border-blue-500/30" },
  "Division III": { label: "Div. III", color: "text-cyan-300", bg: "bg-cyan-500/15 border-cyan-500/30" },
  NAIA: { label: "NAIA", color: "text-teal-300", bg: "bg-teal-500/15 border-teal-500/30" },
  JUCO: { label: "JUCO", color: "text-zinc-300", bg: "bg-zinc-500/15 border-zinc-500/30" },
};

export const STAGE_STRATEGY_STATUS_CONFIG = {
  pre_acordada: { label: "Pré-acordada", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
  rede_ativa: { label: "Rede Ativa", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  planejamento: { label: "Planejamento", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
  observacao_futura: { label: "Observação Futura", color: "text-zinc-400", bg: "bg-zinc-500/10 border-zinc-500/20" },
};
