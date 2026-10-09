"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";
import {
  combineAlertDaysFromInatividade,
  parseFasesFamiliaConfig,
  type FasesFamiliaConfig,
} from "@/lib/fases-familia";
import {
  DEAL_STAGES,
  ETAPAS_GANHO_FIXAS,
  SLOTS_CUSTOM,
  etapasGanho,
  mergeDealStageConfig,
  mergeProbabilidadePorEtapa,
  parseEtapasDealConfig,
  parseEtapasDealRegras,
  PROBABILIDADE_ETAPA_FALLBACK,
  type DealStageConfigMap,
  type EtapasDealConfig,
  type EtapasDealRegras,
} from "@/lib/etapas-deal";
import type { DealStage } from "@/types/deal";

export async function getConfiguracoes() {
  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase.from("configuracoes_sistema").select("*").order("chave");
  const map: Record<string, unknown> = {};
  (data || []).forEach((c: { chave: string; valor: unknown }) => { map[c.chave] = c.valor; });
  return map;
}

export async function atualizarConfiguracao(chave: string, valor: unknown) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  // UPSERT (não UPDATE): antes, uma chave inexistente afetava 0 linhas e a
  // action ainda retornava sucesso — a UI dizia "Configuração atualizada" e o
  // valor sumia no reload. Com upsert a chave é criada na hora.
  const { error } = await supabase
    .from("configuracoes_sistema")
    .upsert(
      {
        chave,
        valor: JSON.parse(JSON.stringify(valor)),
        updated_by: user?.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "chave" },
    );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Overrides das fases da jornada da família configurados pelo CEO.
 * Combina `fases_familia_config` (rótulo/descrição/ordem/alerta) com
 * `inatividade_por_fase` (dias de alerta — só preenche o que faltar).
 * Fail-open: qualquer erro retorna `{}` e a UI usa os defaults do código —
 * uma config quebrada nunca derruba as páginas de família.
 */
export async function getFasesFamiliaConfigOverrides(): Promise<FasesFamiliaConfig> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("chave, valor")
      .in("chave", ["fases_familia_config", "inatividade_por_fase"]);

    if (error || !data) {
      if (error) {
        console.error({
          level: "error",
          action: "get_fases_familia_config",
          error: error.message,
        });
      }
      return {};
    }

    const byChave = new Map(
      (data as { chave: string; valor: unknown }[]).map((row) => [
        row.chave,
        row.valor,
      ]),
    );
    const overrides = parseFasesFamiliaConfig(
      byChave.get("fases_familia_config"),
    );
    return combineAlertDaysFromInatividade(
      overrides,
      byChave.get("inatividade_por_fase"),
    );
  } catch (err) {
    console.error({
      level: "error",
      action: "get_fases_familia_config",
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

/**
 * Overrides de apresentação das etapas do pipeline comercial configurados
 * pelo CEO (chave `etapas_deal_config`). Fail-open: qualquer erro retorna
 * `{}` e a UI usa os defaults do código — uma config quebrada nunca derruba
 * o Pipeline.
 */
export async function getEtapasDealConfigOverrides(): Promise<EtapasDealConfig> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "etapas_deal_config")
      .maybeSingle();

    if (error) {
      console.error({
        level: "error",
        action: "get_etapas_deal_config",
        error: error.message,
      });
      return {};
    }
    return parseEtapasDealConfig(data?.valor);
  } catch (err) {
    console.error({
      level: "error",
      action: "get_etapas_deal_config",
      error: err instanceof Error ? err.message : String(err),
    });
    return {};
  }
}

/**
 * Probabilidade de fechamento por etapa: lê a chave seed
 * `probabilidade_por_etapa` (JSONB {etapa: 0-100}) e mescla sobre o
 * fallback hardcoded. Fail-open: erro/valor inválido → fallback — o
 * moverDeal nunca fica sem mapa.
 */
export async function getProbabilidadePorEtapa(): Promise<Record<string, number>> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("valor")
      .eq("chave", "probabilidade_por_etapa")
      .maybeSingle();

    if (error) {
      console.error({
        level: "error",
        action: "get_probabilidade_por_etapa",
        error: error.message,
      });
      return { ...PROBABILIDADE_ETAPA_FALLBACK };
    }
    return mergeProbabilidadePorEtapa(data?.valor);
  } catch (err) {
    console.error({
      level: "error",
      action: "get_probabilidade_por_etapa",
      error: err instanceof Error ? err.message : String(err),
    });
    return { ...PROBABILIDADE_ETAPA_FALLBACK };
  }
}

/** Config completa das etapas de deal numa leitura só (moverDeal, /pipeline, métricas). */
export interface ConfigEtapasDeal {
  /** Apresentação (rótulo/cor/ordem/oculta) — chave etapas_deal_config. */
  overrides: EtapasDealConfig;
  /** Comportamento (ganho/pede_plano/acao_padrao) — chave etapas_deal_regras. */
  regras: EtapasDealRegras;
  /** probabilidade_por_etapa mesclada com o fallback. */
  probabilidade: Record<string, number>;
  /** false = leitura falhou (defaults do código em uso). Consumidores
   *  fail-closed (remarketing) tratam TODA coluna personalizada como ganho. */
  lida: boolean;
}

const CHAVES_ETAPAS_DEAL = ["etapas_deal_config", "etapas_deal_regras", "probabilidade_por_etapa"];

export async function getConfigEtapasDeal(): Promise<ConfigEtapasDeal> {
  const falha: ConfigEtapasDeal = {
    overrides: {},
    regras: {},
    probabilidade: { ...PROBABILIDADE_ETAPA_FALLBACK },
    lida: false,
  };
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("configuracoes_sistema")
      .select("chave, valor")
      .in("chave", CHAVES_ETAPAS_DEAL);
    if (error || !data) {
      console.error({
        level: "error",
        action: "get_config_etapas_deal",
        error: error?.message ?? "sem dados",
      });
      return falha;
    }
    const porChave = new Map(
      (data as { chave: string; valor: unknown }[]).map((row) => [row.chave, row.valor]),
    );
    return {
      overrides: parseEtapasDealConfig(porChave.get("etapas_deal_config")),
      regras: parseEtapasDealRegras(porChave.get("etapas_deal_regras")),
      probabilidade: mergeProbabilidadePorEtapa(porChave.get("probabilidade_por_etapa")),
      lida: true,
    };
  } catch (err) {
    console.error({
      level: "error",
      action: "get_config_etapas_deal",
      error: err instanceof Error ? err.message : String(err),
    });
    return falha;
  }
}

/**
 * Etapas que contam como GANHO (fixas + colunas personalizadas marcadas).
 * `falhaComoGanho`: se a config não puder ser lida, TODAS as colunas
 * personalizadas contam como ganho — usar onde o erro mandaria mensagem a
 * família pagante (remarketing). Métricas usam o default (só as fixas).
 */
export async function getEtapasGanho(opts?: { falhaComoGanho?: boolean }): Promise<DealStage[]> {
  const cfg = await getConfigEtapasDeal();
  if (!cfg.lida && opts?.falhaComoGanho) {
    return [...ETAPAS_GANHO_FIXAS, ...SLOTS_CUSTOM];
  }
  return etapasGanho(mergeDealStageConfig(cfg.overrides, cfg.regras));
}

/**
 * Config MESCLADA das colunas (apresentação + regras) — a MESMA que o board
 * desenha. Toda tela FORA do /pipeline que abre o editor do deal (/leads,
 * /remarketing) usa esta: rótulos do CEO, ordem do board, ocultas, ganho e
 * pede-plano. Fail-open como o board: leitura falha → defaults do código.
 */
export async function getStageConfigDeal(): Promise<DealStageConfigMap> {
  const cfg = await getConfigEtapasDeal();
  return mergeDealStageConfig(cfg.overrides, cfg.regras);
}

/** Nome de exibição (rótulo do CEO) de cada etapa — para textos server-side (T17). */
export async function getRotulosEtapas(): Promise<Record<DealStage, string>> {
  const cfg = await getConfigEtapasDeal();
  const merged = mergeDealStageConfig(cfg.overrides, cfg.regras);
  const out = {} as Record<DealStage, string>;
  for (const stage of DEAL_STAGES) out[stage] = merged[stage].label;
  return out;
}

export async function atualizarMultiplasConfiguracoes(configs: Record<string, unknown>) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  let atualizadas = 0;

  for (const [chave, valor] of Object.entries(configs)) {
    const { error } = await supabase
      .from("configuracoes_sistema")
      .update({ valor: JSON.parse(JSON.stringify(valor)), updated_by: user?.id })
      .eq("chave", chave);
    if (!error) atualizadas++;
  }

  return { success: true, atualizadas };
}
