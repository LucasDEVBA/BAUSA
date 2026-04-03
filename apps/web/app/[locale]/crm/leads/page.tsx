import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { LeadsTable } from "@/components/crm/leads/LeadsTable";
import { MetricCard } from "@/components/crm/shared/MetricCard";
import { Users, Flame, Sun, Snowflake } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function LeadsPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();

  const { data: promotedIds } = await supabase
    .from("atletas").select("form_submission_id").not("form_submission_id", "is", null);
  const excludeIds = (promotedIds || []).map((a) => a.form_submission_id).filter(Boolean) as string[];

  let query = supabase.from("form_submissions").select("*").order("submitted_at", { ascending: false });
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }
  const { data: novosLeads } = await query;

  const { data: atletasCrm } = await supabase
    .from("atletas").select("*, responsavel:responsaveis(nome, whatsapp)")
    .is("deleted_at", null).order("created_at", { ascending: false });

  const leads = novosLeads || [];
  const hot = leads.filter((l) => l.qualification_classification === "QUENTE").length;
  const warm = leads.filter((l) => l.qualification_classification === "MORNO").length;
  const cold = leads.filter((l) => l.qualification_classification === "FRIO").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Leads</h1>
        <p className="crm-page-subtitle">{leads.length} novos | {atletasCrm?.length || 0} no CRM</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Novos" value={String(leads.length)} icon={Users} />
        <MetricCard title="Quentes" value={String(hot)} icon={Flame} variant="hot" />
        <MetricCard title="Mornos" value={String(warm)} icon={Sun} variant="warm" />
        <MetricCard title="Frios" value={String(cold)} icon={Snowflake} variant="cold" />
      </div>

      <div className="crm-card">
        <div className="flex items-center gap-3 mb-4">
          <button className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] text-[var(--crm-accent-text)] border-b-2 border-[var(--crm-accent-500)] pb-1">
            Novos ({leads.length})
          </button>
          <button className="text-[var(--crm-text-xs)] font-[var(--crm-weight-semibold)] text-[var(--crm-text-tertiary)] pb-1 hover:text-[var(--crm-text-secondary)]">
            No CRM ({atletasCrm?.length || 0})
          </button>
        </div>
        <LeadsTable leads={leads} type="novos" />
      </div>
    </div>
  );
}
