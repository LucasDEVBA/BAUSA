"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";

export async function atualizarTarefa(
  tarefaId: string,
  dados: {
    titulo?: string;
    descricao?: string;
    prazo?: string;
    prioridade?: "critica" | "alta" | "media" | "baixa";
    modulo_origem?: string;
    responsavel_id?: string;
    recorrencia?: "nenhuma" | "diaria" | "semanal" | "mensal";
  },
) {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { success: false, error: "Sem permissao para editar tarefas." };
  }

  const supabase = await createAuditedSupabaseClient();

  const updateData: Record<string, unknown> = {};
  if (dados.titulo !== undefined) updateData.titulo = dados.titulo;
  if (dados.descricao !== undefined) updateData.descricao = dados.descricao || null;
  if (dados.prazo !== undefined) updateData.prazo = dados.prazo;
  if (dados.prioridade !== undefined) updateData.prioridade = dados.prioridade;
  if (dados.modulo_origem !== undefined) updateData.modulo_origem = dados.modulo_origem;
  if (dados.responsavel_id !== undefined) updateData.responsavel_id = dados.responsavel_id;
  if (dados.recorrencia !== undefined) updateData.recorrencia = dados.recorrencia;
  updateData.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("tarefas")
    .update(updateData)
    .eq("id", tarefaId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
