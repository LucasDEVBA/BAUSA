"use server";

import { revalidatePath } from "next/cache";

import { createAuditedSupabaseClient } from "@/lib/supabase-audit";
import { getUserPapel } from "@/lib/auth";
import { registrarEventoGamificacao, type ResultadoGamificacao } from "@/lib/gamificacao";
import type { QuadroColuna } from "@/types/crm";

type ActionResult =
  | { success: true; gamificacao?: ResultadoGamificacao | null }
  | { success: false; error: string };

const COLUNAS: QuadroColuna[] = ["backlog", "a_fazer", "fazendo", "feito"];

/** status_tarefa derivado da coluna do quadro (mantém consumidores legados). */
function statusDaColuna(coluna: QuadroColuna): "pendente" | "em_andamento" | "concluida" {
  if (coluna === "feito") return "concluida";
  if (coluna === "fazendo") return "em_andamento";
  return "pendente";
}

async function exigirGestor(): Promise<string | null> {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) return null;
  return papel;
}

/**
 * Move uma tarefa entre colunas do quadro e mantém `status`/`completed_at`
 * sincronizados (fonte legada para War Room/automações).
 */
export async function moverTarefaQuadro(
  tarefaId: string,
  coluna: QuadroColuna,
): Promise<ActionResult> {
  if (!COLUNAS.includes(coluna)) {
    return { success: false, error: "Coluna inválida." };
  }
  if (!(await exigirGestor())) {
    return { success: false, error: "Sem permissão para mover tarefas." };
  }

  const supabase = await createAuditedSupabaseClient();

  // Pré-leitura para o XP: só pontua a TRANSIÇÃO para "feito" (re-arrastar
  // uma tarefa já concluída não gera ponto de novo).
  const { data: antes } = await supabase
    .from("tarefas")
    .select("quadro_coluna")
    .eq("id", tarefaId)
    .maybeSingle();
  const jaEstavaFeita = (antes as { quadro_coluna?: QuadroColuna } | null)?.quadro_coluna === "feito";

  const agora = new Date().toISOString();
  const { data, error } = await supabase
    .from("tarefas")
    .update({
      quadro_coluna: coluna,
      status: statusDaColuna(coluna),
      completed_at: coluna === "feito" ? agora : null,
      updated_at: agora,
    })
    .eq("id", tarefaId)
    .select("id");

  if (error) return { success: false, error: error.message };
  // RLS pode filtrar sem erro (0 linhas) — não deixar a UI achar que persistiu.
  if (!data || data.length === 0) {
    return { success: false, error: "Tarefa não encontrada ou sem permissão." };
  }

  const gamificacao =
    coluna === "feito" && !jaEstavaFeita
      ? await registrarEventoGamificacao("tarefa_concluida", { tipo: "tarefa", id: tarefaId })
      : null;

  revalidatePath("/tarefas");
  return { success: true, gamificacao };
}

/** Vincula (ou desvincula, com null) uma tarefa a uma sprint. */
export async function atribuirSprintTarefa(
  tarefaId: string,
  sprintId: string | null,
): Promise<ActionResult> {
  if (!(await exigirGestor())) {
    return { success: false, error: "Sem permissão para alterar a sprint." };
  }
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("tarefas")
    .update({ sprint_id: sprintId, updated_at: new Date().toISOString() })
    .eq("id", tarefaId)
    .select("id");

  if (error) return { success: false, error: error.message };
  if (!data || data.length === 0) {
    return { success: false, error: "Tarefa não encontrada ou sem permissão." };
  }
  revalidatePath("/tarefas");
  return { success: true };
}

export async function criarSprint(dados: {
  nome: string;
  objetivo?: string;
  data_inicio?: string;
  data_fim?: string;
  status?: "planejada" | "ativa" | "concluida";
}): Promise<{ success: true; sprintId: string } | { success: false; error: string }> {
  if (!(await exigirGestor())) {
    return { success: false, error: "Sem permissão para criar sprints." };
  }
  const nome = dados.nome?.trim();
  if (!nome) return { success: false, error: "Nome da sprint é obrigatório." };

  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("sprints")
    .insert({
      nome,
      objetivo: dados.objetivo?.trim() || null,
      data_inicio: dados.data_inicio || null,
      data_fim: dados.data_fim || null,
      status: dados.status ?? "planejada",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  revalidatePath("/tarefas");
  return { success: true, sprintId: data.id as string };
}

export async function atualizarSprint(
  sprintId: string,
  dados: {
    nome?: string;
    objetivo?: string;
    data_inicio?: string | null;
    data_fim?: string | null;
    status?: "planejada" | "ativa" | "concluida";
  },
): Promise<ActionResult> {
  if (!(await exigirGestor())) {
    return { success: false, error: "Sem permissão para editar sprints." };
  }
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (dados.nome !== undefined) {
    const nome = dados.nome.trim();
    if (!nome) return { success: false, error: "Nome da sprint é obrigatório." };
    update.nome = nome;
  }
  if (dados.objetivo !== undefined) update.objetivo = dados.objetivo.trim() || null;
  if (dados.data_inicio !== undefined) update.data_inicio = dados.data_inicio || null;
  if (dados.data_fim !== undefined) update.data_fim = dados.data_fim || null;
  if (dados.status !== undefined) update.status = dados.status;

  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase.from("sprints").update(update).eq("id", sprintId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tarefas");
  return { success: true };
}

/** Soft-delete da sprint. As tarefas ficam sem sprint (sprint_id preservado, mas a sprint some das listas). */
export async function excluirSprint(sprintId: string): Promise<ActionResult> {
  const papel = await getUserPapel();
  if (papel !== "ceo") {
    return { success: false, error: "Apenas o CEO pode excluir sprints." };
  }
  const supabase = await createAuditedSupabaseClient();
  // Desvincula as tarefas antes de remover a sprint (evita órfãs no quadro).
  await supabase.from("tarefas").update({ sprint_id: null }).eq("sprint_id", sprintId);
  const { error } = await supabase
    .from("sprints")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sprintId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/tarefas");
  return { success: true };
}
