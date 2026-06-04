"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel, getSession } from "@/lib/auth";

// ════════════════════════════════════════════════════════════════════════
// Server actions — gasto de marketing manual (CAC/ROI Dashboard, Fase 1)
// Apenas CEO. Upsert por (mes, canal, source='manual') — editar não duplica.
// ════════════════════════════════════════════════════════════════════════

const CANAIS = [
  "instagram",
  "facebook",
  "google",
  "meta",
  "tiktok",
  "youtube",
  "outro",
] as const;

const investimentoSchema = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}$/, "Mês inválido (use YYYY-MM)"),
  canal: z.enum(CANAIS),
  valor_gasto: z.coerce.number().nonnegative("Valor não pode ser negativo"),
  impressoes: z.coerce.number().int().nonnegative().optional(),
  cliques: z.coerce.number().int().nonnegative().optional(),
  leads_gerados: z.coerce.number().int().nonnegative().optional(),
  observacao: z.string().max(500).optional(),
});

export type InvestimentoInput = z.input<typeof investimentoSchema>;

type ActionResult = { success: boolean; error?: string };

export async function salvarInvestimento(
  input: InvestimentoInput,
): Promise<ActionResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode registrar gastos." };
  }

  const parsed = investimentoSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { success: false, error: first?.message ?? "Dados inválidos." };
  }

  const dados = parsed.data;
  const supabase = await createAuditedSupabaseClient();
  const user = await getSession();

  const { error } = await supabase
    .from("investimentos_marketing")
    .upsert(
      {
        mes: `${dados.mes}-01`,
        canal: dados.canal,
        valor_gasto: dados.valor_gasto,
        impressoes: dados.impressoes ?? null,
        cliques: dados.cliques ?? null,
        leads_gerados: dados.leads_gerados ?? null,
        observacao: dados.observacao ?? null,
        source: "manual",
        deleted_at: null,
        created_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "mes,canal,source" },
    );

  if (error) {
    return { success: false, error: `Erro ao salvar: ${error.message}` };
  }

  revalidatePath("/analytics/cac");
  return { success: true };
}

export async function deletarInvestimento(id: string): Promise<ActionResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode remover gastos." };
  }

  if (!id || typeof id !== "string") {
    return { success: false, error: "ID inválido." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("investimentos_marketing")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .is("deleted_at", null);

  if (error) {
    return { success: false, error: `Erro ao remover: ${error.message}` };
  }

  revalidatePath("/analytics/cac");
  return { success: true };
}
