import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { getUserProfile } from "@/lib/crm/auth";
import { TarefasList } from "@/components/crm/tarefas/TarefasList";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function TarefasPage({ params }: PageProps) {
  const { locale } = await params;
  const profile = await getUserProfile();
  if (!profile) return null;

  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("tarefas")
    .select("*")
    .is("deleted_at", null)
    .order("prazo", { ascending: true });

  // Head de Sucesso só vê suas tarefas
  if (profile.papel !== "ceo") {
    query = query.eq("responsavel_id", profile.id);
  }

  const { data: tarefas } = await query;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Tarefas</h1>
        <p className="crm-page-subtitle">Gestao de atividades e prazos</p>
      </div>
      <TarefasList tarefas={(tarefas || []) as any} papel={profile.papel} />
    </div>
  );
}
