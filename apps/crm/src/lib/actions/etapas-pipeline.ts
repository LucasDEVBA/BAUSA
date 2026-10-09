"use server";

import { revalidatePath } from "next/cache";

import { getUserPapel } from "@/lib/auth";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import {
  ACAO_PADRAO_DIAS_MAX,
  ACAO_PADRAO_TEXTO_MAX,
  ACAO_PADRAO_TEXTO_MIN,
  DEAL_STAGES,
  ETAPA_DEAL_LABEL_MAX,
  isDealStage,
  isEtapaDealAccent,
  isValidProbabilidade,
  parseEtapasDealConfig,
  parseEtapasDealRegras,
  slotCustomLivre,
  type EtapaDealOverride,
  type EtapaDealRegra,
  type EtapasDealConfig,
  type EtapasDealRegras,
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
 * ocultação (etapas_deal_config) e, desde 2026-10, as REGRAS de comportamento
 * da coluna (etapas_deal_regras: ganho / pedir plano / próxima ação padrão).
 * Aqui o merge é PARCIAL (uma etapa por vez), então salvar a coluna A nunca
 * apaga o que o CEO configurou na coluna B.
 */

type Result = { success: true } | { success: false; error: string };

const CHAVE_ETAPAS = "etapas_deal_config";
const CHAVE_PROBABILIDADE = "probabilidade_por_etapa";
const CHAVE_REGRAS = "etapas_deal_regras";

const ERRO_LEITURA =
  "Não foi possível ler a configuração atual das colunas — nada foi salvo. Tente de novo.";

/**
 * Lê uma chave de config. ERRO de leitura ≠ chave ausente: com erro, quem
 * grava o JSON inteiro de volta apagaria a config das outras colunas — por
 * isso o chamador ABORTA (`ok: false`); ausente/vazia = `{}`.
 */
async function lerConfig(
  chave: string,
): Promise<{ ok: true; valor: Record<string, unknown> } | { ok: false }> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("configuracoes_sistema")
    .select("valor")
    .eq("chave", chave)
    .maybeSingle();
  if (error) {
    console.error({ level: "error", action: "etapas_pipeline_ler_config", chave, error: error.message });
    return { ok: false };
  }
  if (!data?.valor || typeof data.valor !== "object" || Array.isArray(data.valor)) {
    return { ok: true, valor: {} };
  }
  return { ok: true, valor: data.valor as Record<string, unknown> };
}

/** UPSERT: chave nova não depende de seed (classe "PATCH sem seed é no-op"). */
async function gravarConfigUpsert(chave: string, valor: unknown): Promise<Result> {
  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("configuracoes_sistema")
    .upsert({ chave, valor }, { onConflict: "chave" });
  if (error) return { success: false, error: `Não foi possível salvar: ${error.message}` };
  return { success: true };
}

export interface RegrasColunaInput {
  /** Só vale para colunas personalizadas (custom_*). */
  ganho: boolean;
  pedePlano: boolean;
  /** "" = sem ação padrão. */
  acaoPadraoTexto: string;
  acaoPadraoDias: number;
}

function validarRegras(
  stage: DealStage,
  input: RegrasColunaInput,
): { ok: true; regra: EtapaDealRegra } | { ok: false; error: string } {
  const regra: EtapaDealRegra = {};
  if (DEAL_STAGE_CONFIG[stage].isCustomSlot === true && input.ganho === true) {
    regra.ganho = true;
  }
  if (typeof input.pedePlano !== "boolean") {
    return { ok: false, error: "Valor inválido em \"Pedir o plano ao entrar\"." };
  }
  regra.pede_plano = input.pedePlano;
  const texto = (input.acaoPadraoTexto ?? "").trim();
  if (texto.length > 0) {
    if (texto.length < ACAO_PADRAO_TEXTO_MIN || texto.length > ACAO_PADRAO_TEXTO_MAX) {
      return {
        ok: false,
        error: `A próxima ação padrão precisa ter entre ${ACAO_PADRAO_TEXTO_MIN} e ${ACAO_PADRAO_TEXTO_MAX} caracteres.`,
      };
    }
    if (
      !Number.isInteger(input.acaoPadraoDias) ||
      input.acaoPadraoDias < 0 ||
      input.acaoPadraoDias > ACAO_PADRAO_DIAS_MAX
    ) {
      return {
        ok: false,
        error: `O prazo da próxima ação deve ficar entre 0 e ${ACAO_PADRAO_DIAS_MAX} dias.`,
      };
    }
    regra.acao_padrao = { texto, dias: input.acaoPadraoDias };
  }
  return { ok: true, regra };
}

/** Grava a regra de UMA coluna preservando as demais (null = remove). */
async function gravarRegraColuna(stage: DealStage, regra: EtapaDealRegra | null): Promise<Result> {
  const lida = await lerConfig(CHAVE_REGRAS);
  if (!lida.ok) return { success: false, error: ERRO_LEITURA };
  const proximas: EtapasDealRegras = { ...parseEtapasDealRegras(lida.valor) };
  if (regra && Object.keys(regra).length > 0) proximas[stage] = regra;
  else delete proximas[stage];
  return gravarConfigUpsert(CHAVE_REGRAS, proximas);
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
  /** Regras de comportamento; ausente = não mexe nelas (compat). */
  regras?: RegrasColunaInput;
}

/** Salva UMA coluna (rótulo/cor/ocultar/probabilidade/regras) preservando as demais. */
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
  // Valida TUDO antes da 1ª escrita (antes, probabilidade inválida chegava
  // depois de gravar o rótulo — salvamento parcial).
  if (input.probabilidade !== null && !isValidProbabilidade(input.probabilidade)) {
    return { success: false, error: "Probabilidade deve ficar entre 0 e 100." };
  }
  const regraValidada = input.regras ? validarRegras(stage, input.regras) : null;
  if (regraValidada && !regraValidada.ok) return { success: false, error: regraValidada.error };

  const lida = await lerConfig(CHAVE_ETAPAS);
  if (!lida.ok) return { success: false, error: ERRO_LEITURA };
  const atual = parseEtapasDealConfig(lida.valor);
  const anterior = atual[stage] ?? {};
  const override: EtapaDealOverride = {};
  // Diff-only (mesma regra da aba Pipelines): só grava o que difere do default.
  if (label !== base.label) override.label = label;
  if (input.accent !== "" && isEtapaDealAccent(input.accent)) override.accent = input.accent;
  if (anterior.order !== undefined) override.order = anterior.order; // ordem é do drag
  // Visibilidade grava quando difere do PADRÃO da etapa: slots custom e
  // plano_escolhido nascem ocultos — sem o `oculta:false` explícito, salvar
  // uma coluna personalizada VISÍVEL a escondia (bug latente até 2026-10).
  const ocultaPorPadrao = base.isCustomSlot === true || base.ocultaPorPadrao === true;
  if (input.oculta !== ocultaPorPadrao) override.oculta = input.oculta;

  const proxima: EtapasDealConfig = { ...atual };
  if (Object.keys(override).length > 0) proxima[stage] = override;
  else delete proxima[stage];

  const r1 = await gravarConfig(CHAVE_ETAPAS, proxima);
  if (!r1.success) return r1;

  if (regraValidada?.ok) {
    const rr = await gravarRegraColuna(stage, regraValidada.regra);
    if (!rr.success) {
      return { success: false, error: `Nome e cor salvos, mas o comportamento não: ${rr.error}` };
    }
  }

  if (input.probabilidade !== null) {
    const probs = await lerConfig(CHAVE_PROBABILIDADE);
    if (!probs.ok) return { success: false, error: ERRO_LEITURA };
    const r2 = await gravarConfig(CHAVE_PROBABILIDADE, {
      ...probs.valor,
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
  /** Coluna nasce contando como negócio GANHO (T20). */
  ganho?: boolean;
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

  const lida = await lerConfig(CHAVE_ETAPAS);
  if (!lida.ok) return { success: false, error: ERRO_LEITURA };
  const atual = parseEtapasDealConfig(lida.valor);
  // Livre = nunca nomeado e não tornado visível. Só `order` (gravado pelo
  // arraste de colunas em TODAS as etapas do Kanban) NÃO ocupa o slot — antes
  // `atual[s] === undefined` dava "limite atingido" com 4 slots vazios.
  const slotLivre = (DEAL_STAGES.filter(
    (s) => DEAL_STAGE_CONFIG[s].isCustomSlot === true,
  ) as DealStage[]).find((s) => slotCustomLivre(atual[s]));
  if (!slotLivre) {
    return {
      success: false,
      error: "Limite de 6 colunas personalizadas atingido. Renomeie uma coluna personalizada existente.",
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

  // Slot reaproveitado nunca herda regra antiga (ganho/plano/ação padrão).
  const rr = await gravarRegraColuna(slotLivre, input.ganho === true ? { ganho: true } : null);
  if (!rr.success) {
    return { success: false, error: `Coluna criada, mas o comportamento não foi salvo: ${rr.error}` };
  }

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

  const lida = await lerConfig(CHAVE_ETAPAS);
  if (!lida.ok) return { success: false, error: ERRO_LEITURA };
  const atual = parseEtapasDealConfig(lida.valor);
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
