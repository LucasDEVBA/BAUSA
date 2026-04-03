import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { EscolasList } from "@/components/crm/escolas/EscolasList";
import { MetricCard } from "@/components/crm/shared/MetricCard";
import { GraduationCap, MapPin, Trophy, Handshake } from "lucide-react";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function EscolasPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();

  const { data: escolas } = await supabase
    .from("escolas").select("*").is("deleted_at", null).order("nome", { ascending: true });

  const total = escolas?.length || 0;
  const ativas = (escolas || []).filter((e) => e.status === "ativa").length;
  const comAplicacao = (escolas || []).filter((e) => e.total_aplicados > 0).length;
  const relForte = (escolas || []).filter((e) => e.temperatura_relacionamento === "forte" || e.temperatura_relacionamento === "bom").length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Banco de Escolas</h1>
        <p className="crm-page-subtitle">Base institucional construida pelo CEO</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Escolas" value={String(total)} icon={GraduationCap} />
        <MetricCard title="Ativas" value={String(ativas)} icon={MapPin} variant="hot" />
        <MetricCard title="Com Aplicacao" value={String(comAplicacao)} icon={Trophy} variant="purple" />
        <MetricCard title="Relacao Forte" value={String(relForte)} icon={Handshake} variant="cold" />
      </div>

      <div className="crm-card">
        <EscolasList escolas={escolas || []} />
      </div>
    </div>
  );
}
