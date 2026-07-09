import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import type {
  SchedulerMensagens,
  SistemaAtivas,
  SistemaEmailConfig,
} from "@/lib/actions/automacoes-builder";
import type { QualificacaoPromptCfg } from "@/lib/automacoes/qualificacao-prompt-defaults";
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

  // Resolve nomes dos leads/atletas referenciados pelos runs (aba Execuções)
  const atletaIds = Array.from(
    new Set(
      ((runsRecentes ?? []) as AutomacaoRunDetalhado[])
        .map((r) => (r.contexto as { atleta_id?: string })?.atleta_id)
        .filter((id): id is string => typeof id === "string"),
    ),
  );
  const leadNomes: Record<string, string> = {};
  if (atletaIds.length > 0) {
    const { data: atletas } = await supabase
      .from("atletas")
      .select("id, nome_completo")
      .in("id", atletaIds);
    for (const a of (atletas ?? []) as { id: string; nome_completo: string }[]) {
      leadNomes[a.id] = a.nome_completo;
    }
  }

  // Intervalos + textos + toggles/e-mail/prompt das automações nativas
  // (seção "Automações do sistema")
  const [
    { data: intervalosRow },
    { data: mensagensRow },
    { data: ativasRow },
    { data: emailCfgRow },
    { data: promptCfgRow },
  ] = await Promise.all([
    supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "scheduler_intervalos")
      .maybeSingle(),
    supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "scheduler_mensagens")
      .maybeSingle(),
    supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "sistema_automacoes_ativas")
      .maybeSingle(),
    supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "email_config")
      .maybeSingle(),
    supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "qualificacao_prompt")
      .maybeSingle(),
  ]);
  // null = seed não aplicado neste ambiente → client desabilita a edição
  const mensagens = (mensagensRow?.valor as SchedulerMensagens | undefined) ?? null;
  const intervalos = {
    whatsapp_inicial_horas: 22,
    whatsapp_timing_alt_horas: 48,
    followup_1_horas: 48,
    followup_2_horas: 168,
    ...((intervalosRow?.valor as Record<string, number>) ?? {}),
  };
  // Toggles/e-mail/prompt (Fase 2a): null = migration pendente → edição
  // desabilitada no client (as CFs seguem fail-open com os defaults).
  const ativas = (ativasRow?.valor as SistemaAtivas | undefined) ?? null;
  const emailCfg = (emailCfgRow?.valor as SistemaEmailConfig | undefined) ?? null;
  const promptCfg = (promptCfgRow?.valor as QualificacaoPromptCfg | undefined) ?? null;

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
      leadNomes={leadNomes}
      intervalos={intervalos}
      mensagens={mensagens}
      ativas={ativas}
      emailCfg={emailCfg}
      promptCfg={promptCfg}
      // Server Component dinâmico (force-dynamic): timestamp de request-time é
      // intencional — âncora da janela "últimos 7 dias" dos KPIs de execução.
      // eslint-disable-next-line react-hooks/purity
      agora={Date.now()}
    />
  );
}
