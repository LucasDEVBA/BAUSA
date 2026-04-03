import { createAuditedSupabaseClient } from "../client/audit";

export async function listarDocumentos(atletaId: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("documentos_atleta")
    .select("*")
    .eq("atleta_id", atletaId)
    .is("deleted_at", null)
    .order("tipo", { ascending: true });
  return data || [];
}

export async function adicionarDocumento(atletaId: string, dados: {
  tipo: string;
  escola_id?: string;
  arquivo_url?: string;
  arquivo_nome?: string;
  deadline?: string;
  observacao?: string;
}) {
  const supabase = await createAuditedSupabaseClient();
  const { data, error } = await supabase
    .from("documentos_atleta")
    .insert({
      atleta_id: atletaId,
      tipo: dados.tipo,
      escola_id: dados.escola_id || null,
      arquivo_url: dados.arquivo_url || null,
      arquivo_nome: dados.arquivo_nome || null,
      deadline: dados.deadline || null,
      observacao: dados.observacao || null,
      data_upload: dados.arquivo_url ? new Date().toISOString() : null,
    })
    .select("id")
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, documentoId: data.id };
}

export async function atualizarArquivoDocumento(
  documentoId: string,
  arquivoUrl: string,
  arquivoNome: string,
) {
  const supabase = await createAuditedSupabaseClient();
  const { error } = await supabase
    .from("documentos_atleta")
    .update({
      arquivo_url: arquivoUrl,
      arquivo_nome: arquivoNome,
      data_upload: new Date().toISOString(),
    })
    .eq("id", documentoId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function atualizarStatusDocumento(documentoId: string, status: string) {
  const supabase = await createAuditedSupabaseClient();
  const updateData: Record<string, unknown> = { status };
  if (status === "enviado_escola") {
    updateData.data_envio_escola = new Date().toISOString().split("T")[0];
  }
  const { error } = await supabase.from("documentos_atleta").update(updateData).eq("id", documentoId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
