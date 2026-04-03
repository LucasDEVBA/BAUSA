import { createAuditedSupabaseClient } from "../client/audit";
import { getUserPapel } from "../auth";

export async function marcarRecompensaEntregue(indicacaoId: string, descricao: string) {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { success: false, error: "Apenas o CEO." };

  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("indicacoes")
    .update({
      recompensa_entregue: true,
      recompensa_entregue_at: new Date().toISOString(),
      recompensa_descricao: descricao,
    })
    .eq("id", indicacaoId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
