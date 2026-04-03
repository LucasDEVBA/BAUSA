import { createAuditedSupabaseClient } from "../client/audit";

export async function listarArtigos(categoria?: string) {
  const supabase = await createAuditedSupabaseClient();
  let query = supabase
    .from("faq_artigos")
    .select("*")
    .eq("arquivado", false)
    .order("acessos", { ascending: false });
  if (categoria) query = query.eq("categoria", categoria);
  const { data } = await query;
  return data || [];
}

export async function buscarArtigos(termo: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data } = await supabase
    .from("faq_artigos")
    .select("*")
    .eq("arquivado", false)
    .or(`titulo.ilike.%${termo}%,conteudo.ilike.%${termo}%`)
    .order("acessos", { ascending: false })
    .limit(20);
  return data || [];
}

export async function salvarArtigo(dados: {
  titulo: string;
  categoria: string;
  conteudo: string;
  fases_aplicaveis?: string[];
}, id?: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (id) {
    const { error } = await supabase.from("faq_artigos").update({
      ...dados,
      atualizado_por: user?.id,
    }).eq("id", id);
    if (error) return { success: false, error: error.message };
    return { success: true, artigoId: id };
  }

  const { data, error } = await supabase.from("faq_artigos").insert({
    ...dados,
    criado_por: user?.id,
    atualizado_por: user?.id,
  }).select("id").single();
  if (error) return { success: false, error: error.message };
  return { success: true, artigoId: data.id };
}

export async function registrarAcesso(artigoId: string) {
  const supabase = await createAuditedSupabaseClient();
  const { data: artigo } = await supabase.from("faq_artigos").select("acessos, conteudo").eq("id", artigoId).single();
  if (artigo) {
    await supabase.from("faq_artigos").update({ acessos: (artigo.acessos || 0) + 1 }).eq("id", artigoId);
  }
  return artigo?.conteudo || "";
}
