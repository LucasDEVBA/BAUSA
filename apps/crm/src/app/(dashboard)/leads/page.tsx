import type { Metadata } from "next";
import { Flame, Thermometer, Snowflake, Clock } from "lucide-react";
import { LeadsTable } from "@/components/leads/LeadsTable";
import { LeadsExportButton } from "@/components/leads/LeadsExportButton";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { type Lead, type LeadClassification } from "@/types/lead";

export const metadata: Metadata = {
  title: "Leads",
};

interface PipelineInfo {
  atletaId: string;
  dealId: string | undefined;
  etapa: string | undefined;
}

function mapFormSubmissionToLead(
  row: Record<string, unknown>,
  pipelineMap: Map<string, PipelineInfo>,
): Lead {
  const pipeline = pipelineMap.get(row.id as string);
  return {
    id: row.id as string,
    submission_id: (row.submission_id as string) ?? null,
    submitted_at: row.submitted_at as string,
    updated_at: row.updated_at as string,
    athlete_name: row.athlete_name as string,
    email: row.email as string,
    birth_date: (row.birth_date as string) ?? null,
    age: null,
    athlete_whatsapp: (row.guardian_whatsapp as string) ?? null,
    position: (row.position as string) ?? null,
    club_history: (row.club_history as string) ?? null,
    achievements: (row.achievements as string) ?? null,
    video_highlights: (row.video_link as string) ?? null,
    instagram: (row.instagram as string) ?? null,
    school_year: (row.school_year as string) ?? null,
    current_school: (row.current_school as string) ?? null,
    school_city_state: (row.city_state as string) ?? null,
    education_model: null,
    english_level: (row.english_level as string) ?? null,
    academic_performance: null,
    start_timing: null,
    project_direction: null,
    investment_range: (row.investment_range as string) ?? null,
    behavioral_profile: null,
    youth_commitment: null,
    family_decision_structure: null,
    guardian_name: (row.guardian_name as string) ?? null,
    guardian_email: (row.guardian_email as string) ?? null,
    guardian_whatsapp: (row.guardian_whatsapp as string) ?? null,
    guardian_profession: (row.guardian_profession as string) ?? null,
    address_cep: (row.address_cep as string) ?? null,
    address_street: (row.address_street as string) ?? null,
    address_number: (row.address_number as string) ?? null,
    address_complement: (row.address_complement as string) ?? null,
    address_neighborhood: (row.address_neighborhood as string) ?? null,
    address_city: (row.address_city as string) ?? null,
    address_state:
      (row.address_state as string) ??
      (row.city_state as string)?.split(" - ").pop()?.trim() ??
      null,
    status: (row.status as string) ?? "new",
    notes: (row.notes as string) ?? null,
    qualified: (row.qualified as boolean) ?? null,
    qualification_classification: (row.qualification_classification as LeadClassification) ?? null,
    qualification_reason: (row.qualification_reason as string) ?? null,
    qualification_confidence: (row.qualification_confidence as string) ?? null,
    qualified_at: (row.qualified_at as string) ?? null,
    whatsapp_sent_at: (row.whatsapp_sent_at as string) ?? null,
    followup_1_sent_at: (row.followup_1_sent_at as string) ?? null,
    followup_2_sent_at: (row.followup_2_sent_at as string) ?? null,
    meeting_scheduled: (row.meeting_scheduled as boolean) ?? null,
    meeting_scheduled_at: (row.meeting_scheduled_at as string) ?? null,
    address_country: (row.address_country as string) ?? null,
    utm_source: (row.utm_source as string) ?? null,
    utm_medium: (row.utm_medium as string) ?? null,
    utm_campaign: (row.utm_campaign as string) ?? null,
    utm_content: (row.utm_content as string) ?? null,
    utm_term: (row.utm_term as string) ?? null,
    referrer_url: (row.referrer_url as string) ?? null,
    landing_url: (row.landing_url as string) ?? null,
    session_id: (row.session_id as string) ?? null,
    cta_source: (row.cta_source as string) ?? null,
    device_type: (row.device_type as string) ?? null,
    form_started_at: (row.form_started_at as string) ?? null,
    timing_status: (row.timing_status as string) ?? null,
    scheduled_followup_at: (row.scheduled_followup_at as string) ?? null,
    scheduled_followup_sent_at: (row.scheduled_followup_sent_at as string) ?? null,
    is_in_pipeline: !!pipeline,
    pipeline_stage: pipeline?.etapa ?? null,
    pipeline_deal_id: pipeline?.dealId ?? null,
    pipeline_atleta_id: pipeline?.atletaId ?? null,
  };
}

export default async function LeadsPage() {
  const supabase = await createServerSupabaseClient();

  // Buscar todos os leads
  const { data: rows } = await supabase
    .from("form_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  // Buscar leads promovidos com etapa do deal + responsavel_id para siblings
  const { data: promotedAtletas } = await supabase
    .from("atletas")
    .select("form_submission_id, id, nome_completo, esporte, responsavel_id, lead_classificacao, deals(id, etapa)")
    .not("form_submission_id", "is", null)
    .is("deleted_at", null);

  // Montar mapa de pipeline
  const pipelineMap = new Map<string, PipelineInfo>();
  // Montar mapa responsavel -> atletas para siblings
  const responsavelAtletasMap = new Map<string, { id: string; nome: string; esporte: string; formSubmissionId: string; classificacao: string | null; etapa: string | null }[]>();
  for (const a of promotedAtletas ?? []) {
    const deals = a.deals as Array<{ id: string; etapa: string }> | null;
    const deal = deals?.[0];
    const fsId = a.form_submission_id as string;
    pipelineMap.set(fsId, {
      atletaId: a.id as string,
      dealId: deal?.id,
      etapa: deal?.etapa,
    });

    const respId = a.responsavel_id as string;
    if (respId) {
      const existing = responsavelAtletasMap.get(respId) ?? [];
      existing.push({
        id: a.id as string,
        nome: a.nome_completo as string,
        esporte: (a.esporte as string) ?? "",
        formSubmissionId: fsId,
        classificacao: (a.lead_classificacao as string) ?? null,
        etapa: deal?.etapa ?? null,
      });
      responsavelAtletasMap.set(respId, existing);
    }
  }
  // Montar mapa formSubmissionId -> siblings
  const siblingsMap = new Map<string, { id: string; nome: string; esporte?: string; classificacao?: string; etapa?: string }[]>();
  for (const atletas of responsavelAtletasMap.values()) {
    if (atletas.length > 1) {
      for (const atleta of atletas) {
        const siblings = atletas
          .filter((a) => a.id !== atleta.id)
          .map((a) => ({
            id: a.id,
            nome: a.nome,
            esporte: a.esporte || undefined,
            classificacao: a.classificacao || undefined,
            etapa: a.etapa || undefined,
          }));
        siblingsMap.set(atleta.formSubmissionId, siblings);
      }
    }
  }

  const mappedLeads: Lead[] = (rows ?? []).map((row) =>
    mapFormSubmissionToLead(row, pipelineMap),
  );

  // Deteccao de duplicatas por WhatsApp normalizado
  const whatsappGroups = new Map<string, string[]>();
  for (const lead of mappedLeads) {
    const rawWhatsapp = lead.guardian_whatsapp;
    if (!rawWhatsapp) continue;
    const normalized = rawWhatsapp.replace(/\D/g, "");
    if (normalized.length < 8) continue;
    const existing = whatsappGroups.get(normalized);
    if (existing) {
      existing.push(lead.id);
    } else {
      whatsappGroups.set(normalized, [lead.id]);
    }
  }
  const duplicateIds = new Set<string>();
  for (const ids of whatsappGroups.values()) {
    if (ids.length > 1) {
      for (const id of ids) {
        duplicateIds.add(id);
      }
    }
  }
  const leads = mappedLeads.map((lead) => ({
    ...lead,
    possible_duplicate: duplicateIds.has(lead.id),
    siblings: siblingsMap.get(lead.id),
  }));

  const quente = leads.filter((l) => l.qualification_classification === "QUENTE").length;
  const morno = leads.filter((l) => l.qualification_classification === "MORNO").length;
  const frio = leads.filter((l) => l.qualification_classification === "FRIO").length;
  const timingAlternativo = leads.filter(
    (l) => l.timing_status === "muito_cedo" || l.timing_status === "tarde_demais"
  ).length;

  return (
    <div className="space-y-4">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-title-2 text-foreground">Leads</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Todos os leads qualificados pelo sistema
          </p>
        </div>

        {/* Quick stats + export */}
        <div className="hidden items-center gap-3 md:flex">
          <LeadsExportButton leads={leads} />
          <div className="flex items-center gap-1.5 rounded-lg border border-lead-hot/20 bg-lead-hot/10 px-3 py-1.5">
            <Flame className="h-3.5 w-3.5 text-lead-hot" />
            <span className="text-sm font-semibold text-lead-hot">{quente}</span>
            <span className="text-xs text-lead-hot/70">quentes</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-lead-warm/20 bg-lead-warm/10 px-3 py-1.5">
            <Thermometer className="h-3.5 w-3.5 text-lead-warm" />
            <span className="text-sm font-semibold text-lead-warm">{morno}</span>
            <span className="text-xs text-lead-warm/70">mornos</span>
          </div>
          <div className="flex items-center gap-1.5 rounded-lg border border-lead-cold/20 bg-lead-cold/10 px-3 py-1.5">
            <Snowflake className="h-3.5 w-3.5 text-lead-cold" />
            <span className="text-sm font-semibold text-lead-cold">{frio}</span>
            <span className="text-xs text-lead-cold/70">frios</span>
          </div>
          {timingAlternativo > 0 && (
            <div
              className="flex items-center gap-1.5 rounded-lg border border-plan-legacy/20 bg-plan-legacy/10 px-3 py-1.5"
              title="Leads em 'muito cedo' ou 'tarde demais' — fora da janela ideal de aplicação"
            >
              <Clock className="h-3.5 w-3.5 text-plan-legacy" />
              <span className="text-sm font-semibold text-plan-legacy">{timingAlternativo}</span>
              <span className="text-xs text-plan-legacy/70">timing alternativo</span>
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      <LeadsTable leads={leads} />
    </div>
  );
}
