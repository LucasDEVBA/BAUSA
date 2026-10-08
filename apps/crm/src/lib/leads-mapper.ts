import { parseSinaisV2 } from "@/lib/classificador-v2";
import { type Lead, type LeadClassification } from "@/types/lead";

// ════════════════════════════════════════════════════════════════════════
// Mapeamentos de form_submissions → tipos do Engine (T8/T13).
// Antes viviam dentro de leads/page.tsx (select("*") de TODOS os leads).
// Agora: a LISTA traz só as colunas da tabela (LeadLinha) e o DOSSIÊ
// (Lead completo) é carregado sob demanda ao clicar — /leads e a faixa
// "Fora do pipeline" usam a mesma fonte. Módulo puro (sem imports de servidor).
// ════════════════════════════════════════════════════════════════════════

export interface IrmaoLead {
  id: string;
  nome: string;
  esporte?: string;
  classificacao?: string;
  etapa?: string;
}

/** Linha da tabela /leads — SÓ o que a tabela e o CSV exibem. */
export interface LeadLinha {
  id: string;
  athlete_name: string;
  email: string;
  qualification_classification: LeadClassification | null;
  investment_range: string | null;
  position: string | null;
  address_state: string | null;
  school_city_state: string | null;
  meeting_scheduled: boolean | null;
  whatsapp_sent_at: string | null;
  followup_1_sent_at: string | null;
  followup_2_sent_at: string | null;
  utm_source: string | null;
  cta_source: string | null;
  device_type: string | null;
  submitted_at: string;
  timing_status: string | null;
  is_in_pipeline: boolean;
  pipeline_stage: string | null;
  pipeline_deal_id: string | null;
  pipeline_atleta_id: string | null;
  possible_duplicate: boolean;
  siblings?: IrmaoLead[];
}

/** Colunas de vw_cadastros_situacao lidas pela lista (sem telefone p/ o client). */
export const COLUNAS_LISTA_LEADS =
  "id, athlete_name, email, qualification_classification, aprovacao_status, investment_range, " +
  "position, address_state, city_state, meeting_scheduled, whatsapp_sent_at, followup_1_sent_at, " +
  "followup_2_sent_at, utm_source, cta_source, device_type, submitted_at, timing_status, " +
  "atleta_id, responsavel_id, deal_id, deal_etapa, telefone_resp_digitos, athlete_whatsapp, guardian_whatsapp";

/** Linha crua da view para a lista. Telefones ficam SÓ no servidor (prioridade). */
export interface LinhaListaView {
  id: string;
  athlete_name: string;
  email: string;
  qualification_classification: string | null;
  aprovacao_status: string | null;
  investment_range: string | null;
  position: string | null;
  address_state: string | null;
  city_state: string | null;
  meeting_scheduled: boolean | null;
  whatsapp_sent_at: string | null;
  followup_1_sent_at: string | null;
  followup_2_sent_at: string | null;
  utm_source: string | null;
  cta_source: string | null;
  device_type: string | null;
  submitted_at: string;
  timing_status: string | null;
  atleta_id: string | null;
  responsavel_id: string | null;
  deal_id: string | null;
  deal_etapa: string | null;
  telefone_resp_digitos: string | null;
  athlete_whatsapp: string | null;
  guardian_whatsapp: string | null;
}

/** Estado do cadastro no pipeline (atleta + deal ativo mais recente). */
export interface PipelineDoCadastro {
  atletaId: string | null;
  dealId: string | null;
  etapa: string | null;
}

function estadoDe(cidadeEstado: string | null, estado: string | null): string | null {
  return estado ?? cidadeEstado?.split(" - ").pop()?.trim() ?? null;
}

export function mapLinhaListaLead(row: LinhaListaView): LeadLinha {
  return {
    id: row.id,
    athlete_name: row.athlete_name,
    email: row.email,
    qualification_classification: (row.qualification_classification as LeadClassification | null) ?? null,
    investment_range: row.investment_range,
    position: row.position,
    address_state: estadoDe(row.city_state, row.address_state),
    school_city_state: row.city_state,
    meeting_scheduled: row.meeting_scheduled,
    whatsapp_sent_at: row.whatsapp_sent_at,
    followup_1_sent_at: row.followup_1_sent_at,
    followup_2_sent_at: row.followup_2_sent_at,
    utm_source: row.utm_source,
    cta_source: row.cta_source,
    device_type: row.device_type,
    submitted_at: row.submitted_at,
    timing_status: row.timing_status,
    is_in_pipeline: row.atleta_id !== null,
    pipeline_stage: row.deal_etapa,
    pipeline_deal_id: row.deal_id,
    pipeline_atleta_id: row.atleta_id,
    possible_duplicate: false,
  };
}

/** Colunas do dossiê (antes: select("*")). Mesmo conjunto que o mapper usa. */
export const COLUNAS_LEAD_DOSSIE =
  "id, submission_id, submitted_at, updated_at, athlete_name, email, birth_date, guardian_whatsapp, " +
  "position, club_history, achievements, video_link, instagram, school_year, current_school, city_state, " +
  "english_level, investment_range, guardian_name, guardian_email, guardian_profession, address_cep, " +
  "address_street, address_number, address_complement, address_neighborhood, address_city, address_state, " +
  "status, notes, qualified, qualification_classification, qualification_reason, qualification_confidence, " +
  "qualified_at, score_financeiro, tier_profissao, sinais_reforco, sinais_alerta, prioridade_estrategica, " +
  "acao_recomendada, whatsapp_sent_at, followup_1_sent_at, followup_2_sent_at, meeting_scheduled, " +
  "meeting_scheduled_at, address_country, utm_source, utm_medium, utm_campaign, utm_content, utm_term, " +
  "referrer_url, landing_url, session_id, cta_source, device_type, form_started_at, timing_status, " +
  "scheduled_followup_at, scheduled_followup_sent_at";

/**
 * form_submissions (COLUNAS_LEAD_DOSSIE) → Lead do dossiê. Mapeamento
 * IDÊNTICO ao do antigo leads/page.tsx (inclusive os campos que ele deixava
 * null) — mudar exibição do dossiê não é escopo do T8.
 */
export function mapFormSubmissionToLead(row: Record<string, unknown>, pipeline: PipelineDoCadastro): Lead {
  const txt = (k: string): string | null => (row[k] as string | null | undefined) ?? null;
  return {
    id: row.id as string,
    submission_id: txt("submission_id"),
    submitted_at: row.submitted_at as string,
    updated_at: row.updated_at as string,
    athlete_name: row.athlete_name as string,
    email: row.email as string,
    birth_date: txt("birth_date"),
    age: null,
    athlete_whatsapp: txt("guardian_whatsapp"),
    position: txt("position"),
    club_history: txt("club_history"),
    achievements: txt("achievements"),
    video_highlights: txt("video_link"),
    instagram: txt("instagram"),
    school_year: txt("school_year"),
    current_school: txt("current_school"),
    school_city_state: txt("city_state"),
    education_model: null,
    english_level: txt("english_level"),
    academic_performance: null,
    start_timing: null,
    project_direction: null,
    investment_range: txt("investment_range"),
    behavioral_profile: null,
    youth_commitment: null,
    family_decision_structure: null,
    guardian_name: txt("guardian_name"),
    guardian_email: txt("guardian_email"),
    guardian_whatsapp: txt("guardian_whatsapp"),
    guardian_profession: txt("guardian_profession"),
    address_cep: txt("address_cep"),
    address_street: txt("address_street"),
    address_number: txt("address_number"),
    address_complement: txt("address_complement"),
    address_neighborhood: txt("address_neighborhood"),
    address_city: txt("address_city"),
    address_state: estadoDe(txt("city_state"), txt("address_state")),
    status: txt("status") ?? "new",
    notes: txt("notes"),
    qualified: (row.qualified as boolean | null | undefined) ?? null,
    qualification_classification: (txt("qualification_classification") as LeadClassification | null) ?? null,
    qualification_reason: txt("qualification_reason"),
    qualification_confidence: txt("qualification_confidence"),
    qualified_at: txt("qualified_at"),
    score_financeiro: typeof row.score_financeiro === "number" ? row.score_financeiro : null,
    tier_profissao: txt("tier_profissao"),
    sinais_reforco: parseSinaisV2(row.sinais_reforco),
    sinais_alerta: parseSinaisV2(row.sinais_alerta),
    prioridade_estrategica: txt("prioridade_estrategica"),
    acao_recomendada: txt("acao_recomendada"),
    whatsapp_sent_at: txt("whatsapp_sent_at"),
    followup_1_sent_at: txt("followup_1_sent_at"),
    followup_2_sent_at: txt("followup_2_sent_at"),
    meeting_scheduled: (row.meeting_scheduled as boolean | null | undefined) ?? null,
    meeting_scheduled_at: txt("meeting_scheduled_at"),
    address_country: txt("address_country"),
    utm_source: txt("utm_source"),
    utm_medium: txt("utm_medium"),
    utm_campaign: txt("utm_campaign"),
    utm_content: txt("utm_content"),
    utm_term: txt("utm_term"),
    referrer_url: txt("referrer_url"),
    landing_url: txt("landing_url"),
    session_id: txt("session_id"),
    cta_source: txt("cta_source"),
    device_type: txt("device_type"),
    form_started_at: txt("form_started_at"),
    timing_status: txt("timing_status"),
    scheduled_followup_at: txt("scheduled_followup_at"),
    scheduled_followup_sent_at: txt("scheduled_followup_sent_at"),
    is_in_pipeline: pipeline.atletaId !== null,
    pipeline_stage: pipeline.etapa,
    pipeline_deal_id: pipeline.dealId,
    pipeline_atleta_id: pipeline.atletaId,
  };
}
