import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { getUserProfile } from "@/lib/crm/auth";
import { redirect } from "next/navigation";
import { ExperienciaDashboard } from "@/components/crm/experiencia/ExperienciaDashboard";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ExperienciaPage({ params }: PageProps) {
  const { locale } = await params;
  const profile = await getUserProfile();

  if (!profile) {
    const loginPath = locale === "pt" ? "/login" : `/${locale}/login`;
    redirect(loginPath);
  }

  if (!["ceo", "head_sucesso"].includes(profile.papel)) {
    const prefix = locale === "pt" ? "" : `/${locale}`;
    redirect(`${prefix}/crm`);
  }

  const supabase = await createServerSupabaseClient();

  // Buscar experiências com atleta + responsável + deal
  const { data: experiencias } = await supabase
    .from("crm_experiencia")
    .select(`
      *,
      atleta:atletas(nome_completo, whatsapp, esporte, serie_escolar, responsavel_id,
        responsavel:responsaveis(nome, whatsapp)),
      deal:deals(id, etapa, valor_estimado, contrato:contratos_financeiros(plano, valor_total))
    `)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });

  // Buscar tarefas pendentes do usuário
  let tarefasQuery = supabase
    .from("tarefas")
    .select("*")
    .is("deleted_at", null)
    .not("status", "in", "(concluida,cancelada)")
    .order("prazo", { ascending: true });

  if (profile.papel !== "ceo") {
    tarefasQuery = tarefasQuery.eq("responsavel_id", profile.id);
  }

  const { data: tarefas } = await tarefasQuery;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">
          {profile.papel === "head_sucesso" ? "Minhas Familias" : "CRM Experiencia"}
        </h1>
        <p className="crm-page-subtitle">Acompanhamento da jornada das familias</p>
      </div>
      <ExperienciaDashboard
        experiencias={(experiencias || []) as any}
        tarefas={(tarefas || []) as any}
        papel={profile.papel}
      />
    </div>
  );
}
