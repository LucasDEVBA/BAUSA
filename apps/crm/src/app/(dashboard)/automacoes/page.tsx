import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  Automacao,
  AutomacaoComStats,
  AutomacaoRunDetalhado,
  AutomacaoRunStatus,
} from "@/types/automacao";
import { AutomacoesClient } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RunRow {
  automacao_id: string;
  status: AutomacaoRunStatus;
  created_at: string;
}

interface UsuarioRow {
  id: string;
  nome: string;
  papel: string;
}

export default async function AutomacoesPage() {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();

  const [
    { data: automacoes, error: autoErr },
    { data: runs, error: runsErr },
    { data: usuarios },
    { data: runsRecentes, error: recErr },
  ] = await Promise.all([
    supabase
      .from("automacoes")
      .select("id, nome, descricao, gatilho, gatilho_config, condicoes, acoes, ativo, created_at, updated_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("automacao_runs")
      .select("automacao_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
    supabase.from("user_profiles").select("id, nome, papel").eq("ativo", true).order("nome"),
    // Aba Execuções: últimos runs com nome/gatilho da automação (embed)
    supabase
      .from("automacao_runs")
      .select("*, automacoes(nome, gatilho)")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (autoErr) console.error({ level: "error", action: "listar_automacoes", error: autoErr.message });
  if (runsErr) console.error({ level: "error", action: "listar_automacao_runs", error: runsErr.message });
  if (recErr) console.error({ level: "error", action: "listar_runs_recentes", error: recErr.message });

  const runRows = (runs ?? []) as RunRow[];
  const withStats: AutomacaoComStats[] = ((automacoes ?? []) as Automacao[]).map((a) => {
    const own = runRows.filter((r) => r.automacao_id === a.id);
    return {
      ...a,
      runs_total: own.length,
      runs_sucesso: own.filter((r) => r.status === "sucesso").length,
      runs_erro: own.filter((r) => r.status === "erro").length,
      runs_pendente: own.filter((r) => r.status === "pendente" || r.status === "executando").length,
      ultimo_run_at: own[0]?.created_at ?? null,
    };
  });

  return (
    <AutomacoesClient
      automacoes={withStats}
      usuarios={(usuarios ?? []) as UsuarioRow[]}
      runsRecentes={(runsRecentes ?? []) as AutomacaoRunDetalhado[]}
      // Server Component dinâmico (force-dynamic): timestamp de request-time é
      // intencional — âncora da janela "últimos 7 dias" dos KPIs de execução.
      // eslint-disable-next-line react-hooks/purity
      agora={Date.now()}
    />
  );
}
