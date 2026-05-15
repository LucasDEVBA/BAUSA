export type LeadClassification = "QUENTE" | "MORNO" | "FRIO";

export interface Lead {
  id: string;
  submission_id: string | null;
  submitted_at: string;
  updated_at: string;

  // Atleta
  athlete_name: string;
  email: string;
  birth_date: string | null;
  age: string | null;
  athlete_whatsapp: string | null;
  position: string | null;
  club_history: string | null;
  achievements: string | null;
  video_highlights: string | null;
  instagram: string | null;

  // Educação
  school_year: string | null;
  current_school: string | null;
  school_city_state: string | null;
  education_model: string | null;
  english_level: string | null;
  academic_performance: string | null;

  // Projeto
  start_timing: string | null;
  project_direction: string | null;
  investment_range: string | null;

  // Perfil
  behavioral_profile: string | null;
  youth_commitment: string | null;
  family_decision_structure: string | null;

  // Responsável
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_whatsapp: string | null;
  guardian_profession: string | null;

  // Endereço
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;

  // País
  address_country: string | null;

  // Status CRM
  status: string;
  notes: string | null;
  qualified: boolean | null;
  qualification_classification: LeadClassification | null;
  qualification_reason: string | null;
  qualification_confidence: string | null;
  qualified_at: string | null;

  // Comunicação e Follow-ups
  whatsapp_sent_at: string | null;
  followup_1_sent_at: string | null;
  followup_2_sent_at: string | null;

  // Reunião
  meeting_scheduled: boolean | null;
  meeting_scheduled_at: string | null;

  // Pipeline status
  is_in_pipeline: boolean;
  pipeline_stage: string | null;
  pipeline_deal_id: string | null;
  pipeline_atleta_id: string | null;

  // Tracking & Attribution
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer_url: string | null;
  landing_url: string | null;
  session_id: string | null;
  cta_source: string | null;
  device_type: string | null;
  form_started_at: string | null;

  // Timing automation (#feature timing)
  /** 'ideal' (default), 'muito_cedo' (before_7th), 'tarde_demais' (graduated_2plus) */
  timing_status?: string | null;
  /** Data agendada para retomar contato (apenas leads muito_cedo). */
  scheduled_followup_at?: string | null;
  /** Quando a mensagem agendada foi enviada (preenchido pelo cron process-scheduled-followups). */
  scheduled_followup_sent_at?: string | null;

  // Deteccao de duplicatas
  possible_duplicate?: boolean;

  // Familia (siblings com mesmo responsavel)
  siblings?: { id: string; nome: string; esporte?: string; classificacao?: string; etapa?: string }[];
}

export interface LeadMetrics {
  total: number;
  quente: number;
  morno: number;
  frio: number;
  pendingWhatsApp: number;
  whatsappSent: number;
  todayCount: number;
  weekCount: number;
}

export interface DailyLeadCount {
  date: string;
  total: number;
  quente: number;
  morno: number;
  frio: number;
}
