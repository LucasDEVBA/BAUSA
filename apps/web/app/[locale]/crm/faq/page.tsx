import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { getUserProfile } from "@/lib/crm/auth";
import { redirect } from "next/navigation";
import { FaqSearch } from "@/components/crm/faq/FaqSearch";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function FaqPage({ params }: PageProps) {
  const { locale } = await params;
  const profile = await getUserProfile();
  if (!profile || !["ceo", "head_sucesso"].includes(profile.papel)) {
    redirect(locale === "pt" ? "/crm" : `/${locale}/crm`);
  }

  const supabase = await createServerSupabaseClient();
  const { data: artigos } = await supabase
    .from("faq_artigos")
    .select("*")
    .eq("arquivado", false)
    .order("acessos", { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Base de Conhecimento</h1>
        <p className="crm-page-subtitle">Base de conhecimento para atendimento</p>
      </div>
      <FaqSearch artigos={artigos || []} papel={profile.papel} />
    </div>
  );
}
