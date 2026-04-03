import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { IndicacoesList } from "@/components/crm/indicacoes/IndicacoesList";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function IndicacoesPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();

  const { data: indicacoes } = await supabase
    .from("indicacoes")
    .select(`
      *,
      indicador:responsaveis!indicacoes_responsavel_indicador_id_fkey(nome, whatsapp),
      atleta:atletas!indicacoes_atleta_indicado_id_fkey(nome_completo)
    `)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Programa de Indicacao</h1>
        <p className="crm-page-subtitle">Tracking de familias indicadas e recompensas</p>
      </div>
      <IndicacoesList indicacoes={indicacoes || []} />
    </div>
  );
}
