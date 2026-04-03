import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { KanbanBoard } from "@/components/crm/pipeline/KanbanBoard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function PipelinePage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();

  const { data: deals } = await supabase
    .from("deals")
    .select(`
      *,
      atleta:atletas(id, nome_completo, esporte, serie_escolar, lead_classificacao, whatsapp),
      responsavel_usuario:user_profiles!deals_responsavel_id_fkey(nome)
    `)
    .is("deleted_at", null)
    .not("etapa", "in", "(perdido,concluido,cancelamento_solicitado,projeto_futuro)")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Pipeline</h1>
        <p className="crm-page-subtitle">Gerenciamento visual de oportunidades</p>
      </div>
      <KanbanBoard initialDeals={deals || []} />
    </div>
  );
}
