"use server";

import { revalidatePath } from "next/cache";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import {
  DEAL_STAGES,
  ETAPA_DEAL_LABEL_MAX,
  isDealStage,
  isEtapaDealAccent,
  isValidProbabilidade,
  parseEtapasDealConfig,
  type EtapaDealOverride,
  type EtapasDealConfig,
} from "@/lib/etapas-deal";
import { DEAL_STAGE_CONFIG, type DealStage } from "@/types/deal";
import type { Automacao } from "@/types/automacao";
import type { Agent, AgentResumo } from "@/types/agent";
import { listarAgentsAtivos } from "@/lib/actions/agents";

/**
 * Edição da coluna do Kanban direto no board (modal da própria coluna).
 *
 * Mesma camada de apresentação da aba Pipelines de /configuracoes: as etapas
 * canônicas (enum status_deal) NUNCA mudam — só rótulo, acento, ordem e
 * ocultação, persistidos em configuracoes_sistema.etapas_deal_config.
 * Aqui o merge é PARCIAL (uma etapa por vez), então salvar a coluna A nunca
 * apaga o que o CEO configurou na coluna B.
 */

type Result = { success: true } | { success: false; error: string };

const CHAVE_ETAPAS = "etapas_deal_config";
const CHAVE_PROBABILIDADE = "probabilidade_por_etapa";

async function lerConfig(chave: string): Promise<Record<string, unknown>> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();
  if (error || !data?.valor || typeof data.valor !== "object") return {};
  return data.valor as Record<string, unknown>;
}

async function gravarConfig(chave: string, valor: unknown): Promise<Result> {
  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("configuracoes_sistema")
    .update({ valor })
    .eq("chave", chave);
  if (error) return { success: false, error: `Não foi possível salvar: ${error.message}` };
  return { success: true };
}

export interface SalvarEtapaInput {
  stage: string;
  label: string;
  accent: string;
  oculta: boolean;
  probabilidade: number | null;
}

/** Salva UMA coluna (rótulo/cor/ocultar/probabilidade) preservando as demais. */
export async function salvarEtapaPipeline(input: SalvarEtapaInput): Promise<Result> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem editar as colunas." };
  }
  if (!isDealStage(input.stage)) return { success: false, error: "Etapa inválida." };

  const stage = input.stage as DealStage;
  const base = DEAL_STAGE_CONFIG[stage];
  const label = input.label.trim();
  if (label.length === 0) return { success: false, error: "O nome da coluna não pode ficar vazio." };
  if (label.length > ETAPA_DEAL_LABEL_MAX) {
    return { success: false, error: `Nome muito longo (máx. ${ETAPA_DEAL_LABEL_MAX}).` };
  }
  if (input.accent !== "" && !isEtapaDealAccent(input.accent)) {
    return { success: false, error: "Cor inválida." };
  }

  const atual = parseEtapasDealConfig(await lerConfig(CHAVE_ETAPAS));
  const anterior = atual[stage] ?? {};
  const override: EtapaDealOverride = {};
  // Diff-only (mesma regra da aba Pipelines): só grava o que difere do default.
  if (label !== base.label) override.label = label;
  if (input.accent !== "" && isEtapaDealAccent(input.accent)) override.accent = input.accent;
  if (anterior.order !== undefined) override.order = anterior.order; // ordem é do drag
  if (input.oculta) override.oculta = true;

  const proxima: EtapasDealConfig = { ...atual };
  if (Object.keys(override).length > 0) proxima[stage] = override;
  else delete proxima[stage];

  const r1 = await gravarConfig(CHAVE_ETAPAS, proxima);
  if (!r1.success) return r1;

  if (input.probabilidade !== null) {
    if (!isValidProbabilidade(input.probabilidade)) {
      return { success: false, error: "Probabilidade deve ficar entre 0 e 100." };
    }
    const probs = await lerConfig(CHAVE_PROBABILIDADE);
    const r2 = await gravarConfig(CHAVE_PROBABILIDADE, {
      ...probs,
      [stage]: Math.round(input.probabilidade),
    });
    if (!r2.success) return r2;
  }

  revalidatePath("/pipeline");
  revalidatePath("/configuracoes");
  return { success: true };
}

/**
 * "Cria" uma coluna nova no board: nomeia o primeiro slot custom livre
 * (custom_1..custom_6 — enum fixo, migration 20260904120000) e o revela no
 * fim do board. Sem slot livre, orienta a liberar um (ocultar/renomear).
 */
export async function criarColunaPipeline(input: {
  label: string;
  accent: string;
}): Promise<{ success: true; stage: DealStage } | { success: false; error: string }> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem criar colunas." };
  }
  const label = input.label.trim();
  if (label.length === 0) return { success: false, error: "Dê um nome à coluna." };
  if (label.length > ETAPA_DEAL_LABEL_MAX) {
    return { success: false, error: `Nome muito longo (máx. ${ETAPA_DEAL_LABEL_MAX}).` };
  }
  if (input.accent !== "" && !isEtapaDealAccent(input.accent)) {
    return { success: false, error: "Cor inválida." };
  }

  const atual = parseEtapasDealConfig(await lerConfig(CHAVE_ETAPAS));
  const slotLivre = (DEAL_STAGES.filter(
    (s) => DEAL_STAGE_CONFIG[s].isCustomSlot === true,
  ) as DealStage[]).find((s) => atual[s] === undefined);
  if (!slotLivre) {
    return {
      success: false,
      error: "Limite de 6 colunas personalizadas atingido. Renomeie ou oculte uma existente.",
    };
  }

  // Entra no fim do board: ordem maior que tudo que está configurado/estático.
  const maiorOrdem = Math.max(
    ...DEAL_STAGES.map((s) => atual[s]?.order ?? DEAL_STAGE_CONFIG[s].order),
  );
  const override: EtapaDealOverride = {
    label,
    order: Math.floor(maiorOrdem) + 1,
    oculta: false,
  };
  if (input.accent !== "" && isEtapaDealAccent(input.accent)) override.accent = input.accent;

  const r = await gravarConfig(CHAVE_ETAPAS, { ...atual, [slotLivre]: override });
  if (!r.success) return r;

  revalidatePath("/pipeline");
  revalidatePath("/configuracoes");
  return { success: true, stage: slotLivre };
}

/** Persiste a nova ordem das colunas (drag do board). */
export async function reordenarEtapasPipeline(ordem: string[]): Promise<Result> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem reordenar as colunas." };
  }
  const stages = ordem.filter(isDealStage) as DealStage[];
  if (stages.length === 0) return { success: false, error: "Ordem inválida." };

  const atual = parseEtapasDealConfig(await lerConfig(CHAVE_ETAPAS));
  const proxima: EtapasDealConfig = { ...atual };
  stages.forEach((stage, i) => {
    proxima[stage] = { ...(proxima[stage] ?? {}), order: i + 1 };
  });
  // Etapas fora do board (ocultas/terminais) vão para o fim, preservando o
  // resto do override — nunca colidem com a faixa 1..n das visíveis.
  let resto = stages.length + 1;
  for (const stage of DEAL_STAGES) {
    if (stages.includes(stage)) continue;
    const anterior = proxima[stage];
    if (anterior?.order === undefined) continue;
    proxima[stage] = { ...anterior, order: 90 + resto++ };
  }

  const r = await gravarConfig(CHAVE_ETAPAS, proxima);
  if (!r.success) return r;
  revalidatePath("/pipeline");
  revalidatePath("/configuracoes");
  return { success: true };
}

export interface ContextoColuna {
  automacoes: Automacao[];
  usuarios: { id: string; nome: string; papel: string }[];
  /** Resumo (id/nome/descrição) p/ o seletor de IA do builder. */
  agents: AgentResumo[];
  /** Agents completos p/ o CRUD embutido — mesmo gate CEO da tela /agents. */
  agentsCompletos: Agent[];
}

/**
 * Uma automação "é desta coluna" quando:
 *   • dispara ao ENTRAR nela — gatilho `deal_etapa_mudou` + etapa_para; ou
 *   • age sobre quem está PARADO nela — gatilho `deal_parado_etapa` com uma
 *     condição `etapa = <stage>` (é assim que a cadência D+N se prende à
 *     coluna, já que o finder de tempo não filtra etapa).
 * Nada de schema novo — e por isso elas seguem visíveis em /automacoes.
 */
function pertenceAEtapa(a: Automacao, stage: DealStage): boolean {
  if (a.gatilho === "deal_etapa_mudou") {
    return (a.gatilho_config as { etapa_para?: string } | null)?.etapa_para === stage;
  }
  if (a.gatilho === "deal_parado_etapa") {
    const condicoes = Array.isArray(a.condicoes) ? a.condicoes : [];
    return condicoes.some(
      (c) => c?.campo === "etapa" && String(c?.valor) === stage,
    );
  }
  return false;
}

/**
 * Automações ligadas a ESTA coluna + o contexto que o BuilderScreen exige.
 */
export async function carregarContextoColuna(stage: string): Promise<
  { success: true; data: ContextoColuna } | { success: false; error: string }
> {
  if ((await getUserPapel()) !== "ceo") {
    return { success: false, error: "Apenas CEO/CTO podem ver as automações da coluna." };
  }
  if (!isDealStage(stage)) return { success: false, error: "Etapa inválida." };

  const supabase = await createServerSupabaseClient();
  const [{ data: automacoes, error }, { data: usuarios }, agents, { data: agentsCompletos }] =
    await Promise.all([
      // Filtro por etapa em JS: cobre os dois vínculos (entrada e parado)
      // sem um `or=` aninhado de PostgREST difícil de manter.
      supabase
        .from("automacoes")
        .select("id, nome, descricao, gatilho, gatilho_config, condicoes, acoes, passos, ativo, created_at, updated_at")
        .in("gatilho", ["deal_etapa_mudou", "deal_parado_etapa"])
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase.from("user_profiles").select("id, nome, papel").eq("ativo", true).order("nome"),
      listarAgentsAtivos("automacao"),
      supabase
        .from("agents")
        .select("id, nome, descricao, prompt, capacidades, ativo, created_at, updated_at")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
    ]);

  if (error) return { success: false, error: "Não foi possível carregar as automações." };

  return {
    success: true,
    data: {
      automacoes: ((automacoes ?? []) as unknown as Automacao[]).filter((a) =>
        pertenceAEtapa(a, stage as DealStage),
      ),
      usuarios: (usuarios ?? []) as { id: string; nome: string; papel: string }[],
      agents,
      agentsCompletos: (agentsCompletos ?? []) as unknown as Agent[],
    },
  };
}
