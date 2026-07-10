import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Cria uma notificação in-app para o responsável de uma tarefa recém-atribuída.
 * Nunca lança: falha de notificação não pode abortar a operação principal.
 * `tarefas.responsavel_id` é o próprio `auth.uid()`, então serve de destinatário.
 * O CEO já enxerga todas as notificações (regra de espelhamento) — sem row extra.
 */
export async function notificarAtribuicaoTarefa(
  supabase: SupabaseClient,
  args: { responsavelId: string; titulo: string },
): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!args.responsavelId || args.responsavelId === user?.id) return;
    await supabase.from("notificacoes").insert({
      destinatario_id: args.responsavelId,
      titulo: "Nova tarefa atribuída",
      mensagem: args.titulo,
      tipo: "tarefa",
      severidade: "media",
      link: "/tarefas",
    });
  } catch (err) {
    console.warn("[notificarAtribuicaoTarefa] falhou", err);
  }
}
