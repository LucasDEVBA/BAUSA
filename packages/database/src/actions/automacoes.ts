import { createAuditedSupabaseClient } from "../client/audit";
import { getUserPapel } from "../auth";

export async function criarTarefa(dados: {
  titulo: string;
  descricao?: string;
  responsavel_id: string;
  prazo: string;
  prioridade?: 'critica' | 'alta' | 'media' | 'baixa';
  deal_id?: string;
  modulo_origem?: string;
  criada_automaticamente?: boolean;
  recorrencia?: 'nenhuma' | 'diaria' | 'semanal' | 'mensal';
}) {
  const papel = await getUserPapel();
  if (!papel || !["ceo", "head_sucesso"].includes(papel)) {
    return { success: false, error: "Sem permissao para criar tarefas." };
  }

  const supabase = await createAuditedSupabaseClient();

  const { data, error } = await supabase
    .from("tarefas")
    .insert({
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      responsavel_id: dados.responsavel_id,
      prazo: dados.prazo,
      prioridade: dados.prioridade || "media",
      deal_id: dados.deal_id || null,
      modulo_origem: dados.modulo_origem || "comercial",
      criada_automaticamente: dados.criada_automaticamente || false,
      recorrencia: dados.recorrencia || "nenhuma",
    })
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, tarefaId: data.id };
}

export async function marcarTarefaConcluida(tarefaId: string) {
  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("tarefas")
    .update({
      status: "concluida",
      completed_at: new Date().toISOString(),
    })
    .eq("id", tarefaId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function getNotificacoesNaoLidas() {
  const papel = await getUserPapel();
  const supabase = await createAuditedSupabaseClient();

  let query = supabase
    .from("notificacoes")
    .select("*")
    .eq("lida", false)
    .order("created_at", { ascending: false })
    .limit(50);

  // CEO ve TODAS as notificacoes nao lidas do sistema
  if (papel !== "ceo") {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      query = query.eq("destinatario_id", user.id);
    }
  }

  const { data } = await query;
  return data || [];
}

export async function marcarNotificacaoLida(notificacaoId: string) {
  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true, lida_at: new Date().toISOString() })
    .eq("id", notificacaoId);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function marcarTodasNotificacoesLidas() {
  const supabase = await createAuditedSupabaseClient();

  const { error } = await supabase
    .from("notificacoes")
    .update({ lida: true, lida_at: new Date().toISOString() })
    .eq("lida", false);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
