import type { Metadata } from "next";
import { Users, Flame, Thermometer, Snowflake, MessageCircle, TrendingUp, Send } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ClassificationChart } from "@/components/dashboard/ClassificationChart";
import { LeadsOverTimeChart } from "@/components/dashboard/LeadsOverTimeChart";
import { RecentLeads } from "@/components/dashboard/RecentLeads";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { type Lead, type LeadMetrics, type DailyLeadCount } from "@/types/lead";

export const metadata: Metadata = {
  title: "Dashboard",
};

function mapFormSubmissionToLead(row: Record<string, unknown>): Lead {
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
    address_cep: null,
    address_street: null,
    address_number: null,
    address_complement: null,
    address_neighborhood: null,
    address_city: null,
    address_state: (row.city_state as string)?.split(" - ").pop()?.trim() ?? null,
    status: (row.status as string) ?? "new",
    notes: (row.notes as string) ?? null,
    qualified: (row.qualified as boolean) ?? null,
    qualification_classification: (row.qualification_classification as Lead["qualification_classification"]) ?? null,
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
    is_in_pipeline: false,
    pipeline_stage: null,
    pipeline_deal_id: null,
    pipeline_atleta_id: null,
  };
}

function buildDailyData(leads: Lead[]): DailyLeadCount[] {
  const days: DailyLeadCount[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    const dayLeads = leads.filter(
      (l) => l.submitted_at.split("T")[0] === dateStr
    );

    days.push({
      date: dateStr,
      total: dayLeads.length,
      quente: dayLeads.filter((l) => l.qualification_classification === "QUENTE").length,
      morno: dayLeads.filter((l) => l.qualification_classification === "MORNO").length,
      frio: dayLeads.filter((l) => l.qualification_classification === "FRIO").length,
    });
  }
  return days;
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const { data: rows } = await supabase
    .from("form_submissions")
    .select("*")
    .order("submitted_at", { ascending: false });

  const leads: Lead[] = (rows ?? []).map(mapFormSubmissionToLead);

  const today = new Date();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const metrics: LeadMetrics = {
    total: leads.length,
    quente: leads.filter((l) => l.qualification_classification === "QUENTE").length,
    morno: leads.filter((l) => l.qualification_classification === "MORNO").length,
    frio: leads.filter((l) => l.qualification_classification === "FRIO").length,
    pendingWhatsApp: leads.filter(
      (l) =>
        l.whatsapp_sent_at === null &&
        (l.qualification_classification === "QUENTE" || l.qualification_classification === "MORNO")
    ).length,
    whatsappSent: leads.filter((l) => l.whatsapp_sent_at !== null).length,
    todayCount: leads.filter((l) => {
      const d = new Date(l.submitted_at);
      return d.toDateString() === today.toDateString();
    }).length,
    weekCount: leads.filter((l) => new Date(l.submitted_at) > weekAgo).length,
  };

  const dailyData = buildDailyData(leads);

  const safeTotal = metrics.total || 1;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-zinc-100">Dashboard</h1>
        <p className="mt-0.5 text-sm text-zinc-500">
          Visao geral dos leads em tempo real
        </p>
      </div>

      {/* Metric cards - row 1 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard
          title="Total de Leads"
          value={metrics.total}
          subtitle={`${metrics.todayCount} hoje \u2022 ${metrics.weekCount} esta semana`}
          icon={Users}
          variant="default"
        />
        <MetricCard
          title="Quente"
          value={metrics.quente}
          subtitle={`${Math.round((metrics.quente / safeTotal) * 100)}% do total`}
          icon={Flame}
          variant="hot"
        />
        <MetricCard
          title="Morno"
          value={metrics.morno}
          subtitle={`${Math.round((metrics.morno / safeTotal) * 100)}% do total`}
          icon={Thermometer}
          variant="warm"
        />
        <MetricCard
          title="Frio"
          value={metrics.frio}
          subtitle={`${Math.round((metrics.frio / safeTotal) * 100)}% do total`}
          icon={Snowflake}
          variant="cold"
        />
      </div>

      {/* Metric cards - row 2 */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <MetricCard
          title="WhatsApp Enviado"
          value={metrics.whatsappSent}
          subtitle="Leads ja contatados"
          icon={Send}
          variant="purple"
        />
        <MetricCard
          title="WhatsApp Pendente"
          value={metrics.pendingWhatsApp}
          subtitle="Aguardando 22h apos qualificacao"
          icon={MessageCircle}
          variant="default"
        />
        <MetricCard
          title="Taxa de Qualificacao"
          value={`${Math.round(((metrics.quente + metrics.morno) / safeTotal) * 100)}%`}
          subtitle="Leads QUENTE ou MORNO"
          icon={TrendingUp}
          variant="hot"
        />
      </div>

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <LeadsOverTimeChart data={dailyData} />
        </div>
        <ClassificationChart
          quente={metrics.quente}
          morno={metrics.morno}
          frio={metrics.frio}
        />
      </div>

      {/* Recent leads */}
      <RecentLeads leads={leads} />
    </div>
  );
}
