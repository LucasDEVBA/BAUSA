"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getUserPapel } from "@/lib/auth";
import {
  combineAlertDaysFromInatividade,
  parseFasesFamiliaConfig,
  type FasesFamiliaConfig,
} from "@/lib/fases-familia";

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

  const { error } = await supabase
    .from("configuracoes_sistema")
    .update({ valor: JSON.parse(JSON.stringify(valor)), updated_by: user?.id })
    .eq("chave", chave);

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
