"use server";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { notificarAtribuicaoTarefa } from "@/lib/notificacoes";

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

  // Estado atual (p/ detectar reatribuição e notificar o novo responsável).
  const { data: atual } = await supabase
    .from("tarefas")
    .select("responsavel_id, titulo")
    .eq("id", tarefaId)
    .single();

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

  // Notifica só quando o responsável de fato mudou.
  if (
    dados.responsavel_id &&
    atual?.responsavel_id &&
    dados.responsavel_id !== atual.responsavel_id
  ) {
    await notificarAtribuicaoTarefa(supabase, {
      responsavelId: dados.responsavel_id,
      titulo: (dados.titulo ?? atual.titulo) as string,
    });
  }

  return { success: true };
}
