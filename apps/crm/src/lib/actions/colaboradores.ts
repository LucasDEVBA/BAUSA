"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getUserPapel } from "@/lib/auth";
import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import type { Colaborador } from "@/types/financeiro";

const TIPO_CONTRATO = ["clt", "pj", "socio", "estagio", "outro"] as const;

const NAO_AUTORIZADO = "Apenas o CEO pode gerenciar a folha." as const;

// Campos SEM default — no update parcial, um default reintroduzido sobrescreveria
// o banco (ex.: renomear um colaborador desligado o reativaria com ativo=true).
const colaboradorShape = {
  nome: z.string().trim().min(2, "Informe o nome do colaborador.").max(120),
  cargo: z.string().trim().max(120).optional().nullable(),
  cpf: z.string().trim().max(20).optional().nullable(),
  tipo_contrato: z.enum(TIPO_CONTRATO),
  custo_mensal_brl: z.number().nonnegative("O custo não pode ser negativo."),
  ativo: z.boolean(),
  data_admissao: z.string().date().optional().nullable(),
  data_desligamento: z.string().date().optional().nullable(),
  observacao: z.string().trim().max(500).optional().nullable(),
};

// Create: ativo tem default true só aqui. Update: parcial, sem defaults.
const colaboradorSchema = z.object({ ...colaboradorShape, ativo: z.boolean().default(true) });
const colaboradorUpdateSchema = z.object(colaboradorShape).partial();

export type ColaboradorInput = z.input<typeof colaboradorSchema>;
type ActionResult = { success: true; id?: string } | { success: false; error: string };

async function assertCeo(): Promise<{ ok: true } | { ok: false; error: string }> {
  const papel = await getUserPapel();
  if (papel !== "ceo") return { ok: false, error: NAO_AUTORIZADO };
  return { ok: true };
}

export async function listarColaboradores(): Promise<Colaborador[]> {
  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("colaboradores")
    .select("*")
    .is("deleted_at", null)
    .order("ativo", { ascending: false })
    .order("nome", { ascending: true });
  return (data as Colaborador[] | null) ?? [];
}

export async function criarColaborador(input: ColaboradorInput): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = colaboradorSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("colaboradores")
    .insert(parsed.data)
    .select("id")
    .single();

  if (error || !data) {
    return { success: false, error: `Erro ao criar colaborador: ${error?.message ?? "desconhecido"}` };
  }

  revalidatePath("/financeiro");
  return { success: true, id: data.id };
}

export async function atualizarColaborador(
  id: string,
  input: Partial<ColaboradorInput>,
): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  const parsed = colaboradorUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase.from("colaboradores").update(parsed.data).eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/financeiro");
  return { success: true };
}

export async function removerColaborador(id: string): Promise<ActionResult> {
  const auth = await assertCeo();
  if (!auth.ok) return { success: false, error: auth.error };

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("colaboradores")
    .update({ deleted_at: new Date().toISOString(), ativo: false })
    .eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/financeiro");
  return { success: true };
}
