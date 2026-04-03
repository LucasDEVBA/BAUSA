import { createServerSupabaseClient } from "@/lib/crm/supabase-server";
import { requirePapel } from "@/lib/crm/auth";
import { ConfiguracoesForm } from "@/components/crm/configuracoes/ConfiguracoesForm";

interface PageProps {
  params: Promise<{ locale: string }>;
}

export default async function ConfiguracoesPage({ params }: PageProps) {
  const { locale } = await params;
  await requirePapel("ceo", locale);
  const supabase = await createServerSupabaseClient();

  const { data: configs } = await supabase
    .from("configuracoes_sistema")
    .select("*")
    .order("chave");

  const configMap: Record<string, { valor: unknown; descricao: string | null }> = {};
  (configs || []).forEach((c: { chave: string; valor: unknown; descricao: string | null }) => {
    configMap[c.chave] = { valor: c.valor, descricao: c.descricao };
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="crm-page-title">Configuracoes do Sistema</h1>
        <p className="crm-page-subtitle">Parametros globais do sistema</p>
      </div>
      <ConfiguracoesForm configs={configMap} />
    </div>
  );
}
