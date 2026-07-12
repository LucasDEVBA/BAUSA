import { requirePapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getConfiguracoes } from "@/lib/actions/configuracoes";
import { contarPassosIA } from "@/components/automacoes/builder-shared";
import type { Automacao, AutomacaoComStats } from "@/types/automacao";

import { AgentsClient, type SistemaPromptChave } from "./client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface RunRow {
  automacao_id: string;
  status: string;
  created_at: string;
}

/** Uma automação é "agent de IA" se usa a IA em algum passo (ia_condicao/ia_prompt)
 *  ou tem a ação ia_prompt no fluxo simples. Espelha o contarPassosIA do builder. */
function ehAgentIA(a: Automacao): boolean {
  return (
    contarPassosIA(a.passos ?? []) > 0 ||
    (a.acoes ?? []).some((ac) => ac.tipo === "ia_prompt")
  );
}

interface OverrideCfg {
  instrucoes?: string;
}

/** Extrai o override `{ instrucoes }` de uma chave do map de configs (undefined = seed pendente). */
function lerPromptSistema(
  configs: Record<string, unknown>,
  chave: SistemaPromptChave,
): { seeded: boolean; override: string } {
  const raw = configs[chave];
  if (raw === undefined || raw === null) return { seeded: false, override: "" };
  const cfg = raw as OverrideCfg;
  return { seeded: true, override: typeof cfg.instrucoes === "string" ? cfg.instrucoes : "" };
}

export default async function AgentsPage() {
  await requirePapel("ceo");

  const supabase = await createServerSupabaseClient();

  const configs = await getConfiguracoes();

  const [{ data: automacoes }, { data: runs }] = await Promise.all([
    supabase
      .from("automacoes")
      .select("id, nome, descricao, gatilho, gatilho_config, condicoes, acoes, passos, ativo, created_at, updated_at")
      .is("deleted_at", null)
      // Âncoras de SISTEMA (schedulers nativos) não são agents do builder.
      .neq("gatilho", "sistema")
      .order("created_at", { ascending: false }),
    supabase
      .from("automacao_runs")
      .select("automacao_id, status, created_at")
      .order("created_at", { ascending: false })
      .limit(5000),
  ]);

  const runRows = (runs ?? []) as RunRow[];
  const automacoesIA: AutomacaoComStats[] = ((automacoes ?? []) as Automacao[])
    .filter(ehAgentIA)
    .map((a) => {
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

  // Personas do chatbot assistido (chatbot_persona: { persona?, personaGrupo? }).
  const chatbotRaw = configs.chatbot_persona;
  const personaSeeded = chatbotRaw !== undefined && chatbotRaw !== null;
  const chatbotCfg = (chatbotRaw ?? {}) as { persona?: string; personaGrupo?: string };

  // Prompts de sistema no formato { instrucoes } (editáveis inline).
  const insightsPrompt = lerPromptSistema(configs, "insights_conversa_prompt");
  const transcricaoPrompt = lerPromptSistema(configs, "transcricao_resumo_prompt");
  const cacPrompt = lerPromptSistema(configs, "cac_insights_prompt");

  // Prompts com editor especializado (mora em /automacoes) — só sinalizamos se há override.
  const qualificacaoRaw = (configs.qualificacao_prompt ?? {}) as Record<string, unknown>;
  const qualificacaoCustom = Object.values(qualificacaoRaw).some(
    (v) => typeof v === "string" && v.trim().length > 0,
  );
  const npsRaw = (configs.nps_mensagem ?? {}) as { texto?: string };
  const npsCustom = typeof npsRaw.texto === "string" && npsRaw.texto.trim().length > 0;

  return (
    <AgentsClient
      personaSeeded={personaSeeded}
      personaAtual={typeof chatbotCfg.persona === "string" ? chatbotCfg.persona : ""}
      personaGrupoAtual={typeof chatbotCfg.personaGrupo === "string" ? chatbotCfg.personaGrupo : ""}
      insightsPrompt={insightsPrompt}
      transcricaoPrompt={transcricaoPrompt}
      cacPrompt={cacPrompt}
      qualificacaoCustom={qualificacaoCustom}
      npsCustom={npsCustom}
      automacoesIA={automacoesIA}
    />
  );
}
