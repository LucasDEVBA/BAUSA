"use server";

import { createAuditedSupabaseClient } from "@/lib/crm/supabase-audit";
import { getUserPapel } from "@/lib/crm/auth";

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
