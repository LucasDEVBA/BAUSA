import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { AuditClient } from "./client";

export default async function AuditPage() {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();

  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, tabela, registro_id, operacao, dados_anteriores, dados_novos, campos_alterados, user_id, user_papel, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  // Buscar tabelas distintas para filtro
  const tabelas = Array.from(new Set((logs ?? []).map((l) => l.tabela as string))).sort();

  return (
    <AuditClient
      logs={(logs ?? []).map((l) => ({
        id: l.id as string,
        tabela: l.tabela as string,
        registro_id: l.registro_id as string,
        operacao: l.operacao as "INSERT" | "UPDATE" | "DELETE",
        campos_alterados: (l.campos_alterados as string[]) ?? [],
        user_id: l.user_id as string | null,
        user_papel: l.user_papel as string | null,
        created_at: l.created_at as string,
      }))}
      tabelas={tabelas}
    />
  );
}
